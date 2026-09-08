import { useId, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CATEGORIES, categoryLabel, formatPrice, planLabel, subStatusLabel } from '@veline/shared'
import { api, ApiError, type AdminBusiness } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  ConfirmAction,
  EmptyState,
  ErrorNote,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
} from '../../components/ui'
import { Texto, useIdioma, usePlural } from '../../i18n/idioma'

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

function generarPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(14)))
    .map((n) => abc[n % abc.length])
    .join('')
}

const esEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

/** Recuadro de la contraseña recién creada. Solo se puede leer una vez. */
function Credencial({
  email,
  password,
  onClose,
}: {
  email: string
  password: string
  onClose: () => void
}) {
  const { t } = useIdioma()
  const [copiado, setCopiado] = useState(false)

  return (
    <Card className="border-brand/40 bg-brand/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui font-semibold text-ink">{t('adm.cuentaCreada')}</p>
          <p className="mt-1 text-body text-body">
            <Texto clave="adm.pasaleDatos" partes={{ email: <strong>{email}</strong> }} />
          </p>
          <code className="mt-2 inline-block rounded-lg bg-cream px-3 py-2 text-body font-semibold break-all text-ink">
            {password}
          </code>
          <p className="mt-2 text-meta text-muted">{t('adm.noSeConsulta')}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(password).then(() => setCopiado(true))
            }}
          >
            {copiado ? t('adm.copiada') : t('adm.copiar')}
          </Button>
          <IconButton label={t('adm.cerrarAviso')} onClick={onClose}>
            <span aria-hidden className="text-subheading leading-none">
              ×
            </span>
          </IconButton>
        </div>
      </div>
    </Card>
  )
}

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
function Suscripcion({ b, onDone }: { b: AdminBusiness; onDone: () => void }) {
  const { t, idioma, locale } = useIdioma()
  const plural = usePlural()
  const [notas, setNotas] = useState(b.adminNotes ?? '')

  const cambiar = useMutation({
    mutationFn: (body: Parameters<typeof api.updateSubscription>[1]) =>
      api.updateSubscription(b.id, body),
    onSuccess: onDone,
  })

  const cortado = b.subStatus === 'SUSPENDIDA' || b.subStatus === 'CANCELADA'

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
                loading={cambiar.isPending && cambiar.variables?.plan === p}
                onClick={() => cambiar.mutate({ plan: p })}
              >
                {planLabel(p, idioma)}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-meta text-muted">
            {plural(b.counts.staff, 'adm.conUnaPersona', 'adm.conVariasPersonas')}{' '}
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
                loading={cambiar.isPending && cambiar.variables?.trialDays === d}
                onClick={() => cambiar.mutate({ trialDays: d })}
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
              <Button
                size="sm"
                loading={cambiar.isPending && cambiar.variables?.status === 'ACTIVA'}
                onClick={() => cambiar.mutate({ status: 'ACTIVA' })}
              >
                {t('adm.reactivar')}
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="quiet"
                  loading={cambiar.isPending && cambiar.variables?.status === 'IMPAGADA'}
                  onClick={() => cambiar.mutate({ status: 'IMPAGADA' })}
                >
                  {t('adm.marcarImpagada')}
                </Button>
                <ConfirmAction
                  label={t('adm.suspender')}
                  question={t('adm.suspenderPregunta')}
                  confirmLabel={t('adm.siSuspender')}
                  loading={cambiar.isPending && cambiar.variables?.status === 'SUSPENDIDA'}
                  onConfirm={() => cambiar.mutate({ status: 'SUSPENDIDA' })}
                />
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
          cambiar.mutate({ adminNotes: notas.trim() })
        }}
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4"
      >
        <label className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <span className="text-meta font-semibold text-body-2">{t('adm.notaInterna')}</span>
          <Input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder={t('adm.notaEjemplo')}
          />
        </label>
        <Button type="submit" variant="secondary" loading={cambiar.isPending}>
          {t('adm.guardarNota')}
        </Button>
      </form>

      {cambiar.isError && (
        <div className="mt-3">
          <ErrorNote>
            {cambiar.error instanceof ApiError ? cambiar.error.message : t('adm.noSePudoCambiar')}
          </ErrorNote>
        </div>
      )}
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

