import { useRef, type KeyboardEvent } from 'react'
import { cx } from './ui'

/**
 * Pestañas dentro de una ficha: «Ficha · Horario · Acceso al panel».
 *
 * Subrayadas y no en píldora: son partes del mismo registro, no filtros de una
 * lista (para eso está FilterChip). Con el teclado, las flechas cambian de
 * pestaña y Tab salta al contenido, como pide el patrón de pestañas de ARIA.
 *
 * El contenido lo pinta quien las usa, con `panelProps(id)`, para que cada
 * panel quede enlazado con su pestaña.
 */
export function Tabs<T extends string>({
  idBase,
  tabs,
  activa,
  onCambiar,
  label,
}: {
  idBase: string
  tabs: { id: T; label: string; contador?: number }[]
  activa: T
  onCambiar: (id: T) => void
  label: string
}) {
  const lista = useRef<HTMLDivElement>(null)

  const alTeclear = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === activa)
    const ir = (j: number) => {
      const t = tabs[(j + tabs.length) % tabs.length]!
      onCambiar(t.id)
      lista.current
        ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${idBase}-tab-${t.id}`)}`)
        ?.focus()
    }
    if (e.key === 'ArrowRight') ir(i + 1)
    else if (e.key === 'ArrowLeft') ir(i - 1)
    else if (e.key === 'Home') ir(0)
    else if (e.key === 'End') ir(tabs.length - 1)
    else return
    e.preventDefault()
  }

  return (
    <div
      ref={lista}
      role="tablist"
      aria-label={label}
      onKeyDown={alTeclear}
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((t) => {
        const elegida = t.id === activa
        return (
          <button
            key={t.id}
            id={`${idBase}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={elegida}
            aria-controls={`${idBase}-panel`}
            tabIndex={elegida ? 0 : -1}
            onClick={() => onCambiar(t.id)}
            className={cx(
              '-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[14px] whitespace-nowrap',
              'transition-colors duration-200',
              elegida
                ? 'border-brand font-semibold text-ink'
                : 'border-transparent font-medium text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.contador !== undefined && (
              <span className="rounded-full bg-canvas px-1.5 text-caption font-bold text-body-2 tabular-nums">
                {t.contador}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Atributos del panel de la pestaña activa. */
export const panelProps = (idBase: string, activa: string) => ({
  id: `${idBase}-panel`,
  role: 'tabpanel' as const,
  'aria-labelledby': `${idBase}-tab-${activa}`,
  tabIndex: 0,
})
