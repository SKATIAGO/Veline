import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addDaysKey, hoyMadrid, toDateKey } from '@veline/shared'
import { api } from './api'
import { useLocal } from './local'
import { precargarPantallas } from './perezoso'

/**
 * Adelantar lo que va a pedir una sección del panel.
 *
 * Al cambiar de sección se veía un esqueleto y luego la pantalla crecía de
 * golpe hasta su tamaño (Contabilidad pasaba de 495 a 2 029 px). Con esto,
 * en cuanto el dedo toca un enlace del menú o el ratón pasa por encima, se
 * piden el código de la pantalla y sus datos, con LAS MISMAS claves que usará
 * la pantalla: cuando se abre, casi siempre ya está todo y se pinta entera
 * a la primera. Lo que ya está en caché y fresco no se vuelve a pedir.
 *
 * Además, al poco de abrir el panel se descarga en segundo plano el código de
 * todas las secciones (no los datos), para que ningún cambio de pantalla
 * tenga que esperar a un archivo.
 */

/** El componente de cada sección (los nombres con los que App.tsx los registra). */
const PANTALLA: Record<string, string> = {
  '': 'PanelAgenda',
  clientes: 'PanelClientes',
  fichaje: 'PanelFichaje',
  'fichaje/historial': 'FichajeHistorial',
  servicios: 'PanelServices',
  'servicios/extras': 'PanelExtras',
  equipo: 'PanelEquipo',
  horario: 'PanelHours',
  cierres: 'PanelCierres',
  locales: 'PanelLocales',
  negocio: 'PanelNegocio',
  'negocio/fotos': 'PanelFotos',
  'negocio/resenas': 'PanelResenas',
  contabilidad: 'PanelContabilidad',
  enlaces: 'PanelEnlaces',
  facturacion: 'PanelMiCuenta',
  actividad: 'PanelActividad',
  cuenta: 'PanelCuenta',
}

const primerDiaMes = () => {
  const h = hoyMadrid()
  return `${h.slice(0, 7)}-01`
}
const ultimoDiaMes = () => {
  const d = new Date(`${primerDiaMes()}T12:00:00`)
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** Devuelve `precargar(ruta)`, donde ruta es lo que va tras /panel/:slug/. */
export function usePrecargaPanel(slug: string) {
  const qc = useQueryClient()
  const { actual, paraEditar } = useLocal()

  return useCallback(
    (ruta: string) => {
      if (!slug) return
      const pantalla = PANTALLA[ruta]
      if (pantalla) precargarPantallas([pantalla])
      const pedir = (queryKey: unknown[], queryFn: () => Promise<unknown>) =>
        void qc.prefetchQuery({ queryKey, queryFn, staleTime: 30_000 })

      switch (ruta) {
        case '': {
          const hoy = hoyMadrid()
          pedir(['panel', slug, 'summary', actual], () => api.panelSummary(slug, actual))
          pedir(['panel', slug, 'bookings', 'agenda', hoy, actual], () =>
            api.panelBookings(slug, {
              from: addDaysKey(hoy, -7),
              to: addDaysKey(hoy, 14),
              local: actual,
            }),
          )
          // La vista Calendario: el mes en curso y sus notas.
          pedir(['panel', slug, 'bookings', 'mes', primerDiaMes(), actual], () =>
            api.panelBookings(slug, { from: primerDiaMes(), to: ultimoDiaMes(), local: actual }),
          )
          pedir(['panel', slug, 'notes', 'mes', primerDiaMes()], () =>
            api.panelNotes(slug, { from: primerDiaMes(), to: ultimoDiaMes() }),
          )
          break
        }
        case 'clientes':
          pedir(['panel', slug, 'customers', actual], () => api.panelCustomers(slug, actual))
          break
        case 'fichaje': {
          const hoy = hoyMadrid()
          pedir(['fichaje', slug, 'abierto'], () => api.fichajeAbierto(slug))
          pedir(['fichaje', slug, 'lista', addDaysKey(hoy, -7), hoy], () =>
            api.fichajes(slug, { desde: addDaysKey(hoy, -7), hasta: hoy }),
          )
          break
        }
        case 'fichaje/historial':
          pedir(['fichaje', slug, 'lista', '', ''], () => api.fichajes(slug, {}))
          break
        case 'servicios':
          pedir(['panel', slug, 'services'], () => api.panelServices(slug))
          break
        case 'servicios/extras':
          pedir(['panel', slug, 'extras'], () => api.panelExtras(slug))
          break
        case 'equipo':
          pedir(['panel', slug, 'staff'], () => api.panelStaff(slug))
          pedir(['panel', slug, 'users'], () => api.panelUsers(slug))
          pedir(['panel', slug, 'locales'], () => api.panelLocales(slug))
          break
        case 'horario':
          if (paraEditar)
            pedir(['panel', slug, 'hours', paraEditar], () => api.panelHours(slug, paraEditar))
          break
        case 'cierres':
          pedir(['panel', slug, 'closures', paraEditar], () => api.panelClosures(slug, paraEditar))
          break
        case 'locales':
          pedir(['panel', slug, 'locales'], () => api.panelLocales(slug))
          break
        case 'negocio':
        case 'negocio/fotos':
          pedir(['panel', slug, 'profile'], () => api.panelProfile(slug))
          break
        case 'contabilidad':
          pedir(['panel', slug, 'bookings', 'mes', primerDiaMes(), actual], () =>
            api.panelBookings(slug, { from: primerDiaMes(), to: ultimoDiaMes(), local: actual }),
          )
          break
        case 'negocio/resenas':
          pedir(['panel', slug, 'reviews'], () => api.panelReviews(slug))
          break
        case 'facturacion':
          pedir(['panel', slug, 'cuenta'], () => api.panelCuenta(slug))
          break
      }
    },
    [qc, slug, actual, paraEditar],
  )
}

/**
 * Hace algo cuando el navegador está libre (o a los 2 s como mucho).
 *
 * En el móvil no hay «pasar el ratón por encima»: la precarga por intención
 * llega con el dedo, unos milisegundos antes de cambiar de pantalla, y con
 * una red de teléfono no da tiempo. Por eso allí lo probable se pide antes,
 * en reposo: las secciones de la barra, las de «Más» al abrirla y las
 * pestañas hermanas de la sección en la que se está.
 */
export function alReposo(hacer: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(hacer, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(hacer, 600)
  return () => clearTimeout(id)
}

/** Descarga en segundo plano el código de todas las secciones, una vez. */
let codigoPedido = false
export function precargarCodigoPanel() {
  if (codigoPedido) return
  codigoPedido = true
  const pedir = () => precargarPantallas(Object.values(PANTALLA))
  if ('requestIdleCallback' in window) window.requestIdleCallback(pedir, { timeout: 4000 })
  else setTimeout(pedir, 2000)
}
