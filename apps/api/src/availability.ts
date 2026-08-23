import { toDateKey, type DayAvailabilityDTO } from '@veline/shared'
import { prisma } from './prisma.js'
import {
  atLocalMinutes,
  calcularDisponibilidad,
  MAX_RANGE_DAYS,
  MIN_LEAD_MIN,
  SLOT_STEP_MIN,
  type Cierre,
} from './availability-core.js'

export { MAX_RANGE_DAYS, MIN_LEAD_MIN, SLOT_STEP_MIN }

/**
 * Acceso a datos del motor de disponibilidad. La lógica de cálculo vive en
 * availability-core.ts, sin base de datos, para poder probarla.
 *
 * El contenedor corre con TZ=Europe/Madrid, así que se trabaja con fechas
 * locales y Postgres las guarda en UTC.
 */

/** Medianoche UTC del día indicado — así se guardan las columnas @db.Date. */
const utcMidnight = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))

/**
 * Las columnas @db.Date llegan como medianoche UTC. Interpretarlas en local
 * desplazaría el día al oeste de Greenwich, así que se compensa el desfase
 * antes de sacar la clave.
 */
const claveDeFechaUtc = (d: Date) =>
  toDateKey(new Date(d.getTime() + d.getTimezoneOffset() * 60_000))

export interface AvailabilityRange {
  businessId: string
  serviceId: string
  from: Date
  to: Date
}

export async function getAvailability({
  businessId,
  serviceId,
  from,
  to,
}: AvailabilityRange): Promise<DayAvailabilityDTO[]> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, active: true },
  })
  if (!service) throw Object.assign(new Error('Servicio no encontrado'), { statusCode: 404 })

  const location = await prisma.location.findFirst({
    where: { businessId },
    include: { openingHours: true },
  })
  if (!location) throw Object.assign(new Error('El negocio no tiene local'), { statusCode: 404 })

  const rangeStart = atLocalMinutes(from, 0)
  const rangeEnd = atLocalMinutes(to, 24 * 60)

  const [staff, closures, bookings] = await Promise.all([
    prisma.staff.findMany({ where: { businessId, active: true }, orderBy: { name: 'asc' } }),
    prisma.closure.findMany({
      where: { locationId: location.id, date: { gte: utcMidnight(from), lte: utcMidnight(to) } },
    }),
    prisma.booking.findMany({
      where: {
        businessId,
        status: 'CONFIRMADA',
        startsAt: { lt: rangeEnd },
        blockedTo: { gt: rangeStart },
      },
      select: { staffId: true, startsAt: true, blockedTo: true },
    }),
  ])

  const cierres: Cierre[] = closures.map((c) => ({
    dateKey: claveDeFechaUtc(c.date),
    startMin: c.startMin,
    endMin: c.endMin,
  }))

  return calcularDisponibilidad({
    from,
    to,
    occupancyMin: service.durationMin + service.bufferMin,
    franjas: location.openingHours.map((w) => ({
      weekday: w.weekday,
      startMin: w.startMin,
      endMin: w.endMin,
    })),
    cierres,
    citas: bookings,
    staffIds: staff.map((s) => s.id),
    ahora: new Date(),
  })
}

/**
 * Comprueba dentro de una transacción que el hueco sigue libre y devuelve la
 * persona asignada. Se llama con aislamiento SERIALIZABLE desde la creación
 * de la reserva, así que dos peticiones simultáneas por el mismo hueco no
 * pueden ganar las dos.
 */
export async function pickStaffForSlot(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: { businessId: string; start: Date; end: Date; preferredStaffId?: string },
) {
  const staff = await tx.staff.findMany({
    where: {
      businessId: opts.businessId,
      active: true,
      ...(opts.preferredStaffId ? { id: opts.preferredStaffId } : {}),
    },
    orderBy: { name: 'asc' },
  })
  if (staff.length === 0) return null

  const clashing = await tx.booking.findMany({
    where: {
      businessId: opts.businessId,
      status: 'CONFIRMADA',
      startsAt: { lt: opts.end },
      blockedTo: { gt: opts.start },
    },
    select: { staffId: true },
  })
  const busy = new Set(clashing.map((b) => b.staffId))
  return staff.find((s) => !busy.has(s.id)) ?? null
}

/** Comprueba que el inicio cae dentro del horario de atención y no en un cierre. */
export async function isWithinOpeningHours(businessId: string, start: Date, occupancyMin: number) {
  const location = await prisma.location.findFirst({
    where: { businessId },
    include: { openingHours: true, closures: true },
  })
  if (!location) return false

  const minutes = start.getHours() * 60 + start.getMinutes()
  const fits = location.openingHours.some(
    (w) =>
      w.weekday === start.getDay() && minutes >= w.startMin && minutes + occupancyMin <= w.endMin,
  )
  if (!fits) return false

  const dateKey = toDateKey(start)
  const blocked = location.closures.some((c) => {
    if (claveDeFechaUtc(c.date) !== dateKey) return false
    if (c.startMin === null || c.endMin === null) return true
    return minutes < c.endMin && c.startMin < minutes + occupancyMin
  })
  return !blocked
}
