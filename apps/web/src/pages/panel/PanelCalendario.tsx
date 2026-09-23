import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatLongDate, fromDateKey, monthLong, toDateKey, weekdayShort } from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { BookingRow } from './PanelAgenda'
import { Card, EmptyState, LogoMark, PageHeader, Skeleton, cx } from '../../components/ui'
import { useIdioma, usePlural } from '../../i18n/idioma'

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
/** Lunes primero, como en el resto del producto. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

/** Cuántas citas caben dentro de un huequito antes de resumir el resto. */
const CITAS_POR_HUECO = 3

/**
 * El calendario mensual: una imagen general de cuándo hay citas, no un
 * sustituto de la Agenda. Un día se elige para ver sus citas debajo, con
 * las mismas filas de siempre — no hace falta una segunda forma de
 * enseñarlas. Tocar el mes en la cabecera abre un salto directo a cualquier
 * mes: pasar página de uno en uno para llegar lejos era demasiado lento.
 */
export function PanelCalendario() {
  const { slug = '' } = useParams()
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const hoy = useMemo(() => new Date(), [])
  const [mes, setMes] = useState(() => startOfMonth(hoy))
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)

  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [anioSelector, setAnioSelector] = useState(() => hoy.getFullYear())
  const selectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectorAbierto) return
    const alClicarFuera = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorAbierto(false)
      }
    }
    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [selectorAbierto])

  const irAMes = (n: number) => {
    setMes((m) => addMonths(m, n))
    setDiaSeleccionado(null)
  }

  const irA = (nuevoMes: Date) => {
    setMes(nuevoMes)
    setDiaSeleccionado(null)
    setSelectorAbierto(false)
  }

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['panel', slug, 'bookings', 'mes', toDateKey(mes)],
    queryFn: () =>
      api.panelBookings(slug, { from: toDateKey(mes), to: toDateKey(endOfMonth(mes)) }),
  })

  const porDia = useMemo(() => {
    const map = new Map<string, PanelBooking[]>()
    for (const b of bookings ?? []) {
      const key = toDateKey(new Date(b.startsAt))
      map.set(key, [...(map.get(key) ?? []), b])
    }
    return map
  }, [bookings])

  const daysInMonth = endOfMonth(mes).getDate()
  const leading = mondayIndex(mes)
  const cells: (Date | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1),
    ),
  ]

  const hoyKey = toDateKey(hoy)
  const citasDelDia = diaSeleccionado ? (porDia.get(diaSeleccionado) ?? []) : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('panel.calendario')} />

      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-cream px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2.5">
              <LogoMark size={18} />
              <div className="relative" ref={selectorRef}>
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={selectorAbierto}
                  aria-label={t('agenda.elegirMes')}
                  onClick={() => {
                    setAnioSelector(mes.getFullYear())
                    setSelectorAbierto((v) => !v)
                  }}
                  className="font-display text-ui font-semibold text-ink capitalize transition-colors hover:text-brand-text sm:text-subheading"
                >
                  {monthLong(mes.getMonth(), idioma)} {mes.getFullYear()}
                </button>

                {selectorAbierto && (
                  <div className="absolute z-20 mt-2 w-60 rounded-lg border border-line bg-surface p-3 shadow-overlay">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        aria-label={t('agenda.anioAnterior')}
                        onClick={() => setAnioSelector((a) => a - 1)}
                        className="flex size-7 items-center justify-center rounded-full text-ui text-subtle transition-colors hover:bg-cream hover:text-brand-text"
                      >
                        ‹
                      </button>
                      <span className="text-ui font-semibold text-ink">{anioSelector}</span>
                      <button
                        type="button"
                        aria-label={t('agenda.anioSiguiente')}
                        onClick={() => setAnioSelector((a) => a + 1)}
                        className="flex size-7 items-center justify-center rounded-full text-ui text-subtle transition-colors hover:bg-cream hover:text-brand-text"
                      >
                        ›
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {Array.from({ length: 12 }, (_, m) => m).map((m) => {
                        const activo = m === mes.getMonth() && anioSelector === mes.getFullYear()
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => irA(new Date(anioSelector, m, 1))}
                            className={cx(
                              'rounded-md px-2 py-1.5 text-meta capitalize transition-colors',
                              activo ? 'bg-brand text-white' : 'text-body-2 hover:bg-cream',
                            )}
                          >
                            {monthLong(m, idioma).slice(0, 3)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={t('fecha.mesAnterior')}
                onClick={() => irAMes(-1)}
                className="flex size-8 items-center justify-center rounded-full text-subheading leading-none text-brand-text transition-colors hover:bg-brand/10 sm:size-9"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={t('fecha.mesSiguiente')}
                onClick={() => irAMes(1)}
                className="flex size-8 items-center justify-center rounded-full text-subheading leading-none text-brand-text transition-colors hover:bg-brand/10 sm:size-9"
              >
                ›
              </button>
            </div>
          </div>

          <div className="bg-cream p-3 sm:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                <div
                  key={wd}
                  className="text-center text-caption font-semibold text-brand-text uppercase"
                >
                  {weekdayShort(wd, idioma)}
                </div>
              ))}
            </div>

            {isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {cells.map((d, i) => {
                  if (!d) return <div key={`vacio-${i}`} />
                  const key = toDateKey(d)
                  const citas = porDia.get(key) ?? []
                  const activo = key === diaSeleccionado
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDiaSeleccionado(activo ? null : key)}
                      aria-label={
                        citas.length
                          ? `${formatLongDate(d, idioma)}: ${plural(citas.length, 'agenda.unaCitaDia', 'agenda.variasCitasDia')}`
                          : formatLongDate(d, idioma)
                      }
                      className={cx(
                        'flex min-h-[60px] flex-col items-start gap-1 rounded-lg border p-1 text-left transition-colors sm:min-h-[92px] sm:p-1.5',
                        activo
                          ? 'border-brand bg-brand text-white'
                          : 'border-line bg-surface hover:border-brand',
                        key === hoyKey && !activo && 'ring-1 ring-inset ring-brand/50',
                      )}
                    >
                      <span
                        className={cx(
                          'text-caption font-semibold',
                          activo ? 'text-white' : 'text-brand-text',
                        )}
                      >
                        {d.getDate()}
                      </span>
                      {citas.length > 0 && (
                        <div aria-hidden className="flex w-full flex-col gap-0.5 overflow-hidden">
                          {citas.slice(0, CITAS_POR_HUECO).map((b) => (
                            <span
                              key={b.id}
                              className={cx(
                                'truncate rounded px-1 py-0.5 text-caption leading-tight font-medium',
                                activo ? 'bg-white/15 text-white' : 'bg-cream text-brand-text',
                              )}
                            >
                              {hora(b.startsAt)}
                            </span>
                          ))}
                          {citas.length > CITAS_POR_HUECO && (
                            <span
                              className={cx(
                                'px-1 text-caption',
                                activo ? 'text-white/80' : 'text-subtle',
                              )}
                            >
                              +{citas.length - CITAS_POR_HUECO}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {!isLoading &&
          (diaSeleccionado ? (
            citasDelDia.length === 0 ? (
              <EmptyState title={t('agenda.sinCitasEseDia')} />
            ) : (
              <div className="flex flex-col gap-2">
                <h3 className="text-meta font-semibold tracking-[0.04em] text-muted uppercase">
                  {formatLongDate(fromDateKey(diaSeleccionado), idioma)}
                </h3>
                <Card className="overflow-hidden">
                  <ul>
                    {citasDelDia.map((b) => (
                      <BookingRow key={b.id} booking={b} slug={slug} />
                    ))}
                  </ul>
                </Card>
              </div>
            )
          ) : (
            <p className="text-meta text-subtle">{t('agenda.tocaUnDia')}</p>
          ))}
      </div>
    </div>
  )
}
