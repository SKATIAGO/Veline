import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Search } from './pages/Search'
import { Business } from './pages/Business'
import { BookingDate } from './pages/BookingDate'
import { BookingConfirm } from './pages/BookingConfirm'
import { BookingDone } from './pages/BookingDone'
import { Pricing } from './pages/Pricing'
import { Resena } from './pages/Resena'
import { Login } from './pages/Login'
import { ForgotPassword, ResetPassword } from './pages/PasswordFlow'
import { PanelIndex, PanelLayout, PanelNoExiste } from './pages/panel/PanelLayout'
import { PanelAdmin } from './pages/panel/PanelAdmin'
import { PanelAdminUsers } from './pages/panel/PanelAdminUsers'
import { PanelCobros } from './pages/panel/PanelCobros'
import { PanelMiCuenta } from './pages/panel/PanelMiCuenta'
import { PanelUsers } from './pages/panel/PanelUsers'
import { PanelCuenta } from './pages/panel/PanelCuenta'
import { PanelAgenda } from './pages/panel/PanelAgenda'
import { PanelServices } from './pages/panel/PanelServices'
import { PanelHours } from './pages/panel/PanelHours'
import { PanelPersonas } from './pages/panel/PanelPersonas'
import { PanelNegocio } from './pages/panel/PanelNegocio'
import { PanelClientes } from './pages/panel/PanelClientes'
import { PanelFichaje } from './pages/panel/PanelFichaje'
import { PanelLocales } from './pages/panel/PanelLocales'
import { PanelActividad } from './pages/panel/PanelActividad'
import { EmptyState } from './components/ui'
import { ScrollToTop } from './components/ScrollToTop'
import { Legal } from './pages/Legal'
import { Alta } from './pages/Alta'
import { Verificar } from './pages/Verificar'
import { useIdioma } from './i18n/idioma'

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

function AppRoutes() {
  return (
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
        <Route path="servicios" element={<PanelServices />} />
        <Route path="horario" element={<PanelHours />} />
        <Route path="personas" element={<PanelPersonas />} />
        <Route path="clientes" element={<PanelClientes />} />
        <Route path="fichaje" element={<PanelFichaje />} />
        <Route path="locales" element={<PanelLocales />} />
        <Route path="equipo" element={<PanelUsers />} />
        <Route path="negocio" element={<PanelNegocio />} />
        <Route path="facturacion" element={<PanelMiCuenta />} />
        <Route path="actividad" element={<PanelActividad />} />
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
        <Route path="/resena/:token" element={<Resena />} />
        <Route path="/:slug" element={<Business />} />
        <Route path="/:slug/reservar/fecha" element={<BookingDate />} />
        <Route path="/:slug/reservar/confirmar" element={<BookingConfirm />} />
        <Route path="*" element={<NoExiste />} />
      </Route>
    </Routes>
  )
}
