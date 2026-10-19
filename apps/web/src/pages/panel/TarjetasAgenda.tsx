import { type ReactNode } from 'react'
import {
  addDaysKey,
  formatLongDate,
  formatTimeMadrid,
  fromDateKey,
  hoyMadrid,
  madridDateKey,
} from '@veline/shared'
import type { PanelBooking } from '../../lib/api'
import { Badge, Button, Skeleton, cx } from '../../components/ui'
import { useIdioma } from '../../i18n/idioma'
import { BookingRow } from './FilaCita'

/** Hasta cuántos minutos se dice «en 25 min»: más allá, la hora basta. */
const MINUTOS_CERCA = 90

/**
 * La vista «Hoy» de la agenda: lo que toca a corto alcance, de arriba abajo
 * en el orden en que se pregunta.
 *
 *  1. Hoy, a todo el ancho: cada cita en una fila, con «En curso» o
 *     «Siguiente» al lado del servicio y, arriba, cuánto falta para la próxima.
 *  2. La semana, en una tira de siete días: se ve de un golpe qué días hay
 *     trabajo y a qué hora empieza, y un toque lleva al día en el calendario.
 *  3. Equipo e incidencias, solo si dicen algo.
 *
 * Antes eran cuatro tarjetas en rejilla de dos, todas de 320 px como mínimo:
 * la fila de una cita, pensada para todo el ancho, se partía en media
 * tarjeta; la semana eran siete filas con un 0 casi siempre; y Equipo e
 * Incidencias se estiraban a la altura de su vecina con media tarjeta vacía.
 * En el móvil iban en un carrusel que escondía tres de las cuatro.
 */
