/**
 * SMS con Acumbamail.
 *
 * Mismos tres modos que el correo (off / dry / live) y por el mismo motivo:
 * un SMS a un número real cuesta dinero y no se puede deshacer. Aquí el freno
 * importa más todavía, porque el correo a una dirección inventada rebota y ya,
 * pero un SMS a un número equivocado llega a alguien.
 *
 * El correo sigue en Brevo a propósito: funciona, está verificado y probado en
 * producción. Migrarlo también aquí es un cambio de configuración, no de
 * código: por eso `sendSms` y `sendMail` tienen la misma forma.
 */

const ENDPOINT = 'https://acumbamail.com/api/1/sendSMS/'

export type SmsMode = 'off' | 'dry' | 'live'

export interface SmsMessage {
  /** Teléfono del destinatario, tal y como lo guardó el cliente. */
  to: string
  body: string
}

export type SmsResult = { sent: true; id?: string } | { sent: false; reason: string }

interface SmsConfig {
  mode: SmsMode
  token: string
  sender: string
  overrideTo?: string
}

function readConfig(): SmsConfig {
  const raw = (process.env.SMS_MODE ?? 'dry').toLowerCase()
  const mode: SmsMode = raw === 'live' || raw === 'off' ? raw : 'dry'
  return {
    mode,
    token: process.env.ACUMBAMAIL_TOKEN ?? '',
    // Acumbamail exige un remitente alfanumérico de 11 caracteres como mucho.
    sender: (process.env.SMS_SENDER ?? 'Veline').slice(0, 11),
    overrideTo: process.env.SMS_OVERRIDE_TO || undefined,
  }
}

export const smsMode = () => readConfig().mode

/**
 * Aviso al arrancar, igual que con el correo: los SMS apagados son un fallo
 * silencioso — las citas se confirman igual y nadie nota que el recordatorio
 * no sale hasta que un cliente no aparece.
 */
export function describeSmsConfig(): string {
  const cfg = readConfig()
  if (cfg.mode === 'off') return 'SMS DESACTIVADOS (SMS_MODE=off): no se envía ninguno'
  if (cfg.mode === 'dry') return 'SMS en PRUEBA (SMS_MODE=dry): se registran pero NO se envían'
  if (!cfg.token) return 'SMS en modo live pero SIN ACUMBAMAIL_TOKEN: no se enviará ninguno'
  const destino = cfg.overrideTo ? ` — TODO redirigido a ${cfg.overrideTo}` : ''
  return `SMS ACTIVOS como «${cfg.sender}»${destino}`
}

/** España: Acumbamail quiere el número con prefijo y sin separadores. */
export function normalizaTelefono(raw: string): string | null {
  const limpio = raw.replace(/[\s-().]/g, '')
  if (/^\+34\d{9}$/.test(limpio)) return limpio
  if (/^34\d{9}$/.test(limpio)) return `+${limpio}`
  if (/^\d{9}$/.test(limpio)) return `+34${limpio}`
  return null
}

export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  const cfg = readConfig()

  if (cfg.mode === 'off') return { sent: false, reason: 'SMS_MODE=off' }

  const destino = normalizaTelefono(cfg.overrideTo ?? message.to)
  if (!destino) return { sent: false, reason: 'teléfono no válido' }

  if (cfg.mode === 'dry') {
    console.log(`[sms:dry] ${destino} · ${message.body.slice(0, 60)}`)
    return { sent: false, reason: 'SMS_MODE=dry' }
  }

  if (!cfg.token) return { sent: false, reason: 'sin ACUMBAMAIL_TOKEN' }

  // La API de Acumbamail es de formulario, no JSON.
  const form = new URLSearchParams({
    auth_token: cfg.token,
    sender: cfg.sender,
    message: message.body,
    // Espera una lista JSON de destinatarios aunque solo vaya uno.
    recipients: JSON.stringify([{ phone: destino }]),
  })

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    return { sent: false, reason: `red: ${(err as Error).message}` }
  }

  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    console.error(`[sms] Acumbamail ${res.status}: ${detalle.slice(0, 300)}`)
    return { sent: false, reason: `Acumbamail ${res.status}` }
  }

  console.log(`[sms] enviado a ${destino}`)
  return { sent: true }
}
