/**
 * Piezas sueltas de la carta de extras y de las fotos que se suben desde el
 * panel. Van aparte de las rutas para poder probarlas sin base de datos.
 */

/** Tope de una foto ya reducida. El navegador la deja en ~100 KB; esto es el
    margen para una foto con mucho detalle, no para una sin reducir. */
export const MAX_IMAGEN_BYTES = 600 * 1024

export type TipoImagen = 'image/jpeg' | 'image/png' | 'image/webp'

/**
 * El tipo de verdad, mirando los primeros bytes y no lo que diga quien sube.
 *
 * La foto se sirve después desde nuestro dominio: si se fiara del tipo que
 * anuncia la petición, alguien podría subir un HTML con cabecera de imagen y
 * tener una página suya colgando de veline.es.
 */
export function tipoDeImagen(datos: Uint8Array): TipoImagen | null {
  const empieza = (desde: number, ...bytes: number[]) =>
    bytes.every((b, i) => datos[desde + i] === b)
  if (datos.length < 12) return null
  if (empieza(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (empieza(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png'
  // «RIFF» … «WEBP»
  if (empieza(0, 0x52, 0x49, 0x46, 0x46) && empieza(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  return null
}

const PREFIJO_IMAGEN = '/api/imagenes/'

export const urlDeImagen = (id: string) => `${PREFIJO_IMAGEN}${id}`

/** El id de una foto nuestra, o null si la dirección no es de las nuestras. */
export function idDeImagen(url: string | null | undefined): string | null {
  if (!url?.startsWith(PREFIJO_IMAGEN)) return null
  const id = url.slice(PREFIJO_IMAGEN.length)
  return /^[a-z0-9]{10,40}$/.test(id) ? id : null
}

export interface ExtraConPrecio {
  id: string
  name: string
  priceCents: number
}

/**
 * Los extras que se van a guardar en la cita, a partir de los ids que pide
 * el cliente y de la carta que hay de verdad.
 *
 * Si falta alguno —se ha ocultado o borrado mientras reservaba— no se reserva
 * sin él en silencio: quien lo eligió cuenta con él y con lo que cuesta. Se
 * devuelve null y la ruta le pide que lo revise.
 */
export function elegirExtras<T extends ExtraConPrecio>(pedidos: string[], carta: T[]): T[] | null {
  const unicos = [...new Set(pedidos)]
  const elegidos = carta.filter((e) => unicos.includes(e.id))
  return elegidos.length === unicos.length ? elegidos : null
}

/** Lo que vale la cita: el servicio más lo elegido. */
export const totalConExtras = (servicioCents: number, extras: { priceCents: number }[]) =>
  servicioCents + extras.reduce((suma, e) => suma + e.priceCents, 0)
