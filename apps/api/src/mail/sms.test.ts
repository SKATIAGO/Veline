import { describe, expect, it } from 'vitest'
import { aGsm7, smsCancelacion, smsConfirmacion, smsRecordatorio, tramosSms } from './sms.js'

/**
 * El SMS es el mensaje más caro y el que más se lee: llega al bolsillo, no a
 * un buzón que se mira una vez al día. Estas pruebas fijan qué dice y, sobre
 * todo, cuánto cuesta decirlo.
 */

// Un martes a las 09:00 en Madrid (07:00 UTC en horario de verano).
const martes = new Date('2026-09-15T07:00:00Z')
// El día más largo de escribir: «miércoles 30 de septiembre».
const miercoles = new Date('2026-09-30T07:00:00Z')

const CODIGO = 'VL-7F3K2HQM'

const recordatorio = {
  idioma: 'es' as const,
  startsAt: martes,
  businessName: 'Taller Mecánico Rivas',
  serviceName: 'Cambio de aceite',
  code: CODIGO,
}

const confirmacion = {
  idioma: 'es' as const,
  startsAt: martes,
  businessName: 'Taller Mecánico Rivas',
  code: CODIGO,
  web: 'veline.es',
}

/** Nombres largos y con todas las tildes que pueden tener. */
const largo = {
  businessName: 'Clínica Veterinaria Los Álamos',
  serviceName: 'Revisión anual con vacuna',
}

describe('el SMS de confirmación', () => {
  it('dice dónde, cuándo y cómo cancelar', () => {
    expect(smsConfirmacion(confirmacion)).toBe(
      'Reserva confirmada en Taller Mecanico Rivas: martes 15 de septiembre a las 09:00. ' +
        `Ver o cancelar: veline.es/reserva/${CODIGO}`,
    )
  })

  it('con el negocio y el día más largos, sigue en un tramo', () => {
    const texto = smsConfirmacion({
      ...confirmacion,
      startsAt: miercoles,
      businessName: largo.businessName,
    })
    expect(tramosSms(texto)).toBe(1)
  })
})

describe('el SMS de recordatorio', () => {
  it('dice cuándo, dónde y con qué código', () => {
    expect(smsRecordatorio(recordatorio)).toBe(
      'Recordatorio: martes 15 de septiembre a las 09:00 tienes cita en ' +
        `Taller Mecanico Rivas (Cambio de aceite). Codigo ${CODIGO}.`,
    )
  })

  /**
   * El motivo de quitar las tildes, en una prueba. El mismo recordatorio con
   * sus tildes se cobra en TRES tramos; sin ellas, en uno.
   */
  it('con nombres largos va en un tramo; con las tildes puestas serían tres', () => {
    const texto = smsRecordatorio({ ...recordatorio, ...largo, startsAt: miercoles })
    expect(tramosSms(texto)).toBe(1)

    const conTildes =
      'Recordatorio: miércoles 30 de septiembre a las 09:00 tienes cita en ' +
      `Clínica Veterinaria Los Álamos (Revisión anual con vacuna). Código ${CODIGO}.`
    expect(tramosSms(conTildes)).toBe(3)
  })

  /**
   * La hora es SIEMPRE la de Madrid, que es donde está la cita. Convertirla al
   * huso de quien lee haría que alguien en Londres se presentara con una hora
   * de diferencia.
   */
  it('la hora es la del negocio, no la de quien lee', () => {
    expect(smsRecordatorio(recordatorio)).toContain('09:00')
  })

  it('en inglés ya escribe la fecha en inglés', () => {
    expect(smsRecordatorio({ ...recordatorio, idioma: 'en' })).toContain('Tuesday 15 September')
    expect(smsConfirmacion({ ...confirmacion, idioma: 'en' })).toContain('Tuesday 15 September')
  })
})

describe('aGsm7', () => {
  it('quita las tildes que no están en GSM', () => {
    expect(aGsm7('á í ó ú Á Í Ó Ú')).toBe('a i o u A I O U')
  })

  it('deja lo que SÍ está en GSM: ñ, é, ü, à, ¿ y ¡', () => {
    expect(aGsm7('¿Mañana? ¡Café! pingüino à')).toBe('¿Mañana? ¡Café! pingüino à')
  })

  it('cambia las comillas y rayas tipográficas por las normales', () => {
    expect(aGsm7('«Hola» “que” —tal…')).toBe('"Hola" "que" -tal...')
  })

  it('lo que no tiene arreglo pasa a «?» en vez de encarecer el mensaje', () => {
    expect(aGsm7('Barbería 💈')).toBe('Barberia ?')
  })
})

describe('tramosSms', () => {
  it('GSM: 160 caracteres son un tramo; 161, dos', () => {
    expect(tramosSms('a'.repeat(160))).toBe(1)
    expect(tramosSms('a'.repeat(161))).toBe(2)
  })

  it('Unicode: 70 caracteres son un tramo; 71, dos', () => {
    expect(tramosSms('ó'.repeat(70))).toBe(1)
    expect(tramosSms('ó'.repeat(71))).toBe(2)
  })

  it('el «€» ocupa el doble dentro de GSM', () => {
    expect(tramosSms('€'.repeat(80))).toBe(1)
    expect(tramosSms('€'.repeat(81))).toBe(2)
  })
})

describe('el SMS de cancelación', () => {
  const cancelacion = {
    idioma: 'es' as const,
    startsAt: martes,
    businessName: 'Taller Mecánico Rivas',
    businessSlug: 'taller-mecanico-rivas',
    web: 'veline.es',
  }

  it('dice qué cita se ha cancelado y enlaza para reservar otra', () => {
    expect(smsCancelacion(cancelacion)).toBe(
      'Se ha cancelado tu cita en Taller Mecanico Rivas del martes 15 de septiembre a las 09:00. ' +
        'Reservar otra: veline.es/taller-mecanico-rivas',
    )
  })

  it('con el negocio y el día más largos, sigue en un tramo y con enlace', () => {
    const texto = smsCancelacion({
      ...cancelacion,
      startsAt: miercoles,
      businessName: largo.businessName,
      businessSlug: 'clinica-veterinaria-los-alamos',
    })
    expect(texto).toContain('Reservar otra:')
    expect(tramosSms(texto)).toBe(1)
  })

  /** Lo primero que sobra es el enlace: mejor sin él que cobrado dos veces. */
  it('si con el enlace no cabe en un tramo, sale sin él', () => {
    const texto = smsCancelacion({
      ...cancelacion,
      startsAt: miercoles,
      businessName: 'Centro de Estética Integral Lola y Asociados',
      businessSlug: 'centro-de-estetica-integral-lola-y-asociados',
    })
    expect(texto).not.toContain('Reservar otra')
    expect(texto).toContain(
      'Se ha cancelado tu cita en Centro de Estética Integral Lola y Asociados',
    )
    expect(tramosSms(texto)).toBe(1)
  })
})
