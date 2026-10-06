import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPrice, planLabel } from '@veline/shared'
import { api } from '../../lib/api'
import { Badge, ErrorNote, Skeleton, cx } from '../../components/ui'
import { useIdioma, usePlural } from '../../i18n/idioma'
import { aviso, textoDeError } from '../../components/Avisos'
import { Wizard } from '../../components/Wizard'

/** Los últimos meses ya terminados, del más reciente al más antiguo: AAAA-MM. */
export function mesesCerrables(cuantos = 3) {
  const hoy = new Date()
  return Array.from({ length: cuantos }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1 - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

/**
 * Cerrar un mes: se crea el cobro de cada negocio.
 *
 * Antes era un botón en la cabecera con una pregunta de tres líneas: se aceptaba
 * sin saber a cuántos negocios ni por cuánto dinero. Ahora se elige el mes, se
 * ve negocio a negocio lo que se cobraría (con el mismo cálculo que el cierre
 * y sin guardar nada) y solo entonces se confirma.
 */
export function CerrarMes({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const queryClient = useQueryClient()
  const meses = mesesCerrables()
  const [paso, setPaso] = useState(0)
  const [mes, setMes] = useState(meses[0]!)

  const mesLargo = (period: string) =>
    new Date(`${period}-01T00:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'charges', 'preview', mes],
    queryFn: () => api.chargesPreview(mes),
    enabled: open && paso >= 1,
  })
  const pendientes = (data?.filas ?? []).filter((f) => f.estado !== 'YA_CERRADO')

  const cerrar = useMutation({
    mutationFn: () => api.closeMonth(mes),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      aviso.ok(
        r.creados === 0
          ? t('cob.yaCerrado', { mes: mesLargo(r.period) })
          : t(r.creados === 1 ? 'cob.cerradoUno' : 'cob.cerradoVarios', {
              mes: mesLargo(r.period),
              n: r.creados,
              negocios: r.negocios,
            }),
      )
      onClose()
    },
  })

  const pasos = [
    {
      id: 'mes',
      titulo: t('cmes.pasoMes'),
      problema: null,
      contenido: (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-meta font-semibold text-body-2">{t('cmes.queMes')}</legend>
          {meses.map((m, i) => (
            <button
              key={m}
              type="button"
              aria-pressed={mes === m}
              onClick={() => setMes(m)}
              className={cx(
                'flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors duration-200',
                mes === m
                  ? 'border-brand bg-brand/5'
                  : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="text-[14px] font-semibold text-ink first-letter:uppercase">
                {mesLargo(m)}
              </span>
              <span className="text-meta text-muted">
                {i === 0 ? t('cmes.elQueToca') : t('cmes.unoAtrasado')}
              </span>
            </button>
          ))}
        </fieldset>
      ),
    },
    {
      id: 'cobros',
      titulo: t('cmes.pasoCobros'),
      problema: isLoading
        ? t('cmes.calculando')
        : isError || !data
          ? t('cmes.noSeCalculo')
          : pendientes.length === 0
            ? t('cmes.todoCerrado', { mes: mesLargo(mes) })
            : null,
      contenido: isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorNote>{textoDeError(error, t('cmes.noSeCalculo'))}</ErrorNote>
      ) : (
        <>
          <p className="text-body text-body-2">
            {t('cmes.resumen', {
              mes: mesLargo(mes),
              n: plural(data.nuevos, 'cmes.unCobro', 'cmes.variosCobros'),
              importe: formatPrice(data.totalCents, idioma),
            })}
          </p>
          <ul className="flex flex-col">
            {data.filas.map((f) => (
              <li
                key={f.businessId}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{f.name}</p>
                  <p className="text-meta text-muted">
                    {f.estado === 'YA_CERRADO' || !f.desglose
                      ? t('cmes.sinCalculo')
                      : `${planLabel(f.desglose.plan, idioma)} · ${plural(f.desglose.seats, 'cob.unaPersona', 'cob.variasPersonas')}`}
                  </p>
                </div>
                {f.estado === 'NUEVO' && f.desglose ? (
                  <span className="text-[14px] font-semibold text-ink tabular-nums">
                    {formatPrice(f.desglose.totalCents, idioma)}
                  </span>
                ) : (
                  <Badge tone={f.estado === 'YA_CERRADO' ? 'neutral' : 'off'}>
                    {t(f.estado === 'YA_CERRADO' ? 'cmes.yaCerrado' : 'cmes.aCero')}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      id: 'confirmar',
      titulo: t('cmes.pasoConfirmar'),
      problema: null,
      contenido: (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-xl bg-cream px-4 py-3 text-body">
            <dt className="text-muted">{t('cmes.pasoMes')}</dt>
            <dd className="text-right font-semibold text-ink first-letter:uppercase">
              {mesLargo(mes)}
            </dd>
            <dt className="text-muted">{t('cmes.seCrean')}</dt>
            <dd className="text-right font-semibold text-ink">
              {plural(data?.nuevos ?? 0, 'cmes.unCobro', 'cmes.variosCobros')}
            </dd>
            <dt className="text-muted">{t('cmes.importe')}</dt>
            <dd className="text-right font-semibold text-ink tabular-nums">
              {formatPrice(data?.totalCents ?? 0, idioma)}
            </dd>
          </dl>
          <ul className="flex flex-col gap-1.5 text-body text-body-2">
            <li>— {t('cob.cerrarC2')}</li>
            <li>— {t('cmes.congela')}</li>
            <li>— {t('cob.cerrarC3')}</li>
          </ul>
        </>
      ),
    },
  ]

  return (
    <Wizard
      open={open}
      onClose={onClose}
      title={t('cmes.titulo')}
      pasos={pasos}
      paso={paso}
      setPaso={(n) => {
        cerrar.reset()
        setPaso(n)
      }}
      finalLabel={t('cob.cerrarElMes')}
      onFinalizar={() => cerrar.mutate()}
      loading={cerrar.isPending}
      error={cerrar.isError ? textoDeError(cerrar.error, t('cob.noSePudoCerrar')) : null}
    />
  )
}
