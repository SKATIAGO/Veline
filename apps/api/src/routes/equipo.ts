import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireUser } from '../auth/sessions.js'
import { authorizeBusiness as authorize } from '../auth/business-scope.js'
import { hashPassword } from '../auth/passwords.js'
import { sendMailSafely } from '../mail/enviar.js'
import { panelUserCreatedMail } from '../mail/templates.js'
import { audit } from '../audit/log.js'

/**
 * Incorporar a alguien al equipo, de una vez.
 *
 * Antes eran tres pantallas sin relación: «Empleados» para que atendiera
 * citas, su horario en otra ficha, y «Administrador» para crearle la cuenta
 * del panel. Si algo fallaba a medias (el correo ya existía, por ejemplo) se
 * quedaba una persona sin cuenta o una cuenta sin persona, y nada las unía.
 *
 * Aquí todo va en una transacción: o se crea entero o no se crea nada. Puede
 * ser alguien que atiende citas, alguien que solo entra al panel (quien lleva
 * las cuentas), o las dos cosas, y entonces su ficha y su cuenta quedan
 * enlazadas.
 */

const franja = z.object({
  weekday: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
})

const incorporarBody = z
  .object({
    name: z.string().trim().min(2, 'El nombre es demasiado corto').max(120),
    /** Si atiende citas: entonces sale en los huecos de la reserva. */
    atiende: z.boolean(),
    /** Dónde atiende. Null o sin poner = en todos los locales. */
    locationId: z.string().min(1).nullable().optional(),
    /** Horario propio. Sin franjas = sigue el horario del negocio. */
    horario: z
      .array(franja)
      .max(30)
      .refine(
        (r) => r.every((f) => f.endMin > f.startMin),
        'Cada franja debe terminar después de empezar',
      )
      .optional(),
    /** Su cuenta del panel, si va a entrar. */
    acceso: z
      .object({
        email: z.string().trim().toLowerCase().email('Revisa el correo'),
        password: z.string().min(10).max(200),
        role: z.enum(['ADMIN', 'EMPLEADO']),
      })
      .nullable()
      .optional(),
  })
  .refine((d) => d.atiende || d.acceso, {
    message: 'Tiene que atender citas, entrar al panel o las dos cosas',
  })

export async function equipoRoutes(app: FastifyInstance) {
  app.post('/api/panel/:slug/equipo', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = incorporarBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }
    const d = parsed.data

    if (d.locationId && !auth.business.locationIds.includes(d.locationId)) {
      return reply.code(400).send({ error: 'Ese local no es de este negocio' })
    }
    // Con un local, el suyo. Con varios, el elegido; sin elegir, en todos.
    const locationId =
      auth.business.locationIds.length > 1 ? (d.locationId ?? null) : auth.business.locationId

    if (d.acceso) {
      const ya = await prisma.user.findUnique({ where: { email: d.acceso.email } })
      if (ya) {
        return reply.code(409).send({
          error:
            'Ese correo ya tiene cuenta en Veline. Usa otro, o incorpórale sin acceso al panel.',
        })
      }
    }
    const passwordHash = d.acceso ? await hashPassword(d.acceso.password) : null

    const { persona, cuenta } = await prisma.$transaction(async (tx) => {
      const cuenta =
        d.acceso && passwordHash
          ? await tx.user.create({
              data: {
                name: d.name,
                email: d.acceso.email,
                passwordHash,
                role: d.acceso.role,
                businessId: auth.business.id,
                // La da de alta quien administra: no recibe enlace de
                // confirmación, así que nace verificada (ver alta.ts).
                emailVerifiedAt: new Date(),
              },
              select: { id: true, name: true, email: true, role: true },
            })
          : null

      const persona = d.atiende
        ? await tx.staff.create({
            data: {
              businessId: auth.business.id,
              locationId,
              name: d.name,
              userId: cuenta?.id ?? null,
              ...(d.horario?.length ? { hours: { create: d.horario } } : {}),
            },
            select: { id: true, name: true },
          })
        : null

      return { persona, cuenta }
    })

    if (persona) {
      audit(req, {
        action: 'PERSONA_CREADA',
        summary: `Ha incorporado a ${persona.name} al equipo${d.horario?.length ? ', con horario propio' : ''}`,
        actor: user,
        businessId: auth.business.id,
        entity: 'Staff',
        entityId: persona.id,
      })
    }
    if (cuenta) {
      audit(req, {
        action: 'USUARIO_CREADO',
        summary: `Ha dado de alta a ${cuenta.name} (${cuenta.email}) como ${cuenta.role}`,
        actor: user,
        businessId: auth.business.id,
        entity: 'User',
        entityId: cuenta.id,
        metadata: { rol: cuenta.role },
      })
      void sendMailSafely(
        panelUserCreatedMail(
          { email: cuenta.email, name: cuenta.name },
          { businessName: auth.business.name, password: d.acceso!.password, role: d.acceso!.role },
        ),
      )
    }

    return reply.code(201).send({ staffId: persona?.id ?? null, userId: cuenta?.id ?? null })
  })
}
