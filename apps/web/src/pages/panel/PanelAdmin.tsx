import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CATEGORIES } from '@veline/shared'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Card, ErrorNote, Spinner } from '../../components/ui'

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

export function PanelAdmin() {
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()

  const [businessDraft, setBusinessDraft] = useState<BusinessDraft | null>(null)
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null)
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null)

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
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] })
      queryClient.invalidateQueries({ queryKey: ['panel', 'businesses'] })
    },
  })

  const createUser = useMutation({
    mutationFn: (d: UserDraft) => api.createAdminUser(d),
    onSuccess: (_data, d) => {
      setCredencial({ email: d.email, password: d.password })
      setUserDraft(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] })
    },
  })

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'SUPERADMIN') return <Navigate to="/panel" replace />

  const input =
    'rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Plataforma</h1>
        {!businessDraft && (
          <Button onClick={() => setBusinessDraft(emptyBusiness)}>Dar de alta un negocio</Button>
        )}
      </div>

      {credencial && (
        <Card className="mb-6 border-brand/40 bg-brand/5 p-5">
          <div className="mb-1 font-semibold text-ink">Cuenta creada</div>
          <p className="text-sm text-body">
            <strong>{credencial.email}</strong> · contraseña{' '}
            <code className="rounded bg-cream px-1.5 py-0.5 font-semibold">
              {credencial.password}
            </code>
          </p>
          <p className="mt-2 text-[12.5px] text-muted">
            Pásasela al negocio ahora: no se puede volver a consultar.
          </p>
        </Card>
      )}

      {businessDraft && (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-[12.5px] font-semibold text-body">Nuevo negocio</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              className={input}
              placeholder="Nombre del negocio"
              value={businessDraft.name}
              onChange={(e) => setBusinessDraft({ ...businessDraft, name: e.target.value })}
            />
            <select
              className={input}
              value={businessDraft.category}
              onChange={(e) => setBusinessDraft({ ...businessDraft, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              className={input}
              type="email"
              placeholder="Email del negocio"
              value={businessDraft.email}
              onChange={(e) => setBusinessDraft({ ...businessDraft, email: e.target.value })}
            />
            <input
              className={input}
              placeholder="Teléfono (opcional)"
              value={businessDraft.phone}
              onChange={(e) => setBusinessDraft({ ...businessDraft, phone: e.target.value })}
            />
            <input
              className={input}
              placeholder="Calle y número"
              value={businessDraft.street}
              onChange={(e) => setBusinessDraft({ ...businessDraft, street: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={input}
                placeholder="Ciudad"
                value={businessDraft.city}
                onChange={(e) => setBusinessDraft({ ...businessDraft, city: e.target.value })}
              />
              <input
                className={input}
                placeholder="C. postal"
                value={businessDraft.postalCode}
                onChange={(e) => setBusinessDraft({ ...businessDraft, postalCode: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={() => createBusiness.mutate(businessDraft)}
              disabled={createBusiness.isPending}
            >
              {createBusiness.isPending ? 'Creando…' : 'Crear negocio'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setBusinessDraft(null)}>
              Cancelar
            </Button>
          </div>
          {createBusiness.isError && (
            <div className="mt-3">
              <ErrorNote>
                {createBusiness.error instanceof ApiError
                  ? createBusiness.error.message
                  : 'No se ha podido crear'}
              </ErrorNote>
            </div>
          )}
        </Card>
      )}

      {userDraft && (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-[12.5px] font-semibold text-body">
            Nueva cuenta para{' '}
            <strong>{businesses?.find((b) => b.id === userDraft.businessId)?.name}</strong>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1.6fr_1.2fr_auto_auto]">
            <input
              className={input}
              placeholder="Nombre"
              value={userDraft.name}
              onChange={(e) => setUserDraft({ ...userDraft, name: e.target.value })}
            />
            <input
              className={input}
              type="email"
              placeholder="email@negocio.es"
              value={userDraft.email}
              onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })}
            />
            <input
              className={input}
              placeholder="Contraseña"
              value={userDraft.password}
              onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })}
            />
            <select
              className={input}
              value={userDraft.role}
              onChange={(e) =>
                setUserDraft({ ...userDraft, role: e.target.value as UserDraft['role'] })
              }
            >
              <option value="ADMIN">Administrador</option>
              <option value="EMPLEADO">Equipo</option>
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createUser.mutate(userDraft)}
                disabled={createUser.isPending}
              >
                {createUser.isPending ? '…' : 'Crear'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setUserDraft(null)}>
                Cancelar
              </Button>
            </div>
          </div>
          {createUser.isError && (
            <div className="mt-3">
              <ErrorNote>
                {createUser.error instanceof ApiError
                  ? createUser.error.message
                  : 'No se ha podido crear'}
              </ErrorNote>
            </div>
          )}
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          {businesses?.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 last:border-b-0"
            >
              <div className="min-w-[220px] flex-1">
                <Link to={`/panel/${b.slug}`} className="font-semibold text-ink hover:text-brand">
                  {b.name}
                </Link>
                <div className="mt-0.5 text-[13px] text-muted">
                  {b.slug} · plan {b.plan.toLowerCase()}
                </div>
              </div>
              <div className="hidden w-[220px] text-[12.5px] text-muted sm:block">
                {b.counts.bookings} citas · {b.counts.services} servicios · {b.counts.users}{' '}
                {b.counts.users === 1 ? 'usuario' : 'usuarios'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCredencial(null)
                  setUserDraft({
                    businessId: b.id,
                    name: '',
                    email: '',
                    password: generarPassword(),
                    role: 'ADMIN',
                  })
                }}
                className="text-[12.5px] font-semibold text-brand underline"
              >
                Crear cuenta
              </button>
            </div>
          ))}
          {businesses?.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted">
              Aún no hay negocios dados de alta.
            </p>
          )}
        </Card>
      )}

      <p className="mt-4 text-[12.5px] text-subtle">
        Al dar de alta un negocio se crea con el plan Gratis y sin horario: entra a su panel para
        configurar servicios y horario, o crea la cuenta del administrador para que lo haga él.
      </p>
    </div>
  )
}
