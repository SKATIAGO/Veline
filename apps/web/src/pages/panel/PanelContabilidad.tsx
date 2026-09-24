import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatLongDate, formatPrice, fromDateKey, toDateKey } from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { CabeceraMes } from '../../components/CabeceraMes'
import { Button, Card, EmptyState, PageHeader, Skeleton } from '../../components/ui'
import { useIdioma, type Clave } from '../../i18n/idioma'

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

interface ResumenDia {
  fecha: string
  facturadoCents: number
  citas: number
  canceladoCents: number
  canceladas: number
}

const ESTADO_CLAVE: Record<PanelBooking['status'], Clave> = {
  CONFIRMADA: 'cont.confirmada',
  CANCELADA: 'agenda.cancelada',
  COMPLETADA: 'agenda.atendida',
  NO_ASISTIO: 'agenda.noVinoEstado',
}

/** Una celda de CSV: entre comillas si trae el separador, una comilla o un salto de línea. */
function celdaCsv(valor: string) {
  return /[,;"\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
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

  /**
   * El desglose de verdad, cita a cita, no solo el resumen por día que ya se
   * ve en pantalla: fecha, hora, cliente, servicio, estado e importe de cada
   * una, canceladas incluidas —para que se vea por qué no suman— y el total
   * del mes al final, ese sí sin las canceladas.
   *
   * El Excel en español no separa columnas por comas: usa la coma para los
   * decimales, así que espera el punto y coma como separador. En inglés es
   * al revés. Sin esto, el CSV se abre entero amontonado en una sola
   * columna — hay que elegir el signo según el idioma, no da igual cuál.
   */
  const descargar = () => {
    const separador = idioma === 'en' ? ',' : ';'
    const importe = (cents: number) => {
      const valor = (cents / 100).toFixed(2)
      return idioma === 'en' ? valor : valor.replace('.', ',')
    }

    const filas = [...(bookings ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const cabecera = [
      t('cont.csvFecha'),
      t('cont.csvHora'),
      t('cont.csvCliente'),
      t('cont.csvServicio'),
      t('cont.csvEstado'),
      t('cont.csvImporte'),
    ]
    const lineas = filas.map((b) => {
      const inicio = new Date(b.startsAt)
      return [
        toDateKey(inicio),
        inicio.toLocaleTimeString(idioma === 'en' ? 'en-GB' : 'es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        b.customer.name,
        b.service.name,
        t(ESTADO_CLAVE[b.status]),
        importe(b.priceCents),
      ]
        .map(celdaCsv)
        .join(separador)
    })
    lineas.push(
      ['', '', '', '', t('cont.csvTotalMes'), importe(totalMesCents)].map(celdaCsv).join(separador),
    )

    // El BOM al principio es lo que hace que Excel abra los acentos bien.
    const csv = '﻿' + [cabecera.join(separador), ...lineas].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contabilidad-${toDateKey(mes).slice(0, 7)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.contabilidad')}
        hint={t('cont.pista')}
        actions={
          bookings &&
          bookings.length > 0 && (
            <Button variant="secondary" onClick={descargar}>
              {t('cont.descargar')}
            </Button>
          )
        }
      />

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
