import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatLongDate, formatPrice, type BookingDTO } from '@veline/shared'
import { api } from '../lib/api'
import { Button, ButtonLink, Card, EmptyState, Spinner } from '../components/ui'

const icsStamp = (iso: string) => `${iso.replace(/[-:]/g, '').split('.')[0]}Z`

/** Genera el .ics en el navegador — sin depender de Google Calendar. */
function downloadIcs(b: BookingDTO) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Veline//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${b.code}@veline.es`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(b.startsAt)}`,
    `DTEND:${icsStamp(b.endsAt)}`,
    `SUMMARY:${b.service.name} — ${b.business.name}`,
    b.location ? `LOCATION:${b.location.street}\\, ${b.location.city}` : '',
    `DESCRIPTION:Reserva ${b.code} en Veline`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `veline-${b.code}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

export function BookingDone() {
  const { code = '' } = useParams()
  const queryClient = useQueryClient()

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', code],
    queryFn: () => api.getBooking(code),
  })

  const cancel = useMutation({
    mutationFn: () => api.cancelBooking(code, 'Cancelada por el cliente'),
    onSuccess: (updated) => queryClient.setQueryData(['booking', code], updated),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
        <EmptyState title="No encontramos esa reserva" hint="Revisa el enlace o el código." />
      </div>
    )
  }

  const start = new Date(booking.startsAt)
  const cancelled = booking.status === 'CANCELADA'
  const time = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="mx-auto flex max-w-[1440px] justify-center px-6 py-16 lg:px-16 lg:py-20">
      <Card className="flex w-full max-w-[460px] flex-col items-center p-9 text-center">
        <div
          className={
            'mb-6 flex size-[72px] items-center justify-center rounded-full ' +
            (cancelled ? 'bg-fill' : 'veline-success bg-ink')
          }
        >
          {cancelled ? (
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <path
                d="M7 7L23 23M23 7L7 23"
                stroke="#8A7255"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="32" height="24" viewBox="0 0 34 26" fill="none" aria-hidden="true">
              <path
                d="M2 14L12 24L32 2"
                stroke="#D9A441"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="veline-check"
              />
            </svg>
          )}
        </div>

        <h1 className="text-[24px] font-semibold text-ink">
          {cancelled ? 'Reserva cancelada' : '¡Reserva confirmada!'}
        </h1>
        <p className="mt-2.5 max-w-[320px] text-sm leading-relaxed text-muted first-letter:uppercase">
          {cancelled
            ? `Hemos avisado a ${booking.business.name}. Puedes reservar otra hora cuando quieras.`
            : `Te esperan el ${formatLongDate(start)} a las ${time} en ${booking.business.name}.`}
        </p>

        <div className="my-7 w-full border-t border-line pt-5 text-left">
          {[
            ['Código', booking.code],
            ['Servicio', booking.service.name],
            ['Fecha', `${formatLongDate(start)}, ${time}`],
            ...(booking.staff ? [['Te atiende', booking.staff.name] as const] : []),
            ...(booking.location ? [['Dónde', `${booking.location.street}, ${booking.location.city}`] as const] : []),
            ['Total', formatPrice(booking.priceCents)],
          ].map(([label, value]) => (
            <div key={label} className="mb-2.5 flex justify-between gap-4 text-[13px]">
              <span className="shrink-0 text-muted">{label}</span>
              <span className="text-right font-semibold text-ink first-letter:uppercase">{value}</span>
            </div>
          ))}
        </div>

        {!cancelled && (
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button variant="ghost" className="flex-1" onClick={() => downloadIcs(booking)}>
              Añadir al calendario
            </Button>
            <ButtonLink to="/" className="flex-1">
              Volver al inicio
            </ButtonLink>
          </div>
        )}

        {cancelled && (
          <ButtonLink to={`/${booking.business.slug}`} className="w-full">
            Reservar otra hora
          </ButtonLink>
        )}

        {!cancelled && (
          <button
            type="button"
            onClick={() => {
              if (confirm('¿Seguro que quieres cancelar esta reserva?')) cancel.mutate()
            }}
            disabled={cancel.isPending}
            className="mt-5 text-[13px] font-medium text-muted underline hover:text-brand"
          >
            {cancel.isPending ? 'Cancelando…' : 'Cancelar la reserva'}
          </button>
        )}

        <p className="mt-6 text-[12px] text-subtle">
          Guarda este enlace para consultar o cancelar tu cita:{' '}
          <Link to={`/reserva/${booking.code}`} className="text-brand">
            /reserva/{booking.code}
          </Link>
        </p>
      </Card>
    </div>
  )
}
