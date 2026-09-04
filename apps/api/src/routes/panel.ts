import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { hashPassword } from '../auth/passwords.js'
import { requireUser } from '../auth/sessions.js'
import { authorizeBusiness as authorize, cambios } from '../auth/business-scope.js'
import { audit } from '../audit/log.js'

/**
 * Panel del negocio. Todos los endpoints exigen sesión, y el alcance depende
 * del rol:
 *
 *   - agenda y resumen        → cualquier usuario del negocio (o superadmin)
 *   - servicios, horario y
 *     usuarios del negocio    → solo ADMIN del negocio (o superadmin)
 *
 * El negocio sigue viajando por slug en la URL: al superadmin le permite
 * moverse entre negocios, y a los demás se les comprueba que sea el suyo.
 */

const serviceBody = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  durationMin: z.number().int().min(5).max(480),
  bufferMin: z.number().int().min(0).max(120).default(0),
  priceCents: z.number().int().min(0).max(1_000_000),
  active: z.boolean().default(true),
})

const hoursBody = z.object({
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

const panelUserBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
  role: z.enum(['ADMIN', 'EMPLEADO']),
})

const rangeQuery = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

const startOfDay = (key?: string) => {
  const d = key ? new Date(`${key}T00:00:00`) : new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function panelRoutes(app: FastifyInstance) {
  /** Selector de negocio: el superadmin ve todos; los demás, solo el suyo. */
  app.get('/api/panel/businesses', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return

    const where = user.role === 'SUPERADMIN' ? {} : { id: user.businessId ?? '__ninguno__' }
    return prisma.business.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, plan: true, category: true },
    })
  })

  app.get('/api/panel/:slug/summary', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const today = startOfDay()
    const tomorrow = new Date(today.getTime() + 86_400_000)
    const in7 = new Date(today.getTime() + 7 * 86_400_000)

    const [todayCount, weekBookings, staffCount, serviceCount] = await Promise.all([
      prisma.booking.count({
        where: {
          businessId: auth.business.id,
          status: 'CONFIRMADA',
          startsAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.booking.findMany({
        where: {
          businessId: auth.business.id,
          status: 'CONFIRMADA',
          startsAt: { gte: today, lt: in7 },
        },
        select: { priceCents: true, commissionCents: true, isFirstFromMarketplace: true },
      }),
      prisma.staff.count({ where: { businessId: auth.business.id, active: true } }),
      prisma.service.count({ where: { businessId: auth.business.id, active: true } }),
    ])

    return {
      business: {
        id: auth.business.id,
        slug: auth.business.slug,
        name: auth.business.name,
        plan: auth.business.plan,
      },
      todayCount,
      weekCount: weekBookings.length,
      weekRevenueCents: weekBookings.reduce((acc, b) => acc + b.priceCents, 0),
      weekCommissionCents: weekBookings.reduce((acc, b) => acc + b.commissionCents, 0),
      newFromMarketplace: weekBookings.filter((b) => b.isFirstFromMarketplace).length,
      staffCount,
      serviceCount,
    }
  })

  app.get('/api/panel/:slug/bookings', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const { from, to } = rangeQuery.parse(req.query)
    const start = startOfDay(from)
    const end = to
      ? new Date(startOfDay(to).getTime() + 86_400_000)
      : new Date(start.getTime() + 14 * 86_400_000)

    const rows = await prisma.booking.findMany({
      where: { businessId: auth.business.id, startsAt: { gte: start, lt: end } },
      include: {
        service: { select: { id: true, name: true, durationMin: true } },
        staff: { select: { id: true, name: true } },
        customer: { select: { name: true, phone: true, email: true } },
      },
      orderBy: { startsAt: 'asc' },
    })

    return rows.map((b) => ({
      id: b.id,
      code: b.code,
      status: b.status,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      priceCents: b.priceCents,
      commissionCents: b.commissionCents,
      isFirstFromMarketplace: b.isFirstFromMarketplace,
      source: b.source,
      notes: b.notes,
      service: b.service,
      staff: b.staff,
      customer: b.customer,
    }))
  })

  app.get('/api/panel/:slug/services', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    return prisma.service.findMany({
      where: { businessId: auth.business.id },
      orderBy: { position: 'asc' },
    })
  })

  app.post('/api/panel/:slug/services', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = serviceBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const count = await prisma.service.count({ where: { businessId: auth.business.id } })
    const creado = await prisma.service.create({
      data: {
        businessId: auth.business.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        durationMin: parsed.data.durationMin,
        bufferMin: parsed.data.bufferMin,
        priceCents: parsed.data.priceCents,
        active: parsed.data.active,
        position: count,
      },
    })

    audit(req, {
      action: 'SERVICIO_CREADO',
      summary: `Ha creado el servicio «${creado.name}»`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Service',
      entityId: creado.id,
      metadata: { duracionMin: creado.durationMin, precioCents: creado.priceCents },
    })

    return reply.code(201).send(creado)
  })

  app.patch('/api/panel/:slug/services/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = serviceBody.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const existing = await prisma.service.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Servicio no encontrado' })

    const { description, ...rest } = parsed.data
    const actualizado = await prisma.service.update({
      where: { id },
      data: {
        ...rest,
        ...(description !== undefined ? { description: description || null } : {}),
      },
    })

    audit(req, {
      action: 'SERVICIO_EDITADO',
      summary: `Ha editado el servicio «${actualizado.name}»`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Service',
      entityId: id,
      metadata: cambios(existing, actualizado, [
        'name',
        'description',
        'durationMin',
        'bufferMin',
        'priceCents',
        'active',
      ]),
    })

    return actualizado
  })

  /** Baja lógica: si el servicio ya tiene citas no se puede borrar de verdad. */
  app.delete('/api/panel/:slug/services/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const existing = await prisma.service.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Servicio no encontrado' })
    await prisma.service.update({ where: { id }, data: { active: false } })

    audit(req, {
      action: 'SERVICIO_ELIMINADO',
      summary: `Ha dado de baja el servicio «${existing.name}»`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Service',
      entityId: id,
    })

    return reply.code(204).send()
  })

  app.get('/api/panel/:slug/hours', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    if (!auth.business.locationId) return []
    return prisma.openingHour.findMany({
      where: { locationId: auth.business.locationId },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    })
  })

  app.put('/api/panel/:slug/hours', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = hoursBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Horario inválido', details: parsed.error.flatten() })
    }
    if (!auth.business.locationId) {
      return reply.code(404).send({ error: 'El negocio no tiene local' })
    }
    const locationId = auth.business.locationId

    const anterior = await prisma.openingHour.findMany({
      where: { locationId },
      select: { weekday: true, startMin: true, endMin: true },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    })

    await prisma.$transaction([
      prisma.openingHour.deleteMany({ where: { locationId } }),
      prisma.openingHour.createMany({
        data: parsed.data.hours.map((r) => ({ ...r, locationId })),
      }),
    ])

    audit(req, {
      action: 'HORARIO_EDITADO',
      summary: 'Ha cambiado el horario de apertura',
      actor: user,
      businessId: auth.business.id,
      entity: 'Location',
      entityId: locationId,
      metadata: { antes: anterior, despues: parsed.data.hours },
    })

    return prisma.openingHour.findMany({
      where: { locationId },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    })
  })

  /* ── Usuarios del negocio: el ADMIN gestiona su propio equipo ── */

  app.get('/api/panel/:slug/users', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const rows = await prisma.user.findMany({
      where: { businessId: auth.business.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    })
    return rows
  })

  app.post('/api/panel/:slug/users', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = panelUserBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (existing) return reply.code(409).send({ error: 'Ya existe un usuario con ese email' })

    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role,
        businessId: auth.business.id,
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    })

    audit(req, {
      action: 'USUARIO_CREADO',
      summary: `Ha dado de alta a ${created.name} (${created.email}) como ${created.role}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'User',
      entityId: created.id,
      metadata: { rol: created.role },
    })

    return reply.code(201).send(created)
  })

  app.patch('/api/panel/:slug/users/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = z.object({ active: z.boolean() }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' })
    if (id === user.id) return reply.code(400).send({ error: 'No puedes desactivarte a ti mismo' })

    // Solo usuarios DEL negocio: un admin no toca usuarios de otros negocios
    // ni superadmins (que no pertenecen a ninguno).
    const target = await prisma.user.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!target) return reply.code(404).send({ error: 'Usuario no encontrado' })

    await prisma.user.update({ where: { id }, data: { active: parsed.data.active } })
    if (!parsed.data.active) await prisma.session.deleteMany({ where: { userId: id } })

    audit(req, {
      action: parsed.data.active ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO',
      summary: `Ha ${parsed.data.active ? 'reactivado' : 'desactivado'} a ${target.name} (${target.email})`,
      actor: user,
      businessId: auth.business.id,
      entity: 'User',
      entityId: id,
    })

    return { ok: true }
  })
}
