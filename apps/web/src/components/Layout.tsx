import { useEffect, useState } from 'react'
import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button, ButtonLink, Logo, Sheet, Skeleton, cx } from './ui'
import { CONTACT_EMAIL, SOCIAL } from '@veline/shared'
import { AvisoCookies } from './AvisoCookies'
import { PieMinimo } from './PieMinimo'
import { SelectorIdioma } from './SelectorIdioma'
import { useIdioma, type Clave } from '../i18n/idioma'

const NAV: { to: string; clave: Clave }[] = [
  { to: '/#como-funciona', clave: 'nav.comoFunciona' },
  { to: '/precios', clave: 'nav.precios' },
  { to: '/buscar', clave: 'nav.marketplace' },
]

function Header() {
  const { t } = useIdioma()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menu, setMenu] = useState(false)
  // La barra se compacta y coge sombra en cuanto empiezas a bajar.
  const [scrolled, setScrolled] = useState(false)

  /* Navegar desde el menú sustituye la entrada del historial que abrió la
     ficha en vez de añadir otra: así «atrás» vuelve a la página de antes y no
     a la misma página con el menú cerrado. */
  const ir = (to: string) => {
    navigate(to, { replace: true })
    setMenu(false)
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={cx(
          'sticky top-0 z-cabecera border-b bg-cream/90 backdrop-blur transition-[box-shadow,background-color,border-color] duration-300',
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
                  {t(item.clave)}
                </Link>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cx('veline-navlink', isActive && 'is-active font-semibold text-ink')
                  }
                >
                  {t(item.clave)}
                </NavLink>
              ),
            )}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* En el móvil el idioma va dentro del menú: con el botón del menú
              al lado, en 375 px no caben las tres cosas. */}
            <div className="hidden sm:block">
              <SelectorIdioma />
            </div>
            <Link
              to="/login"
              className="hidden min-h-10 items-center px-1 text-body font-medium text-ink hover:text-brand sm:inline-flex"
            >
              {t('nav.entrar')}
            </Link>
            <ButtonLink to="/precios" size="sm">
              {t('nav.anadirNegocio')}
            </ButtonLink>
            {/* Por debajo de 1024 px la navegación no cabe en la barra, y no
              había ninguna otra forma de llegar a Cómo funciona, Servicios o
              el Marketplace —ni de iniciar sesión en un móvil— salvo bajar
              hasta el pie de la página. */}
            <button
              type="button"
              onClick={() => setMenu(true)}
              aria-label={t('nav.abrirMenu')}
              aria-haspopup="dialog"
              aria-expanded={menu}
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors duration-200 hover:bg-canvas lg:hidden"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                className="size-6"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Fuera del <header>: su desenfoque atraparía la ficha dentro. */}
      <Sheet open={menu} onClose={() => setMenu(false)} title={t('nav.menu')}>
        <nav aria-label={t('nav.menu')} className="-mx-1 flex flex-col">
          {NAV.map((item) => {
            const actual = !item.to.startsWith('/#') && pathname === item.to
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => ir(item.to)}
                aria-current={actual ? 'page' : undefined}
                className={cx(
                  'flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-ui transition-colors duration-200 hover:bg-canvas',
                  actual ? 'font-semibold text-ink' : 'text-body-2',
                )}
              >
                {t(item.clave)}
                <span aria-hidden className="text-subtle">
                  ›
                </span>
              </button>
            )
          })}
        </nav>

        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-4">
          <Button block onClick={() => ir('/precios')}>
            {t('nav.anadirNegocio')}
          </Button>
          <Button block variant="secondary" onClick={() => ir('/login')}>
            {t('nav.entrar')}
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <span className="text-meta font-semibold text-body-2">{t('comun.idioma')}</span>
          <SelectorIdioma />
        </div>
      </Sheet>
    </>
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
      className="grid size-11 shrink-0 place-items-center rounded-full border border-accent/40 text-accent transition-colors duration-200 hover:bg-accent/15 hover:text-cream"
    >
      <span className="size-[19px]">{children}</span>
    </a>
  )
}

