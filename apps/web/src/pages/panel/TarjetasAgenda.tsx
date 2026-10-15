import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  addDaysKey,
  formatLongDate,
  formatTimeMadrid,
  fromDateKey,
  hoyMadrid,
  madridDateKey,
} from '@veline/shared'
import type { PanelBooking } from '../../lib/api'
import { Badge, Button, EmptyState, cx } from '../../components/ui'
import { useIdioma } from '../../i18n/idioma'
import { BookingRow } from './FilaCita'

/**
 * Lo esencial del día, en tarjetas: Hoy · Próximos 7 días · Incidencias ·
 * Equipo. En el móvil van en un carrusel a pantalla completa (scroll-snap):
 * una tarjeta, una pregunta; se pasa con el dedo o con las flechas, y los
 * puntos dicen dónde se está. En escritorio, las mismas tarjetas en rejilla.
 *
 * Lo que no está aquí (ingresos, clientes nuevos) tiene su pantalla: la
 * agenda es para saber qué toca, no para mirar la caja.
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

  const activas = bookings.filter((b) => b.status === 'CONFIRMADA' || b.status === 'COMPLETADA')
  const deHoy = activas
    .filter((b) => madridDateKey(b.startsAt) === hoy)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const enCurso = deHoy.find(
    (b) => new Date(b.startsAt).getTime() <= ahora && new Date(b.endsAt).getTime() > ahora,
  )
  const siguiente = deHoy.find((b) => new Date(b.startsAt).getTime() > ahora)

  const proximos = new Map<string, PanelBooking[]>()
  for (let i = 1; i <= 7; i++) proximos.set(addDaysKey(hoy, i), [])
  for (const b of activas) {
    const k = madridDateKey(b.startsAt)
    if (proximos.has(k)) proximos.get(k)!.push(b)
  }
  const totalSemana = [...proximos.values()].reduce((n, l) => n + l.length, 0)

  const incidencias = bookings
    .filter((b) => b.status === 'CANCELADA' || b.status === 'NO_ASISTIO')
    .filter((b) => madridDateKey(b.startsAt) >= addDaysKey(hoy, -7))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 8)

  const equipo = new Map<string, { nombre: string; citas: PanelBooking[] }>()
  for (const b of deHoy) {
    const id = b.staff?.id ?? '—'
    const e = equipo.get(id) ?? { nombre: b.staff?.name ?? t('agenda.sinAsignar'), citas: [] }
    e.citas.push(b)
    equipo.set(id, e)
  }
  const libres = Math.max(0, staffCount - [...equipo.keys()].filter((k) => k !== '—').length)

  const citasDe = (n: number) => (n === 1 ? t('agenda.unaCita') : t('agenda.nCitas', { n }))

  const tarjetas: { id: string; nombre: string; contenido: ReactNode }[] = [
    {
      id: 'hoy',
      nombre: t('agenda.vistaHoy'),
      contenido: (
        <>
          <Cabecera
            titulo={t('agenda.vistaHoy')}
            detalle={
              deHoy.length === 0
                ? undefined
                : siguiente
                  ? `${citasDe(deHoy.length)} · ${t('agenda.proximaALas', { hora: hora(siguiente.startsAt) })}`
                  : `${citasDe(deHoy.length)} · ${t('agenda.sinMasHoy')}`
            }
          />
          {deHoy.length === 0 ? (
            <EmptyState
              title={t('agenda.hoyNada')}
              hint={t('agenda.hoyNadaPista')}
              action={
                <Button variant="secondary" onClick={onApuntar}>
                  {t('agenda.apuntarUna')}
                </Button>
              }
            />
          ) : (
            <ul className="-mx-5 border-t border-line">
              {deHoy.map((b) => (
                <li key={b.id} className="relative">
                  {(b.id === enCurso?.id || b.id === siguiente?.id) && (
                    <span className="absolute top-3 right-3 z-elevado">
                      <Badge tone={b.id === enCurso?.id ? 'ok' : 'warn'}>
                        {b.id === enCurso?.id ? t('agenda.enCurso') : t('agenda.siguiente')}
                      </Badge>
                    </span>
                  )}
                  <BookingRow booking={b} slug={slug} />
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    {
      id: 'proximos',
      nombre: t('agenda.tarjetaProximos'),
      contenido: (
        <>
          <Cabecera
            titulo={t('agenda.tarjetaProximos')}
            detalle={t('agenda.semanaResumen', { n: totalSemana })}
          />
          <ul className="flex flex-col divide-y divide-line">
            {[...proximos.entries()].map(([dia, lista]) => (
              <li key={dia}>
                <button
                  type="button"
                  onClick={() => onVerDia(dia)}
                  aria-label={`${formatLongDate(fromDateKey(dia), idioma)}: ${citasDe(lista.length)}. ${t('agenda.verDia')}`}
                  className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:text-brand-text"
                >
                  <span className="min-w-0">
                    <span className="block text-body font-semibold text-ink first-letter:uppercase">
                      {formatLongDate(fromDateKey(dia), idioma)}
                    </span>
                    {lista.length > 0 && (
                      <span className="block truncate text-meta text-muted tabular-nums">
                        {lista
                          .slice(0, 4)
                          .map((b) => hora(b.startsAt))
                          .join(' · ')}
                        {lista.length > 4 && ` · +${lista.length - 4}`}
                      </span>
                    )}
                  </span>
                  <span
                    className={cx(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-meta font-semibold tabular-nums',
                      lista.length ? 'bg-cream text-ink' : 'text-subtle',
                    )}
                  >
                    {lista.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      id: 'incidencias',
      nombre: t('agenda.tarjetaIncidencias'),
      contenido: (
        <>
          <Cabecera titulo={t('agenda.tarjetaIncidencias')} />
          {incidencias.length === 0 ? (
            <p className="text-body text-muted">{t('agenda.sinIncidencias')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {incidencias.map((b) => (
                <li key={b.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-ink">{b.customer.name}</p>
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
          )}
        </>
      ),
    },
    {
      id: 'equipo',
      nombre: t('agenda.tarjetaEquipo'),
      contenido: (
        <>
          <Cabecera titulo={t('agenda.tarjetaEquipo')} />
          {equipo.size === 0 ? (
            <p className="text-body text-muted">{t('agenda.hoyNada')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {[...equipo.values()].map((e) => {
                const prox = e.citas.find((b) => new Date(b.startsAt).getTime() > ahora)
                return (
                  <li key={e.nombre} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
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
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {libres > 0 && (
            <p className="mt-3 text-meta text-subtle">
              {libres === 1
                ? t('agenda.unaPersonaLibre')
                : t('agenda.masPersonasLibres', { n: libres })}
            </p>
          )}
        </>
      ),
    },
  ]

  return <Carrusel tarjetas={tarjetas} cargando={cargando} />
}

function Cabecera({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-subheading font-semibold text-ink">{titulo}</h2>
      {detalle && <p className="text-meta text-muted">{detalle}</p>}
    </div>
  )
}

/**
 * El carrusel: en el móvil, una tarjeta por pantalla con scroll-snap; en
 * escritorio, rejilla. Los puntos y las flechas existen para quien no
 * desliza (ratón, teclado) y el anuncio en vivo dice qué tarjeta se ve.
 */
