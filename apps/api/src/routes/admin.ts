import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { aceptaReservas, CATEGORIES, cuotaMensualCents, PRUEBA_DIAS_DEFECTO } from '@veline/shared'
import { prisma } from '../prisma.js'
import { cambios } from '../auth/business-scope.js'
import { audit } from '../audit/log.js'
import { hashPassword } from '../auth/passwords.js'
import { canManagePlatform } from '../auth/permissions.js'
import { requireUser } from '../auth/sessions.js'
import { slugLibre } from '../slug.js'
import { describeMailConfig } from '../mail/enviar.js'
import { describeSmsConfig, smsMode } from '../mail/acumbamail.js'
import { readMailConfig } from '../mail/tipos.js'

/**
 * Gestión de la plataforma. SOLO superadmin: dar de alta negocios, crear el
 * administrador de cada uno y ver el estado general.
 */

const createBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]]),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  street: z.string().trim().min(3).max(160),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(10),
})

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
  role: z.enum(['ADMIN', 'EMPLEADO']),
  businessId: z.string().min(1),
})

const subscriptionBody = z.object({
  plan: z.enum(['GRATIS', 'NEGOCIO', 'EQUIPOS']).optional(),
  status: z.enum(['PRUEBA', 'ACTIVA', 'IMPAGADA', 'SUSPENDIDA', 'CANCELADA']).optional(),
  /** Días que se suman a la prueba desde hoy (o desde el fin actual si no ha vencido). */
  trialDays: z.number().int().min(1).max(365).optional(),
  adminNotes: z.string().trim().max(600).optional(),
})

