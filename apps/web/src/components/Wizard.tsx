import { useId, useState, type ReactNode } from 'react'
import { Button, ErrorNote, Sheet, cx } from './ui'
import { ConfirmDialog } from './Confirmar'
import { useIdioma } from '../i18n/idioma'

export interface Paso {
  id: string
  titulo: string
  contenido: ReactNode
  /** Lo que impide pasar al siguiente. Se enseña al pulsar «Siguiente». */
  problema?: string | null
}

/**
 * Un proceso de varias decisiones, paso a paso.
 *
 * Para lo que antes obligaba a recorrer varias pantallas (incorporar a alguien
 * eran Empleados → su horario → Administrador) o a rellenar un formulario largo
 * sin saber cuánto quedaba:
 *
 *   - Arriba, los pasos: hechos, el actual y los que faltan. En el móvil, «Paso
 *     2 de 4» con una barra, que una fila de cuatro nombres no cabe.
 *   - Abajo, pegado: «Atrás» y «Siguiente». Cada paso se comprueba al pulsar
 *     «Siguiente», no mientras se escribe, y volver atrás conserva lo escrito.
 *   - El último paso es un resumen con el botón que lo hace de verdad.
 *   - Al terminar, `resultado` sustituye a los pasos (una contraseña recién
 *     creada, por ejemplo) con su propio botón de cerrar.
 *
 * En el móvil ocupa la pantalla: con el teclado abierto, una ficha a media
 * altura dejaba el botón de seguir fuera de la vista.
 */
export function Wizard({
  open,
  onClose,
  title,
  pasos,
  paso,
  setPaso,
  finalLabel,
  onFinalizar,
  loading,
  error,
  dirty,
  resultado,
}: {
  open: boolean
  onClose: () => void
  title: string
  pasos: Paso[]
  paso: number
  setPaso: (n: number) => void
  finalLabel: string
  onFinalizar: () => void
  loading?: boolean
  error?: string | null
  dirty?: boolean
  resultado?: ReactNode
}) {
  const { t } = useIdioma()
  const titulo = useId()
  const [intentado, setIntentado] = useState(false)
  const [preguntando, setPreguntando] = useState(false)
  const actual = pasos[Math.min(paso, pasos.length - 1)]!
  const ultimo = paso >= pasos.length - 1

  const pedirCierre = () => {
    if (dirty && !resultado && !loading) setPreguntando(true)
    else onClose()
  }

  const siguiente = () => {
    if (actual.problema) {
      setIntentado(true)
      return
    }
    setIntentado(false)
    if (ultimo) onFinalizar()
    else setPaso(paso + 1)
  }

  return (
    <>
      <Sheet open={open} onClose={pedirCierre} title={title} completa>
        <form
          noValidate
          aria-labelledby={titulo}
          onSubmit={(e) => {
            e.preventDefault()
            if (!loading && !resultado) siguiente()
          }}
          className="flex min-h-[calc(100%-3rem)] flex-col"
        >
          <h2 id={titulo} className="pr-10 font-display text-subheading font-semibold text-ink">
            {title}
          </h2>

          {!resultado && (
            <>
              {/* Pasos: con nombre en pantalla grande, barra en el móvil. */}
              <ol className="mt-3 hidden flex-wrap items-center gap-x-2 gap-y-1 sm:flex">
                {pasos.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden className="h-px w-4 bg-line-strong" />}
                    <span
                      aria-current={i === paso ? 'step' : undefined}
                      className={cx(
                        'inline-flex items-center gap-1.5 text-meta font-semibold',
                        i === paso ? 'text-ink' : i < paso ? 'text-body-2' : 'text-subtle',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cx(
                          'grid size-5 place-items-center rounded-full border text-caption tabular-nums',
                          i < paso && 'border-ink bg-ink text-cream',
                          i === paso && 'border-brand bg-brand text-white',
                          i > paso && 'border-line-strong bg-surface',
                        )}
                      >
                        {i < paso ? '✓' : i + 1}
                      </span>
                      {p.titulo}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-col gap-2 sm:hidden">
                <p className="text-meta font-semibold text-body-2">
                  {t('wiz.pasoDe', { n: paso + 1, total: pasos.length })} · {actual.titulo}
                </p>
                <div aria-hidden className="h-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-300"
                    style={{ width: `${((paso + 1) / pasos.length) * 100}%` }}
                  />
                </div>
              </div>
              {/* Para el lector de pantalla: en qué paso se está al cambiar. */}
              <p className="sr-only" aria-live="polite">
                {t('wiz.pasoDe', { n: paso + 1, total: pasos.length })}: {actual.titulo}
              </p>

              <div className="mt-5 flex flex-1 flex-col gap-4">
                {actual.contenido}
                {intentado && actual.problema && <ErrorNote>{actual.problema}</ErrorNote>}
                {ultimo && error && <ErrorNote>{error}</ErrorNote>}
              </div>

              <div
                className={
                  'sticky bottom-[calc(-1*max(1.5rem,env(safe-area-inset-bottom)))] z-10 -mx-5 mt-6 ' +
                  '-mb-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center gap-2 border-t border-line ' +
                  'bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] ' +
                  'sm:-mx-6 sm:-mb-6 sm:-bottom-6 sm:px-6 sm:pb-5'
                }
              >
                {paso > 0 ? (
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setIntentado(false)
                      setPaso(paso - 1)
                    }}
                    disabled={loading}
                  >
                    {t('wiz.atras')}
                  </Button>
                ) : (
                  <Button variant="quiet" onClick={pedirCierre} disabled={loading}>
                    {t('conf.cancelar')}
                  </Button>
                )}
                <Button type="submit" loading={loading} className="ml-auto">
                  {ultimo ? finalLabel : t('wiz.siguiente')}
                </Button>
              </div>
            </>
          )}

          {resultado && <div className="mt-5">{resultado}</div>}
        </form>
      </Sheet>

      <ConfirmDialog
        open={preguntando}
        onClose={() => setPreguntando(false)}
        title={t('conf.descartarTitulo')}
        consecuencias={[t('wiz.descartarTexto')]}
        confirmLabel={t('conf.descartar')}
        cancelLabel={t('form.seguirEditando')}
        onConfirm={() => {
          setPreguntando(false)
          onClose()
        }}
      />
    </>
  )
}
