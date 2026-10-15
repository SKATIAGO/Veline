import { afterEach, describe, expect, it } from 'vitest'
import {
  addDaysKey,
  diffDaysKey,
  formatTimeMadrid,
  instanteAMadridLocal,
  madridDateKey,
  madridDay,
  madridLocalAInstante,
} from '@veline/shared'

/* Las pruebas cambian la zona del proceso (process.env.TZ vale en caliente en
   Node): lo que importa es que el resultado NO dependa de dónde esté el
   navegador. Canarias va una hora por detrás de Madrid y Nueva York seis o
   cinco; Tokio, ocho o siete por delante. */
const ZONAS = ['Europe/Madrid', 'Atlantic/Canary', 'America/New_York', 'Asia/Tokyo', 'UTC']
const zonaOriginal = process.env.TZ
afterEach(() => {
  process.env.TZ = zonaOriginal
})

describe('hora de Madrid, vista desde cualquier zona', () => {
  it.each(ZONAS)('una cita de las 23:30 sigue en su día (navegador en %s)', (zona) => {
    process.env.TZ = zona
    // 23:30 del 15 de octubre en Madrid (CEST, UTC+2) = 21:30Z
    const cita = '2026-10-15T21:30:00.000Z'
    expect(madridDateKey(cita)).toBe('2026-10-15')
    expect(formatTimeMadrid(cita, 'es-ES')).toBe('23:30')
    expect(madridDay(cita).getDate()).toBe(15)
  })

  it.each(ZONAS)('00:15 de Madrid cae en el día de Madrid (navegador en %s)', (zona) => {
    process.env.TZ = zona
    // 00:15 del 16 de octubre en Madrid = 22:15Z del 15
    expect(madridDateKey('2026-10-15T22:15:00.000Z')).toBe('2026-10-16')
  })

  it.each(ZONAS)('invierno (UTC+1) también (navegador en %s)', (zona) => {
    process.env.TZ = zona
    expect(madridDateKey('2026-12-31T23:30:00.000Z')).toBe('2027-01-01')
    expect(formatTimeMadrid('2026-12-31T23:30:00.000Z', 'es-ES')).toBe('00:30')
  })
})

describe('hora escrita a mano', () => {
  it.each(ZONAS)('ida y vuelta (navegador en %s)', (zona) => {
    process.env.TZ = zona
    const instante = madridLocalAInstante('2026-10-16T09:30')
    expect(instante.toISOString()).toBe('2026-10-16T07:30:00.000Z')
    expect(instanteAMadridLocal(instante)).toBe('2026-10-16T09:30')
  })

  it('invierno: UTC+1', () => {
    expect(madridLocalAInstante('2026-12-10T09:30').toISOString()).toBe('2026-12-10T08:30:00.000Z')
  })

  it('el cambio de octubre: la hora repetida toma la primera', () => {
    // 25/10/2026 a las 03:00 CEST se vuelve a las 02:00 CET: 02:30 ocurre dos veces.
    expect(madridLocalAInstante('2026-10-25T02:30').toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })

  it('el cambio de marzo: la hora que no existe pasa a la siguiente', () => {
    // 29/03/2026 a las 02:00 CET salta a las 03:00 CEST: 02:30 no existe.
    expect(instanteAMadridLocal(madridLocalAInstante('2026-03-29T02:30'))).toBe('2026-03-29T03:30')
  })
})

describe('aritmética de días', () => {
  it('suma y resta sin husos', () => {
    expect(addDaysKey('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDaysKey('2026-10-15', '2026-10-29')).toBe(14)
    // Cruza el cambio de hora y sigue siendo un día por día.
    expect(diffDaysKey('2026-10-24', '2026-10-26')).toBe(2)
  })
})
