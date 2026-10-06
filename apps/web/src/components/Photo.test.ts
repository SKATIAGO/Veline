import { describe, expect, it } from 'vitest'
import { photoFull, photoSrc } from './Photo'

const UNSPLASH = 'https://images.unsplash.com/photo-123'

describe('tamaños de foto', () => {
  it('la miniatura recorta y la ampliada no', () => {
    expect(photoSrc(UNSPLASH, 160, 160)).toContain('fit=crop')
    // Ampliada, la foto entera: recortar dejaría fuera justo el detalle que se quiere ver.
    expect(photoFull(UNSPLASH, 1920)).toContain('fit=max')
    expect(photoFull(UNSPLASH, 1920)).not.toContain('fit=crop')
    expect(photoFull(UNSPLASH, 1920)).toContain('w=1920')
  })

  it('las fotos subidas por el negocio no se tocan', () => {
    expect(photoFull('/api/imagenes/abc', 1920)).toBe('/api/imagenes/abc')
    expect(photoSrc('/api/imagenes/abc', 160, 160)).toBe('/api/imagenes/abc')
  })
})
