/**
 * Acumbamail: SMS y correo transaccional.
 *
 * Mismos tres modos que el correo (off / dry / live) y por el mismo motivo:
 * un SMS a un número real cuesta dinero y no se puede deshacer. Aquí el freno
 * importa más todavía, porque el correo a una dirección inventada rebota y ya,
 * pero un SMS a un número equivocado llega a alguien.
 *
 * Lo que su API de correo NO tiene, y hay que saberlo antes de mirar por qué
 * un correo se ve distinto que antes (documentado en docs/08-correo.md):
 *
 *   - `reply_to`. Responder a un correo de Veline escribe al remitente, no al
 *     buzón de contacto ni al cliente que reservó.
 *   - Versión en texto plano: solo admite `body` con el HTML.
 *   - Nombre del remitente: llega la dirección pelada, sin «Veline <…>».
 *
 * Por eso el proveedor se elige con MAIL_PROVIDER y no a martillazos: volver
 * a Brevo es cambiar una variable, no rehacer esto.
 */

const ENDPOINT_SMS = 'https://acumbamail.com/api/1/sendSMS/'
/** sendOne: un correo transaccional. Ver apidoc/function/sendOne. */
const ENDPOINT_MAIL = 'https://acumbamail.com/api/1/sendOne/'

import type { MailConfig, MailMessage, MailResult } from './tipos.js'

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

/** Un SMS ya enviado a Acumbamail, tal y como lo describe su API real. */
interface RespuestaSms {
  status: number
  /** Solo viene cuando status no es 0. */
  error?: string
  credits?: number
  id?: number
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

  /* Confirmado contra el ejemplo que mandó soporte (Ana, 10 sep 2026) y NO lo
     que había aquí antes: un único campo `messages` con una lista en JSON, y
     el remitente va DENTRO de cada mensaje — no como campo `sender` aparte, y
     no hay ningún campo `recipients` ni `phone`. Multipart (como su `curl -F`)
     y no formulario codificado, por si su lado solo espera eso. */
  const form = new FormData()
  form.set('auth_token', cfg.token)
  form.set(
    'messages',
    JSON.stringify([{ recipient: destino, body: message.body, sender: cfg.sender }]),
  )

  let res: Response
  try {
    res = await fetch(ENDPOINT_SMS, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    return { sent: false, reason: `red: ${(err as Error).message}` }
  }

  const texto = await res.text().catch(() => '')

  if (!res.ok) {
    console.error(`[sms] Acumbamail ${res.status}: ${texto.slice(0, 300)}`)
    return { sent: false, reason: `Acumbamail ${res.status}` }
  }

  /* Un 200 no significa que se haya mandado: Acumbamail contesta 200 incluso
     cuando rechaza el SMS, y pone el motivo dentro del cuerpo, por mensaje
     (status 0 = enviado; cualquier otro valor trae `error`). Sin leer esto,
     un teléfono rechazado o sin crédito se habría dado por enviado — que es
     justo el fallo que tenía esto antes de mirar la documentación real. */
  let cuerpo: { messages?: RespuestaSms[] }
  try {
    cuerpo = JSON.parse(texto) as { messages?: RespuestaSms[] }
  } catch {
    console.error(`[sms] Acumbamail no devolvió JSON: ${texto.slice(0, 300)}`)
    return { sent: false, reason: 'respuesta no válida' }
  }

  const resultado = cuerpo.messages?.[0]
  if (!resultado) {
    console.error(`[sms] Acumbamail sin "messages" en la respuesta: ${texto.slice(0, 300)}`)
    return { sent: false, reason: 'sin respuesta de Acumbamail' }
  }

  if (resultado.status !== 0) {
    const motivo = resultado.error ?? `status ${resultado.status}`
    console.error(`[sms] Acumbamail rechazó el envío a ${destino}: ${motivo}`)
    return { sent: false, reason: motivo }
  }

  const creditos = resultado.credits ? ` · ${resultado.credits} créditos` : ''
  console.log(`[sms] enviado a ${destino}${creditos}`)
  return { sent: true, id: resultado.id !== undefined ? String(resultado.id) : undefined }
}

/* ── Correo transaccional ─────────────────────────────────── */

/**
 * Manda el correo por Acumbamail. Los frenos (off/dry/live, redirección,
 * direcciones no entregables) ya se aplicaron antes de llegar aquí.
 */
export async function sendMailAcumbamail(
  message: MailMessage,
  cfg: MailConfig,
  destinatario: string,
  asunto: string,
): Promise<MailResult> {
  const token = process.env.ACUMBAMAIL_TOKEN ?? ''
  if (!token) return { sent: false, reason: 'falta ACUMBAMAIL_TOKEN' }

  const form = new URLSearchParams({
    auth_token: token,
    from_email: cfg.fromEmail,
    to_email: destinatario,
    subject: asunto,
    // Solo admite el HTML: la versión en texto plano de la plantilla se
    // queda sin mandar. Se conserva igualmente en el objeto por si algún día
    // se vuelve a Brevo, que sí la usa.
    body: message.html,
    ...(message.tag ? { category: message.tag } : {}),
  })

  let res: Response
  try {
    res = await fetch(ENDPOINT_MAIL, {
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
    console.error(`[mail] Acumbamail ${res.status}: ${detalle.slice(0, 300)}`)
    return { sent: false, reason: `Acumbamail ${res.status}` }
  }

  // Devuelve la clave del email como cadena; puede venir entrecomillada.
  const cuerpo = await res.text().catch(() => '')
  const messageId = cuerpo.trim().replace(/^"|"$/g, '') || undefined

  console.log(`[mail] enviado a ${destinatario} · ${asunto}`)
  return { sent: true, messageId }
}
