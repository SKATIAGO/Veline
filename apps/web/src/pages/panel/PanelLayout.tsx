import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Logo, Spinner } from '../../components/ui'

const TABS = [
  { to: '', label: 'Agenda', end: true },
  { to: 'servicios', label: 'Servicios', end: false },
  { to: 'horario', label: 'Horario', end: false },
]

/** /panel sin negocio: entra en el primero. Sustituir por el negocio de la
 *  sesión cuando exista login con Apple/Google. */
export function PanelIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ['panel', 'businesses'],
    queryFn: api.panelBusinesses,
  })
  if (isLoading) return <Spinner />
  if (!data?.length) return <p className="p-16 text-muted">No hay negocios dados de alta.</p>
  return <Navigate to={`/panel/${data[0].slug}`} replace />
}

export function PanelLayout() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { data: businesses } = useQuery({
    queryKey: ['panel', 'businesses'],
    queryFn: api.panelBusinesses,
  })

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

          <div className="flex items-center gap-3">
            <label className="text-[12.5px] font-medium text-muted" htmlFor="panel-business">
              Negocio
            </label>
            <select
              id="panel-business"
              value={slug}
              onChange={(e) => navigate(`/panel/${e.target.value}`)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {businesses?.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1200px] gap-7 px-6">
          {TABS.map((tab) => (
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
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <Outlet />
      </main>

      <p className="mx-auto max-w-[1200px] px-6 pb-10 text-[12px] text-subtle">
        Panel sin autenticación — versión de desarrollo. El acceso con Apple y Google entra después.
      </p>
    </div>
  )
}
