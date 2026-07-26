import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dentro de Docker la API se resuelve por el nombre del servicio.
// Fuera de Docker: API_PROXY_TARGET=http://localhost:3001 npm run dev -w @veline/web
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://api:3001'

// Con TUNNEL=true la web se sirve a través de ngrok (HTTPS en el 443).
// Sin esto el HMR intentaría abrir el websocket contra el puerto 5173 del
// dominio público, que no existe, y la consola se llenaría de errores.
const tunnel = process.env.TUNNEL === 'true'

// Vite rechaza peticiones cuyo Host no conoce. El dominio de ngrok cambia en
// cada arranque, así que se permiten sus subdominios enteros.
const extraHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

const allowedHosts = extraHosts.length
  ? extraHosts
  : ['localhost', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts,
    // El bind mount de macOS no propaga eventos inotify al contenedor
    watch: { usePolling: true, interval: 300 },
    ...(tunnel ? { hmr: { protocol: 'wss', clientPort: 443 } } : {}),
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  // El workspace compartido es TypeScript sin compilar: que lo procese Vite
  optimizeDeps: { exclude: ['@veline/shared'] },
})
