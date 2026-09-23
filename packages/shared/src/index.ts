import { z } from 'zod'

/* ────────────────────────────────────────────────────────────
 * Mercado: España. Moneda EUR, locale es-ES, zona Europe/Madrid.
 * Los importes viajan SIEMPRE en céntimos (enteros) para no perder
 * precisión con floats.
 * ──────────────────────────────────────────────────────────── */

export const LOCALE = 'es-ES'
export const CURRENCY = 'EUR'
export const TIMEZONE = 'Europe/Madrid'

/**
 * Buzón de contacto de Veline. Vive aquí y solo aquí: lo enlaza la web y lo
 * llevan como Reply-To los correos que manda Veline, así que dos copias
 * acabarían desincronizadas. Antes había un `hola@veline.es` que no existía,
 * escrito a mano en dos páginas.
 */
export const CONTACT_EMAIL = 'contacto@veline.es'

/** Perfiles oficiales. El mismo motivo que el correo: un solo sitio de donde
 *  colgar el usuario, para no tener que buscar por la web quién lo escribió
 *  mal si un día cambia. */
export const SOCIAL = {
  instagram: { user: 'somosveline', url: 'https://instagram.com/somosveline' },
  facebook: { user: 'somosveline', url: 'https://facebook.com/somosveline' },
} as const

/* ── Planes y cuotas ────────────────────────────────────────
 * Los números viven aquí y no en la página de precios porque los usan tres
 * sitios: lo que se le enseña al visitante, lo que se le cobra al negocio y
 * lo que el sistema deja hacer. Tres copias del mismo precio acaban siempre
 * diciendo cosas distintas.
 */

export const PRUEBA_DIAS_DEFECTO = 15

export const PLAN_INFO = {
  GRATIS: {
    label: 'Gratis',
    labelEn: 'Free',
    /** Cuota mensual base, en céntimos. */
    priceCents: 0,
    /** Personas que atienden incluidas en la cuota. */
    seatsIncluded: 1,
    /** Cada persona de más, al mes. */
    extraSeatCents: 0,
    /** Mensajes incluidos al mes (email + SMS juntos). */
    messagesIncluded: 0,
  },
  NEGOCIO: {
    label: 'Negocio',
    labelEn: 'Business',
    priceCents: 1895,
    seatsIncluded: 2,
    extraSeatCents: 1095,
    messagesIncluded: 200,
  },
  EQUIPOS: {
    label: 'Equipo',
    labelEn: 'Team',
    priceCents: 1895,
    seatsIncluded: 2,
    extraSeatCents: 1095,
    messagesIncluded: 200,
  },
} as const

export type PlanKey = keyof typeof PLAN_INFO

/** El nombre del plan, en el idioma que toque. */
export const planLabel = (plan: string, idioma: Idioma = 'es') => {
  const info = PLAN_INFO[plan as PlanKey]
  if (!info) return plan
  return idioma === 'en' ? info.labelEn : info.label
}

/** Cada mensaje que pasa del cupo mensual. */
export const MENSAJE_EXTRA_CENTS = 6

/** 15 % del primer cliente que llega por el marketplace. */
export const COMMISSION_RATE = 0.15

export const SUB_STATUS_LABEL = {
  PRUEBA: 'En prueba',
  ACTIVA: 'Activa',
  IMPAGADA: 'Impagada',
  SUSPENDIDA: 'Suspendida',
  CANCELADA: 'Dada de baja',
} as const

const SUB_STATUS_LABEL_EN = {
  PRUEBA: 'On trial',
  ACTIVA: 'Active',
  IMPAGADA: 'Unpaid',
  SUSPENDIDA: 'Suspended',
  CANCELADA: 'Closed',
} as const

export type SubStatusKey = keyof typeof SUB_STATUS_LABEL

/** El estado de la suscripción, en el idioma que toque. */
export const subStatusLabel = (estado: string, idioma: Idioma = 'es') =>
  (idioma === 'en' ? SUB_STATUS_LABEL_EN : SUB_STATUS_LABEL)[estado as SubStatusKey] ?? estado

/**
 * Lo que cuesta un mes con este plan y estas personas.
 * La cuota no depende de cuánto se use: si tienes 4 personas con el plan
 * Negocio, son 18,95 € + 2 × 10,95 €.
 */
export function cuotaMensualCents(plan: PlanKey, personas: number) {
  const info = PLAN_INFO[plan]
  const extra = Math.max(0, personas - info.seatsIncluded)
  return info.priceCents + extra * info.extraSeatCents
}

/**
 * Cuántas personas hay en el calendario, contando al administrador.
 *
 * El administrador no tiene fila en Empleados a menos que se añada él mismo,
 * pero ocupa una plaza igual: seatsIncluded empieza en 2 (el administrador y
 * 1 más) precisamente por eso. Sin este +1, un negocio con el administrador y
 * 2 empleados (3 personas reales) se cobraba como si tuviera 2.
 */
export function plazasDelNegocio(empleadosCount: number) {
  return empleadosCount + 1
}

