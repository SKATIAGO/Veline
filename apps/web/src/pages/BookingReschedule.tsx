import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addDaysKey,
  formatLongDate,
  formatTimeMadrid,
  fromDateKey,
  hoyMadrid,
  madridDay,
  type DayAvailabilityDTO,
  type SlotDTO,
} from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { Button, EmptyState, ErrorNote, Spinner } from '../components/ui'
import { CalendarioMes, type EstadoDia } from '../components/CalendarioMes'
import { HuecosDelDia } from '../components/reserva/HuecosDelDia'
import { MarcoReserva } from '../components/reserva/MarcoReserva'
import { useIdioma } from '../i18n/idioma'

const DIAS_VISTA = 60
const primerDiaDelMes = (key: string) => `${key.slice(0, 7)}-01`
const ultimoDiaDelMes = (key: string) => {
  const d = fromDateKey(primerDiaDelMes(key))
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`
}

/**
 * Mover la propia cita a otra hora. A diferencia de reservar de cero, aquí no
 * se vuelve a elegir servicio, extras ni persona: solo cuándo. El servidor
 * asigna a quien quede libre, igual que el cambio de hora desde el panel.
 */
export function BookingReschedule() {
  const { t, idioma, locale } = useIdioma()
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const hoy = useMemo(() => hoyMadrid(), [])
  const maximo = addDaysKey(hoy, DIAS_VISTA)
  const [mes, setMes] = useState(() => primerDiaDelMes(hoy))
  const [diaElegido, setDia] = useState<string | null>(null)
  const [slot, setSlot] = useState<SlotDTO | null>(null)

  const { data: booking, isLoading: cargandoReserva } = useQuery({
    queryKey: ['booking', code],
    queryFn: () => api.getBooking(code),
  })

  const puedeMover = booking?.status === 'CONFIRMADA' && new Date(booking.startsAt) > new Date()
  const desde = mes > hoy ? mes : hoy
  const hasta = ultimoDiaDelMes(mes) < maximo ? ultimoDiaDelMes(mes) : maximo

  const {
    data: datosHuecos,
    isFetching,
    isPlaceholderData,
    isError,
    error,
  } = useQuery({
    queryKey: ['reschedule-availability', code, desde, hasta],
    queryFn: () => api.getRescheduleAvailability(code, { from: desde, to: hasta }),
    enabled: Boolean(puedeMover) && desde <= hasta,
    placeholderData: keepPreviousData,
  })
  const availability = isPlaceholderData ? undefined : datosHuecos
  const cargandoMes = isFetching && !availability

  const porDia = useMemo(() => {
    const map = new Map<string, DayAvailabilityDTO>()
    for (const d of availability ?? []) map.set(d.date, d)
    return map
  }, [availability])

  /* El día a la vista: el elegido o, si no, el primero con hueco del mes.
     Se calcula aquí y no en un efecto: con el efecto había un instante sin
     día («Elige un día») y la página saltaba dos veces al llegar las horas. */
  const dia =
    diaElegido ?? availability?.find((d) => d.slots.some((x) => x.available))?.date ?? null

  const mover = useMutation({
    mutationFn: () => api.rescheduleMyBooking(code, slot!.startsAt),
    onSuccess: (actualizada) => {
      queryClient.setQueryData(['booking', code], actualizada)
      navigate(`/reserva/${code}`, { state: { recien: true } })
    },
  })

  if (cargandoReserva) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }
  if (!booking) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
        <EmptyState title={t('hecha.noEncontrada')} hint={t('hecha.noEncontradaPista')} />
      </div>
    )
  }
  if (!puedeMover) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
        <EmptyState title={t('reprog.noSePuede')} hint={t('reprog.noSePuedePista')} />
      </div>
    )
  }

  const estado = (key: string): EstadoDia => {
    if (key < hoy || key > maximo) return 'fuera'
    if (cargandoMes) return 'cargando'
    const d = porDia.get(key)
    if (!d) return 'sinHueco'
    if (d.closed) return 'cerrado'
    return d.slots.some((s) => s.available) ? 'disponible' : 'sinHueco'
  }

  const start = new Date(booking.startsAt)
  const ahora = `${formatLongDate(madridDay(start), idioma)}, ${formatTimeMadrid(start, locale)}`
  const huecos = dia ? (porDia.get(dia)?.slots ?? []) : []
  const fila = 'flex items-center justify-between gap-3 text-body'

  return (
    <MarcoReserva
      negocio={{ name: booking.business.name, photos: [] }}
      servicio={{ name: booking.service.name, photos: [] }}
      volverA={`/reserva/${code}`}
      resumenCorto={
        slot && dia ? `${formatLongDate(fromDateKey(dia), idioma)} · ${slot.label}` : ahora
      }
      total={booking.priceCents}
      error={
        mover.isError ? (
          <ErrorNote>
            {mover.error instanceof ApiError ? mover.error.message : t('reprog.noSePudo')}
          </ErrorNote>
        ) : undefined
      }
      resumen={
        <dl className="flex flex-col gap-2">
          <div className={fila}>
            <dt className="text-muted">{t('confirmar.servicio')}</dt>
            <dd className="text-right font-semibold text-ink">{booking.service.name}</dd>
          </div>
          <div className={fila}>
            <dt className="text-muted">{t('confirmar.fecha')}</dt>
            <dd className="text-right font-semibold text-ink first-letter:uppercase">{ahora}</dd>
          </div>
          {slot && dia && (
            <div className={fila}>
              <dt className="text-muted">{t('reprog.titulo')}</dt>
              <dd className="text-right font-semibold text-brand-text first-letter:uppercase">
                {formatLongDate(fromDateKey(dia), idioma)}, {slot.label}
              </dd>
            </div>
          )}
        </dl>
      }
      accion={
        <Button
          size="lg"
          disabled={!slot}
          loading={mover.isPending}
          onClick={() => slot && mover.mutate()}
        >
          {slot ? t('reprog.confirmar') : t('fecha.eligeHora')}
        </Button>
      }
    >
      <h1 className="mb-1 text-title font-semibold text-ink">{t('reprog.titulo')}</h1>
      <p className="mb-5 text-body text-muted first-letter:uppercase">
        {t('reprog.ahora', {
          fecha: formatLongDate(madridDay(start), idioma),
          hora: formatTimeMadrid(start, locale),
        })}
      </p>

      <div className="max-w-[640px]">
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
      </div>
    </MarcoReserva>
  )
}
