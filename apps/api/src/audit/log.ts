import type { FastifyRequest } from 'fastify'
import type { AuditAction, Prisma } from '@prisma/client'
import { prisma } from '../prisma.js'
import type { SessionUser } from '../auth/sessions.js'

/**
 * Registro de auditoría: quién hizo qué, cuándo y desde dónde.
 *
 * Dos reglas gobiernan este archivo:
 *
 *  1. **Registrar nunca puede tumbar la operación.** Si la base de datos falla
 *     al escribir el registro, la cita ya está cancelada y el usuario tiene
 *     que ver que se canceló. El error se queda en el log del servidor.
 *  2. **Nunca entra un secreto.** Las contraseñas y los tokens pasan por los
 *     mismos endpoints que se auditan; `redactar()` los quita antes de tocar
 *     la base, en vez de confiar en que quien llame se acuerde.
 */

/** Claves cuyo valor jamás se guarda, se llamen como se llamen alrededor. */
const SECRETAS = /(password|contrasena|contraseña|token|secret|apikey|api_key|hash|cookie)/i

/**
 * Poda el detalle antes de guardarlo. Sustituye los valores de claves
 * sensibles y recorta lo demás: el registro es para leerlo, no un volcado.
 */
function redactar(value: unknown, profundidad = 0): Prisma.InputJsonValue {
  if (value === null || value === undefined) return null as unknown as Prisma.InputJsonValue
  if (profundidad > 4) return '…'
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactar(v, profundidad + 1))
  if (typeof value === 'object') {
    const out: Record<string, Prisma.InputJsonValue> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRETAS.test(k) ? '[oculto]' : redactar(v, profundidad + 1)
    }
    return out
  }
  return String(value)
}

/**
 * La IP real del cliente. Fastify ya resuelve `X-Forwarded-For` porque el
 * servidor arranca con `trustProxy`: detrás de Caddy, `req.ip` sin eso sería
 * siempre la del propio proxy y el registro no diría nada.
 */
const ipDe = (req: FastifyRequest) => req.ip || null

const agenteDe = (req: FastifyRequest) => {
  const ua = req.headers['user-agent']
  return typeof ua === 'string' ? ua.slice(0, 300) : null
}

export interface AuditEntry {
  action: AuditAction
  summary: string
  /** Quién. Se copian email, nombre y rol para que el registro sobreviva al borrado del usuario. */
  actor?: SessionUser | null
  /** Cuando no hay sesión pero sí se conoce el email intentado (inicio de sesión fallido). */
  actorEmail?: string | null
  businessId?: string | null
  entity?: string | null
  entityId?: string | null
  metadata?: unknown
}

/**
 * Escribe una entrada. No se espera el resultado en quien llama: se dispara y
 * se olvida a propósito (ver regla 1 arriba).
 */
export function audit(req: FastifyRequest, entry: AuditEntry): void {
  const { actor } = entry

  void prisma.auditLog
    .create({
      data: {
        action: entry.action,
        summary: entry.summary,
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? entry.actorEmail ?? null,
        actorName: actor?.name ?? null,
        actorRole: actor?.role ?? null,
        businessId: entry.businessId ?? actor?.businessId ?? null,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata === undefined ? undefined : redactar(entry.metadata),
        ip: ipDe(req),
        userAgent: agenteDe(req),
      },
    })
    .catch((err) => {
      // No se propaga: la operación auditada ya ocurrió y es válida.
      req.log.error({ err, action: entry.action }, 'no se pudo escribir el registro de auditoría')
    })
}

/** Expuesto para las pruebas. */
export const _redactar = redactar
