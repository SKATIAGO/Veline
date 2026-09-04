import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Logo, LogoMark, Select, Sheet, Skeleton, cx } from '../../components/ui'

/**
 * Marco del panel. Exige sesión y adapta la interfaz al rol:
 *
 *  - EMPLEADO   → solo Agenda y Clientes.
 *  - ADMIN      → todo lo de SU negocio.
 *  - SUPERADMIN → todo lo anterior en cualquier negocio, selector para
 *                 cambiar de negocio y acceso a la gestión de la plataforma.
 *
 * El ámbito lo dice la URL: dentro de un negocio se ven sus secciones, y en
 * /panel/admin las de la plataforma. Son dos mundos distintos y mezclarlos
 * confunde sobre qué estás mirando.
 *
 * ── Por qué la navegación es distinta en cada tamaño ──
 * Son nueve secciones, y ninguna forma sirve para las dos pantallas.
 *
 * En una fila de pestañas arriba no caben: medido a 375 px se veían cuatro y
 * las otras cinco vivían en 474 px de desplazamiento lateral sin nada que
 * indicara que existían. Y en escritorio, aun cabiendo, nueve pestañas en
 * línea son una lista que hay que leer entera para encontrar una.
 *
 * Así que en móvil baja a una barra fija —lo que hace cualquier app, así que
 * no hay que explicarla— con los destinos de todos los días, un botón central
 * para apuntar la cita que entra por teléfono, y el resto en «Más». En
 * escritorio se va a la izquierda, en columna y agrupada por para qué sirve
 * cada cosa: las nueve se leen de un vistazo y aguanta crecer.
 */

const ROL_LABEL = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Administrador',
  EMPLEADO: 'Equipo',
} as const

/**
 * El marco del panel mientras se comprueba la sesión.
 *
 * Antes aquí había un spinner suelto sobre una pantalla en blanco: al recargar
 * se veía el vacío, luego el spinner y de golpe el panel entero: menú, barra y
 * contenido a la vez. Ese es el «golpe» que se notaba al entrar.
 *
 * Dibujando ya el marco —que no depende de la sesión, es el mismo siempre— lo
 * único que cambia al resolverse es el contenido. Se sustituyen huecos por
 * cosas en lugar de construir la página delante del usuario.
 */
function MarcoCargando() {
  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-line bg-cream md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="flex flex-col gap-3 px-4 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <Logo size={19} />
            <span className="rounded-full bg-ink px-2 py-0.5 text-caption font-semibold tracking-wide text-cream uppercase">
              Panel
            </span>
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-col gap-1.5 px-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-line bg-cream md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <LogoMark size={22} />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="size-8 rounded-full" />
          </div>
        </header>

        <div
          className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-10"
          aria-busy="true"
          aria-label="Comprobando sesión"
        >
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      </div>

      <nav
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-cream pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      </nav>
    </div>
  )
}

/** /panel sin más: cada rol aterriza donde le corresponde. */
export function PanelIndex() {
  const { user, loading } = useAuth()
  const { data: businesses, isLoading } = useQuery({
    queryKey: ['panel', 'businesses'],
    queryFn: api.panelBusinesses,
    enabled: !!user,
  })

  if (loading) return <MarcoCargando />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'SUPERADMIN' && user.businessSlug) {
    return <Navigate to={`/panel/${user.businessSlug}`} replace />
  }
  if (isLoading) return <MarcoCargando />
  if (!businesses?.length) return <Navigate to="/panel/admin" replace />
  return <Navigate to={`/panel/${businesses[0].slug}`} replace />
}

/* ── Iconos ───────────────────────────────────────────────────
   Trazo de 1,75 y esquinas redondeadas, para que peguen con el
   logo. Van marcados como decorativos: el nombre va al lado en
   texto, así que repetirlo al lector de pantalla solo estorba. */
function Icono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-[22px]'}
    >
      {children}
    </svg>
  )
}

