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
} from '../../components/ui'

const SOURCE_LABEL: Record<string, string> = {
  MARKETPLACE: 'Marketplace',
  DIRECTO: 'Directo',
  INSTAGRAM: 'Instagram',
  GOOGLE: 'Google',
}

/** Rangos que de verdad se miran: lo de hoy, la semana, y todo. */
const RANGOS = [
  { key: 'hoy', label: 'Hoy', dias: 0 },
  { key: 'semana', label: 'Próximos 7 días', dias: 7 },
  { key: 'todo', label: 'Todo', dias: null },
] as const

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
const ESTADO: Record<string, { label: string; tone: 'off' | 'ok' | 'warn' } | undefined> = {
  CANCELADA: { label: 'Cancelada', tone: 'off' },
  COMPLETADA: { label: 'Atendida', tone: 'ok' },
  NO_ASISTIO: { label: 'No vino', tone: 'warn' },
}

/** Fecha y hora en el formato que espera un <input type="datetime-local">. */
function paraInput(iso: string) {
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function BookingRow({ booking, slug }: { booking: PanelBooking; slug: string }) {
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
  const fmt = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
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
        <span className="text-meta font-semibold text-body-2">Nueva fecha y hora</span>
        <Input
          type="datetime-local"
          value={nuevaHora}
          onChange={(e) => setNuevaHora(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" loading={mover.isPending} block>
          Mover la cita
        </Button>
        <Button type="button" variant="quiet" onClick={() => setMoviendo(false)}>
          Dejarlo
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
        aria-label={`Cita de ${booking.customer.name} a las ${fmt(start)}`}
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
            {booking.customer.name} · {formatPrice(booking.priceCents)}
          </span>
        </span>
        {estado ? (
          <Badge tone={estado.tone}>{estado.label}</Badge>
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
          <div className="text-meta text-subtle tabular-nums">hasta {fmt(end)}</div>
        </div>

        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ui font-semibold text-ink">{booking.service.name}</span>
            {estado && <Badge tone={estado.tone}>{estado.label}</Badge>}
            {!estado && booking.isFirstFromMarketplace && <Badge tone="ok">Cliente nuevo</Badge>}
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

        <div className="w-[130px] text-meta text-muted">{booking.staff?.name ?? 'Sin asignar'}</div>

        <div className="w-[104px] text-right">
          <div className="text-ui font-semibold text-ink tabular-nums">
            {formatPrice(booking.priceCents)}
          </div>
          <div className="text-caption text-subtle">
            {SOURCE_LABEL[booking.source] ?? booking.source}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {cerrada && (
            <Button
              size="sm"
              variant="secondary"
              loading={marcar.isPending}
              onClick={() => marcar.mutate('CONFIRMADA')}
            >
              Deshacer
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
                    Vino
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={marcar.isPending && marcar.variables === 'NO_ASISTIO'}
                    onClick={() => marcar.mutate('NO_ASISTIO')}
                  >
                    No vino
                  </Button>
                </>
              )}
              <Button size="sm" variant="quiet" onClick={() => setMoviendo((m) => !m)}>
                Mover
              </Button>
              <span className="ml-1 border-l border-line pl-2">
                <ConfirmAction
                  label="Cancelar"
                  question={`¿Cancelar la de ${booking.customer.name.split(' ')[0]}?`}
                  confirmLabel="Sí, cancelar"
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
      <Sheet open={ficha} onClose={cerrarFicha} title={`Cita de ${booking.customer.name}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-heading-sm font-semibold text-ink tabular-nums">
              {fmt(start)}
              <span className="ml-2 text-body font-normal text-muted">
                {formatDuration(Math.round((end.getTime() - start.getTime()) / 60000))}
              </span>
            </p>
            <p className="mt-1 text-ui font-semibold text-ink">{booking.service.name}</p>
          </div>
          <p className="shrink-0 text-ui font-bold text-ink tabular-nums">
            {formatPrice(booking.priceCents)}
          </p>
        </div>

        <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-body">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Cliente</dt>
            <dd className="text-right font-medium text-ink">{booking.customer.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Teléfono</dt>
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
            <dt className="text-muted">Atiende</dt>
            <dd className="text-right font-medium text-ink">
              {booking.staff?.name ?? 'Sin asignar'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Origen</dt>
            <dd className="text-right font-medium text-ink">
              {SOURCE_LABEL[booking.source] ?? booking.source}
            </dd>
          </div>
          {booking.notes && (
            <div className="mt-1 rounded-xl bg-canvas px-3 py-2.5">
              <dt className="text-meta text-muted">Notas</dt>
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
            Esta cita está marcada como <Badge tone={estado.tone}>{estado.label}</Badge>
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
              Deshacer
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
                        Vino
                      </Button>
                      <Button
                        variant="secondary"
                        loading={marcar.isPending && marcar.variables === 'NO_ASISTIO'}
                        onClick={() => marcar.mutate('NO_ASISTIO', alTerminar)}
                      >
                        No vino
                      </Button>
                    </div>
                  )}
                  <Button variant="secondary" block onClick={() => setMoviendo(true)}>
                    Mover de hora
                  </Button>
                  <div className="mt-2 flex justify-center border-t border-line pt-4">
                    <ConfirmAction
                      size="md"
                      label="Cancelar la cita"
                      question={`¿Cancelar la de ${booking.customer.name.split(' ')[0]}?`}
                      confirmLabel="Sí, cancelar"
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
    ? 'Primero hay que tener algún servicio publicado.'
    : nombre.trim().length < 2
      ? 'Escribe el nombre del cliente.'
      : telefono.trim().length < 9
        ? 'Falta el teléfono.'
        : null

  return (
    <Card padded>
      <h2 className="mb-4 text-ui font-semibold text-ink">Apuntar una cita</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!problema) crear.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Servicio" htmlFor={`${id}-svc`} required>
            <Select id={`${id}-svc`} value={elegido} onChange={(e) => setServiceId(e.target.value)}>
              {activos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMin)} · {formatPrice(s.priceCents)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Cuándo" htmlFor={`${id}-cuando`} required>
            <Input
              id={`${id}-cuando`}
              type="datetime-local"
              value={cuando}
              onChange={(e) => setCuando(e.target.value)}
            />
          </Field>

          <Field label="Cliente" htmlFor={`${id}-nombre`} required>
            <Input
              id={`${id}-nombre`}
              placeholder="Marina López"
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>

          <Field label="Teléfono" htmlFor={`${id}-tel`} required>
            <Input
              id={`${id}-tel`}
              placeholder="612 34 56 78"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </Field>

          <Field
            label="Email"
            htmlFor={`${id}-mail`}
            hint="Si lo pones, recibe la confirmación"
            className="sm:col-span-2"
          >
            <Input
              id={`${id}-mail`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Notas" htmlFor={`${id}-notas`} className="sm:col-span-2">
            <Input
              id={`${id}-notas`}
              placeholder="Llamó por teléfono"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Field>
        </div>

        {crear.isError && <ErrorNote>{(crear.error as Error).message}</ErrorNote>}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={crear.isPending} disabled={!!problema}>
            Apuntar la cita
          </Button>
          <Button type="button" variant="secondary" onClick={onHecho}>
            Cancelar
          </Button>
          {problema && <span className="text-meta text-muted">{problema}</span>}
        </div>
      </form>

      <p className="mt-4 border-t border-line pt-4 text-meta text-subtle">
        Una cita apuntada desde aquí cuenta como{' '}
        <strong className="font-semibold text-body-2">directa</strong>: la trajiste tú, así que no
        genera comisión de marketplace.
      </p>
    </Card>
  )
}

export function PanelAgenda() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [rango, setRango] = useState<RangoKey>('semana')

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
        title="Agenda"
        hint={
          summary ? `${summary.serviceCount} servicios · ${summary.staffCount} personas` : undefined
        }
        actions={
          !apuntando && <Button onClick={() => setApuntando(true)}>+ Apuntar una cita</Button>
        }
      />

      <AvisoSuscripcion sub={summary?.subscription ?? null} />

      {apuntando && (
        <NuevaCita
          slug={slug}
          onHecho={() => {
            setApuntando(false)
            queryClient.invalidateQueries({ queryKey: ['panel', slug] })
            queryClient.invalidateQueries({ queryKey: ['availability', slug] })
          }}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Citas hoy" value={String(summary?.todayCount ?? 0)} />
        <Stat label="Próximos 7 días" value={String(summary?.weekCount ?? 0)} />
        <Stat
          label="Ingresos 7 días"
          value={formatPrice(summary?.weekRevenueCents ?? 0)}
          hint={
            summary?.weekCommissionCents
              ? `Comisión Veline: ${formatPrice(summary.weekCommissionCents)}`
              : 'Sin comisión esta semana'
          }
        />
        <Stat
          label="Clientes nuevos"
          value={String(summary?.newFromMarketplace ?? 0)}
          hint="Descubiertos vía marketplace"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-subheading font-semibold text-ink">
          Próximas citas
          {!isLoading && total > 0 && (
            <span className="ml-2 text-body font-normal text-muted">({total})</span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          {RANGOS.map((r) => (
            <FilterChip key={r.key} active={rango === r.key} onClick={() => setRango(r.key)}>
              {r.label}
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
          title={rango === 'hoy' ? 'Hoy no hay citas' : 'No hay citas en este periodo'}
          hint={
            rango === 'todo'
              ? 'Cuando alguien reserve aparecerá aquí automáticamente.'
              : 'Prueba a ampliar el periodo con los filtros de arriba.'
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map(([key, filas]) => (
            <section key={key}>
              <h3 className="mb-2 text-meta font-semibold tracking-[0.04em] text-muted uppercase">
                {formatLongDate(new Date(`${key}T00:00:00`))}
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
