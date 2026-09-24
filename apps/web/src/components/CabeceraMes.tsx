import { useEffect, useRef, useState } from 'react'
import { monthLong } from '@veline/shared'
import { Card, LogoMark, cx } from './ui'
import { useIdioma } from '../i18n/idioma'

const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)

/**
 * La cabecera de mes que comparten el calendario y la contabilidad: el
 * logo, el nombre del mes —que al tocarlo abre un salto directo a
 * cualquier mes y año— y las flechas para ir de uno en uno. Una sola
 * pieza para no arrastrar dos copias del selector si un día cambia.
 */
export function CabeceraMes({
  mes,
  onCambiarMes,
}: {
  mes: Date
  onCambiarMes: (nuevoMes: Date) => void
}) {
  const { t, idioma } = useIdioma()
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [anioSelector, setAnioSelector] = useState(() => mes.getFullYear())
  const selectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectorAbierto) return
    const alClicarFuera = (e: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorAbierto(false)
      }
    }
    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [selectorAbierto])

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-3 rounded-t-xl border-b border-line bg-cream px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <LogoMark size={18} />
          <div className="relative" ref={selectorRef}>
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={selectorAbierto}
              aria-label={t('agenda.elegirMes')}
              onClick={() => {
                setAnioSelector(mes.getFullYear())
                setSelectorAbierto((v) => !v)
              }}
              className="font-display text-ui font-semibold text-ink capitalize transition-colors hover:text-brand-text sm:text-subheading"
            >
              {monthLong(mes.getMonth(), idioma)} {mes.getFullYear()}
            </button>

            {selectorAbierto && (
              <div className="absolute z-20 mt-2 w-60 rounded-lg border border-line bg-surface p-3 shadow-overlay">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label={t('agenda.anioAnterior')}
                    onClick={() => setAnioSelector((a) => a - 1)}
                    className="flex size-7 items-center justify-center rounded-full text-ui text-subtle transition-colors hover:bg-cream hover:text-brand-text"
                  >
                    ‹
                  </button>
                  <span className="text-ui font-semibold text-ink">{anioSelector}</span>
                  <button
                    type="button"
                    aria-label={t('agenda.anioSiguiente')}
                    onClick={() => setAnioSelector((a) => a + 1)}
                    className="flex size-7 items-center justify-center rounded-full text-ui text-subtle transition-colors hover:bg-cream hover:text-brand-text"
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }, (_, m) => m).map((m) => {
                    const activo = m === mes.getMonth() && anioSelector === mes.getFullYear()
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          onCambiarMes(new Date(anioSelector, m, 1))
                          setSelectorAbierto(false)
                        }}
                        className={cx(
                          'rounded-md px-2 py-1.5 text-meta capitalize transition-colors',
                          activo ? 'bg-brand text-white' : 'text-body-2 hover:bg-cream',
                        )}
                      >
                        {monthLong(m, idioma).slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={t('fecha.mesAnterior')}
            onClick={() => onCambiarMes(addMonths(mes, -1))}
            className="flex size-8 items-center justify-center rounded-full text-subheading leading-none text-brand-text transition-colors hover:bg-brand/10 sm:size-9"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t('fecha.mesSiguiente')}
            onClick={() => onCambiarMes(addMonths(mes, 1))}
            className="flex size-8 items-center justify-center rounded-full text-subheading leading-none text-brand-text transition-colors hover:bg-brand/10 sm:size-9"
          >
            ›
          </button>
        </div>
      </div>
    </Card>
  )
}
