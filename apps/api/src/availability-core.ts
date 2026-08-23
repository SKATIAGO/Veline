import { formatMinutes, toDateKey, type DayAvailabilityDTO, type SlotDTO } from '@veline/shared'

/**
 * Núcleo del motor de disponibilidad: lógica pura, sin base de datos.
 *
 * Está separado de `availability.ts` a propósito. Es la regla de negocio más
 * delicada del producto —de ella depende que no se reserve dos veces el mismo
 * hueco— y con la consulta a Prisma dentro no había forma de probarla sin
 * levantar un Postgres. Aquí entran datos planos y salen huecos.
 *
 * Reglas:
 *  - Los huecos se ofrecen cada SLOT_STEP_MIN minutos dentro de cada franja
 *    de atención.
 *  - Una cita ocupa la agenda desde su inicio hasta `blockedTo`, es decir
 *    duración del servicio más su margen.
 *  - Un hueco está libre si al menos una persona activa no tiene nada
 *    solapado. Se devuelve cuál, para asignarla al reservar.
 *  - El hueco tiene que caber entero (duración + margen) dentro de la franja.
 *  - No se ofrecen huecos con menos de MIN_LEAD_MIN minutos de antelación.
 */

export const SLOT_STEP_MIN = 30
export const MIN_LEAD_MIN = 60
export const MAX_RANGE_DAYS = 62

export interface Franja {
  /** 0 = domingo … 6 = sábado, igual que Date#getDay */
  weekday: number
  startMin: number
  endMin: number
}

export interface Cierre {
  /** Clave local YYYY-MM-DD */
  dateKey: string
  /** null en ambos = el día entero */
  startMin: number | null
  endMin: number | null
}

export interface CitaOcupada {
  staffId: string | null
  startsAt: Date
  /** Fin real ocupado: fin de la cita más el margen del servicio. */
  blockedTo: Date
}

export interface EntradaDisponibilidad {
  from: Date
  to: Date
  /** Duración del servicio más su margen, en minutos. */
  occupancyMin: number
  franjas: Franja[]
  cierres: Cierre[]
  citas: CitaOcupada[]
  staffIds: string[]
  /** Momento actual. Parámetro explícito para poder fijarlo en los tests. */
  ahora: Date
}

/** Fecha local a N minutos de su medianoche. */
export function atLocalMinutes(day: Date, minutes: number): Date {
  const d = new Date(day)
  d.setHours(0, minutes, 0, 0)
  return d
}

/** Dos intervalos se solapan si cada uno empieza antes de que acabe el otro. */
export function seSolapan(aInicio: Date, aFin: Date, bInicio: Date, bFin: Date): boolean {
  return aInicio < bFin && bInicio < aFin
}

export function calcularDisponibilidad(e: EntradaDisponibilidad): DayAvailabilityDTO[] {
  const primeraHoraPosible = new Date(e.ahora.getTime() + MIN_LEAD_MIN * 60_000)
  const dias: DayAvailabilityDTO[] = []

  for (
    let cursor = atLocalMinutes(e.from, 0);
    cursor <= e.to;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const dia = atLocalMinutes(cursor, 0)
    const clave = toDateKey(dia)

    const cierresDelDia = e.cierres.filter((c) => c.dateKey === clave)
    const cerradoTodoElDia = cierresDelDia.some((c) => c.startMin === null)
    const franjasDelDia = e.franjas
      .filter((f) => f.weekday === dia.getDay())
      .sort((a, b) => a.startMin - b.startMin)

    if (cerradoTodoElDia || franjasDelDia.length === 0) {
      dias.push({ date: clave, closed: true, slots: [] })
      continue
    }

    const slots: SlotDTO[] = []
    for (const franja of franjasDelDia) {
      // El hueco tiene que caber entero dentro de la franja.
      for (let m = franja.startMin; m + e.occupancyMin <= franja.endMin; m += SLOT_STEP_MIN) {
        const inicio = atLocalMinutes(dia, m)
        const fin = new Date(inicio.getTime() + e.occupancyMin * 60_000)

        const enCierreParcial = cierresDelDia.some(
          (c) =>
            c.startMin !== null &&
            c.endMin !== null &&
            m < c.endMin &&
            c.startMin < m + e.occupancyMin,
        )
        const demasiadoPronto = inicio < primeraHoraPosible

        const personaLibre = e.staffIds.find(
          (id) =>
            !e.citas.some(
              (cita) =>
                cita.staffId === id && seSolapan(inicio, fin, cita.startsAt, cita.blockedTo),
            ),
        )

        slots.push({
          startsAt: inicio.toISOString(),
          label: formatMinutes(m),
          available: !enCierreParcial && !demasiadoPronto && Boolean(personaLibre),
          staffId: personaLibre ?? null,
        })
      }
    }

    dias.push({ date: clave, closed: false, slots })
  }

  return dias
}
