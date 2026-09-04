import { CONTACT_EMAIL } from '@veline/shared'
import type { MailConfig, MailMessage, MailResult } from './tipos.js'

/**
 * Transporte de Brevo.
 *
 * Ya no es la puerta de salida del correo —eso es `enviar.ts`—, sino uno de
 * los dos transportes. Se conserva porque es el único que admite Reply-To,
 * versión en texto plano y nombre de remitente: si algún día pesa perderlos,
 * volver es poner MAIL_PROVIDER=brevo.
 *
 * Los frenos (off/dry/live, redirección de destinatarios, descarte de
 * direcciones no entregables) se aplican antes de llegar aquí.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export async function sendMailBrevo(
  message: MailMessage,
  cfg: MailConfig,
  destinatario: string,
  asunto: string,
): Promise<MailResult> {
  const apiKey = process.env.BREVO_API_KEY ?? ''
  if (!apiKey) return { sent: false, reason: 'falta BREVO_API_KEY' }

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: cfg.fromEmail, name: cfg.fromName },
      to: [{ email: destinatario, ...(message.toName ? { name: message.toName } : {}) }],
      subject: asunto,
      htmlContent: message.html,
      textContent: message.text,
      // Sin Reply-To, responder a un correo de Veline escribe al remitente
      // técnico. El buzón de contacto es el destino correcto salvo que la
      // plantilla diga otro (el aviso al negocio responde al cliente).
      replyTo: message.replyTo ?? { email: CONTACT_EMAIL, name: 'Veline' },
      ...(message.tag ? { tags: [message.tag] } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`[mail] Brevo ${res.status}: ${detail.slice(0, 300)}`)
    return { sent: false, reason: `Brevo ${res.status}` }
  }

  const body = (await res.json().catch(() => ({}))) as { messageId?: string }
  console.log(`[mail] enviado a ${destinatario} · ${asunto}`)
  return { sent: true, messageId: body.messageId }
}
