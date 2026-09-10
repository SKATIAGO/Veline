import { aceptaReservas } from '@veline/shared'
import { prisma } from '../prisma.js'
import { sendMail } from './enviar.js'
import { sendSms } from './acumbamail.js'
import { registrarEnvio } from './contador.js'
import { bookingConfirmedToCustomer } from './templates.js'
import { idiomaDeLaReserva, idiomaParaCliente } from './idioma.js'
import { smsConfirmacion } from './sms.js'

/**
 * La confirmación que recibe el CLIENTE nada más reservar: correo si dejó
 * uno, y SMS siempre.
 *
 * Antes solo había correo, y el correo es opcional en el formulario: quien
 * reservaba sin dejarlo no recibía nada hasta el recordatorio del día
 * anterior —y si reservaba con menos de 24 horas, ni eso—. Las citas apuntadas
 * a mano desde el panel no mandaban nada de nada, aunque el formulario promete
 * «si lo pones, recibe la confirmación».
 *
 * Una sola función para las dos puertas —la web y el panel— para que no vuelva
 * a pasar que una avise y la otra no.
 *
 * Nunca lanza: la cita ya está hecha y confirmada, y un aviso que falla no
 * puede deshacerla. Todo lo que pase queda en el contador de mensajes.
 */

const webSinProtocolo = () =>
  (process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')

export async function avisarConfirmacion(bookingId: string): Promise<void> {
  try {
    const cita = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, service: true, staff: true, location: true, business: true },
    })
    if (!cita) return

    // Una cita apuntada a mano con fecha pasada —pasar a limpio la agenda de
    // papel— no avisa a nadie: sería un SMS diciendo que tienes una cita que
    // ya fue.
    if (cita.startsAt.getTime() <= Date.now()) return

    const base = {
      businessId: cita.businessId,
      bookingId: cita.id,
      kind: 'RESERVA_CONFIRMADA' as const,
    }

    // Un negocio suspendido no manda mensajes en su nombre, igual que en los
    // recordatorios.
    if (!aceptaReservas(cita.business.subStatus, cita.business.trialEndsAt)) {
      await registrarEnvio({
        ...base,
        channel: 'SMS',
        to: cita.customer.phone,
        status: 'OMITIDO',
        reason: 'negocio no activo',
      })
      return
    }

    const idiomaCliente = idiomaDeLaReserva(cita.idioma)

    if (cita.customer.email) {
      const correo = await sendMail(
        bookingConfirmedToCustomer({
          idiomaCliente,
          code: cita.code,
          startsAt: cita.startsAt,
          priceCents: cita.priceCents,
          serviceName: cita.service.name,
          businessName: cita.business.name,
          businessSlug: cita.business.slug,
          staffName: cita.staff?.name ?? null,
          address: cita.location ? `${cita.location.street}, ${cita.location.city}` : null,
          customerName: cita.customer.name,
          customerPhone: cita.customer.phone,
          customerEmail: cita.customer.email,
          notes: cita.notes,
        }),
      ).catch((err) => ({ sent: false as const, reason: (err as Error).message }))

      await registrarEnvio({
        ...base,
        channel: 'EMAIL',
        to: cita.customer.email,
        status: correo.sent ? 'ENVIADO' : 'OMITIDO',
        reason: correo.sent ? null : 'reason' in correo ? correo.reason : null,
      })
    }

    const sms = await sendSms({
      to: cita.customer.phone,
      body: smsConfirmacion({
        idioma: idiomaParaCliente({ idiomaCliente }),
        startsAt: cita.startsAt,
        businessName: cita.business.name,
        code: cita.code,
        web: webSinProtocolo(),
      }),
    }).catch((err) => ({ sent: false as const, reason: (err as Error).message }))

    await registrarEnvio({
      ...base,
      channel: 'SMS',
      to: cita.customer.phone,
      status: sms.sent ? 'ENVIADO' : 'OMITIDO',
      reason: sms.sent ? null : 'reason' in sms ? sms.reason : null,
    })
  } catch (err) {
    console.error('[confirmacion] no se pudo avisar de la reserva', bookingId, err)
  }
}
