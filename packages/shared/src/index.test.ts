import { describe, expect, it } from 'vitest'
import {
  createBookingSchema,
  cuotaMensualCents,
  formatDistance,
  formatDuration,
  formatMinutes,
  formatPrice,
  fromDateKey,
  phoneES,
  plazasDelNegocio,
  toDateKey,
} from './index.js'

/**
 * Intl separa el importe del símbolo con un espacio fino irrompible (U+202F),
 * no con un espacio normal. Se normaliza para que la comparación no dependa
 * de un carácter invisible.
 */
const normalizar = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ')

describe('formatPrice', () => {
  it('formatea céntimos como euros en formato español', () => {
    // Coma decimal y símbolo detrás: 1895 céntimos son 18,95 €, no $18.95
    expect(normalizar(formatPrice(1895))).toBe('18,95 €')
    expect(normalizar(formatPrice(0))).toBe('0,00 €')
  })

  it('no pierde céntimos con importes grandes', () => {
    expect(normalizar(formatPrice(123456))).toBe('1234,56 €')
  })
})

/**
 * El administrador no tiene fila en Empleados a menos que se añada él mismo,
 * pero ocupa una plaza igual: un negocio con el administrador y 2 empleados
 * (3 personas reales) tiene que pagar por la de más, no por ninguna.
 */
describe('plazasDelNegocio', () => {
  it('suma al administrador, que no aparece en la lista de empleados', () => {
    expect(plazasDelNegocio(0)).toBe(1)
    expect(plazasDelNegocio(2)).toBe(3)
  })
})

describe('cuotaMensualCents', () => {
  it('el administrador solo, o con 1 empleado, no paga de más', () => {
    expect(cuotaMensualCents('NEGOCIO', plazasDelNegocio(0))).toBe(1895)
    expect(cuotaMensualCents('NEGOCIO', plazasDelNegocio(1))).toBe(1895)
  })

  it('el tercero (administrador + 2 empleados) sí cuesta más', () => {
    expect(cuotaMensualCents('NEGOCIO', plazasDelNegocio(2))).toBe(1895 + 1095)
  })
})

describe('formatDuration', () => {
  it('usa minutos por debajo de una hora', () => {
    expect(formatDuration(30)).toBe('30 min')
  })

  it('omite los minutos cuando son cero', () => {
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(120)).toBe('2 h')
  })

  it('combina horas y minutos', () => {
    expect(formatDuration(90)).toBe('1 h 30 min')
  })
})

describe('formatMinutes', () => {
  it('rellena con cero a la izquierda', () => {
    expect(formatMinutes(0)).toBe('00:00')
    expect(formatMinutes(540)).toBe('09:00')
    expect(formatMinutes(1140)).toBe('19:00')
  })
})

describe('formatDistance', () => {
  it('usa metros por debajo del kilómetro', () => {
    expect(formatDistance(800)).toBe('800 m')
  })

  it('pasa a kilómetros a partir de 1000', () => {
    expect(formatDistance(1200)).toBe('1,2 km')
  })
})

describe('claves de fecha', () => {
  it('usa la fecha local, no UTC', () => {
    // Un 1 de enero a las 00:30 local no puede convertirse en 31 de diciembre
    const d = new Date(2026, 0, 1, 0, 30)
    expect(toDateKey(d)).toBe('2026-01-01')
  })

  it('ida y vuelta sin desplazamiento', () => {
    const clave = '2026-08-15'
    expect(toDateKey(fromDateKey(clave))).toBe(clave)
  })
})

describe('validación de teléfono español', () => {
  it('acepta los formatos habituales', () => {
    for (const valor of ['612345678', '612 34 56 78', '+34 612 34 56 78', '612-34-56-78']) {
      expect(phoneES.safeParse(valor).success, valor).toBe(true)
    }
  })

  it('rechaza lo que no tiene nueve dígitos', () => {
    for (const valor of ['123', '61234567', '6123456789', 'no es un teléfono', '']) {
      expect(phoneES.safeParse(valor).success, valor).toBe(false)
    }
  })
})

describe('createBookingSchema', () => {
  const valido = {
    serviceId: 'srv_1',
    startsAt: '2026-08-15T10:00:00+02:00',
    customer: { name: 'Marina López', phone: '612 34 56 78' },
    source: 'MARKETPLACE' as const,
  }

  it('acepta una reserva bien formada', () => {
    expect(createBookingSchema.safeParse(valido).success).toBe(true)
  })

  it('exige un nombre de al menos dos caracteres', () => {
    const r = createBookingSchema.safeParse({
      ...valido,
      customer: { ...valido.customer, name: 'A' },
    })
    expect(r.success).toBe(false)
  })

  it('rechaza una fecha sin zona horaria', () => {
    // Sin offset no se sabe a qué hora real corresponde
    const r = createBookingSchema.safeParse({ ...valido, startsAt: '2026-08-15T10:00:00' })
    expect(r.success).toBe(false)
  })

  it('acepta email vacío pero rechaza uno mal formado', () => {
    expect(
      createBookingSchema.safeParse({ ...valido, customer: { ...valido.customer, email: '' } })
        .success,
    ).toBe(true)
    expect(
      createBookingSchema.safeParse({ ...valido, customer: { ...valido.customer, email: 'roto@' } })
        .success,
    ).toBe(false)
  })

  it('pone MARKETPLACE como origen por defecto', () => {
    const { source: _source, ...sinOrigen } = valido
    const r = createBookingSchema.safeParse(sinOrigen)
    expect(r.success && r.data.source).toBe('MARKETPLACE')
  })
})
