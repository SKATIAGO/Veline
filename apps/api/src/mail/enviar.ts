import { sendMailAcumbamail } from './acumbamail.js'
import { sendMailBrevo } from './brevo.js'
import { frenos, readMailConfig, type MailMessage, type MailResult } from './tipos.js'

/**
 * La única puerta de salida del correo.
 *
 * Todo el producto llama aquí; quién lo manda de verdad lo decide
 * `MAIL_PROVIDER`. Cambiar de proveedor es una variable de entorno, no tocar
 * cinco archivos — y eso importa porque los dos no hacen lo mismo:
 *
 *   | Campo              | Brevo | Acumbamail |
 *   |--------------------|-------|------------|
 *   | HTML               | sí    | sí         |
 *   | Texto plano        | sí    | NO         |
 *   | Reply-To           | sí    | NO         |
 *   | Nombre de remitente| sí    | NO         |
 *
 * Con Acumbamail, responder a un correo de Veline escribe al remitente y no
 * al buzón de contacto ni al cliente. Está asumido y documentado en
 * docs/08-correo.md; si un día molesta, se vuelve con MAIL_PROVIDER=brevo.
 */

export type { MailMessage, MailMode, MailResult } from './tipos.js'

export const mailMode = () => readMailConfig().mode
export const mailProvider = () => readMailConfig().provider

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const cfg = readMailConfig()

  const paso = frenos(message, cfg)
  if ('corte' in paso) return paso.corte

  return cfg.provider === 'brevo'
    ? sendMailBrevo(message, cfg, paso.destinatario, paso.asunto)
    : sendMailAcumbamail(message, cfg, paso.destinatario, paso.asunto)
}

/**
 * Envía sin propagar errores. El correo es un efecto secundario de la
 * reserva: si el proveedor falla, la cita ya está hecha y no se puede tumbar
 * la petición por eso.
 */
export async function sendMailSafely(message: MailMessage): Promise<void> {
  try {
    await sendMail(message)
  } catch (err) {
    console.error('[mail] error inesperado:', (err as Error).message)
  }
}

/**
 * Aviso al arrancar. El correo apagado es un fallo silencioso: las reservas se
 * confirman igual y nadie nota que los avisos no salen, hasta que un cliente
 * se queja.
 */
export function describeMailConfig(): string {
  const cfg = readMailConfig()
  const quien = cfg.provider === 'brevo' ? 'Brevo' : 'Acumbamail'

  if (cfg.mode === 'off') return 'correo DESACTIVADO (MAIL_MODE=off): no se envía nada'
  if (cfg.mode === 'dry')
    return `correo en PRUEBA (MAIL_MODE=dry, ${quien}): se registra pero NO se envía`

  const falta =
    cfg.provider === 'brevo'
      ? !process.env.BREVO_API_KEY && 'BREVO_API_KEY'
      : !process.env.ACUMBAMAIL_TOKEN && 'ACUMBAMAIL_TOKEN'
  if (falta) return `correo en modo live por ${quien} pero SIN ${falta}: no se enviará nada`
  if (!cfg.fromEmail) return `correo en modo live pero SIN MAIL_FROM_EMAIL: no se enviará nada`

  const destino = cfg.overrideTo ? ` — TODO redirigido a ${cfg.overrideTo}` : ''
  return `correo ACTIVO por ${quien} desde ${cfg.fromEmail}${destino}`
}
