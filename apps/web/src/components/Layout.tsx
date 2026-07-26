import { Link, NavLink, Outlet } from 'react-router-dom'
import { ButtonLink, Logo } from './ui'
import { ESLOGAN } from '../content/negocio'

const NAV = [
  { to: '/#como-funciona', label: 'Cómo funciona' },
  { to: '/#servicios', label: 'Servicios' },
  { to: '/precios', label: 'Precios' },
  { to: '/buscar', label: 'Marketplace' },
]

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-6 py-4 lg:px-16">
        <Logo />
        <nav className="hidden items-center gap-9 text-[14.5px] font-medium text-body-2 lg:flex">
          {NAV.map((item) =>
            item.to.startsWith('/#') ? (
              // Link y no <a>: con <a> se recargaría la app entera al pulsarlo
              // desde otra página. El scroll hasta la sección lo hace ScrollToTop.
              <Link key={item.to} to={item.to} className="hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'font-semibold text-ink' : 'hover:text-ink'
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/panel"
            className="hidden text-[14.5px] font-medium text-ink hover:text-brand sm:block"
          >
            Iniciar sesión
          </Link>
          <ButtonLink to="/precios" size="sm">
            Añadir mi negocio
          </ButtonLink>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  const columns = [
    {
      title: 'Negocios',
      links: [
        { label: 'Cómo funciona', to: '/#como-funciona' },
        { label: 'Servicios para empresas', to: '/#servicios' },
        { label: 'Precios', to: '/precios' },
        { label: 'Panel de gestión', to: '/panel' },
      ],
    },
    {
      title: 'Marketplace',
      links: [
        { label: 'Buscar negocios', to: '/buscar' },
        { label: 'Consultar mi reserva', to: '/buscar' },
      ],
    },
    {
      title: 'Compañía',
      links: [
        { label: 'Sobre nosotros', to: '/' },
        { label: 'Contacto', to: '/' },
      ],
    },
  ]

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 px-6 py-14 sm:flex-row lg:px-16">
        <div className="max-w-[280px]">
          <div className="mb-2.5 font-display text-xl font-semibold text-ink">Veline</div>
          <p className="text-[13.5px] leading-relaxed text-subtle">{ESLOGAN}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-subtle">
            Reservas online para cualquier negocio de barrio.
          </p>
        </div>
        <div className="flex flex-wrap gap-10 sm:gap-16">
          {columns.map((col) => (
            <div key={col.title}>
              <div className="mb-3.5 text-[12.5px] font-semibold text-ink">{col.title}</div>
              <div className="flex flex-col gap-2.5 text-[13.5px] text-subtle">
                {col.links.map((l) => (
                  <Link key={l.label} to={l.to} className="hover:text-brand">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
