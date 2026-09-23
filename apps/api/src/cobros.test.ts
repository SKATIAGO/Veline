import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./prisma.js', () => ({
  prisma: {
    business: { findUnique: vi.fn(), update: vi.fn() },
    staff: { count: vi.fn() },
    booking: { aggregate: vi.fn() },
    messageLog: { count: vi.fn() },
    charge: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

import { prisma } from './prisma.js'
import { cerrarMes } from './cobros.js'

/**
 * El cupo de mensajes que sobra se acumula para el mes siguiente, pero solo
 * en los planes de pago y solo al cerrar el mes — nunca a media cita. Estas
 * pruebas cubren justo eso: cuánto se acumula, cuándo se vacía (Gratis) y
 * que cerrar un mes ya cerrado no lo vuelve a tocar.
 */

const SEPTIEMBRE = new Date(Date.UTC(2026, 8, 1))

beforeEach(() => {
  vi.mocked(prisma.charge.findUnique).mockReset().mockResolvedValue(null)
  vi.mocked(prisma.charge.create)
    .mockReset()
    .mockResolvedValue({} as never)
  vi.mocked(prisma.business.findUnique).mockReset()
  vi.mocked(prisma.business.update)
    .mockReset()
    .mockResolvedValue({} as never)
  vi.mocked(prisma.staff.count).mockReset().mockResolvedValue(0)
  vi.mocked(prisma.booking.aggregate)
    .mockReset()
    .mockResolvedValue({ _sum: { commissionCents: 0 } } as never)
  vi.mocked(prisma.messageLog.count).mockReset()
})

describe('cerrarMes — acumular el cupo de mensajes', () => {
  it('en Negocio, lo que sobra del cupo (con lo acumulado antes) pasa al mes siguiente', async () => {
    vi.mocked(prisma.business.findUnique)
      .mockResolvedValueOnce({ plan: 'NEGOCIO' } as never) // calcularMes
      .mockResolvedValueOnce({ bankedMessages: 20 } as never) // actualizarCupoAcumulado
    vi.mocked(prisma.messageLog.count)
      .mockResolvedValueOnce(0) // calcularMes: cuántos ya salieron marcados de pago
      .mockResolvedValueOnce(150) // actualizarCupoAcumulado: enviados en septiembre

    await cerrarMes('n1', SEPTIEMBRE)

    // Cupo efectivo 200 + 20 = 220; sobran 220 - 150 = 70 para octubre.
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { bankedMessages: 70 },
    })
  })

  it('en Negocio, si se pasa del cupo (con lo acumulado) no queda nada para el mes siguiente', async () => {
    vi.mocked(prisma.business.findUnique)
      .mockResolvedValueOnce({ plan: 'NEGOCIO' } as never)
      .mockResolvedValueOnce({ bankedMessages: 20 } as never)
    vi.mocked(prisma.messageLog.count)
      .mockResolvedValueOnce(30) // calcularMes: los que ya salieron marcados de pago
      .mockResolvedValueOnce(250) // actualizarCupoAcumulado: enviados en total, por encima de 220

    await cerrarMes('n1', SEPTIEMBRE)

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { bankedMessages: 0 },
    })
  })

  it('en Gratis nunca se acumula: si tenía algo guardado, se vacía', async () => {
    vi.mocked(prisma.business.findUnique)
      .mockResolvedValueOnce({ plan: 'GRATIS' } as never)
      .mockResolvedValueOnce({ bankedMessages: 30 } as never)
    vi.mocked(prisma.messageLog.count).mockResolvedValueOnce(0) // calcularMes

    await cerrarMes('n1', SEPTIEMBRE)

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { bankedMessages: 0 },
    })
    // calcularMes sí cuenta mensajes (para su desglose), pero no se vuelve a
    // contar para el sobrante: en Gratis no se acumula, así que solo hace
    // falta la llamada de calcularMes, ninguna más.
    expect(prisma.messageLog.count).toHaveBeenCalledTimes(1)
  })

  it('en Gratis sin nada acumulado no toca la base para nada', async () => {
    vi.mocked(prisma.business.findUnique)
      .mockResolvedValueOnce({ plan: 'GRATIS' } as never)
      .mockResolvedValueOnce({ bankedMessages: 0 } as never)
    vi.mocked(prisma.messageLog.count).mockResolvedValueOnce(0)

    await cerrarMes('n1', SEPTIEMBRE)

    expect(prisma.business.update).not.toHaveBeenCalled()
  })

  it('un mes ya cerrado no se vuelve a tocar', async () => {
    vi.mocked(prisma.charge.findUnique).mockResolvedValue({ id: 'c1' } as never)

    const r = await cerrarMes('n1', SEPTIEMBRE)

    expect(r).toEqual({ charge: { id: 'c1' }, creado: false })
    expect(prisma.business.findUnique).not.toHaveBeenCalled()
    expect(prisma.business.update).not.toHaveBeenCalled()
  })
})
