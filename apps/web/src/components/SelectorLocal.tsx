import { useId } from 'react'
import { useLocal } from '../lib/local'
import { siDescarta } from '../lib/cambios'
import { Select, cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/** Un alfiler: el mismo icono en el selector y en la etiqueta del empleado. */
function Alfiler({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cx('size-4 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  )
}

/**
 * El selector de local del panel: en el menú lateral, en la cabecera del móvil
 * y en «Más».
 *
 * Es un desplegable nativo y no uno dibujado: en el móvil abre la rueda del
 * sistema, que es lo más cómodo con el dedo, y con teclado funciona solo.
 *
 * Solo aparece si el negocio tiene más de un local. Quien solo puede ver uno
 * (un empleado de ese local) ve su nombre, sin nada que elegir.
 */
export function SelectorLocal({ compacto }: { compacto?: boolean }) {
  const { t } = useIdioma()
  const id = useId()
  const { locales, varios, negocioConVarios, verTodos, actual, elegir, nombreActual } = useLocal()

  if (!negocioConVarios) return null

  if (!varios) {
    return (
      <p
        className={cx(
          'flex min-w-0 items-center gap-1.5 text-meta font-semibold text-body-2',
          compacto && 'text-caption',
        )}
      >
        <Alfiler className="text-brand" />
        <span className="truncate">{nombreActual}</span>
      </p>
    )
  }

  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="sr-only">
        {t('local.selector')}
      </label>
      <Alfiler className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand" />
      <Select
        id={id}
        value={actual ?? ''}
        // Cambiar de local con algo a medias (el horario) pregunta antes.
        onChange={(e) => {
          const elegido = e.target.value || null
          siDescarta(() => elegir(elegido))
        }}
        className={cx('pl-9 font-semibold', compacto && 'min-h-9 text-meta')}
      >
        {verTodos && <option value="">{t('local.todos')}</option>}
        {locales.map((l) => (
          <option key={l.id} value={l.id}>
            {l.approved ? l.name : t('local.pendiente', { nombre: l.name })}
          </option>
        ))}
      </Select>
    </div>
  )
}

/**
 * Para las pantallas que trabajan sobre UN local (horario, cierres): si se
 * están mirando todos, se pide elegir uno aquí mismo, sin tener que ir al menú.
 * Con uno elegido, solo se dice cuál, para que nadie edite el horario de uno
 * pensando que es el de otro.
 */
export function LocalDeLaPagina({ que }: { que: string }) {
  const { t } = useIdioma()
  const id = useId()
  const { locales, varios, actual, elegir, nombreActual, paraEditar } = useLocal()
  if (!varios) return null

  if (!actual) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <label htmlFor={id} className="text-body text-body-2">
          {t('local.cadaUnoTiene', { que })}
        </label>
        <Select
          id={id}
          value={paraEditar ?? ''}
          onChange={(e) => {
            const elegido = e.target.value
            siDescarta(() => elegir(elegido))
          }}
          className="w-auto min-w-[200px] font-semibold"
        >
          {locales.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
    )
  }

  return (
    <p className="flex items-center gap-1.5 text-meta text-muted">
      <Alfiler className="text-brand" />
      {t('local.deEste', { local: nombreActual ?? '' })}
    </p>
  )
}
