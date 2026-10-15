import { test, expect } from '@playwright/test'
import { NEGOCIO, cargada, entrar } from './ayuda'

/**
 * El fallo: al cerrar un asistente con cambios aparecía «¿Descartar los
 * cambios?»; si se cerraba esa pregunta sin contestar (Esc, tocar fuera, X),
 * el asistente se quedaba montado pero invisible, con el velo puesto y la
 * página bloqueada. Esto reproduce exactamente esos pasos.
 */
test.describe('Descartar cambios en un asistente', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, 'admin')
    await page.goto(`/panel/${NEGOCIO}`)
    await cargada(page)
  })

  for (const como of ['Escape', 'fuera', 'X'] as const) {
    test(`cerrar la pregunta con ${como} devuelve al asistente sin bloquear nada`, async ({
      page,
    }) => {
      await page
        .getByRole('button', { name: /apuntar una cita/i })
        .first()
        .click()
      const asistente = page.getByRole('dialog', { name: /apuntar una cita/i })
      await expect(asistente).toBeVisible()

      // Elegir el primer servicio y pasar de paso: ya hay cambios.
      await asistente.getByRole('button', { name: /cambio de aceite/i }).click()
      await asistente.getByRole('button', { name: 'Siguiente', exact: true }).click()

      // Cerrar con la X → pregunta.
      await asistente
        .getByRole('button', { name: /cerrar/i })
        .first()
        .click()
      const pregunta = page.getByRole('alertdialog')
      await expect(pregunta).toBeVisible()
      // El asistente sigue a la vista detrás, no se ha ido a ninguna parte.
      await expect(asistente).toBeInViewport()

      if (como === 'Escape') await page.keyboard.press('Escape')
      else if (como === 'X') await pregunta.getByRole('button', { name: /cerrar/i }).click()
      else await page.mouse.click(5, 5)

      await expect(pregunta).toBeHidden()
      // De vuelta al asistente, que sigue funcionando.
      await expect(asistente).toBeVisible()
      await expect(asistente).toBeInViewport()
      await expect(asistente.getByRole('button', { name: 'Siguiente', exact: true })).toBeEnabled()

      // Y «Descartar» de verdad cierra todo y deja la página libre.
      await asistente
        .getByRole('button', { name: /cerrar/i })
        .first()
        .click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /descartar/i })
        .click()
      await expect(asistente).toBeHidden()
      await expect(page.locator('[role="presentation"]')).toHaveCount(0)
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
      await page.getByRole('radio', { name: /calendario/i }).click()
      await expect(page.getByRole('radio', { name: /calendario/i })).toHaveAttribute(
        'aria-checked',
        'true',
      )
    })
  }

  test('«atrás» con cambios pregunta y no cierra si se cancela', async ({ page }) => {
    await page
      .getByRole('button', { name: /apuntar una cita/i })
      .first()
      .click()
    const asistente = page.getByRole('dialog', { name: /apuntar una cita/i })
    await asistente.getByRole('button', { name: /cambio de aceite/i }).click()
    await asistente.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await page.goBack()
    const pregunta = page.getByRole('alertdialog')
    await expect(pregunta).toBeVisible()
    await pregunta.getByRole('button', { name: /seguir editando/i }).click()
    await expect(asistente).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/panel/${NEGOCIO}`))
  })
})
