import { test, expect } from '@playwright/test'
import { NEGOCIO, cargada, entrar } from './ayuda'

/**
 * Subir una foto del negocio: progreso, miniatura nueva y quitarla con
 * confirmación. Deja la ficha como estaba.
 */
test('subir y quitar una foto del negocio', async ({ page }) => {
  test.skip(test.info().project.name !== 'escritorio', 'una vez basta')
  await entrar(page, 'admin')
  await page.goto(`/panel/${NEGOCIO}/negocio/fotos`)
  await cargada(page)

  const lista = page.getByRole('list', { name: /fotos/i })
  const antes = await lista.getByRole('listitem').count()

  // Un PNG de verdad, pintado por el propio navegador.
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#a46639'
    ctx.fillRect(0, 0, 64, 64)
    return c.toDataURL('image/png')
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: 'prueba.png',
    mimeType: 'image/png',
    buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
  })

  // Aparece la miniatura nueva (la subida se retira sola al acabar).
  await expect
    .poll(async () => lista.locator('li:not([aria-live])').count(), { timeout: 20_000 })
    .toBe(antes + 1)
  await expect(page.getByText(/foto añadida/i)).toBeVisible()

  // Quitarla: pide confirmación y vuelve a quedar como estaba.
  await lista
    .getByRole('listitem')
    .last()
    .getByRole('button', { name: /quitar foto/i })
    .click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /quitar foto/i })
    .click()
  await expect.poll(async () => lista.getByRole('listitem').count()).toBe(antes)
})
