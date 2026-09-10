import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizaTelefono, sendSms } from './acumbamail.js'

/**
 * `sendSms` es la única parte de Veline que gasta dinero real sin que nadie
 * lo apruebe a mano: cada llamada es un SMS a un teléfono de verdad. Estas
 * pruebas están escritas contra la documentación que mandó soporte de
 * Acumbamail el 10 sep 2026 (Ana), no contra lo que el código hacía antes —
 * lo que hacía antes no coincidía, y por eso estas pruebas existen.
 *
 * La más importante es la de «status distinto de 0»: Acumbamail contesta
 * HTTP 200 incluso cuando RECHAZA el SMS, y pone el motivo dentro del cuerpo.
 * Antes de esto, ese caso se contaba como enviado.
 */

const guardadas = { ...process.env }

beforeEach(() => {
  process.env.SMS_MODE = 'live'
  process.env.ACUMBAMAIL_TOKEN = 'token-de-prueba'
  process.env.SMS_SENDER = 'Veline'
  delete process.env.SMS_OVERRIDE_TO
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  process.env = { ...guardadas }
  vi.unstubAllGlobals()
})

/** Respuesta de éxito, tal y como la describe la documentación real. */
const respuestaOk = (id = 10564590, credits = 1) =>
  new Response(JSON.stringify({ messages: [{ status: 0, credits, id }] }), { status: 200 })

describe('normalizaTelefono', () => {
  it('añade el prefijo español a un número de 9 cifras', () => {
    expect(normalizaTelefono('612345678')).toBe('+34612345678')
  })
  it('acepta el prefijo ya puesto, con o sin +', () => {
    expect(normalizaTelefono('+34612345678')).toBe('+34612345678')
    expect(normalizaTelefono('34612345678')).toBe('+34612345678')
  })
  it('quita espacios y separadores', () => {
    expect(normalizaTelefono('612 345 678')).toBe('+34612345678')
    expect(normalizaTelefono('612-345-678')).toBe('+34612345678')
  })
  it('rechaza lo que no sea un teléfono español', () => {
    expect(normalizaTelefono('12345')).toBeNull()
    expect(normalizaTelefono('+1 555 0100')).toBeNull()
  })
})

describe('sendSms · la petición que se manda', () => {
  it('va como messages=[{recipient,body,sender}], NO recipients=[{phone}]', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(respuestaOk())

    await sendSms({ to: '612345678', body: 'Tu cita es mañana' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://acumbamail.com/api/1/sendSMS/')
    expect(init?.method).toBe('POST')

    const form = init?.body as FormData
    expect(form.get('auth_token')).toBe('token-de-prueba')

    const mensajes = JSON.parse(form.get('messages') as string)
    expect(mensajes).toEqual([
      { recipient: '+34612345678', body: 'Tu cita es mañana', sender: 'Veline' },
    ])
    // El fallo que tenía esto: mandaba «recipients» con «phone», y el
    // remitente como campo suelto en vez de ir dentro del mensaje.
    expect(form.has('recipients')).toBe(false)
    expect(form.has('sender')).toBe(false)
    expect(form.has('message')).toBe(false)
  })

  it('va en multipart (FormData), como el curl -F de soporte, no en x-www-form-urlencoded', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(respuestaOk())
    await sendSms({ to: '612345678', body: 'x' })
    const [, init] = fetchMock.mock.calls[0]!
    expect(init?.body).toBeInstanceOf(FormData)
  })
})

describe('sendSms · leer lo que responde Acumbamail', () => {
  it('status 0 es enviado, y devuelve el id del SMS', async () => {
    vi.mocked(fetch).mockResolvedValue(respuestaOk(999, 2))
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r).toEqual({ sent: true, id: '999' })
  })

  /**
   * ESTE es el caso que el código de antes no distinguía de un envío
   * correcto: HTTP 200, pero status !== 0 dentro del cuerpo. Ejemplo real de
   * la documentación: sender obligatorio y ausente.
   */
  it('HTTP 200 con status != 0 es un fallo, no un envío — y se usa el motivo real', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ status: 1, error: 'Sender is mandatory' }] }), {
        status: 200,
      }),
    )
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'Sender is mandatory' })
  })

  it('sin "messages" en la respuesta, no se da por enviado', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r.sent).toBe(false)
  })

  it('un cuerpo que no es JSON no se da por enviado', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>error</html>', { status: 200 }))
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r.sent).toBe(false)
  })

  it('un HTTP no-ok es un fallo con el código a la vista', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('token inválido', { status: 401 }))
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'Acumbamail 401' })
  })

  it('un fallo de red no revienta, se reporta', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'))
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r.sent).toBe(false)
    if (!r.sent) expect(r.reason).toContain('fetch failed')
  })
})

describe('sendSms · los frenos, antes de llegar a la red', () => {
  it('SMS_MODE=off no llama a fetch', async () => {
    process.env.SMS_MODE = 'off'
    const fetchMock = vi.mocked(fetch)
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'SMS_MODE=off' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('SMS_MODE=dry no llama a fetch', async () => {
    process.env.SMS_MODE = 'dry'
    const fetchMock = vi.mocked(fetch)
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'SMS_MODE=dry' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('un teléfono que no cuadra con España no llega a la red', async () => {
    const fetchMock = vi.mocked(fetch)
    const r = await sendSms({ to: 'no-es-un-telefono', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'teléfono no válido' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sin token, no llega a la red', async () => {
    delete process.env.ACUMBAMAIL_TOKEN
    const fetchMock = vi.mocked(fetch)
    const r = await sendSms({ to: '612345678', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'sin ACUMBAMAIL_TOKEN' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('SMS_OVERRIDE_TO manda a ese número en vez de al real', async () => {
    process.env.SMS_OVERRIDE_TO = '699999999'
    const fetchMock = vi.mocked(fetch).mockResolvedValue(respuestaOk())
    await sendSms({ to: '612345678', body: 'x' })
    const form = fetchMock.mock.calls[0]![1]?.body as FormData
    const mensajes = JSON.parse(form.get('messages') as string)
    expect(mensajes[0].recipient).toBe('+34699999999')
  })
})
