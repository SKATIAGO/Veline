import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatLongDate, formatPrice, toDateKey } from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { Button, Card, EmptyState, Spinner, cx } from '../../components/ui'

const SOURCE_LABEL: Record<string, string> = {
  MARKETPLACE: 'Marketplace',
  DIRECTO: 'Directo',
  INSTAGRAM: 'Instagram',
  GOOGLE: 'Google',
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-[12.5px] font-medium text-muted">{label}</div>
      <div className="mt-1.5 font-display text-[26px] font-semibold text-ink">{value}</div>
      {hint && <div className="mt-1 text-[12px] text-subtle">{hint}</div>}
    </Card>
  )
}

function BookingRow({ booking, slug }: { booking: PanelBooking; slug: string }) {
  const queryClient = useQueryClient()
  const cancel = useMutation({
    mutationFn: () => api.cancelBooking(booking.code, 'Cancelada desde el panel'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    },
  })

  const start = new Date(booking.startsAt)
  const end = new Date(booking.endsAt)
  const fmt = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const cancelled = booking.status === 'CANCELADA'

  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-b-0',
        cancelled && 'opacity-55',
      )}
    >
      <div className="w-[104px] shrink-0">
        <div className={cx('font-display text-lg font-semibold text-ink', cancelled && 'line-through')}>
          {fmt(start)}
        </div>
        <div className="text-[12px] text-subtle">hasta {fmt(end)}</div>
      </div>

      <div className="min-w-[180px] flex-1">
        <div className="font-semibold text-ink">{booking.service.name}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {booking.customer.name} · {booking.customer.phone}
        </div>
        {booking.notes && <div className="mt-1 text-[12.5px] text-subtle italic">{booking.notes}</div>}
      </div>

      <div className="hidden w-[140px] text-[13px] text-muted sm:block">
        {booking.staff?.name ?? 'Sin asignar'}
      </div>

      <div className="w-[120px] text-right">
        <div className="font-semibold text-ink">{formatPrice(booking.priceCents)}</div>
        <div className="text-[11.5px] text-subtle">
          {SOURCE_LABEL[booking.source] ?? booking.source}
          {booking.isFirstFromMarketplace && ' · nuevo'}
        </div>
      </div>

      <div className="w-[110px] text-right">
        {cancelled ? (
          <span className="text-[12.5px] font-semibold text-muted">Cancelada</span>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (confirm(`¿Cancelar la cita de ${booking.customer.name}?`)) cancel.mutate()
            }}
            disabled={cancel.isPending}
            className="text-[12.5px] font-semibold text-muted underline hover:text-brand"
          >
            {cancel.isPending ? 'Cancelando…' : 'Cancelar'}
          </button>
        )}
      </div>
    </div>
  )
}

export function PanelAgenda() {
  const { slug = '' } = useParams()

  const { data: summary } = useQuery({
    queryKey: ['panel', slug, 'summary'],
    queryFn: () => api.panelSummary(slug),
  })

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['panel', slug, 'bookings'],
    queryFn: () => api.panelBookings(slug),
  })

  const grouped = new Map<string, PanelBooking[]>()
  for (const b of bookings ?? []) {
    const key = toDateKey(new Date(b.startsAt))
    grouped.set(key, [...(grouped.get(key) ?? []), b])
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">
        {summary?.business.name ?? 'Agenda'}
      </h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Citas hoy" value={String(summary?.todayCount ?? 0)} />
        <Stat label="Próximos 7 días" value={String(summary?.weekCount ?? 0)} />
        <Stat
          label="Ingresos 7 días"
          value={formatPrice(summary?.weekRevenueCents ?? 0)}
          hint={
            summary?.weekCommissionCents
              ? `Comisión Veline: ${formatPrice(summary.weekCommissionCents)}`
              : 'Sin comisión esta semana'
          }
        />
        <Stat
          label="Clientes nuevos"
          value={String(summary?.newFromMarketplace ?? 0)}
          hint="Descubiertos vía marketplace"
        />
      </div>

      <h2 className="mb-4 font-display text-lg font-semibold text-ink">Próximas citas</h2>

      {isLoading ? (
        <Spinner />
      ) : grouped.size === 0 ? (
        <EmptyState
          title="No hay citas en los próximos 14 días"
          hint="Cuando alguien reserve aparecerá aquí automáticamente."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...grouped.entries()].map(([key, rows]) => (
            <div key={key}>
              <div className="mb-2 text-[12.5px] font-semibold tracking-[0.04em] text-muted uppercase">
                {formatLongDate(new Date(`${key}T00:00:00`))}
              </div>
              <Card className="overflow-hidden">
                {rows.map((b) => (
                  <BookingRow key={b.id} booking={b} slug={slug} />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
