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
  /**
   * En qué local. Si no se dice, se usa el único que tenga el negocio.
   *
   * Es opcional a propósito: la inmensa mayoría de negocios tiene uno solo, y
   * obligar a elegir cuando no hay nada que elegir complicaría cada llamada
   * sin ganar nada. Con varios locales SÍ hay que decirlo — dar por bueno el
   * primero ofrecería los huecos del local equivocado.
   */
  locationId?: string
}

/**
 * El local sobre el que se calcula, con sus horarios.
 *
 * Con un local, el de siempre. Con varios y sin decir cuál, se niega en vez de
 * elegir por su cuenta: enseñar los huecos de un local y que el cliente
 * aparezca en el otro es peor que pedirle que elija.
 */
async function resolverLocal(businessId: string, locationId?: string) {
  if (locationId) {
    const l = await prisma.location.findFirst({
      // El businessId no sobra: sin él, cualquiera podría pedir los huecos de
      // un local de otro negocio pasando su id.
      where: { id: locationId, businessId },
      include: { openingHours: true },
    })
    if (!l) throw Object.assign(new Error('Local no encontrado'), { statusCode: 404 })
    return l
  }

  const locales = await prisma.location.findMany({
    where: { businessId },
    include: { openingHours: true },
    orderBy: { id: 'asc' },
  })
  if (locales.length === 0) {
    throw Object.assign(new Error('El negocio no tiene local'), { statusCode: 404 })
  }
  if (locales.length > 1) {
    throw Object.assign(new Error('Este negocio tiene varios locales: elige uno'), {
      statusCode: 400,
    })
  }
  return locales[0]
}

export async function getAvailability({
  businessId,
  serviceId,
  from,
  to,
  locationId,
}: AvailabilityRange): Promise<DayAvailabilityDTO[]> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, active: true },
  })
  if (!service) throw Object.assign(new Error('Servicio no encontrado'), { statusCode: 404 })

  const location = await resolverLocal(businessId, locationId)

  const rangeStart = atLocalMinutes(from, 0)
  const rangeEnd = atLocalMinutes(to, 24 * 60)

  const [staff, closures, bookings] = await Promise.all([
    /* Las personas de ESTE local. Las que no lo tienen asignado atienden en
       cualquiera: es lo que había antes de que existieran varios locales, y
       excluirlas dejaría sin huecos a todo negocio que no las haya repartido. */
    prisma.staff.findMany({
      where: {
        businessId,
        active: true,
        OR: [{ locationId: location.id }, { locationId: null }],
      },
      orderBy: { name: 'asc' },
    }),
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
  opts: {
    businessId: string
    start: Date
    end: Date
    preferredStaffId?: string
    /** El local de la cita. Sin él, cualquier persona del negocio vale. */
    locationId?: string
  },
) {
  const staff = await tx.staff.findMany({
    where: {
      businessId: opts.businessId,
      active: true,
      // Las mismas que ofrece el buscador: las de este local y las que no
      // tienen ninguno asignado. Si aquí entrara alguien de otro local, se
      // podría reservar con quien no está.
      ...(opts.locationId ? { OR: [{ locationId: opts.locationId }, { locationId: null }] } : {}),
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
  locationId?: string,
) {
  const location = locationId
    ? await prisma.location.findFirst({
        where: { id: locationId, businessId },
        include: { openingHours: true, closures: true },
      })
    : await prisma.location.findFirst({
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
