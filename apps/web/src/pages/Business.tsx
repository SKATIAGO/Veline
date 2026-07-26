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
import { Button, ButtonLink, Card, EmptyState, Spinner, Stars } from '../components/ui'
import { Photo } from '../components/Photo'

const TABS = ['Servicios', 'Reseñas', 'Info'] as const

export function Business() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Servicios')

  const { data: business, isLoading, isError } = useQuery({
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
        <Link to="/buscar" className="mt-6 inline-block font-semibold text-brand">
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
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-6 py-4 text-sm font-medium text-body lg:px-16">
          <Link to="/buscar" className="hover:text-brand">
            ‹
          </Link>
          <span>{business.name}</span>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 py-8 lg:flex-row lg:px-16 lg:py-10">
        {/* Columna principal */}
        <div className="min-w-0 flex-[1.6]">
          <div className="mb-7 grid h-[220px] grid-cols-3 grid-rows-2 gap-2 sm:h-[288px]">
            <Photo
              src={business.photos[0]}
              alt={business.name}
              width={900}
              height={620}
              priority
              className="col-span-3 row-span-2 rounded-xl sm:col-span-2"
              fallback="Foto principal"
            />
            <Photo
              src={business.photos[1]}
              alt={`${business.name}, foto 2`}
              width={460}
              height={300}
              className="hidden rounded-xl sm:block"
              fallback="Foto 2"
            />
            <div className="relative hidden sm:block">
              <Photo
                src={business.photos[2]}
                alt={`${business.name}, foto 3`}
                width={460}
                height={300}
                className="size-full rounded-xl"
                fallback="Foto 3"
              />
              {business.photos.length > 3 && (
                <span className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-ink/85 px-2.5 py-1 text-[11.5px] font-semibold text-cream">
                  +{business.photos.length - 3}
                </span>
              )}
            </div>
          </div>

          <h1 className="text-[26px] font-semibold text-ink sm:text-[30px]">{business.name}</h1>
          <div className="mt-1.5 text-sm font-medium text-subtle">
            {categoryLabel(business.category)} ·{' '}
            <Stars rating={business.rating} count={business.reviewCount} />
            {location && ` · ${location.street}, ${location.city}`}
          </div>

          <div className="mt-6 flex gap-7 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  t === tab
                    ? 'border-b-2 border-brand pb-2.5 text-sm font-semibold text-ink'
                    : 'pb-2.5 text-sm font-medium text-subtle hover:text-ink'
                }
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Servicios' && (
            <div>
              {business.services.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 border-b border-line py-5"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{s.name}</div>
                    <div className="mt-1 text-[13px] text-subtle">{formatDuration(s.durationMin)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="font-semibold text-ink">{formatPrice(s.priceCents)}</span>
                    <Button variant="ghost" size="sm" onClick={() => goBook(s.id)}>
                      Reservar
                    </Button>
                  </div>
                </div>
              ))}
              {business.services.length === 0 && (
                <p className="py-8 text-sm text-muted">Este negocio todavía no ha publicado servicios.</p>
              )}
            </div>
          )}

          {tab === 'Reseñas' && (
            <div className="py-8">
              <EmptyState
                title={`${business.rating.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ★ de media en ${business.reviewCount} reseñas`}
                hint="El detalle de las reseñas llega en la próxima versión."
              />
            </div>
          )}

          {tab === 'Info' && (
            <div className="py-8 text-sm leading-relaxed text-body">
              {business.description && <p className="mb-6 max-w-[560px]">{business.description}</p>}
              <div className="grid max-w-[560px] gap-6 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-[12.5px] font-semibold text-ink">Dirección</div>
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
                  <div className="mb-2 text-[12.5px] font-semibold text-ink">Horario</div>
                  <ul className="space-y-1 text-muted">
                    {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                      const rows = business.openingHours.filter((h) => h.weekday === wd)
                      return (
                        <li key={wd} className="flex justify-between gap-4">
                          <span className="capitalize">{WEEKDAYS_LONG[wd]}</span>
                          <span className={rows.length ? '' : 'text-disabled'}>
                            {rows.length
                              ? rows
                                  .map((r) => `${formatMinutes(r.startMin)}–${formatMinutes(r.endMin)}`)
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
            <div className="mb-4 font-display text-[17px] font-semibold text-ink">Reservar cita</div>
            {location && (
              <>
                <div className="mb-1 text-[13px] font-medium text-muted">Dirección</div>
                <div className="mb-4 text-[13.5px] text-ink">
                  {location.street}, {location.city}
                </div>
              </>
            )}
            <div className="mb-1 text-[13px] font-medium text-muted">Hoy</div>
            <div className="mb-5 text-[13.5px] text-ink">
              {todayHours.length
                ? todayHours.map((h) => `${formatMinutes(h.startMin)} – ${formatMinutes(h.endMin)}`).join(' · ')
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
    </>
  )
}
