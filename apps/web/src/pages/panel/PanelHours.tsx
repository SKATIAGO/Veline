import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  Button,
  Card,
  ErrorNote,
  PageHeader,
  Select,
  Skeleton,
  SuccessNote,
  BarraGuardar,
} from '../../components/ui'
import {
  FranjasSemanales,
  ORDEN_SEMANA as ORDER,
  type Franja as Range,
} from '../../components/FranjasSemanales'
import { useIdioma, usePlural } from '../../i18n/idioma'
import { useCambiosSinGuardar } from '../../lib/cambios'

export function PanelHours() {
  const { t } = useIdioma()
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

  /* Avisa antes de irse con cambios sin guardar: al cerrar la pestaña y al
     cambiar de sección en el panel. Rellenar el horario de la semana entera y
     perderlo por un toque de más es de las cosas que más molestan. */
  useCambiosSinGuardar(dirty)

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

      <BarraGuardar visible={dirty}>
        <span className="min-w-0 truncate text-meta text-muted">
          {invalid ? t('hor.franjaInvalida') : t('hor.sinGuardar')}
        </span>
        <Button size="sm" onClick={() => save.mutate()} disabled={invalid} loading={save.isPending}>
          {t('hor.guardar')}
        </Button>
      </BarraGuardar>

      {invalid && <ErrorNote>{t('hor.franjaInvalida')}</ErrorNote>}
      {save.isError && <ErrorNote>{(save.error as Error).message}</ErrorNote>}
      {save.isSuccess && !dirty && <SuccessNote>{t('hor.guardado')}</SuccessNote>}

      {varios && (
        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="text-meta font-semibold text-body-2">{t('hor.local')}</span>
          <Select
            value={localActual}
            onChange={(e) => {
              // Cambiar de local también tiraba lo escrito sin preguntar.
              if (dirty && !window.confirm(t('panel.salirSinGuardar'))) return
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

      <FranjasSemanales week={week} onChange={mutate} onCopiarALaborables={copiarALaborables} />

      <p className="text-meta text-subtle">{t('hor.aviso')}</p>
    </div>
  )
}
