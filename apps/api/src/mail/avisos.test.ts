import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../prisma.js', () => ({ prisma: { booking: { findUnique: vi.fn() } } }))
vi.mock('./enviar.js', () => ({ sendMail: vi.fn() }))
vi.mock('./acumbamail.js', () => ({ sendSms: vi.fn() }))
vi.mock('./contador.js', () => ({ registrarEnvio: vi.fn() }))

import { prisma } from '../prisma.js'
import { sendMail } from './enviar.js'
import { sendSms } from './acumbamail.js'
import { registrarEnvio } from './contador.js'
import { avisarCancelacion, avisarConfirmacion } from './avisos.js'

/**
 * Los avisos que recibe el cliente sobre su cita: al reservar y al cancelar.
 * Se prueban contra una base simulada porque lo que importa aquí no es la
 * base, sino las decisiones: a quién se avisa, por qué canal, cuándo NO se
 * avisa, y que nunca se dé por enviado algo que no salió.
 */

const guardadas = { ...process.env }

const enDosDias = () => new Date(Date.now() + 2 * 86_400_000)

type Cita = Record<string, unknown>
const cita = (o: Cita = {}): Cita => ({
  id: 'b1',
  code: 'VL-7F3K2HQM',
  businessId: 'n1',
  startsAt: enDosDias(),
  priceCents: 2500,
  notes: null,
  idioma: 'ES',
  createdAt: new Date(),
  customer: { name: 'Marina López', phone: '633492344', email: 'marina@ejemplo.es' },
  service: { name: 'Corte' },
  staff: { name: 'Marta' },
  location: { street: 'Calle Mayor 12', city: 'Madrid' },
  business: {
    name: 'Peluquería Lola',
    slug: 'peluqueria-lola',
    subStatus: 'ACTIVA',
    trialEndsAt: null,
  },
  ...o,
})

const suspendido = {
  business: {
    name: 'Peluquería Lola',
    slug: 'peluqueria-lola',
    subStatus: 'SUSPENDIDA',
    trialEndsAt: null,
  },
}

const conCita = (c: Cita | null) =>
  vi.mocked(prisma.booking.findUnique).mockResolvedValue(c as never)

/** Los registros del contador de un canal concreto. */
const registros = (canal: 'EMAIL' | 'SMS') =>
  vi
    .mocked(registrarEnvio)
    .mock.calls.map(([r]) => r)
    .filter((r) => r.channel === canal)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PUBLIC_WEB_URL = 'https://veline.es'
  vi.mocked(sendMail).mockResolvedValue({ sent: true, messageId: 'm1' } as never)
  vi.mocked(sendSms).mockResolvedValue({ sent: true, id: '45274011' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...guardadas }
  vi.restoreAllMocks()
})

describe('avisarConfirmacion', () => {
  it('con correo: manda correo y SMS, y apunta los dos en el contador', async () => {
    conCita(cita())

    await avisarConfirmacion('b1')

    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendSms).toHaveBeenCalledTimes(1)
    expect(registros('EMAIL')).toMatchObject([
      { kind: 'RESERVA_CONFIRMADA', status: 'ENVIADO', to: 'marina@ejemplo.es' },
    ])
    expect(registros('SMS')).toMatchObject([
      { kind: 'RESERVA_CONFIRMADA', status: 'ENVIADO', to: '633492344', bookingId: 'b1' },
    ])
  })

  it('el SMS lleva el enlace para cancelar, sin «https://» y sin tildes', async () => {
    conCita(cita())

    await avisarConfirmacion('b1')

    const { to, body } = vi.mocked(sendSms).mock.calls[0]![0]
    expect(to).toBe('633492344')
    expect(body).toContain('Reserva confirmada en Peluqueria Lola')
    expect(body).toContain('veline.es/reserva/VL-7F3K2HQM')
    expect(body).not.toContain('https://')
  })

  /** El correo es opcional al reservar. Antes, sin él no llegaba nada. */
  it('sin correo: el SMS sale igualmente', async () => {
    conCita(cita({ customer: { name: 'Marina', phone: '633492344', email: null } }))

    await avisarConfirmacion('b1')

    expect(sendMail).not.toHaveBeenCalled()
    expect(sendSms).toHaveBeenCalledTimes(1)
    expect(registros('EMAIL')).toHaveLength(0)
    expect(registros('SMS')).toHaveLength(1)
  })

  it('una cita con fecha pasada —pasar a limpio la agenda de papel— no avisa a nadie', async () => {
    conCita(cita({ startsAt: new Date(Date.now() - 3_600_000) }))

    await avisarConfirmacion('b1')

    expect(sendMail).not.toHaveBeenCalled()
    expect(sendSms).not.toHaveBeenCalled()
    expect(registrarEnvio).not.toHaveBeenCalled()
  })

  it('un negocio suspendido no confirma nada en su nombre, pero queda apuntado', async () => {
    conCita(cita(suspendido))

    await avisarConfirmacion('b1')

    expect(sendMail).not.toHaveBeenCalled()
    expect(sendSms).not.toHaveBeenCalled()
    expect(registros('SMS')).toMatchObject([{ status: 'OMITIDO', reason: 'negocio no activo' }])
  })

  /** El fallo que tenía el envío antes: esto NO puede contar como enviado. */
  it('si Acumbamail rechaza el SMS, queda OMITIDO con su motivo', async () => {
    conCita(cita())
    vi.mocked(sendSms).mockResolvedValue({
      sent: false,
      reason: 'Acumbamail: Insufficient credits',
    })

    await avisarConfirmacion('b1')

    expect(registros('SMS')).toMatchObject([
      { status: 'OMITIDO', reason: 'Acumbamail: Insufficient credits' },
    ])
  })

  it('si el envío del SMS lanza, no revienta y lo apunta', async () => {
    conCita(cita())
    vi.mocked(sendSms).mockRejectedValue(new Error('se cayó la red'))

    await expect(avisarConfirmacion('b1')).resolves.toBeUndefined()

    expect(registros('SMS')).toMatchObject([{ status: 'OMITIDO', reason: 'se cayó la red' }])
  })

  it('si la base falla, no lanza: la reserva ya está hecha y confirmada', async () => {
    vi.mocked(prisma.booking.findUnique).mockRejectedValue(new Error('base caída'))

    await expect(avisarConfirmacion('b1')).resolves.toBeUndefined()

    expect(sendSms).not.toHaveBeenCalled()
  })

  it('si la reserva no existe, no hace nada', async () => {
    conCita(null)

    await avisarConfirmacion('no-existe')

    expect(sendSms).not.toHaveBeenCalled()
    expect(registrarEnvio).not.toHaveBeenCalled()
  })
})

