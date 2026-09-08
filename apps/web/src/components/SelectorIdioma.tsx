import { useIdioma, type Idioma } from '../i18n/idioma'
import { cx } from './ui'

/**
 * El interruptor ES / EN.
 *
 * Dos botones y no un desplegable: con dos idiomas, un <select> obliga a
 * abrir, leer y elegir para hacer lo único que se puede hacer —cambiar al
 * otro—. Aquí se ve el idioma actual y el disponible de un vistazo, y se
 * cambia con un click.
 *
 * Las etiquetas van en el idioma al que llevan, no traducidas: quien busca la
 * versión inglesa busca «EN», no «Inglés», y quien no entiende la página
 * tampoco entendería la palabra.
 */

const IDIOMAS: { codigo: Idioma; etiqueta: string; nombre: string }[] = [
  { codigo: 'es', etiqueta: 'ES', nombre: 'Español' },
  { codigo: 'en', etiqueta: 'EN', nombre: 'English' },
]

export function SelectorIdioma({ className }: { className?: string }) {
  const { idioma, cambiar, t } = useIdioma()

  return (
    <div
      role="group"
      aria-label={t('comun.idioma')}
      className={cx(
        'flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-cream p-0.5',
        className,
      )}
    >
      {IDIOMAS.map((i) => {
        const activo = i.codigo === idioma
        return (
          <button
            key={i.codigo}
            type="button"
            // lang para que el lector de pantalla no lea «EN» como una palabra
            // castellana, y aria-label con el nombre completo: «EN» a secas no
            // dice nada en voz alta.
            lang={i.codigo}
            aria-label={i.nombre}
            aria-pressed={activo}
            onClick={() => cambiar(i.codigo)}
            className={cx(
              'min-h-8 min-w-9 rounded-full px-2 text-meta font-semibold transition-colors duration-200',
              activo ? 'bg-ink text-cream' : 'text-subtle hover:bg-canvas hover:text-ink',
            )}
          >
            {i.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
