import { describe, expect, it } from 'vitest'
import { _redactar as redactar } from './log.js'

/**
 * El filtro de secretos es lo que hace seguro auditar endpoints que reciben
 * contraseñas y tokens. Si deja de funcionar no se nota: el registro sigue
 * escribiéndose, solo que con la contraseña dentro. De ahí estas pruebas.
 */
describe('redactar', () => {
  it('oculta las claves sensibles se llamen como se llamen', () => {
    const salida = redactar({
      password: 'secreto123',
      contraseña: 'secreto123',
      newPassword: 'secreto123',
      token: 'abc',
      resetToken: 'abc',
      passwordHash: 'sal:hash',
      BREVO_API_KEY: 'xkeysib-x',
      cookie: 'veline_session=x',
    }) as Record<string, unknown>

    for (const valor of Object.values(salida)) expect(valor).toBe('[oculto]')
  })

  it('oculta también dentro de objetos anidados', () => {
    const salida = redactar({ usuario: { nombre: 'Ana', password: 'secreto' } }) as {
      usuario: Record<string, unknown>
    }
    expect(salida.usuario.nombre).toBe('Ana')
    expect(salida.usuario.password).toBe('[oculto]')
  })

  it('conserva lo que sí interesa leer', () => {
    const salida = redactar({
      precioCents: { antes: 2500, despues: 3000 },
      activo: false,
    }) as Record<string, unknown>
    expect(salida).toEqual({ precioCents: { antes: 2500, despues: 3000 }, activo: false })
  })

  it('recorta textos largos en vez de volcarlos enteros', () => {
    const salida = redactar({ nota: 'x'.repeat(900) }) as { nota: string }
    expect(salida.nota).toHaveLength(501) // 500 + el carácter de recorte
    expect(salida.nota.endsWith('…')).toBe(true)
  })

  it('no se pierde con estructuras muy anidadas', () => {
    let profundo: unknown = 'fondo'
    for (let i = 0; i < 12; i++) profundo = { dentro: profundo }
    expect(() => redactar(profundo)).not.toThrow()
  })

  it('serializa las fechas para que se puedan leer después', () => {
    const d = new Date('2026-08-24T10:00:00.000Z')
    expect(redactar({ cuando: d })).toEqual({ cuando: '2026-08-24T10:00:00.000Z' })
  })
})