describe('avisarCancelacion', () => {
  it('con correo: manda correo y SMS de cancelación, y apunta los dos', async () => {
    conCita(cita())

    await avisarCancelacion('b1')

    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendSms).toHaveBeenCalledTimes(1)
    expect(registros('EMAIL')).toMatchObject([
      { kind: 'RESERVA_CANCELADA', status: 'ENVIADO', to: 'marina@ejemplo.es' },
    ])
    expect(registros('SMS')).toMatchObject([
      { kind: 'RESERVA_CANCELADA', status: 'ENVIADO', to: '633492344', bookingId: 'b1' },
    ])
  })

  it('el SMS dice que se ha cancelado y enlaza para reservar otra hora', async () => {
    conCita(cita())

    await avisarCancelacion('b1')

    const { body } = vi.mocked(sendSms).mock.calls[0]![0]
    expect(body).toContain('Se ha cancelado tu cita en Peluqueria Lola')
    expect(body).toContain('veline.es/peluqueria-lola')
  })

  it('el correo va al cliente, no al negocio', async () => {
    conCita(cita())

    await avisarCancelacion('b1')

    expect(vi.mocked(sendMail).mock.calls[0]![0]).toMatchObject({ to: 'marina@ejemplo.es' })
  })

  it('sin correo: el SMS sale igualmente', async () => {
    conCita(cita({ customer: { name: 'Marina', phone: '633492344', email: null } }))

    await avisarCancelacion('b1')

    expect(sendMail).not.toHaveBeenCalled()
    expect(sendSms).toHaveBeenCalledTimes(1)
  })

  /** Al revés que la confirmación: que se ha cancelado, hay que saberlo igual. */
  it('un negocio suspendido SÍ avisa de la cancelación: si no, el cliente se presenta', async () => {
    conCita(cita(suspendido))

    await avisarCancelacion('b1')

    expect(sendSms).toHaveBeenCalledTimes(1)
    expect(registros('SMS')).toMatchObject([{ status: 'ENVIADO' }])
  })

  it('cancelar una cita que ya pasó —limpiar la agenda— no avisa a nadie', async () => {
    conCita(cita({ startsAt: new Date(Date.now() - 3_600_000) }))

    await avisarCancelacion('b1')

    expect(sendMail).not.toHaveBeenCalled()
    expect(sendSms).not.toHaveBeenCalled()
    expect(registrarEnvio).not.toHaveBeenCalled()
  })

  it('si Acumbamail rechaza el SMS, queda OMITIDO con su motivo', async () => {
    conCita(cita())
    vi.mocked(sendSms).mockResolvedValue({
      sent: false,
      reason: 'Acumbamail: Insufficient credits',
    })

    await avisarCancelacion('b1')

    expect(registros('SMS')).toMatchObject([
      { kind: 'RESERVA_CANCELADA', status: 'OMITIDO', reason: 'Acumbamail: Insufficient credits' },
    ])
  })

  it('si la base falla, no lanza: la cita ya está cancelada', async () => {
    vi.mocked(prisma.booking.findUnique).mockRejectedValue(new Error('base caída'))

    await expect(avisarCancelacion('b1')).resolves.toBeUndefined()

    expect(sendSms).not.toHaveBeenCalled()
  })
})
