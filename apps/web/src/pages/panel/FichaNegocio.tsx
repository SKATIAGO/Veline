import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  categoryLabel,
  formatPrice,
  planLabel,
  plazasDelNegocio,
  subStatusLabel,
} from '@veline/shared'
import { api, type AdminBusiness } from '../../lib/api'
import {
  Badge,
  Button,
  ButtonLink,
  ErrorNote,
  Field,
  Input,
  Sheet,
  Skeleton,
  cx,
} from '../../components/ui'
import { useIdioma, usePlural, type Clave } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'
import { Tabs, panelProps } from '../../components/Tabs'
import { Fila } from './PanelActividad'

/**
 * La ficha de un negocio, para quien lleva la plataforma.
 *
 * Antes lo de cada negocio estaba repartido: la suscripción se desplegaba bajo
 * su fila, sus cuentas había que buscarlas en Cuentas entre las de todos, sus
 * cobros en Cobros mes a mes y su historia en Actividad. Ahora se abre al
 * lado de la lista, con todo lo suyo en pestañas, sin perder de vista el resto.
 */

export const ESTADO_TONO: Record<string, 'ok' | 'warn' | 'off' | 'neutral'> = {
  ACTIVA: 'ok',
  PRUEBA: 'neutral',
  IMPAGADA: 'warn',
  SUSPENDIDA: 'off',
  CANCELADA: 'off',
}

export const diasHasta = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)

type CambioSuscripcion = Parameters<typeof api.updateSubscription>[1]

/**
 * Lo que se pregunta antes de tocar el estado o el dinero de un negocio.
 *
 * Antes solo «Suspender» y «Dar de baja» preguntaban, y con una línea. Marcar
 * impagada, reactivar, sumar días de prueba a un negocio activo o cortado, o
 * pasar a un plan de pago a quien estaba en prueba se aplicaban al momento y
 * sin decir qué cambiaba —y algunos cambian bastante: «+7 días» a un negocio
 * suspendido lo vuelve a abrir al público—.
 */
interface Pregunta {
  titulo: string
  consecuencias: string[]
  boton: string
  cambio: CambioSuscripcion
  /** Para el aviso de después. */
  hecho: string
  /** Si se puede escribir el motivo, que se añade a la nota interna. */
  conMotivo?: boolean
}

/** Lo que cambia en la plataforma cuando se toca un negocio. */
function useRefrescar() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['panel'] })
    queryClient.invalidateQueries({ queryKey: ['businesses'] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }
}

