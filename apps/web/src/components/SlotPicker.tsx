import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  TIMEZONE,
  formatLongDate,
  fromDateKey,
  hoyMadrid,
  instanteAMadridLocal,
  madridDateKey,
  madridLocalAInstante,
  toDateKey,
} from '@veline/shared'
import { api } from '../lib/api'
import { ErrorNote, Field, Input, Skeleton, cx } from './ui'
import { CalendarioMes, type EstadoDia } from './CalendarioMes'
import { useIdioma } from '../i18n/idioma'
import { textoDeError } from './Avisos'

const primerDiaDelMes = (key: string) => `${key.slice(0, 7)}-01`
const ultimoDiaDelMes = (key: string) => {
  const d = fromDateKey(primerDiaDelMes(key))
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** Fecha y hora de Madrid en el formato de un <input type="datetime-local">.
    Lo escrito ahí es hora de Madrid, esté el navegador donde esté. */
const paraInput = instanteAMadridLocal

/**
 * Los huecos libres de verdad, para apuntar o mover una cita desde el panel.
 *
 * Antes la hora se escribía a mano, sin saber si había alguien libre, y el
 * «No queda nadie libre a esa hora» llegaba después de rellenarlo todo. Ahora
 * se ve qué días tienen sitio y qué horas caben enteras con lo elegido (el
 * servicio con sus extras, o la duración de la cita que se mueve). La hora a
 * mano sigue ahí para lo excepcional —un cliente que entra por la puerta
 * fuera de horario—, y el servidor comprueba igual que haya alguien.
 *
 * Los días van en el mismo calendario de mes que la reserva del cliente. Antes
 * eran una tira de catorce días con scroll horizontal: no se sabía en qué mes
 * se estaba y mucha gente no descubría que la tira se desplazaba.
 */
export function SlotPicker({
  slug,
  consulta,
  valor,
  onElegir,
  diaInicial,
  minimo,
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
  /** El primer día que se puede elegir (AAAA-MM-DD). Por defecto, hoy. Para
      mover una cita a después de un cierre, por ejemplo. */
  minimo?: string
}) {
  const { t, idioma, locale } = useIdioma()
  const id = useId()
  const hoyReal = hoyMadrid()
  // Nada anterior a hoy, ni al primer día que se pueda elegir.
  const hoy = minimo && minimo > hoyReal ? minimo : hoyReal
  const [mes, setMes] = useState(() =>
    primerDiaDelMes(diaInicial && diaInicial > hoy ? diaInicial : hoy),
  )
  const [dia, setDia] = useState<string | null>(diaInicial ?? null)
  const [aMano, setAMano] = useState(false)
  // Se pide el mes a la vista, sin lo que ya ha pasado.
  const desde = mes > hoy ? mes : hoy
  const hasta = ultimoDiaDelMes(mes)

  const {
    data: datosMes,
    isFetching,
    isPlaceholderData,
    isError,
    error,
  } = useQuery({
    queryKey: ['panel', slug, 'disponibilidad', consulta, desde, hasta],
    queryFn: () => api.panelDisponibilidad(slug, { ...consulta, from: desde, to: hasta }),
    enabled: !aMano && !!(consulta.serviceId || consulta.bookingId) && desde <= hasta,
    // Al cambiar de mes el calendario se queda quieto mientras llega el nuevo.
    placeholderData: keepPreviousData,
  })
  // Lo de otro mes no vale para este: mientras llega, los días «cargando».
  const data = isPlaceholderData ? undefined : datosMes
  const cargando = isFetching && !data

  const porDia = useMemo(() => new Map((data ?? []).map((d) => [d.date, d])), [data])
  const libre = (key: string) => porDia.get(key)?.slots.some((s) => s.available) ?? false

  /* Al abrir, y al pasar de mes, se coloca en el primer día con sitio.
     Un día elegido a propósito (el del calendario) no se cambia aunque esté
     lleno: se dice que lo está, que saltar a otro sin avisar despista. */
  useEffect(() => {
    if (!data || (dia && dia >= desde && dia <= hasta)) return
    setDia(data.find((d) => d.slots.some((s) => s.available))?.date ?? null)
  }, [data])

  // La hora elegida deja de valer si ya no está libre con lo nuevo. Solo se
  // puede saber con su mes a la vista.
  useEffect(() => {
    if (!data || !valor || aMano) return
    const suDia = madridDateKey(valor)
    if (suDia < desde || suDia > hasta) return
    const sigue = data.some((d) => d.slots.some((s) => s.startsAt === valor && s.available))
    if (!sigue) onElegir(null)
  }, [data])

  /* La altura que tenían las horas: mientras llegan las del mes nuevo, el
     esqueleto ocupa eso mismo y el diálogo no da un salto. */
  const cajaHoras = useRef<HTMLDivElement>(null)
  const ultimaAltura = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (!cargando && cajaHoras.current) ultimaAltura.current = cajaHoras.current.offsetHeight
  })

  const estado = (key: string): EstadoDia => {
    if (key < hoy) return 'fuera'
    if (cargando) return 'cargando'
    const d = porDia.get(key)
    if (d?.closed) return 'cerrado'
    return libre(key) ? 'disponible' : 'sinHueco'
  }

  const huecos = (dia && porDia.get(dia)?.slots) || []
  const manana = huecos.filter((s) => Number(s.label.slice(0, 2)) < 14)
  const tarde = huecos.filter((s) => Number(s.label.slice(0, 2)) >= 14)
  const cerrado = dia ? porDia.get(dia)?.closed : false

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
              onElegir(e.target.value ? madridLocalAInstante(e.target.value).toISOString() : null)
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
            className="inline-flex min-h-9 max-sm:min-h-11 items-center text-meta font-semibold text-brand-text hover:underline"
          >
            {t('slots.volverAHuecos')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CalendarioMes
        mes={mes}
        onMes={(m) => {
          setMes(m)
          setDia(null)
        }}
        dia={dia}
        onDia={setDia}
        estado={estado}
        minimo={hoy}
      />

      <div
        ref={cajaHoras}
        className="overflow-hidden"
        style={cargando && ultimaAltura.current ? { height: ultimaAltura.current } : undefined}
      >
        {isError ? (
          <ErrorNote>{textoDeError(error, t('slots.noSeCargaron'))}</ErrorNote>
        ) : cargando ? (
          <div className="grid grid-cols-4 gap-2" aria-busy="true">
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
                            'inline-flex min-h-11 items-center justify-center rounded-full border text-body font-semibold tabular-nums',
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
      </div>

      <p className="text-meta text-muted">
        {t('slots.soloCaben')}{' '}
        <button
          type="button"
          onClick={() => {
            setAMano(true)
            // Se parte de la hora elegida, o de ahora redondeada.
            if (!valor) {
              // La próxima media hora, contada en la hora de Madrid.
              const ahora = new Date()
              ahora.setSeconds(0, 0)
              const resto = Number(instanteAMadridLocal(ahora).slice(-2)) % 30
              onElegir(new Date(ahora.getTime() + (30 - resto) * 60_000).toISOString())
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
            timeZone: TIMEZONE,
          })}
        </p>
      )}
    </div>
  )
}
