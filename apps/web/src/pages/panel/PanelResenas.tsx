import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TIMEZONE } from '@veline/shared'
import { api } from '../../lib/api'
import { Card, EmptyState, PageHeader, Skeleton, cx } from '../../components/ui'
import { PestanasSeccion } from '../../components/PestanasSeccion'
import { useIdioma, usePlural } from '../../i18n/idioma'

/**
 * La pestaña Reseñas de El negocio: lo que han dicho los clientes.
 *
 * Las reseñas se pedían por correo al marcar una cita como atendida y se
 * guardaban, pero el negocio no tenía dónde leerlas. Son las mismas que salen
 * en la ficha pública; aquí con el nombre completo del cliente y lo que se
 * hizo, para saber de quién es cada una.
 */
export function PanelResenas() {
  const { t, locale } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['panel', slug, 'reviews'],
    queryFn: () => api.panelReviews(slug),
  })

  const resenas = (data?.reviews ?? []).filter((r) => r.rating > 0)
  const media = resenas.length ? resenas.reduce((n, r) => n + r.rating, 0) / resenas.length : 0
  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: TIMEZONE,
    })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('panel.elNegocio')} hint={t('neg.resenasPista')} />
      <PestanasSeccion seccion="negocio" />

      {isLoading ? (
        <Card className="flex flex-col gap-4 p-5" aria-busy="true">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </Card>
      ) : resenas.length === 0 ? (
        <EmptyState
          title={t('ficha.sinResenas')}
          hint={
            data?.pending
              ? plural(data.pending, 'neg.resenasUnaPendiente', 'neg.resenasPendientes')
              : t('neg.resenasComoLlegan')
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-display-sm font-semibold text-ink tabular-nums">
                {media.toLocaleString(locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
              <span className="text-body text-muted">
                {plural(resenas.length, 'ficha.unaResena', 'ficha.nResenas')}
              </span>
            </p>
            {!!data?.pending && (
              <p className="text-meta text-subtle">
                {plural(data.pending, 'neg.resenasUnaPendiente', 'neg.resenasPendientes')}
              </p>
            )}
          </div>

          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {resenas.map((r) => (
                <li key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="flex items-center gap-2.5">
                      <span className="text-ui font-semibold text-ink">{r.customerName}</span>
                      <span
                        role="img"
                        aria-label={t('ficha.estrellas', { n: r.rating })}
                        className="inline-flex leading-none tracking-[0.08em]"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            aria-hidden
                            className={cx(n <= r.rating ? 'text-brand' : 'text-line-strong')}
                          >
                            ★
                          </span>
                        ))}
                      </span>
                    </p>
                    <p className="text-meta text-subtle">{fecha(r.answeredAt)}</p>
                  </div>
                  <p className="mt-0.5 text-meta text-muted">{r.serviceName}</p>
                  {r.comment ? (
                    <p className="mt-2 max-w-[640px] text-body leading-relaxed whitespace-pre-line text-body-2">
                      {r.comment}
                    </p>
                  ) : (
                    <p className="mt-2 text-meta text-subtle italic">{t('neg.resenaSinTexto')}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
