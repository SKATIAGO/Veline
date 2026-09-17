import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatPrice } from '@veline/shared'
import { api } from '../lib/api'
import { extrasDeUrl, tramoExtras } from '../lib/reserva'
import { BackBar, Button, Card, Spinner, cx } from '../components/ui'
import { Photo } from '../components/Photo'
import { Reveal } from '../components/Reveal'
import { useIdioma } from '../i18n/idioma'

/**
 * Primer paso de la reserva: la carta de extras, con el servicio ya elegido.
 *
 * Va antes de la fecha y no al final porque preguntarlo en la confirmación
 * llegaba tarde: ahí la cabeza ya está en el teléfono y el email, y los extras
 * se leen como un obstáculo entre el cliente y el botón. Aquí todavía se está
 * decidiendo QUÉ se reserva, que es de lo que va esta pantalla.
 *
 * Añadir no es obligatorio en ningún caso, así que el botón sigue estando ahí
 * sin marcar nada y lo dice con todas las letras: continuar sin extras es una
 * salida a la vista, no el resultado de no tocar nada.
 */
export function BookingExtras() {
  const { t, idioma } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const serviceId = params.get('servicio') ?? ''
  const localPedido = params.get('local') ?? ''

  // Quien vuelve atrás desde la fecha se encuentra marcado lo que ya eligió.
  const [extraIds, setExtraIds] = useState<string[]>(() => extrasDeUrl(params))

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: () => api.getBusiness(slug),
  })

  const service = business?.services.find((s) => s.id === serviceId) ?? business?.services[0]

  if (!business || !service) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }

  const tramoLocal = localPedido ? `&local=${localPedido}` : ''
  const urlFecha = (ids: string[]) =>
    `/${slug}/reservar/fecha?servicio=${service.id}${tramoLocal}${tramoExtras(ids)}`

  /* Un negocio sin carta no tiene nada que preguntar aquí. Se salta el paso
     sin dejar rastro en el historial: volver atrás desde la fecha tiene que
     llevar a la ficha del negocio, no a una pantalla vacía que rebota. */
  const carta = business.extras
  if (carta.length === 0) return <Navigate to={urlFecha([])} replace />

  /* Solo cuentan los extras que siguen en la carta: si el negocio quita uno
     mientras alguien reserva, deja de sumarse en vez de quedarse cobrado sin
     que se vea. */
  const elegidos = carta.filter((e) => extraIds.includes(e.id))
  const total = service.priceCents + elegidos.reduce((suma, e) => suma + e.priceCents, 0)

  const alternar = (id: string) =>
    setExtraIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  return (
    <>
      <BackBar to={`/${slug}`}>
        {business.name} · {service.name}
      </BackBar>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 py-8 lg:flex-row lg:px-16 lg:py-10">
        <Reveal variant="left" className="min-w-0 flex-[1.4]">
          <h1 className="text-[24px] font-semibold text-ink">{t('extras.titulo')}</h1>
          <p className="mt-1.5 max-w-[600px] text-meta text-muted">{t('extras.pista')}</p>

          <ul className="mt-6 grid max-w-[600px] gap-3 sm:grid-cols-2">
            {carta.map((e) => {
              const elegido = extraIds.includes(e.id)
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => alternar(e.id)}
                    className={cx(
                      'flex min-h-[72px] w-full items-center gap-3 rounded-xl border p-2.5 pr-3.5 text-left',
                      'transition-[background-color,border-color,transform] duration-200 active:scale-[.99]',
                      elegido
                        ? 'border-brand bg-brand/5'
                        : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    {e.photo && (
                      <Photo
                        src={e.photo}
                        alt=""
                        width={112}
                        height={112}
                        className="size-14 shrink-0 rounded-lg"
                        fallback=""
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold text-ink">{e.name}</span>
                      {e.description && (
                        <span className="mt-0.5 line-clamp-2 block text-meta text-muted">
                          {e.description}
                        </span>
                      )}
                      <span className="mt-0.5 block text-meta font-semibold text-body-2">
                        +{formatPrice(e.priceCents, idioma)}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cx(
                        'grid size-6 shrink-0 place-items-center rounded-full border text-caption font-bold',
                        elegido ? 'border-brand bg-brand text-white' : 'border-line-strong',
                      )}
                    >
                      {elegido ? '✓' : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Reveal>

        <Reveal variant="right" delay={100} as="aside" className="w-full shrink-0 lg:w-[360px]">
          <Card className="p-6 lg:sticky lg:top-24">
            <div className="mb-4 font-display text-base font-semibold text-ink">
              {t('extras.resumen')}
            </div>

            <div className="mb-2.5 flex justify-between gap-4 text-body">
              <span className="min-w-0 text-muted">{service.name}</span>
              <span className="shrink-0 font-semibold text-ink tabular-nums">
                {formatPrice(service.priceCents, idioma)}
              </span>
            </div>

            {elegidos.map((e) => (
              <div key={e.id} className="mb-2.5 flex justify-between gap-4 text-body">
                <span className="min-w-0 text-muted">+ {e.name}</span>
                <span className="shrink-0 font-semibold text-ink tabular-nums">
                  {formatPrice(e.priceCents, idioma)}
                </span>
              </div>
            ))}

            <div className="mt-4 mb-5 flex justify-between border-t border-line pt-4">
              <span className="text-sm text-muted">{t('comun.total')}</span>
              <span className="text-base font-semibold text-ink">{formatPrice(total, idioma)}</span>
            </div>

            <Button
              className="w-full"
              onClick={() => navigate(urlFecha(elegidos.map((e) => e.id)))}
            >
              {elegidos.length > 0 ? t('extras.continuar') : t('extras.continuarSin')}
            </Button>
          </Card>
        </Reveal>
      </div>
    </>
  )
}
