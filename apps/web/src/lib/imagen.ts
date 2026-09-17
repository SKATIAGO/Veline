/**
 * Deja lista para subir una foto hecha con el móvil.
 *
 * Una foto de móvil pesa 3-5 MB y mide 4000 px: subirla tal cual tarda con
 * cobertura normal, y se pinta en una miniatura de 112 px. Aquí se reduce a
 * 1000 px por el lado largo y se guarda en JPEG, que la deja en unos 100 KB
 * sin que se note en pantalla.
 *
 * El fondo se pinta de blanco antes de dibujar: un PNG con transparencia
 * pasado a JPEG saldría con el fondo negro.
 *
 * Devuelve la foto en base64, sin el prefijo «data:…».
 */
const LADO_MAXIMO = 1000

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

    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82))
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
