import { Link } from 'react-router-dom'
import {
  formatDuration,
  formatLongDate,
  formatPrice,
  formatTimeMadrid,
  madridDay,
} from '@veline/shared'
import { useIdioma } from '../../i18n/idioma'

/**
 * Las líneas de lo elegido hasta ahora, con un «Cambiar» al lado de cada
 * cosa que se puede cambiar sin retroceder a ciegas. Es el mismo resumen en
 * los tres pasos: lo que cambia es cuánto hay ya decidido.
 */
export interface LineaExtra {
  extra: { id: string; name: string; priceCents: number; durationMin: number }
  cantidad: number
}

export function ResumenReserva({
  servicio,
  elegidos,
  persona,
  local,
  cuando,
  duracionMin,
  urlServicio,
  urlExtras,
  urlFecha,
  tieneCarta,
}: {
  servicio: { name: string; priceCents: number }
  elegidos: LineaExtra[]
  persona?: { name: string } | null
  /** Solo cuando el negocio tiene más de un local. */
  local?: { name: string } | null
  /** ISO de la hora elegida, si ya hay. */
  cuando?: string | null
  duracionMin: number
  urlServicio: string
  urlExtras?: string
  urlFecha?: string
  tieneCarta: boolean
}) {
  const { t, idioma, locale } = useIdioma()
  const cambiar = (to: string, label: string) => (
    <Link
      to={to}
      aria-label={label}
      className="inline-flex min-h-9 items-center px-1.5 text-meta font-semibold text-brand-text hover:underline"
    >
      {t('reserva.cambiar')}
    </Link>
  )
  const fila = 'flex items-center justify-between gap-3 text-body'

  return (
    <dl className="flex flex-col gap-2">
      <div className={fila}>
        <dt className="min-w-0 text-muted">{servicio.name}</dt>
        <dd className="flex shrink-0 items-center gap-1 font-semibold text-ink tabular-nums">
          {formatPrice(servicio.priceCents, idioma)}
          {cambiar(urlServicio, `${t('reserva.cambiar')}: ${t('reserva.pasoServicio')}`)}
        </dd>
      </div>

      {elegidos.map(({ extra, cantidad }) => (
        <div key={extra.id} className={fila}>
          <dt className="min-w-0 text-muted">
            + {extra.name}
            {cantidad > 1 && ` ×${cantidad}`}
          </dt>
          <dd className="shrink-0 font-semibold text-ink tabular-nums">
            {formatPrice(extra.priceCents * cantidad, idioma)}
          </dd>
        </div>
      ))}
      {tieneCarta && urlExtras && (
        <div className="-mt-1">
          <Link
            to={urlExtras}
            className="inline-flex min-h-9 items-center text-meta font-semibold text-brand-text hover:underline"
          >
            {elegidos.length > 0 ? t('confirmar.extrasCambiar') : t('confirmar.extrasAnadir')}
          </Link>
        </div>
      )}

      {local && (
        <div className={fila}>
          <dt className="text-muted">{t('fecha.local')}</dt>
          <dd className="text-right font-semibold text-ink">{local.name}</dd>
        </div>
      )}

      {persona && (
        <div className={fila}>
          <dt className="text-muted">{t('fecha.conQuien')}</dt>
          <dd className="text-right font-semibold text-ink">{persona.name}</dd>
        </div>
      )}

      {cuando && (
        <div className={fila}>
          <dt className="text-muted">{t('confirmar.fecha')}</dt>
          <dd className="flex shrink-0 items-center gap-1 text-right font-semibold text-ink first-letter:uppercase">
            <span className="first-letter:uppercase">
              {formatLongDate(madridDay(cuando), idioma)}, {formatTimeMadrid(cuando, locale)}
            </span>
            {urlFecha && cambiar(urlFecha, `${t('reserva.cambiar')}: ${t('reserva.pasoFecha')}`)}
          </dd>
        </div>
      )}

      <div className={fila}>
        <dt className="text-muted">{t('confirmar.duracion')}</dt>
        <dd className="font-semibold text-ink tabular-nums">
          {formatDuration(duracionMin, idioma)}
        </dd>
      </div>
    </dl>
  )
}
