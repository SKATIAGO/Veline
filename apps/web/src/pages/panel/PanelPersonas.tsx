import { useEffect, useId, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatLongDate } from '@veline/shared'
import { api, ApiError, type PanelStaff } from '../../lib/api'
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
import { generarPassword } from './PanelUsers'
import { Texto, useIdioma, usePlural } from '../../i18n/idioma'
import { Bloqueo, ConfirmDialog } from '../../components/Confirmar'
import { aviso, textoDeError } from '../../components/Avisos'

/**
 * El editor del horario propio de una persona, dentro de la ficha.
 *
 * La ficha (Sheet) solo lleva el nombre en el aria-label, no a la vista:
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
  }

  /** Copia el día a los demás laborables. Rellenar siete días a mano cansa. */
  const copiarALaborables = (wd: number) => {
    const origen = week[wd] ?? []
    setWeek((prev) => {
      const next = { ...prev }
      for (const otro of [1, 2, 3, 4, 5]) next[otro] = origen.map((r) => ({ ...r }))
      return next
    })
  }

  const invalid = ORDEN_SEMANA.some((wd) => (week[wd] ?? []).some((r) => r.endMin <= r.startMin))

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {ORDEN_SEMANA.map((wd) => (
          <Skeleton key={wd} className="h-12" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-subheading font-semibold text-ink">
        {t('pers.horarioDe', { nombre })}
      </h2>
      <p className="text-meta text-subtle">{t('pers.horarioAviso')}</p>
      <FranjasSemanales week={week} onChange={mutate} onCopiarALaborables={copiarALaborables} />
      {save.isError && <ErrorNote>{t('pers.horarioNoGuardado')}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <Button variant="quiet" onClick={onClose}>
          {t('pers.cancelar')}
        </Button>
        <Button onClick={() => save.mutate()} disabled={invalid} loading={save.isPending}>
          {t('hor.guardar')}
        </Button>
      </div>
    </div>
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
  nombreInicial,
  onClose,
}: {
  slug: string
  nombreInicial: string
  onClose: () => void
}) {
  const { t } = useIdioma()
  const id = useId()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generarPassword())
  const [creada, setCreada] = useState<{ email: string; password: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const crear = useMutation({
    mutationFn: () =>
      api.createPanelUser(slug, {
        name: nombreInicial,
        email: email.trim(),
        password,
        role: 'EMPLEADO',
      }),
    onSuccess: () => {
      setCreada({ email: email.trim(), password })
      setCopiado(false)
      queryClient.invalidateQueries({ queryKey: ['panel', slug, 'users'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })

  const problema = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
    ? t('eq.errEmail')
    : password.length < 10
      ? t('eq.errContrasena')
      : null

  if (creada) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-subheading font-semibold text-ink">
          {t('pers.altaTitulo', { nombre: nombreInicial })}
        </h2>
        <Card className="border-brand/40 bg-brand/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ui font-semibold text-ink">{t('eq.cuentaCreada')}</p>
              <p className="mt-1 text-body text-body">
                <Texto clave="eq.pasaleDatos" partes={{ email: <strong>{creada.email}</strong> }} />
              </p>
              <code className="mt-2 inline-block rounded-lg bg-cream px-3 py-2 text-body font-semibold break-all text-ink">
                {creada.password}
              </code>
              <p className="mt-2 text-meta text-muted">{t('eq.guardalaAhora')}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(creada.password).then(() => setCopiado(true))
                }}
              >
                {copiado ? t('eq.copiada') : t('eq.copiar')}
              </Button>
            </div>
          </div>
        </Card>
        <div className="flex justify-end">
          <Button onClick={onClose}>{t('comun.listo')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-subheading font-semibold text-ink">
        {t('pers.altaTitulo', { nombre: nombreInicial })}
      </h2>
      <p className="text-meta text-subtle">{t('pers.altaAviso')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!problema) crear.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <Field label={t('eq.email')} htmlFor={`${id}-email`} hint={t('eq.emailPista')} required>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="off"
            autoFocus
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPassword(generarPassword())}
            >
              {t('eq.otra')}
            </Button>
          </div>
        </Field>

        {crear.isError && (
          <ErrorNote>
            {crear.error instanceof ApiError ? crear.error.message : t('eq.noSePudoCrear')}
          </ErrorNote>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={crear.isPending} disabled={!!problema}>
            {t('eq.crearCuenta')}
          </Button>
          <Button type="button" variant="quiet" onClick={onClose}>
            {t('pers.cancelar')}
          </Button>
          {problema && <span className="text-meta text-muted">{problema}</span>}
        </div>
      </form>
    </div>
  )
}

/**
 * Las personas que atienden las citas.
 *
 * No confundir con «Equipo», que son las cuentas para entrar al panel: alguien
 * puede atender clientes sin tener usuario (el chico de los sábados) y alguien
 * puede administrar sin atender a nadie (el dueño que solo mira números).
 * Esto es además lo que se cuenta para la cuota: el plan Negocio incluye dos.
 */
export function PanelPersonas() {
  const { t } = useIdioma()
  const plural = usePlural()
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const id = useId()

  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [nombreEdit, setNombreEdit] = useState('')
  const [horarioAbierto, setHorarioAbierto] = useState<string | null>(null)
  const [altaAbierto, setAltaAbierto] = useState<string | null>(null)
  const [bajaDe, setBajaDe] = useState<PanelStaff | null>(null)
  const [eliminarA, setEliminarA] = useState<PanelStaff | null>(null)

  /* Con varios locales hay que poder decir dónde atiende cada persona: de eso
     depende en qué local sale su hueco. Sin elegir = atiende en todos, que es
     lo que hace falta para quien va rotando. */
  const { data: locales } = useQuery({
    queryKey: ['panel', slug, 'locales'],
    queryFn: () => api.panelLocales(slug),
  })
  const varios = (locales?.length ?? 0) > 1
  const [localNuevo, setLocalNuevo] = useState('')

  const { data: personas, isLoading } = useQuery({
    queryKey: ['panel', slug, 'staff'],
    queryFn: () => api.panelStaff(slug),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['panel', slug] })
    queryClient.invalidateQueries({ queryKey: ['business', slug] })
    queryClient.invalidateQueries({ queryKey: ['audit'] })
  }

  const crear = useMutation({
    mutationFn: () => api.createStaff(slug, nombre.trim(), varios ? localNuevo || null : undefined),
    onSuccess: () => {
      aviso.ok(t('pers.anadida', { nombre: nombre.trim() }))
      setNombre('')
      invalidate()
    },
  })

  const renombrar = useMutation({
    mutationFn: (personaId: string) =>
      api.updateStaff(slug, personaId, { name: nombreEdit.trim() }),
    onSuccess: () => {
      setEditando(null)
      invalidate()
      aviso.ok(t('avisos.guardado'))
    },
  })

  // Volver a activar: se puede deshacer dando de baja otra vez, así que va
  // directo, con aviso.
  const reactivar = useMutation({
    mutationFn: (p: PanelStaff) => api.updateStaff(slug, p.id, { active: true }),
    onSuccess: (_r, p) => {
      invalidate()
      aviso.ok(t('pers.reactivada', { nombre: p.name }))
    },
    onError: (err) => aviso.error(textoDeError(err, t('pers.noSePudoCambiar'))),
  })

  const eliminar = useMutation({
    mutationFn: (p: PanelStaff) => api.deleteStaff(slug, p.id),
    onSuccess: (_r, p) => {
      setEliminarA(null)
      invalidate()
      aviso.ok(t('pers.eliminada', { nombre: p.name }))
    },
  })

  const activas = personas?.filter((p) => p.active).length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('panel.personas')}
        hint={
          personas
            ? [
                plural(activas, 'pers.unaAtiende', 'pers.variasAtienden'),
                ...(personas.length > activas
                  ? [t('pers.deBajaCuenta', { n: personas.length - activas })]
                  : []),
              ].join(' · ')
            : undefined
        }
      />

      <Card padded>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (nombre.trim().length >= 2) crear.mutate()
          }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <Field
            label={t('pers.anadirUna')}
            htmlFor={`${id}-nueva`}
            hint={t('pers.anadirPista')}
            className="flex-1"
          >
            <Input
              id={`${id}-nueva`}
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          {varios && (
            <Field label={t('pers.dondeAtiende')} htmlFor={`${id}-local`} className="sm:w-[220px]">
              <Select
                id={`${id}-local`}
                value={localNuevo}
                onChange={(e) => setLocalNuevo(e.target.value)}
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
          <Button type="submit" loading={crear.isPending} disabled={nombre.trim().length < 2}>
            {t('pers.anadir')}
          </Button>
        </form>
        {crear.isError && (
          <div className="mt-4">
            <ErrorNote>
              {crear.error instanceof ApiError ? crear.error.message : t('pers.noSePudoAnadir')}
            </ErrorNote>
          </div>
        )}
      </Card>

      {isLoading ? (
        <Card className="flex flex-col gap-3 p-5">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !personas?.length ? (
        <EmptyState title={t('pers.todaviaNadie')} hint={t('pers.todaviaNadiePista')} />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {personas.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5"
              >
                <span
                  aria-hidden
                  className={cx(
                    'grid size-10 shrink-0 place-items-center rounded-full text-body font-bold',
                    p.active ? 'bg-brand text-white' : 'bg-line text-muted',
                  )}
                >
                  {p.name.trim().charAt(0).toUpperCase()}
                </span>

                {editando === p.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (nombreEdit.trim().length >= 2) renombrar.mutate(p.id)
                    }}
                    className="flex flex-1 flex-wrap items-center gap-2"
                  >
                    <Input
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                      aria-label={t('pers.nuevoNombre', { nombre: p.name })}
                      className="max-w-xs flex-1"
                      autoFocus
                    />
                    <Button type="submit" size="sm" loading={renombrar.isPending}>
                      {t('pers.guardar')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="quiet"
                      onClick={() => setEditando(null)}
                    >
                      {t('pers.cancelar')}
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className={cx('min-w-[160px] flex-1', !p.active && 'opacity-60')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ui font-semibold text-ink">{p.name}</span>
                        {!p.active && <Badge tone="off">{t('pers.deBaja')}</Badge>}
                      </div>
                      <p className="mt-0.5 text-meta text-muted">
                        {varios && (
                          <>
                            {locales?.find((l) => l.id === p.locationId)?.name ??
                              t('pers.enTodosLosLocales')}
                            {' · '}
                          </>
                        )}
                        {p.upcomingBookings
                          ? plural(
                              p.upcomingBookings,
                              'pers.unaCitaPorDelante',
                              'pers.variasCitasPorDelante',
                            )
                          : t('pers.sinCitasPendientes')}
                        {p.hasHours && <> · {t('pers.horarioPropio')}</>}
                      </p>
                    </div>

                    <div className="ml-auto flex flex-wrap justify-end gap-1 sm:ml-0">
                      <Button size="sm" variant="quiet" onClick={() => setAltaAbierto(p.id)}>
                        {t('pers.darDeAlta')}
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => setHorarioAbierto(p.id)}>
                        {t('pers.horario')}
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          setEditando(p.id)
                          setNombreEdit(p.name)
                        }}
                      >
                        {t('pers.renombrar')}
                      </Button>
                      {p.active ? (
                        <Button size="sm" variant="danger" onClick={() => setBajaDe(p)}>
                          {t('pers.darDeBaja')}
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="quiet"
                            loading={reactivar.isPending && reactivar.variables?.id === p.id}
                            onClick={() => reactivar.mutate(p)}
                          >
                            {t('pers.volverAActivar')}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setEliminarA(p)}>
                            {t('pers.eliminar')}
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-meta text-subtle">
        <Texto
          clave="pers.aviso"
          partes={{
            negrita: (
              <strong className="font-semibold text-body-2">{t('pers.avisoNegrita')}</strong>
            ),
          }}
        />
      </p>

      <BajaPersona
        slug={slug}
        persona={bajaDe}
        otras={(personas ?? []).filter((o) => o.active && o.id !== bajaDe?.id)}
        onClose={() => setBajaDe(null)}
      />

      <ConfirmDialog
        open={!!eliminarA}
        onClose={() => {
          eliminar.reset()
          setEliminarA(null)
        }}
        title={t('pers.eliminarTitulo', { nombre: eliminarA?.name ?? '' })}
        consecuencias={[t('pers.eliminarC1'), t('pers.eliminarC2')]}
        confirmLabel={t('pers.eliminar')}
        tono="destruir"
        onConfirm={() => eliminarA && eliminar.mutate(eliminarA)}
        loading={eliminar.isPending}
        error={eliminar.isError ? textoDeError(eliminar.error, t('pers.noSePudoEliminar')) : null}
      />

      <Sheet
        open={!!horarioAbierto}
        onClose={() => setHorarioAbierto(null)}
        title={
          horarioAbierto
            ? t('pers.horarioDe', {
                nombre: personas?.find((p) => p.id === horarioAbierto)?.name ?? '',
              })
            : ''
        }
      >
        {horarioAbierto && (
          <EditorHorarioPersona
            slug={slug}
            staffId={horarioAbierto}
            nombre={personas?.find((p) => p.id === horarioAbierto)?.name ?? ''}
            onClose={() => setHorarioAbierto(null)}
          />
        )}
      </Sheet>

      <Sheet
        open={!!altaAbierto}
        onClose={() => setAltaAbierto(null)}
        title={t('pers.altaTitulo', {
          nombre: personas?.find((p) => p.id === altaAbierto)?.name ?? '',
        })}
      >
        {altaAbierto && (
          <CrearAccesoPersona
            slug={slug}
            nombreInicial={personas?.find((p) => p.id === altaAbierto)?.name ?? ''}
            onClose={() => setAltaAbierto(null)}
          />
        )}
      </Sheet>
    </div>
  )
}
