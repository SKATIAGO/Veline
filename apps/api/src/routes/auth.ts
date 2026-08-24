import { createHash } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { hashPassword, verifyPassword } from '../auth/passwords.js'
import { consumeResetToken, createResetToken } from '../auth/reset.js'
import {
  createSession,
  destroySession,
  getSessionUser,
  requireUser,
  SESSION_COOKIE,
} from '../auth/sessions.js'
import { mailMode, sendMail } from '../mail/brevo.js'
import { passwordResetMail } from '../mail/templates.js'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
})

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() })

/** Mínimo 10 caracteres: es lo que exige también el alta de usuarios. */
const nuevaContrasena = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(200)

const resetSchema = z.object({ token: z.string().min(10), password: nuevaContrasena })

const changeSchema = z.object({
  current: z.string().min(1).max(200),
  next: nuevaContrasena,
})

const webUrl = () => (process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '')

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/api/auth/login',
    {
      // Mucho más estricto que el límite general: el login es el endpoint
      // que un atacante martillea. 5 intentos por minuto y por IP.
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Email o contraseña con formato inválido' })
      }

      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })

      // El mismo mensaje exista o no el usuario: no se confirma qué emails
      // tienen cuenta. Y se verifica el hash igualmente para que el tiempo de
      // respuesta no delate la diferencia.
      const hash = user?.passwordHash ?? 'sin:usuario'
      const ok = await verifyPassword(parsed.data.password, hash)

      if (!user || !user.active || !ok) {
        return reply.code(401).send({ error: 'Email o contraseña incorrectos' })
      }

      await createSession(reply, user.id)
      const conNegocio = user.businessId
        ? await prisma.business.findUnique({
            where: { id: user.businessId },
            select: { slug: true, name: true },
          })
        : null

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessSlug: conNegocio?.slug ?? null,
          businessName: conNegocio?.name ?? null,
        },
      }
    },
  )

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(req, reply)
    return { ok: true }
  })

  app.get('/api/auth/me', async (req, reply) => {
    const user = await getSessionUser(req)
    if (!user) return reply.code(401).send({ error: 'Sin sesión' })
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessSlug: user.businessSlug,
        businessName: user.businessName,
      },
    }
  })

  /**
   * Pedir un enlace de restablecimiento.
   *
   * Responde siempre lo mismo, exista o no la cuenta: si dijera "ese email no
   * está registrado" se convertiría en una forma de averiguar qué direcciones
   * tienen cuenta.
   */
  app.post(
    '/api/auth/forgot',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req) => {
      const parsed = forgotSchema.safeParse(req.body)
      // Incluso con un email mal formado se responde igual.
      if (!parsed.success) return { ok: true }

      const creado = await createResetToken(parsed.data.email)
      if (creado) {
        const url = `${webUrl()}/restablecer?token=${encodeURIComponent(creado.token)}`
        const resultado = await sendMail(
          passwordResetMail({ email: creado.user.email, name: creado.user.name }, url),
        ).catch((err) => {
          app.log.error({ err }, 'fallo enviando el correo de restablecimiento')
          return { sent: false, reason: 'excepción' }
        })

        // Si el correo no sale, el restablecimiento no le llega a nadie y la
        // persona se queda esperando. No se puede fallar en silencio.
        if (!resultado.sent) {
          app.log.warn(
            { email: creado.user.email, motivo: resultado.reason, modo: mailMode() },
            'NO se ha enviado el correo de restablecimiento',
          )
        }
      }

      return { ok: true }
    },
  )

  /** Elegir contraseña nueva con el token del email. */
  app.post(
    '/api/auth/reset',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = resetSchema.safeParse(req.body)
      if (!parsed.success) {
        const msg = parsed.error.issues.find((i) => i.path[0] === 'password')?.message
        return reply.code(400).send({ error: msg ?? 'Datos inválidos' })
      }

      const r = await consumeResetToken(parsed.data.token, parsed.data.password)
      if (!r.ok) {
        const mensajes = {
          invalido: 'Este enlace no es válido.',
          caducado: 'Este enlace ha caducado. Pide uno nuevo.',
          usado: 'Este enlace ya se ha usado. Pide uno nuevo.',
        }
        return reply.code(400).send({ error: mensajes[r.reason] })
      }
      return { ok: true }
    },
  )

  /** Cambiar la contraseña estando dentro. */
  app.post('/api/auth/password', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return

    const parsed = changeSchema.safeParse(req.body)
    if (!parsed.success) {
      const msg = parsed.error.issues.find((i) => i.path[0] === 'next')?.message
      return reply.code(400).send({ error: msg ?? 'Datos inválidos' })
    }

    const fila = await prisma.user.findUnique({ where: { id: user.id } })
    if (!fila || !(await verifyPassword(parsed.data.current, fila.passwordHash))) {
      return reply.code(400).send({ error: 'La contraseña actual no es correcta' })
    }

    const passwordHash = await hashPassword(parsed.data.next)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    // Se cierran las demás sesiones y se conserva la actual: cambiar la
    // contraseña debe echar a quien la tuviera, no a uno mismo.
    const actual = req.cookies[SESSION_COOKIE]
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        ...(actual
          ? { NOT: { tokenHash: createHash('sha256').update(actual).digest('hex') } }
          : {}),
      },
    })

    return { ok: true }
  })
}
