import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { request, type FullConfig } from '@playwright/test'
import { CUENTAS, rutaSesion } from './ayuda'

/**
 * Entra una vez por cuenta de demostración y guarda la cookie de sesión. Las
 * pruebas la cargan con `entrar()`: así el login (limitado a cinco por minuto)
 * no se repite en cada prueba ni en cada navegador.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173'
  for (const quien of Object.keys(CUENTAS) as (keyof typeof CUENTAS)[]) {
    const ruta = rutaSesion(quien)
    // En local se repiten las pruebas cada pocos minutos: una sesión reciente
    // sirve y no gasta el cupo de logins.
    if (existsSync(ruta) && Date.now() - statSync(ruta).mtimeMs < 20 * 60_000) continue
    const ctx = await request.newContext({ baseURL })
    const r = await ctx.post('/api/auth/login', { data: CUENTAS[quien] })
    if (!r.ok()) throw new Error(`No se pudo entrar como ${quien}: ${r.status()}`)
    mkdirSync(dirname(ruta), { recursive: true })
    await ctx.storageState({ path: ruta })
    await ctx.dispose()
  }
}
