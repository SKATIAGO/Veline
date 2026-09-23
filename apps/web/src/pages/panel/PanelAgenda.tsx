import { useId, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  formatDuration,
  formatLongDate,
  formatPrice,
  fromDateKey,
  monthLong,
  toDateKey,
  weekdayShort,
} from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { AvisoSuscripcion } from '../../components/AvisoSuscripcion'
import {
  Badge,
  Button,
  Card,
  Contador,
  EmptyState,
  ErrorNote,
  FilterChip,
  Field,
  Input,
  LogoMark,
  MAX_POR_EXTRA,
  PageHeader,
  Select,
  Sheet,
  Skeleton,
  Textarea,
  cx,
  useALaVista,
} from '../../components/ui'
import { Texto, useIdioma, usePlural, type Clave } from '../../i18n/idioma'

/* Marketplace, Instagram y Google son nombres propios: no se traducen. El
   único que es una palabra es «Directo». */
const SOURCE_LABEL: Record<string, string> = {
  MARKETPLACE: 'Marketplace',
  INSTAGRAM: 'Instagram',
  GOOGLE: 'Google',
}

/** Rangos que de verdad se miran: lo de hoy, la semana, y todo. */
const RANGOS = [
  { key: 'hoy', clave: 'agenda.hoy', dias: 0 },
  { key: 'semana', clave: 'agenda.proximos7', dias: 7 },
  { key: 'todo', clave: 'agenda.todo', dias: null },
] as const satisfies readonly { key: string; clave: Clave; dias: number | null }[]

type RangoKey = (typeof RANGOS)[number]['key']

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-meta font-medium text-muted">{label}</div>
      <div className="mt-1.5 font-display text-heading font-semibold text-ink">{value}</div>
      {hint && <div className="mt-1 text-meta text-subtle">{hint}</div>}
    </Card>
  )
}

/** Etiqueta y tono de cada estado, para no repetir el condicional. */
const ESTADO: Record<string, { clave: Clave; tone: 'off' | 'ok' | 'warn' } | undefined> = {
  CANCELADA: { clave: 'agenda.cancelada', tone: 'off' },
  COMPLETADA: { clave: 'agenda.atendida', tone: 'ok' },
  NO_ASISTIO: { clave: 'agenda.noVinoEstado', tone: 'warn' },
}

