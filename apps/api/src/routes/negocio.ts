import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { CATEGORIES, extraPedidoSchema, phoneES } from '@veline/shared'
import { prisma } from '../prisma.js'
import { requireUser } from '../auth/sessions.js'
import {
  authorizeBusiness as authorize,
  cambios,
  resolverLocalDelPanel,
} from '../auth/business-scope.js'
import { audit } from '../audit/log.js'
import { idDeImagen } from '../extras.js'
import { isWithinOpeningHours, pickStaffForSlot } from '../availability.js'
import { pedirResena } from './resenas.js'
import { bookingCode } from '../codigo.js'
import { duracionConExtras, elegirExtras, totalConExtras } from '../extras.js'
import { avisarCambioHora, avisarConfirmacion } from '../mail/avisos.js'

/**
 * Lo que un negocio necesita para gestionarse solo: las personas que atienden,
 * los cierres por vacaciones, su propia ficha y una agenda que se pueda tocar.
 *
 * Antes todo esto existía en el modelo de datos pero no tenía puerta: el motor
 * de reservas ya repartía citas entre personas y respetaba los cierres, y sin
 * embargo nadie podía dar de alta a una persona ni cerrar por Navidad.
 */

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]]

const staffBody = z.object({
  name: z.string().trim().min(2, 'El nombre es demasiado corto').max(120),
  /** En qué local atiende. Sin poner = en todos. */
  locationId: z.string().min(1).nullable().optional(),
})

const staffHoursBody = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startMin: z.number().int().min(0).max(1440),
        endMin: z.number().int().min(0).max(1440),
      }),
    )
    .max(30)
    .refine(
      (rows) => rows.every((r) => r.endMin > r.startMin),
      'Cada franja debe terminar después de empezar',
    ),
})

const noteBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  text: z.string().trim().min(1, 'Escribe algo').max(280),
})

const closureBody = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    reason: z.string().trim().max(120).optional().or(z.literal('')),
  })
  .refine((c) => c.to >= c.from, 'El cierre no puede terminar antes de empezar')

const businessBody = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORY_SLUGS),
  description: z.string().trim().max(600).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  street: z.string().trim().min(3).max(160),
  city: z.string().trim().min(2).max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal son 5 cifras'),
})

/** Cita apuntada a mano desde el panel: la que entra por teléfono. */
const manualBookingBody = z.object({
  serviceId: z.string().min(1),
  /** ISO completo con zona, tal y como lo manda el navegador. */
  startsAt: z.string().datetime({ offset: true }),
  staffId: z.string().min(1).optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: phoneES,
  customerEmail: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  notes: z.string().trim().max(400).optional().or(z.literal('')),
  extras: z.array(extraPedidoSchema).max(20).default([]),
})

const rescheduleBody = z.object({
  startsAt: z.string().datetime({ offset: true }),
  staffId: z.string().min(1).optional(),
  /** Si se avisa al cliente del cambio, por correo y SMS. */
  notify: z.boolean().default(true),
})

const outcomeBody = z.object({ status: z.enum(['COMPLETADA', 'NO_ASISTIO', 'CONFIRMADA']) })

/** Las columnas @db.Date llegan a medianoche UTC: se leen en UTC, no en local. */
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

