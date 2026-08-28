import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  categoryLabel,
  formatDuration,
  formatMinutes,
  formatPrice,
  WEEKDAYS_LONG,
} from '@veline/shared'
import { api } from '../lib/api'
import { BackBar, Button, ButtonLink, Card, EmptyState, Spinner, Stars, cx } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { Photo } from '../components/Photo'
import { Lightbox } from '../components/Lightbox'

const TABS = ['Servicios', 'Reseñas', 'Info'] as const

/** Una celda de la galería: abre el visor si hay foto, placeholder si no. */
function GalleryTile({
  photos,
  i,
  name,
  onOpen,
  width,
  height,
  className,
  fallback,
  priority,
  extra = 0,
}: {
  photos: string[]
  i: number
  name: string
  onOpen: (i: number) => void
  width: number
  height: number
  className?: string
  fallback: string
  priority?: boolean
  extra?: number
}) {
  const src = photos[i]

  if (!src) {
    return (
      <Photo
        src={null}
        alt=""
        width={width}
        height={height}
        className={cx('rounded-xl', className)}
        fallback={fallback}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(i)}
      aria-label={`Ver las fotos de ${name}`}
      className={cx('group relative cursor-zoom-in overflow-hidden rounded-xl', className)}
    >
      <Photo
        src={src}
        alt={`${name} — foto ${i + 1}`}
        width={width}
        height={height}
        priority={priority}
        className="size-full transition-transform duration-500 group-hover:scale-[1.03]"
        fallback={fallback}
      />
      {extra > 0 && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/45 text-lg font-semibold text-cream">
          +{extra}
        </span>
      )}
    </button>
  )
}