export function TarjetasAgenda({
  slug,
  bookings,
  cargando,
  staffCount,
  onApuntar,
  onVerDia,
}: {
  slug: string
  /** De hace 7 días a dentro de 14, con todos los estados. */
  bookings: PanelBooking[]
  cargando: boolean
  staffCount: number
  onApuntar: () => void
  onVerDia: (dia: string) => void
}) {
  const { t, idioma, locale } = useIdioma()
  const hoy = hoyMadrid()
  const ahora = Date.now()
  const hora = (iso: string) => formatTimeMadrid(iso, locale)
  const citasDe = (n: number) => (n === 1 ? t('agenda.unaCita') : t('agenda.nCitas', { n }))

  /* Mientras llegan las citas, el sitio con su forma: antes se pintaba
     «Hoy no hay citas» un instante y luego aparecían. */
  if (cargando) return <Esqueleto />

  const activas = bookings
    .filter((b) => b.status === 'CONFIRMADA' || b.status === 'COMPLETADA')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const deHoy = bookings
    .filter((b) => b.status !== 'CANCELADA' && madridDateKey(b.startsAt) === hoy)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const pendientesHoy = deHoy.filter((b) => b.status === 'CONFIRMADA')
  const enCurso = pendientesHoy.find(
    (b) => new Date(b.startsAt).getTime() <= ahora && new Date(b.endsAt).getTime() > ahora,
  )
  const siguiente = pendientesHoy.find((b) => new Date(b.startsAt).getTime() > ahora)
  // Si hoy no queda nada: cuándo es la próxima, para no tener que buscarla.
  const proximaOtroDia = activas.find((b) => madridDateKey(b.startsAt) > hoy)

  const semana = Array.from({ length: 7 }, (_, i) => {
    const dia = addDaysKey(hoy, i + 1)
    return { dia, citas: activas.filter((b) => madridDateKey(b.startsAt) === dia) }
  })
  const totalSemana = semana.reduce((n, d) => n + d.citas.length, 0)

  const incidencias = bookings
    .filter((b) => b.status === 'CANCELADA' || b.status === 'NO_ASISTIO')
    .filter((b) => madridDateKey(b.startsAt) >= addDaysKey(hoy, -7))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 6)

  const equipo = new Map<string, { nombre: string; citas: PanelBooking[] }>()
  for (const b of deHoy) {
    const id = b.staff?.id ?? '—'
    const e = equipo.get(id) ?? { nombre: b.staff?.name ?? t('agenda.sinAsignar'), citas: [] }
    e.citas.push(b)
    equipo.set(id, e)
  }
  const libres = Math.max(0, staffCount - [...equipo.keys()].filter((k) => k !== '—').length)
  // Con una sola persona, «Equipo» repetiría lo que ya dice «Hoy».
  const verEquipo = deHoy.length > 0 && staffCount > 1

  const detalleHoy = (() => {
    if (deHoy.length === 0) return undefined
    const cuantas = citasDe(deHoy.length)
    if (!siguiente) return `${cuantas} · ${t('agenda.sinMasHoy')}`
    const faltan = Math.round((new Date(siguiente.startsAt).getTime() - ahora) / 60_000)
    return `${cuantas} · ${
      faltan <= MINUTOS_CERCA
        ? t('agenda.proximaEn', { hora: hora(siguiente.startsAt), n: Math.max(1, faltan) })
        : t('agenda.proximaALas', { hora: hora(siguiente.startsAt) })
    }`
  })()

  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. Hoy ── */}
      <section aria-labelledby="agenda-hoy" className="rounded-xl border border-line bg-surface">
        <Cabecera
          id="agenda-hoy"
          titulo={t('agenda.vistaHoy')}
          detalle={detalleHoy}
          className="px-4 pt-4 sm:px-5 sm:pt-5"
        />
        {deHoy.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-4 pb-5 sm:px-5">
            <p className="text-body text-muted">
              {t('agenda.hoyNada')}.{' '}
              {proximaOtroDia
                ? t('agenda.proximaCita', {
                    fecha: formatLongDate(
                      fromDateKey(madridDateKey(proximaOtroDia.startsAt)),
                      idioma,
                    ),
                    hora: hora(proximaOtroDia.startsAt),
                  })
                : t('agenda.hoyNadaPista')}
            </p>
            <div className="flex flex-wrap gap-2">
              {proximaOtroDia && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onVerDia(madridDateKey(proximaOtroDia.startsAt))}
                >
                  {t('agenda.verDia')}
                </Button>
              )}
              <Button size="sm" variant="quiet" onClick={onApuntar}>
                {t('agenda.apuntarUna')}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="border-t border-line">
            {deHoy.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                slug={slug}
                etiqueta={
                  b.id === enCurso?.id ? (
                    <Badge tone="ok">{t('agenda.enCurso')}</Badge>
                  ) : b.id === siguiente?.id ? (
                    <Badge tone="brand">{t('agenda.siguiente')}</Badge>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── 2. La semana ── */}
      <section aria-labelledby="agenda-semana">
        <Cabecera
          id="agenda-semana"
          titulo={t('agenda.tarjetaProximos')}
          detalle={totalSemana === 0 ? t('agenda.semanaVacia') : citasDe(totalSemana)}
        />
        <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {semana.map(({ dia, citas }) => {
            const fecha = fromDateKey(dia)
            const con = citas.length > 0
            return (
              <li key={dia} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onVerDia(dia)}
                  aria-label={`${formatLongDate(fecha, idioma)}: ${citasDe(citas.length)}. ${t('agenda.verDia')}`}
                  className={cx(
                    'flex h-full min-h-[76px] w-full flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 sm:min-h-[96px]',
                    'transition-colors duration-200',
                    con
                      ? 'border-line bg-surface hover:border-brand'
                      : 'border-dashed border-line text-subtle hover:border-line-strong',
                  )}
                >
                  <span className="text-caption font-semibold text-muted uppercase">
                    {fecha.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}
                  </span>
                  <span
                    className={cx(
                      'font-display text-ui font-semibold tabular-nums sm:text-subheading',
                      con ? 'text-ink' : 'text-subtle',
                    )}
                  >
                    {fecha.getDate()}
                  </span>
                  {con ? (
                    <>
                      <span className="rounded-full bg-cream px-2 text-caption font-bold text-brand-text tabular-nums">
                        {citas.length}
                      </span>
                      <span className="hidden text-caption text-muted tabular-nums sm:block">
                        {hora(citas[0]!.startsAt)}
                      </span>
                    </>
                  ) : (
                    <span aria-hidden className="text-caption">
                      –
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
        {incidencias.length === 0 && (
          <p className="mt-3 text-meta text-subtle">{t('agenda.sinIncidencias')}</p>
        )}
      </section>

      {/* ── 3. Equipo e incidencias, solo si dicen algo ── */}
      {(verEquipo || incidencias.length > 0) && (
        <div
          className={cx(
            'grid items-start gap-6',
            verEquipo && incidencias.length > 0 && 'lg:grid-cols-2',
          )}
        >
          {verEquipo && (
            <section
              aria-labelledby="agenda-equipo"
              className="rounded-xl border border-line bg-surface p-4 sm:p-5"
            >
              <Cabecera id="agenda-equipo" titulo={t('agenda.tarjetaEquipo')} />
              <ul className="flex flex-col divide-y divide-line">
                {[...equipo.values()].map((e) => {
                  const prox = e.citas.find(
                    (b) => b.status === 'CONFIRMADA' && new Date(b.startsAt).getTime() > ahora,
                  )
                  return (
                    <li key={e.nombre} className="flex items-center gap-3 py-2.5">
                      <span
                        aria-hidden
                        className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-meta font-bold text-body-2"
                      >
                        {e.nombre.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-body font-semibold text-ink">{e.nombre}</p>
                        <p className="text-meta text-muted">
                          {citasDe(e.citas.length)}
                          {prox && ` · ${t('agenda.proximaALas', { hora: hora(prox.startsAt) })}`}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {libres > 0 && (
                <p className="mt-2 text-meta text-subtle">
                  {libres === 1
                    ? t('agenda.unaPersonaLibre')
                    : t('agenda.masPersonasLibres', { n: libres })}
                </p>
              )}
            </section>
          )}

          {incidencias.length > 0 && (
            <section
              aria-labelledby="agenda-incidencias"
              className="rounded-xl border border-line bg-surface p-4 sm:p-5"
            >
              <Cabecera
                id="agenda-incidencias"
                titulo={t('agenda.tarjetaIncidencias')}
                detalle={t('agenda.incidenciasPista')}
              />
              <ul className="flex flex-col divide-y divide-line">
                {incidencias.map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-body font-semibold text-ink">{b.customer.name}</p>
                      <p className="text-meta text-muted first-letter:uppercase">
                        {formatLongDate(fromDateKey(madridDateKey(b.startsAt)), idioma)} ·{' '}
                        {hora(b.startsAt)} · {b.service.name}
                      </p>
                    </div>
                    <Badge tone={b.status === 'CANCELADA' ? 'off' : 'warn'}>
                      {b.status === 'CANCELADA' ? t('agenda.cancelada') : t('agenda.noVinoEstado')}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function Cabecera({
  id,
  titulo,
  detalle,
  className,
}: {
  id: string
  titulo: string
  detalle?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('mb-3', className)}>
      <h2 id={id} className="font-display text-subheading font-semibold text-ink">
        {titulo}
      </h2>
      {detalle && <p className="text-meta text-muted">{detalle}</p>}
    </div>
  )
}

/** La misma forma que la vista cargada: Hoy con dos filas y la tira de días. */
function Esqueleto() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-2 h-4 w-48" />
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-24" />
        <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl sm:h-[96px]" />
          ))}
        </div>
      </div>
    </div>
  )
}
