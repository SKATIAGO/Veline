import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatPrice, planLabel, PLAN_INFO, subStatusLabel } from '@veline/shared'
import { api } from '../../lib/api'
import { Badge, Card, EmptyState, PageHeader, Skeleton, cx } from '../../components/ui'
import { useIdioma, usePlural, type Clave } from '../../i18n/idioma'

/** Lo que el negocio paga cada mes y por qué. Los enlaces que evitan la
    comisión tienen pantalla propia: «Enlaces», en el mismo grupo del menú. */

const TONO: Record<string, 'ok' | 'warn' | 'off'> = {
  COBRADO: 'ok',
  PENDIENTE: 'warn',
  ANULADO: 'off',
}

const ESTADO_CLAVE: Record<string, Clave> = {
  COBRADO: 'fac.cobrado',
  PENDIENTE: 'fac.pendiente',
  ANULADO: 'fac.anulado',
}

function Linea({
  label,
  hint,
  cents,
  fuerte,
}: {
  label: string
  hint?: string
  cents: number
  fuerte?: boolean
}) {
  const { idioma } = useIdioma()

  return (
    <div
      className={cx(
        'flex items-baseline justify-between gap-4 py-2.5',
        fuerte && 'border-t border-line pt-3.5',
      )}
    >
      <div>
        <span className={cx('text-body', fuerte ? 'font-semibold text-ink' : 'text-body-2')}>
          {label}
        </span>
        {hint && <p className="text-meta text-subtle">{hint}</p>}
      </div>
      <span
        className={cx(
          'shrink-0 tabular-nums',
          fuerte ? 'text-subheading font-semibold text-ink' : 'text-body text-body-2',
        )}
      >
        {formatPrice(cents, idioma)}
      </span>
    </div>
  )
}

export function PanelMiCuenta() {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()

  const mesLargo = (period: string) =>
    new Date(`${period}-01T00:00:00`).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
    })

  const { data: cuenta, isLoading } = useQuery({
    queryKey: ['panel', slug, 'cuenta'],
    queryFn: () => api.panelCuenta(slug),
  })

  const { data: summary } = useQuery({
    queryKey: ['panel', slug, 'summary'],
    queryFn: () => api.panelSummary(slug),
  })

  const sub = summary?.subscription

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('panel.facturacion')} hint={t('fac.pista')} />

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Card>
      ) : (
        <div className="max-w-[520px]">
          <Card padded>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-subheading font-semibold text-ink">
                {cuenta?.current
                  ? t('fac.esteMesCon', { mes: mesLargo(cuenta.current.period) })
                  : t('fac.esteMes')}
              </h2>
              {sub && (
                <Badge tone={sub.status === 'ACTIVA' ? 'ok' : 'neutral'}>
                  {subStatusLabel(sub.status, idioma)}
                </Badge>
              )}
            </div>

            {cuenta?.current ? (
              <div className="mt-3">
                <Linea
                  label={t('fac.plan', { nombre: planLabel(cuenta.current.plan, idioma) })}
                  hint={[
                    plural(cuenta.current.seats, 'fac.unaPersona', 'fac.variasPersonas'),
                    t('fac.incluidas', {
                      n: PLAN_INFO[cuenta.current.plan].seatsIncluded,
                    }),
                  ].join(' · ')}
                  cents={cuenta.current.subscriptionCents}
                />
                <Linea
                  label={t('fac.comision')}
                  hint={t('fac.comisionPista')}
                  cents={cuenta.current.commissionCents}
                />
                <Linea
                  label={t('fac.mensajesDeMas')}
                  hint={
                    sub
                      ? t('fac.mensajesPista', {
                          enviados: sub.messages.enviados,
                          incluidos: sub.messages.incluidos,
                        })
                      : undefined
                  }
                  cents={cuenta.current.messagesCents}
                />
                <Linea label={t('fac.totalMes')} cents={cuenta.current.totalCents} fuerte />
                <p className="mt-3 text-meta text-subtle">{t('fac.mesCorriendo')}</p>
              </div>
            ) : (
              <p className="mt-3 text-body text-muted">{t('fac.nadaQueCobrar')}</p>
            )}
          </Card>
        </div>
      )}

      <div>
        <h2 className="mb-3 font-display text-subheading font-semibold text-ink">
          {t('fac.mesesAnteriores')}
        </h2>
        {!cuenta?.history.length ? (
          <EmptyState title={t('fac.sinMeses')} hint={t('fac.sinMesesPista')} />
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {cuenta.history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
                >
                  <div className="min-w-[150px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-ink capitalize">
                        {mesLargo(h.period)}
                      </span>
                      <Badge tone={TONO[h.status] ?? 'neutral'}>
                        {ESTADO_CLAVE[h.status] ? t(ESTADO_CLAVE[h.status]) : h.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-meta text-muted">
                      {planLabel(h.plan, idioma)} ·{' '}
                      {plural(h.seats, 'fac.unaPersona', 'fac.variasPersonas')}
                      {h.extraMessages > 0 &&
                        ` · ${t('fac.mensajesDeMasCuenta', { n: h.extraMessages })}`}
                    </p>
                  </div>
                  <span className="text-ui font-semibold text-ink tabular-nums">
                    {formatPrice(h.totalCents, idioma)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <p className="text-meta text-subtle">{t('fac.avisoCobro')}</p>
    </div>
  )
}
