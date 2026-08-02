import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { cx } from './ui'

type Variant = 'up' | 'zoom' | 'left' | 'right'

/**
 * El estado oculto va como estilo en línea, no como clase. Con clases hay que
 * confiar en que `.reveal.is-visible` gane la cascada a `.reveal`, y cualquier
 * regla que se cuele por medio deja contenido invisible. En línea no compite
 * con nada: se pone al ocultar y se quita al mostrar.
 */
const HIDDEN_TRANSFORM: Record<Variant, string> = {
  up: 'translateY(22px)',
  zoom: 'scale(0.94)',
  left: 'translateX(-26px)',
  right: 'translateX(26px)',
}

/* ────────────────────────────────────────────────────────────
 * Registro compartido: un único listener de scroll para todos los
 * elementos, limitado a un frame. Con ~25 elementos en la home sale más
 * barato y, sobre todo, más predecible que un IntersectionObserver por
 * elemento: hay entornos (webviews, paneles embebidos, algunos navegadores
 * con el compositor capado) donde el observer no llega a dispararse y el
 * contenido se quedaría invisible para siempre.
 * ──────────────────────────────────────────────────────────── */

const watchers = new Set<() => void>()
let scheduled = false
let listening = false

function runChecks() {
  scheduled = false
  for (const check of [...watchers]) check()
}

function onViewportChange() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(runChecks)
}

function ensureListening() {
  if (listening) return
  listening = true
  window.addEventListener('scroll', onViewportChange, { passive: true })
  window.addEventListener('resize', onViewportChange, { passive: true })
}

interface RevealProps {
  children: ReactNode
  /** Retardo en ms, para escalonar rejillas. */
  delay?: number
  variant?: Variant
  className?: string
  as?: ElementType
  id?: string
}

export function Reveal({
  children,
  delay = 0,
  variant = 'up',
  className,
  as: Tag = 'div',
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const check = () => {
      const alto = window.innerHeight || document.documentElement.clientHeight
      // Viewport degenerado (algunos paneles embebidos lo reportan a 0):
      // no hay forma de saber qué se ve, así que se muestra todo.
      if (!alto) {
        setVisible(true)
        watchers.delete(check)
        return
      }
      const r = node.getBoundingClientRect()
      if (r.top < alto - 60 && r.bottom > 0) {
        setVisible(true)
        watchers.delete(check)
      }
    }

    watchers.add(check)
    ensureListening()

    // Una comprobación inmediata (por si ya está en pantalla al cargar) y otra
    // al frame siguiente, cuando el layout ya está asentado.
    check()
    const frame = requestAnimationFrame(check)

    // Última red: si por lo que sea el scroll no llega a comprobarse (webviews
    // raros, scroll dentro de otro contenedor, un bug nuestro), a los 2,5 s se
    // muestra igual. Nunca puede quedarse contenido invisible.
    const failsafe = window.setTimeout(() => {
      setVisible(true)
      watchers.delete(check)
    }, 2500)

    return () => {
      watchers.delete(check)
      cancelAnimationFrame(frame)
      clearTimeout(failsafe)
    }
  }, [])

  return (
    <Tag
      ref={ref}
      id={id}
      // is-visible es solo un enganche para adornos (el subrayado .quill).
      // La visibilidad NO depende de esta clase, va en el estilo en línea.
      className={cx('reveal', visible && 'is-visible', className)}
      style={
        {
          transitionDelay: delay ? `${delay}ms` : undefined,
          ...(visible ? null : { opacity: 0, transform: HIDDEN_TRANSFORM[variant] }),
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  )
}
