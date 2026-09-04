import type { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { CATEGORIES, phoneES } from '@veline/shared'
import { prisma } from '../prisma.js'
import { requireUser } from '../auth/sessions.js'
import { authorizeBusiness as authorize, cambios } from '../auth/business-scope.js'
import { audit } from '../audit/log.js'
import { isWithinOpeningHours, pickStaffForSlot } from '../availability.js'

/**
 * Lo que un negocio necesita para gestionarse solo: las personas que atienden,
 * los cierres por vacaciones, su propia ficha y una agenda que se pueda tocar.
 *
 * Antes todo esto existía en el modelo de datos pero no tenía puerta: el motor
 * de reservas ya repartía citas entre personas y respetaba los cierres, y sin
 * embargo nadie podía dar de alta a una persona ni cerrar por Navidad.
 */

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]]

const staffBody = z.object({
  name: z.string().trim().min(2, 'El nombre es demasiado corto').max(120),
})

const closureBody = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    reason: z.string().trim().max(120).optional().or(z.literal('')),
  })
  .refine((c) => c.to >= c.from, 'El cierre no puede terminar antes de empezar')

const businessBody = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(CATEGORY_SLUGS),
  description: z.string().trim().max(600).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  street: z.string().trim().min(3).max(160),
  city: z.string().trim().min(2).max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El código postal son 5 cifras'),
})

/** Cita apuntada a mano desde el panel: la que entra por teléfono. */
const manualBookingBody = z.object({
  serviceId: z.string().min(1),
  /** ISO completo con zona, tal y como lo manda el navegador. */
  startsAt: z.string().datetime({ offset: true }),
  staffId: z.string().min(1).optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: phoneES,
  customerEmail: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  notes: z.string().trim().max(400).optional().or(z.literal('')),
})

const rescheduleBody = z.object({
  startsAt: z.string().datetime({ offset: true }),
  staffId: z.string().min(1).optional(),
})

const outcomeBody = z.object({ status: z.enum(['COMPLETADA', 'NO_ASISTIO', 'CONFIRMADA']) })

/** Las columnas @db.Date llegan a medianoche UTC: se leen en UTC, no en local. */
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

