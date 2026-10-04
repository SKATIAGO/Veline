import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { fromDateKey, parseExtrasParam } from '@veline/shared'
import { prisma } from '../prisma.js'
import { requireUser } from '../auth/sessions.js'
import { authorizeBusiness as authorize } from '../auth/business-scope.js'
import { MAX_RANGE_DAYS, getAvailability, getAvailabilityForReschedule } from '../availability.js'
import { duracionConExtras } from '../extras.js'

/**
 * Lo que necesita el mostrador para apuntar y mover citas con huecos de
 * verdad, y la ficha de cada cliente.
 *
 * Todo con permiso de agenda: quien atiende el teléfono suele ser un
 * empleado, y hasta ahora el formulario de apuntar cita pedía la lista de
 * servicios a una ruta de configuración que a él le respondía 403.
 */

const disponibilidadQuery = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Para apuntar: el servicio y sus extras. */
    serviceId: z.string().min(1).optional(),
    extras: z.string().max(2000).optional(),
    /** Para mover: la cita, que pone su duración y deja libre su hueco. */
    bookingId: z.string().min(1).optional(),
    staffId: z.string().min(1).optional(),
    locationId: z.string().min(1).optional(),
  })
  .refine((q) => !!q.serviceId !== !!q.bookingId, {
    message: 'Pide los huecos de un servicio o de una cita, no de los dos',
  })

export async function agendaRoutes(app: FastifyInstance) {
  /** Servicios, extras, personas y locales con los que se apunta una cita. */
  app.get('/api/panel/:slug/agenda/carta', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const [servicios, extras, personas, locales] = await Promise.all([
      prisma.service.findMany({
        where: { businessId: auth.business.id, active: true },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, durationMin: true, priceCents: true },
      }),
      prisma.extra.findMany({
        where: { businessId: auth.business.id, active: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, durationMin: true, priceCents: true },
      }),
      prisma.staff.findMany({
        where: { businessId: auth.business.id, active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, locationId: true },
      }),
      // Solo los aprobados: los demás no dan huecos (ver resolverLocal).
      prisma.location.findMany({
        where: { businessId: auth.business.id, approved: true },
        orderBy: { id: 'asc' },
        select: { id: true, name: true },
      }),
    ])

    return { servicios, extras, personas, locales }
  })

  /** Los huecos libres, como en la reserva pública pero desde ahora mismo. */
  app.get('/api/panel/:slug/disponibilidad', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = disponibilidadQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: parsed.error.issues[0]?.message ?? 'Parámetros inválidos' })
    }
    const q = parsed.data

    const from = fromDateKey(q.from)
    const to = fromDateKey(q.to)
    if (to < from) return reply.code(400).send({ error: '"to" es anterior a "from"' })
    const dias = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
    if (dias > MAX_RANGE_DAYS) {
      return reply.code(400).send({ error: `El rango máximo es de ${MAX_RANGE_DAYS} días` })
    }

    try {
      if (q.bookingId) {
        const cita = await prisma.booking.findFirst({
          where: { id: q.bookingId, businessId: auth.business.id },
          include: { service: true, extras: true },
        })
        if (!cita) return reply.code(404).send({ error: 'Cita no encontrada' })
        return await getAvailabilityForReschedule({
          businessId: auth.business.id,
          locationId: cita.locationId ?? undefined,
          occupancyMin:
            duracionConExtras(cita.service.durationMin, cita.extras) + cita.service.bufferMin,
          from,
          to,
          excludeBookingId: cita.id,
          staffId: q.staffId,
          sinAntelacion: true,
        })
      }

      return await getAvailability({
        businessId: auth.business.id,
        serviceId: q.serviceId!,
        from,
        to,
        locationId: q.locationId,
        extras: parseExtrasParam(q.extras),
        staffId: q.staffId,
        sinAntelacion: true,
      })
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode ?? 500
      return reply.code(status).send({ error: (err as Error).message })
    }
  })

  /** El historial de un cliente en ESTE negocio, para su ficha. */
  app.get('/api/panel/:slug/customers/:id/bookings', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const citas = await prisma.booking.findMany({
      where: { businessId: auth.business.id, customerId: id },
      orderBy: { startsAt: 'desc' },
      take: 100,
      include: {
        service: { select: { name: true } },
        staff: { select: { name: true } },
        extras: { select: { name: true, quantity: true }, orderBy: { id: 'asc' } },
      },
    })

    return citas.map((c) => ({
      id: c.id,
      code: c.code,
      status: c.status,
      startsAt: c.startsAt.toISOString(),
      priceCents: c.priceCents,
      servicio: c.service.name,
      persona: c.staff?.name ?? null,
      extras: c.extras,
    }))
  })
}
