import { describe, expect, it } from 'vitest'
import { extrasDeUrl, tramoExtras } from './reserva'

/**
 * Lo que se prueba aquí no es el formato de la URL, es que lo elegido en la
 * primera pantalla llegue entero a la última. Entre una y otra hay dos saltos
 * de página, y si se pierde por el camino el cliente acaba pagando de menos y
 * el negocio preparando un extra que nadie ha cobrado.
 */
describe('extras que viajan en la URL', () => {
  it('sin extras en la URL no hay nada elegido', () => {
    expect(extrasDeUrl(new URLSearchParams('servicio=abc'))).toEqual([])
  })

  /* Un `extras=` vacío llega cuando alguien recorta la URL a mano. Sin el
     filtro saldría [''], un id que no existe y que ensucia todas las cuentas. */
  it('un «extras» vacío tampoco', () => {
    expect(extrasDeUrl(new URLSearchParams('servicio=abc&extras='))).toEqual([])
  })

  it('el flujo normal no arrastra un «extras» suelto', () => {
    expect(tramoExtras([])).toBe('')
  })

  it('lo elegido llega igual a la pantalla siguiente', () => {
    const ids = ['ext_uno', 'ext_dos', 'ext_tres']
    const url = new URL(`https://veline.es/karo/reservar/fecha?servicio=abc${tramoExtras(ids)}`)
    expect(extrasDeUrl(url.searchParams)).toEqual(ids)
  })

  /* Volver atrás y seguir adelante otra vez es lo más normal del mundo en una
     reserva, y cada vuelta pasa la lista por los dos lados. */
  it('aguanta ir y venir entre pantallas', () => {
    const ids = ['ext_uno', 'ext_dos']
    let params = new URLSearchParams(`servicio=abc${tramoExtras(ids)}`)
    for (let i = 0; i < 5; i++) {
      params = new URLSearchParams(`servicio=abc${tramoExtras(extrasDeUrl(params))}`)
    }
    expect(extrasDeUrl(params)).toEqual(ids)
  })
})
