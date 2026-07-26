import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dentro de Docker la API se resuelve por el nombre del servicio.
// Fuera de Docker: API_PROXY_TARGET=http://localhost:3001 npm run dev -w @veline/web
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://api:3001'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // El bind mount de macOS no propaga eventos inotify al contenedor
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  // El workspace compartido es TypeScript sin compilar: que lo procese Vite
  optimizeDeps: { exclude: ['@veline/shared'] },
})
