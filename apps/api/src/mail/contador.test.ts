import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../prisma.js', () => ({
  prisma: {
    messageLog: { count: vi.fn(), create: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}))

import { prisma } from '../prisma.js'
import { registrarEnvio, resumenMensajes } from './contador.js'

/**
 * El cupo de mensajes de un negocio. En los planes de pago lo que sobró el
 * mes pasado (`bankedMessages`) se suma al cupo del plan — así que el número
 * contra el que se compara «¿ya se gastó el cupo?» no es siempre el mismo,
 * y de ahí que estas pruebas fijen `bankedMessages` en vez de asumir 0.
 */

beforeEach(() => {
  vi.mocked(prisma.messageLog.count).mockReset()
  vi.mocked(prisma.messageLog.create)
    .mockReset()
    .mockResolvedValue({} as never)
  vi.mocked(prisma.business.findUnique).mockReset()
})

describe('resumenMensajes', () => {
  it('sin nada acumulado, el cupo es el del plan', async () => {
    vi.mocked(prisma.messageLog.count).mockResolvedValue(150)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ bankedMessages: 0 } as never)

    const r = await resumenMensajes('n1', 'NEGOCIO')
    expect(r).toEqual({ enviados: 150, incluidos: 200, extra: 0, costeExtraCents: 0 })
  })

  it('lo acumulado el mes pasado suma al cupo del plan', async () => {
    vi.mocked(prisma.messageLog.count).mockResolvedValue(230)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ bankedMessages: 50 } as never)

    const r = await resumenMensajes('n1', 'NEGOCIO')
    // 200 del plan + 50 acumulados = 250 incluidos; 230 enviados no llega, 0 de más.
    expect(r).toEqual({ enviados: 230, incluidos: 250, extra: 0, costeExtraCents: 0 })
  })

  it('pasado el cupo (con lo acumulado ya sumado), cobra por los de más', async () => {
    vi.mocked(prisma.messageLog.count).mockResolvedValue(260)
    vi.mocked(prisma.business.findUnique).mockResolvedValue({ bankedMessages: 50 } as never)

    const r = await resumenMensajes('n1', 'NEGOCIO')
    expect(r).toEqual({ enviados: 260, incluidos: 250, extra: 10, costeExtraCents: 60 })
  })

  it('si el negocio no aparece, no revienta: cupo del plan sin acumular nada', async () => {
    vi.mocked(prisma.messageLog.count).mockResolvedValue(50)
    vi.mocked(prisma.business.findUnique).mockResolvedValue(null)

    const r = await resumenMensajes('n1', 'GRATIS')
    expect(r).toEqual({ enviados: 50, incluidos: 100, extra: 0, costeExtraCents: 0 })
  })
})

describe('registrarEnvio', () => {
  const base = {
    businessId: 'n1',
    channel: 'SMS' as const,
    kind: 'RESERVA_CONFIRMADA' as const,
    to: '600111222',
    status: 'ENVIADO' as const,
  }

  it('dentro del cupo (contando lo acumulado), sale gratis', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      plan: 'NEGOCIO',
      bankedMessages: 20,
    } as never)
    // 205 ya enviados este mes, cupo efectivo 220: el 206 todavía es gratis.
    vi.mocked(prisma.messageLog.count).mockResolvedValue(205)

    await registrarEnvio(base)

    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ costCents: 0 }) }),
    )
  })

  it('agotado el cupo acumulado incluido, cobra el mensaje', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValue({
      plan: 'NEGOCIO',
      bankedMessages: 20,
    } as never)
    // Cupo efectivo 220: el que hace el número 221 ya es de pago.
    vi.mocked(prisma.messageLog.count).mockResolvedValue(220)

    await registrarEnvio(base)

    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ costCents: 6 }) }),
    )
  })

  it('un tipo que no cuenta para el cupo no mira ni el negocio', async () => {
    await registrarEnvio({ ...base, kind: 'RESTABLECER_CONTRASENA' })

    expect(prisma.business.findUnique).not.toHaveBeenCalled()
    expect(prisma.messageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ costCents: 0 }) }),
    )
  })
})
