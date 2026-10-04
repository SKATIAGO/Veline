import { useEffect, useId, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CATEGORIES,
  categoryLabel,
  formatPrice,
  planLabel,
  plazasDelNegocio,
  subStatusLabel,
} from '@veline/shared'
import { api, type AdminBusiness } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
} from '../../components/ui'
import { Texto, useIdioma, usePlural, type Clave } from '../../i18n/idioma'
import { ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'
import { generarPassword } from '../../lib/password'
import { CredencialCreada } from '../../components/Credencial'

/**
 * Gestión de la plataforma — SOLO superadmin. Dar de alta negocios y crear
 * la cuenta de administrador de cada uno.
 */

interface BusinessDraft {
  name: string
  category: string
  email: string
  phone: string
  street: string
  city: string
  postalCode: string
}

const emptyBusiness: BusinessDraft = {
  name: '',
  category: CATEGORIES[0].slug,
  email: '',
  phone: '',
  street: '',
  city: 'Madrid',
  postalCode: '',
}

interface UserDraft {
  businessId: string
  name: string
  email: string
  password: string
  role: 'ADMIN' | 'EMPLEADO'
}

const esEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

const ESTADO_TONO: Record<string, 'ok' | 'warn' | 'off' | 'neutral'> = {
  ACTIVA: 'ok',
  PRUEBA: 'neutral',
  IMPAGADA: 'warn',
  SUSPENDIDA: 'off',
  CANCELADA: 'off',
}

const diasHasta = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)

/**
 * El mando de la suscripción de un negocio. Se abre bajo su fila para no
 * llevarte a otra pantalla: casi siempre se toca justo después de mirar
 * las cifras de esa misma fila.
 */
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

