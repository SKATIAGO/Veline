import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MAX_POR_EXTRA, formatDuration, formatPrice, type ExtraPedido } from '@veline/shared'
import { api } from '../lib/api'
import { extrasDeUrl, pasosReserva, tramoExtras, CLAVES_PASO } from '../lib/reserva'
import { Button, Contador, Spinner, cx } from '../components/ui'
import { FotoAmpliable } from '../components/Galeria'
import { MarcoReserva } from '../components/reserva/MarcoReserva'
import { ResumenReserva } from '../components/reserva/ResumenReserva'
import { SinServicio } from '../components/reserva/SinServicio'
import { useFotosNegocio, useVisor } from '../lib/galeria'
import { useIdioma } from '../i18n/idioma'

/**
 * Paso de extras: la carta, con el servicio ya elegido en la ficha.
 *
 * Va antes de la fecha porque los extras pueden alargar la cita: elegirlos
 * primero es lo que permite ofrecer huecos donde quepa todo. Continuar sin
 * marcar nada es una salida normal y se dice con todas las letras.
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
  const fotosDe = useFotosNegocio()
  const visor = useVisor()

  if (!business) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }

  const service = business.services.find((s) => s.id === serviceId)
  if (!service) return <SinServicio slug={slug} />

  const tramoLocal = localPedido ? `&local=${localPedido}` : ''
  const urlFecha = (pedidos: ExtraPedido[]) =>
    `/${slug}/reservar/fecha?servicio=${service.id}${tramoLocal}${tramoExtras(pedidos)}`

  /* Un negocio sin carta no tiene nada que preguntar aquí. Se salta el paso
     sin dejar rastro en el historial. */
  const carta = business.extras
  if (carta.length === 0) return <Navigate to={urlFecha([])} replace />

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

  const pasos = pasosReserva(true)

  return (
    <MarcoReserva
      negocio={business}
      servicio={service}
      pasos={pasos.map((p) => t(CLAVES_PASO[p]))}
      paso={pasos.indexOf('extras')}
      volverA={`/${slug}`}
      salirA={`/${slug}`}
      resumenCorto={`${service.name} · ${formatDuration(duracion, idioma)}`}
      total={total}
      fotos={{ fotosDe, visor }}
      resumen={
        <ResumenReserva
          servicio={service}
          elegidos={elegidos}
          duracionMin={duracion}
          urlServicio={`/${slug}`}
          tieneCarta={false}
        />
      }
      accion={
        <Button size="lg" onClick={() => navigate(urlFecha(pedidos))}>
          {elegidos.length > 0 ? t('extras.continuar') : t('extras.continuarSin')}
        </Button>
      }
    >
      <h1 className="text-title font-semibold text-ink">{t('extras.titulo')}</h1>
      <p className="mt-1.5 max-w-[600px] text-meta text-muted">{t('extras.pista')}</p>

      <ul className="mt-6 flex max-w-[640px] flex-col gap-3">
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
                {e.photos[0] && (
                  <FotoAmpliable
                    src={e.photos[0]}
                    nombre={e.name}
                    lado={64}
                    cuantas={e.photos.length}
                    className="size-16"
                    onOpen={() => visor.abrir(fotosDe.deExtra(e))}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold text-ink">{e.name}</div>
                  {e.description && (
                    <p className="mt-0.5 line-clamp-2 text-meta text-muted">{e.description}</p>
                  )}
                </div>
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
                {cantidad > 1 && (
                  <span className="text-meta font-semibold text-body-2 tabular-nums">
                    {formatPrice(e.priceCents * cantidad, idioma)}
                  </span>
                )}
                <Contador cantidad={cantidad} nombre={e.name} onCambiar={(n) => poner(e.id, n)} />
              </div>
            </li>
          )
        })}
      </ul>
    </MarcoReserva>
  )
}
