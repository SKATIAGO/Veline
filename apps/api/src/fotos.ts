import { prisma } from './prisma.js'
import { idDeImagen } from './extras.js'

/**
 * Qué foto usa quién. Las fotos viven en su propia tabla y las referencian la
 * ficha del negocio, cada extra y cada servicio: soltar o barrer una foto sin
 * mirar a TODOS los que pueden usarla la borraría estando en uso.
 */

/** Todas las fotos valen solo si son nuestras y de este negocio: si no, un
    negocio podría enseñar en su carta la foto que ha subido otro. */
export async function fotosDelNegocio(businessId: string, fotos: string[] | undefined) {
  if (!fotos || fotos.length === 0) return true
  const ids = fotos.map(idDeImagen)
  if (ids.some((id) => id === null)) return false
  return (
    (await prisma.imagen.count({ where: { id: { in: ids as string[] }, businessId } })) ===
    ids.length
  )
}

/** Quita las repetidas, conservando el orden: la primera es la principal. */
export const sinRepetidas = (fotos: string[]) => [...new Set(fotos)]

/** Borra las fotos que ya no usa nadie del negocio. */
export async function soltarFotos(businessId: string, urls: string[]) {
  for (const url of urls) {
    const id = idDeImagen(url)
    if (!id) continue
    const [enExtras, enServicios, enFicha] = await Promise.all([
      prisma.extra.count({ where: { businessId, photos: { has: url } } }),
      prisma.service.count({ where: { businessId, photos: { has: url } } }),
      prisma.business.count({ where: { id: businessId, photos: { has: url } } }),
    ])
    if (enExtras + enServicios + enFicha === 0) {
      await prisma.imagen.deleteMany({ where: { id, businessId } })
    }
  }
}

/** Las que estaban y ya no están, para soltarlas tras guardar. */
export const quitadas = (antes: string[], despues: string[]) =>
  antes.filter((u) => !despues.includes(u))

/**
 * Fotos subidas hace más de un día que nadie llegó a guardar: se abrió el
 * formulario, se subió la foto y se canceló. Se barren al subir otra, que es
 * justo cuando podrían empezar a acumularse.
 */
export async function barrerFotosHuerfanas(businessId: string) {
  const [extras, servicios, negocio] = await Promise.all([
    prisma.extra.findMany({ where: { businessId }, select: { photos: true } }),
    prisma.service.findMany({ where: { businessId }, select: { photos: true } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { photos: true } }),
  ])
  const enUso = [
    ...extras.flatMap((e) => e.photos),
    ...servicios.flatMap((s) => s.photos),
    ...(negocio?.photos ?? []),
  ]
    .map(idDeImagen)
    .filter((id): id is string => id !== null)
  await prisma.imagen.deleteMany({
    where: {
      businessId,
      createdAt: { lt: new Date(Date.now() - 86_400_000) },
      id: { notIn: enUso },
    },
  })
}
