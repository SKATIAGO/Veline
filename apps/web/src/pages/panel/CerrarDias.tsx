import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TIMEZONE, formatLongDate, formatPrice, fromDateKey, toDateKey } from '@veline/shared'
import { api, ApiError, type PanelBooking } from '../../lib/api'
import { Button, ErrorNote, Field, Input, Skeleton, cx } from '../../components/ui'
import { useIdioma, usePlural } from '../../i18n/idioma'
import { aviso, textoDeError } from '../../components/Avisos'
import { Wizard } from '../../components/Wizard'
import { SlotPicker } from '../../components/SlotPicker'

type Accion = 'dejar' | 'mover' | 'cancelar'
interface Decision {
  accion: Accion
  /** La hora nueva (ISO), si se mueve. */
  hora: string | null
}

const sumarDias = (key: string, n: number) => {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/**
 * Cerrar unos días —vacaciones, un festivo, una avería— sabiendo qué pasa con
 * las citas que ya había.
 *
 * Antes se pulsaba «Cerrar esos días» y, DESPUÉS, salía un aviso: «hay 3 citas
 * dentro, no se han tocado». Esas citas se quedaban reservadas en un día en
 * que nadie abre, y había que ir a la agenda a buscarlas una a una. Ahora se
 * ven antes de cerrar, y cada una se mueve, se cancela o se deja.
 *
 * Primero se resuelven las citas y solo si todo sale bien se crea el cierre:
 * si una falla (un hueco que se ocupó entre medias), el cierre no se crea y
 * se puede volver a intentar sin repetir lo que ya se hizo, porque esas citas
 * ya no salen en la lista.
 */
export function CerrarDias({
  slug,
  open,
  onClose,
}: {
  slug: string
  open: boolean
  onClose: () => void
}) {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const id = useId()
  const queryClient = useQueryClient()
  const hoy = toDateKey(new Date())

  const [paso, setPaso] = useState(0)
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [motivo, setMotivo] = useState('')
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({})
  // La cita cuyo hueco se está eligiendo ahora mismo.
  const [eligiendo, setEligiendo] = useState<string | null>(null)

  const fechasOk = !!desde && !!hasta && hasta >= desde && desde >= hoy
  const dias = fechasOk
    ? Math.round((fromDateKey(hasta).getTime() - fromDateKey(desde).getTime()) / 86_400_000) + 1
    : 0

  const { data: todas, isLoading: cargando } = useQuery({
    queryKey: ['panel', slug, 'bookings', 'cierre', desde, hasta],
    queryFn: () => api.panelBookings(slug, { from: desde, to: hasta }),
    enabled: open && fechasOk && paso >= 1,
  })
  const afectadas = (todas ?? []).filter((b) => b.status === 'CONFIRMADA')

  const decision = (b: PanelBooking): Decision =>
    decisiones[b.id] ?? { accion: 'dejar', hora: null }
  const poner = (b: PanelBooking, d: Partial<Decision>) =>
    setDecisiones((p) => ({ ...p, [b.id]: { ...decision(b), ...d } }))
  const ponerTodas = (accion: Accion) => {
    setEligiendo(null)
    setDecisiones((p) => {
      const n = { ...p }
      for (const b of afectadas)
        n[b.id] = { accion, hora: accion === 'mover' ? (p[b.id]?.hora ?? null) : null }
      return n
    })
  }

  const cuantas = (a: Accion) => afectadas.filter((b) => decision(b).accion === a).length
  const sinHora = afectadas.find((b) => decision(b).accion === 'mover' && !decision(b).hora)

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TIMEZONE,
    })
  const dia = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: TIMEZONE,
    })

  const cerrar = useMutation({
    mutationFn: async () => {
      const fallos: string[] = []
      let movidas = 0
      let canceladas = 0
      for (const b of afectadas) {
        const d = decision(b)
        try {
          if (d.accion === 'mover' && d.hora) {
            await api.rescheduleBooking(slug, b.id, d.hora, true)
            movidas++
          } else if (d.accion === 'cancelar') {
            await api.cancelBooking(b.code, motivo.trim() || undefined)
            canceladas++
          }
        } catch (e) {
          fallos.push(
            `${b.customer.name} (${dia(b.startsAt)}, ${hora(b.startsAt)}): ${textoDeError(e, t('avisos.error'))}`,
          )
        }
      }
      if (fallos.length) {
        // No se cierra con citas a medias: lo ya hecho no se repite al reintentar.
        queryClient.invalidateQueries({ queryKey: ['panel', slug] })
        throw new ApiError(t('cierre.fallaron', { lista: fallos.join(' · ') }), 409)
      }
      await api.createClosure(slug, { from: desde, to: hasta, reason: motivo.trim() || undefined })
      return { movidas, canceladas }
    },
    onSuccess: ({ movidas, canceladas }) => {
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['availability', slug] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      aviso.ok(
        movidas + canceladas > 0
          ? t('cierre.hechoCon', { dias, movidas, canceladas })
          : t('neg.diasCerrados'),
      )
      onClose()
    },
  })

  const rangoTexto =
    desde === hasta
      ? formatLongDate(fromDateKey(desde), idioma)
      : t('neg.delAl', {
          desde: formatLongDate(fromDateKey(desde), idioma),
          hasta: formatLongDate(fromDateKey(hasta), idioma),
        })

  const acciones: {
    id: Accion
    clave: 'cierre.dejarla' | 'cierre.moverla' | 'cierre.cancelarla'
  }[] = [
    { id: 'dejar', clave: 'cierre.dejarla' },
    { id: 'mover', clave: 'cierre.moverla' },
    { id: 'cancelar', clave: 'cierre.cancelarla' },
  ]

  const pasos = [
    {
      id: 'fechas',
      titulo: t('cierre.pasoFechas'),
      problema:
        !desde || !hasta
          ? t('cierre.faltanFechas')
          : desde < hoy
            ? t('cierre.fechaPasada')
            : hasta < desde
              ? t('cierre.finAntes')
              : dias > 366
                ? t('cierre.masDeUnAnio')
                : null,
      contenido: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('neg.desde')} htmlFor={`${id}-desde`} required>
              <Input
                id={`${id}-desde`}
                type="date"
                value={desde}
                min={hoy}
                onChange={(e) => {
                  setDesde(e.target.value)
                  if (hasta < e.target.value) setHasta(e.target.value)
                  setDecisiones({})
                }}
              />
            </Field>
            <Field label={t('neg.hasta')} htmlFor={`${id}-hasta`} required>
              <Input
                id={`${id}-hasta`}
                type="date"
                value={hasta}
                min={desde}
                invalid={hasta < desde}
                onChange={(e) => {
                  setHasta(e.target.value)
                  setDecisiones({})
                }}
              />
            </Field>
          </div>
          <Field label={t('neg.motivo')} htmlFor={`${id}-motivo`} hint={t('cierre.motivoPista')}>
            <Input
              id={`${id}-motivo`}
              value={motivo}
              maxLength={120}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>
          {fechasOk && (
            <p className="text-meta text-muted">
              {plural(dias, 'neg.unDia', 'neg.variosDias')} · {t('cierre.noOfreceHuecos')}
            </p>
          )}
        </>
      ),
    },
    {
      id: 'citas',
      titulo: t('cierre.pasoCitas'),
      problema: sinHora ? t('cierre.faltaHora', { nombre: sinHora.customer.name }) : null,
      contenido: cargando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : afectadas.length === 0 ? (
        <p className="rounded-xl bg-cream px-4 py-3 text-body text-body-2">
          {t('cierre.sinCitas')}
        </p>
      ) : (
        <>
          <p className="text-body text-body-2">
            {plural(afectadas.length, 'cierre.hayUna', 'cierre.hayVarias')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="quiet" onClick={() => ponerTodas('dejar')}>
              {t('cierre.dejarTodas')}
            </Button>
            <Button size="sm" variant="quiet" onClick={() => ponerTodas('cancelar')}>
              {t('cierre.cancelarTodas')}
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {afectadas.map((b) => {
              const d = decision(b)
              const abierta = eligiendo === b.id
              return (
                <li key={b.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink">
                        <span className="first-letter:uppercase">{dia(b.startsAt)}</span> ·{' '}
                        {hora(b.startsAt)} · {b.customer.name}
                      </p>
                      <p className="text-meta text-muted">
                        {b.service.name} · {formatPrice(b.priceCents, idioma)}
                        {b.staff && ` · ${b.staff.name}`}
                      </p>
                    </div>
                    <div
                      role="group"
                      aria-label={t('cierre.queHacer', { nombre: b.customer.name })}
                      className="flex gap-1"
                    >
                      {acciones.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          aria-pressed={d.accion === a.id}
                          onClick={() => {
                            poner(b, { accion: a.id, hora: a.id === 'mover' ? d.hora : null })
                            setEligiendo(a.id === 'mover' && !d.hora ? b.id : null)
                          }}
                          className={cx(
                            'inline-flex min-h-9 items-center rounded-full border px-3 text-meta font-semibold transition-colors duration-200',
                            d.accion === a.id
                              ? a.id === 'cancelar'
                                ? 'border-danger bg-danger text-white'
                                : 'border-ink bg-ink text-cream'
                              : 'border-line-strong bg-surface text-body-2 hover:border-brand',
                          )}
                        >
                          {t(a.clave)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {d.accion === 'mover' && (
                    <div className="mt-3 border-t border-line pt-3">
                      {d.hora && !abierta ? (
                        <p className="flex flex-wrap items-center gap-x-3 text-meta text-body-2">
                          <span>
                            {t('cierre.nuevaHora', { dia: dia(d.hora), hora: hora(d.hora) })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEligiendo(b.id)}
                            className="font-semibold text-brand-text hover:underline"
                          >
                            {t('cierre.cambiarla')}
                          </button>
                        </p>
                      ) : (
                        <SlotPicker
                          slug={slug}
                          consulta={{ bookingId: b.id }}
                          valor={d.hora}
                          onElegir={(iso) => {
                            poner(b, { hora: iso })
                            if (iso) setEligiendo(null)
                          }}
                          minimo={sumarDias(hasta, 1)}
                        />
                      )}
                    </div>
                  )}
                  {d.accion === 'cancelar' && (
                    <p className="mt-2 text-meta text-muted">
                      {t(b.customer.email ? 'cierre.seLeAvisaConCorreo' : 'cierre.seLeAvisa', {
                        nombre: b.customer.name.split(' ')[0] ?? '',
                      })}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      ),
    },
    {
      id: 'revisar',
      titulo: t('cierre.pasoRevisar'),
      problema: null,
      contenido: (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-xl bg-cream px-4 py-3 text-body">
            <dt className="text-muted">{t('cierre.cerrado')}</dt>
            <dd className="text-right font-semibold text-ink first-letter:uppercase">
              {rangoTexto}
            </dd>
            <dt className="text-muted">{t('neg.motivo')}</dt>
            <dd className="text-right font-semibold text-ink">{motivo.trim() || '—'}</dd>
            {afectadas.length > 0 && (
              <>
                <dt className="text-muted">{t('cierre.citasQueHabia')}</dt>
                <dd className="text-right font-semibold text-ink">
                  {[
                    cuantas('mover') > 0 && t('cierre.nMovidas', { n: cuantas('mover') }),
                    cuantas('cancelar') > 0 && t('cierre.nCanceladas', { n: cuantas('cancelar') }),
                    cuantas('dejar') > 0 && t('cierre.nSeQuedan', { n: cuantas('dejar') }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </dd>
              </>
            )}
          </dl>
          {cuantas('dejar') > 0 && (
            <ErrorNote>
              {plural(cuantas('dejar'), 'cierre.avisoDejarUna', 'cierre.avisoDejarVarias')}
            </ErrorNote>
          )}
          <p className="text-meta text-muted">
            {cuantas('mover') + cuantas('cancelar') > 0
              ? t('cierre.seAvisaYCierra')
              : t('cierre.soloCierra')}
          </p>
        </>
      ),
    },
  ]

  const tocado = desde !== hoy || hasta !== hoy || motivo.trim() !== ''

  return (
    <Wizard
      open={open}
      onClose={onClose}
      title={t('cierre.titulo')}
      pasos={pasos}
      paso={paso}
      setPaso={(n) => {
        cerrar.reset()
        setPaso(n)
      }}
      finalLabel={t('neg.cerrarEsosDias')}
      onFinalizar={() => cerrar.mutate()}
      loading={cerrar.isPending}
      error={cerrar.isError ? textoDeError(cerrar.error, t('neg.noSePudoCerrar')) : null}
      dirty={tocado}
    />
  )
}
