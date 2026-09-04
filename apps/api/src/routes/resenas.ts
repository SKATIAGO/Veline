import { createHash, randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireUser } from '../auth/sessions.js'
import { authorizeBusiness as authorize } from '../auth/business-scope.js'
import { audit } from '../audit/log.js'
import { sendMail } from '../mail/brevo.js'
import { registrarEnvio } from '../mail/contador.js'
import { reviewRequestMail } from '../mail/templates.js'

/**
 * Reseñas de verdad.
 *
 * La estrella del marketplace era un número escrito a mano en los datos de
 * ejemplo: 4,8 con 126 reseñas que no existían. Ahora sale de aquí.
 *
 * Solo reseña quien tuvo la cita: al marcarla como atendida se genera un
 * testigo y se le manda por correo. Del testigo se guarda el hash, igual que
 * con las sesiones — quien leyera la tabla no podría dejar reseñas en nombre
 * de nadie. Y se consume al usarlo: una cita, una reseña.
 */

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

const enviarBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(600).optional(),
})

const webUrl = () => (process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '')

/**
 * Recalcula la nota del negocio a partir de sus reseñas contestadas.
 * Se guarda en el negocio (en vez de calcularlo al vuelo) porque el listado
 * del marketplace ordena por nota: hacerlo en cada búsqueda sería una
 * agregación por cada fila.
 */
export async function recalcularNota(businessId: string) {
  const r = await prisma.review.aggregate({
    where: { businessId, answeredAt: { not: null } },
    _avg: { rating: true },
    _count: true,
  })
  await prisma.business.update({
    where: { id: businessId },
    data: {
      rating: r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : 0,
      reviewCount: r._count,
    },
  })
}

/**
 * Pide la reseña de una cita atendida. Devuelve el enlace por si hace falta
 * darlo a mano; el correo sale solo si el cliente dejó dirección.
 */
export async function pedirResena(bookingId: string) {
  const cita = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, business: true, service: true, review: true },
  })
  if (!cita || cita.status !== 'COMPLETADA' || cita.review) return null

  const token = randomBytes(24).toString('base64url')

  await prisma.review.create({
    data: {
      businessId: cita.businessId,
      bookingId: cita.id,
      customerId: cita.customerId,
      rating: 0,
      tokenHash: hashToken(token),
    },
  })

  const url = `${webUrl()}/resena/${token}`

  if (cita.customer.email) {
    const r = await sendMail(
      reviewRequestMail(
        { email: cita.customer.email, name: cita.customer.name },
        { businessName: cita.business.name, serviceName: cita.service.name, url },
      ),
    ).catch((err) => ({ sent: false as const, reason: (err as Error).message }))

    await registrarEnvio({
      businessId: cita.businessId,
      bookingId: cita.id,
      channel: 'EMAIL',
      kind: 'RESENA_PEDIDA',
      to: cita.customer.email,
      status: r.sent ? 'ENVIADO' : 'OMITIDO',
      reason: r.sent ? null : 'reason' in r ? r.reason : null,
    })
  }

  return url
}

export async function resenaRoutes(app: FastifyInstance) {
  /* ── Lo que ve el cliente al abrir el enlace ────────────── */

  app.get('/api/reviews/:token', async (req, reply) => {
    const { token } = req.params as { token: string }

    const review = await prisma.review.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        business: { select: { name: true, slug: true } },
        booking: { select: { startsAt: true } },
        customer: { select: { name: true } },
      },
    })
    if (!review) return reply.code(404).send({ error: 'Este enlace no es válido' })

    return {
      businessName: review.business.name,
      businessSlug: review.business.slug,
      customerName: review.customer.name,
      startsAt: review.booking.startsAt.toISOString(),
      answered: review.answeredAt !== null,
    }
  })

  app.post(
    '/api/reviews/:token',
    // Una reseña por enlace, pero se limita igual: el enlace es público.
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { token } = req.params as { token: string }
      const parsed = enviarBody.safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: 'Puntúa del 1 al 5' })

      const review = await prisma.review.findUnique({
        where: { tokenHash: hashToken(token) },
      })
      if (!review) return reply.code(404).send({ error: 'Este enlace no es válido' })
      if (review.answeredAt) {
        return reply.code(409).send({ error: 'Esta reseña ya estaba escrita. Gracias.' })
      }

      await prisma.review.update({
        where: { id: review.id },
        data: {
          rating: parsed.data.rating,
          comment: parsed.data.comment || null,
          answeredAt: new Date(),
        },
      })

      await recalcularNota(review.businessId)

      return { ok: true }
    },
  )

  /* ── Lo que ve el negocio ───────────────────────────────── */

  app.get('/api/panel/:slug/reviews', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const rows = await prisma.review.findMany({
      where: { businessId: auth.business.id, answeredAt: { not: null } },
      orderBy: { answeredAt: 'desc' },
      take: 100,
      include: {
        customer: { select: { name: true } },
        booking: { select: { startsAt: true, service: { select: { name: true } } } },
      },
    })

    const pendientes = await prisma.review.count({
      where: { businessId: auth.business.id, answeredAt: null },
    })

    return {
      pending: pendientes,
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        customerName: r.customer.name,
        serviceName: r.booking.service.name,
        answeredAt: r.answeredAt!.toISOString(),
      })),
    }
  })

  /** Pedir la reseña a mano, por si el cliente no dejó correo o se perdió. */
  app.post('/api/panel/:slug/bookings/:id/review-request', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const cita = await prisma.booking.findFirst({
      where: { id, businessId: auth.business.id },
      include: { review: true },
    })
    if (!cita) return reply.code(404).send({ error: 'Cita no encontrada' })
    if (cita.status !== 'COMPLETADA') {
      return reply.code(409).send({ error: 'Solo se puede pedir reseña de una cita atendida' })
    }
    if (cita.review) return reply.code(409).send({ error: 'Ya se le pidió la reseña' })

    const url = await pedirResena(id)

    audit(req, {
      action: 'RESENA_PUBLICADA',
      summary: `Ha pedido la reseña de la cita ${cita.code}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Booking',
      entityId: id,
    })

    return { url }
  })
}
