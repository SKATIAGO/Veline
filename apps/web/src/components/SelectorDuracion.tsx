import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatDuration } from '@veline/shared'
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

/** Ancho de cada columna. Estrecha, el dedo la arrastraba sin apuntar bien:
    esto le da una zona de agarre cómoda, del tamaño de un botón normal. */
const ANCHO_COLUMNA = 76

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
      style={{ height: VISIBLES * ALTO, width: ANCHO_COLUMNA, scrollPaddingTop: relleno }}
      className={cx(
        'sin-barra snap-y snap-mandatory overflow-y-auto overscroll-contain',
        // Se difumina por arriba y por abajo: deja ver que hay más sin que los
        // números de los bordes compitan con el elegido.
        '[mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)]',
      )}
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

/** La rueda sola, sin envoltorio: horas y minutos, siempre visible. */
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
    <div className="relative mx-1 flex w-fit items-stretch">
      {/* La banda del centro marca lo elegido y no se puede pulsar: es el
          fondo de la fila, no un control. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-1 top-1/2 h-11 -translate-y-1/2 rounded-lg bg-canvas"
      />

      <div className="relative flex items-center gap-2 pl-1">
        <Columna
          valores={HASTA(Math.floor(max / 60) + 1)}
          valor={horas}
          etiqueta={etiquetaHoras}
          permitido={(h) => cabe(h * 60 + sueltos) || cabe(h * 60)}
          onElegir={(h) => onCambiar(Math.min(Math.max(h * 60 + sueltos, min), max))}
        />
        <span aria-hidden className="text-body text-muted">
          {t('comun.h')}
        </span>
      </div>

      {/* Separador entre las dos ruedas: sin él, «0 34» se leía como un solo
          número y no como hora y minuto de columnas distintas. */}
      <div aria-hidden className="mx-2 w-px shrink-0 self-stretch bg-line" />

      <div className="relative flex items-center gap-2 pr-1">
        <Columna
          valores={HASTA(60)}
          valor={sueltos}
          etiqueta={etiquetaMinutos}
          permitido={(m) => cabe(horas * 60 + m)}
          onElegir={(m) => onCambiar(horas * 60 + m)}
        />
        <span aria-hidden className="text-body text-muted">
          {t('comun.min')}
        </span>
      </div>
    </div>
  )
}

/**
 * Un campo de duración, cerrado por defecto.
 *
 * La rueda entera —dos columnas, con sus etiquetas— ocupa más de lo que un
 * formulario normal dedica a un campo, y tenerla siempre desplegada empuja
 * todo lo de abajo. Aquí se ve como cualquier otro campo, con lo elegido
 * escrito («1 h 30 min»); tocarlo abre la rueda debajo, y tocarlo otra vez
 * la cierra, dejando de nuevo solo el texto. Así se puede ajustar antes
 * horas y luego minutos sin que se cierre a mitad.
 */
export function CampoDuracion({
  label,
  required,
  minutos,
  onCambiar,
  min,
  max,
  etiquetaHoras,
  etiquetaMinutos,
}: {
  label: string
  required?: boolean
  minutos: number
  onCambiar: (m: number) => void
  min?: number
  max?: number
  etiquetaHoras: string
  etiquetaMinutos: string
}) {
  const { idioma } = useIdioma()
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-meta font-semibold text-body-2">
        {label}
        {required && <span className="text-brand-text"> *</span>}
      </span>

      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-line bg-surface px-3.5 text-body text-ink transition-colors duration-200 hover:border-line-strong"
      >
        {formatDuration(minutos, idioma)}
        <span
          aria-hidden
          className={cx(
            'text-meta text-muted transition-transform duration-200',
            abierto && 'rotate-180',
          )}
        >
          ▾
        </span>
      </button>

      {/* Grid de 0fr a 1fr: la misma cortina que las preguntas de precios,
          para que abrir y cerrar se vea como un gesto y no como un salto. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: abierto ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pt-3">
            <SelectorDuracion
              minutos={minutos}
              onCambiar={onCambiar}
              min={min}
              max={max}
              etiquetaHoras={etiquetaHoras}
              etiquetaMinutos={etiquetaMinutos}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
