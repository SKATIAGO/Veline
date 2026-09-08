import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatMinutes, weekdayLong } from '@veline/shared'
import { api } from '../../lib/api'
import {
  Button,
  Card,
  ErrorNote,
  IconButton,
  Input,
  PageHeader,
  Select,
  Skeleton,
  SuccessNote,
  cx,
} from '../../components/ui'
import { useIdioma, usePlural } from '../../i18n/idioma'

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

const MANANA: Range = { startMin: 9 * 60, endMin: 14 * 60 }
const TARDE: Range = { startMin: 16 * 60, endMin: 20 * 60 }

export function PanelHours() {
  const { t, idioma } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [week, setWeek] = useState<Record<number, Range[]>>({})
  const [dirty, setDirty] = useState(false)

  /* Cada local tiene su horario. Con uno solo no se pregunta nada; con
     varios hay que elegir cuál se está editando, o se acabaría guardando el
     horario de un local encima del de otro. */
  const { data: locales } = useQuery({
    queryKey: ['panel', slug, 'locales'],
    queryFn: () => api.panelLocales(slug),
  })
  const [local, setLocal] = useState('')
  const localActual = local || locales?.[0]?.id || ''
  const varios = (locales?.length ?? 0) > 1

  const { data: hours, isLoading } = useQuery({
    queryKey: ['panel', slug, 'hours', localActual],
    queryFn: () => api.panelHours(slug, localActual || undefined),
    enabled: !!localActual,
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

  /* Avisa antes de cerrar la pestaña con cambios sin guardar. Rellenar el
     horario de la semana entera y perderlo por recargar es de las cosas que
     más molestan de un panel. */
  useEffect(() => {
    if (!dirty) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [dirty])

  const save = useMutation({
    mutationFn: () =>
      api.saveHours(
        slug,
        ORDER.flatMap((wd) => (week[wd] ?? []).map((r) => ({ weekday: wd, ...r }))),
        localActual || undefined,
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

  /** Copia el día a los demás laborables. Rellenar siete días a mano cansa. */
  const copiarALaborables = (wd: number) => {
    const origen = week[wd] ?? []
    setWeek((prev) => {
      const next = { ...prev }
      for (const otro of [1, 2, 3, 4, 5]) next[otro] = origen.map((r) => ({ ...r }))
      return next
    })
    setDirty(true)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('hor.titulo')} />
        <Card className="flex flex-col gap-3 p-5">
          {ORDER.map((wd) => (
            <Skeleton key={wd} className="h-12" />
          ))}
        </Card>
      </div>
    )
  }

  const invalid = ORDER.some((wd) => (week[wd] ?? []).some((r) => r.endMin <= r.startMin))
  const diasAbiertos = ORDER.filter((wd) => (week[wd] ?? []).length > 0).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('hor.titulo')}
        hint={plural(diasAbiertos, 'hor.abiertoUnDia', 'hor.abiertoVariosDias')}
        actions={
          <>
            {dirty && <span className="text-meta text-muted">{t('hor.sinGuardar')}</span>}
            <Button
              onClick={() => save.mutate()}
              disabled={!dirty || invalid}
              loading={save.isPending}
            >
              {t('hor.guardar')}
            </Button>
          </>
        }
      />

      {invalid && <ErrorNote>{t('hor.franjaInvalida')}</ErrorNote>}
      {save.isError && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
      {save.isSuccess && !dirty && <SuccessNote>{t('hor.guardado')}</SuccessNote>}

      {varios && (
        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="text-meta font-semibold text-body-2">{t('hor.local')}</span>
          <Select
            value={localActual}
            onChange={(e) => {
              setLocal(e.target.value)
              setDirty(false)
            }}
          >
            {locales?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <Card className="overflow-hidden">
        <ul>
          {ORDER.map((wd) => {
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
                          mutate(
                            wd,
                            ranges.map((x, j) =>
                              j === i ? { ...x, startMin: toMinutes(e.target.value) } : x,
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
                          mutate(
                            wd,
                            ranges.map((x, j) =>
                              j === i ? { ...x, endMin: toMinutes(e.target.value) } : x,
                            ),
                          )
                        }
                        className="w-[116px] px-2.5"
                      />
                      <IconButton
                        label={t('hor.quitarFranja', { n: i + 1, dia: weekdayLong(wd, idioma) })}
                        onClick={() =>
                          mutate(
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
                    onClick={() => mutate(wd, [...ranges, ranges.length ? TARDE : MANANA])}
                  >
                    {t('hor.anadirFranja')}
                  </Button>
                  {!cerrado && wd >= 1 && wd <= 5 && (
                    <Button size="sm" variant="quiet" onClick={() => copiarALaborables(wd)}>
                      {t('hor.copiarLV')}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <p className="text-meta text-subtle">{t('hor.aviso')}</p>
    </div>
  )
}
