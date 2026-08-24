import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { verifyPassword } from '../auth/passwords.js'
import { createSession, destroySession, getSessionUser } from '../auth/sessions.js'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
})

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
}