function Carrusel({
  tarjetas,
  cargando,
}: {
  tarjetas: { id: string; nombre: string; contenido: ReactNode }[]
  cargando: boolean
}) {
  const { t } = useIdioma()
  const pista = useRef<HTMLDivElement>(null)
  const [actual, setActual] = useState(0)

  useEffect(() => {
    const el = pista.current
    if (!el) return
    let marco = 0
    const alDesplazar = () => {
      cancelAnimationFrame(marco)
      marco = requestAnimationFrame(() => {
        const ancho = el.clientWidth || 1
        setActual(Math.round(el.scrollLeft / ancho))
      })
    }
    el.addEventListener('scroll', alDesplazar, { passive: true })
    return () => {
      el.removeEventListener('scroll', alDesplazar)
      cancelAnimationFrame(marco)
    }
  }, [])

  const ir = (i: number) => {
    const el = pista.current
    if (!el) return
    const j = Math.max(0, Math.min(tarjetas.length - 1, i))
    el.scrollTo({
      left: j * el.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
    setActual(j)
  }

  return (
    <section aria-label={t('agenda.tarjetas')} aria-busy={cargando || undefined}>
      <div
        ref={pista}
        className={cx(
          '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-visible lg:px-0',
        )}
      >
        {tarjetas.map((c, i) => (
          <article
            key={c.id}
            aria-label={c.nombre}
            className={cx(
              'rounded-xl border border-line bg-surface',
              'w-[calc(100vw-2rem)] shrink-0 snap-center p-5 sm:w-[calc(100vw-3rem)] lg:w-auto',
              'min-h-[320px] overflow-hidden',
              i !== actual && 'max-lg:opacity-90',
            )}
          >
            {c.contenido}
          </article>
        ))}
      </div>

      {/* Puntos y flechas: solo en el móvil, donde hay carrusel. */}
      <div className="mt-2 flex items-center justify-between lg:hidden">
        <button
          type="button"
          aria-label={t('agenda.anteriorTarjeta')}
          disabled={actual === 0}
          onClick={() => ir(actual - 1)}
          className="grid size-11 place-items-center rounded-full text-subheading text-ink disabled:opacity-30"
        >
          <span aria-hidden>‹</span>
        </button>
        <div role="tablist" aria-label={t('agenda.tarjetas')} className="flex gap-1">
          {tarjetas.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === actual}
              aria-label={t('agenda.tarjetaDe', {
                n: i + 1,
                total: tarjetas.length,
                nombre: c.nombre,
              })}
              onClick={() => ir(i)}
              className="grid size-11 place-items-center"
            >
              <span
                aria-hidden
                className={cx(
                  'block rounded-full transition-all duration-200',
                  i === actual ? 'h-2 w-6 bg-brand' : 'size-2 bg-line-strong',
                )}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={t('agenda.siguienteTarjeta')}
          disabled={actual === tarjetas.length - 1}
          onClick={() => ir(actual + 1)}
          className="grid size-11 place-items-center rounded-full text-subheading text-ink disabled:opacity-30"
        >
          <span aria-hidden>›</span>
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {t('agenda.tarjetaDe', {
          n: actual + 1,
          total: tarjetas.length,
          nombre: tarjetas[actual]?.nombre ?? '',
        })}
      </p>
    </section>
  )
}
