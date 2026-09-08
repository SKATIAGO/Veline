import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { authorizeBusiness } from '../auth/business-scope.js'
import { audit } from '../audit/log.js'
import { canConfigureBusiness } from '../auth/permissions.js'
import { requireUser } from '../auth/sessions.js'

/**
 * Registro de jornada.
 *
 * Ficha cada uno por su cuenta: no hay forma de fichar por otro, ni siquiera
 * siendo administrador. Es lo que hace que el registro signifique algo — quien
 * ficha ha metido su contraseña.
 *
 * El administrador sí puede CORREGIR un fichaje ajeno (alguien se olvidó de
 * salir, entró antes de que le diera tiempo a abrir el panel), pero corregir
 * no es lo mismo que fichar: se guarda lo que decía antes, quién lo tocó y por
 * qué, y queda en el registro de actividad.
 */

const correccionSchema = z
  .object({
    entrada: z.string().datetime({ offset: true }),
    salida: z.string().datetime({ offset: true }).nullable().optional(),
    motivo: z.string().trim().min(3, 'Escribe por qué se corrige').max(300),
  })
  .refine((d) => !d.salida || new Date(d.salida) > new Date(d.entrada), {
    message: 'La salida no puede ser anterior a la entrada',
  })

const rangoSchema = z.object({
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

/** Lo que se devuelve al panel de un fichaje. */
const aDTO = (f: {
  id: string
  userId: string
  entrada: Date
  salida: Date | null
  entradaOriginal: Date | null
  salidaOriginal: Date | null
  corregidoEn: Date | null
  motivo: string | null
  user: { name: string; email: string }
  corregidoPor: { name: string } | null
}) => ({
  id: f.id,
  userId: f.userId,
  persona: f.user.name,
  email: f.user.email,
  entrada: f.entrada.toISOString(),
  salida: f.salida?.toISOString() ?? null,
  /** Minutos trabajados. Null mientras la jornada sigue abierta. */
  minutos: f.salida ? Math.round((f.salida.getTime() - f.entrada.getTime()) / 60000) : null,
  correccion: f.corregidoEn
    ? {
        por: f.corregidoPor?.name ?? 'Cuenta eliminada',
        cuando: f.corregidoEn.toISOString(),
        motivo: f.motivo,
        entradaOriginal: f.entradaOriginal?.toISOString() ?? null,
        salidaOriginal: f.salidaOriginal?.toISOString() ?? null,
      }
    : null,
})

const incluir = {
  user: { select: { name: true, email: true } },
  corregidoPor: { select: { name: true } },
}

export async function fichajeRoutes(app: FastifyInstance) {
  /** Mi jornada abierta ahora mismo, si la hay. */
  app.get('/api/panel/:slug/fichajes/abierto', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }
    const scope = await authorizeBusiness(user, slug, 'agenda')
    if (!scope.ok) return reply.code(scope.status).send({ error: scope.error })

    const abierto = await prisma.fichaje.findFirst({
      where: { userId: user.id, businessId: scope.business.id, salida: null },
      orderBy: { entrada: 'desc' },
      include: incluir,
    })
    return { fichaje: abierto ? aDTO(abierto) : null }
  })

  /** Entrar. */
  app.post('/api/panel/:slug/fichajes/entrada', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }
    const scope = await authorizeBusiness(user, slug, 'agenda')
    if (!scope.ok) return reply.code(scope.status).send({ error: scope.error })

    // Dos entradas seguidas sin salir dejarían dos jornadas abiertas y ninguna
    // forma de saber cuál cerrar después.
    const abierto = await prisma.fichaje.findFirst({
      where: { userId: user.id, businessId: scope.business.id, salida: null },
    })
    if (abierto) {
      return reply.code(409).send({ error: 'Ya tienes una jornada abierta. Cierra esa primero.' })
    }

    const f = await prisma.fichaje.create({
      data: { userId: user.id, businessId: scope.business.id, entrada: new Date() },
      include: incluir,
    })
    return reply.code(201).send(aDTO(f))
  })

  /** Salir. */
  app.post('/api/panel/:slug/fichajes/salida', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }
    const scope = await authorizeBusiness(user, slug, 'agenda')
    if (!scope.ok) return reply.code(scope.status).send({ error: scope.error })

    const abierto = await prisma.fichaje.findFirst({
      where: { userId: user.id, businessId: scope.business.id, salida: null },
      orderBy: { entrada: 'desc' },
    })
    if (!abierto) {
      return reply.code(409).send({ error: 'No tienes ninguna jornada abierta.' })
    }

    const f = await prisma.fichaje.update({
      where: { id: abierto.id },
      data: { salida: new Date() },
      include: incluir,
    })
    return aDTO(f)
  })

  /**
   * El histórico. Un empleado ve SOLO el suyo; el administrador, el de todos.
   * La ley pide que cada trabajador pueda consultar el suyo — no el de sus
   * compañeros.
   */
  app.get('/api/panel/:slug/fichajes', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }
    const scope = await authorizeBusiness(user, slug, 'agenda')
    if (!scope.ok) return reply.code(scope.status).send({ error: scope.error })

    const parsed = rangoSchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Fechas inválidas' })

    const todos = canConfigureBusiness(user, scope.business.id)
    const { desde, hasta } = parsed.data

    const filas = await prisma.fichaje.findMany({
      where: {
        businessId: scope.business.id,
        ...(todos ? {} : { userId: user.id }),
        ...(desde || hasta
          ? {
              entrada: {
                ...(desde ? { gte: new Date(`${desde}T00:00:00`) } : {}),
                ...(hasta ? { lte: new Date(`${hasta}T23:59:59.999`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { entrada: 'desc' },
      take: 500,
      include: incluir,
    })

    return { puedeVerTodos: todos, fichajes: filas.map(aDTO) }
  })

  /**
   * Corregir un fichaje. Solo administrador, y el motivo es obligatorio.
   *
   * Guarda lo que decía antes: un registro que se puede reescribir sin dejar
   * rastro no prueba nada, y lo que prueba es justo para lo que existe.
   */
  app.patch('/api/panel/:slug/fichajes/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const scope = await authorizeBusiness(user, slug, 'configuracion')
    if (!scope.ok) return reply.code(scope.status).send({ error: scope.error })

    const parsed = correccionSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const antes = await prisma.fichaje.findUnique({ where: { id }, include: incluir })
    if (!antes || antes.businessId !== scope.business.id) {
      return reply.code(404).send({ error: 'Fichaje no encontrado' })
    }

    const f = await prisma.fichaje.update({
      where: { id },
      data: {
        entrada: new Date(parsed.data.entrada),
        salida: parsed.data.salida ? new Date(parsed.data.salida) : null,
        // Solo la primera corrección guarda el original: si se corrigiera dos
        // veces, lo que interesa conservar sigue siendo lo que se fichó.
        entradaOriginal: antes.entradaOriginal ?? antes.entrada,
        salidaOriginal: antes.salidaOriginal ?? antes.salida,
        corregidoPorId: user.id,
        corregidoEn: new Date(),
        motivo: parsed.data.motivo,
      },
      include: incluir,
    })

    audit(req, {
      action: 'FICHAJE_CORREGIDO',
      summary: `Ha corregido el fichaje de ${antes.user.name}`,
      actor: user,
      businessId: scope.business.id,
      entity: 'Fichaje',
      entityId: id,
      metadata: {
        motivo: parsed.data.motivo,
        entrada: { antes: antes.entrada.toISOString(), despues: parsed.data.entrada },
        salida: {
          antes: antes.salida?.toISOString() ?? null,
          despues: parsed.data.salida ?? null,
        },
      },
    })

    return aDTO(f)
  })

  /**
   * El registro en un archivo, para la Inspección o para la gestoría.
   *
   * CSV con punto y coma y BOM: es lo que abre Excel en español sin pelearse
   * con los acentos ni meter todo en una columna. Un PDF se vería mejor, pero
   * lo que piden es poder leer los datos, no mirarlos.
   *
   * La columna del original va SIEMPRE, aunque esté vacía: un registro donde
   * las correcciones no se distinguen de lo fichado no sirve para lo que se
   * pide.
   */
  app.get('/api/panel/:slug/fichajes/export', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }
    const scope = await authorizeBusiness(user, slug, 'configuracion')
    if (!scope.ok) return reply.code(scope.status).send({ error: scope.error })

    const parsed = rangoSchema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Fechas inválidas' })
    const { desde, hasta } = parsed.data

    const filas = await prisma.fichaje.findMany({
      where: {
        businessId: scope.business.id,
        ...(desde || hasta
          ? {
              entrada: {
                ...(desde ? { gte: new Date(`${desde}T00:00:00`) } : {}),
                ...(hasta ? { lte: new Date(`${hasta}T23:59:59.999`) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ entrada: 'asc' }],
      include: incluir,
    })

    const fecha = (d: Date | null) =>
      d ? d.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : ''
    // Las comillas dentro de un campo se escapan doblándolas, o el CSV se
    // rompe en cuanto alguien escriba una en el motivo.
    const campo = (v: string) => `"${v.replace(/"/g, '""')}"`

    const cabecera = [
      'Persona',
      'Email',
      'Entrada',
      'Salida',
      'Horas',
      'Corregido',
      'Entrada original',
      'Salida original',
      'Corregido por',
      'Motivo',
    ]

    const lineas = filas.map((f) => {
      const min = f.salida ? Math.round((f.salida.getTime() - f.entrada.getTime()) / 60000) : null
      return [
        campo(f.user.name),
        campo(f.user.email),
        campo(fecha(f.entrada)),
        campo(fecha(f.salida)),
        campo(min === null ? '' : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`),
        campo(f.corregidoEn ? 'Sí' : 'No'),
        campo(fecha(f.entradaOriginal)),
        campo(fecha(f.salidaOriginal)),
        campo(f.corregidoPor?.name ?? ''),
        campo(f.motivo ?? ''),
      ].join(';')
    })

    const csv = '\ufeff' + [cabecera.map(campo).join(';'), ...lineas].join('\r\n')
    const nombre = `fichajes-${slug}${desde ? `-${desde}` : ''}${hasta ? `-${hasta}` : ''}.csv`

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${nombre}"`)
      .send(csv)
  })
}
