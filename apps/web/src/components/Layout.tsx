import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ButtonLink, Logo, cx } from './ui'
import { CONTACT_EMAIL, SOCIAL } from '@veline/shared'
import { AvisoCookies } from './AvisoCookies'

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

/* Mismo trazo (1.75, esquinas redondeadas) que el resto de iconos del
   producto, para que no desentonen al lado del logo. */
function IconoInstagram() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="size-full"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconoFacebook() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="size-full"
    >
      <path d="M14.5 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4h1.5V5.3c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.2H9.4v2.8h2.4V21" />
    </svg>
  )
}

/** Enlace circular de solo icono, para las redes. Abren en pestaña nueva:
    salir del sitio no debería perder el progreso de quien está mirando. */
function IconoSocial({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full text-subtle transition-colors duration-200 hover:bg-canvas hover:text-brand"
    >
      <span className="size-[19px]">{children}</span>
    </a>
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
        { label: 'Privacidad', to: '/privacidad' },
        { label: 'Cookies', to: '/cookies' },
      ],
    },
  ]

  return (
    <footer className="relative border-t border-line">
      <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 px-6 pt-20 pb-14 sm:flex-row lg:px-16">
        <div className="max-w-[280px]">
          <div className="mb-2.5 font-display text-xl font-semibold text-ink">Veline</div>
          <p className="text-body leading-relaxed text-subtle">
            Reservas online para cualquier negocio.
          </p>
          <div className="-ml-1.5 mt-4 flex items-center gap-1">
            <IconoSocial href={SOCIAL.instagram.url} label="Instagram de Veline">
              <IconoInstagram />
            </IconoSocial>
            <IconoSocial href={SOCIAL.facebook.url} label="Facebook de Veline">
              <IconoFacebook />
            </IconoSocial>
          </div>
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
  // La key con la ruta hace que React monte un <main> nuevo en cada
  // navegación, y con él la animación de entrada vuelve a arrancar desde
  // cero — así cada página nueva aparece con el mismo gesto suave.
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main key={pathname} className="page-enter flex-1">
        <Outlet />
      </main>
      <Footer />
      <AvisoCookies />
    </div>
  )
}
