import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatLongDate, formatPrice, fromDateKey, toDateKey } from '@veline/shared'
import { api } from '../../lib/api'
import { CabeceraMes } from '../../components/CabeceraMes'
import { Card, EmptyState, PageHeader, Skeleton } from '../../components/ui'
import { useIdioma } from '../../i18n/idioma'

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

interface ResumenDia {
  fecha: string
  facturadoCents: number
  citas: number
  canceladoCents: number
  canceladas: number
}

/**
 * Lo que ha entrado cada día, según las citas — no según lo que se ha
 * cobrado de verdad, que eso es Suscripción. Una cancelada no suma nada:
 * ni ella ni su dinero cuentan para el total, aunque se enseñan aparte
 * para que quede claro por qué el día no cuadra con el número de citas.
 */
export function PanelContabilidad() {
  const { slug = '' } = useParams()
  const { t, idioma } = useIdioma()
  const [mes, setMes] = useState(() => startOfMonth(new Date()))

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['panel', slug, 'bookings', 'mes', toDateKey(mes)],
    queryFn: () =>
      api.panelBookings(slug, { from: toDateKey(mes), to: toDateKey(endOfMonth(mes)) }),
  })

  const dias = useMemo(() => {
    const map = new Map<string, ResumenDia>()
    for (const b of bookings ?? []) {
      const key = toDateKey(new Date(b.startsAt))
      const fila = map.get(key) ?? {
        fecha: key,
        facturadoCents: 0,
        citas: 0,
        canceladoCents: 0,
        canceladas: 0,
      }
      if (b.status === 'CANCELADA') {
        fila.canceladoCents += b.priceCents
        fila.canceladas += 1
      } else {
        fila.facturadoCents += b.priceCents
        fila.citas += 1
      }
      map.set(key, fila)
    }
    return (
      [...map.values()]
        // Los días sin nada de nada —ni facturado ni cancelado— no aportan.
        .filter((d) => d.citas > 0 || d.canceladas > 0)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    )
  }, [bookings])

  const totalMesCents = dias.reduce((n, d) => n + d.facturadoCents, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('panel.contabilidad')} hint={t('cont.pista')} />

      <div className="flex flex-col gap-4">
        <CabeceraMes mes={mes} onCambiarMes={setMes} />

        {isLoading ? (
          <Card className="flex flex-col gap-3 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </Card>
        ) : (
          <>
            <Card padded className="flex items-baseline justify-between gap-4">
              <span className="text-ui font-semibold text-ink">{t('cont.totalMes')}</span>
              <span className="font-display text-heading font-semibold text-ink tabular-nums">
                {formatPrice(totalMesCents, idioma)}
              </span>
            </Card>

            {dias.length === 0 ? (
              <EmptyState title={t('cont.sinCitasMes')} hint={t('cont.sinCitasMesPista')} />
            ) : (
              <Card className="overflow-hidden">
                <ul>
                  {dias.map((d) => (
                    <li
                      key={d.fecha}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="text-ui font-semibold text-ink capitalize">
                          {formatLongDate(fromDateKey(d.fecha), idioma)}
                        </p>
                        <p className="mt-0.5 text-meta text-muted">
                          {t(d.citas === 1 ? 'cont.unaCita' : 'cont.variasCitas', { n: d.citas })}
                          {d.canceladas > 0 &&
                            ` · ${t(d.canceladas === 1 ? 'cont.unaCancelada' : 'cont.variasCanceladas', { n: d.canceladas, importe: formatPrice(d.canceladoCents, idioma) })}`}
                        </p>
                      </div>
                      <span className="text-ui font-semibold text-ink tabular-nums">
                        {formatPrice(d.facturadoCents, idioma)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
