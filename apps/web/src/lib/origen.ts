import type { BookingSource } from '@veline/shared'

/**
 * De dónde viene el cliente, y por qué importa.
 *
 * Cada cita dice si el cliente llegó por el marketplace o lo trajo el propio
 * negocio desde su Instagram, Google o web. Nació para cobrar la comisión del
 * 15 % solo por los clientes que traía Veline; la comisión se quitó el 19 oct
 * 2026, y el origen se queda porque al negocio le sirve saber de dónde vienen.
 *
 * La atribución va por enlace: el negocio comparte `/su-negocio?origen=instagram`
 * en su perfil, y ese origen viaja con la reserva. Es un dato que manda el
 * navegador, así que no es a prueba de manipulación; pero quien lo manipularía
 * sería el propio negocio, y solo se engañaría a sí mismo.
 */

const POR_PARAMETRO: Record<string, BookingSource> = {
  instagram: 'INSTAGRAM',
  ig: 'INSTAGRAM',
  google: 'GOOGLE',
  web: 'DIRECTO',
  directo: 'DIRECTO',
}

/** Se guarda por pestaña: el cliente entra por un enlace y reserva minutos después. */
const CLAVE = 'veline:origen'

export const ORIGEN_LABEL: Record<BookingSource, string> = {
  MARKETPLACE: 'Marketplace de Veline',
  DIRECTO: 'Tu web',
  INSTAGRAM: 'Instagram',
  GOOGLE: 'Google',
}

/** Lee `?origen=` y lo recuerda para el resto de la visita. */
export function recordarOrigen(search: string) {
  const valor = new URLSearchParams(search).get('origen')?.toLowerCase()
  if (!valor) return
  const origen = POR_PARAMETRO[valor]
  if (!origen) return
  try {
    sessionStorage.setItem(CLAVE, origen)
  } catch {
    // Navegación privada o almacenamiento bloqueado: se pierde la atribución
    // y la reserva contará como marketplace. Es preferible a romper la reserva.
  }
}

/** El origen recordado, o marketplace si el cliente llegó por su cuenta. */
export function origenActual(): BookingSource {
  try {
    const guardado = sessionStorage.getItem(CLAVE)
    if (guardado && guardado in ORIGEN_LABEL) return guardado as BookingSource
  } catch {
    /* igual que arriba */
  }
  return 'MARKETPLACE'
}

/** Los enlaces que el negocio comparte en cada sitio.
    Instagram y Google son nombres propios; «tu web» es lo único que se
    traduce, así que va como clave y lo pinta quien lo enseña. */
export function enlacesDeOrigen(base: string, slug: string) {
  return [
    {
      label: 'Instagram',
      clave: null,
      param: 'instagram',
      url: `${base}/${slug}?origen=instagram`,
    },
    { label: 'Google', clave: null, param: 'google', url: `${base}/${slug}?origen=google` },
    { label: null, clave: 'enl.tuWeb' as const, param: 'web', url: `${base}/${slug}?origen=web` },
  ]
}