export function PanelAdmin() {
  const { t, idioma } = useIdioma()
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const id = useId()

  const [businessDraft, setBusinessDraft] = useState<BusinessDraft | null>(null)
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null)
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)

  const { data: businesses, isLoading } = useQuery({
    queryKey: ['admin', 'businesses'],
    queryFn: api.adminBusinesses,
    enabled: user?.role === 'SUPERADMIN',
  })

  const createBusiness = useMutation({
    mutationFn: (d: BusinessDraft) =>
      api.createAdminBusiness({ ...d, phone: d.phone || undefined }),
    onSuccess: () => {
      setBusinessDraft(null)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['panel', 'businesses'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
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

  const aprobar = useMutation({
    mutationFn: (id: string) => api.approveBusiness(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return businesses ?? []
    return (businesses ?? []).filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        (b.email ?? '').toLowerCase().includes(q) ||
        categoryLabel(b.category).toLowerCase().includes(q),
    )
  }, [businesses, busqueda])

  const totales = useMemo(() => {
    const list = businesses ?? []
    return {
      negocios: list.length,
      citas: list.reduce((n, b) => n + b.counts.bookings, 0),
      usuarios: list.reduce((n, b) => n + b.counts.users, 0),
      // Un negocio sin servicios no puede recibir reservas: es el aviso que
      // de verdad le sirve a quien lleva la plataforma.
      sinServicios: list.filter((b) => b.counts.services === 0).length,
      // Los que se dieron de alta solos y nadie ha mirado todavía. Mientras
      // tanto no salen en el marketplace, así que cuanto antes se vean mejor.
      pendientes: list.filter((b) => !b.approvedAt).length,
    }
  }, [businesses])

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
          !businessDraft && (
            <Button
              onClick={() => {
                setUserDraft(null)
                setBusinessDraft(emptyBusiness)
              }}
            >
              {t('adm.darDeAlta')}
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('adm.negocios')} value={totales.negocios} />
        <Stat label={t('adm.citasTotales')} value={totales.citas} />
        <Stat label={t('adm.cuentasAcceso')} value={totales.usuarios} />
        <Stat label={t('adm.sinServicios')} value={totales.sinServicios} />
        <Stat label={t('adm.sinAprobar')} value={totales.pendientes} />
      </div>

      {credencial && <Credencial {...credencial} onClose={() => setCredencial(null)} />}

      {businessDraft && (
        <Card padded>
          <h2 className="mb-4 text-ui font-semibold text-ink">{t('adm.nuevoNegocio')}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!problemaNegocio) createBusiness.mutate(businessDraft)
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t('adm.nombre')} htmlFor={`${id}-bn`} required>
                <Input
                  id={`${id}-bn`}
                  placeholder={t('adm.nombreNegocioEjemplo')}
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
                  placeholder={t('adm.emailNegocioEjemplo')}
                  value={businessDraft.email}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, email: e.target.value })}
                />
              </Field>
              <Field label={t('adm.telefono')} htmlFor={`${id}-bp`} hint={t('adm.opcional')}>
                <Input
                  id={`${id}-bp`}
                  placeholder="600 000 000"
                  value={businessDraft.phone}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, phone: e.target.value })}
                />
              </Field>
              <Field label={t('adm.calle')} htmlFor={`${id}-bs`} required>
                <Input
                  id={`${id}-bs`}
                  placeholder={t('adm.calleEjemplo')}
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
                    placeholder="28013"
                    value={businessDraft.postalCode}
                    onChange={(e) =>
                      setBusinessDraft({ ...businessDraft, postalCode: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>

            {createBusiness.isError && (
              <ErrorNote>
                {createBusiness.error instanceof ApiError
                  ? createBusiness.error.message
                  : t('adm.noSePudoCrear')}
              </ErrorNote>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={createBusiness.isPending} disabled={!!problemaNegocio}>
                Crear negocio
              </Button>
              <Button type="button" variant="secondary" onClick={() => setBusinessDraft(null)}>
                Cancelar
              </Button>
              {problemaNegocio && <span className="text-meta text-muted">{problemaNegocio}</span>}
            </div>
          </form>
        </Card>
      )}

      {userDraft && (
        <Card padded>
          <h2 className="mb-4 text-ui font-semibold text-ink">
            Nueva cuenta para{' '}
            <span className="text-brand-text">
              {businesses?.find((b) => b.id === userDraft.businessId)?.name}
            </span>
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!problemaUsuario) createUser.mutate(userDraft)
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('adm.nombre')} htmlFor={`${id}-un`} required>
                <Input
                  id={`${id}-un`}
                  placeholder={t('adm.nombrePersonaEjemplo')}
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
                    Otra
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

            {createUser.isError && (
              <ErrorNote>
                {createUser.error instanceof ApiError
                  ? createUser.error.message
                  : 'No se ha podido crear'}
              </ErrorNote>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" loading={createUser.isPending} disabled={!!problemaUsuario}>
                {t('adm.crearCuenta')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setUserDraft(null)}>
                {t('adm.cancelar')}
              </Button>
              {problemaUsuario && <span className="text-meta text-muted">{problemaUsuario}</span>}
            </div>
          </form>
        </Card>
      )}

      {(businesses?.length ?? 0) > 6 && (
        <Input
          type="search"
          placeholder={t('adm.buscar')}
          aria-label={t('adm.buscarEtiqueta')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-sm"
        />
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

                <div className="ml-auto flex gap-1 sm:ml-0">
                  {!b.approvedAt && (
                    <Button
                      size="sm"
                      loading={aprobar.isPending && aprobar.variables === b.id}
                      onClick={() => aprobar.mutate(b.id)}
                    >
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

      {aprobar.isError && (
        <ErrorNote>
          {aprobar.error instanceof ApiError ? aprobar.error.message : t('adm.noSePudoAprobar')}
        </ErrorNote>
      )}

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
