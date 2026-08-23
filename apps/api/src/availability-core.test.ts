import { describe, expect, it } from 'vitest'
import {
  calcularDisponibilidad,
  seSolapan,
  type EntradaDisponibilidad,
} from './availability-core.js'

/** Lunes 3 de agosto de 2026 a medianoche local. */
const LUNES = new Date(2026, 7, 3)
const AYER = new Date(2026, 7, 2, 12, 0)

const h = (horas: number, minutos = 0) => horas * 60 + minutos

/** Jornada partida de lunes: 9:00–14:00 y 16:00–19:00. */
const JORNADA_LUNES = [
  { weekday: 1, startMin: h(9), endMin: h(14) },
  { weekday: 1, startMin: h(16), endMin: h(19) },
]

function entrada(over: Partial<EntradaDisponibilidad> = {}): EntradaDisponibilidad {
  return {
    from: LUNES,
    to: LUNES,
    occupancyMin: 30,
    franjas: JORNADA_LUNES,
    cierres: [],
    citas: [],
    staffIds: ['persona-1'],
    ahora: AYER,
    ...over,
  }
}

const libres = (e: EntradaDisponibilidad) =>
  calcularDisponibilidad(e)[0]!
    .slots.filter((s) => s.available)
    .map((s) => s.label)

const todos = (e: EntradaDisponibilidad) => calcularDisponibilidad(e)[0]!.slots.map((s) => s.label)

describe('generación de huecos', () => {
  it('ofrece huecos cada 30 minutos dentro de cada franja', () => {
    expect(todos(entrada())).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '11:30',
      '12:00',
      '12:30',
      '13:00',
      '13:30',
      '16:00',
      '16:30',
      '17:00',
      '17:30',
      '18:00',
      '18:30',
    ])
  })

  it('no ofrece un hueco que no cabe entero antes del cierre', () => {
    // Un servicio de 60 min no puede empezar a las 13:30 si se cierra a las 14:00
    const e = entrada({ occupancyMin: 60 })
    expect(todos(e)).not.toContain('13:30')
    expect(todos(e)).toContain('13:00')
  })

  it('tiene en cuenta el margen del servicio, no solo su duración', () => {
    // 45 min de servicio + 15 de margen = 60 ocupados: el último de la mañana es 13:00
    const e = entrada({ occupancyMin: 60 })
    const manana = todos(e).filter((l) => l < '14:00')
    expect(manana[manana.length - 1]).toBe('13:00')
  })

  it('marca el día como cerrado si no hay franjas ese día', () => {
    const domingo = new Date(2026, 7, 2)
    const dia = calcularDisponibilidad(entrada({ from: domingo, to: domingo }))[0]!
    expect(dia.closed).toBe(true)
    expect(dia.slots).toHaveLength(0)
  })
})