export function Business() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Servicios')
  const [lightbox, setLightbox] = useState<number | null>(null)

  const {
    data: business,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['business', slug],
    queryFn: () => api.getBusiness(slug),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner label="Cargando el negocio…" />
      </div>
    )
  }

  if (isError || !business) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
        <EmptyState title="Este negocio no existe" hint="Puede que haya cambiado de dirección." />
        <Link to="/buscar" className="mt-6 inline-block font-semibold text-brand-text">
          ← Volver a la búsqueda
        </Link>
      </div>
    )
  }

  const location = business.locations[0]
  const today = new Date().getDay()
  const todayHours = business.openingHours.filter((h) => h.weekday === today)

  const goBook = (serviceId: string) =>
    navigate(`/${business.slug}/reservar/fecha?servicio=${serviceId}`)

  return (
    <>
      <BackBar to="/buscar">{business.name}</BackBar>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 py-8 lg:flex-row lg:px-16 lg:py-10">
        {/* Columna principal */}
        <div className="min-w-0 flex-[1.6]">
          <Reveal variant="up" className="relative mb-7">
            <div className="grid h-[220px] grid-cols-3 grid-rows-2 gap-2 sm:h-[288px]">
              <GalleryTile
                photos={business.photos}
                i={0}
                name={business.name}
                onOpen={setLightbox}
                width={900}
                height={620}
                priority
                className="col-span-3 row-span-2 sm:col-span-2"
                fallback="Foto principal"
              />
              <GalleryTile
                photos={business.photos}
                i={1}
                name={business.name}
                onOpen={setLightbox}
                width={460}
                height={300}
                className="hidden sm:block"
                fallback="Foto 2"
              />
              <GalleryTile
                photos={business.photos}
                i={2}
                name={business.name}
                onOpen={setLightbox}
                width={460}
                height={300}
                className="hidden sm:block"
                fallback="Foto 3"
                extra={business.photos.length - 3}
              />
            </div>

            {business.photos.length > 0 && (
              <button
                type="button"
                onClick={() => setLightbox(0)}
                className="absolute bottom-3 left-3 inline-flex min-h-10 items-center rounded-full bg-surface/95 px-4 text-meta font-semibold text-ink shadow-sm transition-colors hover:bg-surface"
              >
                Ver las {business.photos.length} fotos
              </button>
            )}
          </Reveal>

          <h1 className="text-[26px] font-semibold text-ink sm:text-[30px]">{business.name}</h1>
          <div className="mt-1.5 text-sm font-medium text-subtle">
            {categoryLabel(business.category)} ·{' '}
            <Stars rating={business.rating} count={business.reviewCount} />
            {location && ` · ${location.street}, ${location.city}`}
          </div>

          <div className="mt-6 flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={t === tab}
                onClick={() => setTab(t)}
                className={cx(
                  'inline-flex min-h-11 items-center border-b-2 px-3 text-body transition-[color,border-color,transform] duration-200 active:scale-95',
                  t === tab
                    ? 'border-brand font-semibold text-ink'
                    : 'border-transparent font-medium text-subtle hover:border-line-strong hover:text-ink',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Servicios' && (
            <div key="servicios" className="rise">
              {business.services.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 border-b border-line px-2 py-5 transition-colors duration-200 hover:bg-canvas/60"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="mt-1 text-meta text-subtle">
                      {formatDuration(s.durationMin)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-semibold text-ink">{formatPrice(s.priceCents)}</span>
                    <Button variant="secondary" size="sm" onClick={() => goBook(s.id)}>
                      Reservar
                    </Button>
                  </div>
                </div>
              ))}
              {business.services.length === 0 && (
                <p className="py-8 text-sm text-muted">
                  Este negocio todavía no ha publicado servicios.
                </p>
              )}
            </div>
          )}

          {tab === 'Reseñas' && (
            <div key="resenas" className="rise py-8">
              <EmptyState
                title={`${business.rating.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ★ de media en ${business.reviewCount} reseñas`}
                hint="El detalle de las reseñas llega en la próxima versión."
              />
            </div>
          )}

          {tab === 'Info' && (
            <div key="info" className="rise py-8 text-sm leading-relaxed text-body">
              {business.description && <p className="mb-6 max-w-[560px]">{business.description}</p>}
              <div className="grid max-w-[560px] gap-6 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-meta font-semibold text-ink">Dirección</div>
                  {location ? (
                    <p className="text-muted">
                      {location.street}
                      <br />
                      {location.postalCode} {location.city}
                    </p>
                  ) : (
                    <p className="text-muted">Sin dirección</p>
                  )}
                  {business.phone && <p className="mt-2 text-muted">Tel. {business.phone}</p>}
                </div>
                <div>
                  <div className="mb-2 text-meta font-semibold text-ink">Horario</div>
                  <ul className="space-y-1 text-muted">
                    {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                      const rows = business.openingHours.filter((h) => h.weekday === wd)
                      return (
                        <li key={wd} className="flex justify-between gap-4">
                          <span className="capitalize">{WEEKDAYS_LONG[wd]}</span>
                          <span className={rows.length ? '' : 'text-disabled'}>
                            {rows.length
                              ? rows
                                  .map(
                                    (r) =>
                                      `${formatMinutes(r.startMin)}–${formatMinutes(r.endMin)}`,
                                  )
                                  .join(' · ')
                              : 'Cerrado'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Widget de reserva — fijo a la derecha en desktop */}
        <aside className="w-full shrink-0 lg:w-[340px]">
          <Card className="p-6 lg:sticky lg:top-24">
            <div className="mb-4 font-display text-[17px] font-semibold text-ink">
              Reservar cita
            </div>
            {location && (
              <>
                <div className="mb-1 text-meta font-medium text-muted">Dirección</div>
                <div className="mb-4 text-body text-ink">
                  {location.street}, {location.city}
                </div>
              </>
            )}
            <div className="mb-1 text-meta font-medium text-muted">Hoy</div>
            <div className="mb-5 text-body text-ink">
              {todayHours.length
                ? todayHours
                    .map((h) => `${formatMinutes(h.startMin)} – ${formatMinutes(h.endMin)}`)
                    .join(' · ')
                : 'Cerrado'}
            </div>
            {business.services[0] ? (
              <ButtonLink
                to={`/${business.slug}/reservar/fecha?servicio=${business.services[0].id}`}
                className="w-full"
              >
                Ver huecos disponibles
              </ButtonLink>
            ) : (
              <Button disabled className="w-full">
                Sin servicios disponibles
              </Button>
            )}
          </Card>
        </aside>
      </div>

      <Lightbox
        photos={business.photos}
        index={lightbox}
        onIndex={setLightbox}
        onClose={() => setLightbox(null)}
        title={business.name}
      />
    </>
  )
}
