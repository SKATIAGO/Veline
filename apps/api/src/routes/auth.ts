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
import { audit } from '../audit/log.js'
import { mailMode, sendMail } from '../mail/enviar.js'
import { passwordResetMail, signupVerifyMail } from '../mail/templates.js'
import { consumirVerificacion, crearAlta } from '../auth/alta.js'
import { CATEGORIES, phoneES } from '@veline/shared'

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

const altaSchema = z.object({
  negocio: z.string().trim().min(2, 'Escribe el nombre del negocio').max(120),
  categoria: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]]),
  email: z.string().trim().toLowerCase().email('Revisa el email'),
  telefono: phoneES.optional().or(z.literal('')),
  calle: z.string().trim().min(3, 'Falta la calle').max(160),
  ciudad: z.string().trim().min(2, 'Falta la ciudad').max(80),
  codigoPostal: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal son 5 cifras'),
  responsable: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  password: nuevaContrasena,
})

const verificarSchema = z.object({ token: z.string().min(10) })

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
        // Se registran también los fallos: una ráfaga de intentos contra la
        // misma cuenta es justo lo que hay que poder ver después.
        audit(req, {
          action: 'SESION_FALLIDA',
          summary: `Intento de acceso fallido con ${parsed.data.email}`,
          actorEmail: parsed.data.email,
          businessId: user?.businessId ?? null,
          entity: 'User',
          entityId: user?.id ?? null,
          metadata: {
            motivo: !user
              ? 'email desconocido'
              : !user.active
                ? 'cuenta desactivada'
                : 'contraseña incorrecta',
          },
        })
        return reply.code(401).send({ error: 'Email o contraseña incorrectos' })
      }

      /* Sin confirmar el correo no se entra. Aquí SÍ se dice el motivo, al
         contrario que arriba: quien llega hasta aquí ya ha acertado la
         contraseña, así que no se le revela nada que no supiera, y dejarle
         con un «email o contraseña incorrectos» sería mentirle sobre por qué
         no puede pasar. */
      if (!user.emailVerifiedAt) {
        return reply.code(403).send({
          error: 'Falta confirmar tu correo. Mira el enlace que te enviamos al darte de alta.',
          code: 'email-sin-verificar',
        })
      }

      await createSession(reply, user.id)
      const conNegocio = user.businessId
        ? await prisma.business.findUnique({
            where: { id: user.businessId },
            select: { slug: true, name: true },
          })
        : null

      const sesion = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
        businessSlug: conNegocio?.slug ?? null,
        businessName: conNegocio?.name ?? null,
      }

      audit(req, { action: 'SESION_INICIADA', summary: 'Ha iniciado sesión', actor: sesion })

      const { businessId: _omitido, ...publico } = sesion
      return { user: publico }
    },
  )

  app.post('/api/auth/logout', async (req, reply) => {
    // Se lee antes de destruirla: después ya no hay de quién decir que salió.
    const user = await getSessionUser(req)
    await destroySession(req, reply)
    if (user) audit(req, { action: 'SESION_CERRADA', summary: 'Ha cerrado sesión', actor: user })
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
        audit(req, {
          action: 'CONTRASENA_OLVIDADA',
          summary: `Se ha pedido restablecer la contraseña de ${creado.user.email}`,
          actorEmail: creado.user.email,
          entity: 'User',
          entityId: creado.user.id,
        })
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

      audit(req, {
        action: 'CONTRASENA_RESTABLECIDA',
        summary: `${r.name} ha restablecido su contraseña desde el enlace del correo`,
        actorEmail: r.email,
        entity: 'User',
        entityId: r.userId,
      })
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

    audit(req, {
      action: 'CONTRASENA_CAMBIADA',
      summary: 'Ha cambiado su contraseña desde el panel',
      actor: user,
      entity: 'User',
      entityId: user.id,
    })

    return { ok: true }
  })

  /* ── Alta por su cuenta ──────────────────────────────────────
     Sale del formulario público de /alta. Crea el negocio SIN aprobar y la
     cuenta SIN verificar: hasta que no confirme el correo no entra, y hasta
     que no lo revisemos no sale en el marketplace. */
  app.post(
    '/api/auth/signup',
    {
      // Crear cuentas es caro de deshacer: un bot podría llenar la base de
      // negocios inventados en un minuto.
      config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
    },
    async (req, reply) => {
      const parsed = altaSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
      }

      const alta = await crearAlta(parsed.data)
      if (!alta.ok) {
        return reply.code(409).send({
          error:
            alta.motivo === 'email-ocupado'
              ? 'Ya hay una cuenta con ese email. Si es tuya, entra o pide una contraseña nueva.'
              : 'Ese nombre no genera una dirección válida. Prueba con otro.',
        })
      }

      const url = `${webUrl()}/verificar?token=${encodeURIComponent(alta.token)}`
      const correo = await sendMail(
        signupVerifyMail(
          { email: parsed.data.email, name: parsed.data.responsable },
          { businessName: parsed.data.negocio, url },
        ),
      ).catch((err) => ({ sent: false as const, reason: (err as Error).message }))

      audit(req, {
        action: 'NEGOCIO_CREADO',
        summary: `«${parsed.data.negocio}» se ha dado de alta desde la web`,
        businessId: alta.businessId,
        entity: 'Business',
        entityId: alta.businessId,
        metadata: { slug: alta.slug, categoria: parsed.data.categoria, ciudad: parsed.data.ciudad },
      })

      /* Si el correo no sale, el alta ya está hecha: no se puede deshacer sin
         perder lo que la persona acaba de escribir. Se avisa para que la
         pantalla pueda decir la verdad en vez de mandarla a mirar un buzón
         donde no va a haber nada. */
      return reply.code(201).send({ ok: true, correoEnviado: correo.sent })
    },
  )

  /** Confirma el correo con el token del enlace. */
  app.post('/api/auth/verify', async (req, reply) => {
    const parsed = verificarSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Enlace inválido' })

    const r = await consumirVerificacion(parsed.data.token)
    if (!r.ok) {
      const mensajes = {
        invalido: 'Este enlace no es válido.',
        caducado: 'Este enlace ha caducado. Escríbenos y te mandamos otro.',
        usado: 'Este correo ya estaba confirmado. Puedes entrar con tu contraseña.',
      }
      return reply.code(400).send({ error: mensajes[r.motivo], code: r.motivo })
    }

    audit(req, {
      action: 'USUARIO_ACTIVADO',
      summary: `${r.name} ha confirmado su correo`,
      actorEmail: r.email,
      entity: 'User',
      entityId: r.userId,
    })

    return { ok: true }
  })
}
