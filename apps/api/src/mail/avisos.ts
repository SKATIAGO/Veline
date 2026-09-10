import { aceptaReservas } from '@veline/shared'
import { prisma } from '../prisma.js'
import { sendMail } from './enviar.js'
import { sendSms } from './acumbamail.js'
import { registrarEnvio } from './contador.js'
import { bookingCancelled, bookingConfirmedToCustomer, type BookingMailData } from './templates.js'
import { idiomaDeLaReserva, idiomaParaCliente } from './idioma.js'
import { smsCancelacion, smsConfirmacion } from './sms.js'

/**
 * Los avisos que recibe el CLIENTE sobre su cita: la confirmación al reservar
 * y el aviso cuando se cancela. El recordatorio del día antes va aparte, en
 * recordatorios.ts, porque no lo dispara nadie: lo dispara el reloj.
 *
 * Cada aviso sale por correo si el cliente dejó uno, y por SMS siempre: el
 * correo es opcional al reservar y el teléfono no.
 *
 * Una sola función por aviso para todas las puertas —la web y el panel—, para
 * que no vuelva a pasar que una avise y otra no. Pasaba: el panel no confirmaba
 * nada, y cancelar solo avisaba por correo, y solo a quien lo había dejado.
 *
 * Nunca lanzan: la cita ya está hecha, o ya está cancelada, y un aviso que
 * falla no puede deshacer eso. Todo lo que pase queda en el contador.
 */

const webSinProtocolo = () =>
  (process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')

const cargarCita = (bookingId: string) =>
  prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, service: true, staff: true, location: true, business: true },
  })

type Cita = NonNullable<Awaited<ReturnType<typeof cargarCita>>>

const datosCorreo = (cita: Cita): BookingMailData => ({
  idiomaCliente: idiomaDeLaReserva(cita.idioma),
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
})

/** Correo (si lo hay) y SMS al cliente, y los dos apuntados en el contador. */
async function avisarCliente(
  cita: Cita,
  kind: 'RESERVA_CONFIRMADA' | 'RESERVA_CANCELADA',
  mensajes: { correo: Parameters<typeof sendMail>[0] | null; sms: string },
) {
  const base = { businessId: cita.businessId, bookingId: cita.id, kind }

  if (mensajes.correo && cita.customer.email) {
    const r = await sendMail(mensajes.correo).catch((err) => ({
      sent: false as const,
      reason: (err as Error).message,
    }))
    await registrarEnvio({
      ...base,
      channel: 'EMAIL',
      to: cita.customer.email,
      status: r.sent ? 'ENVIADO' : 'OMITIDO',
      reason: r.sent ? null : 'reason' in r ? r.reason : null,
    })
  }

  const r = await sendSms({ to: cita.customer.phone, body: mensajes.sms }).catch((err) => ({
    sent: false as const,
    reason: (err as Error).message,
  }))
  await registrarEnvio({
    ...base,
    channel: 'SMS',
    to: cita.customer.phone,
    status: r.sent ? 'ENVIADO' : 'OMITIDO',
    reason: r.sent ? null : 'reason' in r ? r.reason : null,
  })
}

/** Al reservar, por la web o desde el panel. */
export async function avisarConfirmacion(bookingId: string): Promise<void> {
  try {
    const cita = await cargarCita(bookingId)
    if (!cita) return

    // Una cita apuntada a mano con fecha pasada —pasar a limpio la agenda de
    // papel— no avisa a nadie: sería un SMS diciendo que tienes una cita que
    // ya fue.
    if (cita.startsAt.getTime() <= Date.now()) return

    // Un negocio suspendido no manda mensajes en su nombre, igual que en los
    // recordatorios.
    if (!aceptaReservas(cita.business.subStatus, cita.business.trialEndsAt)) {
      await registrarEnvio({
        businessId: cita.businessId,
        bookingId: cita.id,
        kind: 'RESERVA_CONFIRMADA',
        channel: 'SMS',
        to: cita.customer.phone,
        status: 'OMITIDO',
        reason: 'negocio no activo',
      })
      return
    }

    const idiomaCliente = idiomaDeLaReserva(cita.idioma)
    await avisarCliente(cita, 'RESERVA_CONFIRMADA', {
      correo: cita.customer.email ? bookingConfirmedToCustomer(datosCorreo(cita)) : null,
      sms: smsConfirmacion({
        idioma: idiomaParaCliente({ idiomaCliente }),
        startsAt: cita.startsAt,
        businessName: cita.business.name,
        code: cita.code,
        web: webSinProtocolo(),
      }),
    })
  } catch (err) {
    console.error('[avisos] no se pudo confirmar la reserva', bookingId, err)
  }
}

/** Al cancelar, la cancele el cliente con su código o el negocio desde el panel. */
export async function avisarCancelacion(bookingId: string): Promise<void> {
  try {
    const cita = await cargarCita(bookingId)
    if (!cita) return

    // Cancelar una cita que ya pasó —limpiar la agenda— no avisa a nadie.
    if (cita.startsAt.getTime() <= Date.now()) return

    /* A diferencia de la confirmación, aquí NO se mira si el negocio está
       activo. Un negocio suspendido no debe mandar confirmaciones ni
       recordatorios en su nombre, pero que su cita se ha cancelado el cliente
       tiene que saberlo igual: si no, se presenta. */
    const idiomaCliente = idiomaDeLaReserva(cita.idioma)
    await avisarCliente(cita, 'RESERVA_CANCELADA', {
      correo: cita.customer.email
        ? bookingCancelled(
            datosCorreo(cita),
            { email: cita.customer.email, name: cita.customer.name },
            'cliente',
          )
        : null,
      sms: smsCancelacion({
        idioma: idiomaParaCliente({ idiomaCliente }),
        startsAt: cita.startsAt,
        businessName: cita.business.name,
        businessSlug: cita.business.slug,
        web: webSinProtocolo(),
      }),
    })
  } catch (err) {
    console.error('[avisos] no se pudo avisar de la cancelación', bookingId, err)
  }
}
