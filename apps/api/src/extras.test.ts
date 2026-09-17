import { describe, expect, it } from 'vitest'
import {
  duracionConExtras,
  elegirExtras,
  idDeImagen,
  tipoDeImagen,
  totalConExtras,
  urlDeImagen,
} from './extras.js'

const bytes = (...b: number[]) => new Uint8Array([...b, ...Array<number>(16).fill(0)])
const texto = (s: string) => new TextEncoder().encode(s)

describe('tipoDeImagen · mira los bytes, no lo que dice quien sube', () => {
  it('reconoce JPEG, PNG y WebP', () => {
    expect(tipoDeImagen(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(tipoDeImagen(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(tipoDeImagen(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(
      'image/webp',
    )
  })

  it('rechaza un HTML aunque venga anunciado como imagen', () => {
    expect(tipoDeImagen(texto('<html><script>alert(1)</script>'))).toBeNull()
  })

  it('rechaza un SVG: puede llevar scripts dentro', () => {
    expect(tipoDeImagen(texto('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull()
  })

  it('rechaza algo demasiado corto para ser una foto', () => {
    expect(tipoDeImagen(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
  })
})

describe('idDeImagen · solo fotos nuestras', () => {
  it('saca el id de una dirección nuestra', () => {
    expect(idDeImagen(urlDeImagen('clx3k2abc0000xyz'))).toBe('clx3k2abc0000xyz')
  })

  it('no acepta direcciones de fuera ni rutas raras', () => {
    expect(idDeImagen('https://ejemplo.com/foto.jpg')).toBeNull()
    expect(idDeImagen('/api/imagenes/../admin/users')).toBeNull()
    expect(idDeImagen('/api/imagenes/')).toBeNull()
    expect(idDeImagen(null)).toBeNull()
  })
})

describe('elegirExtras', () => {
  const carta = [
    { id: 'a', name: 'Hidratación', priceCents: 1200, durationMin: 15 },
    { id: 'b', name: 'Bebida', priceCents: 250, durationMin: 0 },
  ]

  const pedir = (extraId: string, quantity = 1) => ({ extraId, quantity })

  it('devuelve los pedidos, con su precio de la carta', () => {
    expect(elegirExtras([pedir('b')], carta)).toEqual([{ ...carta[1], quantity: 1 }])
  })

  it('sin pedir ninguno, ninguno', () => {
    expect(elegirExtras([], carta)).toEqual([])
  })

  it('guarda cuántas veces se pidió cada uno', () => {
    expect(elegirExtras([pedir('a', 3)], carta)).toEqual([{ ...carta[0], quantity: 3 }])
  })

  /* Repetir la misma línea es un fallo del cliente, no una petición de dos
     cosas distintas: se suma en una sola, que es lo que quiso decir. */
  it('el mismo extra en dos líneas se suma en una', () => {
    expect(elegirExtras([pedir('a', 2), pedir('a', 1)], carta)).toEqual([
      { ...carta[0], quantity: 3 },
    ])
  })

  it('si uno ya no está en la carta, no reserva sin él en silencio', () => {
    expect(elegirExtras([pedir('a'), pedir('desaparecido')], carta)).toBeNull()
  })

  it('no acepta un extra de otro negocio', () => {
    expect(elegirExtras([pedir('de-otro-negocio')], carta)).toBeNull()
  })
})

describe('totalConExtras', () => {
  it('suma el servicio y los extras', () => {
    expect(
      totalConExtras(3000, [
        { priceCents: 1200, quantity: 1 },
        { priceCents: 250, quantity: 1 },
      ]),
    ).toBe(4450)
  })

  it('cobra cada extra las veces que se pidió', () => {
    expect(totalConExtras(3000, [{ priceCents: 500, quantity: 3 }])).toBe(4500)
  })

  it('sin extras, lo del servicio', () => {
    expect(totalConExtras(3000, [])).toBe(3000)
  })
})

/**
 * Esta cuenta decide si la cita CABE, no lo que se cobra. Equivocarla no se ve
 * en pantalla: se ve semanas después, con dos clientes a la misma hora.
 */
describe('duracionConExtras', () => {
  it('suma al servicio lo que alarga cada extra', () => {
    expect(
      duracionConExtras(30, [
        { durationMin: 15, quantity: 1 },
        { durationMin: 20, quantity: 1 },
      ]),
    ).toBe(65)
  })

  /* Tres uñas rotas de 10 minutos son media hora más de silla, no diez
     minutos: es el caso que hace falta que la agenda entienda. */
  it('multiplica los minutos por las veces que se pidió', () => {
    expect(duracionConExtras(30, [{ durationMin: 10, quantity: 3 }])).toBe(60)
  })

  it('sin extras, lo que dure el servicio', () => {
    expect(duracionConExtras(30, [])).toBe(30)
  })

  /* Lo normal es que un extra no alargue nada: una bebida, un producto. La
     agenda no puede moverse ni un minuto por añadirlo, ni pidiendo cinco. */
  it('los extras que no alargan no mueven la agenda', () => {
    expect(duracionConExtras(30, [{ durationMin: 0, quantity: 5 }])).toBe(30)
  })
})
