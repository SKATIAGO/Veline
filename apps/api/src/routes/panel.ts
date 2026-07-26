import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'

/**
 * Panel del negocio — versión básica y SIN autenticación todavía.
 * El negocio se selecciona por slug desde un desplegable en el front.
 * Cuando entre el login con Apple/Google, este router pasa a exigir sesión y
 * a derivar el negocio del usuario en lugar de leerlo de la URL.
 */

const serviceBody = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  durationMin: z.number().int().min(5).max(480),
  bufferMin: z.number().int().min(0).max(120).default(0),
  priceCents: z.number().int().min(0).max(10_000_00),
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
    .refine((rows) => rows.every((r) => r.endMin > r.startMin), 'Cada franja debe terminar después de empezar'),
})

const rangeQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

async function requireBusiness(slug: string) {
  const business = await prisma.business.findUnique({
    where: { slug },
    include: { locations: { take: 1 } },
  })
  if (!business) throw Object.assign(new Error('Negocio no encontrado'), { statusCode: 404 })
  return business
}

const startOfDay = (key?: string) => {
  const d = key ? new Date(`${key}T00:00:00`) : new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function panelRoutes(app: FastifyInstance) {
  app.get('/api/panel/businesses', async () => {
    const rows = await prisma.business.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, plan: true, category: true },
    })
    return rows
  })

  app.get('/api/panel/:slug/summary', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    try {
      const business = await requireBusiness(slug)
      const today = startOfDay()
      const tomorrow = new Date(today.getTime() + 86_400_000)
      const in7 = new Date(today.getTime() + 7 * 86_400_000)

      const [todayCount, weekBookings, staffCount, serviceCount] = await Promise.all([
        prisma.booking.count({
          where: {
            businessId: business.id,
            status: 'CONFIRMADA',
            startsAt: { gte: today, lt: tomorrow },
          },
        }),
        prisma.booking.findMany({
          where: {
            businessId: business.id,
            status: 'CONFIRMADA',
            startsAt: { gte: today, lt: in7 },
          },
          select: { priceCents: true, commissionCents: true, isFirstFromMarketplace: true },
        }),
        prisma.staff.count({ where: { businessId: business.id, active: true } }),
        prisma.service.count({ where: { businessId: business.id, active: true } }),
      ])

      return {
        business: { id: business.id, slug: business.slug, name: business.name, plan: business.plan },
        todayCount,
        weekCount: weekBookings.length,
        weekRevenueCents: weekBookings.reduce((acc, b) => acc + b.priceCents, 0),
        weekCommissionCents: weekBookings.reduce((acc, b) => acc + b.commissionCents, 0),
        newFromMarketplace: weekBookings.filter((b) => b.isFirstFromMarketplace).length,
        staffCount,
        serviceCount,
      }
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({
        error: (err as Error).message,
      })
    }
  })

  app.get('/api/panel/:slug/bookings', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const { from, to } = rangeQuery.parse(req.query)
    try {
      const business = await requireBusiness(slug)
      const start = startOfDay(from)
      const end = to ? new Date(startOfDay(to).getTime() + 86_400_000) : new Date(start.getTime() + 14 * 86_400_000)

      const rows = await prisma.booking.findMany({
        where: { businessId: business.id, startsAt: { gte: start, lt: end } },
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
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({
        error: (err as Error).message,
      })
    }
  })

  app.get('/api/panel/:slug/services', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    try {
      const business = await requireBusiness(slug)
      return prisma.service.findMany({
        where: { businessId: business.id },
        orderBy: { position: 'asc' },
      })
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({
        error: (err as Error).message,
      })
    }
  })

  app.post('/api/panel/:slug/services', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const parsed = serviceBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    try {
      const business = await requireBusiness(slug)
      const count = await prisma.service.count({ where: { businessId: business.id } })
      return reply.code(201).send(
        await prisma.service.create({
          data: {
            businessId: business.id,
            name: parsed.data.name,
            description: parsed.data.description || null,
            durationMin: parsed.data.durationMin,
            bufferMin: parsed.data.bufferMin,
            priceCents: parsed.data.priceCents,
            active: parsed.data.active,
            position: count,
          },
        }),
      )
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({
        error: (err as Error).message,
      })
    }
  })

  app.patch('/api/panel/:slug/services/:id', async (req, reply) => {
    const { slug, id } = req.params as { slug: string; id: string }
    const parsed = serviceBody.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    try {
      const business = await requireBusiness(slug)
      const existing = await prisma.service.findFirst({ where: { id, businessId: business.id } })
      if (!existing) return reply.code(404).send({ error: 'Servicio no encontrado' })

      const { description, ...rest } = parsed.data
      return prisma.service.update({
        where: { id },
        data: {
          ...rest,
          ...(description !== undefined ? { description: description || null } : {}),
        },
      })
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({
        error: (err as Error).message,
      })
    }
  })

  /** Baja lógica: si el servicio ya tiene citas no se puede borrar de verdad. */
  app.delete('/api/panel/:slug/services/:id', async (req, reply) => {
    const { slug, id } = req.params as { slug: string; id: string }
    try {
      const business = await requireBusiness(slug)
      const existing = await prisma.service.findFirst({ where: { id, businessId: business.id } })
      if (!existing) return reply.code(404).send({ error: 'Servicio no encontrado' })
      await prisma.service.update({ where: { id }, data: { active: false } })
      return reply.code(204).send()
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({
        error: (err as Error).message,
      })
    }
  })

  app.get('/api/panel/:slug/hours', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    try {
      const business = await requireBusiness(slug)
      const location = business.locations[0]
      if (!location) return []
      return prisma.openingHour.findMany({
        where: { locationId: location.id },
        orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
      })
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({
        error: (err as Error).message,
      })
    }
  })

  app.put('/api/panel/:slug/hours', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const parsed = hoursBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Horario inválido', details: parsed.error.flatten() })
    }
    try {
      const business = await requireBusiness(slug)
      const location = business.locations[0]
      if (!location) return reply.code(404).send({ error: 'El negocio no tiene local' })

      await prisma.$transaction([
        prisma.openingHour.deleteMany({ where: { locationId: location.id } }),
        prisma.openingHour.createMany({
          data: parsed.data.hours.map((r) => ({ ...r, locationId: location.id })),
        }),
      ])

      return prisma.openingHour.findMany({
        where: { locationId: location.id },
        orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
      })
    } catch (err) {
      return reply.code((err as { statusCode?: number }).statusCode ?? 500).send({
        error: (err as Error).message,
      })
    }
  })
}