const TRAZOS = {
  agenda: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2M16.5 8.4a3 3 0 0 0 0-.8M17 14.9c2.4.5 4 2.4 4 5.1" />
    </>
  ),
  negocio: (
    <>
      <path d="M4 9.5 5.6 5h12.8L20 9.5M4 9.5h16M4 9.5v9.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ),
  servicios: (
    <>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </>
  ),
  horario: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  personas: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5" />
    </>
  ),
  equipo: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2.5" />
      <path d="M8.5 6V4.5A1.5 1.5 0 0 1 10 3h4a1.5 1.5 0 0 1 1.5 1.5V6" />
    </>
  ),
  cuenta: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.8v8.4M14.2 9.7c-.5-.6-1.3-.9-2.2-.9-1.3 0-2.2.7-2.2 1.7 0 2.4 4.4 1.2 4.4 3.6 0 1-1 1.7-2.2 1.7-1 0-1.8-.3-2.3-1" />
    </>
  ),
  actividad: (
    <>
      <path d="M3 12h4l2.5-6 4 13L16 12h5" />
    </>
  ),
  cobros: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M2.5 10h19" />
    </>
  ),
  mas: (
    <>
      <circle cx="5.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.5" cy="12" r="1.4" />
    </>
  ),
} as const

type ClaveIcono = keyof typeof TRAZOS

type Seccion = {
  to: string
  label: string
  icono: ClaveIcono
  grupo: string
  end?: boolean
  /** Si aparece también en la barra de abajo del móvil. */
  enBarra?: boolean
}

/** Un destino de la barra inferior. 56 px de alto: se acierta sin mirar. */
function BotonBarra({ seccion }: { seccion: Seccion }) {
  return (
    <NavLink
      to={seccion.to}
      end={seccion.end}
      className={({ isActive }) =>
        cx(
          'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1',
          'text-caption font-semibold transition-colors duration-200',
          isActive ? 'text-brand-text' : 'text-subtle',
        )
      }
    >
      <Icono>{TRAZOS[seccion.icono]}</Icono>
      <span className="max-w-full truncate">{seccion.label}</span>
    </NavLink>
  )
}

