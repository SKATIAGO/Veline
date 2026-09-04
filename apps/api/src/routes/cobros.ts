import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireUser } from '../auth/sessions.js'
import { canManagePlatform } from '../auth/permissions.js'
import { authorizeBusiness as authorize } from '../auth/business-scope.js'
import { audit } from '../audit/log.js'
import { calcularMes, cerrarMesDeTodos, periodoAnterior, periodoDe } from '../cobros.js'

/**
 * El dinero: qué debe cada negocio y qué está cobrado.
 *
 * El cobro es manual (transferencia o recibo), así que esto no cobra nada:
 * calcula, deja constancia y permite marcarlo. Cuando entre una pasarela, el
 * cálculo no cambia — solo cambia quién lo ejecuta.
 */

const periodParam = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'El periodo es AAAA-MM')
    .optional(),
})

const marcarBody = z.object({
  status: z.enum(['PENDIENTE', 'COBRADO', 'ANULADO']),
  note: z.string().trim().max(300).optional(),
})

const desdeParam = (p?: string) => (p ? new Date(`${p}-01T00:00:00Z`) : periodoDe())

const comoTexto = (d: Date) => d.toISOString().slice(0, 7)

export async function cobrosRoutes(app: FastifyInstance) {
  /* ── Lo que ve el negocio de sí mismo ───────────────────── */

  app.get('/api/panel/:slug/cuenta', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const enCurso = await calcularMes(auth.business.id, periodoDe())

    const historial = await prisma.charge.findMany({
      where: { businessId: auth.business.id },
      orderBy: { period: 'desc' },
      take: 12,
    })

    return {
      current: enCurso ? { period: comoTexto(periodoDe()), ...enCurso } : null,
      history: historial.map((c) => ({
        id: c.id,
        period: comoTexto(c.period),
        status: c.status,
        plan: c.plan,
        seats: c.seats,
        subscriptionCents: c.subscriptionCents,
        commissionCents: c.commissionCents,
        messagesCents: c.messagesCents,
        extraMessages: c.extraMessages,
        totalCents: c.totalCents,
        paidAt: c.paidAt?.toISOString() ?? null,
      })),
    }
  })

  /* ── Lo que vemos nosotros ──────────────────────────────── */

  app.get('/api/admin/charges', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const parsed = periodParam.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Periodo inválido' })

    const rows = await prisma.charge.findMany({
      where: parsed.data.period ? { period: desdeParam(parsed.data.period) } : {},
      orderBy: [{ period: 'desc' }, { totalCents: 'desc' }],
      take: 300,
      include: { business: { select: { name: true, slug: true } } },
    })

    return {
      charges: rows.map((c) => ({
        id: c.id,
        period: comoTexto(c.period),
        business: c.business,
        status: c.status,
        plan: c.plan,
        seats: c.seats,
        subscriptionCents: c.subscriptionCents,
        commissionCents: c.commissionCents,
        messagesCents: c.messagesCents,
        extraMessages: c.extraMessages,
        totalCents: c.totalCents,
        paidAt: c.paidAt?.toISOString() ?? null,
        paidNote: c.paidNote,
      })),
      totals: {
        pendienteCents: rows
          .filter((c) => c.status === 'PENDIENTE')
          .reduce((n, c) => n + c.totalCents, 0),
        cobradoCents: rows
          .filter((c) => c.status === 'COBRADO')
          .reduce((n, c) => n + c.totalCents, 0),
      },
    }
  })

  /** Cierra un mes y deja los cobros pendientes. Se lanza a mano. */
  app.post('/api/admin/charges/close', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const parsed = periodParam.safeParse(req.body ?? {})
    if (!parsed.success) return reply.code(400).send({ error: 'Periodo inválido' })

    // Por defecto se cierra el mes pasado: el actual todavía está corriendo.
    const period = parsed.data.period ? desdeParam(parsed.data.period) : periodoAnterior()

    if (period >= periodoDe()) {
      return reply.code(409).send({
        error: 'No se puede cerrar un mes que todavía está corriendo',
      })
    }

    const r = await cerrarMesDeTodos(period)

    audit(req, {
      action: 'COBRO_GENERADO',
      summary: `Ha cerrado ${comoTexto(period)}: ${r.creados} cobros nuevos de ${r.negocios} negocios`,
      actor: user,
      entity: 'Charge',
      metadata: { periodo: comoTexto(period), ...r },
    })

    return { period: comoTexto(period), ...r }
  })

  /** Marcar un cobro como cobrado o anulado. */
  app.patch('/api/admin/charges/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const { id } = req.params as { id: string }
    const parsed = marcarBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' })

    const existing = await prisma.charge.findUnique({
      where: { id },
      include: { business: { select: { name: true } } },
    })
    if (!existing) return reply.code(404).send({ error: 'Cobro no encontrado' })

    const updated = await prisma.charge.update({
      where: { id },
      data: {
        status: parsed.data.status,
        paidAt: parsed.data.status === 'COBRADO' ? new Date() : null,
        paidNote: parsed.data.note || null,
      },
    })

    audit(req, {
      action: 'COBRO_MARCADO',
      summary: `Ha marcado como ${parsed.data.status.toLowerCase()} el mes ${comoTexto(existing.period)} de ${existing.business.name}`,
      actor: user,
      businessId: existing.businessId,
      entity: 'Charge',
      entityId: id,
      metadata: {
        periodo: comoTexto(existing.period),
        antes: existing.status,
        despues: parsed.data.status,
        importe: updated.totalCents,
      },
    })

    return { id, status: updated.status, paidAt: updated.paidAt?.toISOString() ?? null }
  })
}
