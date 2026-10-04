import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDuration, formatLongDate, formatPrice, toDateKey } from '@veline/shared'
import { api, type PanelBooking } from '../../lib/api'
import { Badge, Button, ErrorNote, Sheet, Textarea, cx } from '../../components/ui'
import { useIdioma, type Clave } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'
import { SlotPicker } from '../../components/SlotPicker'

/* Marketplace, Instagram y Google son nombres propios: no se traducen. El
   único que es una palabra es «Directo». */
const SOURCE_LABEL: Record<string, string> = {
  MARKETPLACE: 'Marketplace',
  INSTAGRAM: 'Instagram',
  GOOGLE: 'Google',
}

/** Etiqueta y tono de cada estado, para no repetir el condicional. */
const ESTADO: Record<string, { clave: Clave; tone: 'off' | 'ok' | 'warn' } | undefined> = {
  CANCELADA: { clave: 'agenda.cancelada', tone: 'off' },
  COMPLETADA: { clave: 'agenda.atendida', tone: 'ok' },
  NO_ASISTIO: { clave: 'agenda.noVinoEstado', tone: 'warn' },
}

/** La fila de una cita, con su ficha, mover y cancelar. La usan la lista de
    Agenda y el día elegido en el calendario. */
export function BookingRow({ booking, slug }: { booking: PanelBooking; slug: string }) {
  const { t, idioma, locale } = useIdioma()
  const queryClient = useQueryClient()
  const [ficha, setFicha] = useState(false)
  const [moviendo, setMoviendo] = useState(false)
  const [nuevaHora, setNuevaHora] = useState<string | null>(null)
  const [nuevaPersona, setNuevaPersona] = useState(booking.staff?.id ?? '')
  const [sinCambio, setSinCambio] = useState(false)
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
      setFicha(false)
      setMotivoCancelar('')
      refrescar()
      aviso.ok(t('agenda.canceladaHecho', { nombre: booking.customer.name }))
    },
  })

  const mover = useMutation({
    mutationFn: () =>
      api.rescheduleBooking(
        slug,
        booking.id,
        // Sin hora nueva, solo cambia de persona: a la misma hora.
        nuevaHora ?? booking.startsAt,
        avisar,
        nuevaPersona || undefined,
      ),
    onSuccess: (r) => {
      setMoviendo(false)
      refrescar()
      const nueva = new Date(r.startsAt)
      const otraPersona = personas.find((p) => p.id === nuevaPersona && p.id !== booking.staff?.id)
      aviso.ok(
        otraPersona
          ? t(avisar ? 'mover.hechaConAvisada' : 'mover.hechaCon', {
              fecha: formatLongDate(nueva, idioma),
              hora: fmt(nueva),
              persona: otraPersona.name,
            })
          : t(avisar ? 'agenda.movidaAvisada' : 'agenda.movida', {
              fecha: formatLongDate(nueva, idioma),
              hora: fmt(nueva),
            }),
      )
    },
  })

  /* Vino / No vino van directos, como antes: se marcan a diario, uno detrás
     de otro, y una pregunta por cada uno sería un estorbo. A cambio, el aviso
     trae «Deshacer» por si se tocó el que no era. */
  const marcar = useMutation({
    mutationFn: (status: 'COMPLETADA' | 'NO_ASISTIO' | 'CONFIRMADA') =>
      api.setBookingOutcome(slug, booking.id, status),
    onSuccess: (_r, status) => {
      refrescar()
      if (status === 'CONFIRMADA') {
        aviso.ok(t('agenda.marcaQuitada'))
        return
      }
      aviso.ok(
        t(status === 'COMPLETADA' ? 'agenda.marcadaVino' : 'agenda.marcadaNoVino', {
          nombre: booking.customer.name,
        }),
        {
          texto: t('avisos.deshacer'),
          onClick: () =>
            api
              .setBookingOutcome(slug, booking.id, 'CONFIRMADA')
              .then(refrescar)
              .catch((e) => aviso.error(textoDeError(e, t('avisos.error')))),
        },
      )
    },
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

  // Los fallos al cancelar y al mover salen en su diálogo, no aquí.
  const error = marcar.error as Error | null

  const abrirFicha = () => setFicha(true)
  const cerrarFicha = () => {
    setFicha(false)
    setMoviendo(false)
  }
  const abrirMover = () => {
    mover.reset()
    setNuevaHora(null)
    setSinCambio(false)
    setNuevaPersona(booking.staff?.id ?? '')
    setMoviendo(true)
  }

  /* Con quién, para mover también de persona. Se pide solo al abrir «Mover»:
     la agenda tiene muchas filas y no hace falta para pintarlas. */
  const { data: carta } = useQuery({
    queryKey: ['panel', slug, 'agenda', 'carta'],
    queryFn: () => api.agendaCarta(slug),
    enabled: moviendo,
  })
  const personas = carta?.personas ?? []
  /* Tras actuar, la ficha se cierra sola: dejarla abierta obliga a un toque
     de más y esconde la lista, que es donde se ve el resultado. */
  const alTerminar = { onSuccess: () => cerrarFicha() }

  /* Mover, en su diálogo, con los huecos de verdad. Antes la hora nueva se
     escribía a mano y no se sabía si estaba libre hasta pulsar «Mover», ni se
     podía pasar la cita a otra persona: si alguien se ponía malo, había que
     cancelar y volver a apuntar. Los huecos no cuentan el de la propia cita,
     así que su hora actual sale libre: elegirla con otra persona es cambiar
     solo de persona. */
  const cambiaPersona = !!nuevaPersona && nuevaPersona !== (booking.staff?.id ?? '')
  const dialogoMover = (
    <FormDialog
      open={moviendo}
      onClose={() => {
        mover.reset()
        setMoviendo(false)
      }}
      title={t('agenda.moverTitulo', { nombre: booking.customer.name })}
      hint={t('agenda.moverPista', {
        fecha: formatLongDate(start, idioma),
        hora: fmt(start),
        servicio: booking.service.name,
      })}
      submitLabel={
        cambiaPersona && !nuevaHora ? t('mover.cambiarPersona') : t('agenda.moverLaCita')
      }
      onSubmit={() => {
        setSinCambio(!nuevaHora && !cambiaPersona)
        if (nuevaHora || cambiaPersona) mover.mutate(undefined, alTerminar)
      }}
      loading={mover.isPending}
      error={
        sinCambio && !nuevaHora && !cambiaPersona
          ? t('mover.eligeAlgo')
          : mover.isError
            ? textoDeError(mover.error, t('avisos.error'))
            : null
      }
      dirty={!!nuevaHora || cambiaPersona}
    >
      {personas.length > 1 && (
        <fieldset>
          <legend className="mb-2 text-meta font-semibold text-body-2">
            {t('agenda.conQuien')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={nuevaPersona === p.id}
                onClick={() => {
                  setNuevaPersona(p.id)
                  setNuevaHora(null)
                }}
                className={cx(
                  'inline-flex min-h-10 items-center rounded-xl border px-3.5 text-[14px] font-semibold transition-colors duration-200',
                  nuevaPersona === p.id
                    ? 'border-brand bg-brand/5 text-ink'
                    : 'border-line bg-surface text-body-2 hover:border-line-strong',
                )}
              >
                {p.name}
                {p.id === booking.staff?.id && (
                  <span className="ml-1.5 font-normal text-muted">{t('mover.ahora')}</span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {moviendo && (
        <SlotPicker
          slug={slug}
          consulta={{ bookingId: booking.id, staffId: nuevaPersona || undefined }}
          valor={nuevaHora}
          onElegir={setNuevaHora}
          diaInicial={toDateKey(start) >= toDateKey(new Date()) ? toDateKey(start) : undefined}
        />
      )}
      {!nuevaHora && cambiaPersona && (
        <p className="text-meta text-muted">{t('mover.mismaHora', { hora: fmt(start) })}</p>
      )}
      <label className="flex min-h-11 items-center gap-2 text-body text-body-2">
        <input
          type="checkbox"
          checked={avisar}
          onChange={(e) => setAvisar(e.target.checked)}
          className="size-4 accent-brand"
        />
        {t('agenda.avisarCambio')}
      </label>
    </FormDialog>
  )

  /* Cancelar es lo único de la cita que no se deshace y que le llega al
     cliente: va en una confirmación que lo dice, con el motivo dentro. Antes
     era un formulario que se abría en la fila o en la ficha. */
  const confirmarCancelacion = (
    <ConfirmDialog
      open={cancelando}
      onClose={() => {
        cancel.reset()
        setCancelando(false)
      }}
      title={t('agenda.cancelarTitulo', { nombre: booking.customer.name })}
      consecuencias={[
        t('agenda.cancelarC1', { fecha: formatLongDate(start, idioma), hora: fmt(start) }),
        // Una cita que ya ha pasado no avisa a nadie (ver avisarCancelacion).
        ...(yaPaso
          ? []
          : [
              t(booking.customer.email ? 'agenda.cancelarAvisoConCorreo' : 'agenda.cancelarAviso', {
                nombre: nombrePila,
              }),
            ]),
        t('agenda.cancelarC3'),
      ]}
      confirmLabel={t('agenda.cancelarLaCita')}
      cancelLabel={t('agenda.mantenerla')}
      tono="destruir"
      onConfirm={() => cancel.mutate()}
      loading={cancel.isPending}
      error={cancel.isError ? textoDeError(cancel.error, t('avisos.error')) : null}
    >
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
    </ConfirmDialog>
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
              <Button size="sm" variant="quiet" onClick={abrirMover}>
                {t('agenda.mover')}
              </Button>
              <span className="ml-1 border-l border-line pl-2">
                <Button size="sm" variant="danger" onClick={() => setCancelando(true)}>
                  {t('agenda.cancelar')}
                </Button>
              </span>
            </>
          )}
        </div>
      </div>

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
              {
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
                  <Button variant="secondary" block onClick={abrirMover}>
                    {t('agenda.moverDeHora')}
                  </Button>
                  <div className="mt-2 flex justify-center border-t border-line pt-4">
                    <Button size="md" variant="danger" onClick={() => setCancelando(true)}>
                      {t('agenda.cancelarLaCita')}
                    </Button>
                  </div>
                </>
              }
            </>
          )}
        </div>
      </Sheet>

      {dialogoMover}
      {confirmarCancelacion}
    </li>
  )
}