/** Un negocio suspendido o dado de baja deja de aceptar reservas nuevas. */
export function aceptaReservas(status: SubStatusKey, trialEndsAt: Date | string | null) {
  if (status === 'SUSPENDIDA' || status === 'CANCELADA') return false
  // La prueba caducada se comporta como suspendida hasta que alguien pague o
  // se le amplíe: si no, la prueba de 15 días sería infinita.
  if (status === 'PRUEBA' && trialEndsAt && new Date(trialEndsAt).getTime() < Date.now()) {
    return false
  }
  return true
}

/**
 * Los idiomas del producto.
 *
 * Vive aquí porque lo necesitan los dos lados: la web para pintar y el API
 * para escribir los correos en el idioma de quien reserva.
 */
export type Idioma = 'es' | 'en'

/* ── Categorías ─────────────────────────────────────────────── */

/**
 * Los sectores.
 *
 * El inglés va aquí y no en el diccionario de la web porque estas etiquetas
 * las usan los dos lados: la web las pinta y el API las mete en los correos.
 * Partirlas en dos sitios acabaría con «Peluquerías y estética» en la pantalla
 * inglesa y nadie sabría por qué.
 *
 * `singular` es para hablar de UN negocio («Taller», «Peluquería»); `label` es
 * el nombre del sector entero, que es lo que se pone en los filtros.
 */
export const CATEGORIES = [
  {
    slug: 'talleres',
    label: 'Talleres mecánicos',
    singular: 'Taller',
    labelEn: 'Garages',
    singularEn: 'Garage',
  },
  {
    slug: 'peluquerias',
    label: 'Peluquerías y estética',
    singular: 'Peluquería',
    labelEn: 'Hair & beauty',
    singularEn: 'Salon',
  },
  {
    slug: 'academias',
    label: 'Academias y clases',
    singular: 'Academia',
    labelEn: 'Tutoring & classes',
    singularEn: 'Tutoring centre',
  },
  {
    slug: 'veterinarias',
    label: 'Veterinarios',
    singular: 'Veterinario',
    labelEn: 'Vets',
    singularEn: 'Vet',
  },
  {
    slug: 'gimnasios',
    label: 'Gimnasios',
    singular: 'Gimnasio',
    labelEn: 'Gyms',
    singularEn: 'Gym',
  },
  {
    slug: 'autoescuelas',
    label: 'Autoescuelas',
    singular: 'Autoescuela',
    labelEn: 'Driving schools',
    singularEn: 'Driving school',
  },
  {
    slug: 'profesionales',
    label: 'Servicios profesionales',
    singular: 'Servicio profesional',
    labelEn: 'Professional services',
    singularEn: 'Professional service',
  },
  {
    slug: 'asesorias',
    label: 'Asesorías y despachos',
    singular: 'Asesoría',
    labelEn: 'Accountants & law firms',
    singularEn: 'Firm',
  },
  {
    slug: 'tiendas',
    label: 'Tiendas de barrio',
    singular: 'Tienda',
    labelEn: 'Local shops',
    singularEn: 'Shop',
  },
  {
    slug: 'bienestar',
    label: 'Bienestar',
    singular: 'Bienestar',
    labelEn: 'Wellbeing',
    singularEn: 'Wellbeing',
  },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export const categoryLabel = (slug: string, idioma: Idioma = 'es') => {
  const c = CATEGORIES.find((x) => x.slug === slug)
  if (!c) return slug
  return idioma === 'en' ? c.singularEn : c.singular
}

/** El nombre del sector en el idioma que toque. En castellano sigue saliendo
    exactamente lo de antes. */
export const categoryName = (slug: string, idioma: Idioma = 'es') => {
  const c = CATEGORIES.find((x) => x.slug === slug)
  if (!c) return slug
  return idioma === 'en' ? c.labelEn : c.label
}

/* ── Formato ────────────────────────────────────────────────── */

/** Los precios son en euros siempre —el negocio está en España— pero se
    escriben como los escribe cada idioma: «59,00 €» y «€59.00». */
const EUR: Record<Idioma, Intl.NumberFormat> = {
  es: new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
  }),
  en: new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
  }),
}

/** 5900 → "59,00 €" · en inglés, "€59.00" */
export const formatPrice = (cents: number, idioma: Idioma = 'es') => EUR[idioma].format(cents / 100)