describe('ocupación por citas existentes', () => {
  it('bloquea el hueco exacto que ya está reservado', () => {
    const e = entrada({
      citas: [
        {
          staffId: 'persona-1',
          startsAt: new Date(2026, 7, 3, 10, 0),
          blockedTo: new Date(2026, 7, 3, 10, 30),
        },
      ],
    })
    expect(libres(e)).not.toContain('10:00')
    expect(libres(e)).toContain('10:30')
  })

  it('bloquea también el hueco anterior si se solaparía', () => {
    // Servicio de 60 min: empezar a las 09:30 llegaría hasta las 10:30 y
    // pisaría la cita de las 10:00
    const e = entrada({
      occupancyMin: 60,
      citas: [
        {
          staffId: 'persona-1',
          startsAt: new Date(2026, 7, 3, 10, 0),
          blockedTo: new Date(2026, 7, 3, 11, 0),
        },
      ],
    })
    expect(libres(e)).not.toContain('09:30')
    expect(libres(e)).not.toContain('10:00')
    expect(libres(e)).toContain('09:00')
    expect(libres(e)).toContain('11:00')
  })

  it('respeta el margen: una cita corta bloquea más de lo que dura', () => {
    // Cita de 09:00 a 09:30 pero con margen hasta las 09:45: las 09:30
    // dejarían de estar libres
    const e = entrada({
      citas: [
        {
          staffId: 'persona-1',
          startsAt: new Date(2026, 7, 3, 9, 0),
          blockedTo: new Date(2026, 7, 3, 9, 45),
        },
      ],
    })
    expect(libres(e)).not.toContain('09:30')
    expect(libres(e)).toContain('10:00')
  })

  it('con dos personas, una cita no agota el hueco', () => {
    const e = entrada({
      staffIds: ['persona-1', 'persona-2'],
      citas: [
        {
          staffId: 'persona-1',
          startsAt: new Date(2026, 7, 3, 10, 0),
          blockedTo: new Date(2026, 7, 3, 10, 30),
        },
      ],
    })
    expect(libres(e)).toContain('10:00')
    // y se asigna a la persona libre, no a la ocupada
    const hueco = calcularDisponibilidad(e)[0]!.slots.find((s) => s.label === '10:00')!
    expect(hueco.staffId).toBe('persona-2')
  })

  it('con dos personas ocupadas, el hueco se agota', () => {
    const ocupada = (staffId: string) => ({
      staffId,
      startsAt: new Date(2026, 7, 3, 10, 0),
      blockedTo: new Date(2026, 7, 3, 10, 30),
    })
    const e = entrada({
      staffIds: ['persona-1', 'persona-2'],
      citas: [ocupada('persona-1'), ocupada('persona-2')],
    })
    expect(libres(e)).not.toContain('10:00')
  })

  it('sin personas activas no hay ningún hueco libre', () => {
    expect(libres(entrada({ staffIds: [] }))).toHaveLength(0)
  })
})

describe('cierres', () => {
  it('un cierre de día completo cierra el día entero', () => {
    const e = entrada({ cierres: [{ dateKey: '2026-08-03', startMin: null, endMin: null }] })
    const dia = calcularDisponibilidad(e)[0]!
    expect(dia.closed).toBe(true)
  })

  it('un cierre parcial solo tapa sus horas', () => {
    const e = entrada({
      cierres: [{ dateKey: '2026-08-03', startMin: h(10), endMin: h(12) }],
    })
    expect(libres(e)).not.toContain('10:00')
    expect(libres(e)).not.toContain('11:30')
    expect(libres(e)).toContain('09:00')
    expect(libres(e)).toContain('12:00')
  })

  it('un cierre de otro día no afecta', () => {
    const e = entrada({ cierres: [{ dateKey: '2026-08-04', startMin: null, endMin: null }] })
    expect(calcularDisponibilidad(e)[0]!.closed).toBe(false)
  })
})

describe('antelación mínima', () => {
  it('no ofrece huecos con menos de una hora de antelación', () => {
    // Son las 09:15 del propio lunes: las 09:30 y las 10:00 quedan demasiado cerca
    const e = entrada({ ahora: new Date(2026, 7, 3, 9, 15) })
    expect(libres(e)).not.toContain('09:30')
    expect(libres(e)).not.toContain('10:00')
    expect(libres(e)).toContain('10:30')
  })

  it('los huecos no disponibles se siguen devolviendo, marcados', () => {
    // La interfaz los muestra en gris; no deben desaparecer de la lista
    const e = entrada({ ahora: new Date(2026, 7, 3, 9, 15) })
    expect(todos(e)).toContain('09:00')
    expect(libres(e)).not.toContain('09:00')
  })
})

describe('seSolapan', () => {
  const t = (h: number, m = 0) => new Date(2026, 7, 3, h, m)

  it('detecta solapamiento parcial', () => {
    expect(seSolapan(t(10), t(11), t(10, 30), t(11, 30))).toBe(true)
  })

  it('intervalos que solo se tocan por el borde no se solapan', () => {
    // Una cita que acaba a las 10:00 y otra que empieza a las 10:00 conviven
    expect(seSolapan(t(9), t(10), t(10), t(11))).toBe(false)
  })

  it('detecta contención completa', () => {
    expect(seSolapan(t(9), t(12), t(10), t(11))).toBe(true)
  })
})

describe('rango de varios días', () => {
  it('devuelve un elemento por día del rango', () => {
    const dias = calcularDisponibilidad(entrada({ from: LUNES, to: new Date(2026, 7, 7) }))
    expect(dias).toHaveLength(5)
    expect(dias.map((d) => d.date)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ])
  })
})
