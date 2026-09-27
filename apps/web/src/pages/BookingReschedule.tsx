import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  formatLongDate,
  monthLong,
  toDateKey,
  weekdayShort,
  type DayAvailabilityDTO,
  type SlotDTO,
} from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { BackBar, Button, Card, EmptyState, ErrorNote, Spinner, cx } from '../components/ui'
import { MarbleWash } from '../components/Ornaments'
import { Reveal } from '../components/Reveal'
import { useIdioma } from '../i18n/idioma'

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const sameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b)

/** Lunes primero, como en el resto del producto. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

/**
 * Mover la propia cita a otra hora. A diferencia de reservar de cero, aquí no
 * se vuelve a elegir servicio, extras ni persona: solo cuándo. El servidor
 * asigna a quien quede libre, igual que el cambio de hora desde el panel.
 */
export function BookingReschedule() {
  const { t, idioma, locale } = useIdioma()
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [slot, setSlot] = useState<SlotDTO | null>(null)

  const { data: booking, isLoading: cargandoReserva } = useQuery({
    queryKey: ['booking', code],
    queryFn: () => api.getBooking(code),
  })

  const from = month > today ? month : today
  const to = useMemo(() => {
    const end = endOfMonth(month)
    const min = addDays(from, 13)
    return end > min ? end : min
  }, [month, from])

  const puedeMover = booking?.status === 'CONFIRMADA' && new Date(booking.startsAt) > new Date()

  const {
    data: availability,
    isLoading: cargandoHuecos,
    isError,
    error,
  } = useQuery({
    queryKey: ['reschedule-availability', code, toDateKey(from), toDateKey(to)],
    queryFn: () =>
      api.getRescheduleAvailability(code, { from: toDateKey(from), to: toDateKey(to) }),
    enabled: Boolean(puedeMover),
  })

  const byDate = useMemo(() => {
    const map = new Map<string, DayAvailabilityDTO>()
    for (const d of availability ?? []) map.set(d.date, d)
    return map
  }, [availability])

  const hasFree = (key: string) => byDate.get(key)?.slots.some((s) => s.available) ?? false

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

  const mover = useMutation({
    mutationFn: () => api.rescheduleMyBooking(code, slot!.startsAt),
    onSuccess: (actualizada) => {
      queryClient.setQueryData(['booking', code], actualizada)
      navigate(`/reserva/${code}`)
    },
  })

  if (cargandoReserva) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
        <EmptyState title={t('hecha.noEncontrada')} hint={t('hecha.noEncontradaPista')} />
      </div>
    )
  }

  if (!puedeMover) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
        <EmptyState title={t('reprog.noSePuede')} hint={t('reprog.noSePuedePista')} />
      </div>
    )
  }

  const start = new Date(booking.startsAt)
  const time = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  const nextDays = Array.from({ length: 14 }, (_, i) => addDays(today, i))

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

  return (
    <>
      <BackBar to={`/reserva/${code}`}>
        {booking.business.name} · {booking.service.name}
      </BackBar>

      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-10 overflow-x-clip px-6 py-8 lg:flex-row lg:px-16 lg:py-10">
        <MarbleWash
          className="-top-40 -right-20 hidden h-[640px] w-[640px] opacity-[.55] lg:block"
          seed={6}
        />
        <Reveal variant="left" className="min-w-0 flex-[1.4]">
          <h1 className="mb-2 text-[24px] font-semibold text-ink">{t('reprog.titulo')}</h1>
          <p className="mb-6 text-sm text-muted">
            {t('reprog.ahora', { fecha: formatLongDate(start, idioma), hora: time })}
          </p>

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
                      'flex h-[66px] w-[52px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-[background-color,color,transform] duration-150 active:scale-95',
                      active
                        ? 'bg-brand text-white'
                        : free
                          ? 'bg-fill text-ink hover:bg-line-strong'
                          : 'bg-cream text-disabled',
                    )}
                  >
                    <span className="text-caption font-medium opacity-80">
                      {weekdayShort(d.getDay(), idioma)}
                    </span>
                    <span className="text-ui font-semibold">{d.getDate()}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Calendario mensual — escritorio */}
          <div className="hidden lg:block">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink capitalize">
                {monthLong(month.getMonth(), idioma)} {month.getFullYear()}
              </h2>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  aria-label={t('fecha.mesAnterior')}
                  disabled={month <= startOfMonth(today)}
                  onClick={() => setMonth(addMonths(month, -1))}
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-subheading leading-none text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label={t('fecha.mesSiguiente')}
                  onClick={() => setMonth(addMonths(month, 1))}
                  className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-subheading leading-none text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                <div key={wd} className="text-center text-xs font-semibold text-subtle">
                  {weekdayShort(wd, idioma)}
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
                      'h-14 rounded-[9px] text-sm font-semibold transition-[background-color,color,border-color,transform] duration-150 active:scale-95',
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
        </Reveal>

        <Reveal
          variant="right"
          delay={100}
          as="aside"
          className="relative w-full shrink-0 lg:w-[340px]"
        >
          <Card className="p-6 shadow-pop lg:sticky lg:top-24">
            {cargandoHuecos && <Spinner label={t('fecha.buscandoHuecos')} />}
            {isError && <ErrorNote>{(error as Error).message}</ErrorNote>}

            {!cargandoHuecos && !isError && (
              <>
                <div className="mb-4 font-display text-base font-semibold text-ink first-letter:uppercase">
                  {selectedKey
                    ? formatLongDate(new Date(`${selectedKey}T00:00:00`), idioma)
                    : t('fecha.sinHuecos')}
                </div>

                {!selectedKey && <p className="text-sm text-muted">{t('fecha.sinHuecosPista')}</p>}

                {selectedDay && (
                  <>
                    {[
                      { id: 'manana', titulo: t('fecha.manana'), slots: morning },
                      { id: 'tarde', titulo: t('fecha.tarde'), slots: afternoon },
                    ]
                      .filter((g) => g.slots.length > 0)
                      .map((group) => (
                        <div key={group.id} className="mb-5">
                          <div className="mb-2.5 text-xs font-semibold tracking-[0.04em] text-muted uppercase">
                            {group.titulo}
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
                                  'text-body font-semibold transition-[background-color,color,border-color,transform] duration-200 active:scale-95',
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

                    {mover.isError && (
                      <ErrorNote>
                        {mover.error instanceof ApiError
                          ? mover.error.message
                          : t('reprog.noSePudo')}
                      </ErrorNote>
                    )}

                    <Button
                      size="lg"
                      className="mt-2 w-full"
                      disabled={!slot}
                      loading={mover.isPending}
                      onClick={() => slot && mover.mutate()}
                    >
                      {slot ? t('reprog.confirmar') : t('fecha.eligeHora')}
                    </Button>
                  </>
                )}
              </>
            )}
          </Card>
        </Reveal>
      </div>
    </>
  )
}
