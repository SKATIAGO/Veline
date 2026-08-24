import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { CATEGORIES } from '@veline/shared'
import { prisma } from '../prisma.js'
import { audit } from '../audit/log.js'
import { hashPassword } from '../auth/passwords.js'
import { canManagePlatform } from '../auth/permissions.js'
import { requireUser } from '../auth/sessions.js'

/**
 * Gestión de la plataforma. SOLO superadmin: dar de alta negocios, crear el
 * administrador de cada uno y ver el estado general.
 */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const createBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]]),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  street: z.string().trim().min(3).max(160),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(10),
})

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
  role: z.enum(['ADMIN', 'EMPLEADO']),
  businessId: z.string().min(1),
})

export async function adminRoutes(app: FastifyInstance) {
  app.get('/api/admin/businesses', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const rows = await prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { bookings: true, users: true, services: true, staff: true } },
      },
    })
    return rows.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      category: b.category,
      plan: b.plan,
      email: b.email,
      createdAt: b.createdAt.toISOString(),
      counts: b._count,
    }))
  })

  app.post('/api/admin/businesses', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const parsed = createBusinessSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const d = parsed.data

    // Slug único: si ya existe, se le añade un sufijo numérico.
    const base = slugify(d.name)
    if (!base) return reply.code(400).send({ error: 'El nombre no genera un identificador válido' })
    let slug = base
    for (let i = 2; await prisma.business.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`
    }

    const business = await prisma.business.create({
      data: {
        slug,
        name: d.name,
        category: d.category,
        email: d.email,
        phone: d.phone || null,
        locations: {
          create: { street: d.street, city: d.city, postalCode: d.postalCode },
        },
      },
    })
    audit(req, {
      action: 'NEGOCIO_CREADO',
      summary: `Ha dado de alta el negocio «${business.name}»`,
      actor: user,
      businessId: business.id,
      entity: 'Business',
      entityId: business.id,
      metadata: { slug: business.slug, categoria: business.category, ciudad: d.city },
    })

    return reply.code(201).send({ id: business.id, slug: business.slug, name: business.name })
  })

  app.get('/api/admin/users', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const rows = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { business: { select: { slug: true, name: true } } },
    })
    // El passwordHash jamás sale de la API.
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      business: u.business,
      createdAt: u.createdAt.toISOString(),
    }))
  })

  app.post('/api/admin/users', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const d = parsed.data

    const business = await prisma.business.findUnique({ where: { id: d.businessId } })
    if (!business) return reply.code(404).send({ error: 'Negocio no encontrado' })

    const existing = await prisma.user.findUnique({ where: { email: d.email } })
    if (existing) return reply.code(409).send({ error: 'Ya existe un usuario con ese email' })

    const created = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash: await hashPassword(d.password),
        role: d.role,
        businessId: d.businessId,
      },
    })
    audit(req, {
      action: 'USUARIO_CREADO',
      summary: `Ha dado de alta a ${created.name} (${created.email}) como ${created.role} en «${business.name}»`,
      actor: user,
      businessId: business.id,
      entity: 'User',
      entityId: created.id,
      metadata: { rol: created.role, negocio: business.slug },
    })

    return reply
      .code(201)
      .send({ id: created.id, email: created.email, role: created.role, business: business.slug })
  })

  app.patch('/api/admin/users/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    if (!canManagePlatform(user)) return reply.code(403).send({ error: 'Solo superadmin' })

    const { id } = req.params as { id: string }
    const parsed = z.object({ active: z.boolean() }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' })

    // Nadie se desactiva a sí mismo: evita quedarse fuera de la plataforma.
    if (id === user.id) return reply.code(400).send({ error: 'No puedes desactivarte a ti mismo' })

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return reply.code(404).send({ error: 'Usuario no encontrado' })

    await prisma.user.update({ where: { id }, data: { active: parsed.data.active } })
    // Al desactivar, sus sesiones abiertas mueren también.
    if (!parsed.data.active) await prisma.session.deleteMany({ where: { userId: id } })

    audit(req, {
      action: parsed.data.active ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO',
      summary: `Ha ${parsed.data.active ? 'reactivado' : 'desactivado'} a ${target.name} (${target.email})`,
      actor: user,
      businessId: target.businessId,
      entity: 'User',
      entityId: id,
    })

    return { ok: true }
  })
}
