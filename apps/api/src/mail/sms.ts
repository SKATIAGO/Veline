import { formatLongDate, TIMEZONE, type Idioma } from '@veline/shared'

/**
 * Los SMS que le llegan al cliente.
 *
 * Viven aparte de las plantillas de correo porque son otra cosa: aquí no hay
 * HTML ni maquetación, hay 160 caracteres y un teléfono. Pero la regla del
 * idioma es la misma —lo elige quien llama, con `idiomaParaCliente`— y por eso
 * la función lo pide en vez de darlo por supuesto.
 *
 * Un SMS se cobra por tramos de 160 caracteres: pasarse de ahí lo cobra doble
 * sin avisar, así que el texto se mantiene corto a propósito.
 */

const hora = (d: Date, idioma: Idioma) =>
  d.toLocaleTimeString(idioma === 'en' ? 'en-GB' : 'es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  })

export interface SmsRecordatorio {
  idioma: Idioma
  startsAt: Date
  businessName: string
  serviceName: string
  code: string
}

/** «Recordatorio: mañana 16 de septiembre a las 09:00 tienes cita en …». */
export function smsRecordatorio(r: SmsRecordatorio): string {
  const cuando = `${formatLongDate(r.startsAt, r.idioma)} a las ${hora(r.startsAt, r.idioma)}`
  return `Recordatorio: ${cuando} tienes cita en ${r.businessName} (${r.serviceName}). Código ${r.code}.`
}
