import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Logo, Select, Spinner, cx } from '../../components/ui'

/**
 * Marco del panel. Exige sesión y adapta la interfaz al rol:
 *
 *  - EMPLEADO   → solo la pestaña Agenda.
 *  - ADMIN      → Agenda, Servicios, Horario, Equipo y Actividad de SU negocio.
 *  - SUPERADMIN → todo lo anterior en cualquier negocio, selector para
 *                 cambiar de negocio y acceso a la gestión de la plataforma.
 *
 * La barra de pestañas cambia de contenido según dónde estés: dentro de un
 * negocio muestra las suyas, y en /panel/admin las de la plataforma. Son dos
 * ámbitos distintos y mezclarlos en una sola fila confunde sobre qué estás
 * mirando.
 */

const ROL_LABEL = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Administrador',
  EMPLEADO: 'Equipo',
} as const

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

/** Pestaña con área pulsable de verdad: 44 px de alto y padding lateral. */
function Tab({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx(
          'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-body font-medium',
          'transition-colors duration-200',
          isActive
            ? 'border-brand font-semibold text-ink'
            : 'border-transparent text-subtle hover:border-line-strong hover:text-ink',
        )
      }
    >
      {label}
    </NavLink>
  )
}

export function PanelLayout() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user, loading, logout } = useAuth()

  const esSuperadmin = user?.role === 'SUPERADMIN'
  const puedeConfigurar = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN'
  // Sin slug en la URL estamos en /panel/admin: el ámbito es la plataforma.
  const esPlataforma = !slug

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

  const tabs = esPlataforma
    ? [
        { to: '/panel/admin', label: 'Negocios', end: true },
        { to: '/panel/admin/usuarios', label: 'Cuentas' },
        { to: '/panel/admin/cobros', label: 'Cobros' },
        { to: '/panel/admin/actividad', label: 'Actividad' },
      ]
    : [
        { to: `/panel/${slug}`, label: 'Agenda', end: true },
        { to: `/panel/${slug}/clientes`, label: 'Clientes' },
        ...(puedeConfigurar
          ? [
              { to: `/panel/${slug}/servicios`, label: 'Servicios' },
              { to: `/panel/${slug}/horario`, label: 'Horario' },
              { to: `/panel/${slug}/personas`, label: 'Personas' },
              { to: `/panel/${slug}/equipo`, label: 'Equipo' },
              { to: `/panel/${slug}/negocio`, label: 'El negocio' },
              { to: `/panel/${slug}/facturacion`, label: 'Tu cuenta' },
              { to: `/panel/${slug}/actividad`, label: 'Actividad' },
            ]
          : []),
      ]

  const negocioActual = businesses?.find((b) => b.slug === slug)

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size={20} />
            <span className="rounded-full bg-ink px-2.5 py-1 text-caption font-semibold tracking-wide text-cream uppercase">
              Panel
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {esSuperadmin && (
              <>
                {/* El selector solo aparece dentro de un negocio: en la
                    plataforma no hay ninguno abierto que cambiar. */}
                {!esPlataforma && businesses && businesses.length > 0 && (
                  <Select
                    value={slug}
                    onChange={(e) => navigate(`/panel/${e.target.value}`)}
                    aria-label="Cambiar de negocio"
                    className="h-10 w-auto max-w-[190px] text-meta"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.slug}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                )}
                <NavLink
                  to={esPlataforma ? `/panel/${businesses?.[0]?.slug ?? ''}` : '/panel/admin'}
                  className={cx(
                    'inline-flex min-h-10 items-center rounded-full border border-line-strong',
                    'bg-surface px-4 text-meta font-semibold text-body-2',
                    'transition-colors duration-200 hover:border-brand hover:text-brand',
                  )}
                >
                  {esPlataforma ? 'Ir a un negocio' : 'Plataforma'}
                </NavLink>
              </>
            )}

            <NavLink
              to={esPlataforma ? '/panel/admin/cuenta' : `/panel/${slug}/cuenta`}
              className={({ isActive }) =>
                cx(
                  'inline-flex min-h-10 max-w-[220px] items-center gap-2 rounded-full px-3',
                  'text-meta transition-colors duration-200',
                  isActive ? 'bg-ink text-cream' : 'text-body-2 hover:bg-canvas hover:text-ink',
                )
              }
            >
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-caption font-bold text-white"
              >
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="truncate">
                <span className="font-semibold">{user.name}</span>
                <span className="hidden sm:inline"> · {ROL_LABEL[user.role]}</span>
              </span>
            </NavLink>

            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                void logout().then(() => navigate('/login'))
              }}
            >
              Salir
            </Button>
          </div>
        </div>

        {/* Se puede arrastrar en móvil: con cinco pestañas no caben en 375 px,
            y cortarlas sin scroll esconde las últimas para siempre. */}
        <div className="mx-auto max-w-[1200px] overflow-x-auto px-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <nav className="flex gap-1" aria-label="Secciones del panel">
            {tabs.map((tab) => (
              <Tab key={tab.to} {...tab} />
            ))}
          </nav>
        </div>
      </header>

      {negocioActual && (
        <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6">
          <p className="text-meta text-muted">
            Estás gestionando{' '}
            <span className="font-semibold text-body-2">{negocioActual.name}</span>
          </p>
        </div>
      )}

      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
