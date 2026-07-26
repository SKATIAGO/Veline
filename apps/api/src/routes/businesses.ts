import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  CATEGORIES,
  fromDateKey,
  type BusinessDTO,
  type BusinessSummaryDTO,
} from '@veline/shared'
import { prisma } from '../prisma.js'
import { getAvailability, MAX_RANGE_DAYS } from '../availability.js'

const listQuery = z.object({
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  city: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
})

const availabilityQuery = z.object({
  serviceId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function businessRoutes(app: FastifyInstance) {
  app.get('/api/categories', async () => CATEGORIES)

  app.get('/api/businesses', async (req) => {
    const { q, category, city, limit } = listQuery.parse(req.query)

    const rows = await prisma.business.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(city ? { locations: { some: { city: { equals: city, mode: 'insensitive' } } } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
                { services: { some: { name: { contains: q, mode: 'insensitive' as const } } } },
              ],
            }
          : {}),
      },
      include: {
        locations: { take: 1 },
        services: { where: { active: true }, orderBy: { priceCents: 'asc' }, take: 1 },
      },
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
      take: limit,
    })

    return rows.map<BusinessSummaryDTO>((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      category: b.category,
      rating: b.rating,
      reviewCount: b.reviewCount,
      city: b.locations[0]?.city ?? '',
      street: b.locations[0]?.street ?? '',
      photo: null,
      fromPriceCents: b.services[0]?.priceCents ?? null,
    }))
  })

  app.get('/api/businesses/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const b = await prisma.business.findUnique({
      where: { slug },
      include: {
        locations: { include: { openingHours: { orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] } } },
        services: { where: { active: true }, orderBy: { position: 'asc' } },
        staff: { where: { active: true }, orderBy: { name: 'asc' } },
      },
    })
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado' })

    const main = b.locations[0]
    const dto: BusinessDTO = {
      id: b.id,
      slug: b.slug,
      name: b.name,
      category: b.category,
      description: b.description,
      phone: b.phone,
      rating: b.rating,
      reviewCount: b.reviewCount,
      city: main?.city ?? '',
      street: main?.street ?? '',
      photo: null,
      photos: [],
      fromPriceCents: b.services.length
        ? Math.min(...b.services.map((s) => s.priceCents))
        : null,
      locations: b.locations.map((l) => ({
        id: l.id,
        name: l.name,
        street: l.street,
        city: l.city,
        postalCode: l.postalCode,
        lat: l.lat,
        lng: l.lng,
      })),
      services: b.services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMin: s.durationMin,
        priceCents: s.priceCents,
      })),
      staff: b.staff.map((s) => ({ id: s.id, name: s.name })),
      openingHours: (main?.openingHours ?? []).map((w) => ({
        weekday: w.weekday,
        startMin: w.startMin,
        endMin: w.endMin,
      })),
    }
    return dto
  })

  app.get('/api/businesses/:slug/availability', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const parsed = availabilityQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', details: parsed.error.flatten() })
    }

    const business = await prisma.business.findUnique({ where: { slug }, select: { id: true } })
    if (!business) return reply.code(404).send({ error: 'Negocio no encontrado' })

    const from = fromDateKey(parsed.data.from)
    const to = fromDateKey(parsed.data.to)
    if (to < from) return reply.code(400).send({ error: '"to" es anterior a "from"' })

    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
    if (days > MAX_RANGE_DAYS) {
      return reply.code(400).send({ error: `El rango máximo es de ${MAX_RANGE_DAYS} días` })
    }

    try {
      return await getAvailability({
        businessId: business.id,
        serviceId: parsed.data.serviceId,
        from,
        to,
      })
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500
      return reply.code(status).send({ error: (err as Error).message })
    }
  })
}
