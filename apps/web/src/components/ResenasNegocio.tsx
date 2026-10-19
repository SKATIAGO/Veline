import { useInfiniteQuery } from '@tanstack/react-query'
import { TIMEZONE } from '@veline/shared'
import { api } from '../lib/api'
import { Button, EmptyState, ErrorNote, Skeleton, cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * Las reseñas de la ficha de un negocio: la nota y cómo se reparte, y las
 * opiniones de la más nueva a la más antigua, de diez en diez.
 *
 * Antes la pestaña decía «llega en la próxima versión» aunque el negocio ya
 * tuviera reseñas: se recogían por correo tras cada cita y no se enseñaban.
 */
export function ResenasNegocio({
  slug,
  rating,
  count,
}: {
  slug: string
  rating: number
  count: number
}) {
  const { t, locale } = useIdioma()
  const consulta = useInfiniteQuery({
    queryKey: ['business', slug, 'reviews'],
    queryFn: ({ pageParam }) => api.businessReviews(slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => (ultima.hasMore ? ultima.reviews.at(-1)?.date : undefined),
    enabled: count > 0,
  })

  if (count === 0) {
    return <EmptyState title={t('ficha.sinResenas')} hint={t('ficha.sinResenasPista')} />
  }

  const reparto = consulta.data?.pages[0]?.distribution
  const resenas = consulta.data?.pages.flatMap((p) => p.reviews) ?? []
  const nota = rating.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: TIMEZONE })

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
      {/* ── El resumen ── */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="font-display text-display leading-none font-semibold text-ink tabular-nums">
          {nota}
        </p>
        <Estrellas valor={rating} className="mt-2 text-subheading" />
        <p className="mt-1 text-meta text-muted">
          {count === 1 ? t('ficha.unaResena') : t('ficha.nResenas', { n: count })}
        </p>

        <ul aria-label={t('ficha.repartoNotas')} className="mt-5 flex flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((n) => {
            const cuantas = reparto?.[String(n) as '1'] ?? 0
            const ancho = reparto && count ? Math.round((cuantas / count) * 100) : 0
            return (
              <li
                key={n}
                aria-label={t('ficha.conNota', { n, c: cuantas })}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)_2rem] items-center gap-2 text-meta text-muted tabular-nums"
              >
                <span aria-hidden>{n} ★</span>
                <span aria-hidden className="h-2 overflow-hidden rounded-full bg-line/70">
                  <span
                    className="block h-full rounded-full bg-brand transition-[width] duration-300"
                    style={{ width: `${ancho}%` }}
                  />
                </span>
                <span aria-hidden className="text-right">
                  {reparto ? cuantas : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Las opiniones ── */}
      <div className="min-w-0">
        {consulta.isError ? (
          <ErrorNote>{t('ficha.resenasNoCargan')}</ErrorNote>
        ) : consulta.isLoading ? (
          <ul aria-busy="true" className="flex flex-col divide-y divide-line">
            {Array.from({ length: Math.min(count, 3) }, (_, i) => (
              <li key={i} className="flex flex-col gap-2 py-5 first:pt-0">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-full max-w-[520px]" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {resenas.map((r) => (
              <li key={r.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="flex items-center gap-2.5">
                    <span className="text-ui font-semibold text-ink">{r.name}</span>
                    <Estrellas valor={r.rating} className="text-body" />
                  </p>
                  <p className="text-meta text-subtle first-letter:uppercase">{fecha(r.date)}</p>
                </div>
                <p className="mt-0.5 text-meta text-muted">{r.serviceName}</p>
                {r.comment && (
                  <p className="mt-2 max-w-[640px] text-body leading-relaxed whitespace-pre-line text-body-2">
                    {r.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {consulta.hasNextPage && (
          <Button
            variant="secondary"
            className="mt-4"
            loading={consulta.isFetchingNextPage}
            onClick={() => void consulta.fetchNextPage()}
          >
            {t('ficha.verMasResenas')}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Cinco estrellas, llenas hasta la nota redondeada. El número lo lee el lector de pantalla. */
function Estrellas({ valor, className }: { valor: number; className?: string }) {
  const { t, locale } = useIdioma()
  const llenas = Math.round(valor)
  return (
    <span
      role="img"
      aria-label={t('ficha.estrellas', {
        n: valor.toLocaleString(locale, { maximumFractionDigits: 1 }),
      })}
      className={cx('inline-flex leading-none tracking-[0.08em]', className)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden className={n <= llenas ? 'text-brand' : 'text-line-strong'}>
          ★
        </span>
      ))}
    </span>
  )
}
