import { randomInt } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { cancelBookingSchema, createBookingSchema, type BookingDTO } from '@veline/shared'
import { prisma } from '../prisma.js'
import { isWithinOpeningHours, pickStaffForSlot } from '../availability.js'
import { sendMailSafely } from '../mail/brevo.js'
import {
  bookingCancelled,
  bookingConfirmedToCustomer,
  bookingCreatedToBusiness,
  type BookingMailData,
} from '../mail/templates.js'

/** Comisión de marketplace: 15% y solo en la primera reserva del cliente. */
const COMMISSION_RATE = 0.15

/**
 * Código de reserva. Es lo único que protege los datos del cliente en
 * /reserva/{código}, así que se genera con el generador criptográfico del
 * sistema, no con Math.random() (predecible con suficientes muestras).
 *
 * Alfabeto sin caracteres que se confundan al dictarlo por teléfono: sin
 * I, O, 0, 1. Con 8 caracteres son 32^8 ≈ 1,1 billones de combinaciones;
 * junto al límite de peticiones, recorrerlos deja de ser viable.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

const bookingCode = () =>
  'VL-' + Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

const bookingInclude = {
  business: { select: { id: true, slug: true, name: true, email: true } },
  location: { select: { name: true, street: true, city: true } },
  service: { select: { id: true, name: true, durationMin: true } },
  staff: { select: { id: true, name: true } },
  customer: { select: { name: true, phone: true, email: true } },
} satisfies Prisma.BookingInclude

type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>

/** Datos que necesitan las plantillas de correo. */
const toMailData = (b: BookingRow): BookingMailData => ({
  code: b.code,
  startsAt: b.startsAt,
  priceCents: b.priceCents,
  serviceName: b.service.name,
  businessName: b.business.name,
  businessSlug: b.business.slug,
  staffName: b.staff?.name ?? null,
  address: b.location ? `${b.location.street}, ${b.location.city}` : null,
  customerName: b.customer.name,
  customerPhone: b.customer.phone,
  customerEmail: b.customer.email,
  notes: b.notes,
})

const toDTO = (b: BookingRow): BookingDTO => ({
  id: b.id,
  code: b.code,
  status: b.status,
  startsAt: b.startsAt.toISOString(),
  endsAt: b.endsAt.toISOString(),
  priceCents: b.priceCents,
  notes: b.notes,
  source: b.source,
  business: { id: b.business.id, slug: b.business.slug, name: b.business.name },
  location: b.location,
  service: b.service,
  staff: b.staff,
  customer: b.customer,
})

