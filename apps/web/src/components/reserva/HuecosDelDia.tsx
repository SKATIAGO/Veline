import { useLayoutEffect, useRef } from 'react'
import { formatLongDate, fromDateKey, type SlotDTO } from '@veline/shared'
import { ErrorNote, Skeleton, cx } from '../ui'
import { useIdioma } from '../../i18n/idioma'

/**
 * Las horas de un día, en Mañana y Tarde. Lo usan la reserva y reprogramar;
 * el panel tiene su SlotPicker con la hora a mano, que el cliente no necesita.
 */
export function HuecosDelDia({
  dia,
  slots,
  valor,
  onElegir,
  cargando,
  error,
}: {
  /** AAAA-MM-DD elegido, o null si no hay ninguno todavía. */
  dia: string | null
  slots: SlotDTO[]
  valor: SlotDTO | null
  onElegir: (s: SlotDTO) => void
  cargando?: boolean
  error?: string | null
}) {
  const { t, idioma } = useIdioma()
  /* La altura que tenían las horas la última vez que se vieron: mientras
     llegan las del mes o el día nuevo, el esqueleto ocupa exactamente eso y
     nada de debajo se mueve. */
  const caja = useRef<HTMLDivElement>(null)
  const ultimaAltura = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (!cargando && caja.current) ultimaAltura.current = caja.current.offsetHeight
  })
  const manana = slots.filter((s) => Number(s.label.slice(0, 2)) < 14)
  const tarde = slots.filter((s) => Number(s.label.slice(0, 2)) >= 14)
  const libres = slots.some((s) => s.available)

  /* Mientras llegan los huecos se reserva el sitio con la misma forma que
     tendrá (título, Mañana con dos filas, Tarde con una): antes aparecía una
     frase de una línea y, al llegar las horas, la página crecía de golpe. */
  if (cargando) {
    return (
      <div
        aria-busy="true"
        className="mt-6 overflow-hidden"
        style={ultimaAltura.current ? { height: ultimaAltura.current } : undefined}
      >
        <Skeleton className="mb-3 h-6 w-52" />
        {[2, 1].map((filas, g) => (
          <div key={g} className="mb-5">
            <Skeleton className="mb-2.5 h-3.5 w-16" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: filas * 5 }, (_, i) => (
                <Skeleton
                  key={i}
                  className={cx('h-11 rounded-full', i >= filas * 3 && 'max-sm:hidden')}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!dia)
    return (
      <p ref={caja} className="mt-6 text-body text-muted">
        {t('fecha.sinHuecosPista')}
      </p>
    )

  return (
    <div ref={caja} className="mt-6" aria-live="polite">
      <h2 className="mb-3 font-display text-ui font-semibold text-ink first-letter:uppercase">
        {formatLongDate(fromDateKey(dia), idioma)}
      </h2>
      {!libres && <p className="text-body text-muted">{t('fecha.diaCompleto')}</p>}
      {[
        { id: 'manana', titulo: t('fecha.manana'), slots: manana },
        { id: 'tarde', titulo: t('fecha.tarde'), slots: tarde },
      ]
        .filter((g) => g.slots.length > 0)
        .map((grupo) => (
          <fieldset key={grupo.id} className="mb-5">
            <legend className="mb-2.5 text-caption font-semibold tracking-[0.04em] text-muted uppercase">
              {grupo.titulo}
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {grupo.slots.map((s) => {
                const activo = valor?.startsAt === s.startsAt
                return (
                  <button
                    key={s.startsAt}
                    type="button"
                    disabled={!s.available}
                    aria-pressed={activo}
                    onClick={() => onElegir(s)}
                    className={cx(
                      'inline-flex min-h-11 items-center justify-center rounded-full border text-body font-semibold tabular-nums',
                      'transition-[background-color,color,border-color,transform] duration-200 active:scale-95',
                      activo
                        ? 'border-brand bg-brand text-white'
                        : s.available
                          ? 'border-line bg-surface text-ink hover:border-brand'
                          : 'border-line bg-cream text-disabled line-through',
                    )}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
    </div>
  )
}
