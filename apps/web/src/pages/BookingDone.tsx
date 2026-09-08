import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatLongDate, formatPrice, type BookingDTO } from '@veline/shared'
import { api } from '../lib/api'
import { Button, ButtonLink, Card, ConfirmAction, EmptyState, Spinner } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { useIdioma, type Clave } from '../i18n/idioma'

const icsStamp = (iso: string) => `${iso.replace(/[-:]/g, '').split('.')[0]}Z`

/** Genera el .ics en el navegador — sin depender de Google Calendar.
    La descripción la lee el calendario de quien reserva, así que va en su
    idioma; el resto del archivo son campos del formato, no texto. */
function downloadIcs(b: BookingDTO, descripcion: string) {
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
    `DESCRIPTION:${descripcion}`,
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
  const { t, idioma, locale } = useIdioma()
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
        <EmptyState title={t('hecha.noEncontrada')} hint={t('hecha.noEncontradaPista')} />
      </div>
    )
  }

  const start = new Date(booking.startsAt)
  const cancelled = booking.status === 'CANCELADA'
  const time = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="mx-auto flex max-w-[1440px] justify-center px-6 py-16 lg:px-16 lg:py-20">
      <Reveal variant="zoom" className="w-full max-w-[460px]">
        <Card className="flex flex-col items-center p-9 text-center">
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
            {cancelled ? t('hecha.cancelada') : t('hecha.confirmada')}
          </h1>
          <p className="mt-2.5 max-w-[320px] text-sm leading-relaxed text-muted first-letter:uppercase">
            {cancelled
              ? t('hecha.canceladaTexto', { negocio: booking.business.name })
              : t('hecha.confirmadaTexto', {
                  fecha: formatLongDate(start, idioma),
                  hora: time,
                  negocio: booking.business.name,
                })}
          </p>

          <div className="my-7 w-full border-t border-line pt-5 text-left">
            {(
              [
                ['hecha.codigo', booking.code],
                ['confirmar.servicio', booking.service.name],
                ['confirmar.fecha', `${formatLongDate(start, idioma)}, ${time}`],
                ...(booking.staff ? [['hecha.teAtiende', booking.staff.name] as const] : []),
                ...(booking.location
                  ? [
                      [
                        'hecha.donde',
                        `${booking.location.street}, ${booking.location.city}`,
                      ] as const,
                    ]
                  : []),
                ['comun.total', formatPrice(booking.priceCents, idioma)],
              ] as [Clave, string][]
            ).map(([clave, value]) => (
              <div key={clave} className="mb-2.5 flex justify-between gap-4 text-meta">
                <span className="shrink-0 text-muted">{t(clave)}</span>
                <span className="text-right font-semibold text-ink first-letter:uppercase">
                  {value}
                </span>
              </div>
            ))}
          </div>

          {!cancelled && (
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => downloadIcs(booking, t('hecha.ics', { codigo: booking.code }))}
              >
                {t('hecha.anadirCalendario')}
              </Button>
              <ButtonLink to="/" className="flex-1">
                {t('hecha.volverInicio')}
              </ButtonLink>
            </div>
          )}

          {cancelled && (
            <ButtonLink to={`/${booking.business.slug}`} className="w-full">
              {t('hecha.reservarOtra')}
            </ButtonLink>
          )}

          {!cancelled && (
            <div className="mt-5">
              <ConfirmAction
                label={t('hecha.cancelar')}
                question={t('hecha.seguro')}
                confirmLabel={t('hecha.siCancelar')}
                size="md"
                loading={cancel.isPending}
                onConfirm={() => cancel.mutate()}
              />
            </div>
          )}

          <p className="mt-6 text-meta text-subtle">
            {t('hecha.guardaEnlace')}{' '}
            <Link
              to={`/reserva/${booking.code}`}
              className="inline-flex min-h-9 items-center px-1 font-semibold text-brand-text"
            >
              /reserva/{booking.code}
            </Link>
          </p>
        </Card>
      </Reveal>
    </div>
  )
}