function Suscripcion({ b, onDone }: { b: AdminBusiness; onDone: () => void }) {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const [notas, setNotas] = useState(b.adminNotes ?? '')
  /* El motivo de una suspensión se escribe en la nota desde la confirmación.
     Sin esto el campo seguía enseñando la nota de antes, y «Guardar nota»
     la pisaba y perdía el motivo. */
  useEffect(() => setNotas(b.adminNotes ?? ''), [b.adminNotes])
  const [pregunta, setPregunta] = useState<Pregunta | null>(null)
  const [motivo, setMotivo] = useState('')

  const cambiar = useMutation({
    mutationFn: ({ cambio }: { cambio: CambioSuscripcion; hecho: string }) =>
      api.updateSubscription(b.id, cambio),
    onSuccess: (_r, v) => {
      setPregunta(null)
      setMotivo('')
      aviso.ok(v.hecho)
      onDone()
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
    <div className="w-full border-t border-line bg-canvas/50 px-4 py-4 sm:px-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1.2fr]">
        <div>
          <p className="mb-2 text-meta font-semibold text-body-2">{t('adm.plan')}</p>
          <div className="flex flex-wrap gap-1.5">
            {(['GRATIS', 'NEGOCIO', 'EQUIPOS'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={b.plan === p ? 'primary' : 'quiet'}
                loading={!pregunta && cambiar.isPending && cambiar.variables?.cambio.plan === p}
                onClick={() => b.plan !== p && elegirPlan(p)}
              >
                {planLabel(p, idioma)}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-meta text-muted">
            {plural(plazasDelNegocio(b.counts.staff), 'adm.conUnaPersona', 'adm.conVariasPersonas')}{' '}
            <strong className="font-semibold text-body-2">
              {t('adm.alMesFuerte', { importe: formatPrice(b.monthlyCents, idioma) })}
            </strong>
          </p>
        </div>

        <div>
          <p className="mb-2 text-meta font-semibold text-body-2">{t('adm.prueba')}</p>
          <div className="flex flex-wrap gap-1.5">
            {[7, 15, 30].map((d) => (
              <Button
                key={d}
                size="sm"
                variant="quiet"
                loading={
                  !pregunta && cambiar.isPending && cambiar.variables?.cambio.trialDays === d
                }
                onClick={() => sumarDias(d)}
              >
                {t('adm.masDias', { n: d })}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-meta text-muted">
            {b.trialEndsAt
              ? t('adm.pruebaTermina', {
                  fecha: new Date(b.trialEndsAt).toLocaleDateString(locale),
                })
              : t('adm.sinPrueba')}
          </p>
        </div>

        <div>
          <p className="mb-2 text-meta font-semibold text-body-2">{t('adm.estado')}</p>
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
          <p className="mt-2 text-meta text-muted">
            {b.accepting ? t('adm.aceptaNormal') : t('adm.noAceptaAhora')}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          cambiar.mutate({ cambio: { adminNotes: notas.trim() }, hecho: t('adm.notaGuardada') })
        }}
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
      >
        <label className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <span className="text-meta font-semibold text-body-2">{t('adm.notaInterna')}</span>
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
        <Button
          type="submit"
          variant="secondary"
          loading={cambiar.isPending && cambiar.variables?.cambio.adminNotes !== undefined}
        >
          {t('adm.guardarNota')}
        </Button>
      </form>

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
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-meta font-medium text-muted">{label}</div>
      <div className="mt-1 font-display text-heading-sm font-semibold text-ink tabular-nums">
        {value}
      </div>
    </Card>
  )
}

const TIPO_CLAVE: Record<string, Clave> = {
  RESERVA_CONFIRMADA: 'env.tipoConfirmacion',
  RESERVA_CANCELADA: 'env.tipoCancelacion',
  RECORDATORIO: 'env.tipoRecordatorio',
  RESENA_PEDIDA: 'env.tipoResena',
  RESTABLECER_CONTRASENA: 'env.tipoContrasena',
}

/**
 * Qué sale de verdad del servidor. Va arriba del todo porque es lo único de
 * esta pantalla que puede estar roto sin que nada lo parezca: con los SMS en
 * modo de prueba las citas se confirman igual y nadie recibe nada.
 *
 * La línea de cada canal la escribe el servidor tal cual la pone en su log de
 * arranque, en castellano: es un diagnóstico, y reescribirlo aquí sería
 * perder precisión justo donde importa. Lo de alrededor sí va traducido.
 */
function Envios({ habilitado }: { habilitado: boolean }) {
  const { t, locale } = useIdioma()
  const { data } = useQuery({
    queryKey: ['admin', 'envios'],
    queryFn: api.adminEnvios,
    enabled: habilitado,
  })
  if (!data) return null

  const sms = data.ultimos7dias.filter((f) => f.canal === 'SMS')
  const canales = [
    ['env.correo', data.correo],
    ['env.sms', data.sms],
  ] as const

  return (
    <Card padded>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-subheading font-semibold text-ink">{t('env.titulo')}</h2>
        <p className="text-meta text-subtle">{t('env.pista')}</p>
      </div>

      <dl className="flex flex-col gap-3">
        {canales.map(([clave, canal]) => (
          <div key={clave} className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <dt className="w-[60px] shrink-0 pt-0.5 text-meta font-semibold text-body-2">
              {t(clave)}
            </dt>
            <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Badge tone={canal.activo ? 'ok' : 'warn'}>
                {canal.activo ? t('env.activo') : t('env.noSale')}
              </Badge>
              <span className="min-w-0 text-meta break-words text-muted">{canal.texto}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-meta font-semibold text-body-2">
          {t('env.smsUltimos7')}
          {data.ultimoSmsEnviado && (
            <span className="ml-2 font-normal text-subtle">
              {t('env.ultimoSms', {
                fecha: new Date(data.ultimoSmsEnviado).toLocaleString(locale, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </span>
          )}
        </p>
        {sms.length === 0 ? (
          <p className="text-meta text-subtle">{t('env.sinSms')}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-meta">
            {sms.map((f) => (
              <li
                key={`${f.tipo}-${f.estado}-${f.motivo ?? ''}`}
                className="flex flex-wrap gap-x-2 text-body-2"
              >
                <span className="font-semibold text-ink">
                  {TIPO_CLAVE[f.tipo] ? t(TIPO_CLAVE[f.tipo]!) : f.tipo}
                </span>
                <span>
                  {f.estado === 'ENVIADO'
                    ? t('env.enviados', { n: f.total })
                    : t('env.noEnviados', { n: f.total })}
                </span>
                {f.motivo && <span className="text-subtle">· {f.motivo}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export function PanelAdmin() {
  const { t, idioma } = useIdioma()
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const id = useId()

  const [businessDraft, setBusinessDraft] = useState<BusinessDraft | null>(null)
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null)
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null)
  const [intentoNegocio, setIntentoNegocio] = useState(false)
  const [intentoCuenta, setIntentoCuenta] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  // Los dados de baja son sitio en la lista que ya no hace falta atender a
  // diario: se quitan de en medio sin dejar de existir, y se recuperan con
  // la casilla si alguna vez hace falta mirar uno.
  const [verBaja, setVerBaja] = useState(false)

  const { data: businesses, isLoading } = useQuery({
    queryKey: ['admin', 'businesses'],
    queryFn: api.adminBusinesses,
    enabled: user?.role === 'SUPERADMIN',
  })

  const createBusiness = useMutation({
    mutationFn: (d: BusinessDraft) =>
      api.createAdminBusiness({ ...d, phone: d.phone || undefined }),
    onSuccess: (r, d) => {
      setBusinessDraft(null)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['panel', 'businesses'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      /* Antes el formulario se cerraba sin más, y el siguiente paso —crear la
         cuenta del dueño— había que ir a buscarlo a su fila. */
      aviso.ok(t('adm.negocioCreado', { nombre: d.name }), {
        texto: t('adm.crearSuCuenta'),
        onClick: () => abrirCuenta({ id: r.id, email: d.email } as AdminBusiness),
      })
    },
  })

  const createUser = useMutation({
    mutationFn: (d: UserDraft) => api.createAdminUser(d),
    onSuccess: (_data, d) => {
      setCredencial({ email: d.email, password: d.password })
      setUserDraft(null)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const [aAprobar, setAAprobar] = useState<AdminBusiness | null>(null)

  const aprobar = useMutation({
    mutationFn: (b: AdminBusiness) => api.approveBusiness(b.id),
    onSuccess: (_r, b) => {
      setAAprobar(null)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      aviso.ok(t('adm.aprobadoHecho', { nombre: b.name }))
    },
  })

  // Un local nuevo de un negocio que ya funciona: aprobarlo solo lo publica.
  // Va directo, con aviso.
  const aprobarLocal = useMutation({
    mutationFn: (l: { id: string; name: string }) => api.approveLocation(l.id),
    onSuccess: (_r, l) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      aviso.ok(t('adm.localAprobado', { nombre: l.name }))
    },
    onError: (err) => aviso.error(textoDeError(err, t('adm.noSePudoAprobar'))),
  })

  const visibles = useMemo(
    () =>
      verBaja ? (businesses ?? []) : (businesses ?? []).filter((b) => b.subStatus !== 'CANCELADA'),
    [businesses, verBaja],
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return visibles
    return visibles.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        (b.email ?? '').toLowerCase().includes(q) ||
        categoryLabel(b.category).toLowerCase().includes(q),
    )
  }, [visibles, busqueda])

  const hayBaja = (businesses ?? []).some((b) => b.subStatus === 'CANCELADA')

  const totales = useMemo(() => {
    const list = visibles
    return {
      negocios: list.length,
      citas: list.reduce((n, b) => n + b.counts.bookings, 0),
      usuarios: list.reduce((n, b) => n + b.counts.users, 0),
      // Un negocio sin servicios no puede recibir reservas: es el aviso que
      // de verdad le sirve a quien lleva la plataforma.
      sinServicios: list.filter((b) => b.counts.services === 0).length,
      // Los que se dieron de alta solos y nadie ha mirado todavía. Mientras
      // tanto no salen en el marketplace, así que cuanto antes se vean mejor.
      pendientes:
        list.filter((b) => !b.approvedAt).length +
        list.reduce((n, b) => n + b.pendingLocations.length, 0),
    }
  }, [visibles])

  // Antes de cualquier return: un hook detrás de uno cambia de orden entre
  // renders y React deja de saber cuál es cuál.
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'SUPERADMIN') return <Navigate to="/panel" replace />

  const problemaNegocio = !businessDraft
    ? null
    : businessDraft.name.trim().length < 2
      ? 'Escribe el nombre del negocio.'
      : !esEmail(businessDraft.email)
        ? t('adm.errEmailNegocio')
        : businessDraft.street.trim().length < 3
          ? 'Falta la calle.'
          : businessDraft.city.trim().length < 2
            ? 'Falta la ciudad.'
            : !/^\d{5}$/.test(businessDraft.postalCode.trim())
              ? t('adm.errCp')
              : null

  const problemaUsuario = !userDraft
    ? null
    : userDraft.name.trim().length < 2
      ? 'Escribe el nombre.'
      : !esEmail(userDraft.email)
        ? t('adm.errEmail')
        : userDraft.password.length < 10
          ? t('adm.errContrasena')
          : null

  const abrirCuenta = (b: AdminBusiness) => {
    createUser.reset()
    setIntentoCuenta(false)
    setCredencial(null)
    setBusinessDraft(null)
    setUserDraft({
      businessId: b.id,
      name: '',
      email: b.email ?? '',
      password: generarPassword(),
      role: 'ADMIN',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.negocios')}
        hint={t('adm.pista')}
        actions={
          <Button
            onClick={() => {
              createBusiness.reset()
              setIntentoNegocio(false)
              setBusinessDraft(emptyBusiness)
            }}
          >
            {t('adm.darDeAlta')}
          </Button>
        }
      />

      <Envios habilitado={user?.role === 'SUPERADMIN'} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('adm.negocios')} value={totales.negocios} />
        <Stat label={t('adm.citasTotales')} value={totales.citas} />
        <Stat label={t('adm.cuentasAcceso')} value={totales.usuarios} />
        <Stat label={t('adm.sinServicios')} value={totales.sinServicios} />
        <Stat label={t('adm.sinAprobar')} value={totales.pendientes} />
      </div>

      {(businesses?.length ?? 0) > 6 && (
        <Input
          type="search"
          aria-label={t('adm.buscarEtiqueta')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-sm"
        />
      )}

      {hayBaja && (
        <label className="flex items-center gap-1.5 text-meta text-subtle">
          <input
            type="checkbox"
            checked={verBaja}
            onChange={(e) => setVerBaja(e.target.checked)}
            className="size-3.5 accent-brand"
          />
          {t('panel.verDadosDeBaja')}
        </label>
      )}

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </Card>
      ) : !businesses?.length ? (
        <EmptyState
          title={t('adm.aunNoHay')}
          hint={t('adm.aunNoHayPista')}
          action={
            <Button onClick={() => setBusinessDraft(emptyBusiness)}>{t('adm.darDeAltaUno')}</Button>
          }
        />
      ) : !filtrados.length && !busqueda.trim() ? (
        <EmptyState title={t('adm.todosDeBaja')} />
      ) : !filtrados.length ? (
        <EmptyState title={t('adm.ningunoCoincide', { q: busqueda })} />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {filtrados.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
              >
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/panel/${b.slug}`}
                      className="-my-1.5 inline-flex min-h-8 items-center py-1.5 text-ui font-semibold text-ink hover:text-brand hover:underline"
                    >
                      {b.name}
                    </Link>
                    <Badge>{categoryLabel(b.category, idioma)}</Badge>
                    <Badge tone={ESTADO_TONO[b.subStatus] ?? 'neutral'}>
                      {subStatusLabel(b.subStatus, idioma)}
                      {b.subStatus === 'PRUEBA' && b.trialEndsAt
                        ? ` · ${Math.max(0, diasHasta(b.trialEndsAt))} d`
                        : ''}
                    </Badge>
                    {!b.approvedAt && <Badge tone="warn">{t('adm.sinAprobar')}</Badge>}
                    {b.pendingLocations.length > 0 && (
                      <Badge tone="warn">
                        {t(
                          b.pendingLocations.length === 1
                            ? 'adm.unLocalSinAprobar'
                            : 'adm.variosLocalesSinAprobar',
                          { n: b.pendingLocations.length },
                        )}
                      </Badge>
                    )}
                    {!b.accepting && <Badge tone="off">{t('adm.noAceptaReservas')}</Badge>}
                    {b.counts.services === 0 && <Badge tone="warn">{t('adm.sinServicios')}</Badge>}
                    {b.counts.users === 0 && <Badge tone="off">{t('adm.sinAcceso')}</Badge>}
                  </div>
                  <p className="mt-0.5 text-meta text-muted">
                    /{b.slug} · {planLabel(b.plan, idioma)} ·{' '}
                    {t('adm.alMes', { importe: formatPrice(b.monthlyCents, idioma) })}
                    {b.email && ` · ${b.email}`}
                  </p>
                </div>

                <dl className="flex gap-5 text-meta text-muted">
                  {[
                    [t('adm.citas'), b.counts.bookings],
                    [t('adm.servicios'), b.counts.services],
                    [t('adm.equipo'), b.counts.users],
                  ].map(([label, n]) => (
                    <div key={label as string}>
                      <dt className="text-caption">{label}</dt>
                      <dd className="font-semibold text-body-2 tabular-nums">{n}</dd>
                    </div>
                  ))}
                </dl>

                <div className="ml-auto flex flex-wrap justify-end gap-1 sm:ml-0">
                  {!b.approvedAt && (
                    <Button size="sm" onClick={() => setAAprobar(b)}>
                      {t('adm.aprobar')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => setAbierto(abierto === b.id ? null : b.id)}
                  >
                    {abierto === b.id ? t('adm.cerrar') : t('adm.suscripcion')}
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => abrirCuenta(b)}>
                    {t('adm.crearCuenta')}
                  </Button>
                  <Link
                    to={`/panel/${b.slug}`}
                    className="inline-flex min-h-9 items-center rounded-full border border-ink/25 px-3.5 text-meta font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-cream"
                  >
                    {t('adm.abrirPanel')}
                  </Link>
                </div>

                {b.pendingLocations.map((l) => (
                  <div
                    key={l.id}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2.5"
                  >
                    <p className="min-w-0 text-meta text-body-2">
                      <strong className="font-semibold text-ink">{l.name}</strong> · {l.street},{' '}
                      {l.city}
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

                {abierto === b.id && (
                  <Suscripcion
                    b={b}
                    onDone={() => {
                      queryClient.invalidateQueries({ queryKey: ['admin'] })
                      queryClient.invalidateQueries({ queryKey: ['panel'] })
                      queryClient.invalidateQueries({ queryKey: ['audit'] })
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Dar de alta un negocio y crear una cuenta, en diálogos: antes eran
          tarjetas que aparecían arriba de la página, lejos de la fila desde
          la que se pedía la cuenta, y la contraseña salía en otra tarjeta. */}
      <FormDialog
        open={!!businessDraft}
        onClose={() => setBusinessDraft(null)}
        title={t('adm.nuevoNegocio')}
        hint={t('adm.nuevoNegocioPista')}
        submitLabel={t('adm.crearNegocio')}
        onSubmit={() => {
          setIntentoNegocio(true)
          if (businessDraft && !problemaNegocio) createBusiness.mutate(businessDraft)
        }}
        loading={createBusiness.isPending}
        error={
          createBusiness.isError ? textoDeError(createBusiness.error, t('adm.noSePudoCrear')) : null
        }
        dirty={!!businessDraft && JSON.stringify(businessDraft) !== JSON.stringify(emptyBusiness)}
      >
        {businessDraft && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('adm.nombre')} htmlFor={`${id}-bn`} required>
                <Input
                  id={`${id}-bn`}
                  value={businessDraft.name}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, name: e.target.value })}
                />
              </Field>
              <Field label={t('adm.categoria')} htmlFor={`${id}-bc`} required>
                <Select
                  id={`${id}-bc`}
                  value={businessDraft.category}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {idioma === 'en' ? c.labelEn : c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t('adm.email')}
                htmlFor={`${id}-be`}
                hint={t('adm.emailPista')}
                required
              >
                <Input
                  id={`${id}-be`}
                  type="email"
                  value={businessDraft.email}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, email: e.target.value })}
                />
              </Field>
              <Field label={t('adm.telefono')} htmlFor={`${id}-bp`} hint={t('adm.opcional')}>
                <Input
                  id={`${id}-bp`}
                  value={businessDraft.phone}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, phone: e.target.value })}
                />
              </Field>
              <Field label={t('adm.calle')} htmlFor={`${id}-bs`} required>
                <Input
                  id={`${id}-bs`}
                  value={businessDraft.street}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, street: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-[1.6fr_1fr] gap-3">
                <Field label={t('adm.ciudad')} htmlFor={`${id}-bci`} required>
                  <Input
                    id={`${id}-bci`}
                    value={businessDraft.city}
                    onChange={(e) => setBusinessDraft({ ...businessDraft, city: e.target.value })}
                  />
                </Field>
                <Field label={t('adm.cp')} htmlFor={`${id}-bcp`} required>
                  <Input
                    id={`${id}-bcp`}
                    inputMode="numeric"
                    maxLength={5}
                    value={businessDraft.postalCode}
                    onChange={(e) =>
                      setBusinessDraft({ ...businessDraft, postalCode: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>

            {intentoNegocio && problemaNegocio && <ErrorNote>{problemaNegocio}</ErrorNote>}
          </>
        )}
      </FormDialog>

      <FormDialog
        open={!!userDraft || !!credencial}
        onClose={() => {
          setUserDraft(null)
          setCredencial(null)
        }}
        title={
          credencial
            ? t('eq.cuentaCreada')
            : t('adm.nuevaCuentaPara', {
                negocio: businesses?.find((b) => b.id === userDraft?.businessId)?.name ?? '',
              })
        }
        submitLabel={t('adm.crearCuenta')}
        onSubmit={() => {
          setIntentoCuenta(true)
          if (userDraft && !problemaUsuario) createUser.mutate(userDraft)
        }}
        loading={createUser.isPending}
        error={createUser.isError ? textoDeError(createUser.error, t('adm.noSePudoCrear')) : null}
        dirty={!credencial && !!userDraft && userDraft.name.trim() !== ''}
        sinPie={!!credencial}
      >
        {credencial ? (
          // Desde aquí no se manda correo: los datos se pasan a mano.
          <CredencialCreada
            email={credencial.email}
            password={credencial.password}
            avisoCorreo={false}
            onListo={() => setCredencial(null)}
          />
        ) : (
          userDraft && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('adm.nombre')} htmlFor={`${id}-un`} required>
                  <Input
                    id={`${id}-un`}
                    value={userDraft.name}
                    onChange={(e) => setUserDraft({ ...userDraft, name: e.target.value })}
                  />
                </Field>
                <Field
                  label={t('adm.email')}
                  htmlFor={`${id}-ue`}
                  hint={t('adm.emailAcceso')}
                  required
                >
                  <Input
                    id={`${id}-ue`}
                    type="email"
                    value={userDraft.email}
                    onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })}
                  />
                </Field>
                <Field
                  label={t('adm.contrasenaInicial')}
                  htmlFor={`${id}-up`}
                  hint={t('adm.contrasenaPista')}
                  required
                >
                  <div className="flex gap-2">
                    <Input
                      id={`${id}-up`}
                      autoComplete="new-password"
                      value={userDraft.password}
                      onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setUserDraft({ ...userDraft, password: generarPassword() })}
                    >
                      {t('eq.otra')}
                    </Button>
                  </div>
                </Field>
                <Field label={t('adm.permisos')} htmlFor={`${id}-ur`} required>
                  <Select
                    id={`${id}-ur`}
                    value={userDraft.role}
                    onChange={(e) =>
                      setUserDraft({ ...userDraft, role: e.target.value as UserDraft['role'] })
                    }
                  >
                    <option value="ADMIN">{t('panel.rolAdmin')}</option>
                    <option value="EMPLEADO">{t('panel.rolEmpleado')}</option>
                  </Select>
                </Field>
              </div>

              {intentoCuenta && problemaUsuario && <ErrorNote>{problemaUsuario}</ErrorNote>}
            </>
          )
        )}
      </FormDialog>

      <ConfirmDialog
        open={!!aAprobar}
        onClose={() => {
          aprobar.reset()
          setAAprobar(null)
        }}
        title={t('adm.aprobarTitulo', { nombre: aAprobar?.name ?? '' })}
        consecuencias={[t('adm.aprobarC1'), t('adm.aprobarC2'), t('adm.aprobarC3')]}
        confirmLabel={t('adm.aprobarYPublicar')}
        onConfirm={() => aAprobar && aprobar.mutate(aAprobar)}
        loading={aprobar.isPending}
        error={aprobar.isError ? textoDeError(aprobar.error, t('adm.noSePudoAprobar')) : null}
      />

      <p className="text-meta text-subtle">
        <Texto
          clave="adm.avisoAprobar"
          partes={{
            sinAprobar: (
              <strong className="font-semibold text-body-2">{t('adm.sinAprobar')}</strong>
            ),
          }}
        />
      </p>

      <p className="text-meta text-subtle">
        <Texto
          clave="adm.avisoConfigurar"
          partes={{
            serviciosYHorario: (
              <strong className="font-semibold text-body-2">{t('adm.serviciosYHorario')}</strong>
            ),
          }}
        />
      </p>
    </div>
  )
}
