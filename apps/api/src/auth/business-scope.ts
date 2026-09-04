import { prisma } from '../prisma.js'
import { canConfigureBusiness, canWorkAgenda } from './permissions.js'
import type { SessionUser } from './sessions.js'

/**
 * Carga el negocio del slug y comprueba el permiso pedido.
 *
 * Vive aparte de las rutas porque lo usan varios archivos: si cada uno se
 * hiciera su propia comprobación, tarde o temprano uno se olvidaría de mirar
 * el rol y abriría un negocio a quien no le toca.
 */

export interface BusinessScope {
  id: string
  slug: string
  name: string
  plan: string
  locationId: string | null
}

export type AuthorizeResult =
  { ok: true; business: BusinessScope } | { ok: false; status: number; error: string }

export async function authorizeBusiness(
  user: SessionUser,
  slug: string,
  nivel: 'agenda' | 'configuracion',
): Promise<AuthorizeResult> {
  const business = await prisma.business.findUnique({
    where: { slug },
    include: { locations: { take: 1, select: { id: true } } },
  })
  if (!business) return { ok: false, status: 404, error: 'Negocio no encontrado' }

  const permitido =
    nivel === 'agenda' ? canWorkAgenda(user, business.id) : canConfigureBusiness(user, business.id)
  if (!permitido) {
    return { ok: false, status: 403, error: 'No tienes acceso a este negocio' }
  }

  return {
    ok: true,
    business: {
      id: business.id,
      slug: business.slug,
      name: business.name,
      plan: business.plan,
      locationId: business.locations[0]?.id ?? null,
    },
  }
}

/**
 * Qué cambió de verdad entre dos versiones de una fila. Guardar el objeto
 * entero convierte el registro de auditoría en ruido: interesa "el precio pasó
 * de 25 € a 30 €", no las quince columnas que siguen igual.
 */
export function cambios<T extends Record<string, unknown>>(
  antes: T,
  despues: T,
  campos: (keyof T)[],
) {
  const diff: Record<string, { antes: unknown; despues: unknown }> = {}
  for (const campo of campos) {
    if (antes[campo] !== despues[campo]) {
      diff[String(campo)] = { antes: antes[campo], despues: despues[campo] }
    }
  }
  return diff
}
