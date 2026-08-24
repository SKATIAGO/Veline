import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ButtonLink, Logo, cx } from './ui'
import { Awning } from './Ornaments'
import { CONTACT_EMAIL } from '@veline/shared'
import { ESLOGAN } from '../content/negocio'

const NAV = [
  { to: '/#como-funciona', label: 'Cómo funciona' },
  { to: '/#servicios', label: 'Servicios' },
  { to: '/precios', label: 'Precios' },
  { to: '/buscar', label: 'Marketplace' },
]

function Header() {
  // La barra se compacta y coge sombra en cuanto empiezas a bajar.
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cx(
        'sticky top-0 z-20 border-b bg-cream/90 backdrop-blur transition-[box-shadow,background-color,border-color] duration-300',
        scrolled ? 'border-line-strong shadow-[0_6px_20px_rgba(46,33,25,.07)]' : 'border-line',
      )}
    >
      <div
        className={cx(
          'mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-6 transition-[padding] duration-300 lg:px-16',
          scrolled ? 'py-2.5' : 'py-4',
        )}
      >
        <Logo />
        <nav className="hidden items-center gap-9 text-body font-medium text-body-2 lg:flex">
          {NAV.map((item) =>
            item.to.startsWith('/#') ? (
              // Link y no <a>: con <a> se recargaría la app entera al pulsarlo
              // desde otra página. El scroll hasta la sección lo hace ScrollToTop.
              <Link key={item.to} to={item.to} className="veline-navlink">
                {item.label}
              </Link>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx('veline-navlink', isActive && 'is-active font-semibold text-ink')
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden min-h-10 items-center px-1 text-body font-medium text-ink hover:text-brand sm:inline-flex"
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
        // Contacto es un mailto, no una ruta: la página no existe y el enlace
        // llevaba a la home, que no es contactar con nadie.
        { label: 'Contacto', href: `mailto:${CONTACT_EMAIL}` },
      ],
    },
  ]

  return (
    <footer className="relative border-t border-line">
      <Awning tone="brand" flip className="absolute inset-x-0 -top-px" />
      <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 px-6 pt-20 pb-14 sm:flex-row lg:px-16">
        <div className="max-w-[280px]">
          <div className="mb-2.5 font-display text-xl font-semibold text-ink">Veline</div>
          <p className="text-body leading-relaxed text-subtle">{ESLOGAN}</p>
          <p className="mt-2 text-body leading-relaxed text-subtle">
            Reservas online para cualquier negocio de barrio.
          </p>
        </div>
        <div className="flex flex-wrap gap-10 sm:gap-16">
          {columns.map((col) => (
            <div key={col.title}>
              <div className="mb-3.5 text-meta font-semibold text-ink">{col.title}</div>
              {/* -my-1.5 compensa el padding: el blanco pulsable crece a 32 px
                  sin que la lista se vea más separada de lo que estaba. */}
              <div className="-my-1.5 flex flex-col text-body text-subtle">
                {col.links.map((l) =>
                  l.href ? (
                    <a key={l.label} href={l.href} className="py-1.5 hover:text-brand">
                      {l.label}
                    </a>
                  ) : (
                    <Link key={l.label} to={l.to!} className="py-1.5 hover:text-brand">
                      {l.label}
                    </Link>
                  ),
                )}
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
