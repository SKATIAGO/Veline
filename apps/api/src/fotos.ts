import { prisma } from './prisma.js'
import { idDeImagen } from './extras.js'

/**
 * Qué foto usa quién. Las fotos viven en su propia tabla y las referencian la
 * ficha del negocio, cada extra y cada servicio: soltar o barrer una foto sin
 * mirar a TODOS los que pueden usarla la borraría estando en uso.
 */

/** Una foto solo vale si es nuestra y de este negocio: si no, un negocio
    podría enseñar en su carta la foto que ha subido otro. */
export async function fotoDelNegocio(businessId: string, photo: string | null | undefined) {
  if (photo === undefined || photo === null) return true
  const id = idDeImagen(photo)
  if (!id) return false
  return (await prisma.imagen.count({ where: { id, businessId } })) === 1
}

/** Borra una foto que ya no usa nadie del negocio. */
export async function soltarFoto(businessId: string, url: string | null) {
  const id = idDeImagen(url)
  if (!id || !url) return
  const [enExtras, enServicios, enFicha] = await Promise.all([
    prisma.extra.count({ where: { businessId, photo: url } }),
    prisma.service.count({ where: { businessId, photo: url } }),
    prisma.business.count({ where: { id: businessId, photos: { has: url } } }),
  ])
  if (enExtras + enServicios + enFicha === 0) {
    await prisma.imagen.deleteMany({ where: { id, businessId } })
  }
}

/**
 * Fotos subidas hace más de un día que nadie llegó a guardar: se abrió el
 * formulario, se subió la foto y se canceló. Se barren al subir otra, que es
 * justo cuando podrían empezar a acumularse.
 */
export async function barrerFotosHuerfanas(businessId: string) {
  const [extras, servicios, negocio] = await Promise.all([
    prisma.extra.findMany({
      where: { businessId, photo: { not: null } },
      select: { photo: true },
    }),
    prisma.service.findMany({
      where: { businessId, photo: { not: null } },
      select: { photo: true },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { photos: true } }),
  ])
  const enUso = [
    ...extras.map((e) => e.photo),
    ...servicios.map((s) => s.photo),
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