/** El mando de la suscripción: plan, días de prueba y estado. */
function Suscripcion({ b }: { b: AdminBusiness }) {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const refrescar = useRefrescar()
  const [pregunta, setPregunta] = useState<Pregunta | null>(null)
  const [motivo, setMotivo] = useState('')

  const cambiar = useMutation({
    mutationFn: ({ cambio }: { cambio: CambioSuscripcion; hecho: string }) =>
      api.updateSubscription(b.id, cambio),
    onSuccess: (_r, v) => {
      setPregunta(null)
      setMotivo('')
      aviso.ok(v.hecho)
      refrescar()
    },
    // Lo que se confirma falla dentro de su confirmación; lo directo, en un aviso.
    onError: (err) => {
      if (!pregunta) aviso.error(textoDeError(err, t('adm.noSePudoCambiar')))
    },
  })

  const cortado = b.subStatus === 'SUSPENDIDA' || b.subStatus === 'CANCELADA'
  const fecha = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })

  /** El motivo se apunta en la nota interna, con la fecha: es donde se mira
      después para saber por qué se cortó. Separado con « · » y no con un salto
      de línea: la nota se edita en un campo de una sola línea, que se los
      come. */
  const conNota = (cambio: CambioSuscripcion): CambioSuscripcion => {
    const m = motivo.trim()
    if (!m) return cambio
    const linea = `${new Date().toLocaleDateString(locale)}: ${m}`
    return {
      ...cambio,
      adminNotes: [b.adminNotes, linea].filter(Boolean).join(' · ').slice(0, 600),
    }
  }

  const elegirPlan = (p: 'GRATIS' | 'NEGOCIO' | 'EQUIPOS') => {
    const hecho = t('adm.planCambiado', { nombre: b.name, plan: planLabel(p, idioma) })
    // Pasar a un plan de pago a quien está en prueba termina la prueba ya.
    if (b.subStatus === 'PRUEBA' && p !== 'GRATIS') {
      setPregunta({
        titulo: t('adm.planPregunta', { nombre: b.name, plan: planLabel(p, idioma) }),
        consecuencias: [t('adm.planTerminaPrueba'), t('adm.planCobro')],
        boton: t('adm.cambiarPlan'),
        cambio: { plan: p },
        hecho,
      })
      return
    }
    cambiar.mutate({ cambio: { plan: p }, hecho })
  }

  const sumarDias = (d: number) => {
    const base =
      b.trialEndsAt && new Date(b.trialEndsAt) > new Date() ? new Date(b.trialEndsAt) : new Date()
    const hasta = fecha(new Date(base.getTime() + d * 86_400_000))
    const hecho = t('adm.pruebaAmpliada', { nombre: b.name, fecha: hasta })
    // En prueba, sumar días es solo eso. Fuera de ella, cambia su estado.
    if (b.subStatus === 'PRUEBA') {
      cambiar.mutate({ cambio: { trialDays: d }, hecho })
      return
    }
    setPregunta({
      titulo: t('adm.pruebaPregunta', { nombre: b.name }),
      consecuencias: [
        t('adm.pruebaHasta', { fecha: hasta }),
        ...(cortado ? [t('adm.pruebaReabre')] : []),
      ],
      boton: t('adm.ponerEnPrueba'),
      cambio: { trialDays: d },
      hecho,
    })
  }

  const preguntar = (estado: 'IMPAGADA' | 'SUSPENDIDA' | 'CANCELADA' | 'ACTIVA') => {
    const nombre = b.name
    const p: Record<typeof estado, Pregunta> = {
      IMPAGADA: {
        titulo: t('adm.impagadaPregunta', { nombre }),
        consecuencias: [t('adm.impagadaC1'), t('adm.impagadaC2')],
        boton: t('adm.marcarImpagada'),
        cambio: { status: 'IMPAGADA' },
        hecho: t('adm.impagadaHecho', { nombre }),
        conMotivo: true,
      },
      SUSPENDIDA: {
        titulo: t('adm.suspenderTitulo', { nombre }),
        consecuencias: [
          t('adm.suspenderC1'),
          t('adm.suspenderC2'),
          t('adm.suspenderC3'),
          t('adm.cortarCobro'),
          t('adm.suspenderC4'),
        ],
        boton: t('adm.suspender'),
        cambio: { status: 'SUSPENDIDA' },
        hecho: t('adm.suspendidoHecho', { nombre }),
        conMotivo: true,
      },
      CANCELADA: {
        titulo: t('adm.bajaTitulo', { nombre }),
        consecuencias: [
          t('adm.suspenderC1'),
          t('adm.bajaC2'),
          t('adm.cortarCobro'),
          t('adm.bajaC4'),
        ],
        boton: t('adm.darDeBaja'),
        cambio: { status: 'CANCELADA' },
        hecho: t('adm.bajaHecho', { nombre }),
        conMotivo: true,
      },
      ACTIVA: {
        titulo: t('adm.reactivarTitulo', { nombre }),
        consecuencias: [t('adm.reactivarC1'), t('adm.reactivarC2')],
        boton: t('adm.reactivar'),
        cambio: { status: 'ACTIVA' },
        hecho: t('adm.reactivadoHecho', { nombre }),
      },
    }
    setPregunta(p[estado])
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="text-meta font-semibold text-body-2">{t('adm.plan')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {(['GRATIS', 'NEGOCIO', 'EQUIPOS'] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={b.plan === p ? 'primary' : 'quiet'}
              aria-pressed={b.plan === p}
              loading={!pregunta && cambiar.isPending && cambiar.variables?.cambio.plan === p}
              onClick={() => b.plan !== p && elegirPlan(p)}
            >
              {planLabel(p, idioma)}
            </Button>
          ))}
        </div>
        <p className="text-meta text-muted">
          {plural(plazasDelNegocio(b.counts.staff), 'adm.conUnaPersona', 'adm.conVariasPersonas')}{' '}
          <strong className="font-semibold text-body-2">
            {t('adm.alMesFuerte', { importe: formatPrice(b.monthlyCents, idioma) })}
          </strong>
        </p>
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h3 className="text-meta font-semibold text-body-2">{t('adm.prueba')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {[7, 15, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant="quiet"
              loading={!pregunta && cambiar.isPending && cambiar.variables?.cambio.trialDays === d}
              onClick={() => sumarDias(d)}
            >
              {t('adm.masDias', { n: d })}
            </Button>
          ))}
        </div>
        <p className="text-meta text-muted">
          {b.trialEndsAt
            ? t('adm.pruebaTermina', { fecha: new Date(b.trialEndsAt).toLocaleDateString(locale) })
            : t('adm.sinPrueba')}
        </p>
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h3 className="text-meta font-semibold text-body-2">{t('adm.estado')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {cortado ? (
            <Button size="sm" onClick={() => preguntar('ACTIVA')}>
              {t('adm.reactivar')}
            </Button>
          ) : (
            <>
              {b.subStatus !== 'IMPAGADA' && (
                <Button size="sm" variant="quiet" onClick={() => preguntar('IMPAGADA')}>
                  {t('adm.marcarImpagada')}
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => preguntar('SUSPENDIDA')}>
                {t('adm.suspender')}
              </Button>
              {/* No es un borrado: conserva sus reservas y cobros, y se
                  puede reactivar. Un borrado de verdad se llevaría por
                  delante ese historial, y aquí no hace falta. */}
              <Button size="sm" variant="danger" onClick={() => preguntar('CANCELADA')}>
                {t('adm.darDeBaja')}
              </Button>
            </>
          )}
        </div>
        <p className="text-meta text-muted">
          {b.accepting ? t('adm.aceptaNormal') : t('adm.noAceptaAhora')}
        </p>
      </section>

      <ConfirmDialog
        open={!!pregunta}
        onClose={() => {
          cambiar.reset()
          setMotivo('')
          setPregunta(null)
        }}
        title={pregunta?.titulo ?? ''}
        consecuencias={pregunta?.consecuencias}
        confirmLabel={pregunta?.boton ?? ''}
        onConfirm={() =>
          pregunta &&
          cambiar.mutate({
            cambio: pregunta.conMotivo ? conNota(pregunta.cambio) : pregunta.cambio,
            hecho: pregunta.hecho,
          })
        }
        loading={cambiar.isPending}
        error={cambiar.isError ? textoDeError(cambiar.error, t('adm.noSePudoCambiar')) : null}
      >
        {pregunta?.conMotivo && (
          <Field label={t('adm.motivo')} htmlFor={`motivo-${b.id}`} hint={t('adm.motivoPista')}>
            <Input
              id={`motivo-${b.id}`}
              value={motivo}
              maxLength={200}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Field>
        )}
      </ConfirmDialog>
    </>
  )
}

/** La nota que solo ve Veline: por qué se suspendió, con quién se habló… */
function NotaInterna({ b }: { b: AdminBusiness }) {
  const { t } = useIdioma()
  const id = useId()
  const refrescar = useRefrescar()
  const [notas, setNotas] = useState(b.adminNotes ?? '')
  /* El motivo de una suspensión se escribe en la nota desde su confirmación.
     Sin esto el campo seguía enseñando la nota de antes, y «Guardar nota» la
     pisaba y perdía el motivo. */
  useEffect(() => setNotas(b.adminNotes ?? ''), [b.adminNotes])

  const guardar = useMutation({
    mutationFn: () => api.updateSubscription(b.id, { adminNotes: notas.trim() }),
    onSuccess: () => {
      aviso.ok(t('adm.notaGuardada'))
      refrescar()
    },
    onError: (err) => aviso.error(textoDeError(err, t('adm.noSePudoCambiar'))),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        guardar.mutate()
      }}
      className="flex flex-col gap-2 border-t border-line pt-4"
    >
      <Field label={t('adm.notaInterna')} htmlFor={`${id}-nota`} hint={t('fneg.notaPista')}>
        <Input id={`${id}-nota`} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </Field>
      <div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={guardar.isPending}
          disabled={notas.trim() === (b.adminNotes ?? '').trim()}
        >
          {t('adm.guardarNota')}
        </Button>
      </div>
    </form>
  )
}

