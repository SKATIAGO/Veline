import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Search } from './pages/Search'
import { Business } from './pages/Business'
import { BookingDate } from './pages/BookingDate'
import { BookingConfirm } from './pages/BookingConfirm'
import { BookingDone } from './pages/BookingDone'
import { Pricing } from './pages/Pricing'
import { Login } from './pages/Login'
import { ForgotPassword, ResetPassword } from './pages/PasswordFlow'
import { PanelIndex, PanelLayout } from './pages/panel/PanelLayout'
import { PanelAdmin } from './pages/panel/PanelAdmin'
import { PanelAdminUsers } from './pages/panel/PanelAdminUsers'
import { PanelUsers } from './pages/panel/PanelUsers'
import { PanelCuenta } from './pages/panel/PanelCuenta'
import { PanelAgenda } from './pages/panel/PanelAgenda'
import { PanelServices } from './pages/panel/PanelServices'
import { PanelHours } from './pages/panel/PanelHours'
import { PanelActividad } from './pages/panel/PanelActividad'
import { EmptyState } from './components/ui'
import { ScrollToTop } from './components/ScrollToTop'

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
      <Route path="/restablecer" element={<ResetPassword />} />
      <Route path="/panel" element={<PanelIndex />} />
      {/* /panel/admin va ANTES que /panel/:slug: el segmento estático gana */}
      <Route path="/panel/admin" element={<PanelLayout />}>
        <Route index element={<PanelAdmin />} />
        <Route path="usuarios" element={<PanelAdminUsers />} />
        <Route path="actividad" element={<PanelActividad />} />
        <Route path="cuenta" element={<PanelCuenta />} />
      </Route>
      <Route path="/panel/:slug" element={<PanelLayout />}>
        <Route index element={<PanelAgenda />} />
        <Route path="servicios" element={<PanelServices />} />
        <Route path="horario" element={<PanelHours />} />
        <Route path="equipo" element={<PanelUsers />} />
        <Route path="actividad" element={<PanelActividad />} />
        <Route path="cuenta" element={<PanelCuenta />} />
      </Route>

      {/* Lado cliente */}
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/buscar" element={<Search />} />
        <Route path="/precios" element={<Pricing />} />
        {/* La home ya es la página de negocio; /negocios se mantiene por los
            enlaces que ya se hayan compartido. */}
        <Route path="/negocios" element={<Navigate to="/" replace />} />
        <Route path="/reserva/:code" element={<BookingDone />} />
        <Route path="/:slug" element={<Business />} />
        <Route path="/:slug/reservar/fecha" element={<BookingDate />} />
        <Route path="/:slug/reservar/confirmar" element={<BookingConfirm />} />
        <Route
          path="*"
          element={
            <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
              <EmptyState
                title="Esta página no existe"
                hint="Vuelve al inicio y prueba de nuevo."
              />
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
