import { useId, useState, type ReactNode } from 'react'
import { Button, ErrorNote, Sheet } from './ui'
import { Stepper } from './Stepper'
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

  /* La ficha pregunta antes de cerrarse. Con cambios, aquí se abre la
     confirmación y se le dice que no se mueva: ver `puedeCerrar` en Sheet. */
  const puedeCerrar = () => {
    if (dirty && !resultado && !loading) {
      setPreguntando(true)
      return false
    }
    return true
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
      <Sheet open={open} onClose={onClose} puedeCerrar={puedeCerrar} title={title} completa>
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
              <Stepper pasos={pasos.map((p) => p.titulo)} actual={paso} className="mt-3" />
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
                  'sticky bottom-[calc(-1*max(1.5rem,env(safe-area-inset-bottom)))] z-elevado -mx-5 mt-6 ' +
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
                  <Button
                    variant="quiet"
                    onClick={() => puedeCerrar() && onClose()}
                    disabled={loading}
                  >
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
