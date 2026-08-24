/**
 * Envío de correo transaccional con Brevo.
 *
 * Tres modos, vía MAIL_MODE:
 *   off   — no se envía ni se registra nada.
 *   dry   — se construye el correo y se escribe en el log, pero NO sale. Es el
 *           valor por defecto, a propósito: con la app expuesta por un túnel,
 *           cualquiera que reserve pondría un email real.
 *   live  — se envía de verdad.
 *
 * MAIL_OVERRIDE_TO redirige TODOS los destinatarios a una única dirección,
 * conservando el original en el asunto. Es la red de seguridad para probar sin
 * escribir a nadie que no seas tú.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export type MailMode = 'off' | 'dry' | 'live'

/** Dominios que nunca deben recibir correo real: son de ejemplo o de prueba. */
const UNDELIVERABLE = /\.(test|invalid|example|local)$|@example\.(com|org|net)$/i

export interface MailMessage {
  to: string
  toName?: string
  subject: string
  html: string
  text: string
  replyTo?: { email: string; name?: string }
  tag?: string
}

interface MailConfig {
  mode: MailMode
  apiKey: string
  fromEmail: string
  fromName: string
  overrideTo?: string
}

function readConfig(): MailConfig {
  const rawMode = (process.env.MAIL_MODE ?? 'dry').toLowerCase()
  const mode: MailMode = rawMode === 'live' || rawMode === 'off' ? rawMode : 'dry'
  return {
    mode,
    apiKey: process.env.BREVO_API_KEY ?? '',
    fromEmail: process.env.MAIL_FROM_EMAIL ?? '',
    fromName: process.env.MAIL_FROM_NAME ?? 'Veline',
    overrideTo: process.env.MAIL_OVERRIDE_TO || undefined,
  }
}

export interface MailResult {
  sent: boolean
  reason?: string
  messageId?: string
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const cfg = readConfig()

  if (cfg.mode === 'off') return { sent: false, reason: 'MAIL_MODE=off' }

  const recipient = cfg.overrideTo ?? message.to
  const subject = cfg.overrideTo ? `[para ${message.to}] ${message.subject}` : message.subject

  if (cfg.mode === 'dry') {
    console.log(
      `[mail:dry] → ${recipient} · ${subject}` +
        (cfg.overrideTo ? '' : '  (sin enviar: MAIL_MODE=dry)'),
    )
    return { sent: false, reason: 'MAIL_MODE=dry' }
  }

  if (!cfg.apiKey) return { sent: false, reason: 'falta BREVO_API_KEY' }
  if (!cfg.fromEmail) return { sent: false, reason: 'falta MAIL_FROM_EMAIL' }

  // En modo live nunca se escribe a direcciones de ejemplo: rebotarían y
  // ensuciarían la reputación del remitente.
  if (UNDELIVERABLE.test(recipient)) {
    console.warn(`[mail] omitido, dirección no entregable: ${recipient}`)
    return { sent: false, reason: 'dirección de ejemplo' }
  }

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': cfg.apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: cfg.fromEmail, name: cfg.fromName },
      to: [{ email: recipient, ...(message.toName ? { name: message.toName } : {}) }],
      subject,
      htmlContent: message.html,
      textContent: message.text,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.tag ? { tags: [message.tag] } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`[mail] Brevo ${res.status}: ${detail.slice(0, 300)}`)
    return { sent: false, reason: `Brevo ${res.status}` }
  }

  const body = (await res.json().catch(() => ({}))) as { messageId?: string }
  console.log(`[mail] enviado a ${recipient} · ${subject}`)
  return { sent: true, messageId: body.messageId }
}

/**
 * Envía sin propagar errores. El correo es un efecto secundario de la reserva:
 * si Brevo falla, la cita ya está hecha y no se puede tumbar la petición.
 */
export async function sendMailSafely(message: MailMessage): Promise<void> {
  try {
    await sendMail(message)
  } catch (err) {
    console.error('[mail] error inesperado:', (err as Error).message)
  }
}

export const mailMode = () => readConfig().mode

/**
 * Aviso al arrancar. El correo apagado es un fallo silencioso: las reservas
 * se confirman igual y nadie nota que los avisos no salen, hasta que un
 * cliente se queja. Mejor decirlo en el primer log.
 */
export function describeMailConfig(): string {
  const cfg = readConfig()
  if (cfg.mode === 'off') return 'correo DESACTIVADO (MAIL_MODE=off): no se envía nada'
  if (cfg.mode === 'dry') return 'correo en PRUEBA (MAIL_MODE=dry): se registra pero NO se envía'
  if (!cfg.apiKey) return 'correo en modo live pero SIN BREVO_API_KEY: no se enviará nada'
  if (!cfg.fromEmail) return 'correo en modo live pero SIN MAIL_FROM_EMAIL: no se enviará nada'
  const destino = cfg.overrideTo ? ` — TODO redirigido a ${cfg.overrideTo}` : ''
  return `correo ACTIVO desde ${cfg.fromEmail}${destino}`
}
