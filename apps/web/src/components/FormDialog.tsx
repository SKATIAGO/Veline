import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Button, ErrorNote, Sheet } from './ui'
import { ConfirmDialog } from './Confirmar'
import { useIdioma } from '../i18n/idioma'

/**
 * Crear o editar un registro sin perder la lista de vista.
 *
 * Antes cada pantalla lo hacía a su manera: Servicios sustituía la fila por el
 * formulario, Locales y «Crear cuenta» abrían una tarjeta arriba de la página
 * (a veces lejos de la fila que se había tocado), Fichaje y Cobros desplegaban
 * el formulario debajo de la fila. Ahora todo es esto:
 *
 *   - Título con verbo y objeto: «Editar servicio», «Nueva cuenta».
 *   - Pie pegado abajo, siempre a la vista aunque el formulario sea largo:
 *     el botón principal a la derecha, «Cancelar» a su lado y, si se puede,
 *     la acción de borrar sola a la izquierda (abre su propia confirmación).
 *   - Con cambios a medias, cerrar pregunta antes de tirarlos.
 *   - Abajo en el móvil, centrado en pantalla grande: es la misma ficha del
 *     resto del panel, con Escape, «atrás» y tocar fuera.
 *
 * Los errores de cada campo van en el campo; `error` es para lo que dice el
 * servidor al guardar.
 */
export function FormDialog({
  open,
  onClose,
  title,
  hint,
  children,
  submitLabel,
  onSubmit,
  loading,
  error,
  dirty,
  borrar,
  sinPie,
}: {
  open: boolean
  onClose: () => void
  title: string
  hint?: ReactNode
  children: ReactNode
  submitLabel: string
  onSubmit: () => void
  loading?: boolean
  error?: string | null
  /** Hay cambios sin guardar: cerrar pregunta antes. */
  dirty?: boolean
  /** Acción destructiva, sola a la izquierda del pie. */
  borrar?: { label: string; onClick: () => void }
  /** Para un paso final que no es formulario (una contraseña recién creada). */
  sinPie?: boolean
}) {
  const { t } = useIdioma()
  const titulo = useId()
  const [preguntando, setPreguntando] = useState(false)

  const pedirCierre = () => {
    if (dirty && !loading) setPreguntando(true)
    else onClose()
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!loading) onSubmit()
  }

  return (
    <>
      <Sheet open={open} onClose={pedirCierre} title={title}>
        <form onSubmit={enviar} noValidate aria-labelledby={titulo} className="flex flex-col">
          <div className="flex flex-col gap-1 pr-10">
            <h2 id={titulo} className="font-display text-subheading font-semibold text-ink">
              {title}
            </h2>
            {hint && <p className="text-meta text-muted">{hint}</p>}
          </div>

          <div className="mt-5 flex flex-col gap-4">{children}</div>

          {error && (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          {/* Pegado abajo: en un formulario largo, sobre todo en el móvil con
              el teclado abierto, el botón de guardar no se pierde de vista. */}
          {!sinPie && (
            <div
              className={
                // La ficha tiene relleno abajo, y algo pegado se queda por encima del
                // relleno: se baja lo mismo que mide, para que el pie toque el borde.
                'sticky bottom-[calc(-1*max(1.5rem,env(safe-area-inset-bottom)))] z-10 -mx-5 mt-6 ' +
                '-mb-[max(1.5rem,env(safe-area-inset-bottom))] sm:-bottom-6 ' +
                'flex flex-col-reverse gap-2 border-t border-line bg-surface px-5 pt-3 ' +
                'pb-[max(1rem,env(safe-area-inset-bottom))] ' +
                'sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:pb-5'
              }
            >
              {borrar && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={borrar.onClick}
                  className="sm:mr-auto"
                  disabled={loading}
                >
                  {borrar.label}
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={pedirCierre} disabled={loading}>
                {t('conf.cancelar')}
              </Button>
              <Button type="submit" loading={loading}>
                {submitLabel}
              </Button>
            </div>
          )}
        </form>
      </Sheet>

      <ConfirmDialog
        open={preguntando}
        onClose={() => setPreguntando(false)}
        title={t('conf.descartarTitulo')}
        consecuencias={[t('form.descartarTexto')]}
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
