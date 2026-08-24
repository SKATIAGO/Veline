import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { canConfigureBusiness, canManagePlatform } from '../auth/permissions.js'
import { requireUser } from '../auth/sessions.js'

/**
 * Lectura del registro de auditoría. Solo lectura: no hay forma de editarlo
 * ni de borrarlo desde la API, porque un registro que el propio sistema puede
 * reescribir no sirve para lo único que existe.
 *
 * Alcance:
 *   - SUPERADMIN → todo, y puede filtrar por negocio.
 *   - ADMIN      → solo lo de su negocio.
 *   - EMPLEADO   → nada. Ver quién desactivó a quién o qué IP entró no es
 *                  parte de trabajar la agenda.
 */

const query = z.object({
  /** Solo lo tiene en cuenta el superadmin; a un admin se le fuerza el suyo. */
  businessId: z.string().optional(),
  action: z.string().optional(),
  /** Paginación por cursor: el id de la última fila de la página anterior. */
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/audit', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return

    const parsed = query.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: 'Filtros inválidos' })
    const { action, cursor, limit } = parsed.data

    const where: Prisma.AuditLogWhereInput = {}

    if (canManagePlatform(user)) {
      if (parsed.data.businessId) where.businessId = parsed.data.businessId
    } else if (user.businessId && canConfigureBusiness(user, user.businessId)) {
      // Se ignora el businessId que venga en la petición: el alcance lo fija
      // la sesión, no el cliente.
      where.businessId = user.businessId
    } else {
      return reply.code(403).send({ error: 'No tienes acceso al registro de actividad' })
    }

    if (action) where.action = action as Prisma.AuditLogWhereInput['action']

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // Se pide uno de más para saber si hay página siguiente sin contar todo.
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { business: { select: { slug: true, name: true } } },
    })

    const hayMas = rows.length > limit
    const pagina = hayMas ? rows.slice(0, limit) : rows

    return {
      entries: pagina.map((r) => ({
        id: r.id,
        action: r.action,
        summary: r.summary,
        actorName: r.actorName,
        actorEmail: r.actorEmail,
        actorRole: r.actorRole,
        business: r.business,
        entity: r.entity,
        entityId: r.entityId,
        metadata: r.metadata,
        // La IP solo la ve el superadmin: para un admin de negocio es un dato
        // personal de su equipo que no necesita para nada.
        ip: canManagePlatform(user) ? r.ip : null,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: hayMas ? pagina[pagina.length - 1]!.id : null,
    }
  })
}
