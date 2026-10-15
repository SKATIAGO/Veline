import { useAuth } from './lib/auth'
import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Search } from './pages/Search'
import { Business } from './pages/Business'
import { BookingExtras } from './pages/BookingExtras'
import { BookingDate } from './pages/BookingDate'
import { BookingConfirm } from './pages/BookingConfirm'
import { BookingDone } from './pages/BookingDone'
import { BookingReschedule } from './pages/BookingReschedule'
import { EmptyState, Spinner } from './components/ui'
import { ScrollToTop } from './components/ScrollToTop'
import { useIdioma } from './i18n/idioma'

/* Carga por rutas. El público (portada, buscador, ficha, reserva) viaja en el
   paquete principal; el panel, la plataforma y las pantallas que casi nadie
   abre (legal, alta, precios, login) se piden al entrar en ellas. En 3G, el
   primer arranque de una reserva dejaba de cargar un panel que no iba a usar. */
const perezoso = <K extends string>(carga: () => Promise<Record<K, ComponentType>>, nombre: K) =>
  lazy(() =>
    carga()
      .then((m) => {
        try {
          sessionStorage.removeItem('veline:recarga-paquete')
        } catch {
          /* da igual */
        }
        return { default: m[nombre] }
      })
      .catch((err) => {
        /* Tras un despliegue, una pestaña abierta pide paquetes con un nombre
           que ya no existe. Se recarga una vez para coger los nuevos; si vuelve
           a fallar, es la red y el error sigue su camino. */
        const clave = 'veline:recarga-paquete'
        try {
          if (!sessionStorage.getItem(clave)) {
            sessionStorage.setItem(clave, '1')
            window.location.reload()
            return new Promise<never>(() => {})
          }
        } catch {
          /* sin almacenamiento: no se recarga, se propaga */
        }
        throw err
      }),
  )

const Pricing = perezoso(() => import('./pages/Pricing'), 'Pricing')
const Resena = perezoso(() => import('./pages/Resena'), 'Resena')
const Login = perezoso(() => import('./pages/Login'), 'Login')
const ForgotPassword = perezoso(() => import('./pages/PasswordFlow'), 'ForgotPassword')
const ResetPassword = perezoso(() => import('./pages/PasswordFlow'), 'ResetPassword')
const PanelIndex = perezoso(() => import('./pages/panel/PanelLayout'), 'PanelIndex')
const PanelLayout = perezoso(() => import('./pages/panel/PanelLayout'), 'PanelLayout')
const PanelNoExiste = perezoso(() => import('./pages/panel/PanelLayout'), 'PanelNoExiste')
const PanelAdmin = perezoso(() => import('./pages/panel/PanelAdmin'), 'PanelAdmin')
const PanelAdminUsers = perezoso(() => import('./pages/panel/PanelAdminUsers'), 'PanelAdminUsers')
const PanelCobros = perezoso(() => import('./pages/panel/PanelCobros'), 'PanelCobros')
const PanelEnlaces = perezoso(() => import('./pages/panel/PanelEnlaces'), 'PanelEnlaces')
const PanelMiCuenta = perezoso(() => import('./pages/panel/PanelMiCuenta'), 'PanelMiCuenta')
const PanelCuenta = perezoso(() => import('./pages/panel/PanelCuenta'), 'PanelCuenta')
const PanelAgenda = perezoso(() => import('./pages/panel/PanelAgenda'), 'PanelAgenda')
const PanelContabilidad = perezoso(
  () => import('./pages/panel/PanelContabilidad'),
  'PanelContabilidad',
)
const PanelServices = perezoso(() => import('./pages/panel/PanelServices'), 'PanelServices')
const PanelHours = perezoso(() => import('./pages/panel/PanelHours'), 'PanelHours')
const PanelEquipo = perezoso(() => import('./pages/panel/PanelEquipo'), 'PanelEquipo')
const PanelFotos = perezoso(() => import('./pages/panel/PanelNegocio'), 'PanelFotos')
const PanelNegocio = perezoso(() => import('./pages/panel/PanelNegocio'), 'PanelNegocio')
const PanelCierres = perezoso(() => import('./pages/panel/PanelCierres'), 'PanelCierres')
const PanelExtras = perezoso(() => import('./pages/panel/PanelExtras'), 'PanelExtras')
const PanelClientes = perezoso(() => import('./pages/panel/PanelClientes'), 'PanelClientes')
const PanelFichaje = perezoso(() => import('./pages/panel/PanelFichaje'), 'PanelFichaje')
const FichajeHistorial = perezoso(
  () => import('./pages/panel/FichajeHistorial'),
  'FichajeHistorial',
)
const PanelLocales = perezoso(() => import('./pages/panel/PanelLocales'), 'PanelLocales')
const PanelActividad = perezoso(() => import('./pages/panel/PanelActividad'), 'PanelActividad')
const Legal = perezoso(() => import('./pages/Legal'), 'Legal')
const Alta = perezoso(() => import('./pages/Alta'), 'Alta')
const Verificar = perezoso(() => import('./pages/Verificar'), 'Verificar')

