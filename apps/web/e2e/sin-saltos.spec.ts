import { test, expect, type Page } from '@playwright/test'
import { NEGOCIO, cargada, entrar, sinCookies } from './ayuda'

/**
 * Que nada parpadee ni dé saltos donde ya lo hacía:
 *
 *  - Reserva: al pasar de mes, el calendario no desaparece (antes se cambiaba
 *    por un esqueleto de otra altura y la página bajaba 400 px de golpe).
 *  - Panel: al cambiar de sección con el ratón encima del menú (precarga), la
 *    sección se pinta completa sin pasar por un esqueleto.
 */

/** Muestrea la página cada 30 ms durante `ms` y devuelve lo que se vio. */
async function muestrear(page: Page, ms: number, fn: () => unknown) {
  return page.evaluate(
    async ({ ms, src }) => {
      const f = new Function(`return (${src})()`) as () => unknown
      const fuera: unknown[] = []
      const fin = performance.now() + ms
      while (performance.now() < fin) {
        fuera.push(f())
        await new Promise((r) => setTimeout(r, 30))
      }
      return fuera
    },
    { ms, src: fn.toString() },
  )
}

test('la reserva no pierde el calendario al cambiar de mes', async ({ page }) => {
  const b = await page.request.get(`/api/businesses/${NEGOCIO}`).then((r) => r.json())
  await page.goto(`/${NEGOCIO}/reservar/fecha?servicio=${b.services[0].id}`)
  await cargada(page)
  await sinCookies(page)
  await expect(page.getByRole('grid')).toBeVisible()

  await page.getByRole('button', { name: /mes siguiente/i }).click()
  const vistos = await muestrear(page, 900, () => document.querySelectorAll('[role=grid]').length)
  expect(vistos.every((n) => n === 1)).toBe(true)
})

test('el panel cambia de sección sin pasar por un esqueleto', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'el menú lateral es de escritorio')
  await entrar(page, 'admin')
  await page.goto(`/panel/${NEGOCIO}`)
  await cargada(page)

  for (const ruta of ['clientes', 'servicios', 'equipo', 'contabilidad']) {
    const enlace = page.locator(`aside a[href="/panel/${NEGOCIO}/${ruta}"]`)
    await enlace.hover()
    await page.waitForLoadState('networkidle')
    await enlace.click()
    const esqueletos = await muestrear(
      page,
      300,
      () => document.querySelectorAll('main [aria-busy="true"], main .animate-pulse').length,
    )
    expect(
      esqueletos.every((n) => n === 0),
      `esqueleto en ${ruta}`,
    ).toBe(true)
  }
})
