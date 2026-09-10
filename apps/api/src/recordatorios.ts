import { aceptaReservas } from '@veline/shared'
import { prisma } from './prisma.js'
import { sendMail } from './mail/enviar.js'
import { sendSms } from './mail/acumbamail.js'
import { registrarEnvio } from './mail/contador.js'
import { bookingReminderMail } from './mail/templates.js'
import { idiomaDeLaReserva, idiomaParaCliente } from './mail/idioma.js'
import { smsRecordatorio } from './mail/sms.js'

/**
 * El recordatorio de la cita del día siguiente.
 *
 * Es lo que de verdad reduce las ausencias y lo que la web lleva prometiendo
 * desde el principio: hasta ahora solo salían correos como reacción a algo
 * (reservar, cancelar). Nadie miraba el reloj.
 *
 * El proceso se despierta cada cuarto de hora y busca las citas que empiezan
 * dentro de la ventana de aviso. Se apoya en dos cosas para no duplicar:
 * `reminderSentAt` en la cita, y que se marca ANTES de enviar — si el envío
 * falla se pierde ese recordatorio, que es mucho mejor que mandar cinco al
 * mismo cliente porque el proceso se reinició.
 */

/** Cuánto antes de la cita se avisa. */
const HORAS_ANTES = 24
/** Margen de la ventana: el proceso corre cada 15 min, se coge algo más. */
const VENTANA_MIN = 30
/** Si la reserva es más reciente que esto, el cliente acaba de recibir la
    confirmación y el recordatorio sobra. */
const CONFIRMACION_RECIENTE_H = 12

const CADA_MS = 15 * 60 * 1000

export interface ResultadoTanda {
  revisadas: number
  correos: number
  smss: number
  fallos: number
}

/** Una pasada. Se exporta aparte del bucle para poder probarla y lanzarla a mano. */
export async function enviarRecordatoriosPendientes(): Promise<ResultadoTanda> {
  const ahora = Date.now()
  const desde = new Date(ahora + HORAS_ANTES * 3_600_000)
  const hasta = new Date(desde.getTime() + VENTANA_MIN * 60_000)

  const citas = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMADA',
      reminderSentAt: null,
      startsAt: { gte: desde, lt: hasta },
    },
    include: {
      customer: true,
      service: true,
      staff: true,
      business: { include: { locations: { take: 1 } } },
    },
    take: 200,
  })

  const res: ResultadoTanda = { revisadas: citas.length, correos: 0, smss: 0, fallos: 0 }

  for (const cita of citas) {
    // Se sella primero: si algo peta a mitad, se queda sin recordatorio en vez
    // de mandarlo en bucle en cada pasada.
    await prisma.booking.update({
      where: { id: cita.id },
      data: { reminderSentAt: new Date() },
    })

    // Un negocio suspendido o dado de baja no manda mensajes en su nombre.
    if (!aceptaReservas(cita.business.subStatus, cita.business.trialEndsAt)) {
      await registrarEnvio({
        businessId: cita.businessId,
        bookingId: cita.id,
        channel: 'EMAIL',
        kind: 'RECORDATORIO',
        to: cita.customer.email ?? cita.customer.phone,
        status: 'OMITIDO',
        reason: 'negocio no activo',
      })
      continue
    }

    /* Una reserva hecha hace menos de 12 horas acaba de recibir la
       confirmación, con la misma fecha y hora. Un recordatorio encima sería un
       segundo SMS diciendo lo mismo a las pocas horas —o minutos—, molesto
       para el cliente y un mensaje más en el cupo del negocio. Pasa con toda
       reserva hecha entre 24 y 36 horas antes de la cita. */
    if (ahora - cita.createdAt.getTime() < CONFIRMACION_RECIENTE_H * 3_600_000) {
      await registrarEnvio({
        businessId: cita.businessId,
        bookingId: cita.id,
        channel: 'SMS',
        kind: 'RECORDATORIO',
        to: cita.customer.phone,
        status: 'OMITIDO',
        reason: 'confirmación reciente',
      })
      continue
    }

    const idiomaCliente = idiomaDeLaReserva(cita.idioma)
    const loc = cita.business.locations[0]

    if (cita.customer.email) {
      const r = await sendMail(
        bookingReminderMail({
          idiomaCliente,
          code: cita.code,
          startsAt: cita.startsAt,
          priceCents: cita.priceCents,
          serviceName: cita.service.name,
          businessName: cita.business.name,
          businessSlug: cita.business.slug,
          staffName: cita.staff?.name ?? null,
          address: loc ? `${loc.street}, ${loc.city}` : null,
          customerName: cita.customer.name,
          customerPhone: cita.customer.phone,
          customerEmail: cita.customer.email,
        }),
      ).catch((err) => ({ sent: false as const, reason: (err as Error).message }))

      await registrarEnvio({
        businessId: cita.businessId,
        bookingId: cita.id,
        channel: 'EMAIL',
        kind: 'RECORDATORIO',
        to: cita.customer.email,
        status: r.sent ? 'ENVIADO' : 'OMITIDO',
        reason: r.sent ? null : 'reason' in r ? r.reason : null,
      })
      if (r.sent) res.correos++
    }

    const sms = await sendSms({
      to: cita.customer.phone,
      body: smsRecordatorio({
        // Lo lee el cliente, así que el idioma sale de él, igual que el correo.
        idioma: idiomaParaCliente({ idiomaCliente }),
        startsAt: cita.startsAt,
        businessName: cita.business.name,
        serviceName: cita.service.name,
        code: cita.code,
      }),
    }).catch((err) => ({ sent: false as const, reason: (err as Error).message }))

    await registrarEnvio({
      businessId: cita.businessId,
      bookingId: cita.id,
      channel: 'SMS',
      kind: 'RECORDATORIO',
      to: cita.customer.phone,
      status: sms.sent ? 'ENVIADO' : 'OMITIDO',
      reason: sms.sent ? null : 'reason' in sms ? sms.reason : null,
    })
    if (sms.sent) res.smss++
    // Un «no enviado» a propósito (modo dry, sin token…) no es un fallo; todo
    // lo demás sí, incluido que Acumbamail rechace el mensaje o se caiga la red.
    else if (!('freno' in sms && sms.freno)) res.fallos++
  }

  return res
}

/**
 * Arranca el bucle. Vive dentro del propio proceso de la API en vez de en un
 * contenedor aparte: con un solo servidor no compensa la complejidad, y si
 * algún día hay varios habrá que mover esto fuera o coordinar con un candado
 * en la base (dos procesos harían el trabajo dos veces).
 */
export function arrancarRecordatorios(log: {
  info: (msg: string) => void
  error: (obj: unknown, msg: string) => void
}) {
  const tanda = async () => {
    try {
      const r = await enviarRecordatoriosPendientes()
      if (r.revisadas > 0) {
        log.info(
          `recordatorios: ${r.revisadas} citas · ${r.correos} correos · ${r.smss} SMS · ${r.fallos} fallos`,
        )
      }
    } catch (err) {
      log.error({ err }, 'la tanda de recordatorios ha fallado')
    }
  }

  // La primera pasada espera un poco: al arrancar, la base puede estar todavía
  // aplicando migraciones.
  const inicial = setTimeout(tanda, 30_000)
  const cada = setInterval(tanda, CADA_MS)

  return () => {
    clearTimeout(inicial)
    clearInterval(cada)
  }
}