export async function adminRoutes(app: FastifyInstance) {
  app.get('/api/admin/businesses', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const rows = await prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            bookings: true,
            users: true,
            services: true,
            staff: { where: { active: true } },
          },
        },
      },
    })
    return rows.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      category: b.category,
      plan: b.plan,
      email: b.email,
      createdAt: b.createdAt.toISOString(),
      counts: b._count,
      subStatus: b.subStatus,
      trialEndsAt: b.trialEndsAt?.toISOString() ?? null,
      approvedAt: b.approvedAt?.toISOString() ?? null,
      adminNotes: b.adminNotes,
      /** Lo que costaría este mes con las personas que tiene ahora. */
      monthlyCents: cuotaMensualCents(b.plan, b._count.staff),
      accepting: aceptaReservas(b.subStatus, b.trialEndsAt),
    }))
  })

  /**
   * Qué sale de verdad del servidor: correo y SMS.
   *
   * Existe porque la configuración de envío vive en el .env del servidor, que
   * no está en el repositorio, y la única forma de verla era entrar por SSH y
   * leer el log de arranque. Con SMS_MODE en dry todo parece funcionar —las
   * citas se confirman, los contadores suben— y no sale ni un mensaje.
   *
   * Dice si el token y la clave están puestos, pero NUNCA los devuelve.
   */
  app.get('/api/admin/envios', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const correo = readMailConfig()
    const claveCorreo =
      correo.provider === 'brevo' ? !!process.env.BREVO_API_KEY : !!process.env.ACUMBAMAIL_TOKEN
    const desde = new Date(Date.now() - 7 * 86_400_000)

    const [grupos, ultimoSms] = await Promise.all([
      prisma.messageLog.groupBy({
        by: ['channel', 'kind', 'status', 'reason'],
        where: { createdAt: { gte: desde } },
        _count: { _all: true },
      }),
      prisma.messageLog.findFirst({
        where: { channel: 'SMS', status: 'ENVIADO' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    return {
      correo: {
        activo: correo.mode === 'live' && claveCorreo && !!correo.fromEmail && !correo.overrideTo,
        texto: describeMailConfig(),
      },
      sms: {
        activo:
          smsMode() === 'live' && !!process.env.ACUMBAMAIL_TOKEN && !process.env.SMS_OVERRIDE_TO,
        texto: describeSmsConfig(),
      },
      ultimoSmsEnviado: ultimoSms?.createdAt.toISOString() ?? null,
      ultimos7dias: grupos
        .map((g) => ({
          canal: g.channel,
          tipo: g.kind,
          estado: g.status,
          motivo: g.reason,
          total: g._count._all,
        }))
        .sort((a, b) => b.total - a.total),
    }
  })

  app.post('/api/admin/businesses', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const parsed = createBusinessSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const d = parsed.data

    const slug = await slugLibre(d.name)
    if (!slug) {
      return reply.code(400).send({ error: 'El nombre no genera un identificador válido' })
    }

    const business = await prisma.business.create({
      data: {
        slug,
        name: d.name,
        category: d.category,
        email: d.email,
        phone: d.phone || null,
        // Sin esto, `trialEndsAt` se queda a null: `aceptaReservas()` solo
        // corta una prueba cuando esa fecha existe y ya ha pasado, así que
        // una prueba sin fecha es una prueba que nunca caduca. La web
        // promete 15 días — el negocio tiene que empezar a contarlos desde
        // que se crea, no desde que alguien se acuerde de ponerlos a mano.
        trialEndsAt: new Date(Date.now() + PRUEBA_DIAS_DEFECTO * 86_400_000),
        // Darlo de alta a mano ES la revisión: nace publicado.
        approvedAt: new Date(),
        locations: {
          create: { street: d.street, city: d.city, postalCode: d.postalCode },
        },
      },
    })
    audit(req, {
      action: 'NEGOCIO_CREADO',
      summary: `Ha dado de alta el negocio «${business.name}»`,
      actor: user,
      businessId: business.id,
      entity: 'Business',
      entityId: business.id,
      metadata: { slug: business.slug, categoria: business.category, ciudad: d.city },
    })

    return reply.code(201).send({ id: business.id, slug: business.slug, name: business.name })
  })

  /** Cambiar de plan, ampliar la prueba, suspender o reactivar. */
  app.patch('/api/admin/businesses/:id/subscription', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const { id } = req.params as { id: string }
    const parsed = subscriptionBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const before = await prisma.business.findUnique({ where: { id } })
    if (!before) return reply.code(404).send({ error: 'Negocio no encontrado' })

    const data: Prisma.BusinessUpdateInput = {}
    let resumen = ''
    let accion:
      'NEGOCIO_PLAN_CAMBIADO' | 'NEGOCIO_SUSPENDIDO' | 'NEGOCIO_REACTIVADO' | 'PRUEBA_AMPLIADA' =
      'NEGOCIO_PLAN_CAMBIADO'

    if (parsed.data.plan) {
      data.plan = parsed.data.plan
      // Cambiar a un plan de pago cierra la prueba: ya no tiene sentido.
      if (parsed.data.plan !== 'GRATIS' && before.subStatus === 'PRUEBA') {
        data.subStatus = 'ACTIVA'
        data.trialEndsAt = null
      }
      resumen = `Ha pasado ${before.name} al plan ${parsed.data.plan}`
    }

    if (parsed.data.trialDays !== undefined) {
      const base =
        before.trialEndsAt && before.trialEndsAt > new Date() ? before.trialEndsAt : new Date()
      data.trialEndsAt = new Date(base.getTime() + parsed.data.trialDays * 86_400_000)
      data.subStatus = 'PRUEBA'
      data.endedAt = null
      accion = 'PRUEBA_AMPLIADA'
      resumen = `Ha ampliado la prueba de ${before.name} en ${parsed.data.trialDays} días`
    }

    if (parsed.data.status) {
      data.subStatus = parsed.data.status
      const corta = parsed.data.status === 'SUSPENDIDA' || parsed.data.status === 'CANCELADA'
      data.endedAt = corta ? new Date() : null
      accion = corta ? 'NEGOCIO_SUSPENDIDO' : 'NEGOCIO_REACTIVADO'
      resumen = corta
        ? `Ha ${parsed.data.status === 'SUSPENDIDA' ? 'suspendido' : 'dado de baja'} a ${before.name}`
        : `Ha reactivado a ${before.name}`
    }

    if (parsed.data.adminNotes !== undefined) {
      data.adminNotes = parsed.data.adminNotes || null
      if (!resumen) resumen = `Ha anotado algo en la ficha de ${before.name}`
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: 'No has cambiado nada' })
    }

    const updated = await prisma.business.update({ where: { id }, data })

    audit(req, {
      action: accion,
      summary: resumen,
      actor: user,
      businessId: id,
      entity: 'Business',
      entityId: id,
      metadata: cambios(before, updated, ['plan', 'subStatus', 'trialEndsAt', 'adminNotes']),
    })

    return {
      plan: updated.plan,
      subStatus: updated.subStatus,
      trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
      adminNotes: updated.adminNotes,
    }
  })

  app.get('/api/admin/users', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const rows = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { business: { select: { slug: true, name: true } } },
    })
    // El passwordHash jamás sale de la API.
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      business: u.business,
      createdAt: u.createdAt.toISOString(),
    }))
  })

  app.post('/api/admin/users', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const d = parsed.data

    const business = await prisma.business.findUnique({ where: { id: d.businessId } })
    if (!business) return reply.code(404).send({ error: 'Negocio no encontrado' })

    const existing = await prisma.user.findUnique({ where: { email: d.email } })
    if (existing) return reply.code(409).send({ error: 'Ya existe un usuario con ese email' })

    const created = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash: await hashPassword(d.password),
        role: d.role,
        businessId: d.businessId,
      },
    })
    audit(req, {
      action: 'USUARIO_CREADO',
      summary: `Ha dado de alta a ${created.name} (${created.email}) como ${created.role} en «${business.name}»`,
      actor: user,
      businessId: business.id,
      entity: 'User',
      entityId: created.id,
      metadata: { rol: created.role, negocio: business.slug },
    })

    return reply
      .code(201)
      .send({ id: created.id, email: created.email, role: created.role, business: business.slug })
  })

  app.patch('/api/admin/users/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const { id } = req.params as { id: string }
    const parsed = z.object({ active: z.boolean() }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' })

    // Nadie se desactiva a sí mismo: evita quedarse fuera de la plataforma.
    if (id === user.id) return reply.code(400).send({ error: 'No puedes desactivarte a ti mismo' })

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return reply.code(404).send({ error: 'Usuario no encontrado' })

    await prisma.user.update({ where: { id }, data: { active: parsed.data.active } })
    // Al desactivar, sus sesiones abiertas mueren también.
    if (!parsed.data.active) await prisma.session.deleteMany({ where: { userId: id } })

    audit(req, {
      action: parsed.data.active ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO',
      summary: `Ha ${parsed.data.active ? 'reactivado' : 'desactivado'} a ${target.name} (${target.email})`,
      actor: user,
      businessId: target.businessId,
      entity: 'User',
      entityId: id,
    })

    return { ok: true }
  })

  /**
   * Dar por bueno un negocio que se dio de alta por su cuenta.
   *
   * Hace DOS cosas, y la segunda no es un descuido: publica la ficha y da por
   * confirmado el correo de su dueño. Aprobar significa que alguien ha mirado
   * quién es y le ha dado el visto bueno, así que exigirle además que pinche
   * un enlace no añade seguridad — y sí lo dejaría fuera del panel si el
   * correo nunca le llegó.
   */
  app.patch('/api/admin/businesses/:id/approve', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const { id } = req.params as { id: string }
    const before = await prisma.business.findUnique({
      where: { id },
      select: { name: true, approvedAt: true },
    })
    if (!before) return reply.code(404).send({ error: 'Negocio no encontrado' })
    if (before.approvedAt) return reply.code(409).send({ error: 'Ya estaba aprobado' })

    const ahora = new Date()
    await prisma.$transaction([
      prisma.business.update({ where: { id }, data: { approvedAt: ahora } }),
      prisma.user.updateMany({
        where: { businessId: id, emailVerifiedAt: null },
        data: { emailVerifiedAt: ahora },
      }),
    ])

    audit(req, {
      action: 'NEGOCIO_REACTIVADO',
      summary: `Ha aprobado y publicado «${before.name}»`,
      actor: user,
      businessId: id,
      entity: 'Business',
      entityId: id,
    })

    return { ok: true }
  })
}