const ROL_CLAVE = {
  SUPERADMIN: 'panel.rolSuperadmin',
  ADMIN: 'panel.rolAdmin',
  EMPLEADO: 'panel.rolEmpleado',
} as const satisfies Record<string, Clave>

/** Quién entra a su panel. Quitar y devolver el acceso, como en Cuentas. */
function Cuentas({ b, onCrearCuenta }: { b: AdminBusiness; onCrearCuenta: () => void }) {
  const { t } = useIdioma()
  const refrescar = useRefrescar()
  const [aQuitar, setAQuitar] = useState<{ id: string; name: string } | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: api.adminUsers,
  })
  const suyas = (users ?? []).filter((u) => u.business?.slug === b.slug)

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; name: string; active: boolean }) =>
      api.setAdminUserActive(id, active),
    onSuccess: (_r, v) => {
      refrescar()
      if (v.active) {
        aviso.ok(t('eq.accesoDevuelto', { nombre: v.name }))
        return
      }
      setAQuitar(null)
      aviso.ok(t('eq.accesoQuitado', { nombre: v.name }), {
        texto: t('avisos.deshacer'),
        onClick: () =>
          api
            .setAdminUserActive(v.id, true)
            .then(refrescar)
            .catch((e) => aviso.error(textoDeError(e, t('avisos.error')))),
      })
    },
    onError: (err, v) => {
      if (v.active) aviso.error(textoDeError(err, t('avisos.error')))
    },
  })

  return (
    <>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : !suyas.length ? (
        <p className="text-body text-body-2">{t('fneg.sinCuentas')}</p>
      ) : (
        <ul className="flex flex-col">
          {suyas.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3 last:border-b-0"
            >
              <div className={cx('min-w-0 flex-1', !u.active && 'opacity-60')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{u.name}</span>
                  {!u.active && <Badge tone="off">{t('ctas.sinAcceso')}</Badge>}
                </div>
                <p className="text-meta break-all text-muted">
                  {t(ROL_CLAVE[u.role])} · {u.email}
                </p>
              </div>
              {u.active ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setAQuitar({ id: u.id, name: u.name })}
                >
                  {t('ctas.quitarAcceso')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="quiet"
                  loading={toggle.isPending && toggle.variables?.id === u.id}
                  onClick={() => toggle.mutate({ id: u.id, name: u.name, active: true })}
                >
                  {t('ctas.devolverAcceso')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="secondary" onClick={onCrearCuenta}>
          {t('fneg.crearOtraCuenta')}
        </Button>
      </div>

      <ConfirmDialog
        open={!!aQuitar}
        onClose={() => {
          toggle.reset()
          setAQuitar(null)
        }}
        title={t('eq.quitarTitulo', { nombre: aQuitar?.name ?? '' })}
        consecuencias={[t('eq.quitarC1'), t('eq.quitarC2'), t('eq.quitarC3')]}
        confirmLabel={t('ctas.quitarAcceso')}
        onConfirm={() => aQuitar && toggle.mutate({ ...aQuitar, active: false })}
        loading={toggle.isPending}
        error={
          toggle.isError && toggle.variables?.active === false
            ? textoDeError(toggle.error, t('avisos.error'))
            : null
        }
      />
    </>
  )
}

const COBRO_TONO = { COBRADO: 'ok', PENDIENTE: 'warn', ANULADO: 'off' } as const
const COBRO_CLAVE = {
  COBRADO: 'cob.cobrado',
  PENDIENTE: 'cob.pendiente',
  ANULADO: 'cob.anulado',
} as const satisfies Record<string, Clave>

/** Lo que se le ha cobrado, mes a mes. Solo para mirar: se cobra en Cobros. */
function Cobros({ b }: { b: AdminBusiness }) {
  const { t, idioma, locale } = useIdioma()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'charges', 'negocio', b.id],
    queryFn: () => api.adminCharges(undefined, b.id),
  })
  const mes = (period: string) =>
    new Date(`${period}-01T00:00:00`).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
    })

  if (isLoading)
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    )
  if (isError) return <ErrorNote>{t('fneg.noSeCargo')}</ErrorNote>
  if (!data?.charges.length) return <p className="text-body text-body-2">{t('fneg.sinCobros')}</p>

  return (
    <>
      <ul className="flex flex-col">
        {data.charges.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink first-letter:uppercase">
                {mes(c.period)}
              </p>
              <p className="text-meta text-muted">{planLabel(c.plan, idioma)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-ink tabular-nums">
                {formatPrice(c.totalCents, idioma)}
              </span>
              <Badge tone={COBRO_TONO[c.status]}>{t(COBRO_CLAVE[c.status])}</Badge>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-meta text-muted">
        {t('fneg.cobrosPista')}{' '}
        <Link to="/panel/admin/cobros" className="font-semibold text-brand-text hover:underline">
          {t('panel.cobros')}
        </Link>
      </p>
    </>
  )
}

/** Lo último que ha pasado en el negocio. El registro entero, en su panel. */
function Actividad({ b }: { b: AdminBusiness }) {
  const { t } = useIdioma()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit', 'ficha', b.id],
    queryFn: () => api.auditLog({ businessId: b.id, limit: 15 }),
  })

  if (isLoading)
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    )
  if (isError) return <ErrorNote>{t('act.noSePudoCargar')}</ErrorNote>
  if (!data?.entries.length) return <p className="text-body text-body-2">{t('act.todaviaNoHay')}</p>

  return (
    <>
      <ul>
        {data.entries.map((e) => (
          <Fila key={e.id} e={e} verIp sinNegocio />
        ))}
      </ul>
      {data.nextCursor && (
        <Link
          to={`/panel/${b.slug}/actividad`}
          className="text-meta font-semibold text-brand-text hover:underline"
        >
          {t('fneg.verTodaActividad')}
        </Link>
      )}
    </>
  )
}

