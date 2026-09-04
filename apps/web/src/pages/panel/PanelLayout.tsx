import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Logo, LogoMark, Select, Sheet, Spinner, cx } from '../../components/ui'

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
 *
 * ── Móvil ──
 * Medido a 375 px, el panel anterior gastaba 203 px —una cuarta parte de la
 * pantalla— en cabecera, y de las nueve secciones solo se veían cuatro: las
 * otras cinco vivían en 474 px de desplazamiento lateral sin nada que
 * indicara que estaban ahí. Nadie arrastra una fila de pestañas que parece
 * completa.
 *
 * Por eso en móvil la navegación baja a una barra fija —lo que hace cualquier
 * app, así que no hay que explicarlo— con los destinos de todos los días, un
 * botón central para apuntar la cita que entra por teléfono, y el resto en
 * «Más». En pantalla grande la barra estorbaría, así que allí se queda la
 * fila de pestañas de siempre.
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

/* ── Iconos ───────────────────────────────────────────────────
   Trazo de 1,75 y esquinas redondeadas, para que peguen con el
   logo. Van marcados como decorativos: el nombre va debajo en
   texto, así que repetirlo al lector de pantalla solo estorba. */
function Icono({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[22px]"
    >
      {d ? <path d={d} /> : children}
    </svg>
  )
}

const ICONOS = {
  agenda: (
    <Icono>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </Icono>
  ),
  clientes: (
    <Icono>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2M16.5 8.4a3 3 0 0 0 0-.8M17 14.9c2.4.5 4 2.4 4 5.1" />
    </Icono>
  ),
  negocio: (
    <Icono>
      <path d="M4 9.5 5.6 5h12.8L20 9.5M4 9.5h16M4 9.5v9.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </Icono>
  ),
  mas: (
    <Icono>
      <circle cx="5.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.5" cy="12" r="1.4" />
    </Icono>
  ),
  cobros: (
    <Icono>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M2.5 10h19" />
    </Icono>
  ),
  actividad: (
    <Icono>
      <path d="M3 12h4l2.5-6 4 13L16 12h5" />
    </Icono>
  ),
} as const

type DestinoBarra = {
  to: string
  label: string
  icono: keyof typeof ICONOS
  end?: boolean
}

/** Un destino de la barra inferior. 56 px de alto: se acierta sin mirar. */
function BotonBarra({ destino }: { destino: DestinoBarra }) {
  return (
    <NavLink
      to={destino.to}
      end={destino.end}
      className={({ isActive }) =>
        cx(
          'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1',
          'text-caption font-semibold transition-colors duration-200',
          isActive ? 'text-brand-text' : 'text-subtle',
        )
      }
    >
      {ICONOS[destino.icono]}
      <span className="max-w-full truncate">{destino.label}</span>
    </NavLink>
  )
}

