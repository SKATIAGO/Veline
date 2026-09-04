/**
 * Lo que comparten los dos transportes de correo.
 *
 * Los frenos (off / dry / live, redirección de destinatarios y descarte de
 * direcciones no entregables) viven aquí y no dentro de cada proveedor: si
 * cada uno los implementara por su cuenta, tarde o temprano uno se dejaría
 * alguno y mandaría correo real desde una máquina de pruebas.
 */

export type MailMode = 'off' | 'dry' | 'live'

export type MailProvider = 'brevo' | 'acumbamail'

export interface MailMessage {
  to: string
  toName?: string
  subject: string
  html: string
  text: string
  replyTo?: { email: string; name?: string }
  tag?: string
}

export interface MailResult {
  sent: boolean
  reason?: string
  messageId?: string
}

export interface MailConfig {
  provider: MailProvider
  mode: MailMode
  fromEmail: string
  fromName: string
  overrideTo?: string
}

/** Dominios que nunca deben recibir correo real: son de ejemplo o de prueba. */
export const UNDELIVERABLE = /\.(test|invalid|example|local)$|@example\.(com|org|net)$/i

export function readMailConfig(): MailConfig {
  const rawMode = (process.env.MAIL_MODE ?? 'dry').toLowerCase()
  const mode: MailMode = rawMode === 'live' || rawMode === 'off' ? rawMode : 'dry'

  const rawProvider = (process.env.MAIL_PROVIDER ?? 'acumbamail').toLowerCase()
  const provider: MailProvider = rawProvider === 'brevo' ? 'brevo' : 'acumbamail'

  return {
    provider,
    mode,
    fromEmail: process.env.MAIL_FROM_EMAIL ?? '',
    fromName: process.env.MAIL_FROM_NAME ?? 'Veline',
    overrideTo: process.env.MAIL_OVERRIDE_TO || undefined,
  }
}

/**
 * Aplica los frenos antes de que el mensaje llegue a ningún proveedor.
 * Devuelve `null` cuando hay que seguir, o el resultado con el que cortar.
 */
export function frenos(
  message: MailMessage,
  cfg: MailConfig,
): { corte: MailResult } | { destinatario: string; asunto: string } {
  if (cfg.mode === 'off') return { corte: { sent: false, reason: 'MAIL_MODE=off' } }

  const destinatario = cfg.overrideTo ?? message.to
  const asunto = cfg.overrideTo ? `[para ${message.to}] ${message.subject}` : message.subject

  if (cfg.mode === 'dry') {
    console.log(`[mail:dry] → ${destinatario} · ${asunto}  (sin enviar: MAIL_MODE=dry)`)
    return { corte: { sent: false, reason: 'MAIL_MODE=dry' } }
  }

  if (!cfg.fromEmail) return { corte: { sent: false, reason: 'falta MAIL_FROM_EMAIL' } }

  if (UNDELIVERABLE.test(destinatario)) {
    return { corte: { sent: false, reason: 'dirección no entregable' } }
  }

  return { destinatario, asunto }
}
