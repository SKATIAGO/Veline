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
  /** El primero. Sigue aquí para lo que no depende del local. */
  locationId: string | null
  /** Todos, por si hay que elegir. */
  locationIds: string[]
  /**
   * Los locales que puede ver QUIEN PREGUNTA. Un administrador, todos. Un
   * empleado, el de su ficha en Equipo; si su ficha dice que atiende en
   * todos (o no tiene ficha), todos.
   */
  localesVisibles: string[]
  /** Si puede mirar todos los locales a la vez, sin elegir uno. */
  verTodos: boolean
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
    // Todos, no solo el primero: con varios locales, cada pantalla del panel
    // trabaja sobre uno y hay que poder comprobar que el que piden es de este
    // negocio antes de tocar nada.
    include: { locations: { select: { id: true }, orderBy: { id: 'asc' } } },
  })
  if (!business) return { ok: false, status: 404, error: 'Negocio no encontrado' }

  const permitido =
    nivel === 'agenda' ? canWorkAgenda(user, business.id) : canConfigureBusiness(user, business.id)
  if (!permitido) {
    return { ok: false, status: 403, error: 'No tienes acceso a este negocio' }
  }

  const locationIds = business.locations.map((l) => l.id)

  /* El local de un empleado es el de su ficha de Equipo (la persona que
     atiende enlazada a su cuenta). Así, quien trabaja en un local ve las citas
     y los clientes de ese local, no los de todos. */
  let localPropio: string | null = null
  if (user.role === 'EMPLEADO' && locationIds.length > 1) {
    const ficha = await prisma.staff.findFirst({
      where: { userId: user.id, businessId: business.id },
      select: { locationId: true },
    })
    if (ficha?.locationId && locationIds.includes(ficha.locationId)) localPropio = ficha.locationId
  }

  return {
    ok: true,
    business: {
      id: business.id,
      slug: business.slug,
      name: business.name,
      plan: business.plan,
      locationId: locationIds[0] ?? null,
      locationIds,
      localesVisibles: localPropio ? [localPropio] : locationIds,
      verTodos: !localPropio,
    },
  }
}

/**
 * El local por el que filtrar lo que pide el panel (citas, clientes, resumen):
 *
 *  - el pedido, si quien pregunta lo puede ver;
 *  - sin pedir ninguno: el suyo si solo puede ver uno, o null (= todos);
 *  - false si pide uno que no puede ver o que no es de este negocio.
 */
export function localDeLaPeticion(b: BusinessScope, pedido?: string | null): string | null | false {
  if (pedido) return b.localesVisibles.includes(pedido) ? pedido : false
  if (!b.verTodos) return b.localesVisibles[0] ?? null
  return null
}

/**
 * Condición de Prisma para quedarse con las citas de un local. Las citas muy
 * antiguas no guardaban el local: cuentan como del primero, que es el que
 * existía entonces.
 */
export function citasDelLocal(b: BusinessScope, local: string | null) {
  if (!local) return {}
  return local === b.locationId
    ? { OR: [{ locationId: local }, { locationId: null }] }
    : { locationId: local }
}

/**
 * Sobre qué local trabaja una pantalla del panel.
 *
 * Con uno solo, ese — nadie tiene que elegir nada. Con varios, el que se pida;
 * y si no se pide ninguno, el primero, que es lo que ya hacía todo antes de
 * que existieran varios. Devuelve null si el id pedido no es de este negocio,
 * para no dejar que se toque el local de otro pasando su id.
 */
export function resolverLocalDelPanel(business: BusinessScope, pedido?: string): string | null {
  if (!pedido)
    return business.verTodos ? business.locationId : (business.localesVisibles[0] ?? null)
  return business.localesVisibles.includes(pedido) ? pedido : null
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
