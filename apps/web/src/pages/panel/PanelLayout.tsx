import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Logo, Spinner } from '../../components/ui'

/**
 * Marco del panel. Exige sesión y adapta la interfaz al rol:
 *
 *  - EMPLEADO   → solo la pestaña Agenda.
 *  - ADMIN      → Agenda, Servicios, Horario, Equipo y Actividad de SU negocio.
 *  - SUPERADMIN → todo lo anterior en cualquier negocio, selector para
 *                 cambiar de negocio y acceso a la gestión de la plataforma.
 */

/** /panel sin más: cada rol aterriza donde le corresponde. */
export function PanelIndex() {
  const { user, loading } = useAuth()
  const { data: businesses, isLoading } = useQuery({
    queryKey: ['panel', 'businesses'],
    queryFn: api.panelBusinesses,
    enabled: !!user,
  })

  if (loading) return <Spinner label="Comprobando sesión…" />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'SUPERADMIN' && user.businessSlug) {
    return <Navigate to={`/panel/${user.businessSlug}`} replace />
  }
  if (isLoading) return <Spinner />
  if (!businesses?.length) return <Navigate to="/panel/admin" replace />
  return <Navigate to={`/panel/${businesses[0].slug}`} replace />
}

export function PanelLayout() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()

  const esSuperadmin = user?.role === 'SUPERADMIN'
  const puedeConfigurar = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN'

  const { data: businesses } = useQuery({
    queryKey: ['panel', 'businesses'],
    queryFn: api.panelBusinesses,
    enabled: !!user,
  })

  if (loading) return <Spinner label="Comprobando sesión…" />
  if (!user) return <Navigate to="/login" replace />

  // Un admin o empleado solo tiene un negocio: si la URL apunta a otro,
  // se le lleva al suyo (la API rechazaría igualmente, esto es cortesía).
  if (!esSuperadmin && user.businessSlug && slug && slug !== user.businessSlug) {
    return <Navigate to={`/panel/${user.businessSlug}`} replace />
  }

  const tabs = [
    { to: '', label: 'Agenda', end: true },
    ...(puedeConfigurar
      ? [
          { to: 'servicios', label: 'Servicios', end: false },
          { to: 'horario', label: 'Horario', end: false },
          { to: 'equipo', label: 'Equipo', end: false },
          { to: 'actividad', label: 'Actividad', end: false },
        ]
      : []),
  ]

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo size={20} />
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold tracking-wide text-cream uppercase">
              Panel
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {esSuperadmin && (
              <>
                <NavLink
                  to="/panel/admin"
                  className={({ isActive }) =>
                    isActive
                      ? 'text-sm font-semibold text-brand'
                      : 'text-sm font-medium text-muted hover:text-ink'
                  }
                >
                  Plataforma
                </NavLink>
                <NavLink
                  to="/panel/admin/actividad"
                  className={({ isActive }) =>
                    isActive
                      ? 'text-sm font-semibold text-brand'
                      : 'text-sm font-medium text-muted hover:text-ink'
                  }
                >
                  Actividad
                </NavLink>
                {businesses && businesses.length > 0 && (
                  <select
                    value={slug}
                    onChange={(e) => navigate(`/panel/${e.target.value}`)}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                    aria-label="Cambiar de negocio"
                  >
                    {!slug && <option value="">— negocio —</option>}
                    {businesses.map((b) => (
                      <option key={b.id} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            <div className="flex items-center gap-3">
              <NavLink
                to={slug ? `/panel/${slug}/cuenta` : '/panel/admin/cuenta'}
                className={({ isActive }) =>
                  isActive
                    ? 'hidden text-[12.5px] font-semibold text-brand sm:block'
                    : 'hidden text-[12.5px] text-muted hover:text-ink sm:block'
                }
              >
                {user.name} ·{' '}
                {user.role === 'SUPERADMIN'
                  ? 'Superadmin'
                  : user.role === 'ADMIN'
                    ? 'Administrador'
                    : 'Equipo'}
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  void logout().then(() => navigate('/login'))
                }}
                className="text-[12.5px] font-semibold text-muted underline hover:text-brand"
              >
                Salir
              </button>
            </div>
          </div>
        </div>

        {slug && (
          <div className="mx-auto flex max-w-[1200px] gap-7 px-6">
            {tabs.map((tab) => (
              <NavLink
                key={tab.label}
                to={tab.to ? `/panel/${slug}/${tab.to}` : `/panel/${slug}`}
                end={tab.end}
                className={({ isActive }) =>
                  isActive
                    ? 'border-b-2 border-brand pb-3 text-sm font-semibold text-ink'
                    : 'pb-3 text-sm font-medium text-subtle hover:text-ink'
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
