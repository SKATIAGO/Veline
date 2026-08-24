import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatLongDate, formatPrice, toDateKey } from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import {
  Badge,
  Card,
  ConfirmAction,
  EmptyState,
  ErrorNote,
  FilterChip,
  PageHeader,
  Skeleton,
  cx,
} from '../../components/ui'

const SOURCE_LABEL: Record<string, string> = {
  MARKETPLACE: 'Marketplace',
  DIRECTO: 'Directo',
  INSTAGRAM: 'Instagram',
  GOOGLE: 'Google',
}

/** Rangos que de verdad se miran: lo de hoy, la semana, y todo. */
const RANGOS = [
  { key: 'hoy', label: 'Hoy', dias: 0 },
  { key: 'semana', label: 'Próximos 7 días', dias: 7 },
  { key: 'todo', label: 'Todo', dias: null },
] as const

type RangoKey = (typeof RANGOS)[number]['key']

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-meta font-medium text-muted">{label}</div>
      <div className="mt-1.5 font-display text-heading font-semibold text-ink">{value}</div>
      {hint && <div className="mt-1 text-meta text-subtle">{hint}</div>}
    </Card>
  )
}

function BookingRow({ booking, slug }: { booking: PanelBooking; slug: string }) {
  const queryClient = useQueryClient()
  const cancel = useMutation({
    mutationFn: () => api.cancelBooking(booking.code, 'Cancelada desde el panel'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const start = new Date(booking.startsAt)
  const end = new Date(booking.endsAt)
  const fmt = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const cancelled = booking.status === 'CANCELADA'

  return (
    <li className="border-b border-line last:border-b-0">
      <div
        className={cx(
          'flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5',
          cancelled && 'opacity-55',
        )}
      >
        <div className="w-[92px] shrink-0">
          <div
            className={cx(
              'font-display text-subheading font-semibold text-ink tabular-nums',
              cancelled && 'line-through',
            )}
          >
            {fmt(start)}
          </div>
          <div className="text-meta text-subtle tabular-nums">hasta {fmt(end)}</div>
        </div>

        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui font-semibold text-ink">{booking.service.name}</span>
            {cancelled && <Badge tone="off">Cancelada</Badge>}
            {!cancelled && booking.isFirstFromMarketplace && <Badge tone="ok">Cliente nuevo</Badge>}
          </div>
          <p className="mt-0.5 text-meta text-muted">
            {booking.customer.name} ·{' '}
            <a href={`tel:${booking.customer.phone}`} className="hover:text-brand hover:underline">
              {booking.customer.phone}
            </a>
          </p>
          {booking.notes && <p className="mt-1 text-meta text-subtle italic">{booking.notes}</p>}
        </div>

        <div className="hidden w-[130px] text-meta text-muted sm:block">
          {booking.staff?.name ?? 'Sin asignar'}
        </div>

        <div className="w-[104px] text-right">
          <div className="text-ui font-semibold text-ink tabular-nums">
            {formatPrice(booking.priceCents)}
          </div>
          <div className="text-caption text-subtle">
            {SOURCE_LABEL[booking.source] ?? booking.source}
          </div>
        </div>

        <div className="ml-auto flex justify-end sm:ml-0 sm:w-[190px]">
          {!cancelled && (
            <ConfirmAction
              label="Cancelar"
              question={`¿Cancelar la de ${booking.customer.name.split(' ')[0]}?`}
              confirmLabel="Sí, cancelar"
              loading={cancel.isPending}
              onConfirm={() => cancel.mutate()}
            />
          )}
        </div>
      </div>

      {cancel.isError && (
        <div className="px-4 pb-4 sm:px-5">
          <ErrorNote>{(cancel.error as Error).message}</ErrorNote>
        </div>
      )}
    </li>
  )
}

export function PanelAgenda() {
  const { slug = '' } = useParams()
  const [rango, setRango] = useState<RangoKey>('semana')

  const { data: summary } = useQuery({
    queryKey: ['panel', slug, 'summary'],
    queryFn: () => api.panelSummary(slug),
  })

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['panel', slug, 'bookings'],
    queryFn: () => api.panelBookings(slug),
  })

  /* El filtro se aplica en el cliente porque la consulta ya trae los próximos
     14 días: pedir de nuevo al servidor para acortar la lista sería un viaje
     de ida y vuelta para no traer nada nuevo. */
  const grupos = useMemo(() => {
    const dias = RANGOS.find((r) => r.key === rango)?.dias
    const hoy = toDateKey(new Date())
    const limite =
      dias === null || dias === undefined
        ? null
        : toDateKey(new Date(Date.now() + dias * 86_400_000))

    const map = new Map<string, PanelBooking[]>()
    for (const b of bookings ?? []) {
      const key = toDateKey(new Date(b.startsAt))
      if (key < hoy) continue
      if (limite && key > limite) continue
      map.set(key, [...(map.get(key) ?? []), b])
    }
    return [...map.entries()]
  }, [bookings, rango])

  const total = grupos.reduce((n, [, filas]) => n + filas.length, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={summary?.business.name ?? 'Agenda'}
        hint={
          summary
            ? `${summary.serviceCount} servicios · ${summary.staffCount} personas en el equipo`
            : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-subheading font-semibold text-ink">
          Próximas citas
          {!isLoading && total > 0 && (
            <span className="ml-2 text-body font-normal text-muted">({total})</span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          {RANGOS.map((r) => (
            <FilterChip key={r.key} active={rango === r.key} onClick={() => setRango(r.key)}>
              {r.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </Card>
      ) : grupos.length === 0 ? (
        <EmptyState
          title={rango === 'hoy' ? 'Hoy no hay citas' : 'No hay citas en este periodo'}
          hint={
            rango === 'todo'
              ? 'Cuando alguien reserve aparecerá aquí automáticamente.'
              : 'Prueba a ampliar el periodo con los filtros de arriba.'
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map(([key, filas]) => (
            <section key={key}>
              <h3 className="mb-2 text-meta font-semibold tracking-[0.04em] text-muted uppercase">
                {formatLongDate(new Date(`${key}T00:00:00`))}
              </h3>
              <Card className="overflow-hidden">
                <ul>
                  {filas.map((b) => (
                    <BookingRow key={b.id} booking={b} slug={slug} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
