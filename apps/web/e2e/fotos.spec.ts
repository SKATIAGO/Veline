import { test, expect } from '@playwright/test'
import { NEGOCIO, cargada, entrar } from './ayuda'

/**
 * Subir una foto del negocio: progreso, miniatura nueva, reordenarla
 * arrastrando y con el teclado, y quitarla con confirmación. Deja la ficha
 * como estaba.
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

  // Reordenar: arrastrada con el ratón al primer puesto pasa a ser la portada.
  const nueva = await lista.locator('[data-foto]').last().getAttribute('data-foto')
  const primeraFoto = lista.locator('[data-foto]').first()
  const origen = (await lista.locator('[data-foto]').last().boundingBox())!
  const destino = (await primeraFoto.boundingBox())!
  await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2)
  await page.mouse.down()
  for (let k = 1; k <= 10; k++) {
    await page.mouse.move(
      origen.x + origen.width / 2 + ((destino.x - origen.x) * k) / 10,
      origen.y + origen.height / 2 + ((destino.y - origen.y) * k) / 10,
    )
  }
  await page.mouse.up()
  await expect(primeraFoto).toHaveAttribute('data-foto', nueva!)
  await expect(primeraFoto).toHaveAccessibleName(/portada/i)

  // Con el teclado: flecha a la derecha la baja un puesto; Inicio la devuelve.
  const suya = lista.locator(`[data-foto="${nueva}"]`)
  await suya.focus()
  await page.keyboard.press('ArrowRight')
  await expect(lista.locator('[data-foto]').nth(1)).toHaveAttribute('data-foto', nueva!)
  await expect(suya).toBeFocused()
  await page.keyboard.press('Home')
  await expect(primeraFoto).toHaveAttribute('data-foto', nueva!)

  // Quitarla: pide confirmación y vuelve a quedar como estaba.
  await suya.getByRole('button', { name: /quitar foto/i }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /quitar foto/i })
    .click()
  await expect.poll(async () => lista.getByRole('listitem').count()).toBe(antes)
})
