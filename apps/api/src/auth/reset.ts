import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '../prisma.js'
import { hashPassword } from './passwords.js'

/**
 * Restablecimiento de contraseña por email.
 *
 * El enlace lleva un token aleatorio; la base guarda solo su hash, igual que
 * las sesiones. Caduca en una hora y sirve una sola vez.
 */

const RESET_HOURS = 1

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * Crea un token para el email dado. Devuelve null si no hay cuenta activa,
 * pero quien llame NO debe distinguir ese caso hacia fuera: responder
 * distinto revelaría qué emails están registrados.
 */
export async function createResetToken(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.active) return null

  // Un solo enlace vivo por persona: pedir otro invalida el anterior.
  await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } })

  const token = randomBytes(32).toString('base64url')
  await prisma.passwordReset.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_HOURS * 60 * 60 * 1000),
    },
  })
  return { token, user }
}

export type ResetOutcome =
  /** Devuelve a quién pertenecía el enlace: sin eso el registro de auditoría
      no puede decir de qué cuenta se cambió la contraseña. */
  | { ok: true; userId: string; email: string; name: string }
  | { ok: false; reason: 'invalido' | 'caducado' | 'usado' }

/**
 * Cambia la contraseña si el token es válido. Al hacerlo cierra todas las
 * sesiones abiertas de esa persona: si alguien había entrado con la
 * contraseña vieja, deja de estar dentro.
 */
export async function consumeResetToken(token: string, newPassword: string): Promise<ResetOutcome> {
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { email: true, name: true } } },
  })
  if (!reset) return { ok: false, reason: 'invalido' }
  if (reset.usedAt) return { ok: false, reason: 'usado' }
  if (reset.expiresAt < new Date()) return { ok: false, reason: 'caducado' }

  const passwordHash = await hashPassword(newPassword)

  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
  ])

  return { ok: true, userId: reset.userId, email: reset.user.email, name: reset.user.name }
}
