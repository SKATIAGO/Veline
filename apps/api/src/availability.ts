import { formatMinutes, toDateKey, type DayAvailabilityDTO, type SlotDTO } from '@veline/shared'
import { prisma } from './prisma.js'

/**
 * Motor de disponibilidad.
 *
 * Reglas:
 *  - Los huecos se ofrecen cada SLOT_STEP_MIN minutos dentro de cada franja
 *    de atención (los mockups muestran :00 y :30).
 *  - Una cita ocupa la agenda desde `startsAt` hasta `blockedTo`, es decir
 *    duración del servicio + buffer del servicio.
 *  - Un hueco está libre si al menos una persona activa del negocio no tiene
 *    nada solapado. Se devuelve cuál.
 *  - El hueco tiene que caber entero (duración + buffer) dentro de la franja.
 *  - No se ofrecen huecos con menos de MIN_LEAD_MIN minutos de antelación.
 *
 * El contenedor corre con TZ=Europe/Madrid, así que trabajamos con Date
 * locales y Postgres los guarda en UTC.
 */

export const SLOT_STEP_MIN = 30
export const MIN_LEAD_MIN = 60
export const MAX_RANGE_DAYS = 62

/** Medianoche UTC del día indicado — así se guardan las columnas @db.Date. */
const utcMidnight = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))

const atLocalMinutes = (day: Date, minutes: number) => {
  const d = new Date(day)
  d.setHours(0, minutes, 0, 0)
  return d
}

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && bStart < aEnd

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

  const staff = await prisma.staff.findMany({
    where: { businessId, active: true },
    orderBy: { name: 'asc' },
  })

  const rangeStart = atLocalMinutes(from, 0)
  const rangeEnd = atLocalMinutes(to, 24 * 60)

  const [closures, bookings] = await Promise.all([
    prisma.closure.findMany({
      where: {
        locationId: location.id,
        date: { gte: utcMidnight(from), lte: utcMidnight(to) },
      },
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

  const occupancy = service.durationMin + service.bufferMin
  const earliest = new Date(Date.now() + MIN_LEAD_MIN * 60_000)
  const days: DayAvailabilityDTO[] = []

  for (
    let cursor = new Date(rangeStart);
    cursor <= to;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const day = atLocalMinutes(cursor, 0)
    const dateKey = toDateKey(day)
    const dayClosures = closures.filter((c) => toDateKey(new Date(c.date.getTime() + c.date.getTimezoneOffset() * 60_000)) === dateKey)
    const fullDayClosed = dayClosures.some((c) => c.startMin === null)
    const windows = location.openingHours.filter((w) => w.weekday === day.getDay())

    if (fullDayClosed || windows.length === 0) {
      days.push({ date: dateKey, closed: true, slots: [] })
      continue
    }

    const slots: SlotDTO[] = []
    for (const w of windows.sort((a, b) => a.startMin - b.startMin)) {
      for (let m = w.startMin; m + occupancy <= w.endMin; m += SLOT_STEP_MIN) {
        const start = atLocalMinutes(day, m)
        const end = new Date(start.getTime() + occupancy * 60_000)

        // Cierre parcial (p. ej. la tarde de un día concreto)
        const inClosure = dayClosures.some(
          (c) => c.startMin !== null && c.endMin !== null && m < c.endMin && c.startMin < m + occupancy,
        )

        const tooSoon = start < earliest
        const freeStaff = staff.find(
          (s) =>
            !bookings.some(
              (b) => b.staffId === s.id && overlaps(start, end, b.startsAt, b.blockedTo),
            ),
        )

        slots.push({
          startsAt: start.toISOString(),
          label: formatMinutes(m),
          available: !inClosure && !tooSoon && Boolean(freeStaff),
          staffId: freeStaff?.id ?? null,
        })
      }
    }

    days.push({ date: dateKey, closed: false, slots })
  }

  return days
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
export async function isWithinOpeningHours(
  businessId: string,
  start: Date,
  occupancyMin: number,
) {
  const location = await prisma.location.findFirst({
    where: { businessId },
    include: { openingHours: true, closures: true },
  })
  if (!location) return false

  const minutes = start.getHours() * 60 + start.getMinutes()
  const fits = location.openingHours.some(
    (w) => w.weekday === start.getDay() && minutes >= w.startMin && minutes + occupancyMin <= w.endMin,
  )
  if (!fits) return false

  const dateKey = toDateKey(start)
  const blocked = location.closures.some((c) => {
    const key = toDateKey(new Date(c.date.getTime() + c.date.getTimezoneOffset() * 60_000))
    if (key !== dateKey) return false
    if (c.startMin === null || c.endMin === null) return true
    return minutes < c.endMin && c.startMin < minutes + occupancyMin
  })
  return !blocked
}
