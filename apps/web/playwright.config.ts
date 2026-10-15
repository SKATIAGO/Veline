import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de interfaz de verdad: un navegador que carga la app contra la API
 * y la base de datos de demostración.
 *
 * Lo que vigilan: que los fallos que se han visto a mano no vuelvan (el
 * modal que bloqueaba la interfaz), que ninguna pantalla desborde en los
 * cinco anchos acordados, y que axe no encuentre fallos de accesibilidad.
 *
 * En local se usa el entorno de Docker que ya está levantado (5173 → 3001).
 * En CI se arrancan la API y la web aquí mismo contra el Postgres del job.
 */
const enCI = !!process.env.CI
const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Las pruebas comparten la base de datos de demostración: de una en una,
  // o una reserva de prueba pisa a otra.
  workers: 1,
  retries: enCI ? 1 : 0,
  reporter: enCI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: base,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    // Sin animaciones de entrada: lo que se mide es la pantalla quieta.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    // Safari de iPhone, que es donde más se rompen las cosas.
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    ...(enCI ? [] : [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }]),
  ],
  webServer: enCI
    ? [
        {
          command:
            'npx prisma migrate deploy --schema prisma/schema.prisma && npx prisma generate --schema prisma/schema.prisma && npx tsx prisma/seed.ts && npx tsx src/index.ts',
          cwd: '../api',
          url: 'http://localhost:3001/api/health',
          timeout: 180_000,
          env: {
            PORT: '3001',
            TZ: 'Europe/Madrid',
            NODE_ENV: 'development',
            MAIL_MODE: 'dry',
            SMS_MODE: 'dry',
            DATABASE_URL: process.env.DATABASE_URL ?? '',
          },
        },
        {
          command: 'npx vite --port 5173 --strictPort',
          url: 'http://localhost:5173',
          timeout: 120_000,
          env: { API_PROXY_TARGET: 'http://localhost:3001' },
        },
      ]
    : undefined,
})
