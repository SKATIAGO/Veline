import { test, expect } from '@playwright/test'

/**
 * El alta por pasos: cada paso valida lo suyo, el borrador sobrevive a una
 * recarga (menos la contraseña) y el resumen enseña lo escrito. No se envía:
 * crear un negocio de verdad no es cosa de una prueba de interfaz.
 */
test('alta paso a paso con borrador', async ({ page }) => {
  await page.goto('/alta')
  await expect(page.getByRole('progressbar', { name: /paso 1 de 4/i })).toBeVisible()

  // Sin nombre no se pasa.
  await page.getByRole('button', { name: /siguiente/i }).click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(page.getByRole('progressbar', { name: /paso 1 de 4/i })).toBeVisible()

  await page.getByLabel(/nombre del negocio/i).fill('Peluquería Prueba E2E')
  await page.getByRole('button', { name: /siguiente/i }).click()
  await expect(page.getByRole('progressbar', { name: /paso 2 de 4/i })).toBeVisible()

  await page.getByLabel(/calle/i).fill('Calle Mayor 1')
  await page.getByLabel(/ciudad/i).fill('Madrid')
  await page.getByLabel(/código postal|cp/i).fill('28013')

  // Recargar: el borrador vuelve, en el paso 1, con lo escrito.
  await page.reload()
  await expect(page.getByText(/hemos recuperado/i)).toBeVisible()
  await expect(page.getByLabel(/nombre del negocio/i)).toHaveValue('Peluquería Prueba E2E')
  await page.getByRole('button', { name: /siguiente/i }).click()
  await expect(page.getByLabel(/calle/i)).toHaveValue('Calle Mayor 1')
  await page.getByRole('button', { name: /siguiente/i }).click()
  await expect(page.getByRole('progressbar', { name: /paso 3 de 4/i })).toBeVisible()

  await page.getByLabel(/tu nombre/i).fill('Prueba')
  await page.getByLabel(/email/i).fill('prueba-e2e@veline.test')
  await page.locator('input[autocomplete="new-password"]').fill('contrasena-de-prueba')
  await page.getByRole('button', { name: /siguiente/i }).click()

  // Resumen con lo escrito y botón de crear.
  await expect(page.getByRole('progressbar', { name: /paso 4 de 4/i })).toBeVisible()
  await expect(page.getByText('Peluquería Prueba E2E')).toBeVisible()
  await expect(page.getByText('28013 Madrid')).toBeVisible()
  await expect(page.getByRole('button', { name: /crear/i })).toBeVisible()

  // Empezar de cero borra el borrador.
  await page
    .getByRole('button', { name: /editar/i })
    .first()
    .click()
  await page.getByRole('button', { name: /empezar de cero/i }).click()
  await expect(page.getByLabel(/nombre del negocio/i)).toHaveValue('')
})
