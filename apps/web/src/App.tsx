import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Search } from './pages/Search'
import { Business } from './pages/Business'
import { BookingDate } from './pages/BookingDate'
import { BookingConfirm } from './pages/BookingConfirm'
import { BookingDone } from './pages/BookingDone'
import { Pricing } from './pages/Pricing'
import { ForBusiness } from './pages/ForBusiness'
import { PanelIndex, PanelLayout } from './pages/panel/PanelLayout'
import { PanelAgenda } from './pages/panel/PanelAgenda'
import { PanelServices } from './pages/panel/PanelServices'
import { PanelHours } from './pages/panel/PanelHours'
import { EmptyState } from './components/ui'

export function App() {
  return (
    <Routes>
      {/* Panel del negocio — layout propio, sin la cabecera pública */}
      <Route path="/panel" element={<PanelIndex />} />
      <Route path="/panel/:slug" element={<PanelLayout />}>
        <Route index element={<PanelAgenda />} />
        <Route path="servicios" element={<PanelServices />} />
        <Route path="horario" element={<PanelHours />} />
      </Route>

      {/* Lado cliente */}
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/buscar" element={<Search />} />
        <Route path="/precios" element={<Pricing />} />
        <Route path="/negocios" element={<ForBusiness />} />
        <Route path="/reserva/:code" element={<BookingDone />} />
        <Route path="/:slug" element={<Business />} />
        <Route path="/:slug/reservar/fecha" element={<BookingDate />} />
        <Route path="/:slug/reservar/confirmar" element={<BookingConfirm />} />
        <Route
          path="*"
          element={
            <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
              <EmptyState title="Esta página no existe" hint="Vuelve al inicio y prueba de nuevo." />
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
