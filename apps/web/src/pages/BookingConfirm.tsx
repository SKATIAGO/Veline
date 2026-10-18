import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createBookingSchema, formatLongDate, formatTimeMadrid, madridDay } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { CLAVES_PASO, extrasDeUrl, pasosReserva, tramoExtras } from '../lib/reserva'
import { Button, ErrorNote, Spinner } from '../components/ui'
import { MarcoReserva } from '../components/reserva/MarcoReserva'
import { ResumenReserva } from '../components/reserva/ResumenReserva'
import { SinServicio } from '../components/reserva/SinServicio'
import { useFotosNegocio, useVisor } from '../lib/galeria'
import { origenActual } from '../lib/origen'
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
  autoComplete?: string
  inputMode?: 'tel' | 'email' | 'text'
}

/**
 * Un campo del formulario de la reserva.
 *
 * Lleva su `id` para poder enfocarlo desde fuera (al fallar la validación se
 * lleva al primer campo con error), su error enlazado con `aria-describedby`
 * y `aria-invalid`, y el `autocomplete` y el teclado que le corresponden: en
 * el móvil, que se ofrezcan los datos guardados es lo que más acorta este
 * paso, que es donde más gente se queda.
 */
function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  optional,
  multiline,
  autoComplete,
  inputMode,
}: FieldProps & { id: string }) {
  const cls =
    'w-full rounded-lg border bg-surface px-4 py-3 text-ui text-ink placeholder:text-subtle outline-none transition-[border-color,box-shadow] duration-200 focus:border-brand focus:ring-2 focus:ring-brand/25 ' +
    (error ? 'border-danger' : 'border-line')
  const errorId = `${id}-error`
  const comunes = {
    id,
    value,
    placeholder,
    autoComplete,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? errorId : undefined,
    className: cls,
  }
  return (
    <div className="block">
      <label htmlFor={id} className="mb-1.5 block text-meta font-semibold text-body-2">
        {label}
        {optional && <span className="font-normal text-subtle"> {optional}</span>}
      </label>
      {multiline ? (
        <textarea {...comunes} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <input
          {...comunes}
          type={type}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && (
        <span
          id={errorId}
          role="alert"
          className="mt-1.5 block text-meta font-semibold text-danger"
        >
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Último paso: los datos de quien reserva. El resumen de al lado ya lo dice
 * todo (servicio, extras, persona, fecha y hora) y cada cosa se puede cambiar
 * desde ahí sin retroceder a ciegas.
 */
export function BookingConfirm() {
  const { t, idioma, locale } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const serviceId = params.get('servicio') ?? ''
  const startsAt = params.get('hora') ?? ''
  const locationId = params.get('local') ?? ''
  const staffId = params.get('persona') ?? ''

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const pedidos = extrasDeUrl(params)

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: () => api.getBusiness(slug),
  })
  const fotosDe = useFotosNegocio()
  const visor = useVisor()

  const service = business?.services.find((s) => s.id === serviceId)
  const carta = business?.extras ?? []
  const elegidos = pedidos.flatMap((p) => {
    const extra = carta.find((e) => e.id === p.extraId)
    return extra ? [{ extra, cantidad: p.quantity }] : []
  })
  const aPedir = elegidos.map((l) => ({ extraId: l.extra.id, quantity: l.cantidad }))

  const datos = () => ({
    serviceId,
    startsAt,
    customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
    notes: notes.trim(),
    source: origenActual(),
    idioma,
    extras: aPedir,
    ...(locationId ? { locationId } : {}),
    ...(staffId ? { staffId } : {}),
  })

  const mutation = useMutation({
    mutationFn: () => api.createBooking(slug, datos()),
    onSuccess: (booking) =>
      navigate(`/reserva/${booking.code}`, { replace: true, state: { recien: true } }),
  })

  if (!business) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 lg:px-16">
        <Spinner />
      </div>
    )
  }
  if (!service) return <SinServicio slug={slug} />

  const staff = business.staff.find((p) => p.id === staffId)
  const locales = business.locations
  const local = locales.find((l) => l.id === locationId)
  const start = new Date(startsAt)
  const validStart = !Number.isNaN(start.getTime())
  const total =
    service.priceCents + elegidos.reduce((suma, l) => suma + l.extra.priceCents * l.cantidad, 0)
  const duracion =
    service.durationMin + elegidos.reduce((suma, l) => suma + l.extra.durationMin * l.cantidad, 0)
  const tramoComun = `servicio=${service.id}${locationId ? `&local=${locationId}` : ''}${
    staffId ? `&persona=${staffId}` : ''
  }${tramoExtras(aPedir)}`
  const urlFecha = `/${slug}/reservar/fecha?${tramoComun}`
  const urlExtras = `/${slug}/reservar/extras?${tramoComun}`
  const pasos = pasosReserva(carta.length > 0)

  const submit = () => {
    const parsed = createBookingSchema.safeParse(datos())
    if (!parsed.success) {
      const next: Record<string, string> = {}
      // El esquema dice QUÉ campo falla; el texto lo pone Veline, en el idioma
      // de quien está reservando.
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
      /* Al primer campo con error, a la vista y con el foco: el botón está
         abajo y los errores arriba. */
      const primero = (['name', 'phone', 'email'] as const).find((k) => next[k])
      if (primero) {
        setTimeout(() => {
          const el = document.getElementById(`confirmar-${primero}`)
          const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          el?.scrollIntoView({ block: 'center', behavior: sinMovimiento ? 'auto' : 'smooth' })
          el?.focus({ preventScroll: true })
        }, 0)
      }
      return
    }
    setErrors({})
    mutation.mutate()
  }

  const resumenCorto = validStart
    ? `${service.name} · ${formatLongDate(madridDay(start), idioma)} · ${formatTimeMadrid(start, locale)}`
    : service.name

  return (
    <MarcoReserva
      negocio={business}
      servicio={service}
      pasos={pasos.map((p) => t(CLAVES_PASO[p]))}
      paso={pasos.indexOf('datos')}
      volverA={urlFecha}
      salirA={`/${slug}`}
      resumenCorto={resumenCorto}
      total={total}
      fotos={{ fotosDe, visor }}
      resumen={
        <ResumenReserva
          servicio={service}
          elegidos={elegidos}
          persona={staff}
          local={locales.length > 1 ? local : null}
          cuando={validStart ? startsAt : null}
          duracionMin={duracion}
          urlServicio={`/${slug}`}
          urlExtras={carta.length > 0 ? urlExtras : undefined}
          urlFecha={urlFecha}
          tieneCarta={carta.length > 0}
        />
      }
      error={
        mutation.isError ? (
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
        ) : undefined
      }
      accion={
        <Button
          size="lg"
          type="submit"
          form="confirmar-form"
          loading={mutation.isPending}
          disabled={!validStart}
        >
          {mutation.isPending ? t('confirmar.confirmando') : t('confirmar.confirmar')}
        </Button>
      }
    >
      <h1 className="mb-6 text-title font-semibold text-ink">{t('confirmar.titulo')}</h1>

      <form
        id="confirmar-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!mutation.isPending) submit()
        }}
        className="flex max-w-[440px] flex-col gap-5"
      >
        <Field
          id="confirmar-name"
          label={t('confirmar.nombre')}
          value={name}
          onChange={setName}
          autoComplete="name"
          error={errors.name}
        />
        <Field
          id="confirmar-phone"
          label={t('confirmar.telefono')}
          value={phone}
          onChange={setPhone}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          error={errors.phone}
        />
        <Field
          id="confirmar-email"
          label={t('confirmar.email')}
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          inputMode="email"
          optional={t('comun.opcional')}
          error={errors.email}
        />
        <Field
          id="confirmar-notes"
          label={t('confirmar.notas')}
          value={notes}
          onChange={setNotes}
          placeholder={t('confirmar.notasEjemplo')}
          optional={t('comun.opcional')}
          multiline
        />
        <p className="text-meta leading-relaxed text-muted">{t('confirmar.sinCuenta')}</p>
      </form>
    </MarcoReserva>
  )
}
