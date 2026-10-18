import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cx } from './ui'

/**
 * Control segmentado a ancho completo: dos opciones, dos mitades; tres, tres
 * tercios. Para elegir UNA vista o UNA parte entre pocas (Lista · Calendario,
 * Ficha pública · Fotos, Horario · Cierres · Locales).
 *
 * Es el mismo dibujo que el selector de idioma, pero ocupando el ancho que
 * le dan: en el móvil llena la pantalla respetando los márgenes, en
 * escritorio se puede acotar con `className` (max-w-sm). Antes cada sitio
 * tenía sus píldoras sueltas, de distinto alto y sin regla.
 *
 * Dos sabores con el mismo aspecto:
 *   - `opciones` + `valor` + `onCambiar`: botones (radiogroup). Flechas para
 *     moverse, como pide ARIA.
 *   - `opciones` con `to`: enlaces (NavLink), para partes con dirección
 *     propia. Ahí no hay estado: la ruta manda.
 */

interface Opcion<T extends string> {
  id: T
  label: ReactNode
  /** Si es un enlace. Con esto, el segmentado es navegación. */
  to?: string
  contador?: number
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambiar,
  label,
  className,
  tamano = 'md',
  onAntesDeNavegar,
  onIntencion,
}: {
  opciones: Opcion<T>[]
  /** El elegido (solo para el sabor de botones). */
  valor?: T
  onCambiar?: (id: T) => void
  /** Para el lector de pantalla: qué se elige aquí. */
  label: string
  className?: string
  /** `md` 44 px (el de página); `sm` 36 px dentro de una ficha o tarjeta. */
  tamano?: 'sm' | 'md'
  /** Para los enlaces: si devuelve false, no se navega (cambios sin guardar). */
  onAntesDeNavegar?: (to: string) => boolean
  /** Para los enlaces: el ratón o el dedo se acercan (para precargar). */
  onIntencion?: (to: string) => void
}) {
  const grupo = useRef<HTMLDivElement>(null)
  const sonEnlaces = opciones.some((o) => o.to)

  const alTeclear = (e: KeyboardEvent) => {
    if (sonEnlaces || !onCambiar) return
    const i = opciones.findIndex((o) => o.id === valor)
    const ir = (j: number) => {
      const o = opciones[(j + opciones.length) % opciones.length]!
      onCambiar(o.id)
      grupo.current
        ?.querySelectorAll<HTMLButtonElement>('button')
        [(j + opciones.length) % opciones.length]?.focus()
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ir(i + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ir(i - 1)
    else if (e.key === 'Home') ir(0)
    else if (e.key === 'End') ir(opciones.length - 1)
    else return
    e.preventDefault()
  }

  const base = cx(
    /* Con tres o más, cada una ocupa lo que pide su texto y, si no cabe, se parte
       en dos líneas: con anchos iguales, un nombre largo se salía de su hueco y
       tocaba al vecino. */
    'relative flex min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-center leading-tight font-semibold',
    opciones.length > 2 ? 'flex-auto py-1' : 'flex-1 whitespace-nowrap',
    'transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
    tamano === 'md' ? 'min-h-10 text-body' : 'min-h-8 text-meta',
  )
  const activoCls = 'bg-surface text-ink shadow-raised'
  const inactivoCls = 'text-body-2 hover:text-ink'

  const contador = (n?: number) =>
    n !== undefined && (
      <span className="rounded-full bg-canvas px-1.5 text-caption font-bold text-body-2 tabular-nums">
        {n}
      </span>
    )

  return (
    <div
      ref={grupo}
      role={sonEnlaces ? undefined : 'radiogroup'}
      aria-label={label}
      onKeyDown={alTeclear}
      className={cx(
        'flex w-full gap-0.5 rounded-full border border-line bg-cream p-1',
        tamano === 'md' ? 'min-h-12' : 'min-h-10',
        className,
      )}
    >
      {sonEnlaces ? (
        <nav aria-label={label} className="contents">
          {opciones.map((o) => (
            <NavLink
              key={o.id}
              to={o.to!}
              end
              onClick={(e) => {
                if (onAntesDeNavegar && !onAntesDeNavegar(o.to!)) e.preventDefault()
              }}
              onPointerEnter={() => onIntencion?.(o.to!)}
              onFocus={() => onIntencion?.(o.to!)}
              onTouchStart={() => onIntencion?.(o.to!)}
              className={({ isActive }) => cx(base, isActive ? activoCls : inactivoCls)}
            >
              {o.label}
              {contador(o.contador)}
            </NavLink>
          ))}
        </nav>
      ) : (
        opciones.map((o) => {
          const activo = o.id === valor
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={activo}
              tabIndex={activo ? 0 : -1}
              onClick={() => onCambiar?.(o.id)}
              className={cx(base, activo ? activoCls : inactivoCls)}
            >
              {o.label}
              {contador(o.contador)}
            </button>
          )
        })
      )}
    </div>
  )
}