export async function negocioRoutes(app: FastifyInstance) {
  /* ── Personas que atienden ────────────────────────────────────
   * Ojo: esto NO son las cuentas de acceso al panel (eso es "Equipo").
   * Una persona puede atender citas sin tener usuario, y un administrador
   * puede tener usuario sin atender a nadie. */

  app.get('/api/panel/:slug/staff', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const rows = await prisma.staff.findMany({
      where: { businessId: auth.business.id },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { bookings: { where: { status: 'CONFIRMADA' } }, hours: true } },
      },
    })

    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      active: s.active,
      upcomingBookings: s._count.bookings,
      /** Null = atiende en cualquier local. */
      locationId: s.locationId,
      /** Si tiene horario propio, o sigue el del negocio entero. */
      hasHours: s._count.hours > 0,
    }))
  })

  app.post('/api/panel/:slug/staff', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = staffBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    /* En qué local atiende. Con uno solo, ese. Con varios, el que se diga —
       y si no se dice ninguno, ninguno: eso significa «atiende en todos», que
       es justo lo que hace falta para quien va rotando. */
    const locationId =
      auth.business.locationIds.length > 1
        ? (parsed.data.locationId ?? null)
        : auth.business.locationId

    if (parsed.data.locationId && !auth.business.locationIds.includes(parsed.data.locationId)) {
      return reply.code(400).send({ error: 'Ese local no es de este negocio' })
    }

    const created = await prisma.staff.create({
      data: { businessId: auth.business.id, locationId, name: parsed.data.name },
    })

    audit(req, {
      action: 'PERSONA_CREADA',
      summary: `Ha dado de alta a ${created.name} como persona que atiende`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Staff',
      entityId: created.id,
    })

    return reply.code(201).send({ id: created.id, name: created.name, active: created.active })
  })

  app.patch('/api/panel/:slug/staff/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = staffBody
      .partial()
      .extend({ active: z.boolean().optional() })
      .safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const existing = await prisma.staff.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Persona no encontrada' })

    // Mover a alguien al local de otro negocio dejaría una persona atendiendo
    // donde no trabaja, y saldría en los huecos de un negocio ajeno.
    if (parsed.data.locationId && !auth.business.locationIds.includes(parsed.data.locationId)) {
      return reply.code(400).send({ error: 'Ese local no es de este negocio' })
    }

    // Dar de baja a alguien con citas por delante dejaría esas citas huérfanas
    // en la agenda. Se avisa en vez de romperlas por la espalda.
    if (parsed.data.active === false) {
      const pendientes = await prisma.booking.count({
        where: { staffId: id, status: 'CONFIRMADA', startsAt: { gte: new Date() } },
      })
      if (pendientes > 0) {
        return reply.code(409).send({
          error: `${existing.name} tiene ${pendientes} ${pendientes === 1 ? 'cita' : 'citas'} por delante. Muévelas o cancélalas antes de darle de baja.`,
        })
      }
    }

    const updated = await prisma.staff.update({ where: { id }, data: parsed.data })

    const soloEstado = parsed.data.active !== undefined && parsed.data.name === undefined
    audit(req, {
      action: soloEstado
        ? parsed.data.active
          ? 'PERSONA_ACTIVADA'
          : 'PERSONA_DESACTIVADA'
        : 'PERSONA_EDITADA',
      summary: soloEstado
        ? `Ha ${parsed.data.active ? 'reactivado' : 'dado de baja'} a ${existing.name}`
        : `Ha editado a ${updated.name}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Staff',
      entityId: id,
      metadata: cambios(existing, updated, ['name', 'active']),
    })

    return { id: updated.id, name: updated.name, active: updated.active }
  })

  /**
   * Borrar de verdad, no dar de baja. Solo se puede si ya está de baja: en
   * activo nunca hay citas por delante huérfanas (no se le puede asignar
   * ninguna nueva estando inactivo), así que exigir el paso por «dar de baja»
   * primero es la misma comprobación de citas pendientes, hecha una vez y no
   * en cada sitio que borre.
   */
  app.delete('/api/panel/:slug/staff/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const existing = await prisma.staff.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Persona no encontrada' })

    if (existing.active) {
      return reply.code(409).send({ error: `Dale de baja a ${existing.name} antes de eliminarla.` })
    }

    await prisma.staff.delete({ where: { id } })

    audit(req, {
      action: 'PERSONA_ELIMINADA',
      summary: `Ha eliminado a ${existing.name}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Staff',
      entityId: id,
    })

    return reply.code(204).send()
  })

  /**
   * El horario propio de una persona. Sin ninguna franja aquí sigue el
   * horario del negocio entero, así que una lista vacía es un estado válido
   * y no «vuelve a poner por defecto» nada.
   */
  app.get('/api/panel/:slug/staff/:id/hours', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const existing = await prisma.staff.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Persona no encontrada' })

    return prisma.staffHour.findMany({
      where: { staffId: id },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    })
  })

  app.put('/api/panel/:slug/staff/:id/hours', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const existing = await prisma.staff.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Persona no encontrada' })

    const parsed = staffHoursBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Horario inválido', details: parsed.error.flatten() })
    }

    const anterior = await prisma.staffHour.findMany({
      where: { staffId: id },
      select: { weekday: true, startMin: true, endMin: true },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    })

    await prisma.$transaction([
      prisma.staffHour.deleteMany({ where: { staffId: id } }),
      prisma.staffHour.createMany({
        data: parsed.data.hours.map((r) => ({ ...r, staffId: id })),
      }),
    ])

    audit(req, {
      action: 'PERSONA_HORARIO_EDITADO',
      summary: `Ha cambiado el horario de ${existing.name}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Staff',
      entityId: id,
      metadata: { antes: anterior, despues: parsed.data.hours },
    })

    return prisma.staffHour.findMany({
      where: { staffId: id },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    })
  })

  /* ── Cierres: vacaciones y festivos ─────────────────────────
   * El modelo guarda UN DÍA por fila (así lo consulta el motor de huecos).
   * De cara al negocio eso no vale: unas vacaciones son un rango, no quince
   * filas. La API acepta el rango, guarda los días sueltos y al listarlos
   * vuelve a juntarlos en tramos seguidos con el mismo motivo. */

  app.get('/api/panel/:slug/closures', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })
    const locationId = resolverLocalDelPanel(auth.business, (req.query as { local?: string }).local)
    if (!locationId) return []

    const desde = new Date()
    desde.setUTCHours(0, 0, 0, 0)

    const dias = await prisma.closure.findMany({
      where: { locationId, date: { gte: desde } },
      orderBy: { date: 'asc' },
    })

    const tramos: { from: string; to: string; reason: string | null; ids: string[] }[] = []
    for (const d of dias) {
      const key = dayKey(d.date)
      const ultimo = tramos[tramos.length - 1]
      const siguienteAlUltimo =
        ultimo && dayKey(addDays(new Date(`${ultimo.to}T00:00:00Z`), 1)) === key
      if (ultimo && siguienteAlUltimo && ultimo.reason === d.reason) {
        ultimo.to = key
        ultimo.ids.push(d.id)
      } else {
        tramos.push({ from: key, to: key, reason: d.reason, ids: [d.id] })
      }
    }

    return tramos
  })

  app.post('/api/panel/:slug/closures', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })
    const locationId = resolverLocalDelPanel(auth.business, (req.query as { local?: string }).local)
    if (!locationId) {
      return reply.code(404).send({ error: 'El negocio no tiene local' })
    }

    const parsed = closureBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const desde = new Date(`${parsed.data.from}T00:00:00Z`)
    const hasta = new Date(`${parsed.data.to}T00:00:00Z`)
    const dias = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1
    if (dias > 366) return reply.code(400).send({ error: 'El cierre no puede pasar de un año' })

    const fechas = Array.from({ length: dias }, (_, i) => addDays(desde, i))

    // Las citas ya confirmadas dentro del cierre no se tocan solas: se avisa
    // para que el negocio decida si las mueve o las cancela.
    const afectadas = await prisma.booking.count({
      where: {
        businessId: auth.business.id,
        status: 'CONFIRMADA',
        startsAt: {
          gte: new Date(`${parsed.data.from}T00:00:00`),
          lte: new Date(`${parsed.data.to}T23:59:59`),
        },
      },
    })

    await prisma.closure.createMany({
      data: fechas.map((date) => ({
        locationId,
        date,
        reason: parsed.data.reason || null,
      })),
      skipDuplicates: true,
    })

    audit(req, {
      action: 'CIERRE_CREADO',
      summary: `Ha cerrado del ${parsed.data.from} al ${parsed.data.to}${parsed.data.reason ? ` (${parsed.data.reason})` : ''}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Closure',
      entityId: locationId,
      metadata: {
        desde: parsed.data.from,
        hasta: parsed.data.to,
        dias,
        citasAfectadas: afectadas,
      },
    })

    return reply.code(201).send({
      from: parsed.data.from,
      to: parsed.data.to,
      reason: parsed.data.reason || null,
      days: dias,
      affectedBookings: afectadas,
    })
  })

  /** Se borra el tramo entero, por los ids que devolvió el listado. */
  app.delete('/api/panel/:slug/closures', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = z.object({ ids: z.array(z.string().min(1)).min(1).max(400) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' })

    // El filtro por locationId es lo que impide borrar cierres de otro negocio
    // mandando ids ajenos.
    const { count } = await prisma.closure.deleteMany({
      where: {
        id: { in: parsed.data.ids },
        locationId:
          resolverLocalDelPanel(auth.business, (req.query as { local?: string }).local) ??
          '__ninguno__',
      },
    })
    if (count === 0) return reply.code(404).send({ error: 'Cierre no encontrado' })

    audit(req, {
      action: 'CIERRE_ELIMINADO',
      summary: `Ha quitado un cierre de ${count} ${count === 1 ? 'día' : 'días'}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Closure',
      metadata: { dias: count },
    })

    return reply.code(204).send()
  })

  /**
   * Notas libres del calendario: no son citas ni cierran nada, es un aviso
   * apuntado en un día ("vacaciones", "revisar el pedido"). Mismo alcance
   * que la propia Agenda —cualquiera con acceso al panel—, no solo quien
   * configura: es para quien lleva el día a día, no un ajuste del negocio.
   */
  app.get('/api/panel/:slug/notes', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const { from, to } = req.query as { from?: string; to?: string }
    if (!from || !to) return reply.code(400).send({ error: 'Faltan las fechas' })

    const notas = await prisma.calendarNote.findMany({
      where: { businessId: auth.business.id, date: { gte: new Date(from), lte: new Date(to) } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    })

    // dayKey y no el ISO tal cual: la columna @db.Date llega a medianoche
    // UTC, y en local se desplazaría al día de al lado.
    return notas.map((n) => ({ id: n.id, date: dayKey(n.date), text: n.text }))
  })

  app.post('/api/panel/:slug/notes', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = noteBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const created = await prisma.calendarNote.create({
      data: {
        businessId: auth.business.id,
        date: new Date(parsed.data.date),
        text: parsed.data.text,
      },
    })

    audit(req, {
      action: 'NOTA_CREADA',
      summary: `Ha apuntado una nota el ${parsed.data.date}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'CalendarNote',
      entityId: created.id,
    })

    return reply.code(201).send({ id: created.id, date: dayKey(created.date), text: created.text })
  })

  app.delete('/api/panel/:slug/notes/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const existing = await prisma.calendarNote.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Nota no encontrada' })

    await prisma.calendarNote.delete({ where: { id } })

    audit(req, {
      action: 'NOTA_ELIMINADA',
      summary: 'Ha quitado una nota del calendario',
      actor: user,
      businessId: auth.business.id,
      entity: 'CalendarNote',
      entityId: id,
    })

    return reply.code(204).send()
  })

  /* ── La ficha del negocio ─────────────────────────────────── */

  app.get('/api/panel/:slug/profile', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const b = await prisma.business.findUnique({
      where: { id: auth.business.id },
      include: { locations: { take: 1, orderBy: { id: 'asc' } } },
    })
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado' })

    const loc = b.locations[0]
    return {
      slug: b.slug,
      name: b.name,
      category: b.category,
      description: b.description ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      photos: b.photos,
      street: loc?.street ?? '',
      city: loc?.city ?? '',
      postalCode: loc?.postalCode ?? '',
    }
  })

  app.put('/api/panel/:slug/profile', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = businessBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        details: parsed.error.flatten(),
      })
    }
    const d = parsed.data

    const before = await prisma.business.findUnique({ where: { id: auth.business.id } })
    if (!before) return reply.code(404).send({ error: 'Negocio no encontrado' })

    // El slug NO se toca al renombrar: es la dirección pública del negocio y
    // cambiarla rompería todos los enlaces ya compartidos.
    const updated = await prisma.business.update({
      where: { id: auth.business.id },
      data: {
        name: d.name,
        category: d.category,
        description: d.description || null,
        phone: d.phone || null,
        email: d.email || null,
      },
    })

    const loc = await prisma.location.findFirst({
      where: { businessId: auth.business.id },
      orderBy: { id: 'asc' },
    })
    if (loc) {
      await prisma.location.update({
        where: { id: loc.id },
        data: { street: d.street, city: d.city, postalCode: d.postalCode },
      })
    } else {
      await prisma.location.create({
        data: {
          businessId: auth.business.id,
          street: d.street,
          city: d.city,
          postalCode: d.postalCode,
        },
      })
    }

    audit(req, {
      action: 'NEGOCIO_EDITADO',
      summary: `Ha editado la ficha de ${updated.name}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Business',
      entityId: auth.business.id,
      metadata: cambios(before, updated, ['name', 'category', 'description', 'phone', 'email']),
    })

    return { ok: true }
  })

  /* ── Fotos de la ficha ────────────────────────────────────── */

  app.put('/api/panel/:slug/photos', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    // Direcciones de fotos ya subidas a /panel/:slug/imagenes, no URLs
    // sueltas: exigir z.string().url() nunca dejaba guardar nada, porque esas
    // fotos viven en /api/imagenes/:id, una ruta relativa a este dominio.
    const parsed = z.object({ photos: z.array(z.string().max(80)).max(10) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Fotos inválidas' })

    // Sin duplicados: no hay motivo para enseñar la misma foto dos veces en
    // la ficha, y un duplicado colado inflaría la cuenta de más abajo.
    const fotos = [...new Set(parsed.data.photos)]
    const ids = fotos.map(idDeImagen)
    if (ids.some((id) => id === null)) {
      return reply.code(400).send({ error: 'Alguna foto no es válida. Súbela de nuevo.' })
    }
    // Cada foto tiene que ser nuestra y de este negocio: si no, se podría
    // enseñar en la ficha una foto subida por otro negocio.
    const validas = await prisma.imagen.count({
      where: { id: { in: ids as string[] }, businessId: auth.business.id },
    })
    if (validas !== ids.length) {
      return reply.code(400).send({ error: 'Alguna foto no es válida. Súbela de nuevo.' })
    }

    await prisma.business.update({
      where: { id: auth.business.id },
      data: { photos: fotos },
    })

    audit(req, {
      action: 'NEGOCIO_EDITADO',
      summary: `Ha cambiado las fotos de ${auth.business.name}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Business',
      entityId: auth.business.id,
      metadata: { fotos: fotos.length },
    })

    return { ok: true, photos: fotos }
  })

  /* ── Clientes ─────────────────────────────────────────────
   * Los clientes y su historial estaban guardados desde el principio, pero no
   * había pantalla: nadie podía saber quién repite, quién falta o a quién
   * llamar. Se calcula sobre las citas de ESTE negocio — un cliente que
   * reserva en dos sitios no comparte su historial entre ellos. */

  app.get('/api/panel/:slug/customers', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const q = (req.query as { q?: string }).q?.trim().toLowerCase() ?? ''

    const citas = await prisma.booking.findMany({
      where: {
        businessId: auth.business.id,
        ...(q
          ? {
              customer: {
                OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }],
              },
            }
          : {}),
      },
      orderBy: { startsAt: 'desc' },
      include: { customer: true },
      take: 1000,
    })

    const porCliente = new Map<
      string,
      {
        id: string
        name: string
        phone: string
        email: string | null
        total: number
        completadas: number
        ausencias: number
        canceladas: number
        gastadoCents: number
        ultima: Date | null
        proxima: Date | null
      }
    >()

    const ahora = Date.now()

    for (const c of citas) {
      const actual = porCliente.get(c.customerId) ?? {
        id: c.customerId,
        name: c.customer.name,
        phone: c.customer.phone,
        email: c.customer.email,
        total: 0,
        completadas: 0,
        ausencias: 0,
        canceladas: 0,
        gastadoCents: 0,
        ultima: null as Date | null,
        proxima: null as Date | null,
      }

      actual.total++
      if (c.status === 'COMPLETADA') {
        actual.completadas++
        actual.gastadoCents += c.priceCents
      }
      if (c.status === 'NO_ASISTIO') actual.ausencias++
      if (c.status === 'CANCELADA') actual.canceladas++

      const t = c.startsAt.getTime()
      if (t <= ahora && (!actual.ultima || c.startsAt > actual.ultima)) actual.ultima = c.startsAt
      if (
        t > ahora &&
        c.status === 'CONFIRMADA' &&
        (!actual.proxima || c.startsAt < actual.proxima)
      ) {
        actual.proxima = c.startsAt
      }

      porCliente.set(c.customerId, actual)
    }

    return [...porCliente.values()]
      .sort((a, b) => (b.ultima?.getTime() ?? 0) - (a.ultima?.getTime() ?? 0))
      .map((c) => ({
        ...c,
        ultima: c.ultima?.toISOString() ?? null,
        proxima: c.proxima?.toISOString() ?? null,
      }))
  })

  /* ── Agenda operativa ─────────────────────────────────────── */

  /** Apuntar a mano la cita que entra por teléfono o en mostrador. */
  app.post('/api/panel/:slug/bookings', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = manualBookingBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        details: parsed.error.flatten(),
      })
    }
    const input = parsed.data

    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, businessId: auth.business.id },
    })
    if (!service) return reply.code(404).send({ error: 'Servicio no encontrado' })

    const carta = input.extras.length
      ? await prisma.extra.findMany({ where: { businessId: auth.business.id, active: true } })
      : []
    const extras = elegirExtras(input.extras, carta)
    if (!extras) {
      return reply.code(422).send({ error: 'Alguno de los extras ya no está en la carta' })
    }

    const start = new Date(input.startsAt)
    // Con extras que alargan, la cita del mostrador ocupa lo mismo que la de
    // la web: si no, el negocio se llenaría la agenda de solapes propios.
    const end = new Date(start.getTime() + duracionConExtras(service.durationMin, extras) * 60_000)
    const blockedTo = new Date(end.getTime() + service.bufferMin * 60_000)

    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          const staff = await pickStaffForSlot(tx, {
            businessId: auth.business.id,
            start,
            end: blockedTo,
            preferredStaffId: input.staffId,
          })
          if (!staff) {
            throw Object.assign(new Error('No queda nadie libre a esa hora'), { statusCode: 409 })
          }

          const customer = await tx.customer.upsert({
            where: { phone: input.customerPhone },
            create: {
              name: input.customerName,
              phone: input.customerPhone,
              email: input.customerEmail || null,
            },
            update: {
              name: input.customerName,
              ...(input.customerEmail ? { email: input.customerEmail } : {}),
            },
          })

          return tx.booking.create({
            data: {
              code: bookingCode(),
              businessId: auth.business.id,
              locationId: auth.business.locationId,
              serviceId: service.id,
              staffId: staff.id,
              customerId: customer.id,
              startsAt: start,
              endsAt: end,
              blockedTo,
              priceCents: totalConExtras(service.priceCents, extras),
              notes: input.notes || null,
              // Una cita apuntada a mano nunca es del marketplace: la trajo el
              // negocio. Por eso no genera comisión.
              source: 'DIRECTO',
              /* Sin idioma: cae en ES por defecto. La cita la apunta el
                 negocio de oído —por teléfono o en el mostrador—, así que no
                 hay ningún idioma que leer. Si algún día atienden a clientes
                 extranjeros habrá que preguntarlo en este formulario; hasta
                 entonces, inventarlo sería peor que dejarlo en castellano. */
              isFirstFromMarketplace: false,
              commissionCents: 0,
              extras: {
                create: extras.map((e) => ({
                  extraId: e.id,
                  name: e.name,
                  priceCents: e.priceCents,
                  durationMin: e.durationMin,
                  quantity: e.quantity,
                })),
              },
            },
            include: { customer: true, service: true, staff: true },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      audit(req, {
        action: 'RESERVA_CREADA',
        summary: `Ha apuntado a mano la cita de ${booking.customer.name} (${booking.code})`,
        actor: user,
        businessId: auth.business.id,
        entity: 'Booking',
        entityId: booking.id,
        metadata: { codigo: booking.code, cuando: booking.startsAt, origen: 'panel' },
      })

      // La misma confirmación que al reservar por la web: el formulario del
      // panel promete que el cliente la recibe, y hasta ahora no salía nada.
      void avisarConfirmacion(booking.id)

      return reply.code(201).send({ id: booking.id, code: booking.code })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        return reply.code(409).send({ error: 'Ese hueco acaba de ocuparse' })
      }
      const status = (err as { statusCode?: number }).statusCode
      if (status) return reply.code(status).send({ error: (err as Error).message })
      throw err
    }
  })

  /** Mover una cita de hora. */
  app.patch('/api/panel/:slug/bookings/:id/reschedule', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = rescheduleBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Fecha inválida' })

    const existing = await prisma.booking.findFirst({
      where: { id, businessId: auth.business.id },
      include: { service: true, customer: true, extras: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Cita no encontrada' })
    if (existing.status !== 'CONFIRMADA') {
      return reply.code(409).send({ error: 'Solo se pueden mover las citas confirmadas' })
    }

    const start = new Date(parsed.data.startsAt)
    /* Los minutos que guardó la cita, no los que tenga hoy el extra: mover una
       cita no es rehacerla, y su hueco tiene que seguir siendo el que se le
       prometió al cliente. */
    const duracion = duracionConExtras(existing.service.durationMin, existing.extras)
    const end = new Date(start.getTime() + duracion * 60_000)
    const blockedTo = new Date(end.getTime() + existing.service.bufferMin * 60_000)

    const dentro = await isWithinOpeningHours(
      auth.business.id,
      start,
      duracion + existing.service.bufferMin,
    )
    if (!dentro) {
      return reply.code(409).send({ error: 'Esa hora cae fuera del horario o en un día cerrado' })
    }

    try {
      const moved = await prisma.$transaction(
        async (tx) => {
          // Se libera el hueco viejo antes de buscar quién queda libre, si no
          // la propia cita que estamos moviendo se cuenta como ocupada.
          await tx.booking.update({ where: { id }, data: { status: 'CANCELADA' } })

          const staff = await pickStaffForSlot(tx, {
            businessId: auth.business.id,
            start,
            end: blockedTo,
            preferredStaffId: parsed.data.staffId ?? existing.staffId ?? undefined,
          })
          if (!staff) {
            throw Object.assign(new Error('No queda nadie libre a esa hora'), { statusCode: 409 })
          }

          return tx.booking.update({
            where: { id },
            data: {
              status: 'CONFIRMADA',
              staffId: staff.id,
              startsAt: start,
              endsAt: end,
              blockedTo,
              /* El recordatorio era para la hora vieja. Si ya había salido, la
                 hora nueva se quedaría sin él: se deja pendiente otra vez y el
                 proceso de recordatorios lo manda cuando toque. No duplica,
                 porque solo busca citas que empiezan dentro de 24 h y media:
                 una cita movida a dentro de pocas horas no entra. */
              reminderSentAt: null,
            },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      audit(req, {
        action: 'RESERVA_MOVIDA',
        summary: `Ha movido la cita de ${existing.customer.name} (${existing.code})`,
        actor: user,
        businessId: auth.business.id,
        entity: 'Booking',
        entityId: id,
        metadata: {
          antes: existing.startsAt,
          despues: moved.startsAt,
          avisado: parsed.data.notify,
        },
      })

      if (parsed.data.notify) void avisarCambioHora(id, existing.startsAt)

      return { ok: true, startsAt: moved.startsAt }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        return reply.code(409).send({ error: 'Ese hueco acaba de ocuparse' })
      }
      const status = (err as { statusCode?: number }).statusCode
      if (status) return reply.code(status).send({ error: (err as Error).message })
      throw err
    }
  })

  /** Marcar si el cliente vino, no vino, o deshacerlo. */
  app.patch('/api/panel/:slug/bookings/:id/outcome', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = outcomeBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Estado inválido' })

    const existing = await prisma.booking.findFirst({
      where: { id, businessId: auth.business.id },
      include: { customer: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Cita no encontrada' })
    if (existing.status === 'CANCELADA') {
      return reply.code(409).send({ error: 'Esta cita está cancelada' })
    }

    await prisma.booking.update({ where: { id }, data: { status: parsed.data.status } })

    // Atendida = momento de pedir la reseña. Se dispara y se olvida: si el
    // correo falla, la cita ya está marcada y eso es lo que importaba.
    if (parsed.data.status === 'COMPLETADA') {
      void pedirResena(id).catch((err) => req.log.error({ err }, 'no se pudo pedir la reseña'))
    }

    const accion =
      parsed.data.status === 'COMPLETADA'
        ? 'RESERVA_COMPLETADA'
        : parsed.data.status === 'NO_ASISTIO'
          ? 'RESERVA_NO_ASISTIO'
          : 'RESERVA_MOVIDA'

    audit(req, {
      action: accion,
      summary:
        parsed.data.status === 'COMPLETADA'
          ? `Ha marcado como atendida la cita de ${existing.customer.name} (${existing.code})`
          : parsed.data.status === 'NO_ASISTIO'
            ? `Ha marcado que ${existing.customer.name} no vino (${existing.code})`
            : `Ha deshecho el estado de la cita de ${existing.customer.name} (${existing.code})`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Booking',
      entityId: id,
      metadata: { antes: existing.status, despues: parsed.data.status },
    })

    return { ok: true, status: parsed.data.status }
  })
}
