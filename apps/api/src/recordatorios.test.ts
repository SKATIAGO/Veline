import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./prisma.js', () => ({
  prisma: { booking: { findMany: vi.fn(), update: vi.fn() } },
}))
vi.mock('./mail/enviar.js', () => ({ sendMail: vi.fn() }))
vi.mock('./mail/acumbamail.js', () => ({ sendSms: vi.fn() }))
vi.mock('./mail/contador.js', () => ({ registrarEnvio: vi.fn() }))

import { prisma } from './prisma.js'
import { sendMail } from './mail/enviar.js'
import { sendSms } from './mail/acumbamail.js'
import { registrarEnvio } from './mail/contador.js'
import { enviarRecordatoriosPendientes } from './recordatorios.js'

/**
 * El recordatorio del día antes. Dos cosas nuevas que se prueban aquí:
 *
 *  - No pisar la confirmación: una reserva hecha hace menos de 12 horas acaba
 *    de recibir el SMS de confirmación, y un recordatorio encima sería un
 *    segundo mensaje diciendo lo mismo, pagado.
 *  - Contar bien los fallos: un «no enviado» a propósito (modo dry) no es un
 *    fallo; que Acumbamail lo rechace, o que se caiga la red, sí.
 */

const HORA = 3_600_000

type Cita = Record<string, unknown>
const cita = (o: Cita = {}): Cita => ({
  id: 'b1',
  code: 'VL-7F3K2HQM',
  businessId: 'n1',
  startsAt: new Date(Date.now() + 24 * HORA + 10 * 60_000),
  priceCents: 2500,
  idioma: 'ES',
  // Por defecto, reservada hace tres días: el caso normal.
  createdAt: new Date(Date.now() - 72 * HORA),
  customer: { name: 'Marina López', phone: '633492344', email: 'marina@ejemplo.es' },
  service: { name: 'Corte' },
  staff: { name: 'Marta' },
  business: {
    name: 'Peluquería Lola',
    slug: 'peluqueria-lola',
    subStatus: 'ACTIVA',
    trialEndsAt: null,
    locations: [{ street: 'Calle Mayor 12', city: 'Madrid' }],
  },
  ...o,
})

const conCitas = (...citas: Cita[]) =>
  vi.mocked(prisma.booking.findMany).mockResolvedValue(citas as never)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(sendMail).mockResolvedValue({ sent: true, messageId: 'm1' } as never)
  vi.mocked(sendSms).mockResolvedValue({ sent: true, id: '1' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('enviarRecordatoriosPendientes', () => {
  it('una reserva de hace días recibe correo y SMS de recordatorio', async () => {
    conCitas(cita())

    const r = await enviarRecordatoriosPendientes()

    expect(r).toEqual({ revisadas: 1, correos: 1, smss: 1, fallos: 0 })
    expect(vi.mocked(sendSms).mock.calls[0]![0].body).toContain('Recordatorio:')
  })

  it('se sella la cita ANTES de enviar, para no mandarlo dos veces si el proceso se reinicia', async () => {
    conCitas(cita())

    await enviarRecordatoriosPendientes()

    const sellado = vi.mocked(prisma.booking.update).mock.invocationCallOrder[0]!
    const enviado = vi.mocked(sendSms).mock.invocationCallOrder[0]!
    expect(sellado).toBeLessThan(enviado)
  })

  describe('no pisar la confirmación', () => {
    it('reservada hace 2 horas: NO se manda, la confirmación acaba de llegar', async () => {
      conCitas(cita({ createdAt: new Date(Date.now() - 2 * HORA) }))

      const r = await enviarRecordatoriosPendientes()

      expect(sendSms).not.toHaveBeenCalled()
      expect(sendMail).not.toHaveBeenCalled()
      expect(r).toEqual({ revisadas: 1, correos: 0, smss: 0, fallos: 0 })
      expect(vi.mocked(registrarEnvio).mock.calls[0]![0]).toMatchObject({
        kind: 'RECORDATORIO',
        status: 'OMITIDO',
        reason: 'confirmación reciente',
      })
    })

    it('aunque no se mande, la cita queda sellada: no se vuelve a mirar en 15 minutos', async () => {
      conCitas(cita({ createdAt: new Date(Date.now() - 2 * HORA) }))

      await enviarRecordatoriosPendientes()

      expect(prisma.booking.update).toHaveBeenCalledTimes(1)
    })

    it('reservada hace 13 horas: sí se manda', async () => {
      conCitas(cita({ createdAt: new Date(Date.now() - 13 * HORA) }))

      await enviarRecordatoriosPendientes()

      expect(sendSms).toHaveBeenCalledTimes(1)
    })
  })

  describe('contar bien los fallos', () => {
    it('un SMS que no sale a propósito (modo dry) NO es un fallo', async () => {
      conCitas(cita())
      vi.mocked(sendSms).mockResolvedValue({ sent: false, reason: 'SMS_MODE=dry', freno: true })

      const r = await enviarRecordatoriosPendientes()

      expect(r.fallos).toBe(0)
      expect(r.smss).toBe(0)
    })

    it('un SMS rechazado por Acumbamail SÍ es un fallo', async () => {
      conCitas(cita())
      vi.mocked(sendSms).mockResolvedValue({
        sent: false,
        reason: 'Acumbamail: Insufficient credits',
      })

      const r = await enviarRecordatoriosPendientes()

      expect(r.fallos).toBe(1)
    })

    /** Antes no se contaba: solo se miraba si el motivo empezaba por «Acumbamail». */
    it('un fallo de red también es un fallo', async () => {
      conCitas(cita())
      vi.mocked(sendSms).mockResolvedValue({ sent: false, reason: 'red: fetch failed' })

      const r = await enviarRecordatoriosPendientes()

      expect(r.fallos).toBe(1)
    })
  })

  it('un negocio suspendido no manda nada en su nombre', async () => {
    conCitas(
      cita({
        business: {
          name: 'X',
          slug: 'x',
          subStatus: 'SUSPENDIDA',
          trialEndsAt: null,
          locations: [],
        },
      }),
    )

    const r = await enviarRecordatoriosPendientes()

    expect(sendSms).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
    expect(r.smss).toBe(0)
  })
})
