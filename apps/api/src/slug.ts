import { prisma } from './prisma.js'

/**
 * El identificador que va en la dirección de la ficha: /peluqueria-lola.
 *
 * Vive aquí y no dentro de una ruta porque lo usan dos altas distintas —la
 * que hacemos nosotros desde el panel y la que hace el negocio por su cuenta—
 * y dos copias de esto acabarían generando direcciones con reglas distintas.
 */
export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/**
 * El mismo identificador, garantizado libre. Si «taller-rivas» ya existe
 * devuelve «taller-rivas-2», y así.
 *
 * Devuelve null cuando el nombre no da ninguna letra aprovechable (por
 * ejemplo, si son solo símbolos): quien llame decide qué contarle al usuario.
 */
export async function slugLibre(nombre: string): Promise<string | null> {
  const base = slugify(nombre)
  if (!base) return null

  let slug = base
  for (let i = 2; await prisma.business.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`
  }
  return slug
}
