import { useId, useRef, type ReactNode } from 'react'
import { Button, ErrorNote, Sheet } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Confirmación de una acción que borra, corta o le llega a otra persona.
 *
 * Sustituye al «¿Seguro? Sí / No» que aparecía dentro de la fila. Aquel no
 * decía qué iba a pasar, y en dos sitios —dar de baja a alguien con citas,
 * cerrar un local con citas— el «Sí» fallaba después. Aquí:
 *
 *   - El título nombra la acción y sobre qué: «¿Dar de baja a Marta Gil?».
 *   - Debajo, lo que pasa de verdad: qué deja de funcionar, a quién se avisa,
 *     si se puede deshacer.
 *   - Lo que impide hacerlo se enseña ANTES (en `children`) y el botón no se
 *     puede pulsar hasta resolverlo (`bloqueado`). Nunca un «Sí» que falla.
 *   - Si no se puede hacer en absoluto (`imposible`), no hay botón de acción:
 *     solo la explicación y «Entendido».
 *   - El foco empieza en «Cancelar», para que un Intro de más no borre nada.
 *
 * Por debajo es la misma ficha del resto del panel: abajo en el móvil,
 * centrada en pantalla grande, y se cierra con Escape, el «atrás» o tocando
 * fuera.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  consecuencias = [],
  children,
  confirmLabel,
  tono = 'normal',
  onConfirm,
  loading,
  error,
  bloqueado,
  imposible,
  sinHistorial,
  cancelLabel,
}: {
  open: boolean
  onClose: () => void
  title: string
  /** Frases cortas, una por consecuencia. */
  consecuencias?: ReactNode[]
  /** Lo que haya que resolver o rellenar antes: citas que reasignar, un motivo. */
  children?: ReactNode
  confirmLabel: string
  /**
   * `destruir`: no tiene vuelta atrás (borrar, anular). Botón rojo relleno.
   * `normal`: corta algo pero se puede revertir (suspender, quitar acceso).
   * Botón marrón de siempre.
   */
  tono?: 'normal' | 'destruir'
  onConfirm: () => void
  loading?: boolean
  error?: string | null
  bloqueado?: boolean
  /** No se puede hacer: se explica por qué y no se ofrece el botón. */
  imposible?: boolean
  /** Ver `historial` en Sheet. */
  sinHistorial?: boolean
  /** Cuando «Cancelar» se confundiría con la acción: «¿Cancelar la cita?». */
  cancelLabel?: string
}) {
  const { t } = useIdioma()
  const titulo = useId()
  const cancelar = useRef<HTMLButtonElement>(null)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      focoInicial={cancelar}
      rol="alertdialog"
      historial={!sinHistorial}
    >
      <div className="flex flex-col gap-4">
        <h2 id={titulo} className="pr-10 font-display text-subheading font-semibold text-ink">
          {title}
        </h2>

        {consecuencias.length > 0 && (
          <ul className="flex flex-col gap-2">
            {consecuencias.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-body text-body">
                <span aria-hidden className="shrink-0 text-subtle">
                  —
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}

        {children}

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="mt-1 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button
            ref={cancelar}
            variant={imposible ? 'primary' : 'secondary'}
            onClick={onClose}
            disabled={loading}
          >
            {imposible ? t('conf.entendido') : (cancelLabel ?? t('conf.cancelar'))}
          </Button>
          {!imposible && (
            <Button
              variant={tono === 'destruir' ? 'destroy' : 'primary'}
              loading={loading}
              disabled={bloqueado}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

/**
 * Lo que impide confirmar, en el recuadro ámbar que se resuelve antes de
 * poder pulsar. Va dentro de ConfirmDialog.
 */
export function Bloqueo({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-body font-semibold text-amber-900">{titulo}</p>
      {children}
    </div>
  )
}
