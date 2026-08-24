import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  formatDuration,
  formatLongDate,
  formatPrice,
  fromDateKey,
  MONTHS_LONG,
  toDateKey,
  WEEKDAYS_SHORT,
  type DayAvailabilityDTO,
  type SlotDTO,
} from '@veline/shared'
import { api } from '../lib/api'
import { BackBar, Button, Card, ErrorNote, Spinner, cx } from '../components/ui'

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const sameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b)

/** Lunes primero, como en el mockup. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

export function BookingDate() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const serviceId = params.get('servicio') ?? ''

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [slot, setSlot] = useState<SlotDTO | null>(null)

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: () => api.getBusiness(slug),
  })

  const service = business?.services.find((s) => s.id === serviceId) ?? business?.services[0]

  // Ventana consultada: desde hoy (o el 1 del mes si es futuro) hasta fin de mes,
  // ampliada a 14 días para que el carrusel móvil no se quede corto a fin de mes.
  const from = month > today ? month : today
  const to = useMemo(() => {
    const end = endOfMonth(month)
    const min = addDays(from, 13)
    return end > min ? end : min
  }, [month, from])

  const {
    data: availability,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['availability', slug, service?.id, toDateKey(from), toDateKey(to)],
    queryFn: () =>
      api.getAvailability(slug, {
        serviceId: service!.id,
        from: toDateKey(from),
        to: toDateKey(to),
      }),
    enabled: Boolean(service),
  })

  const byDate = useMemo(() => {
    const map = new Map<string, DayAvailabilityDTO>()
    for (const d of availability ?? []) map.set(d.date, d)
    return map
  }, [availability])

  const hasFree = (key: string) => byDate.get(key)?.slots.some((s) => s.available) ?? false

  // Primer día con hueco libre
  useEffect(() => {
    if (!availability || selectedKey) return
    const first = availability.find((d) => d.slots.some((s) => s.available))
    if (first) setSelectedKey(first.date)
  }, [availability, selectedKey])

  const selectedDay = selectedKey ? byDate.get(selectedKey) : undefined
  const morning = selectedDay?.slots.filter((s) => Number(s.label.slice(0, 2)) < 14) ?? []
  const afternoon = selectedDay?.slots.filter((s) => Number(s.label.slice(0, 2)) >= 14) ?? []

  const pickDay = (key: string) => {
    setSelectedKey(key)
    setSlot(null)
  }

  if (!business || !service) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }

  // Rejilla del mes: se rellena con huecos vacíos hasta el primer lunes
  const first = startOfMonth(month)
  const daysInMonth = endOfMonth(month).getDate()
  const leading = mondayIndex(first)
  const cells: (Date | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1),
    ),
  ]

  const nextDays = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  return (
    <>
      <BackBar to={`/${slug}`}>
        {business.name} · {service.name}
      </BackBar>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 py-8 lg:flex-row lg:px-16 lg:py-10">
        <div className="min-w-0 flex-[1.4]">
          <h1 className="mb-6 text-[24px] font-semibold text-ink lg:hidden">Elige fecha y hora</h1>

          {/* Selector de servicio */}
          {business.services.length > 1 && (
            <label className="mb-6 block">
              <span className="mb-1.5 block text-meta font-semibold text-body">Servicio</span>
              <select
                value={service.id}
                onChange={(e) => {
                  setSlot(null)
                  setSelectedKey(null)
                  navigate(`/${slug}/reservar/fecha?servicio=${e.target.value}`, { replace: true })
                }}
                className="w-full max-w-[420px] rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink"
              >
                {business.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {formatDuration(s.durationMin)} · {formatPrice(s.priceCents)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Carrusel de días — móvil */}
          <div className="lg:hidden">
            <div className="-mx-6 flex gap-2.5 overflow-x-auto px-6 pb-2">
              {nextDays.map((d) => {
                const key = toDateKey(d)
                const free = hasFree(key)
                const active = key === selectedKey
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!free}
                    onClick={() => pickDay(key)}
                    className={cx(
                      'flex h-[66px] w-[52px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-colors',
                      active
                        ? 'bg-brand text-white'
                        : free
                          ? 'bg-fill text-ink hover:bg-line-strong'
                          : 'bg-cream text-disabled',
                    )}
                  >
                    <span className="text-caption font-medium opacity-80">
                      {WEEKDAYS_SHORT[d.getDay()]}
                    </span>
                    <span className="text-ui font-semibold">{d.getDate()}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Calendario mensual — desktop */}
          <div className="hidden lg:block">
            <div className="mb-5 flex items-center justify-between">
              <h1 className="font-display text-xl font-semibold text-ink capitalize">
                {MONTHS_LONG[month.getMonth()]} {month.getFullYear()}
              </h1>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  disabled={month <= startOfMonth(today)}
                  onClick={() => setMonth(addMonths(month, -1))}
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-subheading leading-none text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  onClick={() => setMonth(addMonths(month, 1))}
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-subheading leading-none text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-2">
              {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-subtle">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {cells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />
                const key = toDateKey(d)
                const past = d < today
                const free = hasFree(key)
                const active = key === selectedKey
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={past || !free}
                    onClick={() => pickDay(key)}
                    className={cx(
                      'h-14 rounded-[9px] text-sm font-semibold transition-colors',
                      active
                        ? 'bg-brand text-white'
                        : past || !free
                          ? 'border border-line bg-cream text-disabled'
                          : 'border border-line bg-surface text-ink hover:border-brand',
                      sameDay(d, today) && !active && 'ring-1 ring-brand/40',
                    )}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Panel de horas */}
        <aside className="w-full shrink-0 lg:w-[340px]">
          <Card className="p-6 lg:sticky lg:top-24">
            {isLoading && <Spinner label="Buscando huecos…" />}
            {isError && <ErrorNote>{(error as Error).message}</ErrorNote>}

            {!isLoading && !isError && (
              <>
                <div className="mb-4 font-display text-base font-semibold text-ink first-letter:uppercase">
                  {selectedKey
                    ? formatLongDate(fromDateKey(selectedKey))
                    : 'Sin huecos disponibles'}
                </div>

                {!selectedKey && (
                  <p className="text-sm text-muted">
                    No quedan huecos en este periodo. Prueba con el mes siguiente.
                  </p>
                )}

                {selectedDay && (
                  <>
                    {[
                      { title: 'Mañana', slots: morning },
                      { title: 'Tarde', slots: afternoon },
                    ]
                      .filter((g) => g.slots.length > 0)
                      .map((group) => (
                        <div key={group.title} className="mb-5">
                          <div className="mb-2.5 text-xs font-semibold tracking-[0.04em] text-muted uppercase">
                            {group.title}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {group.slots.map((s) => (
                              <button
                                key={s.startsAt}
                                type="button"
                                disabled={!s.available}
                                onClick={() => setSlot(s)}
                                className={cx(
                                  'inline-flex min-h-11 items-center justify-center rounded-full border',
                                  'text-body font-semibold transition-colors duration-200',
                                  slot?.startsAt === s.startsAt
                                    ? 'border-brand bg-brand text-white'
                                    : s.available
                                      ? 'border-line bg-surface text-ink hover:border-brand'
                                      : 'border-line bg-cream text-disabled',
                                )}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                    <div className="mt-6 flex justify-between border-t border-line pt-4 text-body">
                      <span className="text-muted">
                        {service.name}
                        {slot && ` · ${slot.label}`}
                      </span>
                      <span className="font-semibold text-ink">
                        {formatPrice(service.priceCents)}
                      </span>
                    </div>

                    <Button
                      className="mt-4 w-full"
                      disabled={!slot}
                      onClick={() =>
                        slot &&
                        navigate(
                          `/${slug}/reservar/confirmar?servicio=${service.id}&hora=${encodeURIComponent(slot.startsAt)}`,
                        )
                      }
                    >
                      {slot ? 'Continuar' : 'Elige una hora'}
                    </Button>
                  </>
                )}
              </>
            )}
          </Card>
        </aside>
      </div>
    </>
  )
}
