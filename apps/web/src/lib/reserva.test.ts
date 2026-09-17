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
     filtro saldría un extra sin id, que no existe y ensucia todas las
     cuentas. */
  it('un «extras» vacío tampoco', () => {
    expect(extrasDeUrl(new URLSearchParams('servicio=abc&extras='))).toEqual([])
  })

  it('el flujo normal no arrastra un «extras» suelto', () => {
    expect(tramoExtras([])).toBe('')
  })

  it('lo elegido llega igual a la pantalla siguiente', () => {
    const pedidos = [
      { extraId: 'ext_uno', quantity: 1 },
      { extraId: 'ext_dos', quantity: 3 },
    ]
    const url = new URL(`https://veline.es/karo/reservar/fecha?servicio=abc${tramoExtras(pedidos)}`)
    expect(extrasDeUrl(url.searchParams)).toEqual(pedidos)
  })

  /* Volver atrás y seguir adelante otra vez es lo más normal del mundo en una
     reserva, y cada vuelta pasa la lista por los dos lados. */
  it('aguanta ir y venir entre pantallas', () => {
    const pedidos = [
      { extraId: 'ext_uno', quantity: 2 },
      { extraId: 'ext_dos', quantity: 1 },
    ]
    let params = new URLSearchParams(`servicio=abc${tramoExtras(pedidos)}`)
    for (let i = 0; i < 5; i++) {
      params = new URLSearchParams(`servicio=abc${tramoExtras(extrasDeUrl(params))}`)
    }
    expect(extrasDeUrl(params)).toEqual(pedidos)
  })

  /* Los enlaces que se compartieron antes de que existieran las cantidades no
     llevan `:n`. Tienen que seguir valiendo, y valer por uno. */
  it('un enlace viejo, sin cantidades, sigue valiendo', () => {
    expect(extrasDeUrl(new URLSearchParams('extras=ext_uno,ext_dos'))).toEqual([
      { extraId: 'ext_uno', quantity: 1 },
      { extraId: 'ext_dos', quantity: 1 },
    ])
  })

  /* Una cantidad manipulada a mano no puede dejar la reserva a medias: se lee
     como uno y el cliente sigue con su extra. */
  it('una cantidad imposible se lee como una', () => {
    expect(extrasDeUrl(new URLSearchParams('extras=ext_uno:0,ext_dos:hola'))).toEqual([
      { extraId: 'ext_uno', quantity: 1 },
      { extraId: 'ext_dos', quantity: 1 },
    ])
  })
})
