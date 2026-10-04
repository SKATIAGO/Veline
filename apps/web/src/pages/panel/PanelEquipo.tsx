import { useEffect, useId, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatLongDate, formatMinutes, weekdayLong } from '@veline/shared'
import { api, type PanelStaff, type PanelUser } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { generarPassword } from '../../lib/password'
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
  Sheet,
  Skeleton,
  cx,
} from '../../components/ui'
import { FranjasSemanales, ORDEN_SEMANA, type Franja } from '../../components/FranjasSemanales'
import { useIdioma, usePlural, type Clave } from '../../i18n/idioma'
import { Bloqueo, ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'
import { FormDialog } from '../../components/FormDialog'
import { CredencialCreada } from '../../components/Credencial'
import { RowMenu } from '../../components/RowMenu'
import { Tabs, panelProps } from '../../components/Tabs'
import { Wizard } from '../../components/Wizard'

/**
 * Equipo: quien atiende las citas y quien entra al panel, en una sola lista.
 *
 * Antes eran dos pantallas de la misma gente: «Empleados» (quien atiende,
 * Staff) y «Administrador» (quien entra al panel, User), sin nada que las
 * uniera. Dar de alta a alguien entero eran tres pasos en dos sitios, y «Dar de
 * alta» convivía con «Dar de baja» significando cosas distintas.
 *
 * Ahora cada persona tiene una ficha con lo suyo: si atiende citas (y dónde,
 * y con qué horario) y si entra al panel (y con qué permisos). Puede ser las
 * dos cosas, solo una —el chico de los sábados no necesita cuenta; el dueño
 * que solo mira números no atiende—, y su ficha y su cuenta quedan enlazadas.
 */

const ROL_CLAVE: Record<string, Clave> = {
  ADMIN: 'panel.rolAdmin',
  EMPLEADO: 'panel.rolEmpleado',
  SUPERADMIN: 'panel.rolSuperadmin',
}
const ROL_AYUDA: Record<string, Clave> = {
  ADMIN: 'eq.ayudaAdmin',
  EMPLEADO: 'eq.ayudaEmpleado',
  SUPERADMIN: 'eq.ayudaSuperadmin',
}

/** Una persona del equipo: su ficha de quien atiende, su cuenta, o las dos. */
interface Persona {
  clave: string
  nombre: string
  staff: PanelStaff | null
  user: PanelUser | null
}

const esEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim())

/**
 * El editor del horario propio de una persona, dentro de la ficha.
 *
 * El título del diálogo lleva el nombre:
 * aquí sí hace falta repetirlo, porque el resto del contenido —siete días
 * iguales— no dice de quién es.
 */
function EditorHorarioPersona({
  slug,
  staffId,
  nombre,
  onClose,
}: {
  slug: string
  staffId: string
  nombre: string
  onClose: () => void
}) {
  const { t } = useIdioma()
  const queryClient = useQueryClient()
  const [week, setWeek] = useState<Record<number, Franja[]>>({})
  // Para saber si se ha tocado algo: cerrar con cambios pregunta antes.
  const [tocado, setTocado] = useState(false)

  const { data: hours, isLoading } = useQuery({
    queryKey: ['panel', slug, 'staff', staffId, 'hours'],
    queryFn: () => api.staffHours(slug, staffId),
  })

  useEffect(() => {
    if (!hours) return
    const next: Record<number, Franja[]> = {}
    for (const wd of ORDEN_SEMANA) next[wd] = []
    for (const hr of hours)
      next[hr.weekday] = [...(next[hr.weekday] ?? []), { startMin: hr.startMin, endMin: hr.endMin }]
    setWeek(next)
  }, [hours])

  const save = useMutation({
    mutationFn: () =>
      api.saveStaffHours(
        slug,
        staffId,
        ORDEN_SEMANA.flatMap((wd) => (week[wd] ?? []).map((r) => ({ weekday: wd, ...r }))),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['availability', slug] })
      aviso.ok(t('pers.horarioGuardado', { nombre }))
      onClose()
    },
  })

  const mutate = (wd: number, ranges: Franja[]) => {
    setWeek((prev) => ({ ...prev, [wd]: ranges }))
    setTocado(true)
  }

  /** Copia el día a los demás laborables. Rellenar siete días a mano cansa. */
  const copiarALaborables = (wd: number) => {
    const origen = week[wd] ?? []
    setWeek((prev) => {
      const next = { ...prev }
      for (const otro of [1, 2, 3, 4, 5]) next[otro] = origen.map((r) => ({ ...r }))
      return next
    })
    setTocado(true)
  }

  const invalid = ORDEN_SEMANA.some((wd) => (week[wd] ?? []).some((r) => r.endMin <= r.startMin))

  /* Antes era una ficha con sus propios botones, y cerrarla —tocando fuera,
     con la ✕ o con «atrás»— tiraba lo cambiado sin decir nada. */
  return (
    <FormDialog
      open
      onClose={onClose}
      title={t('pers.horarioDe', { nombre })}
      hint={t('pers.horarioAviso')}
      submitLabel={t('hor.guardar')}
      onSubmit={() => !invalid && save.mutate()}
      loading={save.isPending}
      error={save.isError ? t('pers.horarioNoGuardado') : null}
      dirty={tocado}
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {ORDEN_SEMANA.map((wd) => (
            <Skeleton key={wd} className="h-12" />
          ))}
        </div>
      ) : (
        <FranjasSemanales week={week} onChange={mutate} onCopiarALaborables={copiarALaborables} />
      )}
      {invalid && <ErrorNote>{t('hor.franjaInvalida')}</ErrorNote>}
    </FormDialog>
  )
}

/**
 * Dar de baja a una persona, con sus citas resueltas antes.
 *
 * Antes era un «¿Seguro? Sí» y, si tenía citas por delante, el servidor lo
 * rechazaba DESPUÉS de confirmar. Ahora las citas salen aquí, cada una con
 * a quién pasarla, y «Dar de baja» no se puede pulsar hasta que no queda
 * ninguna. Pasarla no avisa al cliente: la hora no cambia, solo quién le
 * atiende.
 */
