import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatMinutes, WEEKDAYS_LONG } from '@veline/shared'
import { api } from '../../lib/api'
import { Button, Card, ErrorNote, Spinner } from '../../components/ui'

interface Range {
  startMin: number
  endMin: number
}

/** Lunes primero, domingo al final. */
const ORDER = [1, 2, 3, 4, 5, 6, 0]

const toMinutes = (value: string) => {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function PanelHours() {
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [week, setWeek] = useState<Record<number, Range[]>>({})
  const [dirty, setDirty] = useState(false)

  const { data: hours, isLoading } = useQuery({
    queryKey: ['panel', slug, 'hours'],
    queryFn: () => api.panelHours(slug),
  })

  useEffect(() => {
    if (!hours) return
    const next: Record<number, Range[]> = {}
    for (const wd of ORDER) next[wd] = []
    for (const h of hours)
      next[h.weekday] = [...(next[h.weekday] ?? []), { startMin: h.startMin, endMin: h.endMin }]
    setWeek(next)
    setDirty(false)
  }, [hours])

  const save = useMutation({
    mutationFn: () =>
      api.saveHours(
        slug,
        ORDER.flatMap((wd) => (week[wd] ?? []).map((r) => ({ weekday: wd, ...r }))),
      ),
    onSuccess: () => {
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['business', slug] })
      queryClient.invalidateQueries({ queryKey: ['availability', slug] })
    },
  })

  const mutate = (wd: number, ranges: Range[]) => {
    setWeek((prev) => ({ ...prev, [wd]: ranges }))
    setDirty(true)
  }

  if (isLoading) return <Spinner />

  const invalid = ORDER.some((wd) => (week[wd] ?? []).some((r) => r.endMin <= r.startMin))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Horario de atención</h1>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-[12.5px] text-muted">Cambios sin guardar</span>}
          <Button onClick={() => save.mutate()} disabled={!dirty || invalid || save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar horario'}
          </Button>
        </div>
      </div>

      {invalid && (
        <div className="mb-4">
          <ErrorNote>Alguna franja termina antes de empezar. Revísala antes de guardar.</ErrorNote>
        </div>
      )}
      {save.isError && (
        <div className="mb-4">
          <ErrorNote>{(save.error as Error).message}</ErrorNote>
        </div>
      )}

      <Card className="overflow-hidden">
        {ORDER.map((wd) => {
          const ranges = week[wd] ?? []
          return (
            <div
              key={wd}
              className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-b-0"
            >
              <div className="w-[110px] shrink-0 font-semibold text-ink capitalize">
                {WEEKDAYS_LONG[wd]}
              </div>

              <div className="flex flex-1 flex-wrap items-center gap-3">
                {ranges.length === 0 && <span className="text-sm text-disabled">Cerrado</span>}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      step={900}
                      value={formatMinutes(r.startMin)}
                      onChange={(e) =>
                        mutate(
                          wd,
                          ranges.map((x, j) =>
                            j === i ? { ...x, startMin: toMinutes(e.target.value) } : x,
                          ),
                        )
                      }
                      className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="time"
                      step={900}
                      value={formatMinutes(r.endMin)}
                      onChange={(e) =>
                        mutate(
                          wd,
                          ranges.map((x, j) =>
                            j === i ? { ...x, endMin: toMinutes(e.target.value) } : x,
                          ),
                        )
                      }
                      className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
                    />
                    <button
                      type="button"
                      aria-label="Quitar franja"
                      onClick={() =>
                        mutate(
                          wd,
                          ranges.filter((_, j) => j !== i),
                        )
                      }
                      className="px-1 text-lg leading-none text-muted hover:text-brand"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  mutate(wd, [
                    ...ranges,
                    ranges.length
                      ? { startMin: 16 * 60, endMin: 20 * 60 }
                      : { startMin: 9 * 60, endMin: 14 * 60 },
                  ])
                }
                className="text-[12.5px] font-semibold text-brand underline"
              >
                Añadir franja
              </button>
            </div>
          )
        })}
      </Card>

      <p className="mt-4 text-[12.5px] text-subtle">
        Varias franjas en un mismo día sirven para la jornada partida. Los huecos se ofrecen cada 30
        minutos dentro de cada franja.
      </p>
    </div>
  )
}
