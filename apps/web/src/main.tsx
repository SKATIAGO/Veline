import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { AuthProvider } from './lib/auth'
import { ProveedorIdioma } from './i18n/idioma'
import { Avisos } from './components/Avisos'
import { crearCacheDeConsultas, reintentarLecturas } from './lib/errores'
import './index.css'

const queryClient: QueryClient = new QueryClient({
  queryCache: crearCacheDeConsultas(() => queryClient),
  defaultOptions: {
    // Se reintenta lo que puede arreglarse solo (límite, servidor, red); un
    // 403 o un 404 no cambia por preguntar otra vez.
    queries: { retry: reintentarLecturas, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProveedorIdioma>
          <BrowserRouter>
            <App />
            <Avisos />
          </BrowserRouter>
        </ProveedorIdioma>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
