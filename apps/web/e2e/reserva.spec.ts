import { test, expect } from '@playwright/test'
import { NEGOCIO, cargada, sinCookies } from './ayuda'

/**
 * La reserva entera, como la hace un cliente: ficha → (extras) → fecha y hora
 * → datos → hecha. En móvil y en escritorio. Al final se cancela la cita por
 * la API para no dejar rastro en la agenda de demostración.
 */
test.describe('Reserva del cliente', () => {
  test('de la ficha a la confirmación', async ({ page }) => {
    await page.goto(`/${NEGOCIO}`)
    await cargada(page)
    await sinCookies(page)

    // Paso 1: la ficha dice que es el paso 1 y se elige un servicio.
    await expect(page.getByText(/paso 1 de \d/i)).toBeVisible()
    await page
      .getByRole('button', { name: /reservar/i })
      .first()
      .click()

    // Paso de extras, si el negocio tiene carta.
    if (/\/reservar\/extras/.test(page.url())) {
      await expect(page.getByRole('heading', { level: 1 })).toContainText(/extras/i)
      await page
        .getByRole('button', { name: /continuar/i })
        .first()
        .click()
    }

    // Fecha y hora: calendario mensual, un día con hueco y una hora.
    await expect(page).toHaveURL(/\/reservar\/fecha/)
    await expect(page.getByRole('grid')).toBeVisible()
    const hora = page
      .getByRole('group', { name: /mañana|tarde/i })
      .first()
      .locator('button:not([disabled])')
      .first()
    await expect(hora).toBeVisible()
    await hora.click()
    // El indicador de pasos marca el actual (nombres en escritorio, barra en el móvil).
    await expect(
      page.locator('[aria-current="step"]:visible, [role="progressbar"]:visible').first(),
    ).toBeVisible()
    await page
      .getByRole('button', { name: /continuar/i })
      .first()
      .click()

    // Datos: sin rellenar, el foco va al primer error; luego se rellena.
    await expect(page).toHaveURL(/\/reservar\/confirmar/)
    await page
      .getByRole('button', { name: /confirmar reserva/i })
      .first()
      .click()
    await expect(page.locator('#confirmar-name')).toBeFocused()
    await page.locator('#confirmar-name').fill('Prueba E2E')
    await page.locator('#confirmar-phone').fill('600000099')
    await page
      .getByRole('button', { name: /confirmar reserva/i })
      .first()
      .click()

    // Hecha.
    await expect(page).toHaveURL(/\/reserva\/VL-/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/reserva confirmada/i)

    // Se cancela para dejar la agenda como estaba.
    const code = page.url().split('/reserva/')[1]!.split(/[?#]/)[0]
    const r = await page.request.post(`/api/bookings/${code}/cancel`, {
      data: { reason: 'Prueba automática' },
    })
    expect(r.ok()).toBeTruthy()
  })

  test('un paso sin servicio no reserva a ciegas', async ({ page }) => {
    await page.goto(`/${NEGOCIO}/reservar/fecha`)
    await cargada(page)
    await expect(page.getByText(/elige primero un servicio/i)).toBeVisible()
    await page.getByRole('link', { name: /ficha del negocio/i }).click()
    await expect(page).toHaveURL(new RegExp(`/${NEGOCIO}$`))
  })
})
