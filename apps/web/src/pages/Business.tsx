import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  categoryLabel,
  formatDuration,
  formatMinutes,
  formatPrice,
  weekdayLong,
} from '@veline/shared'
import { api } from '../lib/api'
import { BackBar, Button, ButtonLink, Card, EmptyState, Spinner, Stars, cx } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { Photo } from '../components/Photo'
import { Lightbox } from '../components/Lightbox'
import { recordarOrigen } from '../lib/origen'
import { useIdioma, type Clave } from '../i18n/idioma'

/** La pestaña se identifica por su nombre interno, no por lo que pone en
    pantalla: si la etiqueta fuera el identificador, cambiar de idioma dejaría
    seleccionada una pestaña que ya no existe. */
const TABS = [
  { id: 'servicios', clave: 'ficha.servicios' },
  { id: 'resenas', clave: 'ficha.resenas' },
  { id: 'info', clave: 'ficha.info' },
] as const satisfies readonly { id: string; clave: Clave }[]

type TabId = (typeof TABS)[number]['id']

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
  const { t } = useIdioma()
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
      aria-label={t('ficha.verFotosDe', { nombre: name })}
      className={cx('group relative cursor-zoom-in overflow-hidden rounded-xl', className)}
    >
      <Photo
        src={src}
        alt={t('ficha.foto', { nombre: name, n: i + 1 })}
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
  const { t, idioma, locale } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()

  // Si el cliente llega por el enlace que el negocio comparte en Instagram o
  // en Google, se recuerda: de eso depende que no se le cobre comisión.
  useEffect(() => {
    recordarOrigen(search)
  }, [search])
  const [tab, setTab] = useState<TabId>('servicios')
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
        <Spinner label={t('ficha.cargando')} />
      </div>
    )
  }

  if (isError || !business) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
        <EmptyState title={t('ficha.noExiste')} hint={t('ficha.noExistePista')} />
        <Link to="/buscar" className="mt-6 inline-block font-semibold text-brand-text">
          ← {t('ficha.volverBusqueda')}
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
                fallback={t('ficha.fotoPrincipal')}
              />
              <GalleryTile
                photos={business.photos}
                i={1}
                name={business.name}
                onOpen={setLightbox}
                width={460}
                height={300}
                className="hidden sm:block"
                fallback={t('ficha.fotoNumero', { n: 2 })}
              />
              <GalleryTile
                photos={business.photos}
                i={2}
                name={business.name}
                onOpen={setLightbox}
                width={460}
                height={300}
                className="hidden sm:block"
                fallback={t('ficha.fotoNumero', { n: 3 })}
                extra={business.photos.length - 3}
              />
            </div>

            {business.photos.length > 0 && (
              <button
                type="button"
                onClick={() => setLightbox(0)}
                className="absolute bottom-3 left-3 inline-flex min-h-10 items-center rounded-full bg-surface/95 px-4 text-meta font-semibold text-ink shadow-sm transition-colors hover:bg-surface"
              >
                {t('ficha.verFotos', { n: business.photos.length })}
              </button>
            )}
          </Reveal>

          <h1 className="text-[26px] font-semibold text-ink sm:text-[30px]">{business.name}</h1>
          <div className="mt-1.5 text-sm font-medium text-subtle">
            {categoryLabel(business.category, idioma)} ·{' '}
            <Stars rating={business.rating} count={business.reviewCount} />
            {location && ` · ${location.street}, ${location.city}`}
          </div>

          <div className="mt-6 flex gap-1 border-b border-line">
            {TABS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === tab}
                onClick={() => setTab(p.id)}
                className={cx(
                  'inline-flex min-h-11 items-center border-b-2 px-3 text-body transition-[color,border-color,transform] duration-200 active:scale-95',
                  p.id === tab
                    ? 'border-brand font-semibold text-ink'
                    : 'border-transparent font-medium text-subtle hover:border-line-strong hover:text-ink',
                )}
              >
                {t(p.clave)}
              </button>
            ))}
          </div>

          {tab === 'servicios' && (
            <div key="servicios" className="rise">
              {business.services.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 border-b border-line px-2 py-5 transition-colors duration-200 hover:bg-canvas/60"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="mt-1 text-meta text-subtle">
                      {formatDuration(s.durationMin, idioma)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-semibold text-ink">
                      {formatPrice(s.priceCents, idioma)}
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => goBook(s.id)}>
                      {t('ficha.reservar')}
                    </Button>
                  </div>
                </div>
              ))}
              {business.services.length === 0 && (
                <p className="py-8 text-sm text-muted">{t('ficha.sinServicios')}</p>
              )}
            </div>
          )}

          {tab === 'resenas' && (
            <div key="resenas" className="rise py-8">
              <EmptyState
                title={t('ficha.mediaResenas', {
                  nota: business.rating.toLocaleString(locale, { minimumFractionDigits: 1 }),
                  n: business.reviewCount,
                })}
                hint={t('ficha.resenasProxima')}
              />
            </div>
          )}

          {tab === 'info' && (
            <div key="info" className="rise py-8 text-sm leading-relaxed text-body">
              {business.description && <p className="mb-6 max-w-[560px]">{business.description}</p>}
              <div className="grid max-w-[560px] gap-6 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-meta font-semibold text-ink">
                    {t('ficha.direccion')}
                  </div>
                  {location ? (
                    <p className="text-muted">
                      {location.street}
                      <br />
                      {location.postalCode} {location.city}
                    </p>
                  ) : (
                    <p className="text-muted">{t('ficha.sinDireccion')}</p>
                  )}
                  {business.phone && (
                    <p className="mt-2 text-muted">
                      {t('ficha.tel')} {business.phone}
                    </p>
                  )}
                </div>
                <div>
                  <div className="mb-2 text-meta font-semibold text-ink">{t('ficha.horario')}</div>
                  <ul className="space-y-1 text-muted">
                    {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                      const rows = business.openingHours.filter((h) => h.weekday === wd)
                      return (
                        <li key={wd} className="flex justify-between gap-4">
                          <span className="capitalize">{weekdayLong(wd, idioma)}</span>
                          <span className={rows.length ? '' : 'text-disabled'}>
                            {rows.length
                              ? rows
                                  .map(
                                    (r) =>
                                      `${formatMinutes(r.startMin)}–${formatMinutes(r.endMin)}`,
                                  )
                                  .join(' · ')
                              : t('comun.cerrado')}
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
              {t('ficha.reservarCita')}
            </div>
            {location && (
              <>
                <div className="mb-1 text-meta font-medium text-muted">{t('ficha.direccion')}</div>
                <div className="mb-4 text-body text-ink">
                  {location.street}, {location.city}
                </div>
              </>
            )}
            <div className="mb-1 text-meta font-medium text-muted">{t('ficha.hoy')}</div>
            <div className="mb-5 text-body text-ink">
              {todayHours.length
                ? todayHours
                    .map((h) => `${formatMinutes(h.startMin)} – ${formatMinutes(h.endMin)}`)
                    .join(' · ')
                : t('comun.cerrado')}
            </div>
            {business.services[0] ? (
              <ButtonLink
                to={`/${business.slug}/reservar/fecha?servicio=${business.services[0].id}`}
                className="w-full"
              >
                {t('ficha.verHuecos')}
              </ButtonLink>
            ) : (
              <Button disabled className="w-full">
                {t('ficha.sinServiciosBoton')}
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
