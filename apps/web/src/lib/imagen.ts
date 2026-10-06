/**
 * Deja lista para subir una foto hecha con el móvil.
 *
 * Una foto de móvil pesa 3-5 MB y mide 4000 px: subirla tal cual tarda con
 * cobertura normal. Aquí se reduce a 1600 px por el lado largo y se guarda en
 * JPEG, que la deja en unos 200-400 KB. Antes eran 1000 px: bastaban para una
 * miniatura, pero al ampliarla en el visor se veía borrosa, y en belleza o
 * estética el detalle (un degradado, una uña) es justo lo que se mira.
 *
 * Si con la calidad normal se pasa del tope del servidor, se va bajando la
 * calidad antes de rendirse: una foto con mucho detalle (pelo, tejidos) pesa
 * más que una lisa.
 *
 * El fondo se pinta de blanco antes de dibujar: un PNG con transparencia
 * pasado a JPEG saldría con el fondo negro.
 *
 * Devuelve la foto en base64, sin el prefijo «data:…».
 */
const LADO_MAXIMO = 1600

/** Un poco por debajo del tope del servidor (1 MB): el base64 lo agranda. */
const PESO_MAXIMO = 900 * 1024
const CALIDADES = [0.86, 0.8, 0.72, 0.64]

export async function prepararFoto(archivo: File): Promise<string> {
  // Algunos móviles no dicen el tipo: se deja intentar y, si no es una foto,
  // falla al leerla.
  if (archivo.type && !archivo.type.startsWith('image/')) throw new Error('no-es-imagen')

  const bitmap = await createImageBitmap(archivo)
  try {
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
    const ancho = Math.max(1, Math.round(bitmap.width * escala))
    const alto = Math.max(1, Math.round(bitmap.height * escala))

    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('sin-lienzo')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(bitmap, 0, 0, ancho, alto)

    let blob: Blob | null = null
    for (const calidad of CALIDADES) {
      blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad))
      if (!blob || blob.size <= PESO_MAXIMO) break
    }
    if (!blob) throw new Error('sin-foto')

    const dataUrl = await new Promise<string>((ok, mal) => {
      const lector = new FileReader()
      lector.onload = () => ok(String(lector.result))
      lector.onerror = () => mal(lector.error)
      lector.readAsDataURL(blob)
    })
    return dataUrl.slice(dataUrl.indexOf(',') + 1)
  } finally {
    bitmap.close()
  }
}
