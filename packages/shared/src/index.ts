import { z } from 'zod'

/* ────────────────────────────────────────────────────────────
 * Mercado: España. Moneda EUR, locale es-ES, zona Europe/Madrid.
 * Los importes viajan SIEMPRE en céntimos (enteros) para no perder
 * precisión con floats.
 * ──────────────────────────────────────────────────────────── */

export const LOCALE = 'es-ES'
export const CURRENCY = 'EUR'
export const TIMEZONE = 'Europe/Madrid'

/* ── Categorías ─────────────────────────────────────────────── */

export const CATEGORIES = [
  { slug: 'talleres', label: 'Talleres mecánicos', singular: 'Taller' },
  { slug: 'peluquerias', label: 'Peluquerías y estética', singular: 'Peluquería' },
  { slug: 'academias', label: 'Academias y clases', singular: 'Academia' },
  { slug: 'veterinarias', label: 'Veterinarias', singular: 'Veterinaria' },
  { slug: 'gimnasios', label: 'Gimnasios', singular: 'Gimnasio' },
  { slug: 'autoescuelas', label: 'Autoescuelas', singular: 'Autoescuela' },
  { slug: 'profesionales', label: 'Servicios profesionales', singular: 'Servicio profesional' },
  { slug: 'tiendas', label: 'Tiendas de barrio', singular: 'Tienda' },
  { slug: 'bienestar', label: 'Bienestar', singular: 'Bienestar' },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export const categoryLabel = (slug: string) =>
  CATEGORIES.find((c) => c.slug === slug)?.singular ?? slug

/* ── Formato ────────────────────────────────────────────────── */

const eur = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
})

/** 5900 → "59,00 €" */
export const formatPrice = (cents: number) => eur.format(cents / 100)

/** 30 → "30 min" · 60 → "1 h" · 90 → "1 h 30 min" */
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** 600 → "10:00" (minutos desde medianoche) */
export function formatMinutes(minutesFromMidnight: number) {
  const h = Math.floor(minutesFromMidnight / 60)
  const m = minutesFromMidnight % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 1200 → "1,2 km" · 800 → "800 m" */
export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters / 50) * 50} m`
  return `${(meters / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} km`
}

export const WEEKDAYS_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const
export const WEEKDAYS_LONG = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const
export const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/** Fecha local (no UTC) en formato YYYY-MM-DD. */
export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** "2026-03-15" → Date a medianoche local. */
export function fromDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "martes 15 de marzo" */
export function formatLongDate(d: Date) {
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
}

/* ── Contratos de la API ────────────────────────────────────── */

export const BOOKING_SOURCES = ['MARKETPLACE', 'DIRECTO', 'INSTAGRAM', 'GOOGLE'] as const
export type BookingSource = (typeof BOOKING_SOURCES)[number]

/** Teléfono móvil o fijo español: 9 dígitos, admite prefijo +34 y separadores. */
export const phoneES = z
  .string()
  .trim()
  .refine(
    (v) => /^(?:\+34[\s-]?)?(?:\d[\s-]?){9}$/.test(v),
    'Introduce un teléfono español de 9 dígitos',
  )

export const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  /** ISO 8601 del inicio de la cita. */
  startsAt: z.string().datetime({ offset: true }),
  staffId: z.string().min(1).optional(),
  customer: z.object({
    name: z.string().trim().min(2, 'Escribe tu nombre y apellidos').max(120),
    phone: phoneES,
    email: z.string().trim().email('Revisa el email').optional().or(z.literal('')),
  }),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  source: z.enum(BOOKING_SOURCES).default('MARKETPLACE'),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(300).optional(),
})

/* ── Tipos de respuesta ─────────────────────────────────────── */

export interface ServiceDTO {
  id: string
  name: string
  description: string | null
  durationMin: number
  priceCents: number
}

export interface StaffDTO {
  id: string
  name: string
}

export interface LocationDTO {
  id: string
  name: string
  street: string
  city: string
  postalCode: string
  lat: number | null
  lng: number | null
}

export interface OpeningHourDTO {
  weekday: number
  startMin: number
  endMin: number
}

export interface BusinessSummaryDTO {
  id: string
  slug: string
  name: string
  category: string
  rating: number
  reviewCount: number
  city: string
  street: string
  photo: string | null
  fromPriceCents: number | null
}

export interface BusinessDTO extends BusinessSummaryDTO {
  description: string | null
  phone: string | null
  photos: string[]
  locations: LocationDTO[]
  services: ServiceDTO[]
  staff: StaffDTO[]
  openingHours: OpeningHourDTO[]
}

export interface SlotDTO {
  /** ISO 8601 con offset. */
  startsAt: string
  /** "10:00" ya en hora de Madrid. */
  label: string
  available: boolean
  staffId: string | null
}

export interface DayAvailabilityDTO {
  date: string
  closed: boolean
  slots: SlotDTO[]
}

export interface BookingDTO {
  id: string
  code: string
  status: 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA'
  startsAt: string
  endsAt: string
  priceCents: number
  notes: string | null
  source: BookingSource
  business: { id: string; slug: string; name: string }
  location: { name: string; street: string; city: string } | null
  service: { id: string; name: string; durationMin: number }
  staff: { id: string; name: string } | null
  customer: { name: string; phone: string; email: string | null }
}