type Pestana = 'resumen' | 'suscripcion' | 'cuentas' | 'cobros' | 'actividad'

export function FichaNegocio({
  negocio: b,
  onClose,
  onAprobar,
  onCrearCuenta,
}: {
  negocio: AdminBusiness | null
  onClose: () => void
  onAprobar: (b: AdminBusiness) => void
  onCrearCuenta: (b: AdminBusiness) => void
}) {
  const { t, idioma, locale } = useIdioma()
  const idBase = useId()
  const refrescar = useRefrescar()
  const [pestana, setPestana] = useState<Pestana>('resumen')
  // Al abrir otro negocio, se empieza por su resumen.
  useEffect(() => setPestana('resumen'), [b?.id])

  // Un local nuevo de un negocio que ya funciona: aprobarlo solo lo publica.
  // Va directo, con aviso.
  const aprobarLocal = useMutation({
    mutationFn: (l: { id: string; name: string }) => api.approveLocation(l.id),
    onSuccess: (_r, l) => {
      refrescar()
      aviso.ok(t('adm.localAprobado', { nombre: l.name }))
    },
    onError: (err) => aviso.error(textoDeError(err, t('adm.noSePudoAprobar'))),
  })

  const pestanas: { id: Pestana; label: string; contador?: number }[] = [
    { id: 'resumen', label: t('fneg.resumen') },
    { id: 'suscripcion', label: t('adm.suscripcion') },
    { id: 'cuentas', label: t('fneg.cuentas'), contador: b?.counts.users },
    { id: 'cobros', label: t('panel.cobros') },
    { id: 'actividad', label: t('panel.actividad') },
  ]

  return (
    <Sheet open={!!b} onClose={onClose} title={b?.name ?? ''} lado="derecha">
      {b && (
        <div className="flex min-h-[calc(100%-3rem)] flex-col">
          <div className="pr-10">
            <h2 className="font-display text-subheading font-semibold text-ink">{b.name}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge>{categoryLabel(b.category, idioma)}</Badge>
              <Badge tone={ESTADO_TONO[b.subStatus] ?? 'neutral'}>
                {subStatusLabel(b.subStatus, idioma)}
                {b.subStatus === 'PRUEBA' && b.trialEndsAt
                  ? ` · ${Math.max(0, diasHasta(b.trialEndsAt))} d`
                  : ''}
              </Badge>
              {!b.approvedAt && <Badge tone="warn">{t('adm.sinAprobar')}</Badge>}
              {!b.accepting && <Badge tone="off">{t('adm.noAceptaReservas')}</Badge>}
            </div>
          </div>

          <div className="mt-5">
            <Tabs
              idBase={idBase}
              tabs={pestanas}
              activa={pestana}
              onCambiar={setPestana}
              label={t('fneg.pestanas')}
            />
          </div>

          <div
            {...panelProps(idBase, pestana)}
            className="flex flex-1 flex-col gap-4 py-5 outline-none"
          >
            {pestana === 'resumen' && (
              <>
                {!b.approvedAt && (
                  <div className="flex flex-col gap-3 rounded-xl bg-cream px-4 py-3">
                    <p className="text-meta text-body-2">{t('fneg.sinAprobarTexto')}</p>
                    <div>
                      <Button size="sm" onClick={() => onAprobar(b)}>
                        {t('adm.aprobar')}
                      </Button>
                    </div>
                  </div>
                )}

                {b.pendingLocations.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3"
                  >
                    <p className="min-w-0 text-meta text-body-2">
                      <strong className="font-semibold text-ink">{l.name}</strong> · {l.street},{' '}
                      {l.city}
                      <span className="block text-muted">{t('fneg.localNuevo')}</span>
                    </p>
                    <Button
                      size="sm"
                      loading={aprobarLocal.isPending && aprobarLocal.variables?.id === l.id}
                      onClick={() => aprobarLocal.mutate(l)}
                    >
                      {t('adm.aprobarLocal')}
                    </Button>
                  </div>
                ))}

                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-body">
                  <dt className="text-muted">{t('adm.plan')}</dt>
                  <dd className="text-right font-semibold text-ink">
                    {planLabel(b.plan, idioma)} ·{' '}
                    {t('adm.alMes', { importe: formatPrice(b.monthlyCents, idioma) })}
                  </dd>
                  <dt className="text-muted">{t('adm.email')}</dt>
                  <dd className="text-right font-semibold break-all text-ink">{b.email ?? '—'}</dd>
                  <dt className="text-muted">{t('fneg.direccion')}</dt>
                  <dd className="text-right font-semibold break-all text-ink">/{b.slug}</dd>
                  <dt className="text-muted">{t('fneg.altaEl')}</dt>
                  <dd className="text-right font-semibold text-ink">
                    {new Date(b.createdAt).toLocaleDateString(locale, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </dd>
                  <dt className="text-muted">{t('adm.citas')}</dt>
                  <dd className="text-right font-semibold text-ink tabular-nums">
                    {b.counts.bookings}
                  </dd>
                  <dt className="text-muted">{t('adm.servicios')}</dt>
                  <dd className="text-right font-semibold text-ink tabular-nums">
                    {b.counts.services}
                  </dd>
                  <dt className="text-muted">{t('fneg.atienden')}</dt>
                  <dd className="text-right font-semibold text-ink tabular-nums">
                    {b.counts.staff}
                  </dd>
                </dl>

                {b.counts.services === 0 && (
                  <p className="text-meta text-brand-text">{t('fneg.sinServiciosTexto')}</p>
                )}

                <NotaInterna b={b} />
              </>
            )}

            {pestana === 'suscripcion' && <Suscripcion b={b} />}
            {pestana === 'cuentas' && <Cuentas b={b} onCrearCuenta={() => onCrearCuenta(b)} />}
            {pestana === 'cobros' && <Cobros b={b} />}
            {pestana === 'actividad' && <Actividad b={b} />}
          </div>

          <div className="sticky bottom-[calc(-1*max(1.5rem,env(safe-area-inset-bottom)))] -mx-5 -mb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-wrap gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:-mb-6 sm:-bottom-6 sm:px-6 sm:pb-5">
            <ButtonLink to={`/panel/${b.slug}`}>{t('fneg.abrirSuPanel')}</ButtonLink>
          </div>
        </div>
      )}
    </Sheet>
  )
}