export function PanelLayout() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, logout } = useAuth()
  const [masAbierto, setMasAbierto] = useState(false)

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

  /* La barra lleva solo lo de todos los días. Lo demás cabe en «Más»: sacar
     nueve destinos a una barra de móvil los deja en 41 px cada uno. */
  const barra: DestinoBarra[] = esPlataforma
    ? [
        { to: '/panel/admin', label: 'Negocios', icono: 'negocio', end: true },
        { to: '/panel/admin/usuarios', label: 'Cuentas', icono: 'clientes' },
        { to: '/panel/admin/cobros', label: 'Cobros', icono: 'cobros' },
        { to: '/panel/admin/actividad', label: 'Actividad', icono: 'actividad' },
      ]
    : [
        { to: `/panel/${slug}`, label: 'Agenda', icono: 'agenda', end: true },
        { to: `/panel/${slug}/clientes`, label: 'Clientes', icono: 'clientes' },
        ...(puedeConfigurar
          ? [
              {
                to: `/panel/${slug}/negocio`,
                label: 'El negocio',
                icono: 'negocio' as const,
              },
            ]
          : []),
      ]

  // En la plataforma no hay ninguna cita que apuntar.
  const conBotonCentral = !esPlataforma

  /* Lo que no cabe en la barra. Es la lista de pestañas menos las que ya
     están abajo, para que nada quede sin puerta. */
  const enBarra = new Set(barra.map((d) => d.to))
  const enMas = tabs.filter((t) => !enBarra.has(t.to))

  const irA = (to: string) => {
    setMasAbierto(false)
    navigate(to)
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          {/* En móvil la cabecera es una sola línea: marca, dónde estás y tú.
              Todo lo demás (cambiar de negocio, plataforma, salir) vive en
              «Más», que está a un dedo. */}
          <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
            <span className="md:hidden">
              <LogoMark size={22} />
            </span>
            <span className="hidden md:inline">
              <Logo size={20} />
            </span>
            <span className="hidden rounded-full bg-ink px-2.5 py-1 text-caption font-semibold tracking-wide text-cream uppercase md:inline-block">
              Panel
            </span>
            <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink md:hidden">
              {esPlataforma ? 'Plataforma' : (negocioActual?.name ?? 'Panel')}
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
                    className="hidden h-10 w-auto max-w-[190px] text-meta md:block"
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
                    'hidden min-h-10 items-center rounded-full border border-line-strong md:inline-flex',
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
                  'inline-flex min-h-10 max-w-[220px] items-center gap-2 rounded-full px-1 md:px-3',
                  'text-meta transition-colors duration-200',
                  isActive ? 'bg-ink text-cream' : 'text-body-2 hover:bg-canvas hover:text-ink',
                )
              }
            >
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-caption font-bold text-white md:size-7"
              >
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden truncate md:inline">
                <span className="font-semibold">{user.name}</span>
                <span className="hidden sm:inline"> · {ROL_LABEL[user.role]}</span>
              </span>
            </NavLink>

            <Button
              size="sm"
              variant="quiet"
              className="hidden md:inline-flex"
              onClick={() => {
                void logout().then(() => navigate('/login'))
              }}
            >
              Salir
            </Button>
          </div>
        </div>

        {/* En pantalla grande hay sitio para las nueve de una vez. En móvil
            navega la barra de abajo, así que aquí no pintan nada. */}
        <div className="mx-auto hidden max-w-[1200px] px-4 sm:px-6 md:block">
          <nav className="flex gap-1" aria-label="Secciones del panel">
            {tabs.map((tab) => (
              <Tab key={tab.to} {...tab} />
            ))}
          </nav>
        </div>
      </header>

      {negocioActual && (
        <div className="mx-auto hidden max-w-[1200px] px-4 pt-6 sm:px-6 md:block">
          <p className="text-meta text-muted">
            Estás gestionando{' '}
            <span className="font-semibold text-body-2">{negocioActual.name}</span>
          </p>
        </div>
      )}

      {/* El hueco de abajo deja pasar la barra fija sin tapar la última fila. */}
      <main className="mx-auto max-w-[1200px] px-4 py-6 pb-28 sm:px-6 sm:py-8 md:pb-8">
        <Outlet />
      </main>

      <nav
        aria-label="Navegación del panel"
        className={cx(
          'fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-cream md:hidden',
          'pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_16px_rgba(46,33,25,.07)]',
        )}
      >
        <div
          className="mx-auto grid max-w-md items-center px-2 py-1"
          style={{
            gridTemplateColumns: `repeat(${barra.length + (conBotonCentral ? 2 : 1)}, 1fr)`,
          }}
        >
          {/* El botón de apuntar va en el centro de verdad, no al final: es
              donde lo pone cualquier app y donde llega el pulgar. */}
          {(conBotonCentral ? barra.slice(0, Math.ceil(barra.length / 2)) : barra).map(
            (destino) => (
              <BotonBarra key={destino.to} destino={destino} />
            ),
          )}

          {conBotonCentral && (
            <div className="flex justify-center">
              {/* Apuntar la cita del teléfono es lo que más se hace y estaba
                  a dos pantallas de distancia. La agenda lo recoge por la
                  URL, así que además es un enlace que se puede guardar. */}
              <button
                type="button"
                onClick={() => navigate(`/panel/${slug}?nueva=1`)}
                aria-label="Apuntar una cita"
                className={cx(
                  'grid size-14 place-items-center rounded-full bg-brand text-cream',
                  'shadow-[0_5px_16px_rgba(169,106,62,.42)] transition-colors duration-200',
                  'hover:bg-brand-dark active:scale-[.97] motion-reduce:transform-none',
                )}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  className="size-6"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          )}

          {conBotonCentral &&
            barra
              .slice(Math.ceil(barra.length / 2))
              .map((destino) => <BotonBarra key={destino.to} destino={destino} />)}

          <button
            type="button"
            onClick={() => setMasAbierto(true)}
            aria-haspopup="dialog"
            aria-expanded={masAbierto}
            className={cx(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1',
              'text-caption font-semibold text-subtle transition-colors duration-200',
            )}
          >
            {ICONOS.mas}
            <span>Más</span>
          </button>
        </div>
      </nav>

      <Sheet open={masAbierto} onClose={() => setMasAbierto(false)} title="Más secciones">
        <h2 className="mb-1 font-display text-subheading font-semibold text-ink">Más</h2>
        <p className="mb-4 text-meta text-muted">
          {esPlataforma ? 'Gestión de la plataforma' : (negocioActual?.name ?? 'Tu negocio')}
        </p>

        {esSuperadmin && !esPlataforma && businesses && businesses.length > 1 && (
          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-meta font-semibold text-body-2">Cambiar de negocio</span>
            <Select
              value={slug}
              onChange={(e) => irA(`/panel/${e.target.value}`)}
              aria-label="Cambiar de negocio"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </Select>
          </label>
        )}

        <ul className="-mx-1 flex flex-col">
          {enMas.map((t) => {
            const activo = location.pathname === t.to
            return (
              <li key={t.to}>
                <button
                  type="button"
                  onClick={() => irA(t.to)}
                  className={cx(
                    'flex min-h-12 w-full items-center justify-between rounded-xl px-3',
                    'text-ui transition-colors duration-200 hover:bg-canvas',
                    activo ? 'font-semibold text-ink' : 'text-body-2',
                  )}
                >
                  {t.label}
                  <span aria-hidden className="text-subtle">
                    ›
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {esSuperadmin && (
            <Button
              variant="secondary"
              block
              onClick={() =>
                irA(esPlataforma ? `/panel/${businesses?.[0]?.slug ?? ''}` : '/panel/admin')
              }
            >
              {esPlataforma ? 'Ir a un negocio' : 'Gestión de la plataforma'}
            </Button>
          )}
          <Button
            variant="quiet"
            block
            onClick={() => {
              setMasAbierto(false)
              void logout().then(() => navigate('/login'))
            }}
          >
            Salir
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
