import { useId, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CATEGORIES, categoryLabel } from '@veline/shared'
import { api, ApiError, type AdminBusiness } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
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
  const [copiado, setCopiado] = useState(false)
  return (
    <Card className="border-brand/40 bg-brand/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ui font-semibold text-ink">Cuenta creada</p>
          <p className="mt-1 text-body text-body">
            Pásale estos datos a <strong>{email}</strong>:
          </p>
          <code className="mt-2 inline-block rounded-lg bg-cream px-3 py-2 text-body font-semibold break-all text-ink">
            {password}
          </code>
          <p className="mt-2 text-meta text-muted">
            No se puede volver a consultar. Quien entre podrá cambiarla desde su cuenta.
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(password).then(() => setCopiado(true))
            }}
          >
            {copiado ? 'Copiada' : 'Copiar'}
          </Button>
          <IconButton label="Cerrar el aviso" onClick={onClose}>
            <span aria-hidden className="text-subheading leading-none">
              ×
            </span>
          </IconButton>
        </div>
      </div>
    </Card>
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
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const id = useId()

  const [businessDraft, setBusinessDraft] = useState<BusinessDraft | null>(null)
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null)
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')

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
        ? 'El email del negocio no es válido.'
        : businessDraft.street.trim().length < 3
          ? 'Falta la calle.'
          : businessDraft.city.trim().length < 2
            ? 'Falta la ciudad.'
            : !/^\d{5}$/.test(businessDraft.postalCode.trim())
              ? 'El código postal son 5 cifras.'
              : null

  const problemaUsuario = !userDraft
    ? null
    : userDraft.name.trim().length < 2
      ? 'Escribe el nombre.'
      : !esEmail(userDraft.email)
        ? 'El email no es válido.'
        : userDraft.password.length < 10
          ? 'La contraseña debe tener al menos 10 caracteres.'
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
        title="Negocios"
        hint="Alta de negocios y de sus cuentas de acceso."
        actions={
          !businessDraft && (
            <Button
              onClick={() => {
                setUserDraft(null)
                setBusinessDraft(emptyBusiness)
              }}
            >
              + Dar de alta un negocio
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Negocios" value={totales.negocios} />
        <Stat label="Citas totales" value={totales.citas} />
        <Stat label="Cuentas de acceso" value={totales.usuarios} />
        <Stat label="Sin servicios" value={totales.sinServicios} />
      </div>

      {credencial && <Credencial {...credencial} onClose={() => setCredencial(null)} />}

      {businessDraft && (
        <Card padded>
          <h2 className="mb-4 text-ui font-semibold text-ink">Nuevo negocio</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!problemaNegocio) createBusiness.mutate(businessDraft)
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nombre" htmlFor={`${id}-bn`} required>
                <Input
                  id={`${id}-bn`}
                  placeholder="Peluquería Lola"
                  value={businessDraft.name}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, name: e.target.value })}
                />
              </Field>
              <Field label="Categoría" htmlFor={`${id}-bc`} required>
                <Select
                  id={`${id}-bc`}
                  value={businessDraft.category}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Email"
                htmlFor={`${id}-be`}
                hint="Aquí llegan los avisos de cita nueva"
                required
              >
                <Input
                  id={`${id}-be`}
                  type="email"
                  placeholder="hola@peluqerialola.es"
                  value={businessDraft.email}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, email: e.target.value })}
                />
              </Field>
              <Field label="Teléfono" htmlFor={`${id}-bp`} hint="Opcional">
                <Input
                  id={`${id}-bp`}
                  placeholder="600 000 000"
                  value={businessDraft.phone}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, phone: e.target.value })}
                />
              </Field>
              <Field label="Calle y número" htmlFor={`${id}-bs`} required>
                <Input
                  id={`${id}-bs`}
                  placeholder="Calle Mayor, 12"
                  value={businessDraft.street}
                  onChange={(e) => setBusinessDraft({ ...businessDraft, street: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-[1.6fr_1fr] gap-3">
                <Field label="Ciudad" htmlFor={`${id}-bci`} required>
                  <Input
                    id={`${id}-bci`}
                    value={businessDraft.city}
                    onChange={(e) => setBusinessDraft({ ...businessDraft, city: e.target.value })}
                  />
                </Field>
                <Field label="C. postal" htmlFor={`${id}-bcp`} required>
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
                  : 'No se ha podido crear'}
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
            <span className="text-brand">
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
              <Field label="Nombre" htmlFor={`${id}-un`} required>
                <Input
                  id={`${id}-un`}
                  placeholder="Lola Martín"
                  value={userDraft.name}
                  onChange={(e) => setUserDraft({ ...userDraft, name: e.target.value })}
                />
              </Field>
              <Field label="Email" htmlFor={`${id}-ue`} hint="Con esto entrará al panel" required>
                <Input
                  id={`${id}-ue`}
                  type="email"
                  value={userDraft.email}
                  onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })}
                />
              </Field>
              <Field
                label="Contraseña inicial"
                htmlFor={`${id}-up`}
                hint="Generada al azar"
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
              <Field label="Permisos" htmlFor={`${id}-ur`} required>
                <Select
                  id={`${id}-ur`}
                  value={userDraft.role}
                  onChange={(e) =>
                    setUserDraft({ ...userDraft, role: e.target.value as UserDraft['role'] })
                  }
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="EMPLEADO">Equipo</option>
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
                Crear cuenta
              </Button>
              <Button type="button" variant="secondary" onClick={() => setUserDraft(null)}>
                Cancelar
              </Button>
              {problemaUsuario && <span className="text-meta text-muted">{problemaUsuario}</span>}
            </div>
          </form>
        </Card>
      )}

      {(businesses?.length ?? 0) > 6 && (
        <Input
          type="search"
          placeholder="Buscar por nombre, categoría o email…"
          aria-label="Buscar negocios"
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
          title="Aún no hay negocios dados de alta"
          hint="Da de alta el primero para empezar a recibir reservas en la plataforma."
          action={<Button onClick={() => setBusinessDraft(emptyBusiness)}>Dar de alta uno</Button>}
        />
      ) : !filtrados.length ? (
        <EmptyState title={`Ningún negocio coincide con «${busqueda}»`} />
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
                      className="text-ui font-semibold text-ink hover:text-brand hover:underline"
                    >
                      {b.name}
                    </Link>
                    <Badge>{categoryLabel(b.category)}</Badge>
                    {b.counts.services === 0 && <Badge tone="warn">Sin servicios</Badge>}
                    {b.counts.users === 0 && <Badge tone="off">Sin acceso</Badge>}
                  </div>
                  <p className="mt-0.5 text-meta text-muted">
                    /{b.slug} · plan {b.plan.toLowerCase()}
                    {b.email && ` · ${b.email}`}
                  </p>
                </div>

                <dl className="flex gap-5 text-meta text-muted">
                  {[
                    ['Citas', b.counts.bookings],
                    ['Servicios', b.counts.services],
                    ['Equipo', b.counts.users],
                  ].map(([label, n]) => (
                    <div key={label as string}>
                      <dt className="text-caption">{label}</dt>
                      <dd className="font-semibold text-body-2 tabular-nums">{n}</dd>
                    </div>
                  ))}
                </dl>

                <div className="ml-auto flex gap-1 sm:ml-0">
                  <Button size="sm" variant="quiet" onClick={() => abrirCuenta(b)}>
                    Crear cuenta
                  </Button>
                  <Link
                    to={`/panel/${b.slug}`}
                    className="inline-flex min-h-9 items-center rounded-full border border-ink/25 px-3.5 text-meta font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-cream"
                  >
                    Abrir panel
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-meta text-subtle">
        Un negocio se crea con el plan Gratis y sin horario. Hasta que no tenga{' '}
        <strong className="font-semibold text-body-2">servicios y horario</strong> no puede recibir
        reservas: entra a su panel para configurarlo, o crea la cuenta del administrador para que lo
        haga él.
      </p>
    </div>
  )
}