/** Fecha y hora en el formato que espera un <input type="datetime-local">. */
function paraInput(iso: string) {
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function BookingRow({ booking, slug }: { booking: PanelBooking; slug: string }) {
  const { t, idioma, locale } = useIdioma()
  const queryClient = useQueryClient()
  const [ficha, setFicha] = useState(false)
  const [moviendo, setMoviendo] = useState(false)
  const [nuevaHora, setNuevaHora] = useState(() => paraInput(booking.startsAt))
  // Casi siempre hace falta avisar; se puede destildar para el caso raro de
  // una corrección interna que el cliente ya conoce de otra forma.
  const [avisar, setAvisar] = useState(true)
  const [cancelando, setCancelando] = useState(false)
  // El cliente lo lee en su aviso de cancelación: contar el motivo, cuando lo
  // hay, es lo que evita que se quede sin saber por qué.
  const [motivoCancelar, setMotivoCancelar] = useState('')

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    queryClient.invalidateQueries({ queryKey: ['availability', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const cancel = useMutation({
    // Sin motivo escrito, no se manda nada: «Cancelada desde el panel» no es
    // una explicación, es una etiqueta interna, y no tiene sentido que el
    // cliente la lea como si lo fuera.
    mutationFn: () => api.cancelBooking(booking.code, motivoCancelar.trim() || undefined),
    onSuccess: () => {
      setCancelando(false)
      refrescar()
    },
  })

  const mover = useMutation({
    mutationFn: () =>
      api.rescheduleBooking(slug, booking.id, new Date(nuevaHora).toISOString(), avisar),
    onSuccess: () => {
      setMoviendo(false)
      refrescar()
    },
  })

  const marcar = useMutation({
    mutationFn: (status: 'COMPLETADA' | 'NO_ASISTIO' | 'CONFIRMADA') =>
      api.setBookingOutcome(slug, booking.id, status),
    onSuccess: refrescar,
  })

  const start = new Date(booking.startsAt)
  const end = new Date(booking.endsAt)
  const fmt = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  /* «Directo» es la única fuente que es una palabra y no un nombre propio. */
  const origen =
    SOURCE_LABEL[booking.source] ??
    (booking.source === 'DIRECTO' ? t('agenda.origenDirecto') : booking.source)
  const nombrePila = booking.customer.name.split(' ')[0] ?? booking.customer.name
  const cancelled = booking.status === 'CANCELADA'
  const cerrada = booking.status === 'COMPLETADA' || booking.status === 'NO_ASISTIO'
  const estado = ESTADO[booking.status]
  const yaPaso = start.getTime() < Date.now()

  const error =
    (cancel.error as Error | null) ??
    (mover.error as Error | null) ??
    (marcar.error as Error | null)

  const abrirFicha = () => setFicha(true)
  const cerrarFicha = () => {
    setFicha(false)
    setMoviendo(false)
    setCancelando(false)
  }
  /* Tras actuar, la ficha se cierra sola: dejarla abierta obliga a un toque
     de más y esconde la lista, que es donde se ve el resultado. */
  const alTerminar = { onSuccess: () => cerrarFicha() }

  const formularioMover = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        mover.mutate(undefined, alTerminar)
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-body-2">{t('agenda.nuevaFechaHora')}</span>
        <Input
          type="datetime-local"
          value={nuevaHora}
          onChange={(e) => setNuevaHora(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-1.5 text-meta text-body-2">
        <input
          type="checkbox"
          checked={avisar}
          onChange={(e) => setAvisar(e.target.checked)}
          className="size-3.5 accent-brand"
        />
        {t('agenda.avisarCambio')}
      </label>
      <div className="flex gap-2">
        <Button type="submit" loading={mover.isPending} block>
          {t('agenda.moverLaCita')}
        </Button>
        <Button type="button" variant="quiet" onClick={() => setMoviendo(false)}>
          {t('agenda.dejarlo')}
        </Button>
      </div>
    </form>
  )

  const formularioCancelar = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        cancel.mutate(undefined, alTerminar)
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-meta text-body-2">{t('agenda.cancelarLaDe', { nombre: nombrePila })}</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-body-2">
          {t('agenda.motivoCancelar')}{' '}
          <span className="font-normal text-subtle">{t('comun.opcional')}</span>
        </span>
        <Textarea
          rows={2}
          value={motivoCancelar}
          onChange={(e) => setMotivoCancelar(e.target.value)}
        />
        <span className="text-meta text-subtle">{t('agenda.motivoCancelarPista')}</span>
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" loading={cancel.isPending} block>
          {t('agenda.siCancelar')}
        </Button>
        <Button type="button" variant="quiet" onClick={() => setCancelando(false)}>
          {t('agenda.dejarlo')}
        </Button>
      </div>
    </form>
  )

  return (
    <li className="border-b border-line last:border-b-0">
      {/* ── Móvil: una línea por cita ──
          Antes cada cita ocupaba 211 px y con los contadores arriba cabían
          dos en la pantalla. Así caben seis, que es una jornada entera. */}
      <button
        type="button"
        onClick={abrirFicha}
        aria-label={t('agenda.citaDeALas', { nombre: booking.customer.name, hora: fmt(start) })}
        className={cx(
          'flex w-full items-center gap-3 px-4 py-3 text-left md:hidden',
          'transition-colors duration-200 active:bg-canvas',
          (cancelled || cerrada) && 'opacity-60',
        )}
      >
        <span
          className={cx(
            'w-[46px] shrink-0 font-display text-ui font-bold text-ink tabular-nums',
            cancelled && 'line-through',
          )}
        >
          {fmt(start)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-ink">
            {booking.service.name}
            {booking.extras.length > 0 && (
              <span className="font-normal text-muted">
                {' '}
                +{' '}
                {booking.extras
                  .map((e) => (e.quantity > 1 ? `${e.name} ×${e.quantity}` : e.name))
                  .join(', ')}
              </span>
            )}
          </span>
          <span className="block truncate text-meta text-muted">
            {booking.customer.name} · {formatPrice(booking.priceCents, idioma)}
          </span>
        </span>
        {estado ? (
          <Badge tone={estado.tone}>{t(estado.clave)}</Badge>
        ) : (
          <span aria-hidden className="text-ui text-subtle">
            ›
          </span>
        )}
      </button>

      {/* ── Escritorio: la fila detallada, con jerarquía en los botones ──
          Los cuatro eran del mismo peso y estaban a 4 px unos de otros, con
          «Vino» y «No vino» pegados. Ahora manda uno solo y lo irreversible
          va detrás de un filete. */}
      <div
        className={cx(
          'hidden flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 md:flex',
          (cancelled || cerrada) && 'opacity-60',
        )}
      >
        <div className="w-[92px] shrink-0">
          <div
            className={cx(
              'font-display text-subheading font-semibold text-ink tabular-nums',
              cancelled && 'line-through',
            )}
          >
            {fmt(start)}
          </div>
          <div className="text-meta text-subtle tabular-nums">
            {t('agenda.hasta', { hora: fmt(end) })}
          </div>
        </div>

        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui font-semibold text-ink">{booking.service.name}</span>
            {estado && <Badge tone={estado.tone}>{t(estado.clave)}</Badge>}
            {!estado && booking.isFirstFromMarketplace && (
              <Badge tone="ok">{t('agenda.clienteNuevo')}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-meta text-muted">
            {booking.customer.name} ·{' '}
            <a
              href={`tel:${booking.customer.phone}`}
              className="-my-1.5 inline-flex min-h-8 items-center rounded-lg px-1 py-1.5 hover:text-brand hover:underline"
            >
              {booking.customer.phone}
            </a>
          </p>
          {booking.extras.length > 0 && (
            <p className="mt-1 text-meta text-body-2">
              +{' '}
              {booking.extras
                .map((e) => (e.quantity > 1 ? `${e.name} ×${e.quantity}` : e.name))
                .join(', ')}
            </p>
          )}
          {booking.notes && <p className="mt-1 text-meta text-subtle italic">{booking.notes}</p>}
        </div>

        <div className="w-[130px] text-meta text-muted">
          {booking.staff?.name ?? t('agenda.sinAsignar')}
        </div>

        <div className="w-[104px] text-right">
          <div className="text-ui font-semibold text-ink tabular-nums">
            {formatPrice(booking.priceCents, idioma)}
          </div>
          <div className="text-caption text-subtle">{origen}</div>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {cerrada && (
            <Button
              size="sm"
              variant="secondary"
              loading={marcar.isPending}
              onClick={() => marcar.mutate('CONFIRMADA')}
            >
              {t('agenda.deshacer')}
            </Button>
          )}

          {!cancelled && !cerrada && (
            <>
              {/* Marcar si vino solo tiene sentido cuando la cita ya ha pasado. */}
              {yaPaso && (
                <>
                  <Button
                    size="sm"
                    loading={marcar.isPending && marcar.variables === 'COMPLETADA'}
                    onClick={() => marcar.mutate('COMPLETADA')}
                  >
                    {t('agenda.vino')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={marcar.isPending && marcar.variables === 'NO_ASISTIO'}
                    onClick={() => marcar.mutate('NO_ASISTIO')}
                  >
                    {t('agenda.noVino')}
                  </Button>
                </>
              )}
              <Button size="sm" variant="quiet" onClick={() => setMoviendo((m) => !m)}>
                {t('agenda.mover')}
              </Button>
              <span className="ml-1 border-l border-line pl-2">
                <Button size="sm" variant="danger" onClick={() => setCancelando((c) => !c)}>
                  {t('agenda.cancelar')}
                </Button>
              </span>
            </>
          )}
        </div>
      </div>

      {moviendo && !ficha && (
        <div className="hidden border-t border-line bg-canvas/50 px-5 py-4 md:block">
          {formularioMover}
        </div>
      )}

      {cancelando && !ficha && (
        <div className="hidden border-t border-line bg-canvas/50 px-5 py-4 md:block">
          {formularioCancelar}
        </div>
      )}

      {error && !ficha && (
        <div className="px-4 pb-4 sm:px-5">
          <ErrorNote>{error.message}</ErrorNote>
        </div>
      )}

      {/* ── La ficha ──
          Aquí las acciones tienen 44 px de alto y 8 de separación, y cancelar
          vive detrás de un filete, en otro color y con confirmación. En la
          fila no cabía nada de eso. */}
      <Sheet
        open={ficha}
        onClose={cerrarFicha}
        title={t('agenda.citaDe', { nombre: booking.customer.name })}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-heading-sm font-semibold text-ink tabular-nums">
              {fmt(start)}
              <span className="ml-2 text-body font-normal text-muted">
                {formatDuration(Math.round((end.getTime() - start.getTime()) / 60000), idioma)}
              </span>
            </p>
            <p className="mt-1 text-ui font-semibold text-ink">{booking.service.name}</p>
            {booking.extras.map((e) => (
              <p key={e.name} className="mt-0.5 text-meta text-body-2">
                + {e.name}
                {e.quantity > 1 && ` ×${e.quantity}`}{' '}
                <span className="text-muted">{formatPrice(e.priceCents * e.quantity, idioma)}</span>
              </p>
            ))}
          </div>
          <p className="shrink-0 text-ui font-bold text-ink tabular-nums">
            {formatPrice(booking.priceCents, idioma)}
          </p>
        </div>

        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-body">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t('agenda.cliente')}</dt>
            <dd className="text-right font-medium text-ink">{booking.customer.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">{t('agenda.telefono')}</dt>
            <dd>
              <a
                href={`tel:${booking.customer.phone}`}
                className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-brand-text hover:underline"
              >
                {booking.customer.phone}
              </a>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t('agenda.atiende')}</dt>
            <dd className="text-right font-medium text-ink">
              {booking.staff?.name ?? t('agenda.sinAsignar')}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t('agenda.origen')}</dt>
            <dd className="text-right font-medium text-ink">{origen}</dd>
          </div>
          {booking.notes && (
            <div className="mt-1 rounded-xl bg-canvas px-3 py-2.5">
              <dt className="text-meta text-muted">{t('agenda.notas')}</dt>
              <dd className="mt-0.5 text-body text-ink italic">{booking.notes}</dd>
            </div>
          )}
        </dl>

        {error && (
          <div className="mt-4">
            <ErrorNote>{error.message}</ErrorNote>
          </div>
        )}

        {estado && (
          <p className="mt-4 flex items-center gap-2 text-body text-muted">
            {t('agenda.marcadaComo')} <Badge tone={estado.tone}>{t(estado.clave)}</Badge>
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {cerrada && (
            <Button
              variant="secondary"
              block
              loading={marcar.isPending}
              onClick={() => marcar.mutate('CONFIRMADA', alTerminar)}
            >
              {t('agenda.deshacer')}
            </Button>
          )}

          {!cancelled && !cerrada && (
            <>
              {moviendo ? (
                formularioMover
              ) : cancelando ? (
                formularioCancelar
              ) : (
                <>
                  {yaPaso && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        loading={marcar.isPending && marcar.variables === 'COMPLETADA'}
                        onClick={() => marcar.mutate('COMPLETADA', alTerminar)}
                      >
                        {t('agenda.vino')}
                      </Button>
                      <Button
                        variant="secondary"
                        loading={marcar.isPending && marcar.variables === 'NO_ASISTIO'}
                        onClick={() => marcar.mutate('NO_ASISTIO', alTerminar)}
                      >
                        {t('agenda.noVino')}
                      </Button>
                    </div>
                  )}
                  <Button variant="secondary" block onClick={() => setMoviendo(true)}>
                    {t('agenda.moverDeHora')}
                  </Button>
                  <div className="mt-2 flex justify-center border-t border-line pt-4">
                    <Button size="md" variant="danger" onClick={() => setCancelando(true)}>
                      {t('agenda.cancelarLaCita')}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Sheet>
    </li>
  )
}

/**
 * La cita que entra por teléfono o por la puerta. Sin esto, el negocio tenía
 * que reservarse a sí mismo desde su página pública como si fuera un cliente.
 */
function NuevaCita({ slug, onHecho }: { slug: string; onHecho: () => void }) {
  const { t, idioma } = useIdioma()
  const id = useId()
  const [serviceId, setServiceId] = useState('')
  const [cuando, setCuando] = useState(() => paraInput(new Date().toISOString()))
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [staffId, setStaffId] = useState('')

  const { data: servicios } = useQuery({
    queryKey: ['panel', slug, 'services'],
    queryFn: () => api.panelServices(slug),
  })

  // La misma carta que ve el cliente al reservar por la web.
  const { data: extras } = useQuery({
    queryKey: ['panel', slug, 'extras'],
    queryFn: () => api.panelExtras(slug),
  })

  const { data: personas } = useQuery({
    queryKey: ['panel', slug, 'staff'],
    queryFn: () => api.panelStaff(slug),
  })
  const personalActivo = personas?.filter((p) => p.active) ?? []

  const activos = servicios?.filter((s) => s.active) ?? []
  const elegido = serviceId || activos[0]?.id || ''
  const carta = extras?.filter((e) => e.active) ?? []
  const extrasElegidos = carta
    .map((extra) => ({ extra, cantidad: cantidades[extra.id] ?? 0 }))
    .filter((linea) => linea.cantidad > 0)
  const servicioElegido = activos.find((s) => s.id === elegido)
  const total =
    (servicioElegido?.priceCents ?? 0) +
    extrasElegidos.reduce((suma, l) => suma + l.extra.priceCents * l.cantidad, 0)
  /* Lo que va a ocupar en la agenda. El mostrador lo necesita a la vista: es
     lo que decide si la siguiente cita entra a las y media o a menos cuarto. */
  const duracion =
    (servicioElegido?.durationMin ?? 0) +
    extrasElegidos.reduce((suma, l) => suma + l.extra.durationMin * l.cantidad, 0)

  const crear = useMutation({
    mutationFn: () =>
      api.createManualBooking(slug, {
        serviceId: elegido,
        startsAt: new Date(cuando).toISOString(),
        customerName: nombre.trim(),
        customerPhone: telefono.trim(),
        customerEmail: email.trim() || undefined,
        notes: notas.trim() || undefined,
        extras: extrasElegidos.map((l) => ({ extraId: l.extra.id, quantity: l.cantidad })),
        staffId: staffId || undefined,
      }),
    onSuccess: onHecho,
  })

  const problema = !elegido
    ? t('agenda.faltaServicio')
    : nombre.trim().length < 2
      ? t('agenda.faltaNombre')
      : telefono.trim().length < 9
        ? t('agenda.faltaTelefono')
        : null

  return (
    <Card padded>
      <h2 className="mb-4 text-ui font-semibold text-ink">{t('agenda.apuntarTitulo')}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!problema) crear.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('agenda.servicio')} htmlFor={`${id}-svc`} required>
            <Select id={`${id}-svc`} value={elegido} onChange={(e) => setServiceId(e.target.value)}>
              {activos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMin, idioma)} ·{' '}
                  {formatPrice(s.priceCents, idioma)}
                </option>
              ))}
            </Select>
          </Field>

          {/* Con más de una persona, quién la va a atender: por teléfono o en
              el mostrador es tan normal preguntarlo como la hora. Con una
              sola no hay nada que elegir. */}
          {personalActivo.length > 1 && (
            <Field label={t('agenda.conQuien')} htmlFor={`${id}-staff`}>
              <Select
                id={`${id}-staff`}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
              >
                <option value="">{t('agenda.sinPreferencia')}</option>
                {personalActivo.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label={t('agenda.cuando')} htmlFor={`${id}-cuando`} required>
            <Input
              id={`${id}-cuando`}
              type="datetime-local"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
            />
          </Field>

          <Field label={t('agenda.cliente')} htmlFor={`${id}-nombre`} required>
            <Input
              id={`${id}-nombre`}
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>

          <Field label={t('agenda.telefono')} htmlFor={`${id}-tel`} required>
            <Input
              id={`${id}-tel`}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </Field>

          <Field
            label={t('agenda.email')}
            htmlFor={`${id}-mail`}
            hint={t('agenda.emailPista')}
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-mail`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label={t('agenda.notas')} htmlFor={`${id}-notas`} className="sm:col-span-2">
            <Input id={`${id}-notas`} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </Field>

          {carta.length > 0 && (
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-meta font-semibold text-body-2">
                {t('comun.extras')}{' '}
                <span className="font-normal text-subtle">{t('comun.opcional')}</span>
              </legend>
              {/* En filas y no en píldoras: cada extra necesita su contador
                  al lado, y una píldora con tres controles dentro no se
                  acierta con el dedo en el mostrador. */}
              <div className="flex flex-col gap-2">
                {carta.map((e) => {
                  const cantidad = cantidades[e.id] ?? 0
                  return (
                    <div
                      key={e.id}
                      className={cx(
                        'flex items-center gap-3 rounded-lg border px-3 py-2',
                        'transition-colors duration-200',
                        cantidad > 0 ? 'border-brand bg-brand/5' : 'border-line bg-surface',
                      )}
                    >
                      <span className="min-w-0 flex-1 text-meta font-semibold text-body-2">
                        {e.name}
                      </span>
                      <span className="shrink-0 text-right text-meta text-muted tabular-nums">
                        +{formatPrice(e.priceCents * Math.max(cantidad, 1), idioma)}
                        {e.durationMin > 0 && (
                          <span className="block">
                            +{formatDuration(e.durationMin * Math.max(cantidad, 1), idioma)}
                          </span>
                        )}
                      </span>
                      <Contador
                        compacto
                        cantidad={cantidad}
                        nombre={e.name}
                        onCambiar={(n) =>
                          setCantidades((previas) => ({
                            ...previas,
                            [e.id]: Math.max(0, Math.min(n, MAX_POR_EXTRA)),
                          }))
                        }
                      />
                    </div>
                  )
                })}
              </div>
              {extrasElegidos.length > 0 && (
                <p className="mt-2 text-meta text-muted">
                  {t('comun.total')}:{' '}
                  <strong className="font-semibold text-ink">{formatPrice(total, idioma)}</strong>
                  {' · '}
                  <strong className="font-semibold text-ink">
                    {formatDuration(duracion, idioma)}
                  </strong>
                </p>
              )}
            </fieldset>
          )}
        </div>

        {crear.isError && <ErrorNote>{(crear.error as Error).message}</ErrorNote>}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={crear.isPending} disabled={!!problema}>
            {t('agenda.apuntarBoton')}
          </Button>
          <Button type="button" variant="secondary" onClick={onHecho}>
            {t('agenda.cancelar')}
          </Button>
          {problema && <span className="text-meta text-muted">{problema}</span>}
        </div>
      </form>

      <p className="mt-4 border-t border-line pt-4 text-meta text-subtle">
        <Texto
          clave="agenda.avisoDirecta"
          partes={{
            directa: <strong className="font-semibold text-body-2">{t('agenda.esDirecta')}</strong>,
          }}
        />
      </p>
    </Card>
  )
}

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
/** Lunes primero, como en el resto del producto. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7

/**
 * La vista de mes: una imagen general de cuándo hay citas, no un sustituto
 * de la lista. Un día se elige para ver sus citas debajo, con las mismas
 * filas de siempre — no hace falta una segunda forma de enseñar una cita.
 */
function CalendarioMensual({ slug }: { slug: string }) {
  const { t, idioma } = useIdioma()
  const plural = usePlural()
  const hoy = useMemo(() => new Date(), [])
  const [mes, setMes] = useState(() => startOfMonth(hoy))
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)

  const irAMes = (n: number) => {
    setMes((m) => addMonths(m, n))
    setDiaSeleccionado(null)
  }

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['panel', slug, 'bookings', 'mes', toDateKey(mes)],
    queryFn: () =>
      api.panelBookings(slug, { from: toDateKey(mes), to: toDateKey(endOfMonth(mes)) }),
  })

  const porDia = useMemo(() => {
    const map = new Map<string, PanelBooking[]>()
    for (const b of bookings ?? []) {
      const key = toDateKey(new Date(b.startsAt))
      map.set(key, [...(map.get(key) ?? []), b])
    }
    return map
  }, [bookings])

  const daysInMonth = endOfMonth(mes).getDate()
  const leading = mondayIndex(mes)
  const cells: (Date | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1),
    ),
  ]

  const hoyKey = toDateKey(hoy)
  const citasDelDia = diaSeleccionado ? (porDia.get(diaSeleccionado) ?? []) : []

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 bg-brand px-4 py-3.5 text-white sm:px-5">
          <div className="flex items-center gap-2.5">
            <LogoMark size={18} variant="dark" />
            <h3 className="font-display text-ui font-semibold capitalize sm:text-subheading">
              {monthLong(mes.getMonth(), idioma)} {mes.getFullYear()}
            </h3>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={t('fecha.mesAnterior')}
              onClick={() => irAMes(-1)}
              className="flex size-8 items-center justify-center rounded-full text-subheading leading-none text-white/90 transition-colors hover:bg-white/15 sm:size-9"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={t('fecha.mesSiguiente')}
              onClick={() => irAMes(1)}
              className="flex size-8 items-center justify-center rounded-full text-subheading leading-none text-white/90 transition-colors hover:bg-white/15 sm:size-9"
            >
              ›
            </button>
          </div>
        </div>

        <div className="bg-cream p-3 sm:p-4">
          <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
              <div
                key={wd}
                className="text-center text-caption font-semibold text-brand-text uppercase"
              >
                {weekdayShort(wd, idioma)}
              </div>
            ))}
          </div>

          {isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {cells.map((d, i) => {
                if (!d) return <div key={`vacio-${i}`} />
                const key = toDateKey(d)
                const citas = porDia.get(key) ?? []
                const activo = key === diaSeleccionado
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDiaSeleccionado(activo ? null : key)}
                    aria-label={
                      citas.length
                        ? `${formatLongDate(d, idioma)}: ${plural(citas.length, 'agenda.unaCitaDia', 'agenda.variasCitasDia')}`
                        : formatLongDate(d, idioma)
                    }
                    className={cx(
                      'flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors sm:h-16',
                      activo
                        ? 'border-brand bg-brand text-white'
                        : 'border-line bg-surface hover:border-brand',
                      key === hoyKey && !activo && 'ring-1 ring-inset ring-brand/50',
                    )}
                  >
                    <span
                      className={cx(
                        'text-ui font-semibold',
                        activo ? 'text-white' : 'text-brand-text',
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {citas.length > 0 && (
                      <span
                        aria-hidden
                        className={cx(
                          'text-caption font-medium',
                          activo ? 'text-white/85' : 'text-subtle',
                        )}
                      >
                        {citas.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {!isLoading &&
        (diaSeleccionado ? (
          citasDelDia.length === 0 ? (
            <EmptyState title={t('agenda.sinCitasEseDia')} />
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-meta font-semibold tracking-[0.04em] text-muted uppercase">
                {formatLongDate(fromDateKey(diaSeleccionado), idioma)}
              </h3>
              <Card className="overflow-hidden">
                <ul>
                  {citasDelDia.map((b) => (
                    <BookingRow key={b.id} booking={b} slug={slug} />
                  ))}
                </ul>
              </Card>
            </div>
          )
        ) : (
          <p className="text-meta text-subtle">{t('agenda.tocaUnDia')}</p>
        ))}
    </div>
  )
}

export function PanelAgenda() {
  const { t, idioma } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [rango, setRango] = useState<RangoKey>('hoy')
  const [vista, setVista] = useState<'lista' | 'mes'>('lista')

  /* El botón central de la barra de móvil abre el formulario desde otra
     pantalla, así que el estado vive en la URL y no en este componente. De
     paso, «apuntar una cita» pasa a ser un enlace que se puede guardar. */
  const apuntando = params.get('nueva') === '1'
  const setApuntando = (abierto: boolean) => {
    setParams(
      (prev) => {
        const siguiente = new URLSearchParams(prev)
        if (abierto) siguiente.set('nueva', '1')
        else siguiente.delete('nueva')
        return siguiente
      },
      { replace: true },
    )
  }
  const vistaNueva = useALaVista<HTMLDivElement>(apuntando)
  const queryClient = useQueryClient()

  const { data: summary } = useQuery({
    queryKey: ['panel', slug, 'summary'],
    queryFn: () => api.panelSummary(slug),
  })

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['panel', slug, 'bookings'],
    queryFn: () => api.panelBookings(slug),
  })

  /* El filtro se aplica en el cliente porque la consulta ya trae los próximos
     14 días: pedir de nuevo al servidor para acortar la lista sería un viaje
     de ida y vuelta para no traer nada nuevo. */
  const grupos = useMemo(() => {
    const dias = RANGOS.find((r) => r.key === rango)?.dias
    const hoy = toDateKey(new Date())
    const limite =
      dias === null || dias === undefined
        ? null
        : toDateKey(new Date(Date.now() + dias * 86_400_000))

    const map = new Map<string, PanelBooking[]>()
    for (const b of bookings ?? []) {
      const key = toDateKey(new Date(b.startsAt))
      if (key < hoy) continue
      if (limite && key > limite) continue
      map.set(key, [...(map.get(key) ?? []), b])
    }
    return [...map.entries()]
  }, [bookings, rango])

  const total = grupos.reduce((n, [, filas]) => n + filas.length, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* El marco ya dice en qué negocio estás —en el menú lateral y en la
          cabecera del móvil—, así que repetirlo aquí gastaba una línea para
          no decir nada. El título es la pantalla, no el negocio. */}
      <PageHeader
        title={t('panel.agenda')}
        hint={
          // Dos plurales sueltos y no una frase con dos huecos: «1 personas»
          // era lo que salía antes, y en inglés «1 people» sería lo mismo.
          summary
            ? [
                plural(summary.serviceCount, 'agenda.unServicio', 'agenda.variosServicios'),
                plural(summary.staffCount, 'agenda.unaPersona', 'agenda.variasPersonas'),
              ].join(' · ')
            : undefined
        }
        actions={
          !apuntando && <Button onClick={() => setApuntando(true)}>{t('agenda.apuntarUna')}</Button>
        }
      />

      <AvisoSuscripcion sub={summary?.subscription ?? null} />

      {apuntando && (
        <div ref={vistaNueva} className="scroll-mt-4">
          <NuevaCita
            slug={slug}
            onHecho={() => {
              setApuntando(false)
              queryClient.invalidateQueries({ queryKey: ['panel', slug] })
              queryClient.invalidateQueries({ queryKey: ['availability', slug] })
            }}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('agenda.citasHoy')} value={String(summary?.todayCount ?? 0)} />
        <Stat label={t('agenda.proximos7')} value={String(summary?.weekCount ?? 0)} />
        <Stat
          label={t('agenda.ingresos7')}
          value={formatPrice(summary?.weekRevenueCents ?? 0, idioma)}
          hint={
            summary?.weekCommissionCents
              ? t('agenda.comision', {
                  importe: formatPrice(summary.weekCommissionCents, idioma),
                })
              : t('agenda.sinComision')
          }
        />
        <Stat
          label={t('agenda.clientesNuevos')}
          value={String(summary?.newFromMarketplace ?? 0)}
          hint={t('agenda.viaMarketplace')}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-subheading font-semibold text-ink">
          {t('agenda.proximasCitas')}
          {vista === 'lista' && !isLoading && total > 0 && (
            <span className="ml-2 text-body font-normal text-muted">({total})</span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={vista === 'lista'} onClick={() => setVista('lista')}>
            {t('agenda.vistaLista')}
          </FilterChip>
          <FilterChip active={vista === 'mes'} onClick={() => setVista('mes')}>
            {t('agenda.vistaMes')}
          </FilterChip>
          {vista === 'lista' &&
            RANGOS.map((r) => (
              <FilterChip key={r.key} active={rango === r.key} onClick={() => setRango(r.key)}>
                {t(r.clave)}
              </FilterChip>
            ))}
        </div>
      </div>

      {vista === 'mes' ? (
        <CalendarioMensual slug={slug} />
      ) : isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </Card>
      ) : grupos.length === 0 ? (
        <EmptyState
          title={rango === 'hoy' ? t('agenda.hoySinCitas') : t('agenda.sinCitasPeriodo')}
          hint={rango === 'todo' ? t('agenda.apareceránSolas') : t('agenda.ampliaPeriodo')}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map(([key, filas]) => (
            <section key={key}>
              <h3 className="mb-2 text-meta font-semibold tracking-[0.04em] text-muted uppercase">
                {formatLongDate(new Date(`${key}T00:00:00`), idioma)}
              </h3>
              <Card className="overflow-hidden">
                <ul>
                  {filas.map((b) => (
                    <BookingRow key={b.id} booking={b} slug={slug} />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