/** Una entrada del menú lateral. 44 px, con el icono a la izquierda. */
function ItemLateral({ seccion }: { seccion: Seccion }) {
  return (
    <NavLink
      to={seccion.to}
      end={seccion.end}
      className={({ isActive }) =>
        cx(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 text-body',
          'transition-colors duration-200',
          isActive
            ? 'bg-canvas font-semibold text-ink'
            : 'font-medium text-body-2 hover:bg-canvas/60 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icono className={cx('size-[19px] shrink-0', isActive ? 'text-brand' : 'text-subtle')}>
            {TRAZOS[seccion.icono]}
          </Icono>
          <span className="truncate">{seccion.label}</span>
        </>
      )}
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

  if (loading) return <MarcoCargando />
  if (!user) return <Navigate to="/login" replace />

  // Un admin o empleado solo tiene un negocio: si la URL apunta a otro,
  // se le lleva al suyo (la API rechazaría igualmente, esto es cortesía).
  if (!esSuperadmin && user.businessSlug && slug && slug !== user.businessSlug) {
    return <Navigate to={`/panel/${user.businessSlug}`} replace />
  }

  /* Una sola lista de secciones para las dos navegaciones. Antes había dos
     y era cuestión de tiempo que una creciera sin la otra y quedara una
     sección sin puerta en algún tamaño de pantalla. */
  const secciones: Seccion[] = esPlataforma
    ? [
        {
          to: '/panel/admin',
          label: 'Negocios',
          icono: 'negocio',
          grupo: 'Plataforma',
          end: true,
          enBarra: true,
        },
        {
          to: '/panel/admin/usuarios',
          label: 'Cuentas',
          icono: 'clientes',
          grupo: 'Plataforma',
          enBarra: true,
        },
        {
          to: '/panel/admin/cobros',
          label: 'Cobros',
          icono: 'cobros',
          grupo: 'Plataforma',
          enBarra: true,
        },
        {
          to: '/panel/admin/actividad',
          label: 'Actividad',
          icono: 'actividad',
          grupo: 'Plataforma',
          enBarra: true,
        },
      ]
    : [
        {
          to: `/panel/${slug}`,
          label: 'Agenda',
          icono: 'agenda',
          grupo: 'Día a día',
          end: true,
          enBarra: true,
        },
        {
          to: `/panel/${slug}/clientes`,
          label: 'Clientes',
          icono: 'clientes',
          grupo: 'Día a día',
          enBarra: true,
        },
        ...(puedeConfigurar
          ? ([
              {
                to: `/panel/${slug}/servicios`,
                label: 'Servicios',
                icono: 'servicios',
                grupo: 'Configuración',
              },
              {
                to: `/panel/${slug}/horario`,
                label: 'Horario',
                icono: 'horario',
                grupo: 'Configuración',
              },
              {
                to: `/panel/${slug}/personas`,
                label: 'Personas',
                icono: 'personas',
                grupo: 'Configuración',
              },
              {
                to: `/panel/${slug}/equipo`,
                label: 'Equipo',
                icono: 'equipo',
                grupo: 'Configuración',
              },
              {
                to: `/panel/${slug}/negocio`,
                label: 'El negocio',
                icono: 'negocio',
                grupo: 'Configuración',
                enBarra: true,
              },
              {
                to: `/panel/${slug}/facturacion`,
                label: 'Tu cuenta',
                icono: 'cuenta',
                grupo: 'Cuenta',
              },
              {
                to: `/panel/${slug}/actividad`,
                label: 'Actividad',
                icono: 'actividad',
                grupo: 'Cuenta',
              },
            ] satisfies Seccion[])
          : []),
      ]

  const negocioActual = businesses?.find((b) => b.slug === slug)

  // Orden de aparición, sin repetir: el primero que trae cada grupo lo coloca.
  const grupos = [...new Set(secciones.map((s) => s.grupo))]

  const enBarra = secciones.filter((s) => s.enBarra)
  const enMas = secciones.filter((s) => !s.enBarra)
  // En la plataforma no hay ninguna cita que apuntar.
  const conBotonCentral = !esPlataforma

  const irA = (to: string) => {
    setMasAbierto(false)
    navigate(to)
  }

  const salir = () => {
    setMasAbierto(false)
    // logout() ya lleva a /login con una carga limpia.
    void logout()
  }

  const selectorNegocio = esSuperadmin && !esPlataforma && businesses && businesses.length > 1 && (
    <Select
      value={slug}
      onChange={(e) => irA(`/panel/${e.target.value}`)}
      aria-label="Cambiar de negocio"
      className="text-meta"
    >
      {businesses.map((b) => (
        <option key={b.id} value={b.slug}>
          {b.name}
        </option>
      ))}
    </Select>
  )

  return (
    <div className="min-h-screen bg-canvas md:grid md:grid-cols-[248px_1fr]">
      {/* ── Menú lateral (escritorio) ──
          Se queda quieto mientras la página baja, y se desplaza por su cuenta
          si algún día no cabe. */}
      <aside className="hidden border-r border-line bg-cream md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="flex flex-col gap-3 px-4 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <Logo size={19} />
            <span className="rounded-full bg-ink px-2 py-0.5 text-caption font-semibold tracking-wide text-cream uppercase">
              Panel
            </span>
          </div>
          {/* Qué estás mirando, siempre a la vista: es lo que antes decía
              «Estás gestionando…» en una línea suelta sobre el contenido. */}
          {esPlataforma ? (
            <p className="text-meta font-semibold text-body-2">Gestión de la plataforma</p>
          ) : (
            (selectorNegocio ?? (
              <p className="truncate text-meta font-semibold text-body-2">
                {negocioActual?.name ?? ''}
              </p>
            ))
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Secciones del panel">
          {grupos.map((grupo) => (
            <div key={grupo} className="mb-1">
              <p className="px-3 pt-3 pb-1 text-caption font-bold tracking-[0.1em] text-subtle uppercase">
                {grupo}
              </p>
              <ul className="flex flex-col gap-0.5">
                {secciones
                  .filter((s) => s.grupo === grupo)
                  .map((s) => (
                    <li key={s.to}>
                      <ItemLateral seccion={s} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-line px-2 py-3">
          {esSuperadmin && (
            <button
              type="button"
              onClick={() =>
                irA(esPlataforma ? `/panel/${businesses?.[0]?.slug ?? ''}` : '/panel/admin')
              }
              className={cx(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 text-body font-medium',
                'text-body-2 transition-colors duration-200 hover:bg-canvas/60 hover:text-ink',
              )}
            >
              <Icono className="size-[19px] shrink-0 text-subtle">
                {esPlataforma ? TRAZOS.agenda : TRAZOS.cobros}
              </Icono>
              <span className="truncate">
                {esPlataforma ? 'Ir a un negocio' : 'Gestión de la plataforma'}
              </span>
            </button>
          )}

          <NavLink
            to={esPlataforma ? '/panel/admin/cuenta' : `/panel/${slug}/cuenta`}
            className={({ isActive }) =>
              cx(
                'flex min-h-11 items-center gap-2.5 rounded-xl px-2 text-meta',
                'transition-colors duration-200',
                isActive ? 'bg-ink text-cream' : 'text-body-2 hover:bg-canvas/60 hover:text-ink',
              )
            }
          >
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-caption font-bold text-white"
            >
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="block truncate font-semibold">{user.name}</span>
              <span className="block truncate text-caption opacity-80">{ROL_LABEL[user.role]}</span>
            </span>
          </NavLink>

          <Button size="sm" variant="quiet" className="justify-start px-3" onClick={salir}>
            Salir
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* ── Cabecera (solo móvil) ──
            Una sola línea: marca, dónde estás y tú. Todo lo demás vive en la
            barra de abajo, que está a un dedo. */}
        <header className="border-b border-line bg-cream md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <LogoMark size={22} />
              <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
                {esPlataforma ? 'Plataforma' : (negocioActual?.name ?? 'Panel')}
              </span>
            </div>
            <NavLink
              to={esPlataforma ? '/panel/admin/cuenta' : `/panel/${slug}/cuenta`}
              aria-label="Tu perfil"
              className={({ isActive }) =>
                cx(
                  'inline-flex min-h-10 items-center rounded-full px-1',
                  isActive ? 'bg-ink' : 'hover:bg-canvas',
                )
              }
            >
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-full bg-brand text-caption font-bold text-white"
              >
                {user.name.trim().charAt(0).toUpperCase()}
              </span>
            </NavLink>
          </div>
        </header>

        {/* El hueco de abajo deja pasar la barra fija sin tapar la última fila.

            La key con la ruta monta un <main> nuevo en cada sección, y con él
            la animación vuelve a arrancar: sin ella el contenido se sustituye
            de golpe y cambiar de pestaña se siente como un parpadeo. */}
        <main
          key={location.pathname}
          className="section-enter mx-auto max-w-[1100px] px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-10"
        >
          <Outlet />
        </main>
      </div>

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
            gridTemplateColumns: `repeat(${enBarra.length + (conBotonCentral ? 2 : 1)}, 1fr)`,
          }}
        >
          {/* El botón de apuntar va en el centro de verdad, no al final: es
              donde lo pone cualquier app y donde llega el pulgar. */}
          {(conBotonCentral ? enBarra.slice(0, Math.ceil(enBarra.length / 2)) : enBarra).map(
            (s) => (
              <BotonBarra key={s.to} seccion={s} />
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
                <Icono className="size-6">
                  <path d="M12 5v14M5 12h14" />
                </Icono>
              </button>
            </div>
          )}

          {conBotonCentral &&
            enBarra
              .slice(Math.ceil(enBarra.length / 2))
              .map((s) => <BotonBarra key={s.to} seccion={s} />)}

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
            <Icono>{TRAZOS.mas}</Icono>
            <span>Más</span>
          </button>
        </div>
      </nav>

      <Sheet open={masAbierto} onClose={() => setMasAbierto(false)} title="Más secciones">
        <h2 className="mb-1 font-display text-subheading font-semibold text-ink">Más</h2>
        <p className="mb-4 text-meta text-muted">
          {esPlataforma ? 'Gestión de la plataforma' : (negocioActual?.name ?? 'Tu negocio')}
        </p>

        {selectorNegocio && (
          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-meta font-semibold text-body-2">Cambiar de negocio</span>
            {selectorNegocio}
          </label>
        )}

        {grupos
          .filter((g) => enMas.some((s) => s.grupo === g))
          .map((grupo) => (
            <div key={grupo} className="mb-2">
              <p className="px-1 pt-2 pb-1 text-caption font-bold tracking-[0.1em] text-subtle uppercase">
                {grupo}
              </p>
              <ul className="-mx-1 flex flex-col">
                {enMas
                  .filter((s) => s.grupo === grupo)
                  .map((s) => {
                    const activo = location.pathname === s.to
                    return (
                      <li key={s.to}>
                        <button
                          type="button"
                          onClick={() => irA(s.to)}
                          className={cx(
                            'flex min-h-12 w-full items-center gap-3 rounded-xl px-3',
                            'text-ui transition-colors duration-200 hover:bg-canvas',
                            activo ? 'font-semibold text-ink' : 'text-body-2',
                          )}
                        >
                          <Icono
                            className={cx(
                              'size-[19px] shrink-0',
                              activo ? 'text-brand' : 'text-subtle',
                            )}
                          >
                            {TRAZOS[s.icono]}
                          </Icono>
                          <span className="flex-1 text-left">{s.label}</span>
                          <span aria-hidden className="text-subtle">
                            ›
                          </span>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}

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
          <Button variant="quiet" block onClick={salir}>
            Salir
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