function Footer() {
  const { t } = useIdioma()

  const columns: { title: Clave; links: { label: Clave; to?: string; href?: string }[] }[] = [
    {
      title: 'pie.negocios',
      links: [
        { label: 'nav.comoFunciona', to: '/#como-funciona' },
        { label: 'nav.precios', to: '/precios' },
        { label: 'pie.panel', to: '/panel' },
      ],
    },
    {
      title: 'pie.marketplace',
      links: [
        { label: 'pie.buscarNegocios', to: '/buscar' },
        { label: 'pie.consultarReserva', to: '/buscar' },
      ],
    },
    {
      title: 'pie.compania',
      links: [
        { label: 'pie.sobreNosotros', to: '/' },
        // Contacto es un mailto, no una ruta: la página no existe y el enlace
        // llevaba a la home, que no es contactar con nadie.
        { label: 'pie.contacto', href: `mailto:${CONTACT_EMAIL}` },
        { label: 'pie.privacidad', to: '/privacidad' },
        { label: 'pie.cookies', to: '/cookies' },
      ],
    },
  ]

  return (
    <footer className="relative border-t border-accent/50 bg-ink text-cream">
      <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 px-6 pt-20 pb-14 sm:flex-row lg:px-16">
        <div className="max-w-[280px]">
          <div className="mb-2.5 font-display text-subheading font-semibold text-accent">
            Veline
          </div>
          <p className="text-body leading-relaxed text-ondark-muted-2">{t('pie.eslogan')}</p>
          <div className="mt-4 flex items-center gap-2">
            <IconoSocial href={SOCIAL.instagram.url} label={t('pie.red', { red: 'Instagram' })}>
              <IconoInstagram />
            </IconoSocial>
            <IconoSocial href={SOCIAL.facebook.url} label={t('pie.red', { red: 'Facebook' })}>
              <IconoFacebook />
            </IconoSocial>
          </div>
        </div>
        <div className="flex flex-wrap gap-10 sm:gap-16">
          {columns.map((col) => (
            <div key={col.title}>
              <div className="mb-3.5 border-b border-accent/30 pb-2 text-meta font-semibold tracking-[0.12em] text-accent uppercase">
                {t(col.title)}
              </div>
              {/* -my-2.5 compensa el padding: el blanco pulsable llega a 44 px
                  sin que la lista se vea más separada de lo que estaba. */}
              <div className="-my-2.5 flex flex-col text-body text-ondark-muted-2">
                {col.links.map((l) =>
                  l.href ? (
                    <a
                      key={l.label}
                      href={l.href}
                      className="py-2.5 transition-colors hover:text-accent"
                    >
                      {t(l.label)}
                    </a>
                  ) : (
                    <Link
                      key={l.label}
                      to={l.to!}
                      className="py-2.5 transition-colors hover:text-accent"
                    >
                      {t(l.label)}
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

/** Mientras llega el código de una página pública: su sitio, con forma de página. */
function EsqueletoPagina() {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-10 lg:px-16"
    >
      <Skeleton className="h-9 w-2/3 max-w-md" />
      <Skeleton className="h-5 w-1/2 max-w-sm" />
      <Skeleton className="mt-4 h-64" />
    </div>
  )
}

export function Layout() {
  // La key con la ruta hace que React monte un <main> nuevo en cada
  // navegación, y con él la animación de entrada vuelve a arrancar desde
  // cero — así cada página nueva aparece con el mismo gesto suave.
  const { pathname } = useLocation()
  /* Mientras alguien reserva, el pie completo es una salida en cada paso y
     empuja el botón de continuar hacia abajo: queda solo ayuda y legal. */
  const reservando =
    /\/reservar(\/|$)/.test(pathname) || /^\/reserva\/[^/]+\/reprogramar/.test(pathname)
  return (
    <div className="flex min-h-screen flex-col">
      {/* Durante la reserva, en el móvil manda la barra del propio asistente
          (atrás · dónde estás · salir): la cabecera pública solo en escritorio. */}
      <div className={reservando ? 'hidden lg:block' : undefined}>
        <Header />
      </div>
      {/* En la reserva los pasos son una misma app: sin animación de entrada
          entre uno y otro (la barra del asistente no se mueve). Fuera, una
          entrada corta que no parte de transparente. Suspense aquí y no solo
          arriba: si una pantalla tarda en cargar su código, la cabecera y el
          pie se quedan; solo el centro espera. */}
      <main
        key={reservando ? 'reserva' : pathname}
        className={reservando ? 'flex-1' : 'page-enter flex-1'}
      >
        <Suspense fallback={<EsqueletoPagina />}>
          <Outlet />
        </Suspense>
      </main>
      {reservando ? <PieMinimo /> : <Footer />}
      <AvisoCookies />
    </div>
  )
}
