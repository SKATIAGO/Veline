import { MENSAJE_EXTRA_CENTS, PLAN_INFO, cuotaMensualCents, type PlanKey } from '@veline/shared'
import { prisma } from './prisma.js'

/**
 * Lo que le toca pagar a cada negocio cada mes.
 *
 * Tres conceptos: la cuota del plan (con las personas de más), la comisión del
 * 15 % de los clientes nuevos que llegaron por el marketplace, y los mensajes
 * que pasaron del cupo.
 *
 * El cobro es MANUAL: esto no cobra nada, solo dice cuánto y deja constancia de
 * lo que está pagado. Cuando entre una pasarela, este cálculo no cambia — solo
 * cambia quién lo ejecuta.
 */

/** Primer día del mes de una fecha, a medianoche UTC (columna @db.Date). */
export function periodoDe(d = new Date()) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1))
}

/** El mes anterior al de la fecha dada. */
export function periodoAnterior(d = new Date()) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1))
}

export interface Desglose {
  plan: PlanKey
  seats: number
  subscriptionCents: number
  commissionCents: number
  extraMessages: number
  messagesCents: number
  totalCents: number
}

/**
 * Calcula el mes de un negocio. No guarda nada: sirve tanto para el cierre
 * como para enseñar el mes en curso en el panel, que todavía no está cerrado.
 */
export async function calcularMes(businessId: string, period: Date): Promise<Desglose | null> {
  const negocio = await prisma.business.findUnique({
    where: { id: businessId },
    select: { plan: true },
  })
  if (!negocio) return null

  const desde = period
  const hasta = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1))

  const [seats, comision, mensajes] = await Promise.all([
    prisma.staff.count({ where: { businessId, active: true } }),
    prisma.booking.aggregate({
      where: {
        businessId,
        // Las canceladas ya llevan la comisión a 0, pero se excluyen igual:
        // no se cobra comisión por una cita que no ocurrió.
        status: { in: ['CONFIRMADA', 'COMPLETADA'] },
        createdAt: { gte: desde, lt: hasta },
      },
      _sum: { commissionCents: true },
    }),
    prisma.messageLog.count({
      where: {
        businessId,
        status: 'ENVIADO',
        costCents: { gt: 0 },
        createdAt: { gte: desde, lt: hasta },
      },
    }),
  ])

  const plan = negocio.plan as PlanKey
  const subscriptionCents = cuotaMensualCents(plan, seats)
  const commissionCents = comision._sum.commissionCents ?? 0
  const messagesCents = mensajes * MENSAJE_EXTRA_CENTS

  return {
    plan,
    seats,
    subscriptionCents,
    commissionCents,
    extraMessages: mensajes,
    messagesCents,
    totalCents: subscriptionCents + commissionCents + messagesCents,
  }
}

/**
 * Cierra un mes para un negocio y deja el cobro pendiente.
 *
 * Idempotente a propósito: si ya existe el cobro de ese mes NO se recalcula.
 * Las cifras se congelan al cerrar — si el negocio cambia de plan en octubre,
 * septiembre no se mueve.
 */
export async function cerrarMes(businessId: string, period: Date) {
  const existente = await prisma.charge.findUnique({
    where: { businessId_period: { businessId, period } },
  })
  if (existente) return { charge: existente, creado: false }

  const d = await calcularMes(businessId, period)
  if (!d) return null

  // Un mes a cero no genera cobro: un negocio en plan Gratis sin comisiones ni
  // mensajes de más no debe nada, y una lista llena de cobros de 0 € estorba.
  if (d.totalCents === 0) return { charge: null, creado: false }

  const charge = await prisma.charge.create({
    data: {
      businessId,
      period,
      plan: d.plan,
      seats: d.seats,
      subscriptionCents: d.subscriptionCents,
      commissionCents: d.commissionCents,
      messagesCents: d.messagesCents,
      extraMessages: d.extraMessages,
      totalCents: d.totalCents,
    },
  })
  return { charge, creado: true }
}

/** Cierra el mes de todos los negocios que estaban activos. */
export async function cerrarMesDeTodos(period: Date) {
  const negocios = await prisma.business.findMany({
    where: { subStatus: { in: ['ACTIVA', 'IMPAGADA', 'PRUEBA'] } },
    select: { id: true },
  })

  let creados = 0
  for (const n of negocios) {
    const r = await cerrarMes(n.id, period)
    if (r?.creado) creados++
  }
  return { negocios: negocios.length, creados }
}

/** El cupo de mensajes del plan, para enseñarlo junto al consumo. */
export const cupoMensajes = (plan: PlanKey) => PLAN_INFO[plan]?.messagesIncluded ?? 0
