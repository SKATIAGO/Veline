import { useId, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDuration, formatLongDate, formatPrice, toDateKey } from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { AvisoSuscripcion } from '../../components/AvisoSuscripcion'
import {
  Badge,
  Button,
  Card,
  ConfirmAction,
  EmptyState,
  ErrorNote,
  FilterChip,
  Field,
  Input,
  PageHeader,
  Select,
  Sheet,
  Skeleton,
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

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    queryClient.invalidateQueries({ queryKey: ['availability', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const cancel = useMutation({
    mutationFn: () => api.cancelBooking(booking.code, 'Cancelada desde el panel'),
    onSuccess: refrescar,
  })

  const mover = useMutation({
    mutationFn: () => api.rescheduleBooking(slug, booking.id, new Date(nuevaHora).toISOString()),
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
                <ConfirmAction
                  label={t('agenda.cancelar')}
                  question={t('agenda.cancelarLaDe', { nombre: nombrePila })}
                  confirmLabel={t('agenda.siCancelar')}
                  loading={cancel.isPending}
                  onConfirm={() => cancel.mutate()}
                />
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
                    <ConfirmAction
                      size="md"
                      label={t('agenda.cancelarLaCita')}
                      question={t('agenda.cancelarLaDe', { nombre: nombrePila })}
                      confirmLabel={t('agenda.siCancelar')}
                      loading={cancel.isPending}
                      onConfirm={() => cancel.mutate(undefined, alTerminar)}
                    />
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

  const { data: servicios } = useQuery({
    queryKey: ['panel', slug, 'services'],
    queryFn: () => api.panelServices(slug),
  })

  const activos = servicios?.filter((s) => s.active) ?? []
  const elegido = serviceId || activos[0]?.id || ''

  const crear = useMutation({
    mutationFn: () =>
      api.createManualBooking(slug, {
        serviceId: elegido,
        startsAt: new Date(cuando).toISOString(),
        customerName: nombre.trim(),
        customerPhone: telefono.trim(),
        customerEmail: email.trim() || undefined,
        notes: notas.trim() || undefined,
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
              placeholder={t('confirmar.nombreEjemplo')}
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>

          <Field label={t('agenda.telefono')} htmlFor={`${id}-tel`} required>
            <Input
              id={`${id}-tel`}
              placeholder="612 34 56 78"
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
            <Input
              id={`${id}-notas`}
              placeholder={t('agenda.notasEjemplo')}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Field>
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

export function PanelAgenda() {
  const { t, idioma } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [rango, setRango] = useState<RangoKey>('hoy')

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
          {!isLoading && total > 0 && (
            <span className="ml-2 text-body font-normal text-muted">({total})</span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          {RANGOS.map((r) => (
            <FilterChip key={r.key} active={rango === r.key} onClick={() => setRango(r.key)}>
              {t(r.clave)}
            </FilterChip>
          ))}
        </div>
      </div>

      {isLoading ? (
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
