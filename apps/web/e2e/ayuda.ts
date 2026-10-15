import type { Page } from '@playwright/test'

/** Cuentas de demostración del seed. Solo existen en local y en CI. */
export const CUENTAS = {
  admin: { email: 'admin@taller.test', password: 'veline-demo-1234' },
  empleado: { email: 'empleado@taller.test', password: 'veline-demo-1234' },
  super: { email: 'super@veline.test', password: 'veline-demo-1234' },
} as const

export const NEGOCIO = 'taller-mecanico-rivas'

/* La sesión de cada cuenta se guarda tras el primer login: el servidor limita
   el login a cinco por minuto, y cada prueba entraba de nuevo. Es una cookie
   de sesión del servidor, así que sirve en cualquier navegador del mismo run. */
const sesiones = new Map<string, Awaited<ReturnType<Page['context']['prototype']['cookies']>>>()

/** Entra por la API, sin pasar por el formulario: lo que se prueba es la
    pantalla de destino, no el login. */
export async function entrar(page: Page, quien: keyof typeof CUENTAS) {
  const guardada = sesiones.get(quien)
  if (guardada) {
    await page.context().addCookies(guardada)
    return
  }
  const r = await page.request.post('/api/auth/login', { data: CUENTAS[quien] })
  if (!r.ok()) throw new Error(`No se pudo entrar como ${quien}: ${r.status()}`)
  sesiones.set(quien, await page.context().cookies())
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
