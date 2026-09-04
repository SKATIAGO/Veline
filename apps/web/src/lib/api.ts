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

  // ── Sesión ─────────────────────────────────────────────────
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: AuthUser }>('/auth/me'),

  forgotPassword: (email: string) =>
    request<{ ok: true }>('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: true }>('/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  changePassword: (current: string, next: string) =>
    request<{ ok: true }>('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current, next }),
    }),

  // ── Equipo del negocio (ADMIN) ─────────────────────────────
  panelUsers: (slug: string) => request<PanelUser[]>(`/panel/${slug}/users`),

  createPanelUser: (
    slug: string,
    body: { name: string; email: string; password: string; role: 'ADMIN' | 'EMPLEADO' },
  ) => request<PanelUser>(`/panel/${slug}/users`, { method: 'POST', body: JSON.stringify(body) }),

  setPanelUserActive: (slug: string, id: string, active: boolean) =>
    request<{ ok: true }>(`/panel/${slug}/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  // ── Suscripción (SUPERADMIN) ───────────────────────────────
  updateSubscription: (
    businessId: string,
    body: {
      plan?: 'GRATIS' | 'NEGOCIO' | 'EQUIPOS'
      status?: 'PRUEBA' | 'ACTIVA' | 'IMPAGADA' | 'SUSPENDIDA' | 'CANCELADA'
      trialDays?: number
      adminNotes?: string
    },
  ) =>
    request<{
      plan: string
      subStatus: string
      trialEndsAt: string | null
      adminNotes: string | null
    }>(`/admin/businesses/${businessId}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // ── Personas que atienden ──────────────────────────────────
  panelStaff: (slug: string) => request<PanelStaff[]>(`/panel/${slug}/staff`),

  createStaff: (slug: string, name: string) =>
    request<PanelStaff>(`/panel/${slug}/staff`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateStaff: (slug: string, id: string, body: { name?: string; active?: boolean }) =>
    request<PanelStaff>(`/panel/${slug}/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // ── Cierres (vacaciones y festivos) ────────────────────────
  panelClosures: (slug: string) => request<PanelClosure[]>(`/panel/${slug}/closures`),

  createClosure: (slug: string, body: { from: string; to: string; reason?: string }) =>
    request<{ from: string; to: string; days: number; affectedBookings: number }>(
      `/panel/${slug}/closures`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  deleteClosure: (slug: string, ids: string[]) =>
    request<void>(`/panel/${slug}/closures`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),

  // ── Ficha del negocio ──────────────────────────────────────
  panelProfile: (slug: string) => request<PanelProfile>(`/panel/${slug}/profile`),

  saveProfile: (slug: string, body: Omit<PanelProfile, 'slug' | 'photos'>) =>
    request<{ ok: true }>(`/panel/${slug}/profile`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  savePhotos: (slug: string, photos: string[]) =>
    request<{ ok: true; photos: string[] }>(`/panel/${slug}/photos`, {
      method: 'PUT',
      body: JSON.stringify({ photos }),
    }),

  // ── Agenda operativa ───────────────────────────────────────
  createManualBooking: (
    slug: string,
    body: {
      serviceId: string
      startsAt: string
      staffId?: string
      customerName: string
      customerPhone: string
      customerEmail?: string
      notes?: string
    },
  ) =>
    request<{ id: string; code: string }>(`/panel/${slug}/bookings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  rescheduleBooking: (slug: string, id: string, startsAt: string) =>
    request<{ ok: true; startsAt: string }>(`/panel/${slug}/bookings/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ startsAt }),
    }),

  setBookingOutcome: (
    slug: string,
    id: string,
    status: 'COMPLETADA' | 'NO_ASISTIO' | 'CONFIRMADA',
  ) =>
    request<{ ok: true; status: string }>(`/panel/${slug}/bookings/${id}/outcome`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // ── Registro de actividad (ADMIN y SUPERADMIN) ─────────────
  auditLog: (params: { businessId?: string; action?: string; cursor?: string; limit?: number }) =>
    request<{ entries: AuditEntry[]; nextCursor: string | null }>(`/audit${qs(params)}`),

  // ── Plataforma (SUPERADMIN) ────────────────────────────────
  adminBusinesses: () => request<AdminBusiness[]>('/admin/businesses'),

  createAdminBusiness: (body: {
    name: string
    category: string
    email: string
    phone?: string
    street: string
    city: string
    postalCode: string
  }) =>
    request<{ id: string; slug: string; name: string }>('/admin/businesses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  /** Todos los usuarios de la plataforma, con su negocio. */
  adminUsers: () => request<AdminUser[]>('/admin/users'),

  setAdminUserActive: (id: string, active: boolean) =>
    request<{ ok: true }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  createAdminUser: (body: {
    name: string
    email: string
    password: string
    role: 'ADMIN' | 'EMPLEADO'
    businessId: string
  }) =>
    request<{ id: string; email: string }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export interface PanelSubscription {
  plan: 'GRATIS' | 'NEGOCIO' | 'EQUIPOS'
  status: 'PRUEBA' | 'ACTIVA' | 'IMPAGADA' | 'SUSPENDIDA' | 'CANCELADA'
  trialEndsAt: string | null
  accepting: boolean
  monthlyCents: number
}

export interface PanelSummary {
  business: { id: string; slug: string; name: string; plan: string }
  subscription: PanelSubscription | null
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
  status: 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA' | 'NO_ASISTIO'
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

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'SUPERADMIN' | 'ADMIN' | 'EMPLEADO'
  businessSlug: string | null
  businessName: string | null
}

export interface PanelUser {
  id: string
  name: string
  email: string
  role: 'SUPERADMIN' | 'ADMIN' | 'EMPLEADO'
  active: boolean
  createdAt: string
}

export interface AdminBusiness {
  id: string
  slug: string
  name: string
  category: string
  plan: 'GRATIS' | 'NEGOCIO' | 'EQUIPOS'
  email: string | null
  createdAt: string
  counts: { bookings: number; users: number; services: number; staff: number }
  subStatus: 'PRUEBA' | 'ACTIVA' | 'IMPAGADA' | 'SUSPENDIDA' | 'CANCELADA'
  trialEndsAt: string | null
  adminNotes: string | null
  monthlyCents: number
  accepting: boolean
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: 'SUPERADMIN' | 'ADMIN' | 'EMPLEADO'
  active: boolean
  business: { slug: string; name: string } | null
  createdAt: string
}

export interface AuditEntry {
  id: string
  action: string
  summary: string
  actorName: string | null
  actorEmail: string | null
  actorRole: 'SUPERADMIN' | 'ADMIN' | 'EMPLEADO' | null
  business: { slug: string; name: string } | null
  entity: string | null
  entityId: string | null
  metadata: unknown
  /** Solo llega al superadmin; para un admin siempre es null. */
  ip: string | null
  createdAt: string
}

export interface PanelStaff {
  id: string
  name: string
  active: boolean
  upcomingBookings?: number
}

export interface PanelClosure {
  from: string
  to: string
  reason: string | null
  ids: string[]
}

export interface PanelProfile {
  slug: string
  name: string
  category: string
  description: string
  phone: string
  email: string
  photos: string[]
  street: string
  city: string
  postalCode: string
}
