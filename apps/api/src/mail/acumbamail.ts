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

/* Sin barra final: es la dirección exacta de la llamada que funcionó en
   Postman (10 sep 2026, 201 con status 0). */
const ENDPOINT_SMS = 'https://acumbamail.com/api/1/sendSMS'
/** sendOne: un correo transaccional. Ver apidoc/function/sendOne. */
const ENDPOINT_MAIL = 'https://acumbamail.com/api/1/sendOne/'

import type { MailConfig, MailMessage, MailResult } from './tipos.js'

export type SmsMode = 'off' | 'dry' | 'live'

export interface SmsMessage {
  /** Teléfono del destinatario, tal y como lo guardó el cliente. */
  to: string
  body: string
}

export type SmsResult =
  | { sent: true; id?: string }
  /** `freno`: no se ha enviado A PROPÓSITO (modo off o dry, sin token,
      teléfono que no es español). Sin marca, es un fallo de verdad. */
  | { sent: false; reason: string; freno?: boolean }

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

  if (cfg.mode === 'off') return { sent: false, reason: 'SMS_MODE=off', freno: true }

  const destino = normalizaTelefono(cfg.overrideTo ?? message.to)
  if (!destino) return { sent: false, reason: 'teléfono no válido', freno: true }

  if (cfg.mode === 'dry') {
    console.log(`[sms:dry] ${destino} · ${message.body.slice(0, 60)}`)
    return { sent: false, reason: 'SMS_MODE=dry', freno: true }
  }

  if (!cfg.token) return { sent: false, reason: 'sin ACUMBAMAIL_TOKEN', freno: true }

  /** Tapa el token en cualquier texto antes de escribirlo en un log o de
      guardarlo como motivo en la base: si algún error devolviera la URL
      entera, el token iría dentro. */
  const tapa = (t: string) => t.split(cfg.token).join('***')

  /* Exactamente la llamada que Santiago probó a mano en Postman el 10 sep
     2026 y devolvió 201 con status 0: POST, con auth_token y messages como
     PARÁMETROS DE LA URL, sin cuerpo.

     El ejemplo de soporte usaba `curl -F` (cuerpo multipart) y seguramente
     también vale, pero la de la URL es la que está probada con esta cuenta.
     Con dinero de por medio, se usa la probada.

     OJO: esta URL lleva el token dentro. Por el camino viaja cifrada (HTTPS);
     el riesgo es dejarla escrita en algún sitio, así que NO se escribe en
     ningún log. Hay una prueba que lo vigila. */
  const params = new URLSearchParams({
    auth_token: cfg.token,
    messages: JSON.stringify([{ recipient: destino, body: message.body, sender: cfg.sender }]),
  })

  let res: Response
  try {
    res = await fetch(`${ENDPOINT_SMS}?${params}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    return { sent: false, reason: tapa(`red: ${(err as Error).message}`) }
  }

  const texto = await res.text().catch(() => '')

  // 201 es lo normal —es lo que devolvió en Postman—; res.ok cubre 200-299.
  if (!res.ok) {
    console.error(`[sms] Acumbamail ${res.status}: ${tapa(texto).slice(0, 300)}`)
    return { sent: false, reason: `Acumbamail ${res.status}` }
  }

  /* Que la petición vaya bien no significa que el SMS salga: Acumbamail
     contesta con éxito HTTP incluso cuando RECHAZA el mensaje, y pone el
     motivo dentro del cuerpo, por mensaje (status 0 = enviado; cualquier otro
     valor trae `error`). Sin leer esto, un teléfono rechazado o una cuenta
     sin crédito se darían por enviados. */
  let cuerpo: { messages?: RespuestaSms[] }
  try {
    cuerpo = JSON.parse(texto) as { messages?: RespuestaSms[] }
  } catch {
    console.error(`[sms] Acumbamail no devolvió JSON: ${tapa(texto).slice(0, 300)}`)
    return { sent: false, reason: 'Acumbamail: respuesta no válida' }
  }

  const resultado = cuerpo.messages?.[0]
  if (!resultado) {
    console.error(`[sms] Acumbamail sin "messages" en la respuesta: ${tapa(texto).slice(0, 300)}`)
    return { sent: false, reason: 'Acumbamail: respuesta sin mensajes' }
  }

  if (resultado.status !== 0) {
    const motivo = tapa(resultado.error ?? `status ${resultado.status}`)
    console.error(`[sms] Acumbamail rechazó el envío a ${destino}: ${motivo}`)
    return { sent: false, reason: `Acumbamail: ${motivo}` }
  }

  const creditos = resultado.credits !== undefined ? ` · ${resultado.credits} créditos` : ''
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
