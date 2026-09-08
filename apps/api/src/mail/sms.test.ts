import { describe, expect, it } from 'vitest'
import { smsRecordatorio } from './sms.js'

/**
 * El SMS es el mensaje más caro por carácter y el que más se lee: llega al
 * bolsillo, no a un buzón que se mira una vez al día. Estas pruebas lo fijan.
 */

const base = {
  idioma: 'es' as const,
  // Un martes a las 09:00 en Madrid (07:00 UTC en horario de verano).
  startsAt: new Date('2026-09-15T07:00:00Z'),
  businessName: 'Taller Mecánico Rivas',
  serviceName: 'Cambio de aceite',
  code: 'VL-7F3K2',
}

describe('el SMS de recordatorio', () => {
  it('dice cuándo, dónde y con qué código', () => {
    expect(smsRecordatorio(base)).toBe(
      'Recordatorio: martes 15 de septiembre a las 09:00 tienes cita en ' +
        'Taller Mecánico Rivas (Cambio de aceite). Código VL-7F3K2.',
    )
  })

  /**
   * Un SMS se cobra por tramos de 160 caracteres. Pasarse no da error: lo
   * cobra doble y nadie se entera hasta la factura. Con nombres largos de
   * verdad —los de esta prueba lo son— tiene que seguir cabiendo.
   */
  it('cabe en un solo SMS con nombres largos', () => {
    const largo = smsRecordatorio({
      ...base,
      businessName: 'Clínica Veterinaria Los Álamos',
      serviceName: 'Revisión anual con vacuna',
    })
    expect(largo.length).toBeLessThanOrEqual(160)
  })

  /**
   * La hora es SIEMPRE la de Madrid, que es donde está la cita. Convertirla al
   * huso de quien lee haría que alguien en Londres se presentara con una hora
   * de diferencia.
   */
  it('la hora es la del negocio, no la de quien lee', () => {
    expect(smsRecordatorio(base)).toContain('09:00')
  })

  /** La cañería del idioma llega hasta aquí: solo faltan las frases. */
  it('en inglés ya escribe la fecha en inglés', () => {
    const en = smsRecordatorio({ ...base, idioma: 'en' })
    expect(en).toContain('Tuesday 15 September')
    expect(en).toContain('09:00')
  })
})