export async function negocioRoutes(app: FastifyInstance) {
  /* ── Personas que atienden ────────────────────────────────────
   * Ojo: esto NO son las cuentas de acceso al panel (eso es "Equipo").
   * Una persona puede atender citas sin tener usuario, y un administrador
   * puede tener usuario sin atender a nadie. */

  app.get('/api/panel/:slug/staff', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const rows = await prisma.staff.findMany({
      where: { businessId: auth.business.id },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { bookings: { where: { status: 'CONFIRMADA' } } } },
      },
    })

    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      active: s.active,
      upcomingBookings: s._count.bookings,
    }))
  })

  app.post('/api/panel/:slug/staff', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = staffBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const created = await prisma.staff.create({
      data: {
        businessId: auth.business.id,
        locationId: auth.business.locationId,
        name: parsed.data.name,
      },
    })

    audit(req, {
      action: 'PERSONA_CREADA',
      summary: `Ha dado de alta a ${created.name} como persona que atiende`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Staff',
      entityId: created.id,
    })

    return reply.code(201).send({ id: created.id, name: created.name, active: created.active })
  })

  app.patch('/api/panel/:slug/staff/:id', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = staffBody
      .partial()
      .extend({ active: z.boolean().optional() })
      .safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const existing = await prisma.staff.findFirst({
      where: { id, businessId: auth.business.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Persona no encontrada' })

    // Dar de baja a alguien con citas por delante dejaría esas citas huérfanas
    // en la agenda. Se avisa en vez de romperlas por la espalda.
    if (parsed.data.active === false) {
      const pendientes = await prisma.booking.count({
        where: { staffId: id, status: 'CONFIRMADA', startsAt: { gte: new Date() } },
      })
      if (pendientes > 0) {
        return reply.code(409).send({
          error: `${existing.name} tiene ${pendientes} ${pendientes === 1 ? 'cita' : 'citas'} por delante. Muévelas o cancélalas antes de darle de baja.`,
        })
      }
    }

    const updated = await prisma.staff.update({ where: { id }, data: parsed.data })

    const soloEstado = parsed.data.active !== undefined && parsed.data.name === undefined
    audit(req, {
      action: soloEstado
        ? parsed.data.active
          ? 'PERSONA_ACTIVADA'
          : 'PERSONA_DESACTIVADA'
        : 'PERSONA_EDITADA',
      summary: soloEstado
        ? `Ha ${parsed.data.active ? 'reactivado' : 'dado de baja'} a ${existing.name}`
        : `Ha editado a ${updated.name}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Staff',
      entityId: id,
      metadata: cambios(existing, updated, ['name', 'active']),
    })

    return { id: updated.id, name: updated.name, active: updated.active }
  })

  /* ── Cierres: vacaciones y festivos ─────────────────────────
   * El modelo guarda UN DÍA por fila (así lo consulta el motor de huecos).
   * De cara al negocio eso no vale: unas vacaciones son un rango, no quince
   * filas. La API acepta el rango, guarda los días sueltos y al listarlos
   * vuelve a juntarlos en tramos seguidos con el mismo motivo. */

  app.get('/api/panel/:slug/closures', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })
    if (!auth.business.locationId) return []

    const desde = new Date()
    desde.setUTCHours(0, 0, 0, 0)

    const dias = await prisma.closure.findMany({
      where: { locationId: auth.business.locationId, date: { gte: desde } },
      orderBy: { date: 'asc' },
    })

    const tramos: { from: string; to: string; reason: string | null; ids: string[] }[] = []
    for (const d of dias) {
      const key = dayKey(d.date)
      const ultimo = tramos[tramos.length - 1]
      const siguienteAlUltimo =
        ultimo && dayKey(addDays(new Date(`${ultimo.to}T00:00:00Z`), 1)) === key
      if (ultimo && siguienteAlUltimo && ultimo.reason === d.reason) {
        ultimo.to = key
        ultimo.ids.push(d.id)
      } else {
        tramos.push({ from: key, to: key, reason: d.reason, ids: [d.id] })
      }
    }

    return tramos
  })

  app.post('/api/panel/:slug/closures', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })
    if (!auth.business.locationId) {
      return reply.code(404).send({ error: 'El negocio no tiene local' })
    }

    const parsed = closureBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' })
    }

    const desde = new Date(`${parsed.data.from}T00:00:00Z`)
    const hasta = new Date(`${parsed.data.to}T00:00:00Z`)
    const dias = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1
    if (dias > 366) return reply.code(400).send({ error: 'El cierre no puede pasar de un año' })

    const fechas = Array.from({ length: dias }, (_, i) => addDays(desde, i))

    // Las citas ya confirmadas dentro del cierre no se tocan solas: se avisa
    // para que el negocio decida si las mueve o las cancela.
    const afectadas = await prisma.booking.count({
      where: {
        businessId: auth.business.id,
        status: 'CONFIRMADA',
        startsAt: {
          gte: new Date(`${parsed.data.from}T00:00:00`),
          lte: new Date(`${parsed.data.to}T23:59:59`),
        },
      },
    })

    await prisma.closure.createMany({
      data: fechas.map((date) => ({
        locationId: auth.business.locationId!,
        date,
        reason: parsed.data.reason || null,
      })),
      skipDuplicates: true,
    })

    audit(req, {
      action: 'CIERRE_CREADO',
      summary: `Ha cerrado del ${parsed.data.from} al ${parsed.data.to}${parsed.data.reason ? ` (${parsed.data.reason})` : ''}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Closure',
      entityId: auth.business.locationId,
      metadata: {
        desde: parsed.data.from,
        hasta: parsed.data.to,
        dias,
        citasAfectadas: afectadas,
      },
    })

    return reply.code(201).send({
      from: parsed.data.from,
      to: parsed.data.to,
      reason: parsed.data.reason || null,
      days: dias,
      affectedBookings: afectadas,
    })
  })

  /** Se borra el tramo entero, por los ids que devolvió el listado. */
  app.delete('/api/panel/:slug/closures', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = z.object({ ids: z.array(z.string().min(1)).min(1).max(400) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Datos inválidos' })

    // El filtro por locationId es lo que impide borrar cierres de otro negocio
    // mandando ids ajenos.
    const { count } = await prisma.closure.deleteMany({
      where: {
        id: { in: parsed.data.ids },
        locationId: auth.business.locationId ?? '__ninguno__',
      },
    })
    if (count === 0) return reply.code(404).send({ error: 'Cierre no encontrado' })

    audit(req, {
      action: 'CIERRE_ELIMINADO',
      summary: `Ha quitado un cierre de ${count} ${count === 1 ? 'día' : 'días'}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Closure',
      metadata: { dias: count },
    })

    return reply.code(204).send()
  })

  /* ── La ficha del negocio ─────────────────────────────────── */

  app.get('/api/panel/:slug/profile', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const b = await prisma.business.findUnique({
      where: { id: auth.business.id },
      include: { locations: { take: 1, orderBy: { id: 'asc' } } },
    })
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado' })

    const loc = b.locations[0]
    return {
      slug: b.slug,
      name: b.name,
      category: b.category,
      description: b.description ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      photos: b.photos,
      street: loc?.street ?? '',
      city: loc?.city ?? '',
      postalCode: loc?.postalCode ?? '',
    }
  })

  app.put('/api/panel/:slug/profile', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = businessBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        details: parsed.error.flatten(),
      })
    }
    const d = parsed.data

    const before = await prisma.business.findUnique({ where: { id: auth.business.id } })
    if (!before) return reply.code(404).send({ error: 'Negocio no encontrado' })

    // El slug NO se toca al renombrar: es la dirección pública del negocio y
    // cambiarla rompería todos los enlaces ya compartidos.
    const updated = await prisma.business.update({
      where: { id: auth.business.id },
      data: {
        name: d.name,
        category: d.category,
        description: d.description || null,
        phone: d.phone || null,
        email: d.email || null,
      },
    })

    const loc = await prisma.location.findFirst({
      where: { businessId: auth.business.id },
      orderBy: { id: 'asc' },
    })
    if (loc) {
      await prisma.location.update({
        where: { id: loc.id },
        data: { street: d.street, city: d.city, postalCode: d.postalCode },
      })
    } else {
      await prisma.location.create({
        data: {
          businessId: auth.business.id,
          street: d.street,
          city: d.city,
          postalCode: d.postalCode,
        },
      })
    }

    audit(req, {
      action: 'NEGOCIO_EDITADO',
      summary: `Ha editado la ficha de ${updated.name}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Business',
      entityId: auth.business.id,
      metadata: cambios(before, updated, ['name', 'category', 'description', 'phone', 'email']),
    })

    return { ok: true }
  })

  /* ── Fotos de la ficha ────────────────────────────────────── */

  app.put('/api/panel/:slug/photos', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'configuracion')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = z.object({ photos: z.array(z.string().url()).max(10) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Fotos inválidas' })

    await prisma.business.update({
      where: { id: auth.business.id },
      data: { photos: parsed.data.photos },
    })

    audit(req, {
      action: 'NEGOCIO_EDITADO',
      summary: `Ha cambiado las fotos de ${auth.business.name}`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Business',
      entityId: auth.business.id,
      metadata: { fotos: parsed.data.photos.length },
    })

    return { ok: true, photos: parsed.data.photos }
  })

  /* ── Agenda operativa ─────────────────────────────────────── */

  /** Apuntar a mano la cita que entra por teléfono o en mostrador. */
  app.post('/api/panel/:slug/bookings', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const auth = await authorize(user, (req.params as { slug: string }).slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = manualBookingBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        details: parsed.error.flatten(),
      })
    }
    const input = parsed.data

    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, businessId: auth.business.id },
    })
    if (!service) return reply.code(404).send({ error: 'Servicio no encontrado' })

    const start = new Date(input.startsAt)
    const end = new Date(start.getTime() + service.durationMin * 60_000)
    const blockedTo = new Date(end.getTime() + service.bufferMin * 60_000)

    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          const staff = await pickStaffForSlot(tx, {
            businessId: auth.business.id,
            start,
            end: blockedTo,
            preferredStaffId: input.staffId,
          })
          if (!staff) {
            throw Object.assign(new Error('No queda nadie libre a esa hora'), { statusCode: 409 })
          }

          const customer = await tx.customer.upsert({
            where: { phone: input.customerPhone },
            create: {
              name: input.customerName,
              phone: input.customerPhone,
              email: input.customerEmail || null,
            },
            update: {
              name: input.customerName,
              ...(input.customerEmail ? { email: input.customerEmail } : {}),
            },
          })

          return tx.booking.create({
            data: {
              code: `VL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
              businessId: auth.business.id,
              locationId: auth.business.locationId,
              serviceId: service.id,
              staffId: staff.id,
              customerId: customer.id,
              startsAt: start,
              endsAt: end,
              blockedTo,
              priceCents: service.priceCents,
              notes: input.notes || null,
              // Una cita apuntada a mano nunca es del marketplace: la trajo el
              // negocio. Por eso no genera comisión.
              source: 'DIRECTO',
              isFirstFromMarketplace: false,
              commissionCents: 0,
            },
            include: { customer: true, service: true, staff: true },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      audit(req, {
        action: 'RESERVA_CREADA',
        summary: `Ha apuntado a mano la cita de ${booking.customer.name} (${booking.code})`,
        actor: user,
        businessId: auth.business.id,
        entity: 'Booking',
        entityId: booking.id,
        metadata: { codigo: booking.code, cuando: booking.startsAt, origen: 'panel' },
      })

      return reply.code(201).send({ id: booking.id, code: booking.code })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        return reply.code(409).send({ error: 'Ese hueco acaba de ocuparse' })
      }
      const status = (err as { statusCode?: number }).statusCode
      if (status) return reply.code(status).send({ error: (err as Error).message })
      throw err
    }
  })

  /** Mover una cita de hora. */
  app.patch('/api/panel/:slug/bookings/:id/reschedule', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = rescheduleBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Fecha inválida' })

    const existing = await prisma.booking.findFirst({
      where: { id, businessId: auth.business.id },
      include: { service: true, customer: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Cita no encontrada' })
    if (existing.status !== 'CONFIRMADA') {
      return reply.code(409).send({ error: 'Solo se pueden mover las citas confirmadas' })
    }

    const start = new Date(parsed.data.startsAt)
    const end = new Date(start.getTime() + existing.service.durationMin * 60_000)
    const blockedTo = new Date(end.getTime() + existing.service.bufferMin * 60_000)

    const dentro = await isWithinOpeningHours(
      auth.business.id,
      start,
      existing.service.durationMin + existing.service.bufferMin,
    )
    if (!dentro) {
      return reply.code(409).send({ error: 'Esa hora cae fuera del horario o en un día cerrado' })
    }

    try {
      const moved = await prisma.$transaction(
        async (tx) => {
          // Se libera el hueco viejo antes de buscar quién queda libre, si no
          // la propia cita que estamos moviendo se cuenta como ocupada.
          await tx.booking.update({ where: { id }, data: { status: 'CANCELADA' } })

          const staff = await pickStaffForSlot(tx, {
            businessId: auth.business.id,
            start,
            end: blockedTo,
            preferredStaffId: parsed.data.staffId ?? existing.staffId ?? undefined,
          })
          if (!staff) {
            throw Object.assign(new Error('No queda nadie libre a esa hora'), { statusCode: 409 })
          }

          return tx.booking.update({
            where: { id },
            data: {
              status: 'CONFIRMADA',
              staffId: staff.id,
              startsAt: start,
              endsAt: end,
              blockedTo,
            },
          })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      audit(req, {
        action: 'RESERVA_MOVIDA',
        summary: `Ha movido la cita de ${existing.customer.name} (${existing.code})`,
        actor: user,
        businessId: auth.business.id,
        entity: 'Booking',
        entityId: id,
        metadata: { antes: existing.startsAt, despues: moved.startsAt },
      })

      return { ok: true, startsAt: moved.startsAt }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        return reply.code(409).send({ error: 'Ese hueco acaba de ocuparse' })
      }
      const status = (err as { statusCode?: number }).statusCode
      if (status) return reply.code(status).send({ error: (err as Error).message })
      throw err
    }
  })

  /** Marcar si el cliente vino, no vino, o deshacerlo. */
  app.patch('/api/panel/:slug/bookings/:id/outcome', async (req, reply) => {
    const user = await requireUser(req, reply)
    if (!user) return
    const { slug, id } = req.params as { slug: string; id: string }
    const auth = await authorize(user, slug, 'agenda')
    if (!auth.ok) return reply.code(auth.status).send({ error: auth.error })

    const parsed = outcomeBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Estado inválido' })

    const existing = await prisma.booking.findFirst({
      where: { id, businessId: auth.business.id },
      include: { customer: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Cita no encontrada' })
    if (existing.status === 'CANCELADA') {
      return reply.code(409).send({ error: 'Esta cita está cancelada' })
    }

    await prisma.booking.update({ where: { id }, data: { status: parsed.data.status } })

    const accion =
      parsed.data.status === 'COMPLETADA'
        ? 'RESERVA_COMPLETADA'
        : parsed.data.status === 'NO_ASISTIO'
          ? 'RESERVA_NO_ASISTIO'
          : 'RESERVA_MOVIDA'

    audit(req, {
      action: accion,
      summary:
        parsed.data.status === 'COMPLETADA'
          ? `Ha marcado como atendida la cita de ${existing.customer.name} (${existing.code})`
          : parsed.data.status === 'NO_ASISTIO'
            ? `Ha marcado que ${existing.customer.name} no vino (${existing.code})`
            : `Ha deshecho el estado de la cita de ${existing.customer.name} (${existing.code})`,
      actor: user,
      businessId: auth.business.id,
      entity: 'Booking',
      entityId: id,
      metadata: { antes: existing.status, despues: parsed.data.status },
    })

    return { ok: true, status: parsed.data.status }
  })
}
