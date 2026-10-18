import { test, expect } from '@playwright/test'
import { NEGOCIO, cargada, entrar } from './ayuda'

/**
 * El fichaje de un empleado: entrar, pausa, reanudar, salir; y que el
 * historial lo enseñe con su pausa descontada.
 */
test('fichar entrada, pausa, reanudar y salida', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'una vez basta')
  await entrar(page, 'empleado')
  await page.goto(`/panel/${NEGOCIO}/fichaje`)
  await cargada(page)

  // Si quedó una jornada abierta de otra prueba, se cierra primero.
  const salida = page.getByRole('button', { name: /fichar salida/i })
  if (await salida.isVisible().catch(() => false)) {
    await salida.click()
    await expect(page.getByText(/estás fuera/i)).toBeVisible()
  }

  await page.getByRole('button', { name: /fichar entrada/i }).click()
  await expect(page.getByText(/dentro desde las/i)).toBeVisible()

  await page.getByRole('button', { name: /^pausa$/i }).click()
  await expect(page.getByText(/en pausa desde las/i)).toBeVisible()

  await page.getByRole('button', { name: /reanudar/i }).click()
  await expect(page.getByText(/dentro desde las/i)).toBeVisible()

  await page.getByRole('button', { name: /fichar salida/i }).click()
  await expect(page.getByText(/estás fuera/i)).toBeVisible()

  // El historial tiene la jornada de hoy.
  await page.getByRole('link', { name: /^historial$/i }).click()
  await expect(page).toHaveURL(/fichaje\/historial/)
  await cargada(page)
  await expect(page.getByRole('button', { name: /descargar mis fichajes/i })).toBeVisible()
  await expect(page.locator('li, tr').filter({ hasText: /–/ }).first()).toBeVisible()
})
