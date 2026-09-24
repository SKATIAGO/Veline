import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatLongDate, fromDateKey, toDateKey, weekdayShort } from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { BookingRow } from './PanelAgenda'
import { CabeceraMes } from '../../components/CabeceraMes'
import { Card, EmptyState, PageHeader, Skeleton, cx } from '../../components/ui'
import { useIdioma, usePlural } from '../../i18n/idioma'

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
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

  const cambiarMes = (nuevoMes: Date) => {
    setMes(nuevoMes)
    setDiaSeleccionado(null)
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
        <CabeceraMes mes={mes} onCambiarMes={cambiarMes} />

        <Card className="overflow-hidden p-0">
          <div className="bg-cream p-3 sm:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                <div
                  key={wd}
                  className={cx(
                    'rounded-md py-1 text-center text-caption font-semibold uppercase',
                    wd === hoy.getDay() ? 'bg-brand text-white' : 'text-brand-text',
                  )}
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
                  // Hoy se marca igual que un día elegido: un tono más no se
                  // distingue de nada, y esto no hay forma de perderlo de vista.
                  const marcado = activo || key === hoyKey
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
                        marcado
                          ? 'border-brand bg-brand text-white'
                          : 'border-line bg-surface hover:border-brand',
                      )}
                    >
                      <span
                        className={cx(
                          'text-caption font-semibold',
                          marcado ? 'text-white' : 'text-brand-text',
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
                                marcado ? 'bg-white/15 text-white' : 'bg-cream text-brand-text',
                              )}
                            >
                              {hora(b.startsAt)}
                            </span>
                          ))}
                          {citas.length > CITAS_POR_HUECO && (
                            <span
                              className={cx(
                                'px-1 text-caption',
                                marcado ? 'text-white/80' : 'text-subtle',
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
