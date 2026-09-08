import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { authorizeBusiness } from '../auth/business-scope.js'
import { audit } from '../audit/log.js'
import { requireUser } from '../auth/sessions.js'

/**
 * Los locales de un negocio.
 *
 * El modelo siempre admitió varios —horario, cierres, personas y citas ya
 * colgaban del local, no del negocio— pero no había forma de crear el segundo.
 * Esto es esa forma.
 *
 * Cada local tiene SU horario y SUS personas, así que abrir uno nuevo no es
 * solo una dirección más: hasta que no tenga horario y alguien que atienda, no
 * ofrece huecos. Se avisa en la respuesta para que el panel lo pueda decir.
 */

const localSchema = z.object({
  name: z.string().trim().min(2, 'Ponle un nombre al local').max(80),
  street: z.string().trim().min(3, 'Falta la calle').max(160),
  city: z.string().trim().min(2, 'Falta la ciudad').max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal son 5 cifras'),
})

export async function localesRoutes(app: FastifyInstance) {
  /** Los locales, con lo que a cada uno le falta para funcionar. */
  app.get('/api/panel/:slug/locations', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }
    const auth = await authorizeBusiness(user, slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const locales = await prisma.location.findMany({
      where: { businessId: auth.business.id },
      orderBy: { id: 'asc' },
      include: {
        _count: { select: { openingHours: true, bookings: true } },
        staff: { where: { active: true }, select: { id: true } },
      },
    })

    // Las que atienden en cualquier local: cuentan para todos, así que un
    // local sin gente propia puede seguir dando huecos gracias a ellas.
    const comodines = await prisma.staff.count({
      where: { businessId: auth.business.id, active: true, locationId: null },
    })

    return locales.map((l) => ({
      id: l.id,
      name: l.name,
      street: l.street,
      city: l.city,
      postalCode: l.postalCode,
      personas: l.staff.length + comodines,
      personasPropias: l.staff.length,
      citas: l._count.bookings,
      tieneHorario: l._count.openingHours > 0,
    }))
  })

  app.post('/api/panel/:slug/locations', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug } = req.params as { slug: string }
    const auth = await authorizeBusiness(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = localSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const local = await prisma.location.create({
      data: { businessId: auth.business.id, ...parsed.data },
    })

    audit(req, {
      action: 'NEGOCIO_EDITADO',
      summary: `Ha abierto el local «${local.name}»`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Location',
      entityId: local.id,
      metadata: { ciudad: local.city },
    })

    return reply.code(201).send({ id: local.id, name: local.name })
  })

  app.patch('/api/panel/:slug/locations/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorizeBusiness(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = localSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    // El businessId en el where es lo que impide editar el local de otro
    // negocio pasando su id.
    const antes = await prisma.location.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!antes) return reply.code(404).send({ error: 'Local no encontrado' })

    const local = await prisma.location.update({ where: { id }, data: parsed.data })

    audit(req, {
      action: 'NEGOCIO_EDITADO',
      summary: `Ha editado el local «${local.name}»`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Location',
      entityId: id,
    })

    return { id: local.id, name: local.name }
  })

  /**
   * Cerrar un local.
   *
   * No se deja si tiene citas: sus horas quedarían colgando de un sitio que ya
   * no existe y la agenda dejaría de cuadrar. Tampoco si es el último — un
   * negocio sin local no puede recibir reservas y quedaría inutilizado sin que
   * nadie entienda por qué.
   */
  app.delete('/api/panel/:slug/locations/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorizeBusiness(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const local = await prisma.location.findFirst({
      where: { id, businessId: auth.business.id },
      include: { _count: { select: { bookings: true } } },
    })
    if (!local) return reply.code(404).send({ error: 'Local no encontrado' })

    const cuantos = await prisma.location.count({ where: { businessId: auth.business.id } })
    if (cuantos <= 1) {
      return reply
        .code(409)
        .send({ error: 'Es el único local: un negocio sin local no puede recibir reservas.' })
    }
    if (local._count.bookings > 0) {
      return reply.code(409).send({
        error: `Este local tiene ${local._count.bookings} ${local._count.bookings === 1 ? 'cita' : 'citas'} y no se puede cerrar. Muévelas o cancélalas antes.`,
      })
    }

    await prisma.location.delete({ where: { id } })

    audit(req, {
      action: 'NEGOCIO_EDITADO',
      summary: `Ha cerrado el local «${local.name}»`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Location',
      entityId: id,
    })

    return { ok: true }
  })
}
