import { formatLongDate, TIMEZONE, type Idioma } from '@veline/shared'

/**
 * Los SMS que le llegan al cliente.
 *
 * Viven aparte de las plantillas de correo porque son otra cosa: aquí no hay
 * HTML ni maquetación, hay un teléfono y un precio por tramo. La regla del
 * idioma es la misma que en el correo —lo elige quien llama, con
 * `idiomaParaCliente`— y por eso la función lo pide en vez de suponerlo.
 *
 * ── Por qué se quitan las tildes ──
 * Un SMS no se cobra por caracteres sino por tramos, y lo que cabe en un tramo
 * depende del alfabeto. Con el alfabeto GSM —el de toda la vida— caben 160.
 * Pero basta UNA letra que no esté en él para que el mensaje entero pase a
 * Unicode, y entonces caben 70. La «ó» de «Código» no está en GSM, ni la «á»,
 * la «í» o la «ú»: el recordatorio de un veterinario con nombre largo pasaba
 * de un tramo a tres por las tildes.
 *
 * Así que el texto sale en GSM: «á» → «a». La «é», la «ñ», la «ü», la «à» y los
 * signos «¿» y «¡» SÍ están en GSM y se quedan. Se lee igual —es como escribe
 * media España por SMS— y no depende de lo que haga el proveedor por su cuenta.
 */

const hora = (d: Date, idioma: Idioma) =>
  d.toLocaleTimeString(idioma === 'en' ? 'en-GB' : 'es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  })

/* Alfabeto GSM 03.38. El básico ocupa un septeto por carácter; los de la
   extensión ocupan dos (van precedidos de un escape). */
const GSM_BASICO = new Set([
  ...'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?',
  ...'¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
])
const GSM_EXTENSION = new Set([...'^{}\\[~]|€'])

/** Lo que no está en GSM pero tiene un equivalente que se lee igual. */
const EQUIVALENCIAS: Record<string, string> = {
  á: 'a',
  í: 'i',
  ó: 'o',
  ú: 'u',
  â: 'a',
  ê: 'e',
  î: 'i',
  ô: 'o',
  û: 'u',
  ã: 'a',
  õ: 'o',
  ë: 'e',
  ï: 'i',
  ç: 'c',
  Á: 'A',
  Í: 'I',
  Ó: 'O',
  Ú: 'U',
  À: 'A',
  È: 'E',
  Ì: 'I',
  Ò: 'O',
  Ù: 'U',
  Â: 'A',
  Ê: 'E',
  Î: 'I',
  Ô: 'O',
  Û: 'U',
  Ã: 'A',
  Õ: 'O',
  Ë: 'E',
  Ï: 'I',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '«': '"',
  '»': '"',
  '—': '-',
  '–': '-',
  '…': '...',
  º: 'o',
  ª: 'a',
  '\u00A0': ' ',
}

const esGsm = (c: string) => GSM_BASICO.has(c) || GSM_EXTENSION.has(c)

/** Pasa el texto al alfabeto GSM para que cada tramo sea de 160 y no de 70. */
export function aGsm7(texto: string): string {
  let out = ''
  for (const c of texto) {
    if (esGsm(c)) out += c
    else if (EQUIVALENCIAS[c] !== undefined) out += EQUIVALENCIAS[c]
    else {
      // Cualquier otra letra con adorno se queda sin él. Lo que aun así no
      // cabe en GSM —un emoji en el nombre de un negocio— pasa a «?»: mejor
      // eso que un solo carácter doblando el precio del mensaje.
      const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      out += [...base].every(esGsm) ? base : '?'
    }
  }
  return out
}

/** En cuántos tramos se cobra un texto: 160/153 en GSM, 70/67 en Unicode. */
export function tramosSms(texto: string): number {
  const chars = [...texto]
  if (chars.every(esGsm)) {
    const septetos = chars.reduce((n, c) => n + (GSM_EXTENSION.has(c) ? 2 : 1), 0)
    return septetos <= 160 ? 1 : Math.ceil(septetos / 153)
  }
  return texto.length <= 70 ? 1 : Math.ceil(texto.length / 67)
}

const cuando = (d: Date, idioma: Idioma) => `${formatLongDate(d, idioma)} a las ${hora(d, idioma)}`

export interface SmsRecordatorio {
  idioma: Idioma
  startsAt: Date
  businessName: string
  serviceName: string
  code: string
}

/** «Recordatorio: martes 15 de septiembre a las 09:00 tienes cita en …». */
export function smsRecordatorio(r: SmsRecordatorio): string {
  return aGsm7(
    `Recordatorio: ${cuando(r.startsAt, r.idioma)} tienes cita en ${r.businessName} (${r.serviceName}). Código ${r.code}.`,
  )
}

export interface SmsConfirmacion {
  idioma: Idioma
  startsAt: Date
  businessName: string
  code: string
  /** La web sin «https://»: ocupa menos y los móviles la enlazan igual. */
  web: string
}

/**
 * «Reserva confirmada en X: martes 15 de septiembre a las 09:00. Ver o
 * cancelar: veline.es/reserva/VL-…».
 *
 * Lleva el enlace para cancelar y no el servicio: el enlace ya tiene todos los
 * detalles, y poder cancelar desde el propio SMS es lo que evita que alguien
 * simplemente no aparezca. Con los dos no cabía en un tramo.
 */
export function smsConfirmacion(c: SmsConfirmacion): string {
  return aGsm7(
    `Reserva confirmada en ${c.businessName}: ${cuando(c.startsAt, c.idioma)}. Ver o cancelar: ${c.web}/reserva/${c.code}`,
  )
}
