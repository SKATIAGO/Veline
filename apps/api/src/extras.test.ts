import { describe, expect, it } from 'vitest'
import { elegirExtras, idDeImagen, tipoDeImagen, totalConExtras, urlDeImagen } from './extras.js'

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
    { id: 'a', name: 'Hidratación', priceCents: 1200 },
    { id: 'b', name: 'Bebida', priceCents: 250 },
  ]

  it('devuelve los pedidos, con su precio de la carta', () => {
    expect(elegirExtras(['b'], carta)).toEqual([carta[1]])
  })

  it('sin pedir ninguno, ninguno', () => {
    expect(elegirExtras([], carta)).toEqual([])
  })

  it('pedir el mismo dos veces no lo cobra dos veces', () => {
    expect(elegirExtras(['a', 'a'], carta)).toEqual([carta[0]])
  })

  it('si uno ya no está en la carta, no reserva sin él en silencio', () => {
    expect(elegirExtras(['a', 'desaparecido'], carta)).toBeNull()
  })

  it('no acepta un extra de otro negocio', () => {
    expect(elegirExtras(['de-otro-negocio'], carta)).toBeNull()
  })
})

describe('totalConExtras', () => {
  it('suma el servicio y los extras', () => {
    expect(totalConExtras(3000, [{ priceCents: 1200 }, { priceCents: 250 }])).toBe(4450)
  })

  it('sin extras, lo del servicio', () => {
    expect(totalConExtras(3000, [])).toBe(3000)
  })
})
