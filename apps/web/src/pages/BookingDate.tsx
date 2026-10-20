import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  addDaysKey,
  extrasParam,
  formatLongDate,
  fromDateKey,
  hoyMadrid,
  type DayAvailabilityDTO,
  type SlotDTO,
} from '@veline/shared'
import { api } from '../lib/api'
import { CLAVES_PASO, extrasDeUrl, pasosReserva, tramoExtras } from '../lib/reserva'
import { Button, Select } from '../components/ui'
import { CalendarioMes, type EstadoDia } from '../components/CalendarioMes'
import { SelectorProfesional } from '../components/SelectorProfesional'
import { HuecosDelDia } from '../components/reserva/HuecosDelDia'
import { MarcoReserva } from '../components/reserva/MarcoReserva'
import { ResumenReserva } from '../components/reserva/ResumenReserva'
import { SinServicio } from '../components/reserva/SinServicio'
import { Spinner } from '../components/ui'
import { useFotosNegocio, useVisor } from '../lib/galeria'
import { useIdioma } from '../i18n/idioma'

/** Hasta cuándo se puede reservar: dos meses vista (el servidor permite 62 días). */
const DIAS_VISTA = 60

const primerDiaDelMes = (key: string) => `${key.slice(0, 7)}-01`
const ultimoDiaDelMes = (key: string) => {
  const d = fromDateKey(primerDiaDelMes(key))
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`
}

/**
 * Paso de fecha y hora: con quién (si hay varias personas), en qué local (si
 * hay varios), el mes en cuadrícula y las horas del día elegido.
 *
 * Antes el móvil enseñaba una tira de catorce días: no se podía reservar a
 * dos meses vista sin hacer scroll infinito, y el servicio se volvía a elegir
 * aquí con un desplegable. Ahora el servicio viene decidido de la ficha (y se
 * cambia desde el resumen) y el calendario es el mismo en móvil y escritorio.
 */
export function BookingDate() {
  const { t, idioma } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const serviceId = params.get('servicio') ?? ''
  const localPedido = params.get('local') ?? ''
  const personaPedida = params.get('persona') ?? ''
  const pedidos = extrasDeUrl(params)

  // «Hoy» es el de Madrid, que es donde está el negocio.
  const hoy = useMemo(() => hoyMadrid(), [])
  const maximo = addDaysKey(hoy, DIAS_VISTA)
  const [mes, setMes] = useState(() => primerDiaDelMes(hoy))
  const [diaElegido, setDia] = useState<string | null>(null)
  const [slot, setSlot] = useState<SlotDTO | null>(null)

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: () => api.getBusiness(slug),
  })
  const service = business?.services.find((s) => s.id === serviceId)

  /* Con un solo local no se pregunta nada. Con varios hay que elegir, porque
     el horario y quién atiende son de cada uno. */
  const locales = business?.locations ?? []
  const local = locales.find((l) => l.id === localPedido) ?? locales[0]
  const varios = locales.length > 1

  /* Quien atiende en el local elegido: las suyas y las de quien no tiene uno
     asignado, igual que calcula el servidor. */
  const personal = (business?.staff ?? []).filter(
    (p) => !local || !p.locationId || p.locationId === local.id,
  )
  const staff = personal.find((p) => p.id === personaPedida)
  const variosPersonal = personal.length > 1

  // Se pide el mes a la vista, acotado a hoy y al tope de antelación.
  const desde = mes > hoy ? mes : hoy
  const hasta = ultimoDiaDelMes(mes) < maximo ? ultimoDiaDelMes(mes) : maximo

  const {
    data: datosHuecos,
    isFetching,
    isPlaceholderData,
    isError,
    error,
  } = useQuery({
    queryKey: [
      'availability',
      slug,
      service?.id,
      local?.id,
      staff?.id,
      extrasParam(pedidos),
      desde,
      hasta,
    ],
    queryFn: () =>
      api.getAvailability(slug, {
        serviceId: service!.id,
        from: desde,
        to: hasta,
        ...(local ? { locationId: local.id } : {}),
        ...(staff ? { staffId: staff.id } : {}),
        ...(pedidos.length ? { extras: extrasParam(pedidos) } : {}),
      }),
    enabled: Boolean(service) && desde <= hasta,
    // Al cambiar de mes se queda lo anterior hasta que llega lo nuevo: el
    // calendario no se va de la pantalla mientras tanto.
    placeholderData: keepPreviousData,
  })
  // Lo de otro mes no vale para este: mientras llega, el mes está «cargando».
  const availability = isPlaceholderData ? undefined : datosHuecos
  const cargandoMes = isFetching && !availability

  const fotosDe = useFotosNegocio()
  const visor = useVisor()

  const porDia = useMemo(() => {
    const map = new Map<string, DayAvailabilityDTO>()
    for (const d of availability ?? []) map.set(d.date, d)
    return map
  }, [availability])
  const conHueco = (key: string) => porDia.get(key)?.slots.some((s) => s.available) ?? false

  /* El día a la vista: el elegido o, si no, el primero con hueco del mes.
     Se calcula aquí y no en un efecto: con el efecto había un instante sin
     día («Elige un día») y la página saltaba dos veces al llegar las horas. */
  const dia =
    diaElegido ?? availability?.find((d) => d.slots.some((x) => x.available))?.date ?? null

  if (!business) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }
  if (!service) return <SinServicio slug={slug} />

  const estado = (key: string): EstadoDia => {
    if (key < hoy || key > maximo) return 'fuera'
    if (cargandoMes) return 'cargando'
    const d = porDia.get(key)
    if (!d) return 'sinHueco'
    if (d.closed) return 'cerrado'
    return conHueco(key) ? 'disponible' : 'sinHueco'
  }

  const elegidos = pedidos.flatMap((p) => {
    const extra = business.extras.find((e) => e.id === p.extraId)
    return extra ? [{ extra, cantidad: p.quantity }] : []
  })
  const total =
    service.priceCents + elegidos.reduce((suma, l) => suma + l.extra.priceCents * l.cantidad, 0)
  const duracion =
    service.durationMin + elegidos.reduce((suma, l) => suma + l.extra.durationMin * l.cantidad, 0)
  const tramoComun = `servicio=${service.id}${local && varios ? `&local=${local.id}` : ''}${
    staff ? `&persona=${staff.id}` : ''
  }${tramoExtras(elegidos.map((l) => ({ extraId: l.extra.id, quantity: l.cantidad })))}`
  const tieneCarta = business.extras.length > 0
  const volverA = tieneCarta ? `/${slug}/reservar/extras?${tramoComun}` : `/${slug}`
  const pasos = pasosReserva(tieneCarta)

  // Cambiar de persona o de local cambia los huecos: se empieza de nuevo.
  const irCon = (cambios: { local?: string; persona?: string }) => {
    setDia(null)
    setSlot(null)
    const l = cambios.local ?? (local && varios ? local.id : '')
    const p = cambios.persona ?? staff?.id ?? ''
    navigate(
      `/${slug}/reservar/fecha?servicio=${service.id}${l ? `&local=${l}` : ''}${
        p ? `&persona=${p}` : ''
      }${tramoExtras(pedidos)}`,
      { replace: true },
    )
  }

  const huecos = dia ? (porDia.get(dia)?.slots ?? []) : []
  const resumenCorto = dia
    ? `${service.name} · ${formatLongDate(fromDateKey(dia), idioma)}${slot ? ` · ${slot.label}` : ''}`
    : service.name

  return (
    <MarcoReserva
      negocio={business}
      servicio={service}
      pasos={pasos.map((p) => t(CLAVES_PASO[p]))}
      paso={pasos.indexOf('fecha')}
      volverA={volverA}
      salirA={`/${slug}`}
      resumenCorto={resumenCorto}
      total={total}
      fotos={{ fotosDe, visor }}
      resumen={
        <ResumenReserva
          servicio={service}
          elegidos={elegidos}
          persona={staff}
          local={varios ? local : null}
          cuando={slot?.startsAt}
          duracionMin={duracion}
          urlServicio={`/${slug}`}
          urlExtras={tieneCarta ? `/${slug}/reservar/extras?${tramoComun}` : undefined}
          tieneCarta={tieneCarta}
        />
      }
      accion={
        <Button
          size="lg"
          disabled={!slot}
          onClick={() =>
            slot &&
            navigate(
              `/${slug}/reservar/confirmar?${tramoComun}&hora=${encodeURIComponent(slot.startsAt)}`,
            )
          }
        >
          {slot ? t('fecha.continuar') : t('fecha.eligeHora')}
        </Button>
      }
    >
      <h1 className="mb-5 text-title font-semibold text-ink">{t('fecha.titulo')}</h1>

      <div className="flex max-w-[640px] flex-col gap-5">
        {varios && (
          <label className="block">
            <span className="mb-1.5 block text-meta font-semibold text-body-2">
              {t('fecha.local')}
            </span>
            <Select value={local?.id ?? ''} onChange={(e) => irCon({ local: e.target.value })}>
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.street}
                </option>
              ))}
            </Select>
          </label>
        )}

        {variosPersonal && (
          <SelectorProfesional
            personas={personal}
            valor={staff?.id ?? ''}
            onCambiar={(id) => irCon({ persona: id })}
            etiqueta={t('fecha.conQuien')}
            sinPreferencia={t('fecha.sinPreferencia')}
          />
        )}

        <section aria-labelledby="fecha-dia">
          <h2 id="fecha-dia" className="mb-1 text-meta font-semibold text-body-2">
            {t('fecha.eligeDia')}
          </h2>
          <p className="mb-3 text-meta text-muted">{t('fecha.eligeDiaPista')}</p>
          {
            <CalendarioMes
              mes={mes}
              onMes={(m) => {
                setMes(m)
                setDia(null)
                setSlot(null)
              }}
              dia={dia}
              onDia={(d) => {
                setDia(d)
                setSlot(null)
              }}
              estado={estado}
              minimo={hoy}
              maximo={maximo}
            />
          }
          <HuecosDelDia
            dia={dia}
            slots={huecos}
            valor={slot}
            onElegir={setSlot}
            cargando={cargandoMes}
            error={isError ? (error as Error).message : null}
          />
        </section>
      </div>
    </MarcoReserva>
  )
}
