import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDuration, formatPrice, type ExtraPedido } from '@veline/shared'
import { api } from '../lib/api'
import { extrasDeUrl, tramoExtras } from '../lib/reserva'
import { BackBar, Button, Card, Contador, MAX_POR_EXTRA, Spinner, cx } from '../components/ui'
import { Photo } from '../components/Photo'
import { MarbleWash } from '../components/Ornaments'
import { Reveal } from '../components/Reveal'
import { useIdioma } from '../i18n/idioma'

/**
 * Primer paso de la reserva: la carta de extras, con el servicio ya elegido.
 *
 * Va antes de la fecha y no al final porque preguntarlo en la confirmación
 * llegaba tarde: ahí la cabeza ya está en el teléfono y el email, y los extras
 * se leen como un obstáculo entre el cliente y el botón. Aquí todavía se está
 * decidiendo QUÉ se reserva, que es de lo que va esta pantalla. Y como los
 * extras pueden alargar la cita, elegirlos antes es lo que permite ofrecer
 * después solo las horas en las que de verdad cabe.
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

  // Quien vuelve atrás desde la fecha se encuentra puesto lo que ya eligió.
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(extrasDeUrl(params).map((p) => [p.extraId, p.quantity])),
  )

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
  const urlFecha = (pedidos: ExtraPedido[]) =>
    `/${slug}/reservar/fecha?servicio=${service.id}${tramoLocal}${tramoExtras(pedidos)}`

  /* Un negocio sin carta no tiene nada que preguntar aquí. Se salta el paso
     sin dejar rastro en el historial: volver atrás desde la fecha tiene que
     llevar a la ficha del negocio, no a una pantalla vacía que rebota. */
  const carta = business.extras
  if (carta.length === 0) return <Navigate to={urlFecha([])} replace />

  /* Solo cuentan los extras que siguen en la carta: si el negocio quita uno
     mientras alguien reserva, deja de sumarse en vez de quedarse cobrado sin
     que se vea. */
  const elegidos = carta
    .map((extra) => ({ extra, cantidad: cantidades[extra.id] ?? 0 }))
    .filter((linea) => linea.cantidad > 0)
  const pedidos = elegidos.map((l) => ({ extraId: l.extra.id, quantity: l.cantidad }))

  const total =
    service.priceCents + elegidos.reduce((suma, l) => suma + l.extra.priceCents * l.cantidad, 0)
  const duracion =
    service.durationMin + elegidos.reduce((suma, l) => suma + l.extra.durationMin * l.cantidad, 0)

  const poner = (id: string, n: number) =>
    setCantidades((previas) => ({ ...previas, [id]: Math.max(0, Math.min(n, MAX_POR_EXTRA)) }))

  return (
    <>
      <BackBar to={`/${slug}`}>
        {business.name} · {service.name}
      </BackBar>

      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-10 overflow-x-clip px-6 py-8 lg:flex-row lg:px-16 lg:py-10">
        {/* Mismo halo que ya usan Precios y Alta: 620 px es lo que hace falta
            para que se note contra un fondo claro; algo más pequeño se disuelve
            en el desenfoque. overflow-x-clip dentro de la fila (no aquí, en el
            padre) evita el scroll horizontal sin tocar la posición fija de la
            tarjeta de 360. */}
        <MarbleWash
          className="-top-40 -right-20 hidden h-[640px] w-[640px] opacity-[.55] lg:block"
          seed={5}
        />
        <Reveal variant="left" className="min-w-0 flex-[1.4]">
          <h1 className="text-[24px] font-semibold text-ink">{t('extras.titulo')}</h1>
          <p className="mt-1.5 max-w-[600px] text-meta text-muted">{t('extras.pista')}</p>

          <ul className="mt-6 flex max-w-[600px] flex-col gap-3">
            {carta.map((e) => {
              const cantidad = cantidades[e.id] ?? 0
              return (
                <li
                  key={e.id}
                  className={cx(
                    'rounded-xl border p-3 transition-colors duration-200',
                    cantidad > 0 ? 'border-brand bg-brand/5' : 'border-line bg-surface',
                  )}
                >
                  <div className="flex items-start gap-3">
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
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-semibold text-ink">{e.name}</div>
                      {e.description && (
                        <p className="mt-0.5 line-clamp-2 text-meta text-muted">{e.description}</p>
                      )}
                    </div>
                    {/* Precio arriba y tiempo debajo, a la derecha: lo que
                        cuesta y lo que alarga se leen de un vistazo sin
                        mezclarse con el nombre. */}
                    <div className="shrink-0 text-right">
                      <div className="text-body font-semibold text-ink tabular-nums">
                        {formatPrice(e.priceCents, idioma)}
                      </div>
                      {e.durationMin > 0 && (
                        <div className="mt-0.5 text-meta text-muted tabular-nums">
                          +{formatDuration(e.durationMin, idioma)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-end gap-3">
                    {/* Con más de uno, lo que va a costar esa línea: es la
                        cuenta que el cliente haría de cabeza, y equivocarla se
                        descubre pagando. */}
                    {cantidad > 1 && (
                      <span className="text-meta font-semibold text-body-2 tabular-nums">
                        {formatPrice(e.priceCents * cantidad, idioma)}
                      </span>
                    )}
                    <Contador
                      cantidad={cantidad}
                      nombre={e.name}
                      onCambiar={(n) => poner(e.id, n)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Reveal>

        <Reveal
          variant="right"
          delay={100}
          as="aside"
          className="relative w-full shrink-0 lg:w-[360px]"
        >
          <Card className="p-6 shadow-pop lg:sticky lg:top-24">
            <div className="mb-4 font-display text-base font-semibold text-ink">
              {t('extras.resumen')}
            </div>

            <div className="mb-2.5 flex justify-between gap-4 text-body">
              <span className="min-w-0 text-muted">{service.name}</span>
              <span className="shrink-0 font-semibold text-ink tabular-nums">
                {formatPrice(service.priceCents, idioma)}
              </span>
            </div>

            {elegidos.map(({ extra, cantidad }) => (
              <div key={extra.id} className="mb-2.5 flex justify-between gap-4 text-body">
                <span className="min-w-0 text-muted">
                  + {extra.name}
                  {cantidad > 1 && ` ×${cantidad}`}
                </span>
                <span className="shrink-0 font-semibold text-ink tabular-nums">
                  {formatPrice(extra.priceCents * cantidad, idioma)}
                </span>
              </div>
            ))}

            <div className="mb-2.5 flex justify-between gap-4 text-body">
              <span className="min-w-0 text-muted">{t('extras.duracion')}</span>
              <span className="shrink-0 font-semibold text-ink tabular-nums">
                {formatDuration(duracion, idioma)}
              </span>
            </div>

            <div className="mt-4 mb-5 flex justify-between border-t border-line pt-4">
              <span className="text-sm text-muted">{t('comun.total')}</span>
              <span className="text-base font-semibold text-ink">{formatPrice(total, idioma)}</span>
            </div>

            <Button size="lg" className="w-full" onClick={() => navigate(urlFecha(pedidos))}>
              {elegidos.length > 0 ? t('extras.continuar') : t('extras.continuarSin')}
            </Button>
          </Card>
        </Reveal>
      </div>
    </>
  )
}