/** El 404 público. Es un componente y no un element={} suelto porque
    necesita el idioma, y para eso hace falta un hook. */
function NoExiste() {
  const { t } = useIdioma()

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
      <EmptyState title={t('comun.paginaNoExiste')} hint={t('comun.paginaNoExistePista')} />
    </div>
  )
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <AppRoutes />
    </>
  )
}

/**
 * Las pantallas de configuración y de dinero son de quien administra. Un
 * empleado que llegue por una dirección (un enlace, el historial) vuelve a la
 * agenda.
 */
function SoloAdministracion() {
  const { slug = '' } = useParams()
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.role === 'EMPLEADO') return <Navigate to={`/panel/${slug}`} replace />
  return <Outlet />
}

/** /panel/:slug/calendario → la pestaña Calendario de Agenda. */
function AlCalendario() {
  const { slug = '' } = useParams()
  return <Navigate to={`/panel/${slug}?vista=calendario`} replace />
}

function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Routes>
        {/* Panel del negocio — layout propio, sin la cabecera pública */}
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar" element={<ForgotPassword />} />
        <Route path="/alta" element={<Alta />} />
        <Route path="/verificar" element={<Verificar />} />
        <Route path="/restablecer" element={<ResetPassword />} />
        <Route path="/panel" element={<PanelIndex />} />
        {/* /panel/admin va ANTES que /panel/:slug: el segmento estático gana */}
        <Route path="/panel/admin" element={<PanelLayout />}>
          <Route index element={<PanelAdmin />} />
          <Route path="usuarios" element={<PanelAdminUsers />} />
          <Route path="cobros" element={<PanelCobros />} />
          <Route path="actividad" element={<PanelActividad />} />
          <Route path="cuenta" element={<PanelCuenta />} />
          <Route path="*" element={<PanelNoExiste />} />
        </Route>
        <Route path="/panel/:slug" element={<PanelLayout />}>
          <Route index element={<PanelAgenda />} />
          {/* El calendario es ahora una pestaña de Agenda. La dirección vieja
            sigue llevando a su sitio. */}
          <Route path="calendario" element={<AlCalendario />} />
          {/* Antes de entrar a ninguna de estas, se comprueba el rol. El menú ya
            las oculta a quien solo lleva la agenda, pero la dirección
            funcionaba: el servidor respondía 403 y la pantalla lo leía como
            «no hay nada», con su botón de añadir. */}
          <Route element={<SoloAdministracion />}>
            <Route path="contabilidad" element={<PanelContabilidad />} />
            <Route path="servicios" element={<PanelServices />} />
            <Route path="servicios/extras" element={<PanelExtras />} />
            <Route path="horario" element={<PanelHours />} />
            <Route path="cierres" element={<PanelCierres />} />
            <Route path="locales" element={<PanelLocales />} />
            <Route path="equipo" element={<PanelEquipo />} />
            <Route path="negocio" element={<PanelNegocio />} />
            <Route path="negocio/fotos" element={<PanelFotos />} />
            <Route path="enlaces" element={<PanelEnlaces />} />
            <Route path="facturacion" element={<PanelMiCuenta />} />
            <Route path="actividad" element={<PanelActividad />} />
          </Route>
          {/* Empleados y Administrador eran dos pantallas de la misma gente:
            ahora son Equipo. La dirección vieja sigue llevando a su sitio. */}
          <Route path="personas" element={<Navigate to="../equipo" replace />} />
          <Route path="clientes" element={<PanelClientes />} />
          <Route path="fichaje" element={<PanelFichaje />} />
          <Route path="fichaje/historial" element={<FichajeHistorial />} />
          <Route path="cuenta" element={<PanelCuenta />} />
          <Route path="*" element={<PanelNoExiste />} />
        </Route>

        {/* Lado cliente */}
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/buscar" element={<Search />} />
          <Route path="/precios" element={<Pricing />} />
          {/* La home ya es la página de negocio; /negocios se mantiene por los
            enlaces que ya se hayan compartido. */}
          <Route path="/negocios" element={<Navigate to="/" replace />} />
          {/* Antes de /:slug: esa ruta se traga cualquier camino de un solo
            segmento, así que /privacidad se leería como el identificador de un
            negocio y saldría «este negocio no existe». */}
          <Route path="/privacidad" element={<Legal />} />
          <Route path="/cookies" element={<Legal />} />
          <Route path="/reserva/:code" element={<BookingDone />} />
          <Route path="/reserva/:code/reprogramar" element={<BookingReschedule />} />
          <Route path="/resena/:token" element={<Resena />} />
          <Route path="/:slug" element={<Business />} />
          <Route path="/:slug/reservar/extras" element={<BookingExtras />} />
          <Route path="/:slug/reservar/fecha" element={<BookingDate />} />
          <Route path="/:slug/reservar/confirmar" element={<BookingConfirm />} />
          <Route path="*" element={<NoExiste />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
