import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  formatDuration,
  formatLongDate,
  extrasParam,
  formatPrice,
  fromDateKey,
  monthLong,
  toDateKey,
  weekdayShort,
  type DayAvailabilityDTO,
  type SlotDTO,
} from '@veline/shared'
import { api } from '../lib/api'
import { extrasDeUrl, tramoExtras } from '../lib/reserva'
import { BackBar, Button, Card, ErrorNote, Spinner, cx } from '../components/ui'
import { MarbleWash } from '../components/Ornaments'
import { Reveal } from '../components/Reveal'
import { useIdioma } from '../i18n/idioma'

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const sameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b)

/** Lunes primero, como en el mockup. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

export function BookingDate() {
  const { t, idioma } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const serviceId = params.get('servicio') ?? ''
  const localPedido = params.get('local') ?? ''
  // Elegidos en el paso anterior. Aquí no se tocan: solo se conservan y se
  // suman al total, para que el precio de esta pantalla sea el de verdad.
  const pedidos = extrasDeUrl(params)

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

  /* Con un solo local no se pregunta nada. Con varios hay que elegir, porque
     el horario y quién atiende son de cada uno: enseñar los huecos de uno y
     que el cliente aparezca en el otro es peor que preguntarle. */
  const locales = business?.locations ?? []
  const local = locales.find((l) => l.id === localPedido) ?? locales[0]
  const varios = locales.length > 1

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
    // El local va en la clave: sin él, cambiar de local enseñaría los huecos
    // del anterior sacados de la caché.
    /* Los extras van en la clave: alargan la cita, así que unos huecos con
       extras no valen para la misma fecha sin ellos. */
    queryKey: [
      'availability',
      slug,
      service?.id,
      local?.id,
      extrasParam(pedidos),
      toDateKey(from),
      toDateKey(to),
    ],
    queryFn: () =>
      api.getAvailability(slug, {
        serviceId: service!.id,
        from: toDateKey(from),
        to: toDateKey(to),
        ...(local ? { locationId: local.id } : {}),
        ...(pedidos.length ? { extras: extrasParam(pedidos) } : {}),
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

  /* Solo cuentan los extras que siguen en la carta del negocio. */
  const elegidos = pedidos.flatMap((p) => {
    const extra = business.extras.find((e) => e.id === p.extraId)
    return extra ? [{ extra, cantidad: p.quantity }] : []
  })
  const total =
    service.priceCents + elegidos.reduce((suma, l) => suma + l.extra.priceCents * l.cantidad, 0)
  const tramoComun = `servicio=${service.id}${local ? `&local=${local.id}` : ''}${tramoExtras(
    elegidos.map((l) => ({ extraId: l.extra.id, quantity: l.cantidad })),
  )}`
  /* Atrás vuelve a los extras si el negocio tiene carta, que es el paso que
     de verdad se acaba de dejar; si no la tiene, a la ficha. */
  const volverA = business.extras.length > 0 ? `/${slug}/reservar/extras?${tramoComun}` : `/${slug}`

  return (
    <>
      <BackBar to={volverA}>
        {business.name} · {service.name}
      </BackBar>

      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-10 overflow-x-clip px-6 py-8 lg:flex-row lg:px-16 lg:py-10">
        {/* Mismo halo que ya usan Precios y Alta: 620 px es lo que hace falta
            para que se note contra un fondo claro; algo más pequeño se disuelve
            en el desenfoque. overflow-x-clip dentro de la fila (no aquí, en el
            padre) evita el scroll horizontal sin tocar la posición fija de la
            tarjeta de 340. */}
        <MarbleWash
          className="-top-40 -right-20 hidden h-[640px] w-[640px] opacity-[.55] lg:block"
          seed={6}
        />
        <Reveal variant="left" className="min-w-0 flex-[1.4]">
          <h1 className="mb-6 text-[24px] font-semibold text-ink lg:hidden">{t('fecha.titulo')}</h1>

          {/* Selector de local: solo si hay más de uno que elegir. */}
          {varios && (
            <label className="mb-6 block">
              <span className="mb-1.5 block text-meta font-semibold text-body">
                {t('fecha.local')}
              </span>
              <select
                value={local?.id ?? ''}
                onChange={(e) => {
                  setSlot(null)
                  setSelectedKey(null)
                  navigate(
                    `/${slug}/reservar/fecha?servicio=${service.id}&local=${e.target.value}`,
                    { replace: true },
                  )
                }}
                className="w-full max-w-[420px] rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink"
              >
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · {l.street}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Selector de servicio */}
          {business.services.length > 1 && (
            <label className="mb-6 block">
              <span className="mb-1.5 block text-meta font-semibold text-body">
                {t('fecha.servicio')}
              </span>
              <select
                value={service.id}
                onChange={(e) => {
                  setSlot(null)
                  setSelectedKey(null)
                  navigate(
                    `/${slug}/reservar/fecha?servicio=${e.target.value}${local ? `&local=${local.id}` : ''}`,
                    { replace: true },
                  )
                }}
                className="w-full max-w-[420px] rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink"
              >
                {business.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {formatDuration(s.durationMin, idioma)} ·{' '}
                    {formatPrice(s.priceCents, idioma)}
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

          {/* Calendario mensual — desktop */}
          <div className="hidden lg:block">
            <div className="mb-5 flex items-center justify-between">
              <h1 className="font-display text-xl font-semibold text-ink capitalize">
                {monthLong(month.getMonth(), idioma)} {month.getFullYear()}
              </h1>
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
              {/* La semana empieza en lunes: 1..6 y el domingo al final. */}
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

        {/* Panel de horas: entra un pelín después, desde la derecha — el ojo
            sigue primero el calendario y luego aterriza aquí. */}
        <Reveal
          variant="right"
          delay={100}
          as="aside"
          className="relative w-full shrink-0 lg:w-[340px]"
        >
          <Card className="p-6 shadow-pop lg:sticky lg:top-24">
            {isLoading && <Spinner label={t('fecha.buscandoHuecos')} />}
            {isError && <ErrorNote>{(error as Error).message}</ErrorNote>}

            {!isLoading && !isError && (
              <>
                <div className="mb-4 font-display text-base font-semibold text-ink first-letter:uppercase">
                  {selectedKey
                    ? formatLongDate(fromDateKey(selectedKey), idioma)
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

                    <div className="mt-6 border-t border-line pt-4 text-body">
                      <div className="flex justify-between gap-4">
                        <span className="min-w-0 text-muted">
                          {service.name}
                          {slot && ` · ${slot.label}`}
                        </span>
                        <span className="shrink-0 font-semibold text-ink tabular-nums">
                          {formatPrice(service.priceCents, idioma)}
                        </span>
                      </div>

                      {/* Los extras ya elegidos: sin esto el precio de aquí
                          contradiría al de la confirmación. */}
                      {elegidos.map(({ extra, cantidad }) => (
                        <div key={extra.id} className="mt-2.5 flex justify-between gap-4">
                          <span className="min-w-0 text-muted">
                            + {extra.name}
                            {cantidad > 1 && ` ×${cantidad}`}
                          </span>
                          <span className="shrink-0 font-semibold text-ink tabular-nums">
                            {formatPrice(extra.priceCents * cantidad, idioma)}
                          </span>
                        </div>
                      ))}

                      {elegidos.length > 0 && (
                        <div className="mt-2.5 flex justify-between gap-4 border-t border-line pt-2.5">
                          <span className="text-muted">{t('comun.total')}</span>
                          <span className="font-semibold text-ink tabular-nums">
                            {formatPrice(total, idioma)}
                          </span>
                        </div>
                      )}
                    </div>

                    <Button
                      size="lg"
                      className="mt-4 w-full"
                      disabled={!slot}
                      onClick={() =>
                        slot &&
                        navigate(
                          `/${slug}/reservar/confirmar?${tramoComun}&hora=${encodeURIComponent(slot.startsAt)}`,
                        )
                      }
                    >
                      {slot ? t('fecha.continuar') : t('fecha.eligeHora')}
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
