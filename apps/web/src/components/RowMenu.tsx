import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './ui'
import { useIdioma } from '../i18n/idioma'

export interface AccionFila {
  label: string
  onClick: () => void
  /** Borrar, dar de baja, cerrar: en el color de lo que no conviene tocar sin mirar. */
  peligro?: boolean
  disabled?: boolean
}

/**
 * Las acciones secundarias de una fila, detrás de «···».
 *
 * Las filas del panel llegaron a llevar cinco botones sueltos (Dar de alta,
 * Horario, Renombrar, Dar de baja…), del mismo peso y a pocos píxeles unos de
 * otros. Ahora la fila se pulsa para lo principal —abrirla, editarla— y el
 * resto vive aquí, igual en todas las listas.
 *
 * Se pinta en <body> con posición fija: las listas van dentro de tarjetas con
 * overflow oculto, y un menú dentro de ellas salía cortado. Se abre hacia
 * arriba si abajo no cabe. Teclado: flechas para moverse, Escape para cerrar
 * y el foco vuelve al botón.
 */
export function RowMenu({ acciones, label }: { acciones: AccionFila[]; label: string }) {
  const { t } = useIdioma()
  const id = useId()
  const boton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)

  const cerrar = (devolverFoco = true) => {
    setAbierto(false)
    setPos(null)
    if (devolverFoco) boton.current?.focus()
  }

  // Dónde sale: pegado al botón, por debajo o por encima según quepa.
  useLayoutEffect(() => {
    if (!abierto || !boton.current) return
    const r = boton.current.getBoundingClientRect()
    const alto = menu.current?.offsetHeight ?? 44 * acciones.length + 12
    const right = Math.max(8, window.innerWidth - r.right)
    setPos(
      r.bottom + 4 + alto > window.innerHeight - 8
        ? { bottom: window.innerHeight - r.top + 4, right }
        : { top: r.bottom + 4, right },
    )
  }, [abierto, acciones.length])

  // El foco entra al primer elemento cuando el menú ya está colocado y a la
  // vista: antes de medirlo está oculto, y un elemento oculto no coge el foco.
  const colocado = !!pos
  useEffect(() => {
    if (abierto && colocado) {
      menu.current?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
    }
  }, [abierto, colocado])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node))
        cerrar(false)
    }
    // Con la página moviéndose, un menú fijo se quedaría flotando en otro sitio.
    const alMover = () => cerrar(false)
    document.addEventListener('pointerdown', fuera, true)
    window.addEventListener('scroll', alMover, true)
    window.addEventListener('resize', alMover)
    return () => {
      document.removeEventListener('pointerdown', fuera, true)
      window.removeEventListener('scroll', alMover, true)
      window.removeEventListener('resize', alMover)
    }
  }, [abierto])

  const alTeclear = (e: KeyboardEvent) => {
    const items = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []),
    ]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(i + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Tab') {
      cerrar(false)
    }
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={t('menu.acciones', { de: label })}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        className={cx(
          'grid size-10 shrink-0 place-items-center rounded-full text-body-2',
          'transition-colors duration-200 hover:bg-canvas hover:text-ink',
          abierto && 'bg-canvas text-ink',
        )}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>

      {abierto &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={label}
            onKeyDown={alTeclear}
            style={{
              top: pos?.top,
              bottom: pos?.bottom,
              right: pos?.right,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className={cx(
              'fixed z-[55] flex min-w-[200px] flex-col rounded-xl border border-line bg-surface p-1.5 shadow-raised',
              'motion-safe:animate-[veline-fade_120ms_ease-out]',
            )}
          >
            {acciones.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                disabled={a.disabled}
                onClick={() => {
                  cerrar(false)
                  a.onClick()
                }}
                className={cx(
                  'flex min-h-11 items-center rounded-lg px-3 text-left text-[14px] font-medium',
                  'transition-colors duration-150 focus:outline-none focus-visible:bg-canvas',
                  'disabled:opacity-45',
                  a.peligro ? 'text-brand-text hover:bg-brand/10' : 'text-ink hover:bg-canvas',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
