import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { addDaysKey, fromDateKey, monthLong, toDateKey, weekdayShort } from '@veline/shared'
import { cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Un mes en cuadrícula, para elegir un día.
 *
 * Había tres calendarios distintos (el del panel, el de la reserva y el de
 * reprogramar) y ninguno servía para reservar a dos meses vista: la reserva
 * enseñaba una tira de catorce días. Este es el único. Quien lo usa le dice
 * cómo está cada día (`estado`) y qué pintar debajo del número (`extra`,
 * para los puntos de disponibilidad o el número de citas).
 *
 * Teclado: flechas para moverse de día, Inicio/Fin para los extremos de la
 * semana, RePág/AvPág para cambiar de mes. Un solo día en el orden de
 * tabulación (el elegido o el primero disponible), como pide el patrón de
 * cuadrícula de ARIA.
 */

export type EstadoDia = 'disponible' | 'sinHueco' | 'cerrado' | 'fuera'

export function CalendarioMes({
  mes,
  onMes,
  dia,
  onDia,
  estado,
  extra,
  minimo,
  maximo,
  titulo,
  className,
}: {
  /** Primer día del mes que se enseña, AAAA-MM-DD. */
  mes: string
  onMes: (primerDia: string) => void
  /** El día elegido, AAAA-MM-DD, o null. */
  dia: string | null
  onDia: (dia: string) => void
  /** Cómo está cada día. `fuera` no se puede elegir. */
  estado: (dia: string) => EstadoDia
  /** Algo debajo del número: puntos, un contador. */
  extra?: (dia: string) => ReactNode
  /** Primer y último día que se pueden mirar (AAAA-MM-DD). */
  minimo?: string
  maximo?: string
  /** Título propio; si no, el mes y el año. */
  titulo?: string
  className?: string
}) {
  const { t, idioma } = useIdioma()
  const id = useId()
  const cuadricula = useRef<HTMLDivElement>(null)

  const inicio = fromDateKey(mes)
  const anio = inicio.getFullYear()
  const numMes = inicio.getMonth()
  const primero = toDateKey(new Date(anio, numMes, 1))
  const diasEnMes = new Date(anio, numMes + 1, 0).getDate()
  const huecoInicial = (inicio.getDay() + 6) % 7 // lunes = 0
  const mesAnterior = toDateKey(new Date(anio, numMes - 1, 1))
  const mesSiguiente = toDateKey(new Date(anio, numMes + 1, 1))
  const ultimoDelMes = toDateKey(new Date(anio, numMes, diasEnMes))

  const puedeAtras = !minimo || mesAnterior >= minimo.slice(0, 7) + '-01'
  const puedeAdelante = !maximo || mesSiguiente <= maximo

  const dias = Array.from({ length: diasEnMes }, (_, i) => addDaysKey(primero, i))
  const elegible = (d: string) => estado(d) !== 'fuera'
  // El que lleva el foco: el elegido si está en este mes, si no el primero disponible.
  const conFoco =
    dia && dia >= primero && dia <= ultimoDelMes
      ? dia
      : (dias.find((d) => estado(d) === 'disponible') ?? dias.find(elegible) ?? primero)

  const enfocar = (d: string) =>
    cuadricula.current?.querySelector<HTMLButtonElement>(`[data-dia="${d}"]`)?.focus()

  const alTeclear = (e: KeyboardEvent, d: string) => {
    let destino: string | null = null
    if (e.key === 'ArrowRight') destino = addDaysKey(d, 1)
    else if (e.key === 'ArrowLeft') destino = addDaysKey(d, -1)
    else if (e.key === 'ArrowDown') destino = addDaysKey(d, 7)
    else if (e.key === 'ArrowUp') destino = addDaysKey(d, -7)
    else if (e.key === 'Home') destino = addDaysKey(d, -((fromDateKey(d).getDay() + 6) % 7))
    else if (e.key === 'End') destino = addDaysKey(d, 6 - ((fromDateKey(d).getDay() + 6) % 7))
    else if (e.key === 'PageDown' && puedeAdelante) destino = mesSiguiente
    else if (e.key === 'PageUp' && puedeAtras) destino = mesAnterior
    else return
    e.preventDefault()
    if (destino < primero || destino > ultimoDelMes) {
      onMes(
        toDateKey(new Date(fromDateKey(destino).getFullYear(), fromDateKey(destino).getMonth(), 1)),
      )
      // El mes nuevo se pinta en el siguiente render: se enfoca entonces.
      const objetivo = destino
      requestAnimationFrame(() => enfocar(objetivo))
    } else {
      enfocar(destino)
    }
  }

  const celdas: (string | null)[] = [...Array<null>(huecoInicial).fill(null), ...dias]
  const semanas: (string | null)[][] = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-mes`} className="font-display text-ui font-semibold text-ink capitalize">
          {titulo ?? `${monthLong(numMes, idioma)} ${anio}`}
        </h2>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label={t('fecha.mesAnterior')}
            disabled={!puedeAtras}
            onClick={() => onMes(mesAnterior)}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-subheading leading-none text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            type="button"
            aria-label={t('fecha.mesSiguiente')}
            disabled={!puedeAdelante}
            onClick={() => onMes(mesSiguiente)}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-subheading leading-none text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
          >
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>

      <div
        ref={cuadricula}
        role="grid"
        aria-labelledby={`${id}-mes`}
        className="flex flex-col gap-1"
      >
        <div role="row" className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <div
              key={wd}
              role="columnheader"
              className="py-1 text-center text-caption font-semibold tracking-wide text-subtle uppercase"
            >
              {weekdayShort(wd, idioma)}
            </div>
          ))}
        </div>
        {semanas.map((semana, i) => (
          <div key={i} role="row" className="grid grid-cols-7 gap-1">
            {semana.map((d, j) =>
              d === null ? (
                <div key={`v${j}`} role="gridcell" aria-hidden />
              ) : (
                <div key={d} role="gridcell" className="min-w-0">
                  <button
                    type="button"
                    data-dia={d}
                    tabIndex={d === conFoco ? 0 : -1}
                    disabled={!elegible(d)}
                    aria-pressed={d === dia}
                    aria-label={`${fromDateKey(d).getDate()} ${monthLong(numMes, idioma)}${
                      estado(d) === 'cerrado'
                        ? ` · ${t('cal.cerrado')}`
                        : estado(d) === 'sinHueco'
                          ? ` · ${t('cal.completo')}`
                          : ''
                    }`}
                    onClick={() => onDia(d)}
                    onKeyDown={(e) => alTeclear(e, d)}
                    className={cx(
                      'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl border text-body font-semibold tabular-nums transition-colors duration-150',
                      'outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                      d === dia
                        ? 'border-brand bg-brand text-white'
                        : estado(d) === 'disponible'
                          ? 'border-line bg-surface text-ink hover:border-brand hover:text-brand'
                          : estado(d) === 'sinHueco'
                            ? 'border-line bg-canvas text-subtle line-through decoration-line-strong'
                            : 'border-transparent bg-transparent text-disabled',
                    )}
                  >
                    <span>{fromDateKey(d).getDate()}</span>
                    {extra?.(d)}
                  </button>
                </div>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
