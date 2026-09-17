import { useEffect, useRef, type KeyboardEvent } from 'react'
import { cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Cuánto dura algo, elegido a rueda: horas a un lado y minutos al otro.
 *
 * Antes era una casilla donde se escribía el número de minutos, y eso obliga a
 * hacer la cuenta de cabeza: una sesión de hora y media son 90, y un servicio
 * de dos horas y cuarto, 135. Quien configura su negocio piensa en «hora y
 * media», no en minutos, y cada cuenta a mano es una ocasión de escribir un 9
 * donde iba un 90 y dejar la agenda descuadrada.
 *
 * La rueda no deja elegir un imposible: los valores que se saldrían del mínimo
 * o del máximo salen apagados y no se pueden pulsar, así que el aviso de error
 * no llega a hacer falta.
 */

/** Alto de cada fila, en píxeles. Tiene que coincidir con la clase `h-11`. */
const ALTO = 44

/** Cuántas filas se ven a la vez. Impar, para que haya una en el centro. */
const VISIBLES = 5

function Columna({
  valores,
  valor,
  etiqueta,
  permitido,
  onElegir,
}: {
  valores: number[]
  valor: number
  /** Nombre para quien no ve la columna: «Horas», «Minutos». */
  etiqueta: string
  permitido: (v: number) => boolean
  onElegir: (v: number) => void
}) {
  const caja = useRef<HTMLDivElement>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const moviendo = useRef(false)

  const colocar = (v: number, suave: boolean) => {
    const nodo = caja.current
    const i = valores.indexOf(v)
    if (!nodo || i < 0) return
    nodo.scrollTo({ top: i * ALTO, behavior: suave ? 'smooth' : 'auto' })
  }

  /* Seguir al valor cuando cambia desde fuera —al abrir el formulario, al
     editar un servicio que ya existe—, pero nunca mientras el dedo está
     arrastrando: colocarla ahí sería pelearse con quien la está moviendo. */
  useEffect(() => {
    if (!moviendo.current) colocar(valor, false)
  }, [valor])

  /* La rueda no avisa de cuándo ha parado en todos los navegadores, así que se
     espera a que deje de llegar movimiento y entonces se mira dónde quedó. */
  const alMover = () => {
    moviendo.current = true
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      moviendo.current = false
      const nodo = caja.current
      if (!nodo) return
      const i = Math.max(0, Math.min(Math.round(nodo.scrollTop / ALTO), valores.length - 1))
      const elegido = valores[i]
      if (elegido === undefined) return
      // Si ha parado en uno que no se puede, vuelve al que había.
      if (permitido(elegido)) onElegir(elegido)
      else colocar(valor, true)
    }, 140)
  }

  /* Flechas para llegar sin ratón: se salta lo que no se puede elegir, igual
     que hace el dedo al rebotar. */
  const alTeclear = (e: KeyboardEvent) => {
    const paso = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!paso) return
    e.preventDefault()
    for (let i = valores.indexOf(valor) + paso; i >= 0 && i < valores.length; i += paso) {
      const siguiente = valores[i]
      if (siguiente !== undefined && permitido(siguiente)) {
        onElegir(siguiente)
        return
      }
    }
  }

  const relleno = ((VISIBLES - 1) / 2) * ALTO

  return (
    <div
      ref={caja}
      role="group"
      aria-label={etiqueta}
      onScroll={alMover}
      onKeyDown={alTeclear}
      className={cx(
        'sin-barra snap-y snap-mandatory overflow-y-auto overscroll-contain',
        // Se difumina por arriba y por abajo: deja ver que hay más sin que los
        // números de los bordes compitan con el elegido.
        '[mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)]',
      )}
      style={{ height: VISIBLES * ALTO, scrollPaddingTop: relleno }}
    >
      <div style={{ paddingTop: relleno, paddingBottom: relleno }}>
        {valores.map((v) => {
          const elegido = v === valor
          return (
            <button
              key={v}
              type="button"
              disabled={!permitido(v)}
              tabIndex={elegido ? 0 : -1}
              aria-current={elegido || undefined}
              onClick={() => onElegir(v)}
              className={cx(
                'flex h-11 w-full snap-center items-center justify-center text-ui tabular-nums',
                'transition-colors duration-150',
                elegido ? 'font-semibold text-ink' : 'text-muted',
                !permitido(v) && 'text-disabled',
              )}
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const HASTA = (n: number) => Array.from({ length: n }, (_, i) => i)

export function SelectorDuracion({
  minutos,
  onCambiar,
  min = 0,
  max = 480,
  etiquetaHoras,
  etiquetaMinutos,
}: {
  minutos: number
  onCambiar: (m: number) => void
  /** Lo menos que se puede elegir. Por debajo, los números salen apagados. */
  min?: number
  max?: number
  etiquetaHoras: string
  etiquetaMinutos: string
}) {
  const { t } = useIdioma()
  const horas = Math.floor(minutos / 60)
  const sueltos = minutos % 60

  const cabe = (m: number) => m >= min && m <= max

  return (
    <div className="relative flex w-fit items-stretch gap-1 rounded-xl border border-line bg-surface px-3">
      {/* La banda del centro marca lo elegido y no se puede pulsar: es el
          fondo de la fila, no un control. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-1/2 h-11 -translate-y-1/2 rounded-lg bg-canvas"
      />

      <div className="relative flex items-center gap-1">
        <Columna
          valores={HASTA(Math.floor(max / 60) + 1)}
          valor={horas}
          etiqueta={etiquetaHoras}
          permitido={(h) => cabe(h * 60 + sueltos) || cabe(h * 60)}
          onElegir={(h) => onCambiar(Math.min(Math.max(h * 60 + sueltos, min), max))}
        />
        <span aria-hidden className="text-meta text-muted">
          {t('comun.h')}
        </span>
      </div>

      <div className="relative flex items-center gap-1">
        <Columna
          valores={HASTA(60)}
          valor={sueltos}
          etiqueta={etiquetaMinutos}
          permitido={(m) => cabe(horas * 60 + m)}
          onElegir={(m) => onCambiar(horas * 60 + m)}
        />
        <span aria-hidden className="text-meta text-muted">
          {t('comun.min')}
        </span>
      </div>
    </div>
  )
}
