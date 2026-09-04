import type { MessageChannel, MessageKind, MessageStatus } from '@prisma/client'
import { MENSAJE_EXTRA_CENTS, PLAN_INFO, type PlanKey } from '@veline/shared'
import { prisma } from '../prisma.js'

/**
 * El contador de mensajes de cada negocio.
 *
 * La tarifa dice «200 mensajes al mes incluidos, luego 0,06 € por mensaje».
 * Para poder cumplir eso hace falta saber cuántos lleva, y eso no se puede
 * sacar del log del servidor: se registra cada envío en la base.
 *
 * Solo cuentan para el cupo los mensajes del negocio (confirmaciones,
 * cancelaciones, recordatorios). Los nuestros —restablecer una contraseña—
 * no se le cobran a nadie.
 */

const CUENTAN_PARA_EL_CUPO: MessageKind[] = [
  'RESERVA_CONFIRMADA',
  'RESERVA_CANCELADA',
  'RECORDATORIO',
  'RESENA_PEDIDA',
]

/** Primer instante del mes en curso, hora local. */
export function inicioDeMes(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Cuántos mensajes cobrables lleva el negocio este mes. */
export async function mensajesDelMes(businessId: string, desde = inicioDeMes()) {
  return prisma.messageLog.count({
    where: {
      businessId,
      status: 'ENVIADO',
      kind: { in: CUENTAN_PARA_EL_CUPO },
      createdAt: { gte: desde },
    },
  })
}

export interface ResumenMensajes {
  enviados: number
  incluidos: number
  extra: number
  costeExtraCents: number
}

export async function resumenMensajes(
  businessId: string,
  plan: PlanKey,
  desde = inicioDeMes(),
): Promise<ResumenMensajes> {
  const enviados = await mensajesDelMes(businessId, desde)
  const incluidos = PLAN_INFO[plan]?.messagesIncluded ?? 0
  const extra = Math.max(0, enviados - incluidos)
  return { enviados, incluidos, extra, costeExtraCents: extra * MENSAJE_EXTRA_CENTS }
}

interface RegistroEnvio {
  businessId?: string | null
  bookingId?: string | null
  channel: MessageChannel
  kind: MessageKind
  to: string
  status: MessageStatus
  reason?: string | null
}

/**
 * Guarda el envío y le pone precio.
 *
 * El coste se calcula en el momento del envío, no al facturar: si el negocio
 * cambia de plan a mitad de mes, lo ya enviado mantiene el precio que tenía
 * cuando salió. Cobrar hacia atrás con la tarifa nueva sería una sorpresa.
 *
 * Como con la auditoría, registrar nunca puede tumbar el envío: si esto falla,
 * el mensaje ya salió y el cliente lo tiene.
 */
export async function registrarEnvio(envio: RegistroEnvio): Promise<void> {
  try {
    let costeCents = 0

    if (
      envio.status === 'ENVIADO' &&
      envio.businessId &&
      CUENTAN_PARA_EL_CUPO.includes(envio.kind)
    ) {
      const negocio = await prisma.business.findUnique({
        where: { id: envio.businessId },
        select: { plan: true },
      })
      const incluidos = negocio ? (PLAN_INFO[negocio.plan]?.messagesIncluded ?? 0) : 0
      const yaEnviados = await mensajesDelMes(envio.businessId)
      // yaEnviados aún no incluye este: si ya se han gastado los incluidos,
      // este es de pago.
      if (yaEnviados >= incluidos) costeCents = MENSAJE_EXTRA_CENTS
    }

    await prisma.messageLog.create({
      data: {
        businessId: envio.businessId ?? null,
        bookingId: envio.bookingId ?? null,
        channel: envio.channel,
        kind: envio.kind,
        to: envio.to,
        status: envio.status,
        reason: envio.reason ?? null,
        costCents: costeCents,
      },
    })
  } catch (err) {
    console.error('[mensajes] no se pudo registrar el envío', err)
  }
}
