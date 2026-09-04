import type { BookingSource } from '@veline/shared'

/**
 * De dónde viene el cliente, y por qué importa.
 *
 * La comisión del 15 % solo se cobra la primera vez que un cliente NUEVO
 * descubre un negocio a través del marketplace. Si el negocio lo trajo de su
 * Instagram, de Google o de su propia web, es suyo y no se cobra nada.
 *
 * Hasta ahora eso era imposible de cumplir: toda reserva se marcaba como
 * marketplace, así que se habría cobrado comisión de clientes que traía el
 * propio negocio — justo lo contrario de lo que promete la página de precios.
 *
 * La atribución va por enlace: el negocio comparte `/su-negocio?origen=instagram`
 * en su perfil, y ese origen viaja con la reserva. Es un dato que manda el
 * navegador, así que no es a prueba de manipulación; pero quien lo manipularía
 * sería el propio negocio para pagar menos, y eso se ve en sus números.
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

/** Los enlaces que el negocio comparte en cada sitio. */
export function enlacesDeOrigen(base: string, slug: string) {
  return [
    { label: 'Instagram', param: 'instagram', url: `${base}/${slug}?origen=instagram` },
    { label: 'Google', param: 'google', url: `${base}/${slug}?origen=google` },
    { label: 'Tu web', param: 'web', url: `${base}/${slug}?origen=web` },
  ]
}
