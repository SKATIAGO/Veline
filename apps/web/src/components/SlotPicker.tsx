import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatLongDate, fromDateKey, toDateKey, weekdayShort } from '@veline/shared'
import { api } from '../lib/api'
import { ErrorNote, Field, Input, Skeleton, cx } from './ui'
import { useIdioma } from '../i18n/idioma'
import { textoDeError } from './Avisos'

/** Días que se piden y se enseñan de una vez. */
const VENTANA = 14

const sumarDias = (key: string, n: number) => {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/** Fecha y hora en el formato de un <input type="datetime-local">. */
const paraInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/**
 * Los huecos libres de verdad, para apuntar o mover una cita desde el panel.
 *
 * Antes la hora se escribía a mano, sin saber si había alguien libre, y el
 * «No queda nadie libre a esa hora» llegaba después de rellenarlo todo. Ahora
 * se ve qué días tienen sitio y qué horas caben enteras con lo elegido (el
 * servicio con sus extras, o la duración de la cita que se mueve). La hora a
 * mano sigue ahí para lo excepcional —un cliente que entra por la puerta
 * fuera de horario—, y el servidor comprueba igual que haya alguien.
 */
export function SlotPicker({
  slug,
  consulta,
  valor,
  onElegir,
  diaInicial,
}: {
  slug: string
  /** De qué son los huecos: un servicio con sus extras, o una cita. */
  consulta: {
    serviceId?: string
    extras?: string
    bookingId?: string
    staffId?: string
    locationId?: string
  }
  /** La hora elegida (ISO), o null. */
  valor: string | null
  onElegir: (iso: string | null) => void
  /** Por qué día empezar: el del calendario desde el que se abrió, por ejemplo. */
  diaInicial?: string
}) {
  const { t, idioma, locale } = useIdioma()
  const id = useId()
  const hoy = toDateKey(new Date())
  const [desde, setDesde] = useState(() => (diaInicial && diaInicial > hoy ? diaInicial : hoy))
  const [dia, setDia] = useState<string | null>(diaInicial ?? null)
  const [aMano, setAMano] = useState(false)
  const hasta = sumarDias(desde, VENTANA - 1)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['panel', slug, 'disponibilidad', consulta, desde],
    queryFn: () => api.panelDisponibilidad(slug, { ...consulta, from: desde, to: hasta }),
    enabled: !aMano && !!(consulta.serviceId || consulta.bookingId),
  })

  const porDia = useMemo(() => new Map((data ?? []).map((d) => [d.date, d])), [data])
  const libre = (key: string) => porDia.get(key)?.slots.some((s) => s.available) ?? false

  /* Al abrir, y al pasar de semana, se coloca en el primer día con sitio.
     Un día elegido a propósito (el del calendario) no se cambia aunque esté
     lleno: se dice que lo está, que saltar a otro sin avisar despista. */
  useEffect(() => {
    if (!data || (dia && dia >= desde && dia <= hasta)) return
    setDia(data.find((d) => d.slots.some((s) => s.available))?.date ?? null)
  }, [data])

  // La hora elegida deja de valer si ya no está libre con lo nuevo.
  useEffect(() => {
    if (!data || !valor || aMano) return
    const sigue = data.some((d) => d.slots.some((s) => s.startsAt === valor && s.available))
    if (!sigue) onElegir(null)
  }, [data])

  const dias = Array.from({ length: VENTANA }, (_, i) => sumarDias(desde, i))
  const huecos = (dia && porDia.get(dia)?.slots) || []
  const manana = huecos.filter((s) => Number(s.label.slice(0, 2)) < 14)
  const tarde = huecos.filter((s) => Number(s.label.slice(0, 2)) >= 14)
  const cerrado = dia ? porDia.get(dia)?.closed : false

  const flecha = (direccion: -1 | 1) => (
    <button
      type="button"
      aria-label={direccion < 0 ? t('slots.anteriores') : t('slots.siguientes')}
      disabled={direccion < 0 && desde <= hoy}
      onClick={() => {
        const nuevo = sumarDias(desde, direccion * VENTANA)
        setDesde(nuevo < hoy ? hoy : nuevo)
      }}
      className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-subheading leading-none text-ink transition-colors duration-200 hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
    >
      <span aria-hidden>{direccion < 0 ? '‹' : '›'}</span>
    </button>
  )

  if (aMano) {
    return (
      <div className="flex flex-col gap-3">
        <Field
          label={t('slots.horaAMano')}
          htmlFor={`${id}-mano`}
          hint={t('slots.horaAManoPista')}
          required
        >
          <Input
            id={`${id}-mano`}
            type="datetime-local"
            value={valor ? paraInput(valor) : ''}
            onChange={(e) =>
              onElegir(e.target.value ? new Date(e.target.value).toISOString() : null)
            }
          />
        </Field>
        <div>
          <button
            type="button"
            onClick={() => {
              setAMano(false)
              onElegir(null)
            }}
            className="inline-flex min-h-9 items-center text-meta font-semibold text-brand-text hover:underline"
          >
            {t('slots.volverAHuecos')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {flecha(-1)}
        <div
          role="group"
          aria-label={t('slots.dias')}
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1"
        >
          {dias.map((key) => {
            const d = fromDateKey(key)
            const hay = libre(key)
            const activo = key === dia
            return (
              <button
                key={key}
                type="button"
                aria-pressed={activo}
                aria-label={formatLongDate(d, idioma)}
                disabled={isLoading || !hay}
                onClick={() => setDia(key)}
                className={cx(
                  'flex h-[60px] w-[50px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl',
                  'transition-colors duration-150',
                  activo
                    ? 'bg-brand text-white'
                    : hay
                      ? 'border border-line bg-surface text-ink hover:border-brand'
                      : 'bg-cream text-disabled',
                )}
              >
                <span className="text-caption font-medium opacity-80">
                  {weekdayShort(d.getDay(), idioma)}
                </span>
                <span className="text-ui font-semibold tabular-nums">{d.getDate()}</span>
              </button>
            )
          })}
        </div>
        {flecha(1)}
      </div>

      {isError ? (
        <ErrorNote>{textoDeError(error, t('slots.noSeCargaron'))}</ErrorNote>
      ) : isLoading ? (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-11 rounded-full" />
          ))}
        </div>
      ) : !dia || !libre(dia) ? (
        <p className="rounded-xl bg-cream px-4 py-3 text-body text-body-2">
          {!data?.some((d) => d.slots.some((s) => s.available))
            ? t('slots.sinHuecosVentana')
            : dia
              ? t('slots.diaLleno', { fecha: formatLongDate(fromDateKey(dia), idioma) })
              : t('slots.eligeDia')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-meta font-semibold text-body-2 first-letter:uppercase">
            {formatLongDate(fromDateKey(dia), idioma)}
            {cerrado && ` · ${t('slots.cerrado')}`}
          </p>
          {[
            { id: 'manana', titulo: t('fecha.manana'), lista: manana },
            { id: 'tarde', titulo: t('fecha.tarde'), lista: tarde },
          ]
            .filter((g) => g.lista.some((s) => s.available))
            .map((g) => (
              <div key={g.id} role="group" aria-label={g.titulo}>
                <p className="mb-2 text-caption font-semibold tracking-[0.04em] text-muted uppercase">
                  {g.titulo}
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {g.lista
                    .filter((s) => s.available)
                    .map((s) => (
                      <button
                        key={s.startsAt}
                        type="button"
                        aria-pressed={valor === s.startsAt}
                        onClick={() => onElegir(s.startsAt)}
                        className={cx(
                          'inline-flex min-h-11 items-center justify-center rounded-full border text-[14px] font-semibold tabular-nums',
                          'transition-colors duration-200',
                          valor === s.startsAt
                            ? 'border-brand bg-brand text-white'
                            : 'border-line bg-surface text-ink hover:border-brand',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <p className="text-meta text-muted">
        {t('slots.soloCaben')}{' '}
        <button
          type="button"
          onClick={() => {
            setAMano(true)
            // Se parte de la hora elegida, o de ahora redondeada.
            if (!valor) {
              const d = new Date()
              d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
              onElegir(d.toISOString())
            }
          }}
          className="inline-flex min-h-8 items-center font-semibold text-brand-text hover:underline"
        >
          {t('slots.otraHora')}
        </button>
      </p>
      {valor && (
        <p className="sr-only" aria-live="polite">
          {new Date(valor).toLocaleString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  )
}