function BajaPersona({
  slug,
  persona,
  otras,
  onClose,
}: {
  slug: string
  persona: PanelStaff | null
  otras: PanelStaff[]
  onClose: () => void
}) {
  const { t, idioma, locale } = useIdioma()
  const queryClient = useQueryClient()
  const [destino, setDestino] = useState<Record<string, string>>({})
  const [fallos, setFallos] = useState<Record<string, string>>({})

  const { data: pendientes, isLoading } = useQuery({
    queryKey: ['panel', slug, 'staff', persona?.id, 'pendientes'],
    queryFn: () => api.staffPendientes(slug, persona!.id),
    enabled: !!persona,
  })

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    queryClient.invalidateQueries({ queryKey: ['business', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const pasar = useMutation({
    mutationFn: ({ citaId, startsAt, a }: { citaId: string; startsAt: string; a: string }) =>
      api.rescheduleBooking(slug, citaId, startsAt, false, a),
    onSuccess: (_r, v) => {
      setFallos((f) => ({ ...f, [v.citaId]: '' }))
      invalidar()
    },
    onError: (err, v) =>
      setFallos((f) => ({ ...f, [v.citaId]: textoDeError(err, t('pers.noSePudoPasar')) })),
  })

  const baja = useMutation({
    mutationFn: () => api.updateStaff(slug, persona!.id, { active: false }),
    onSuccess: () => {
      const quien = persona!
      invalidar()
      onClose()
      aviso.ok(t('pers.bajaHecha', { nombre: quien.name }), {
        texto: t('avisos.deshacer'),
        onClick: () =>
          api
            .updateStaff(slug, quien.id, { active: true })
            .then(invalidar)
            .catch((e) => aviso.error(textoDeError(e, t('avisos.error')))),
      })
    },
  })

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    })
  const quedan = pendientes?.length ?? 0

  return (
    <ConfirmDialog
      open={!!persona}
      onClose={() => {
        baja.reset()
        onClose()
      }}
      title={t('pers.bajaTitulo', { nombre: persona?.name ?? '' })}
      consecuencias={[t('pers.bajaC1'), t('pers.bajaC2'), t('pers.bajaC3')]}
      confirmLabel={t('pers.darDeBaja')}
      onConfirm={() => baja.mutate()}
      loading={baja.isPending}
      error={baja.isError ? textoDeError(baja.error, t('pers.noSePudoCambiar')) : null}
      bloqueado={isLoading || quedan > 0}
    >
      {isLoading && <Skeleton className="h-16" />}
      {quedan > 0 && (
        <Bloqueo titulo={t('pers.bajaAntes', { n: quedan })}>
          {otras.length === 0 && (
            <p className="text-meta text-amber-900">{t('pers.bajaSinOtras')}</p>
          )}
          <ul className="flex flex-col gap-2">
            {pendientes!.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-3 py-2.5"
              >
                <div className="text-meta">
                  <span className="font-semibold text-ink first-letter:uppercase">
                    {formatLongDate(new Date(c.startsAt), idioma)} · {hora(c.startsAt)}
                  </span>
                  <span className="block text-muted">
                    {c.servicio} · {c.cliente}
                  </span>
                </div>
                {otras.length > 0 && (
                  <div className="flex gap-2">
                    <Select
                      aria-label={t('pers.pasarA', { cliente: c.cliente })}
                      value={destino[c.id] ?? ''}
                      onChange={(e) => setDestino((d) => ({ ...d, [c.id]: e.target.value }))}
                      className="h-9 flex-1 text-meta"
                    >
                      <option value="">{t('pers.pasarAElegir')}</option>
                      {otras.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!destino[c.id]}
                      loading={pasar.isPending && pasar.variables?.citaId === c.id}
                      onClick={() =>
                        pasar.mutate({ citaId: c.id, startsAt: c.startsAt, a: destino[c.id]! })
                      }
                    >
                      {t('pers.pasar')}
                    </Button>
                  </div>
                )}
                {fallos[c.id] && (
                  <p role="alert" className="text-meta font-semibold text-danger">
                    {fallos[c.id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-meta text-amber-900">{t('pers.bajaPasarAviso')}</p>
        </Bloqueo>
      )}
    </ConfirmDialog>
  )
}

/**
 * Dar de alta a una persona que atiende: crearle una cuenta para entrar al
 * panel. Son dos fichas independientes a propósito (ver el aviso de abajo
 * del todo), así que esto no enlaza nada — solo rellena el nombre para no
 * escribirlo dos veces y deja el rol fijo en Empleado, porque quien atiende
 * clientes no necesita permisos de administrador por defecto.
 */
function CrearAccesoPersona({
  slug,
  staffId,
  nombreInicial,
  onClose,
}: {
  slug: string
  /** Su ficha: la cuenta queda enlazada con ella. */
  staffId: string
  nombreInicial: string
  onClose: () => void
}) {
  const { t } = useIdioma()
  const id = useId()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generarPassword())
  const [role, setRole] = useState<'ADMIN' | 'EMPLEADO'>('EMPLEADO')
  const [creada, setCreada] = useState<{ email: string; password: string } | null>(null)

  const crear = useMutation({
    mutationFn: () =>
      api.createPanelUser(slug, {
        name: nombreInicial,
        email: email.trim(),
        password,
        role,
        staffId,
      }),
    onSuccess: () => {
      setCreada({ email: email.trim(), password })
      queryClient.invalidateQueries({ queryKey: ['panel', slug, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['panel', slug, 'staff'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const problema = !esEmail(email)
    ? t('eq.errEmail')
    : password.length < 10
      ? t('eq.errContrasena')
      : null

  const [intentado, setIntentado] = useState(false)

  return (
    <FormDialog
      open
      onClose={onClose}
      title={creada ? t('eq.cuentaCreada') : t('pers.altaTitulo', { nombre: nombreInicial })}
      hint={creada ? undefined : t('pers.altaAviso')}
      submitLabel={t('eq.crearCuenta')}
      onSubmit={() => {
        setIntentado(true)
        if (!problema) crear.mutate()
      }}
      loading={crear.isPending}
      error={crear.isError ? textoDeError(crear.error, t('eq.noSePudoCrear')) : null}
      dirty={!creada && email.trim() !== ''}
      sinPie={!!creada}
    >
      {creada ? (
        <CredencialCreada email={creada.email} password={creada.password} onListo={onClose} />
      ) : (
        <>
          <CamposCuenta
            id={id}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            role={role}
            setRole={setRole}
          />

          {intentado && problema && <ErrorNote>{problema}</ErrorNote>}
        </>
      )}
    </FormDialog>
  )
}

/** Correo, contraseña inicial y permisos de una cuenta nueva. */
function CamposCuenta({
  id,
  email,
  setEmail,
  password,
  setPassword,
  role,
  setRole,
}: {
  id: string
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  role: 'ADMIN' | 'EMPLEADO'
  setRole: (r: 'ADMIN' | 'EMPLEADO') => void
}) {
  const { t } = useIdioma()
  return (
    <>
      <Field label={t('eq.email')} htmlFor={`${id}-email`} hint={t('eq.emailPista')} required>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field
        label={t('eq.contrasenaInicial')}
        htmlFor={`${id}-pass`}
        hint={t('eq.contrasenaPista')}
        required
      >
        <div className="flex gap-2">
          <Input
            id={`${id}-pass`}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button variant="secondary" onClick={() => setPassword(generarPassword())}>
            {t('eq.otra')}
          </Button>
        </div>
      </Field>
      <Field label={t('eq.permisos')} htmlFor={`${id}-role`} hint={t(ROL_AYUDA[role]!)} required>
        <Select
          id={`${id}-role`}
          value={role}
          onChange={(e) => setRole(e.target.value as 'ADMIN' | 'EMPLEADO')}
        >
          <option value="EMPLEADO">{t('panel.rolEmpleado')}</option>
          <option value="ADMIN">{t('panel.rolAdmin')}</option>
        </Select>
      </Field>
    </>
  )
}

/** El horario propio de alguien, para leerlo en su ficha sin abrir el editor. */
function ResumenHorario({ slug, staffId }: { slug: string; staffId: string }) {
  const { t, idioma } = useIdioma()
  const { data: horas, isLoading } = useQuery({
    queryKey: ['panel', slug, 'staff', staffId, 'hours'],
    queryFn: () => api.staffHours(slug, staffId),
  })
  if (isLoading) return <Skeleton className="h-32" />
  if (!horas?.length)
    return <p className="text-body text-muted">{t('equipo.sigueHorarioNegocio')}</p>
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-body">
      {ORDEN_SEMANA.map((wd) => {
        const del = horas.filter((h) => h.weekday === wd)
        return (
          <div key={wd} className="contents">
            <dt className="text-muted first-letter:uppercase">{weekdayLong(wd, idioma)}</dt>
            <dd className={cx('tabular-nums', del.length ? 'text-ink' : 'text-subtle')}>
              {del.length
                ? del
                    .map((h) => `${formatMinutes(h.startMin)}–${formatMinutes(h.endMin)}`)
                    .join(' · ')
                : t('equipo.noAtiende')}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

type PestanaFicha = 'ficha' | 'horario' | 'acceso'

/**
 * La ficha de una persona, en un panel lateral: la lista sigue a la vista a la
 * izquierda en pantalla grande, y en el móvil ocupa la pantalla.
 *
 * Lo que se edita desde aquí (nombre, horario, permisos, crear el acceso) abre
 * su diálogo encima; lo que corta (dar de baja, quitar el acceso), su
 * confirmación encima. Al cerrarlos se vuelve a la ficha tal como estaba.
 */
function FichaPersona({
  slug,
  persona,
  onClose,
  esYo,
  varios,
  nombreLocal,
  sinEnlazar,
  acciones,
}: {
  slug: string
  persona: Persona | null
  onClose: () => void
  esYo: boolean
  varios: boolean
  nombreLocal: (id: string | null) => string
  /** Cuentas activas sin ficha de quien atiende: con cuál se puede enlazar. */
  sinEnlazar: PanelUser[]
  acciones: {
    editar: (s: PanelStaff) => void
    horario: (s: PanelStaff) => void
    crearAcceso: (s: PanelStaff) => void
    enlazar: (s: PanelStaff) => void
    permisos: (u: PanelUser) => void
    quitarAcceso: (u: PanelUser) => void
    devolverAcceso: (u: PanelUser) => void
    queAtienda: (u: PanelUser) => void
    baja: (s: PanelStaff) => void
    reactivar: (s: PanelStaff) => void
    eliminar: (s: PanelStaff) => void
  }
}) {
  const { t } = useIdioma()
  const plural = usePlural()
  const idBase = useId()
  const [pestana, setPestana] = useState<PestanaFicha>('ficha')
  // Al abrir otra persona, se empieza por su ficha.
  useEffect(() => setPestana('ficha'), [persona?.clave])

  const s = persona?.staff ?? null
  const u = persona?.user ?? null
  const pestanas: { id: PestanaFicha; label: string }[] = [
    { id: 'ficha', label: t('equipo.pestanaFicha') },
    ...(s ? [{ id: 'horario' as const, label: t('equipo.pestanaHorario') }] : []),
    { id: 'acceso', label: t('equipo.pestanaAcceso') },
  ]

  return (
    <Sheet open={!!persona} onClose={onClose} title={persona?.nombre ?? ''} lado="derecha">
      {persona && (
        <div className="flex min-h-[calc(100%-3rem)] flex-col">
          <div className="flex items-center gap-3 pr-10">
            <span
              aria-hidden
              className={cx(
                'grid size-12 shrink-0 place-items-center rounded-full text-ui font-bold',
                s?.active || u?.active ? 'bg-brand text-white' : 'bg-line text-muted',
              )}
            >
              {persona.nombre.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-subheading font-semibold text-ink">
                {persona.nombre}
              </h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <EtiquetasPersona persona={persona} esYo={esYo} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Tabs
              idBase={idBase}
              tabs={pestanas}
              activa={pestana}
              onCambiar={setPestana}
              label={t('equipo.pestanas')}
            />
          </div>

          <div
            {...panelProps(idBase, pestana)}
            className="flex flex-1 flex-col gap-4 py-5 outline-none"
          >
            {pestana === 'ficha' && (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-body">
                  <dt className="text-muted">{t('equipo.atiendeCitas')}</dt>
                  <dd className="text-right font-semibold text-ink">
                    {s ? (s.active ? t('equipo.si') : t('pers.deBaja')) : t('equipo.no')}
                  </dd>
                  {s && varios && (
                    <>
                      <dt className="text-muted">{t('pers.dondeAtiende')}</dt>
                      <dd className="text-right font-semibold text-ink">
                        {nombreLocal(s.locationId)}
                      </dd>
                    </>
                  )}
                  {s && (
                    <>
                      <dt className="text-muted">{t('equipo.proximasCitas')}</dt>
                      <dd className="text-right font-semibold text-ink tabular-nums">
                        {s.upcomingBookings ?? 0}
                      </dd>
                      <dt className="text-muted">{t('equipo.horario')}</dt>
                      <dd className="text-right font-semibold text-ink">
                        {s.hasHours ? t('pers.horarioPropio') : t('equipo.elDelNegocio')}
                      </dd>
                    </>
                  )}
                  <dt className="text-muted">{t('equipo.accesoAlPanel')}</dt>
                  <dd className="text-right font-semibold text-ink">
                    {u ? (u.active ? t(ROL_CLAVE[u.role]!) : t('eq.sinAcceso')) : t('equipo.no')}
                  </dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {s && (
                    <Button variant="secondary" onClick={() => acciones.editar(s)}>
                      {t('equipo.editarNombreLocal')}
                    </Button>
                  )}
                  {!s && u && (
                    <Button variant="secondary" onClick={() => acciones.queAtienda(u)}>
                      {t('equipo.queAtienda')}
                    </Button>
                  )}
                </div>
                {!s && <p className="text-meta text-muted">{t('equipo.queAtiendaPista')}</p>}
              </>
            )}

            {pestana === 'horario' && s && (
              <>
                <ResumenHorario slug={slug} staffId={s.id} />
                <div>
                  <Button variant="secondary" onClick={() => acciones.horario(s)}>
                    {t('equipo.editarHorario')}
                  </Button>
                </div>
                <p className="text-meta text-muted">{t('pers.horarioAviso')}</p>
              </>
            )}

            {pestana === 'acceso' &&
              (u ? (
                <>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-body">
                    <dt className="text-muted">{t('cred.correo')}</dt>
                    <dd className="text-right font-semibold break-all text-ink">{u.email}</dd>
                    <dt className="text-muted">{t('eq.permisos')}</dt>
                    <dd className="text-right font-semibold text-ink">
                      {t(ROL_CLAVE[u.role]!)}
                      <span className="block text-meta font-normal text-muted">
                        {t(ROL_AYUDA[u.role]!)}
                      </span>
                    </dd>
                    <dt className="text-muted">{t('equipo.estado')}</dt>
                    <dd className="text-right font-semibold text-ink">
                      {u.active ? t('equipo.puedeEntrar') : t('eq.sinAcceso')}
                    </dd>
                  </dl>
                  {esYo ? (
                    <p className="text-meta text-muted">{t('equipo.tuCuenta')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {u.active && (
                        <Button variant="secondary" onClick={() => acciones.permisos(u)}>
                          {t('equipo.cambiarPermisos')}
                        </Button>
                      )}
                      {u.active ? (
                        <Button variant="danger" onClick={() => acciones.quitarAcceso(u)}>
                          {t('eq.quitarAcceso')}
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => acciones.devolverAcceso(u)}>
                          {t('eq.devolverAcceso')}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                s && (
                  <>
                    <p className="text-body text-body-2">
                      {t('equipo.sinAccesoTexto', { nombre: s.name })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => acciones.crearAcceso(s)}>
                        {t('pers.crearAcceso')}
                      </Button>
                      {sinEnlazar.length > 0 && (
                        <Button variant="secondary" onClick={() => acciones.enlazar(s)}>
                          {t('equipo.enlazarCuenta')}
                        </Button>
                      )}
                    </div>
                  </>
                )
              ))}
          </div>

          {/* Lo que corta, abajo y aparte, como en el resto del panel. */}
          {s && (
            <div className="sticky bottom-[calc(-1*max(1.5rem,env(safe-area-inset-bottom)))] -mx-5 -mb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-wrap gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:-mb-6 sm:-bottom-6 sm:px-6 sm:pb-5">
              {s.active ? (
                <Button variant="danger" onClick={() => acciones.baja(s)}>
                  {t('pers.darDeBaja')}
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={() => acciones.reactivar(s)}>
                    {t('pers.volverAActivar')}
                  </Button>
                  <Button variant="danger" onClick={() => acciones.eliminar(s)}>
                    {t('pers.eliminar')}
                  </Button>
                </>
              )}
              <span className="ml-auto self-center text-meta text-muted">
                {s.upcomingBookings
                  ? plural(
                      s.upcomingBookings,
                      'pers.unaCitaPorDelante',
                      'pers.variasCitasPorDelante',
                    )
                  : t('pers.sinCitasPendientes')}
              </span>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** Las etiquetas de una persona: qué hace en el negocio, de un vistazo. */
function EtiquetasPersona({ persona, esYo }: { persona: Persona; esYo: boolean }) {
  const { t } = useIdioma()
  const { staff: s, user: u } = persona
  return (
    <>
      {esYo && <Badge>{t('eq.tu')}</Badge>}
      {s &&
        (s.active ? (
          <Badge tone="ok">{t('equipo.atiende')}</Badge>
        ) : (
          <Badge tone="off">{t('pers.deBaja')}</Badge>
        ))}
      {u ? (
        u.active ? (
          <Badge tone={u.role === 'ADMIN' ? 'brand' : 'neutral'}>{t(ROL_CLAVE[u.role]!)}</Badge>
        ) : (
          <Badge tone="off">{t('eq.sinAcceso')}</Badge>
        )
      ) : (
        <Badge>{t('equipo.sinCuenta')}</Badge>
      )}
    </>
  )
}

/**
 * Incorporar a alguien: quién es, si atiende citas (y con qué horario) y si
 * entra al panel. Todo se crea de una vez al final, o nada.
 */
function Incorporar({
  slug,
  open,
  onClose,
  locales,
}: {
  slug: string
  open: boolean
  onClose: () => void
  locales: { id: string; name: string }[]
}) {
  const { t } = useIdioma()
  const id = useId()
  const queryClient = useQueryClient()
  const varios = locales.length > 1
  const [paso, setPaso] = useState(0)
  const [nombre, setNombre] = useState('')
  const [atiende, setAtiende] = useState(true)
  const [local, setLocal] = useState('')
  const [propio, setPropio] = useState(false)
  const [semana, setSemana] = useState<Record<number, Franja[]>>({})
  const [acceso, setAcceso] = useState<'NO' | 'EMPLEADO' | 'ADMIN'>('NO')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generarPassword())
  const [creada, setCreada] = useState<{ email: string; password: string } | null>(null)

  const franjas = ORDEN_SEMANA.flatMap((wd) =>
    (semana[wd] ?? []).map((f) => ({ weekday: wd, ...f })),
  )

  const incorporar = useMutation({
    mutationFn: () =>
      api.incorporar(slug, {
        name: nombre.trim(),
        atiende,
        ...(atiende && varios ? { locationId: local || null } : {}),
        ...(atiende && propio ? { horario: franjas } : {}),
        acceso: acceso === 'NO' ? null : { email: email.trim(), password, role: acceso },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel', slug] })
      queryClient.invalidateQueries({ queryKey: ['business', slug] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
      if (acceso !== 'NO') {
        setCreada({ email: email.trim(), password })
        return
      }
      aviso.ok(t('equipo.incorporada', { nombre: nombre.trim() }))
      onClose()
    },
  })

  const opcion = (activa: boolean, titulo: string, texto: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={cx(
        'flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors duration-200',
        activa ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className="text-[14px] font-semibold text-ink">{titulo}</span>
      <span className="text-meta text-muted">{texto}</span>
    </button>
  )

  const pasos = [
    {
      id: 'quien',
      titulo: t('equipo.pasoQuien'),
      problema: nombre.trim().length < 2 ? t('eq.errNombre') : null,
      contenido: (
        <>
          <Field
            label={t('pers.nombre')}
            htmlFor={`${id}-nombre`}
            hint={t('pers.anadirPista')}
            required
          >
            <Input
              id={`${id}-nombre`}
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-meta font-semibold text-body-2">
              {t('equipo.queHace')}
            </legend>
            {opcion(atiende, t('equipo.atiendeSi'), t('equipo.atiendeSiPista'), () =>
              setAtiende(true),
            )}
            {opcion(!atiende, t('equipo.atiendeNo'), t('equipo.atiendeNoPista'), () => {
              setAtiende(false)
              if (acceso === 'NO') setAcceso('EMPLEADO')
            })}
          </fieldset>
          {atiende && varios && (
            <Field
              label={t('pers.dondeAtiende')}
              htmlFor={`${id}-local`}
              hint={t('pers.dondeAtiendePista')}
            >
              <Select id={`${id}-local`} value={local} onChange={(e) => setLocal(e.target.value)}>
                <option value="">{t('pers.enTodos')}</option>
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </>
      ),
    },
    ...(atiende
      ? [
          {
            id: 'horario',
            titulo: t('equipo.pasoHorario'),
            problema:
              propio && franjas.some((f) => f.endMin <= f.startMin)
                ? t('hor.franjaInvalida')
                : propio && franjas.length === 0
                  ? t('equipo.errSinFranjas')
                  : null,
            contenido: (
              <>
                <div className="flex flex-col gap-2">
                  {opcion(
                    !propio,
                    t('equipo.horarioNegocio'),
                    t('equipo.horarioNegocioPista'),
                    () => setPropio(false),
                  )}
                  {opcion(propio, t('equipo.horarioPropio'), t('equipo.horarioPropioPista'), () =>
                    setPropio(true),
                  )}
                </div>
                {propio && (
                  <FranjasSemanales
                    week={semana}
                    onChange={(wd, r) => setSemana((s) => ({ ...s, [wd]: r }))}
                    onCopiarALaborables={(wd) =>
                      setSemana((s) => {
                        const n = { ...s }
                        for (const otro of [1, 2, 3, 4, 5])
                          n[otro] = (s[wd] ?? []).map((f) => ({ ...f }))
                        return n
                      })
                    }
                  />
                )}
              </>
            ),
          },
        ]
      : []),
    {
      id: 'acceso',
      titulo: t('equipo.pasoAcceso'),
      problema:
        acceso !== 'NO' && !esEmail(email)
          ? t('eq.errEmail')
          : acceso !== 'NO' && password.length < 10
            ? t('eq.errContrasena')
            : !atiende && acceso === 'NO'
              ? t('equipo.errNiAtiendeNiEntra')
              : null,
      contenido: (
        <>
          <div className="flex flex-col gap-2">
            {atiende &&
              opcion(acceso === 'NO', t('equipo.accesoNo'), t('equipo.accesoNoPista'), () =>
                setAcceso('NO'),
              )}
            {opcion(acceso === 'EMPLEADO', t('panel.rolEmpleado'), t('eq.ayudaEmpleado'), () =>
              setAcceso('EMPLEADO'),
            )}
            {opcion(acceso === 'ADMIN', t('panel.rolAdmin'), t('eq.ayudaAdmin'), () =>
              setAcceso('ADMIN'),
            )}
          </div>
          {acceso !== 'NO' && (
            <>
              <Field
                label={t('eq.email')}
                htmlFor={`${id}-email`}
                hint={t('eq.emailPista')}
                required
              >
                <Input
                  id={`${id}-email`}
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field
                label={t('eq.contrasenaInicial')}
                htmlFor={`${id}-pass`}
                hint={t('eq.contrasenaPista')}
                required
              >
                <div className="flex gap-2">
                  <Input
                    id={`${id}-pass`}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button variant="secondary" onClick={() => setPassword(generarPassword())}>
                    {t('eq.otra')}
                  </Button>
                </div>
              </Field>
            </>
          )}
        </>
      ),
    },
    {
      id: 'revisar',
      titulo: t('equipo.pasoRevisar'),
      problema: null,
      contenido: (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-xl bg-cream px-4 py-3 text-body">
          <dt className="text-muted">{t('pers.nombre')}</dt>
          <dd className="text-right font-semibold text-ink">{nombre.trim()}</dd>
          <dt className="text-muted">{t('equipo.atiendeCitas')}</dt>
          <dd className="text-right font-semibold text-ink">
            {atiende
              ? varios
                ? t('equipo.siEn', {
                    local: locales.find((l) => l.id === local)?.name ?? t('pers.enTodos'),
                  })
                : t('equipo.si')
              : t('equipo.no')}
          </dd>
          {atiende && (
            <>
              <dt className="text-muted">{t('equipo.horario')}</dt>
              <dd className="text-right font-semibold text-ink">
                {propio ? t('pers.horarioPropio') : t('equipo.elDelNegocio')}
              </dd>
            </>
          )}
          <dt className="text-muted">{t('equipo.accesoAlPanel')}</dt>
          <dd className="text-right font-semibold break-all text-ink">
            {acceso === 'NO' ? t('equipo.no') : `${t(ROL_CLAVE[acceso]!)} · ${email.trim()}`}
          </dd>
        </dl>
      ),
    },
  ]

  const tocado = nombre.trim() !== '' || email.trim() !== '' || franjas.length > 0

  return (
    <Wizard
      open={open}
      onClose={onClose}
      title={
        creada
          ? t('equipo.incorporadaTitulo', { nombre: nombre.trim() })
          : t('equipo.incorporarTitulo')
      }
      pasos={pasos}
      paso={Math.min(paso, pasos.length - 1)}
      setPaso={setPaso}
      finalLabel={t('equipo.incorporarBoton')}
      onFinalizar={() => incorporar.mutate()}
      loading={incorporar.isPending}
      error={incorporar.isError ? textoDeError(incorporar.error, t('avisos.error')) : null}
      dirty={tocado}
      resultado={
        creada && (
          <CredencialCreada email={creada.email} password={creada.password} onListo={onClose} />
        )
      }
    />
  )
}

export function PanelEquipo() {
  const { t } = useIdioma()
  const { slug = '' } = useParams()
  const { user: yo } = useAuth()
  const queryClient = useQueryClient()

  const { data: locales } = useQuery({
    queryKey: ['panel', slug, 'locales'],
    queryFn: () => api.panelLocales(slug),
  })
  const varios = (locales?.length ?? 0) > 1
  const nombreLocal = (lid: string | null) =>
    locales?.find((l) => l.id === lid)?.name ?? t('pers.enTodosLosLocales')

  const { data: staff, isLoading: cargandoStaff } = useQuery({
    queryKey: ['panel', slug, 'staff'],
    queryFn: () => api.panelStaff(slug),
  })
  const { data: users, isLoading: cargandoUsers } = useQuery({
    queryKey: ['panel', slug, 'users'],
    queryFn: () => api.panelUsers(slug),
  })

  /* La lista junta las dos cosas: cada ficha de quien atiende con su cuenta,
     y luego las cuentas de quien no atiende (el dueño que solo administra).
     Primero quien está activo en algo; dentro, por nombre. */
  const personas = useMemo<Persona[]>(() => {
    if (!staff || !users) return []
    const conFicha = staff.map((s) => ({
      clave: s.id,
      nombre: s.name,
      staff: s,
      user: users.find((u) => u.id === s.userId) ?? null,
    }))
    const enlazadas = new Set(staff.map((s) => s.userId).filter(Boolean))
    const soloCuenta = users
      .filter((u) => !enlazadas.has(u.id))
      .map((u) => ({ clave: `u-${u.id}`, nombre: u.name, staff: null, user: u }))
    const activa = (p: Persona) => Boolean(p.staff?.active || p.user?.active)
    return [...conFicha, ...soloCuenta].sort(
      (a, b) => Number(activa(b)) - Number(activa(a)) || a.nombre.localeCompare(b.nombre),
    )
  }, [staff, users])

  const atienden = staff?.filter((s) => s.active).length ?? 0
  const entran = users?.filter((u) => u.active).length ?? 0

  /* La ficha abierta se recuerda por sus dos ids, el de quien atiende y el de
     su cuenta, y se busca por cualquiera: al enlazarlas o al hacer que alguien
     que solo entraba al panel atienda citas, la persona cambia de forma en la
     lista, y con un solo id la ficha se cerraba sola. */
  const [abierta, setAbierta] = useState<{ s?: string; u?: string } | null>(null)
  const abrir = (p: Persona) => setAbierta({ s: p.staff?.id, u: p.user?.id })
  const persona =
    (abierta &&
      personas.find(
        (p) => (abierta.s && p.staff?.id === abierta.s) || (abierta.u && p.user?.id === abierta.u),
      )) ||
    null
  const [incorporando, setIncorporando] = useState(false)
  const [editando, setEditando] = useState<PanelStaff | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [localEdit, setLocalEdit] = useState('')
  const [horarioDe, setHorarioDe] = useState<PanelStaff | null>(null)
  const [accesoPara, setAccesoPara] = useState<PanelStaff | null>(null)
  const [enlazarA, setEnlazarA] = useState<PanelStaff | null>(null)
  const [cuentaElegida, setCuentaElegida] = useState('')
  const [permisosDe, setPermisosDe] = useState<PanelUser | null>(null)
  const [rolNuevo, setRolNuevo] = useState<'ADMIN' | 'EMPLEADO'>('EMPLEADO')
  const [aQuitar, setAQuitar] = useState<PanelUser | null>(null)
  const [bajaDe, setBajaDe] = useState<PanelStaff | null>(null)
  const [eliminarA, setEliminarA] = useState<PanelStaff | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    queryClient.invalidateQueries({ queryKey: ['business', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }
  const fallo = (err: unknown) => aviso.error(textoDeError(err, t('avisos.error')))

  const guardarEdicion = useMutation({
    mutationFn: (s: PanelStaff) =>
      api.updateStaff(slug, s.id, {
        name: nombreEdit.trim(),
        ...(varios ? { locationId: localEdit || null } : {}),
      }),
    onSuccess: () => {
      setEditando(null)
      invalidate()
      aviso.ok(t('avisos.guardado'))
    },
  })

  const enlazar = useMutation({
    mutationFn: (s: PanelStaff) => api.updateStaff(slug, s.id, { userId: cuentaElegida }),
    onSuccess: () => {
      setEnlazarA(null)
      invalidate()
      aviso.ok(t('equipo.enlazada'))
    },
  })

  const queAtienda = useMutation({
    mutationFn: (u: PanelUser) => api.createStaff(slug, u.name, varios ? null : undefined, u.id),
    onSuccess: (creada, u) => {
      setAbierta((a) => (a ? { ...a, s: creada.id } : a))
      invalidate()
      aviso.ok(t('equipo.ahoraAtiende', { nombre: u.name }))
    },
    onError: fallo,
  })

  const cambiarRol = useMutation({
    mutationFn: (u: PanelUser) => api.setPanelUserRole(slug, u.id, rolNuevo),
    onSuccess: (_r, u) => {
      setPermisosDe(null)
      invalidate()
      aviso.ok(t('equipo.permisosCambiados', { nombre: u.name, rol: t(ROL_CLAVE[rolNuevo]!) }))
    },
  })

  const acceso = useMutation({
    mutationFn: ({ u, active }: { u: PanelUser; active: boolean }) =>
      api.setPanelUserActive(slug, u.id, active),
    onSuccess: (_r, { u, active }) => {
      invalidate()
      if (active) {
        aviso.ok(t('eq.accesoDevuelto', { nombre: u.name }))
        return
      }
      setAQuitar(null)
      aviso.ok(t('eq.accesoQuitado', { nombre: u.name }), {
        texto: t('avisos.deshacer'),
        onClick: () => api.setPanelUserActive(slug, u.id, true).then(invalidate).catch(fallo),
      })
    },
    onError: (err, { active }) => {
      if (active) fallo(err)
    },
  })

  const reactivar = useMutation({
    mutationFn: (s: PanelStaff) => api.updateStaff(slug, s.id, { active: true }),
    onSuccess: (_r, s) => {
      invalidate()
      aviso.ok(t('pers.reactivada', { nombre: s.name }))
    },
    onError: fallo,
  })

  const eliminar = useMutation({
    mutationFn: (s: PanelStaff) => api.deleteStaff(slug, s.id),
    onSuccess: (_r, s) => {
      setEliminarA(null)
      // Si solo era quien atiende, ya no queda nada que enseñar en su ficha.
      if (!s.userId) setAbierta(null)
      else setAbierta((a) => (a ? { u: a.u ?? s.userId ?? undefined } : a))
      invalidate()
      aviso.ok(t('pers.eliminada', { nombre: s.name }))
    },
  })

  const sinEnlazar = (users ?? []).filter((u) => u.active && !staff?.some((s) => s.userId === u.id))

  const acciones = {
    editar: (s: PanelStaff) => {
      guardarEdicion.reset()
      setNombreEdit(s.name)
      setLocalEdit(s.locationId ?? '')
      setEditando(s)
    },
    horario: (s: PanelStaff) => setHorarioDe(s),
    crearAcceso: (s: PanelStaff) => setAccesoPara(s),
    enlazar: (s: PanelStaff) => {
      enlazar.reset()
      setCuentaElegida(sinEnlazar[0]?.id ?? '')
      setEnlazarA(s)
    },
    permisos: (u: PanelUser) => {
      cambiarRol.reset()
      setRolNuevo(u.role === 'ADMIN' ? 'ADMIN' : 'EMPLEADO')
      setPermisosDe(u)
    },
    quitarAcceso: (u: PanelUser) => {
      acceso.reset()
      setAQuitar(u)
    },
    devolverAcceso: (u: PanelUser) => acceso.mutate({ u, active: true }),
    queAtienda: (u: PanelUser) => queAtienda.mutate(u),
    baja: (s: PanelStaff) => setBajaDe(s),
    reactivar: (s: PanelStaff) => reactivar.mutate(s),
    eliminar: (s: PanelStaff) => {
      eliminar.reset()
      setEliminarA(s)
    },
  }

  const cargando = cargandoStaff || cargandoUsers

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.equipo')}
        hint={
          staff && users
            ? [t('equipo.atiendenN', { n: atienden }), t('equipo.entranN', { n: entran })].join(
                ' · ',
              )
            : undefined
        }
        actions={
          <Button onClick={() => setIncorporando(true)}>
            <span aria-hidden>+</span> {t('equipo.incorporar')}
          </Button>
        }
      />

      {cargando ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : personas.length === 0 ? (
        <EmptyState
          title={t('pers.todaviaNadie')}
          hint={t('pers.todaviaNadiePista')}
          action={<Button onClick={() => setIncorporando(true)}>{t('equipo.incorporar')}</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {personas.map((p) => {
              const s = p.staff
              const u = p.user
              const esYo = !!u && u.id === yo?.id
              const apagada = !(s?.active || u?.active)
              return (
                <li
                  key={p.clave}
                  className="relative flex items-center gap-x-4 border-b border-line px-4 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-canvas/50 sm:px-5"
                >
                  <span
                    aria-hidden
                    className={cx(
                      'grid size-10 shrink-0 place-items-center rounded-full text-body font-bold',
                      apagada ? 'bg-line text-muted' : 'bg-brand text-white',
                    )}
                  >
                    {p.nombre.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className={cx('min-w-0 flex-1', apagada && 'opacity-60')}>
                    {/* El nombre abre la ficha; su zona pulsable cubre la fila. */}
                    <button
                      type="button"
                      onClick={() => abrir(p)}
                      aria-label={t('equipo.verFicha', { nombre: p.nombre })}
                      className="text-left text-ui font-semibold text-ink after:absolute after:inset-0 after:content-['']"
                    >
                      {p.nombre}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <EtiquetasPersona persona={p} esYo={esYo} />
                      {s && varios && (
                        <span className="text-meta text-muted">{nombreLocal(s.locationId)}</span>
                      )}
                    </div>
                  </div>
                  <div className="relative z-10">
                    <RowMenu
                      label={p.nombre}
                      acciones={[
                        { label: t('equipo.verFichaCorto'), onClick: () => abrir(p) },
                        ...(s
                          ? [{ label: t('pers.editar'), onClick: () => acciones.editar(s) }]
                          : []),
                        ...(s?.active
                          ? [
                              {
                                label: t('pers.horarioPropioAccion'),
                                onClick: () => acciones.horario(s),
                              },
                            ]
                          : []),
                        ...(s && !u
                          ? [
                              {
                                label: t('pers.crearAcceso'),
                                onClick: () => acciones.crearAcceso(s),
                              },
                            ]
                          : []),
                        ...(u && !esYo
                          ? u.active
                            ? [
                                {
                                  label: t('eq.quitarAcceso'),
                                  onClick: () => acciones.quitarAcceso(u),
                                  peligro: true,
                                },
                              ]
                            : [
                                {
                                  label: t('eq.devolverAcceso'),
                                  onClick: () => acciones.devolverAcceso(u),
                                },
                              ]
                          : []),
                        ...(s
                          ? s.active
                            ? [
                                {
                                  label: t('pers.darDeBaja'),
                                  onClick: () => acciones.baja(s),
                                  peligro: true,
                                },
                              ]
                            : [
                                {
                                  label: t('pers.volverAActivar'),
                                  onClick: () => acciones.reactivar(s),
                                },
                                {
                                  label: t('pers.eliminar'),
                                  onClick: () => acciones.eliminar(s),
                                  peligro: true,
                                },
                              ]
                          : []),
                      ]}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <p className="text-meta text-subtle">{t('equipo.aviso')}</p>

      <FichaPersona
        slug={slug}
        persona={persona}
        onClose={() => setAbierta(null)}
        esYo={!!persona?.user && persona.user.id === yo?.id}
        varios={varios}
        nombreLocal={nombreLocal}
        sinEnlazar={sinEnlazar}
        acciones={acciones}
      />

      <Incorporar
        key={incorporando ? 'abierto' : 'cerrado'}
        slug={slug}
        open={incorporando}
        onClose={() => setIncorporando(false)}
        locales={locales ?? []}
      />

      <FormDialog
        open={!!editando}
        onClose={() => setEditando(null)}
        title={t('pers.editarComillas', { nombre: editando?.name ?? '' })}
        submitLabel={t('pers.guardar')}
        onSubmit={() =>
          editando && nombreEdit.trim().length >= 2 && guardarEdicion.mutate(editando)
        }
        loading={guardarEdicion.isPending}
        error={
          guardarEdicion.isError
            ? textoDeError(guardarEdicion.error, t('pers.noSePudoCambiar'))
            : null
        }
        dirty={
          !!editando && (nombreEdit !== editando.name || localEdit !== (editando.locationId ?? ''))
        }
      >
        <Field
          label={t('pers.nombre')}
          htmlFor="equipo-editar-nombre"
          hint={t('pers.anadirPista')}
          required
        >
          <Input
            id="equipo-editar-nombre"
            value={nombreEdit}
            autoComplete="off"
            invalid={nombreEdit.trim().length < 2}
            onChange={(e) => setNombreEdit(e.target.value)}
          />
        </Field>
        {varios && (
          <Field
            label={t('pers.dondeAtiende')}
            htmlFor="equipo-editar-local"
            hint={t('pers.dondeAtiendePista')}
          >
            <Select
              id="equipo-editar-local"
              value={localEdit}
              onChange={(e) => setLocalEdit(e.target.value)}
            >
              <option value="">{t('pers.enTodos')}</option>
              {locales?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </FormDialog>

      {horarioDe && (
        <EditorHorarioPersona
          key={horarioDe.id}
          slug={slug}
          staffId={horarioDe.id}
          nombre={horarioDe.name}
          onClose={() => setHorarioDe(null)}
        />
      )}

      {accesoPara && (
        <CrearAccesoPersona
          key={accesoPara.id}
          slug={slug}
          staffId={accesoPara.id}
          nombreInicial={accesoPara.name}
          onClose={() => setAccesoPara(null)}
        />
      )}

      <FormDialog
        open={!!enlazarA}
        onClose={() => setEnlazarA(null)}
        title={t('equipo.enlazarTitulo', { nombre: enlazarA?.name ?? '' })}
        hint={t('equipo.enlazarPista')}
        submitLabel={t('equipo.enlazar')}
        onSubmit={() => enlazarA && cuentaElegida && enlazar.mutate(enlazarA)}
        loading={enlazar.isPending}
        error={enlazar.isError ? textoDeError(enlazar.error, t('avisos.error')) : null}
      >
        <Field label={t('equipo.cuenta')} htmlFor="equipo-enlazar">
          <Select
            id="equipo-enlazar"
            value={cuentaElegida}
            onChange={(e) => setCuentaElegida(e.target.value)}
          >
            {sinEnlazar.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.email}
              </option>
            ))}
          </Select>
        </Field>
      </FormDialog>

      <FormDialog
        open={!!permisosDe}
        onClose={() => setPermisosDe(null)}
        title={t('equipo.permisosTitulo', { nombre: permisosDe?.name ?? '' })}
        submitLabel={t('equipo.cambiarPermisos')}
        onSubmit={() => permisosDe && cambiarRol.mutate(permisosDe)}
        loading={cambiarRol.isPending}
        error={cambiarRol.isError ? textoDeError(cambiarRol.error, t('avisos.error')) : null}
        dirty={!!permisosDe && rolNuevo !== permisosDe.role}
      >
        <Field label={t('eq.permisos')} htmlFor="equipo-rol" hint={t(ROL_AYUDA[rolNuevo]!)}>
          <Select
            id="equipo-rol"
            value={rolNuevo}
            onChange={(e) => setRolNuevo(e.target.value as 'ADMIN' | 'EMPLEADO')}
          >
            <option value="EMPLEADO">{t('panel.rolEmpleado')}</option>
            <option value="ADMIN">{t('panel.rolAdmin')}</option>
          </Select>
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={!!aQuitar}
        onClose={() => {
          acceso.reset()
          setAQuitar(null)
        }}
        title={t('eq.quitarTitulo', { nombre: aQuitar?.name ?? '' })}
        consecuencias={[t('eq.quitarC1'), t('eq.quitarC2'), t('eq.quitarC3')]}
        confirmLabel={t('eq.quitarAcceso')}
        onConfirm={() => aQuitar && acceso.mutate({ u: aQuitar, active: false })}
        loading={acceso.isPending}
        error={
          acceso.isError && acceso.variables?.active === false
            ? textoDeError(acceso.error, t('avisos.error'))
            : null
        }
      />

      <BajaPersona
        slug={slug}
        persona={bajaDe}
        otras={(staff ?? []).filter((o) => o.active && o.id !== bajaDe?.id)}
        onClose={() => setBajaDe(null)}
      />

      <ConfirmDialog
        open={!!eliminarA}
        onClose={() => {
          eliminar.reset()
          setEliminarA(null)
        }}
        title={t('pers.eliminarTitulo', { nombre: eliminarA?.name ?? '' })}
        consecuencias={[
          t('pers.eliminarC1'),
          t('pers.eliminarC2'),
          ...(eliminarA?.userId ? [t('equipo.eliminarConservaCuenta')] : []),
        ]}
        confirmLabel={t('pers.eliminar')}
        tono="destruir"
        onConfirm={() => eliminarA && eliminar.mutate(eliminarA)}
        loading={eliminar.isPending}
        error={eliminar.isError ? textoDeError(eliminar.error, t('pers.noSePudoEliminar')) : null}
      />
    </div>
  )
}