/** 30 → "30 min" · 60 → "1 h" · 90 → "1 h 30 min" */
export function formatDuration(minutes: number, idioma: Idioma = 'es') {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  // «1 hr 30 min»: en inglés «1 h» a secas no se usa fuera de la física.
  const uh = idioma === 'en' ? 'hr' : 'h'
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} ${uh}`
  return `${h} ${uh} ${m} min`
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
export const WEEKDAYS_SHORT_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
export const WEEKDAYS_LONG_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
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
export const MONTHS_LONG_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const weekdayShort = (dia: number, idioma: Idioma = 'es') =>
  (idioma === 'en' ? WEEKDAYS_SHORT_EN : WEEKDAYS_SHORT)[dia]
export const weekdayLong = (dia: number, idioma: Idioma = 'es') =>
  (idioma === 'en' ? WEEKDAYS_LONG_EN : WEEKDAYS_LONG)[dia]
export const monthLong = (mes: number, idioma: Idioma = 'es') =>
  (idioma === 'en' ? MONTHS_LONG_EN : MONTHS_LONG)[mes]

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

/** "martes 15 de marzo" · en inglés, "Tuesday 15 March" */
export function formatLongDate(d: Date, idioma: Idioma = 'es') {
  if (idioma === 'en') {
    return `${WEEKDAYS_LONG_EN[d.getDay()]} ${d.getDate()} ${MONTHS_LONG_EN[d.getMonth()]}`
  }
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

/**
 * Un extra pedido y cuántas veces.
 *
 * La cantidad existe porque hay extras que se venden por unidad —un arreglo de
 * uña, una copa— y en el mostrador «tres» y «uno» no son lo mismo. Va como
 * número y no repitiendo el id: así el precio y los minutos se multiplican en
 * un solo sitio y no dependen de que el cliente mande la lista bien.
 */
export const extraPedidoSchema = z.object({
  extraId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
})

export type ExtraPedido = z.infer<typeof extraPedidoSchema>

/**
 * Los extras viajan por la URL entre las pantallas de la reserva, y de ahí a
 * la consulta de huecos del servidor: `corte:2,tinte`. Sin `:n` es uno, que es
 * el caso normal y deja los enlaces cortos.
 *
 * Parsear y escribir viven juntos y aquí, en lo compartido, porque el que
 * escribe (la web) y el que lee (la API) tienen que entender exactamente lo
 * mismo: si se separaran, el día que cambie el formato una mitad se enteraría
 * y la otra no.
 */
export function parseExtrasParam(valor: string | null | undefined): ExtraPedido[] {
  const pedidos: ExtraPedido[] = []
  for (const trozo of (valor ?? '').split(',')) {
    if (!trozo) continue
    const [extraId, cantidad] = trozo.split(':')
    if (!extraId) continue
    const quantity = cantidad === undefined ? 1 : Number(cantidad)
    // Una cantidad rara —texto, 0, decimales— se lee como uno: el extra se
    // eligió, y perderlo por un enlace mal copiado sería peor.
    pedidos.push({
      extraId,
      quantity: Number.isInteger(quantity) && quantity >= 1 ? Math.min(quantity, 20) : 1,
    })
  }
  return pedidos
}

export function extrasParam(pedidos: ExtraPedido[]): string {
  return pedidos
    .filter((p) => p.quantity >= 1)
    .map((p) => (p.quantity === 1 ? p.extraId : `${p.extraId}:${p.quantity}`))
    .join(',')
}

export const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  /** ISO 8601 del inicio de la cita. */
  startsAt: z.string().datetime({ offset: true }),
  staffId: z.string().min(1).optional(),
  /** En qué local. Solo hace falta cuando el negocio tiene más de uno. */
  locationId: z.string().min(1).optional(),
  customer: z.object({
    name: z.string().trim().min(2, 'Escribe tu nombre y apellidos').max(120),
    phone: phoneES,
    email: z.string().trim().email('Revisa el email').optional().or(z.literal('')),
  }),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  source: z.enum(BOOKING_SOURCES).default('MARKETPLACE'),
  /**
   * En qué idioma estaba mirando la web quien reserva.
   *
   * Por defecto castellano: así una petición vieja —o cualquiera que no lo
   * mande— sigue valiendo y se comporta como hasta ahora. De esto salen SUS
   * avisos; los del negocio van en el idioma del negocio, que es otra cosa.
   */
  idioma: z.enum(['es', 'en']).default('es'),
  /**
   * Extras de la carta del negocio que quiere añadir, y cuántas veces cada
   * uno. Solo el id y la cantidad: el nombre, el precio y los minutos los
   * pone el servidor, que es quien sabe lo que valen.
   */
  extras: z.array(extraPedidoSchema).max(20).default([]),
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

/** Un extra de la carta del negocio, tal y como lo ve quien reserva. */
export interface ExtraDTO {
  id: string
  name: string
  description: string | null
  priceCents: number
  /** Lo que alarga la cita, en minutos. 0 = no la alarga. */
  durationMin: number
  photo: string | null
}

/** Un extra ya elegido en una cita, con el precio y los minutos que tenía al reservar. */
export interface BookingExtraDTO {
  name: string
  /** De UNA unidad: lo que se cobra es este precio por la cantidad. */
  priceCents: number
  /** De UNA unidad, igual que el precio. */
  durationMin: number
  quantity: number
}

export interface StaffDTO {
  id: string
  name: string
  /** Null = atiende en cualquier local. */
  locationId: string | null
}

export interface LocationDTO {
  id: string
  name: string
  street: string
  city: string
  postalCode: string
  lat: number | null
  lng: number | null
  /** El horario de este local. Cada uno tiene el suyo. */
  openingHours: OpeningHourDTO[]
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
  /** La carta de extras: la misma para todos los servicios. */
  extras: ExtraDTO[]
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
  status: 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA' | 'NO_ASISTIO'
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
  /** priceCents ya los incluye. */
  extras: BookingExtraDTO[]
}
