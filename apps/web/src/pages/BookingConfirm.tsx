import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createBookingSchema, formatDuration, formatLongDate, formatPrice } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { extrasDeUrl, tramoExtras } from '../lib/reserva'
import { BackBar, Button, Card, ErrorNote, Spinner } from '../components/ui'
import { origenActual } from '../lib/origen'
import { Reveal } from '../components/Reveal'
import { useIdioma, type Clave } from '../i18n/idioma'

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  error?: string
  /** El «(opcional)» ya traducido; ausente si el campo es obligatorio. */
  optional?: string
  multiline?: boolean
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  optional,
  multiline,
}: FieldProps) {
  const cls =
    'w-full rounded-lg border bg-surface px-4 py-3.5 text-sm text-ink outline-none placeholder:text-subtle ' +
    (error ? 'border-danger' : 'border-line focus:border-brand')
  return (
    <label className="block">
      <span className="mb-1.5 block text-meta font-semibold text-body">
        {label}
        {optional && <span className="font-normal text-subtle"> {optional}</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cls}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {error && <span className="mt-1.5 block text-meta font-semibold text-danger">{error}</span>}
    </label>
  )
}

export function BookingConfirm() {
  const { t, idioma, locale } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const serviceId = params.get('servicio') ?? ''
  const startsAt = params.get('hora') ?? ''
  // Viene de la pantalla anterior. Con un solo local va vacío y el servidor
  // coge el único que hay.
  const locationId = params.get('local') ?? ''

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  // Elegidos en el primer paso de la reserva y arrastrados por la URL desde
  // allí. Aquí solo se enseñan y se cobran.
  const extraIds = extrasDeUrl(params)

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: () => api.getBusiness(slug),
  })

  const service = business?.services.find((s) => s.id === serviceId)

  /* La carta de extras es la misma para cualquier servicio. Solo cuentan los
     que siguen en ella: si el negocio quita uno mientras alguien reserva, al
     recargar deja de sumarse en vez de quedarse cobrado sin verse. */
  const carta = business?.extras ?? []
  const elegidos = carta.filter((e) => extraIds.includes(e.id))
  const tramoComun = `servicio=${serviceId}${locationId ? `&local=${locationId}` : ''}${tramoExtras(elegidos.map((e) => e.id))}`
  const urlFecha = `/${slug}/reservar/fecha?${tramoComun}`
  const urlExtras = `/${slug}/reservar/extras?${tramoComun}`

  const mutation = useMutation({
    mutationFn: () =>
      api.createBooking(slug, {
        serviceId,
        startsAt,
        customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
        notes: notes.trim(),
        source: origenActual(),
        // El idioma en el que está mirando esta persona ahora mismo. De aquí
        // saldrán su confirmación, su recordatorio y su petición de reseña.
        idioma,
        extraIds: elegidos.map((e) => e.id),
        ...(locationId ? { locationId } : {}),
      }),
    onSuccess: (booking) => navigate(`/reserva/${booking.code}`, { replace: true }),
  })

  if (!business || !service) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }

  const total = service.priceCents + elegidos.reduce((suma, e) => suma + e.priceCents, 0)
  /* Con extras que alargan, la duración del servicio a secas mentiría: es la
     hora que el cliente va a estar allí lo que tiene que ver aquí. */
  const duracion = service.durationMin + elegidos.reduce((suma, e) => suma + e.durationMin, 0)
  const start = new Date(startsAt)
  const validStart = !Number.isNaN(start.getTime())

  const submit = () => {
    const parsed = createBookingSchema.safeParse({
      serviceId,
      startsAt,
      customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
      notes: notes.trim(),
      source: origenActual(),
      idioma,
      extraIds: elegidos.map((e) => e.id),
      ...(locationId ? { locationId } : {}),
    })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      // El esquema dice QUÉ campo falla; el texto lo pone Veline, en el idioma
      // de quien está reservando. Los mensajes del esquema son los que ve el
      // servidor, y ese habla castellano.
      const POR_CAMPO: Record<string, Clave> = {
        name: 'confirmar.errNombre',
        phone: 'confirmar.errTelefono',
        email: 'confirmar.errEmail',
      }
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'customer' && typeof issue.path[1] === 'string') {
          const clave = POR_CAMPO[issue.path[1]]
          if (clave) next[issue.path[1]] = t(clave)
        }
      }
      setErrors(next)
      return
    }
    setErrors({})
    mutation.mutate()
  }

  return (
    <>
      <BackBar to={urlFecha}>
        {business.name} · {service.name}
      </BackBar>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 py-10 lg:flex-row lg:px-16">
        <Reveal variant="left" className="min-w-0 flex-[1.4]">
          <h1 className="mb-7 text-[24px] font-semibold text-ink">{t('confirmar.titulo')}</h1>

          <div className="flex max-w-[440px] flex-col gap-5">
            <Field
              label={t('confirmar.nombre')}
              value={name}
              onChange={setName}
              error={errors.name}
            />
            <Field
              label={t('confirmar.telefono')}
              value={phone}
              onChange={setPhone}
              type="tel"
              error={errors.phone}
            />
            <Field
              label={t('confirmar.email')}
              value={email}
              onChange={setEmail}
              type="email"
              optional={t('comun.opcional')}
              error={errors.email}
            />
            <Field
              label={t('confirmar.notas')}
              value={notes}
              onChange={setNotes}
              placeholder={t('confirmar.notasEjemplo')}
              optional={t('comun.opcional')}
              multiline
            />
          </div>

          <p className="mt-6 max-w-[440px] text-meta leading-relaxed text-muted">
            {t('confirmar.sinCuenta')}
          </p>
        </Reveal>

        <Reveal variant="right" delay={100} as="aside" className="w-full shrink-0 lg:w-[360px]">
          <Card className="p-6 lg:sticky lg:top-24">
            <div className="mb-4 font-display text-base font-semibold text-ink">
              {t('confirmar.resumen')}
            </div>
            {[
              { clave: 'confirmar.negocio', value: business.name },
              { clave: 'confirmar.servicio', value: service.name },
              {
                clave: 'confirmar.fecha',
                value: validStart
                  ? `${formatLongDate(start, idioma)}, ${start.toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : '—',
              },
              { clave: 'confirmar.duracion', value: formatDuration(duracion, idioma) },
            ].map((row) => (
              <div key={row.clave} className="mb-2.5 flex justify-between gap-4 text-body">
                <span className="shrink-0 text-muted">{t(row.clave as Clave)}</span>
                <span className="text-right font-semibold text-ink first-letter:uppercase">
                  {row.value}
                </span>
              </div>
            ))}

            {elegidos.map((e) => (
              <div key={e.id} className="mb-2.5 flex justify-between gap-4 text-body">
                <span className="min-w-0 text-muted">+ {e.name}</span>
                <span className="shrink-0 font-semibold text-ink tabular-nums">
                  {formatPrice(e.priceCents, idioma)}
                </span>
              </div>
            ))}

            {/* Cambiar de idea sin retroceder a ciegas: lleva a la carta con
                lo ya marcado puesto. */}
            {carta.length > 0 && (
              <Link
                to={urlExtras}
                className="mb-2.5 inline-block text-meta font-semibold text-brand-text underline"
              >
                {elegidos.length > 0 ? t('confirmar.extrasCambiar') : t('confirmar.extrasAnadir')}
              </Link>
            )}

            <div className="mt-4 mb-5 flex justify-between border-t border-line pt-4">
              <span className="text-sm text-muted">{t('comun.total')}</span>
              <span className="text-base font-semibold text-ink">{formatPrice(total, idioma)}</span>
            </div>

            {mutation.isError && (
              <div className="mb-4">
                <ErrorNote>
                  {(mutation.error as ApiError).message}
                  {(mutation.error as ApiError).status === 409 && (
                    <>
                      {' '}
                      <Link to={urlFecha} className="font-semibold text-brand-text underline">
                        {t('confirmar.eligeOtraHora')}
                      </Link>
                    </>
                  )}
                </ErrorNote>
              </div>
            )}

            <Button
              className="w-full"
              onClick={submit}
              disabled={mutation.isPending || !validStart}
            >
              {mutation.isPending ? t('confirmar.confirmando') : t('confirmar.confirmar')}
            </Button>
          </Card>
        </Reveal>
      </div>
    </>
  )
}
