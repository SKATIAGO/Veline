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
  durationMin: number
}

/** Un extra de la carta con las veces que se ha pedido. */
export type ExtraElegido<T> = T & { quantity: number }

/**
 * Los extras que se van a guardar en la cita, a partir de lo que pide el
 * cliente y de la carta que hay de verdad.
 *
 * Si falta alguno —se ha ocultado o borrado mientras reservaba— no se reserva
 * sin él en silencio: quien lo eligió cuenta con él y con lo que cuesta. Se
 * devuelve null y la ruta le pide que lo revise.
 */
export function elegirExtras<T extends ExtraConPrecio>(
  pedidos: { extraId: string; quantity: number }[],
  carta: T[],
): ExtraElegido<T>[] | null {
  /* El mismo extra repetido en la misma petición es un cliente con un fallo.
     Se suman las cantidades, que es lo que quiso decir: ni cobrarlo dos veces
     como dos líneas ni tirar la reserva entera por un descuido suyo. */
  const porId = new Map<string, number>()
  for (const p of pedidos) porId.set(p.extraId, (porId.get(p.extraId) ?? 0) + p.quantity)

  const elegidos: ExtraElegido<T>[] = []
  for (const [extraId, quantity] of porId) {
    const enCarta = carta.find((e) => e.id === extraId)
    if (!enCarta) return null
    elegidos.push({ ...enCarta, quantity })
  }
  return elegidos
}

/** Lo que vale la cita: el servicio más lo elegido, por las veces que se pidió. */
export const totalConExtras = (
  servicioCents: number,
  extras: { priceCents: number; quantity: number }[],
) => servicioCents + extras.reduce((suma, e) => suma + e.priceCents * e.quantity, 0)

/**
 * Lo que dura la cita: el servicio más lo que alargue cada extra.
 *
 * Es la misma cuenta que el precio, pero esta decide si la cita CABE. De aquí
 * salen el hueco que se ofrece, la hora de fin y lo que se bloquea en la
 * agenda; si se olvidara en cualquiera de los tres sitios, dos citas seguidas
 * acabarían pisándose en el mundo real aunque en la pantalla se vieran bien.
 */
export const duracionConExtras = (
  servicioMin: number,
  extras: { durationMin: number; quantity: number }[],
) => servicioMin + extras.reduce((suma, e) => suma + e.durationMin * e.quantity, 0)
