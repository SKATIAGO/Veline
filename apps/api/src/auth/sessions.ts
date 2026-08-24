import { createHash, randomBytes } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Role } from '@prisma/client'
import { prisma } from '../prisma.js'

/**
 * Sesiones de panel con cookie httpOnly.
 *
 * El navegador guarda un token aleatorio; la base de datos guarda su hash
 * SHA-256. Así, quien lograra leer la tabla de sesiones no puede suplantar a
 * nadie: del hash no se recupera el token.
 *
 * httpOnly + SameSite=Lax: el JavaScript de la página no puede leer la cookie
 * (roba-sesiones vía XSS) y otros sitios no pueden disparar peticiones
 * autenticadas de modificación (CSRF básico).
 */

export const SESSION_COOKIE = 'veline_session'
const SESSION_DAYS = 14

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  businessId: string | null
  businessSlug: string | null
  businessName: string | null
}

export async function createSession(reply: FastifyReply, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } })

  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE]
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  reply.clearCookie(SESSION_COOKIE, { path: '/' })
}

/** Devuelve el usuario de la sesión, o null si no hay sesión válida. */
export async function getSessionUser(req: FastifyRequest): Promise<SessionUser | null> {
  const token = req.cookies[SESSION_COOKIE]
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { include: { business: { select: { slug: true, name: true } } } },
    },
  })
  if (!session) return null

  if (session.expiresAt < new Date()) {
    // Caducada: se borra para que la tabla no acumule sesiones muertas.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (!session.user.active) return null

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    businessId: session.user.businessId,
    businessSlug: session.user.business?.slug ?? null,
    businessName: session.user.business?.name ?? null,
  }
}

/** Exige sesión. Devuelve el usuario o responde 401 y devuelve null. */
export async function requireUser(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<SessionUser | null> {
  const user = await getSessionUser(req)
  if (!user) {
    reply.code(401).send({ error: 'Inicia sesión para continuar' })
    return null
  }
  return user
}
