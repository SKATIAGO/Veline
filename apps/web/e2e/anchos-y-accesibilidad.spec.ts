import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { NEGOCIO, cargada, entrar, sinCookies } from './ayuda'

/**
 * Las pantallas que de verdad se usan, en los cinco anchos acordados:
 * 360 y 390 (móvil), 768 (tableta), 1280 y 1440 (escritorio).
 *
 *  - Nada desborda en horizontal.
 *  - Ningún campo baja de 16 px en móvil (zoom en iPhone).
 *  - axe no encuentra fallos serios o críticos (contraste, etiquetas, roles).
 */
const SERVICIO_DEMO = async (page: Page) => {
  const b = await page.request.get(`/api/businesses/${NEGOCIO}`).then((r) => r.json())
  return b.services[0].id as string
}

const PUBLICAS = (servicio: string) => [
  '/',
  '/buscar',
  '/precios',
  '/alta',
  '/login',
  `/${NEGOCIO}`,
  `/${NEGOCIO}/reservar`,
  `/${NEGOCIO}/reservar/fecha?servicio=${servicio}`,
  `/${NEGOCIO}/reservar/confirmar?servicio=${servicio}&hora=2030-01-15T09:00:00.000Z`,
]

const PANEL = [
  `/panel/${NEGOCIO}`,
  `/panel/${NEGOCIO}?vista=calendario`,
  `/panel/${NEGOCIO}/clientes`,
  `/panel/${NEGOCIO}/fichaje`,
  `/panel/${NEGOCIO}/servicios`,
  `/panel/${NEGOCIO}/equipo`,
  `/panel/${NEGOCIO}/horario`,
  `/panel/${NEGOCIO}/negocio`,
  `/panel/${NEGOCIO}/negocio/fotos`,
  `/panel/${NEGOCIO}/contabilidad`,
]

const ANCHOS = [360, 390, 768, 1280, 1440]

// Solo en el proyecto de escritorio: el ancho lo fija cada caso, no el dispositivo.
test.describe('Anchos y accesibilidad', () => {
  for (const ancho of ANCHOS) {
    test(`sin desbordes ni fallos de axe a ${ancho} px`, async ({ page }) => {
      test.skip(test.info().project.name !== 'escritorio', 'un solo motor basta')
      test.setTimeout(240_000)
      await page.setViewportSize({ width: ancho, height: ancho < 768 ? 800 : 900 })
      await entrar(page, 'admin')
      const servicio = await SERVICIO_DEMO(page)
      const fallos: string[] = []

      for (const ruta of [...PUBLICAS(servicio), ...PANEL]) {
        await page.goto(ruta)
        await cargada(page)
        await sinCookies(page)

        const desborde = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        if (desborde > 0) fallos.push(`${ruta} @${ancho}: desborda ${desborde}px`)

        if (ancho < 768) {
          const pequenos = await page.evaluate(() =>
            [...document.querySelectorAll('input,select,textarea')]
              .filter((e) => (e as HTMLElement).offsetParent !== null)
              .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
              .map((e) => (e as HTMLElement).id || e.getAttribute('aria-label') || e.tagName),
          )
          if (pequenos.length)
            fallos.push(`${ruta} @${ancho}: campos < 16px: ${pequenos.join(', ')}`)
        }

        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .exclude('[aria-busy="true"]')
          .analyze()
        for (const v of axe.violations) {
          if (v.impact !== 'serious' && v.impact !== 'critical') continue
          fallos.push(
            `${ruta} @${ancho}: ${v.id} (${v.impact}) ${v.nodes
              .slice(0, 3)
              .map((n) => `${n.target.join(' ')} — ${n.any[0]?.message ?? ''}`)
              .join(' | ')}`,
          )
        }
      }

      expect(fallos, fallos.join('\n')).toEqual([])
    })
  }
})
