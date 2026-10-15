import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserContext, Page } from '@playwright/test'

/** Cuentas de demostración del seed. Solo existen en local y en CI. */
export const CUENTAS = {
  admin: { email: 'admin@taller.test', password: 'veline-demo-1234' },
  empleado: { email: 'empleado@taller.test', password: 'veline-demo-1234' },
  super: { email: 'super@veline.test', password: 'veline-demo-1234' },
} as const

export const NEGOCIO = 'taller-mecanico-rivas'

export const rutaSesion = (quien: keyof typeof CUENTAS) =>
  join(import.meta.dirname, '.auth', `${quien}.json`)

/** Entra con la sesión que guardó global-setup.ts (una por cuenta). */
export async function entrar(page: Page, quien: keyof typeof CUENTAS) {
  const estado = JSON.parse(readFileSync(rutaSesion(quien), 'utf8')) as {
    cookies: Parameters<BrowserContext['addCookies']>[0]
  }
  await page.context().addCookies(estado.cookies)
}

/** Acepta el aviso de cookies si está, para que no tape nada. */
export async function sinCookies(page: Page) {
  const boton = page.getByRole('button', { name: /entendido/i })
  if (await boton.isVisible().catch(() => false)) await boton.click()
}

/** Espera a que la pantalla haya terminado de cargar datos (sin esqueletos
    ni spinners a la vista). */
export async function cargada(page: Page) {
  await page.waitForLoadState('networkidle')
  await page
    .locator('[aria-busy="true"]')
    .first()
    .waitFor({ state: 'hidden' })
    .catch(() => {})
}
