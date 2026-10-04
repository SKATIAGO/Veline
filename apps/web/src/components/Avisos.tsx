import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './ui'
import { ApiError } from '../lib/api'
import { useIdioma } from '../i18n/idioma'

/**
 * Avisos de resultado: «Servicio guardado», «Cita apuntada · Ver».
 *
 * Antes casi nada en el panel decía si había salido bien. Crear un negocio,
 * una cita o un servicio refrescaba la página en silencio, y una cita
 * apuntada para mañana desaparecía de la vista «Hoy» como si no se hubiera
 * guardado. Ahora toda acción termina en un aviso.
 *
 *   - Éxito: se va solo a los 5 segundos (se para mientras el ratón está
 *     encima). Puede llevar una acción: «Deshacer» o «Ver».
 *   - Error: se queda hasta cerrarlo. Lo que falla tiene que leerse entero.
 *
 * Los errores de un formulario NO van aquí: van en el campo o en el propio
 * formulario, donde se corrigen. Esto es para lo que pasa al pulsar un botón
 * suelto (ocultar, marcar, quitar) o al terminar algo.
 *
 * Se llama desde cualquier sitio, sin contexto: `aviso.ok('Guardado')`.
 */

interface Aviso {
  id: number
  tipo: 'ok' | 'error'
  texto: string
  accion?: { texto: string; onClick: () => void }
}

let avisos: Aviso[] = []
let siguiente = 1
const oyentes = new Set<() => void>()
const emitir = () => oyentes.forEach((o) => o())

function quitar(id: number) {
  avisos = avisos.filter((a) => a.id !== id)
  emitir()
}

function poner(tipo: Aviso['tipo'], texto: string, accion?: Aviso['accion']) {
  // Tres a la vista como mucho: más que eso ya no se leen.
  avisos = [...avisos.slice(-2), { id: siguiente++, tipo, texto, accion }]
  emitir()
}

export const aviso = {
  ok: (texto: string, accion?: Aviso['accion']) => poner('ok', texto, accion),
  error: (texto: string) => poner('error', texto),
}

/** El motivo que da el servidor, o uno genérico si el fallo no viene de él
    (sin conexión, por ejemplo). */
export const textoDeError = (err: unknown, generico: string) =>
  err instanceof ApiError ? err.message : generico

const suscribir = (o: () => void) => {
  oyentes.add(o)
  return () => oyentes.delete(o)
}
const leer = () => avisos

/** Una tarjeta. Se cuenta el tiempo aquí para poder pararlo al pasar el ratón. */
function Tarjeta({ a }: { a: Aviso }) {
  const { t } = useIdioma()
  /* Con «Deshacer» hace falta tiempo para leerlo y decidir: 8 segundos. Sin
     acción, 5 bastan. */
  const restante = useRef(a.accion ? 8000 : 5000)
  const inicio = useRef(0)
  const temporizador = useRef<number | undefined>(undefined)

  const arrancar = () => {
    if (a.tipo !== 'ok') return
    inicio.current = Date.now()
    temporizador.current = window.setTimeout(() => quitar(a.id), restante.current)
  }
  const parar = () => {
    window.clearTimeout(temporizador.current)
    restante.current -= Date.now() - inicio.current
  }

  useEffect(() => {
    arrancar()
    return () => window.clearTimeout(temporizador.current)
    // Solo al aparecer: el aviso no cambia una vez puesto.
  }, [])

  return (
    <div
      role={a.tipo === 'error' ? 'alert' : 'status'}
      onMouseEnter={parar}
      onMouseLeave={arrancar}
      className={cx(
        /* text-[14px] y no text-body: en este tema «body» es a la vez un tamaño y
           un color, y el color marrón ganaba al crema sobre el fondo oscuro. */
        'pointer-events-auto flex items-center gap-3 rounded-xl bg-ink py-2.5 pr-2 pl-3.5 text-[14px] leading-snug text-cream shadow-overlay',
        'motion-safe:animate-[veline-rise_220ms_cubic-bezier(.22,1,.36,1)]',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'grid size-5 shrink-0 place-items-center rounded-full text-caption font-bold text-white',
          a.tipo === 'ok' ? 'bg-emerald-700' : 'bg-danger',
        )}
      >
        {a.tipo === 'ok' ? '✓' : '!'}
      </span>
      {/* Algunos empiezan por un mes («septiembre de 2026 cerrado»). */}
      <span className="min-w-0 flex-1 first-letter:uppercase">{a.texto}</span>
      {a.accion && (
        <button
          type="button"
          onClick={() => {
            a.accion!.onClick()
            quitar(a.id)
          }}
          className="min-h-9 shrink-0 rounded-full px-3 text-[14px] font-bold text-accent transition-colors duration-200 hover:bg-ink-2"
        >
          {a.accion.texto}
        </button>
      )}
      <button
        type="button"
        onClick={() => quitar(a.id)}
        aria-label={t('comun.cerrar')}
        className="grid size-9 shrink-0 place-items-center rounded-full text-ui text-ondark-muted transition-colors duration-200 hover:bg-ink-2 hover:text-cream"
      >
        <span aria-hidden>×</span>
      </button>
    </div>
  )
}

/**
 * Dónde salen. Abajo a la izquierda en pantalla grande; en el móvil, encima
 * de la barra de secciones del panel para no taparla. Por encima de las
 * fichas abiertas: el resultado de confirmar algo sale cuando la ficha aún
 * está cerrándose.
 */
export function Avisos() {
  const lista = useSyncExternalStore(suscribir, leer, leer)
  const { t } = useIdioma()
  return createPortal(
    <section
      aria-label={t('avisos.region')}
      className={cx(
        'pointer-events-none fixed inset-x-4 z-[60] flex flex-col gap-2',
        // En pantalla grande, sobre el contenido y no sobre el menú lateral
        // (248 px), que tiene abajo el perfil y «Salir».
        'bottom-[calc(5rem+env(safe-area-inset-bottom))] md:right-auto md:bottom-6 md:left-[272px] md:w-[400px]',
      )}
    >
      {lista.map((a) => (
        <Tarjeta key={a.id} a={a} />
      ))}
    </section>,
    document.body,
  )
}
