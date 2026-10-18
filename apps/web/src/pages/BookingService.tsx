import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDuration, formatPrice } from '@veline/shared'
import { api } from '../lib/api'
import { CLAVES_PASO, pasosReserva } from '../lib/reserva'
import { EmptyState, Spinner, cx } from '../components/ui'
import { Photo } from '../components/Photo'
import { MarcoReserva } from '../components/reserva/MarcoReserva'
import { useFotosNegocio, useVisor } from '../lib/galeria'
import { useIdioma } from '../i18n/idioma'

/**
 * Paso 1 de la reserva: ¿qué quieres reservar?
 *
 * Antes la ficha del negocio hacía de primer paso: una página larga con
 * fotos, pestañas y un widget, en la que el servicio se elegía entre otras
 * muchas cosas. Ahora el asistente empieza aquí, como el del administrador:
 * una pantalla, una decisión. Tocar un servicio pasa al siguiente paso.
 */
export function BookingService() {
  const { t, idioma } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const localPedido = params.get('local') ?? ''

  const { data: business, isLoading } = useQuery({
    queryKey: ['business', slug],
    queryFn: () => api.getBusiness(slug),
  })
  const fotosDe = useFotosNegocio()
  const visor = useVisor()

  if (isLoading || !business) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }

  const tieneCarta = business.extras.length > 0
  const pasos = pasosReserva(tieneCarta)
  const tramoLocal = localPedido ? `&local=${localPedido}` : ''
  const siguiente = (serviceId: string) =>
    `/${slug}/reservar/${tieneCarta ? 'extras' : 'fecha'}?servicio=${serviceId}${tramoLocal}`
  const conFoto = business.services.some((s) => s.photos.length > 0)

  return (
    <MarcoReserva
      negocio={business}
      servicio={{ name: t('reserva.pasoServicio'), photos: [] }}
      pasos={pasos.map((p) => t(CLAVES_PASO[p]))}
      paso={0}
      volverA={`/${slug}`}
      salirA={`/${slug}`}
      titulo={business.name}
      resumenCorto={business.name}
      fotos={{ fotosDe, visor }}
      resumen={<p className="text-body text-muted">{t('reserva.eligeServicioPista')}</p>}
    >
      <h1 className="text-title font-semibold text-ink">{t('reserva.eligeServicio')}</h1>
      <p className="mt-1.5 mb-5 max-w-[600px] text-meta text-muted">
        {t('reserva.eligeServicioPista')}
      </p>

      {business.services.length === 0 ? (
        <EmptyState title={t('ficha.sinServicios')} />
      ) : (
        <ul className="flex max-w-[640px] flex-col gap-3">
          {business.services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => navigate(siguiente(s.id))}
                className={cx(
                  'group flex w-full items-center gap-4 rounded-xl border border-line bg-surface p-3 text-left',
                  'transition-[border-color,box-shadow,transform] duration-200 hover:border-brand hover:shadow-raised active:scale-[.99]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                )}
              >
                {s.photos[0] ? (
                  <Photo
                    src={s.photos[0]}
                    alt=""
                    width={160}
                    height={160}
                    className="size-20 shrink-0 rounded-lg"
                  />
                ) : (
                  conFoto && <span aria-hidden className="size-20 shrink-0 rounded-lg bg-canvas" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-ui font-semibold text-ink group-hover:text-brand-text">
                    {s.name}
                  </span>
                  <span className="mt-0.5 block text-meta text-muted">
                    {formatDuration(s.durationMin, idioma)}
                  </span>
                  {s.description && (
                    <span className="mt-1 line-clamp-2 block text-meta text-subtle">
                      {s.description}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-ui font-semibold text-ink tabular-nums">
                    {formatPrice(s.priceCents, idioma)}
                  </span>
                  <span aria-hidden className="text-subheading leading-none text-subtle">
                    ›
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </MarcoReserva>
  )
}
