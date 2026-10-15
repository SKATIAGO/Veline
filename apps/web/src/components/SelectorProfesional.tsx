import { cx } from './ui'

/**
 * Con quién: la persona que atiende, o «Sin preferencia».
 *
 * Píldoras y no un desplegable: son pocas, se ven todas de golpe y se elige
 * con un toque. Es el diseño que ya tenía el asistente del panel; la reserva
 * del cliente usaba un <select> y aquí se unifican. Cada píldora lleva la
 * inicial como avatar, que en una lista de nombres parecidos ayuda a
 * distinguirlos; si hay foto, la foto.
 *
 * Con una sola persona no hay nada que elegir: quien lo usa no lo pinta.
 */
export interface Profesional {
  id: string
  name: string
  photo?: string | null
}

export function SelectorProfesional({
  personas,
  valor,
  onCambiar,
  etiqueta,
  sinPreferencia,
  className,
}: {
  personas: Profesional[]
  /** El id elegido; '' es «sin preferencia». */
  valor: string
  onCambiar: (id: string) => void
  /** «Con quién». */
  etiqueta: string
  /** «Sin preferencia». */
  sinPreferencia: string
  className?: string
}) {
  const opciones: Profesional[] = [{ id: '', name: sinPreferencia }, ...personas]
  return (
    <fieldset className={cx('min-w-0', className)}>
      <legend className="mb-2 text-meta font-semibold text-body-2">{etiqueta}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((p) => {
          const activo = valor === p.id
          const cualquiera = p.id === ''
          return (
            <button
              key={p.id || 'cualquiera'}
              type="button"
              aria-pressed={activo}
              onClick={() => onCambiar(p.id)}
              className={cx(
                'inline-flex min-h-11 items-center gap-2 rounded-xl border py-1 pr-3.5 text-body font-semibold transition-colors duration-200',
                cualquiera ? 'pl-3.5' : 'pl-1.5',
                activo
                  ? 'border-brand bg-brand/5 text-ink'
                  : 'border-line bg-surface text-body-2 hover:border-line-strong',
              )}
            >
              {!cualquiera &&
                (p.photo ? (
                  <img
                    src={p.photo}
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className={cx(
                      'grid size-8 place-items-center rounded-lg text-meta font-bold',
                      activo ? 'bg-brand text-white' : 'bg-canvas text-body-2',
                    )}
                  >
                    {p.name.trim().charAt(0).toUpperCase()}
                  </span>
                ))}
              {p.name}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
