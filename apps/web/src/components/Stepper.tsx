import { cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Dónde se está en un flujo de varios pasos: «Paso 2 de 4 · Fecha y hora».
 *
 * Una sola pieza para el asistente del panel, la reserva del cliente y el
 * alta del negocio, para que los tres se sientan iguales. En pantalla grande
 * se ven los nombres de todos los pasos con el actual marcado; en el móvil,
 * una barra con el texto, que ocupa menos y se lee de un vistazo. Siempre
 * `aria-current="step"` en el actual, que es lo que lee el lector.
 */
export function Stepper({
  pasos,
  actual,
  className,
  compacto = false,
}: {
  /** Los nombres, en orden. */
  pasos: string[]
  /** Índice del paso actual, desde 0. */
  actual: number
  className?: string
  /** Solo la barra, también en escritorio (cuando el espacio es poco). */
  compacto?: boolean
}) {
  const { t } = useIdioma()
  const total = pasos.length
  const n = Math.min(actual, total - 1)
  const texto = t('wiz.pasoDe', { n: n + 1, total })

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {!compacto && (
        <ol className="hidden flex-wrap items-center gap-x-2 gap-y-1 sm:flex">
          {pasos.map((nombre, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="h-px w-4 bg-line-strong" />}
              <span
                aria-current={i === n ? 'step' : undefined}
                className={cx(
                  'inline-flex items-center gap-1.5 text-meta font-semibold',
                  i === n ? 'text-ink' : i < n ? 'text-body-2' : 'text-subtle',
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    'grid size-5 place-items-center rounded-full border text-caption tabular-nums',
                    i < n && 'border-ink bg-ink text-cream',
                    i === n && 'border-brand bg-brand text-white',
                    i > n && 'border-line-strong bg-surface',
                  )}
                >
                  {i < n ? '✓' : i + 1}
                </span>
                {nombre}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className={cx('flex flex-col gap-2', !compacto && 'sm:hidden')}>
        <p className="text-meta font-semibold text-body-2">
          {texto} · <span className="text-ink">{pasos[n]}</span>
        </p>
        <div
          role="progressbar"
          aria-label={texto}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={n + 1}
          className="flex gap-1"
        >
          {pasos.map((_, i) => (
            <span
              key={i}
              className={cx(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                i <= n ? 'bg-brand' : 'bg-line',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
