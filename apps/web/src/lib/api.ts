import type {
  BookingDTO,
  BusinessDTO,
  BusinessSummaryDTO,
  CreateBookingInput,
  DayAvailabilityDTO,
} from '@veline/shared'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(
      (body as { error?: string }).error ?? 'Algo ha ido mal',
      res.status,
      (body as { details?: unknown }).details,
    )
  }
  return body as T
}

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  listBusinesses: (params: { q?: string; category?: string; city?: string; limit?: number }) =>
    request<BusinessSummaryDTO[]>(`/businesses${qs(params)}`),

  getBusiness: (slug: string) => request<BusinessDTO>(`/businesses/${slug}`),

  getAvailability: (slug: string, params: { serviceId: string; from: string; to: string }) =>
    request<DayAvailabilityDTO[]>(`/businesses/${slug}/availability${qs(params)}`),

  createBooking: (slug: string, body: CreateBookingInput) =>
    request<BookingDTO>(`/businesses/${slug}/bookings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getBooking: (code: string) => request<BookingDTO>(`/bookings/${code}`),

  cancelBooking: (code: string, reason?: string) =>
    request<BookingDTO>(`/bookings/${code}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // ── Panel ──────────────────────────────────────────────────
  panelBusinesses: () =>
    request<{ id: string; slug: string; name: string; plan: string; category: string }[]>(
      '/panel/businesses',
    ),

  panelSummary: (slug: string) => request<PanelSummary>(`/panel/${slug}/summary`),

  panelBookings: (slug: string, params: { from?: string; to?: string } = {}) =>
    request<PanelBooking[]>(`/panel/${slug}/bookings${qs(params)}`),

  panelServices: (slug: string) => request<PanelService[]>(`/panel/${slug}/services`),

  createService: (slug: string, body: Partial<PanelService>) =>
    request<PanelService>(`/panel/${slug}/services`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateService: (slug: string, id: string, body: Partial<PanelService>) =>
    request<PanelService>(`/panel/${slug}/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteService: (slug: string, id: string) =>
    request<void>(`/panel/${slug}/services/${id}`, { method: 'DELETE' }),

  panelHours: (slug: string) => request<PanelHour[]>(`/panel/${slug}/hours`),

  saveHours: (slug: string, hours: Omit<PanelHour, 'id' | 'locationId'>[]) =>
    request<PanelHour[]>(`/panel/${slug}/hours`, {
      method: 'PUT',
      body: JSON.stringify({ hours }),
    }),
}

export interface PanelSummary {
  business: { id: string; slug: string; name: string; plan: string }
  todayCount: number
  weekCount: number
  weekRevenueCents: number
  weekCommissionCents: number
  newFromMarketplace: number
  staffCount: number
  serviceCount: number
}

export interface PanelBooking {
  id: string
  code: string
  status: 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA'
  startsAt: string
  endsAt: string
  priceCents: number
  commissionCents: number
  isFirstFromMarketplace: boolean
  source: string
  notes: string | null
  service: { id: string; name: string; durationMin: number }
  staff: { id: string; name: string } | null
  customer: { name: string; phone: string; email: string | null }
}

export interface PanelService {
  id: string
  name: string
  description: string | null
  durationMin: number
  bufferMin: number
  priceCents: number
  active: boolean
  position: number
}

export interface PanelHour {
  id: string
  locationId: string
  weekday: number
  startMin: number
  endMin: number
}
