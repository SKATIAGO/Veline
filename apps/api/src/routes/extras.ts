import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireUser } from '../auth/sessions.js'
import { authorizeBusiness as authorize, cambios } from '../auth/business-scope.js'
import { audit } from '../audit/log.js'
import { MAX_IMAGEN_BYTES, tipoDeImagen, urlDeImagen } from '../extras.js'
import {
  barrerFotosHuerfanas,
  fotosDelNegocio,
  quitadas,
  sinRepetidas,
  soltarFotos,
} from '../fotos.js'
import { MAX_FOTOS_POR_ITEM } from '@veline/shared'

/**
 * Carta de extras y fotos del panel.
 *
 * La carta es una sola por negocio: lo mismo se puede añadir a cualquier
 * servicio. Verla la puede cualquiera del negocio, porque al apuntar una cita
 * a mano también se eligen extras; cambiarla, solo quien configura.
 */

const extraBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional().or(z.literal('')),
  priceCents: z.number().int().min(0).max(1_000_000),
  /** Lo que alarga la cita. 0 = no la alarga. El tope son 8 horas. */
  durationMin: z.number().int().min(0).max(480).default(0),
  /** Direcciones de fotos subidas antes a /imagenes; la primera es la principal. */
  photos: z.array(z.string().max(80)).max(MAX_FOTOS_POR_ITEM).default([]),
  active: z.boolean().default(true),
})

const imagenBody = z.object({
  /** La foto en base64, ya reducida por el navegador. */
  datos: z
    .string()
    .min(16)
    .max(Math.ceil((MAX_IMAGEN_BYTES * 4) / 3) + 8)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
})

/** Tope de fotos guardadas por negocio. Una carta normal usa una docena; esto
    es para que nadie pueda llenar la base subiendo en bucle. */
const MAX_IMAGENES_POR_NEGOCIO = 200

export async function extrasRoutes(app: FastifyInstance) {
  app.get('/api/panel/:slug/extras', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    return prisma.extra.findMany({
      where: { businessId: auth.business.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
  })

  app.post('/api/panel/:slug/extras', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = extraBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const d = parsed.data
    const fotos = sinRepetidas(d.photos)
    if (!(await fotosDelNegocio(auth.business.id, fotos))) {
      return reply.code(400).send({ error: 'Alguna foto no es válida. Súbela de nuevo.' })
    }

    const count = await prisma.extra.count({ where: { businessId: auth.business.id } })
    const creado = await prisma.extra.create({
      data: {
        businessId: auth.business.id,
        name: d.name,
        description: d.description || null,
        priceCents: d.priceCents,
        photos: fotos,
        active: d.active,
        position: count,
      },
    })

    audit(req, {
      action: 'EXTRA_CREADO',
      summary: `Ha añadido el extra «${creado.name}» a la carta`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Extra',
      entityId: creado.id,
      metadata: { precioCents: creado.priceCents },
    })

    return reply.code(201).send(creado)
  })

  app.patch('/api/panel/:slug/extras/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = extraBody.partial().safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: parsed.error.flatten() })
    }
    const existing = await prisma.extra.findFirst({ where: { id, businessId: auth.business.id } })
    if (!existing) return reply.code(404).send({ error: 'Extra no encontrado' })

    const { description, photos, ...rest } = parsed.data
    const fotos = photos === undefined ? undefined : sinRepetidas(photos)
    if (!(await fotosDelNegocio(auth.business.id, fotos))) {
      return reply.code(400).send({ error: 'Alguna foto no es válida. Súbela de nuevo.' })
    }

    const actualizado = await prisma.extra.update({
      where: { id },
      data: {
        ...rest,
        ...(description !== undefined ? { description: description || null } : {}),
        ...(fotos !== undefined ? { photos: fotos } : {}),
      },
    })
    if (fotos !== undefined) {
      await soltarFotos(auth.business.id, quitadas(existing.photos, actualizado.photos))
    }

    audit(req, {
      action: 'EXTRA_EDITADO',
      summary: `Ha editado el extra «${actualizado.name}»`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Extra',
      entityId: id,
      metadata: cambios(existing, actualizado, ['name', 'description', 'priceCents', 'active']),
    })

    return actualizado
  })

  /**
   * Borrado de verdad, no baja lógica como los servicios: las citas que ya lo
   * llevan guardan su propia copia del nombre y el precio, así que no se
   * pierde nada. Para quitarlo solo por un tiempo está «Ocultar».
   */
  app.delete('/api/panel/:slug/extras/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const existing = await prisma.extra.findFirst({ where: { id, businessId: auth.business.id } })
    if (!existing) return reply.code(404).send({ error: 'Extra no encontrado' })

    await prisma.extra.delete({ where: { id } })
    await soltarFotos(auth.business.id, existing.photos)

    audit(req, {
      action: 'EXTRA_ELIMINADO',
      summary: `Ha quitado el extra «${existing.name}» de la carta`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Extra',
      entityId: id,
    })

    return reply.code(204).send()
  })

  /* ── Fotos ─────────────────────────────────────────────────── */

  app.post(
    '/api/panel/:slug/imagenes',
    // El único cuerpo grande de la API: el tope general es de 64 KB. Lo que cabe
    // una foto de MAX_IMAGEN_BYTES en base64, con margen.
    { bodyLimit: Math.ceil((MAX_IMAGEN_BYTES * 4) / 3) + 4096 },
    async (req, reply) => {
      const user = await requireUser(req, reply)
      if (!user) return
      const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
      if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

      const parsed = imagenBody.safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: 'Esa foto no se ha podido leer' })

      const datos = Buffer.from(parsed.data.datos, 'base64')
      if (datos.length > MAX_IMAGEN_BYTES) {
        return reply.code(413).send({ error: 'La foto es demasiado grande' })
      }
      const mime = tipoDeImagen(datos)
      if (!mime) {
        return reply.code(400).send({ error: 'Solo se admiten fotos JPG, PNG o WebP' })
      }

      await barrerFotosHuerfanas(auth.business.id)
      const cuantas = await prisma.imagen.count({ where: { businessId: auth.business.id } })
      if (cuantas >= MAX_IMAGENES_POR_NEGOCIO) {
        return reply.code(409).send({ error: 'Has llegado al máximo de fotos guardadas' })
      }

      const imagen = await prisma.imagen.create({
        data: { businessId: auth.business.id, mime, datos },
        select: { id: true },
      })
      return reply.code(201).send({ url: urlDeImagen(imagen.id) })
    },
  )

  /** Pública: la carta se ve sin sesión, al reservar. */
  app.get('/api/imagenes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const imagen = await prisma.imagen.findUnique({
      where: { id },
      select: { mime: true, datos: true },
    })
    if (!imagen) return reply.code(404).send({ error: 'Foto no encontrada' })

    return (
      reply
        .header('Content-Type', imagen.mime)
        // Cada foto nueva tiene su propia dirección, así que una dirección no
        // cambia nunca de contenido: el navegador puede guardarla para siempre.
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('X-Content-Type-Options', 'nosniff')
        // Por si acaso: aunque algo se colara, abierta sola no ejecuta nada.
        .header('Content-Security-Policy', "default-src 'none'; img-src 'self'")
        .send(Buffer.from(imagen.datos))
    )
  })
}
