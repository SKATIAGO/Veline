import { formatMinutes, weekdayLong } from '@veline/shared'
import { Button, Card, IconButton, Input, cx } from './ui'
import { useIdioma } from '../i18n/idioma'

export interface Franja {
  startMin: number
  endMin: number
}

/** Lunes primero, domingo al final. */
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

export const minutosDesdeTexto = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

const MANANA: Franja = { startMin: 9 * 60, endMin: 14 * 60 }
const TARDE: Franja = { startMin: 16 * 60, endMin: 20 * 60 }

interface FranjasSemanalesProps {
  week: Record<number, Franja[]>
  onChange: (weekday: number, ranges: Franja[]) => void
  onCopiarALaborables: (weekday: number) => void
}

/**
 * El editor de franjas por día de la semana, con jornada partida y "Copiar a
 * L–V". Lo usan tanto el horario del local (PanelHours) como el horario
 * propio de un empleado (dentro de Empleados): misma pieza, distinto dueño
 * de la semana que edita.
 */
export function FranjasSemanales({ week, onChange, onCopiarALaborables }: FranjasSemanalesProps) {
  const { t, idioma } = useIdioma()

  return (
    <Card className="overflow-hidden">
      <ul>
        {ORDEN_SEMANA.map((wd) => {
          const ranges = week[wd] ?? []
          const cerrado = ranges.length === 0

          return (
            <li
              key={wd}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-3 last:border-b-0 sm:px-5"
            >
              <div className="flex w-[104px] shrink-0 flex-col">
                <span className="text-ui font-semibold text-ink capitalize">
                  {weekdayLong(wd, idioma)}
                </span>
                {cerrado && <span className="text-meta text-disabled">{t('comun.cerrado')}</span>}
              </div>

              <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      type="time"
                      step={900}
                      aria-label={t('hor.inicioFranja', {
                        dia: weekdayLong(wd, idioma),
                        n: i + 1,
                      })}
                      value={formatMinutes(r.startMin)}
                      invalid={r.endMin <= r.startMin}
                      onChange={(e) =>
                        onChange(
                          wd,
                          ranges.map((x, j) =>
                            j === i ? { ...x, startMin: minutosDesdeTexto(e.target.value) } : x,
                          ),
                        )
                      }
                      className="w-[116px] px-2.5"
                    />
                    <span className="text-muted" aria-hidden>
                      –
                    </span>
                    <Input
                      type="time"
                      step={900}
                      aria-label={t('hor.finFranja', { dia: weekdayLong(wd, idioma), n: i + 1 })}
                      value={formatMinutes(r.endMin)}
                      invalid={r.endMin <= r.startMin}
                      onChange={(e) =>
                        onChange(
                          wd,
                          ranges.map((x, j) =>
                            j === i ? { ...x, endMin: minutosDesdeTexto(e.target.value) } : x,
                          ),
                        )
                      }
                      className="w-[116px] px-2.5"
                    />
                    <IconButton
                      label={t('hor.quitarFranja', { n: i + 1, dia: weekdayLong(wd, idioma) })}
                      onClick={() =>
                        onChange(
                          wd,
                          ranges.filter((_, j) => j !== i),
                        )
                      }
                      className="hover:text-brand"
                    >
                      <span aria-hidden className="text-subheading leading-none">
                        ×
                      </span>
                    </IconButton>
                  </div>
                ))}
              </div>

              <div className={cx('flex gap-1', cerrado && 'ml-auto')}>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => onChange(wd, [...ranges, ranges.length ? TARDE : MANANA])}
                >
                  {t('hor.anadirFranja')}
                </Button>
                {!cerrado && wd >= 1 && wd <= 5 && (
                  <Button size="sm" variant="quiet" onClick={() => onCopiarALaborables(wd)}>
                    {t('hor.copiarLV')}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