export async function bookingRoutes(app: FastifyInstance) {
  app.post('/api/businesses/:slug/bookings', async (req, reply) => {
    const { slug } = req.params as { slug: string }
    const parsed = createBookingSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const input = parsed.data

    const business = await prisma.business.findUnique({
      where: { slug },
      include: { locations: { take: 1 } },
    })
    if (!business) return reply.code(404).send({ error: 'Negocio no encontrado' })

    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, businessId: business.id, active: true },
    })
    if (!service) return reply.code(404).send({ error: 'Servicio no encontrado' })

    const start = new Date(input.startsAt)
    if (Number.isNaN(start.getTime())) {
      return reply.code(400).send({ error: 'Fecha de inicio inválida' })
    }
    if (start.getTime() < Date.now()) {
      return reply.code(409).send({ error: 'Esa hora ya ha pasado' })
    }

    const end = new Date(start.getTime() + service.durationMin * 60_000)
    const blockedTo = new Date(end.getTime() + service.bufferMin * 60_000)
    const occupancy = service.durationMin + service.bufferMin

    if (!(await isWithinOpeningHours(business.id, start, occupancy))) {
      return reply.code(409).send({ error: 'Ese horario está fuera del horario de atención' })
    }

    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          const staff = await pickStaffForSlot(tx, {
            businessId: business.id,
            start,
            end: blockedTo,
            preferredStaffId: input.staffId,
          })
          if (!staff) {
            throw Object.assign(new Error('Ese hueco acaba de ocuparse'), { statusCode: 409 })
          }

          const customer = await tx.customer.upsert({
            where: { phone: input.customer.phone },
            update: {
              name: input.customer.name,
              ...(input.customer.email ? { email: input.customer.email } : {}),
            },
            create: {
              name: input.customer.name,
              phone: input.customer.phone,
              email: input.customer.email || null,
            },
          })

          // Atribución: la comisión solo se cobra la primera vez que este
          // cliente reserva en este negocio a través del marketplace.
          const previous = await tx.booking.count({
            where: {
              businessId: business.id,
              customerId: customer.id,
              status: { in: ['CONFIRMADA', 'COMPLETADA'] },
            },
          })
          const isFirstFromMarketplace = input.source === 'MARKETPLACE' && previous === 0
          const commissionCents = isFirstFromMarketplace
            ? Math.round(service.priceCents * COMMISSION_RATE)
            : 0

          return tx.booking.create({
            data: {
              code: bookingCode(),
              businessId: business.id,
              locationId: business.locations[0]?.id ?? null,
              serviceId: service.id,
              staffId: staff.id,
              customerId: customer.id,
              startsAt: start,
              endsAt: end,
              blockedTo,
              priceCents: service.priceCents,
              notes: input.notes || null,
              source: input.source,
              isFirstFromMarketplace,
              commissionCents,
            },
            include: bookingInclude,
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      // El correo no bloquea la respuesta: la cita ya está hecha y confirmada.
      const mailData = toMailData(booking)
      if (booking.customer.email) {
        void sendMailSafely(bookingConfirmedToCustomer(mailData))
      }
      if (booking.business.email) {
        void sendMailSafely(bookingCreatedToBusiness(mailData, booking.business.email))
      }

      return reply.code(201).send(toDTO(booking))
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // P2034: Postgres abortó la transacción por conflicto de serialización,
        // es decir dos personas pidieron el mismo hueco a la vez.
        if (err.code === 'P2034') {
          return reply.code(409).send({ error: 'Ese hueco acaba de ocuparse' })
        }
        // P2002: colisión del código de reserva. Poco probable, se reintenta.
        if (err.code === 'P2002') {
          return reply
            .code(409)
            .send({ error: 'No se ha podido crear la reserva, inténtalo de nuevo' })
        }
      }
      const status = (err as { statusCode?: number }).statusCode
      if (status) return reply.code(status).send({ error: (err as Error).message })
      throw err
    }
  })

  app.get('/api/bookings/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const booking = await prisma.booking.findUnique({
      where: { code: code.toUpperCase() },
      include: bookingInclude,
    })
    if (!booking) return reply.code(404).send({ error: 'Reserva no encontrada' })
    return toDTO(booking)
  })

  app.post('/api/bookings/:code/cancel', async (req, reply) => {
    const { code } = req.params as { code: string }
    const parsed = cancelBookingSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' })

    const existing = await prisma.booking.findUnique({ where: { code: code.toUpperCase() } })
    if (!existing) return reply.code(404).send({ error: 'Reserva no encontrada' })
    if (existing.status === 'CANCELADA') {
      return reply.code(409).send({ error: 'Esta reserva ya estaba cancelada' })
    }

    const booking = await prisma.booking.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELADA',
        cancelledAt: new Date(),
        commissionCents: 0,
        notes: parsed.data.reason
          ? [existing.notes, `Cancelada: ${parsed.data.reason}`].filter(Boolean).join('\n')
          : existing.notes,
      },
      include: bookingInclude,
    })

    const mailData = toMailData(booking)
    if (booking.customer.email) {
      void sendMailSafely(
        bookingCancelled(
          mailData,
          { email: booking.customer.email, name: booking.customer.name },
          'cliente',
        ),
      )
    }
    if (booking.business.email) {
      void sendMailSafely(
        bookingCancelled(
          mailData,
          { email: booking.business.email, name: booking.business.name },
          'negocio',
        ),
      )
    }

    return toDTO(booking)
  })
}
