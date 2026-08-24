import type { Role } from '@prisma/client'

/**
 * Reglas de permisos, como lógica pura para poder probarlas.
 *
 * La jerarquía:
 *  - SUPERADMIN  → plataforma entera: cualquier negocio y su gestión.
 *  - ADMIN       → su negocio completo, incluidos servicios, horario y usuarios.
 *  - EMPLEADO    → la agenda de su negocio: ver y cancelar citas. Nada de
 *                  configuración: ni servicios, ni horario, ni usuarios.
 */

export interface Actor {
  role: Role
  businessId: string | null
}

/** Gestión de la plataforma: crear negocios, crear administradores, ver todo. */
export const canManagePlatform = (a: Actor) => a.role === 'SUPERADMIN'

/** ¿Puede siquiera ver este negocio en el panel? */
export const canAccessBusiness = (a: Actor, businessId: string) =>
  a.role === 'SUPERADMIN' || a.businessId === businessId

/** Configuración del negocio: servicios, horario, datos, usuarios propios. */
export const canConfigureBusiness = (a: Actor, businessId: string) =>
  a.role === 'SUPERADMIN' || (a.role === 'ADMIN' && a.businessId === businessId)

/** Agenda del negocio: ver citas y cancelarlas. Todos los roles con acceso. */
export const canWorkAgenda = (a: Actor, businessId: string) => canAccessBusiness(a, businessId)
