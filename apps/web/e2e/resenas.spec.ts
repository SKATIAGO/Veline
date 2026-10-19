import { test, expect } from '@playwright/test'
import { NEGOCIO, cargada, sinCookies } from './ayuda'

/**
 * La pestaña Reseñas de la ficha enseña las reseñas (o dice que aún no hay),
 * no el antiguo «llega en la próxima versión».
 */
test('la ficha enseña sus reseñas', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'una vez basta')
  const negocio = await page.request.get(`/api/businesses/${NEGOCIO}`).then((r) => r.json())
  await page.goto(`/${NEGOCIO}`)
  await cargada(page)
  await sinCookies(page)
  await page.getByRole('radio', { name: /^reseñas$/i }).click()

  await expect(page.getByText(/próxima versión/i)).toHaveCount(0)
  if (negocio.reviewCount > 0) {
    await expect(page.getByRole('list', { name: /reparto de las notas/i })).toBeVisible()
    await expect(page.getByRole('img', { name: /de 5 estrellas/i }).first()).toBeVisible()
  } else {
    await expect(page.getByText(/todavía no hay reseñas/i)).toBeVisible()
  }
})
