import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizaTelefono, sendSms } from './acumbamail.js'

/**
 * `sendSms` es la única parte de Veline que gasta dinero real sin que nadie lo
 * apruebe a mano: cada llamada es un SMS a un teléfono de verdad.
 *
 * La forma de la petición está copiada de la llamada que Santiago probó en
 * Postman el 10 sep 2026 y devolvió 201 con status 0: POST a /sendSMS, con
 * auth_token y messages como parámetros de la URL.
 *
 * La prueba más importante es la de «status distinto de 0»: Acumbamail
 * contesta con éxito HTTP incluso cuando RECHAZA el SMS, con el motivo dentro
 * del cuerpo. Antes eso se contaba como enviado.
 */

const TOKEN = 'token-de-prueba-que-no-debe-salir'
const guardadas = { ...process.env }

beforeEach(() => {
  process.env.SMS_MODE = 'live'
  process.env.ACUMBAMAIL_TOKEN = TOKEN
  process.env.SMS_SENDER = 'Veline'
  delete process.env.SMS_OVERRIDE_TO
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...guardadas }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** La respuesta que dio la llamada real en Postman: 201, status 0, 100 créditos. */
const respuestaReal = (id = 45274011) =>
  new Response(JSON.stringify({ messages: [{ status: 0, id, credits: 100 }] }), { status: 201 })

const rechazo = (error: string) =>
  new Response(JSON.stringify({ messages: [{ status: 1, error }] }), { status: 200 })

/** La llamada que se le hizo a fetch, con la URL ya desmontada. */
const llamada = (n = 0) => {
  const [url, init] = vi.mocked(fetch).mock.calls[n]!
  return { url: new URL(String(url)), init }
}

describe('normalizaTelefono', () => {
  it('añade el prefijo español a un número de 9 cifras', () => {
    expect(normalizaTelefono('633492344')).toBe('+34633492344')
  })
  it('acepta el prefijo ya puesto, con o sin +', () => {
    expect(normalizaTelefono('+34633492344')).toBe('+34633492344')
    expect(normalizaTelefono('34633492344')).toBe('+34633492344')
  })
  it('quita espacios y separadores', () => {
    expect(normalizaTelefono('633 49 23 44')).toBe('+34633492344')
    expect(normalizaTelefono('633-492-344')).toBe('+34633492344')
  })
  it('rechaza lo que no sea un teléfono español', () => {
    expect(normalizaTelefono('12345')).toBeNull()
    expect(normalizaTelefono('+1 555 0100')).toBeNull()
  })
})

describe('sendSms · la petición, igual que la de Postman', () => {
  it('POST a /sendSMS con auth_token y messages en la URL', async () => {
    vi.mocked(fetch).mockResolvedValue(respuestaReal())

    await sendSms({ to: '633492344', body: 'message test' })

    const { url, init } = llamada()
    expect(`${url.origin}${url.pathname}`).toBe('https://acumbamail.com/api/1/sendSMS')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeUndefined()
    expect(url.searchParams.get('auth_token')).toBe(TOKEN)
    expect(JSON.parse(url.searchParams.get('messages')!)).toEqual([
      { recipient: '+34633492344', body: 'message test', sender: 'Veline' },
    ])
  })

  it('no manda los campos de la versión antigua, que no existen en la API', async () => {
    vi.mocked(fetch).mockResolvedValue(respuestaReal())
    await sendSms({ to: '633492344', body: 'x' })
    const { url } = llamada()
    expect([...url.searchParams.keys()].sort()).toEqual(['auth_token', 'messages'])
  })

  it('un texto con comillas, «&» y saltos de línea llega entero', async () => {
    vi.mocked(fetch).mockResolvedValue(respuestaReal())
    const body = 'Cita en "Peluquería & Co"\nmañana ¿vienes?'
    await sendSms({ to: '633492344', body })
    expect(JSON.parse(llamada().url.searchParams.get('messages')!)[0].body).toBe(body)
  })
})

describe('sendSms · leer lo que responde Acumbamail', () => {
  it('201 con status 0 —la respuesta real— es enviado, con el id', async () => {
    vi.mocked(fetch).mockResolvedValue(respuestaReal(45274011))
    expect(await sendSms({ to: '633492344', body: 'x' })).toEqual({ sent: true, id: '45274011' })
  })

  it('HTTP de éxito con status != 0 es un FALLO, con el motivo de Acumbamail', async () => {
    vi.mocked(fetch).mockResolvedValue(rechazo('Sender is mandatory'))
    expect(await sendSms({ to: '633492344', body: 'x' })).toEqual({
      sent: false,
      reason: 'Acumbamail: Sender is mandatory',
    })
  })

  it('sin "messages" en la respuesta, no se da por enviado', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }))
    const r = await sendSms({ to: '633492344', body: 'x' })
    expect(r.sent).toBe(false)
  })

  it('un cuerpo que no es JSON no se da por enviado', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('<html>error</html>', { status: 200 }))
    expect((await sendSms({ to: '633492344', body: 'x' })).sent).toBe(false)
  })

  it('un HTTP de error se reporta con su código', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('no', { status: 401 }))
    expect(await sendSms({ to: '633492344', body: 'x' })).toEqual({
      sent: false,
      reason: 'Acumbamail 401',
    })
  })

  it('un fallo de red no revienta: se reporta', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'))
    const r = await sendSms({ to: '633492344', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'red: fetch failed' })
  })

  /** Un fallo de verdad no lleva `freno`: así lo cuenta el contador de fallos. */
  it('los fallos de verdad no llevan la marca de freno', async () => {
    vi.mocked(fetch).mockResolvedValue(rechazo('Insufficient credits'))
    const r = await sendSms({ to: '633492344', body: 'x' })
    expect(r.sent === false && r.freno).toBeFalsy()
  })
})

describe('sendSms · el token va en la URL, y no puede acabar escrito en ningún sitio', () => {
  it('ni al enviar ni al fallar aparece en los logs', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(respuestaReal())
      .mockResolvedValueOnce(new Response(`error en ?auth_token=${TOKEN}`, { status: 500 }))
      .mockResolvedValueOnce(new Response(`<p>${TOKEN}</p>`, { status: 200 }))
      .mockResolvedValueOnce(rechazo(`token ${TOKEN} sin crédito`))

    for (let i = 0; i < 4; i++) await sendSms({ to: '633492344', body: 'x' })

    const escrito = [...vi.mocked(console.log).mock.calls, ...vi.mocked(console.error).mock.calls]
      .flat()
      .join(' ')
    expect(escrito).not.toContain(TOKEN)
  })

  /** El motivo se guarda en la base (MessageLog.reason): tampoco puede llevarlo. */
  it('no va en el motivo aunque el error de red traiga la URL', async () => {
    vi.mocked(fetch).mockRejectedValue(
      new Error(`fetch failed: https://acumbamail.com/api/1/sendSMS?auth_token=${TOKEN}`),
    )
    const r = await sendSms({ to: '633492344', body: 'x' })
    expect(r.sent === false && r.reason).not.toContain(TOKEN)
  })

  it('ni en el motivo de un rechazo', async () => {
    vi.mocked(fetch).mockResolvedValue(rechazo(`token ${TOKEN} inválido`))
    const r = await sendSms({ to: '633492344', body: 'x' })
    expect(r.sent === false && r.reason).not.toContain(TOKEN)
  })
})

describe('sendSms · los frenos, antes de llegar a la red', () => {
  it('SMS_MODE=off no llama a fetch y lo marca como freno', async () => {
    process.env.SMS_MODE = 'off'
    expect(await sendSms({ to: '633492344', body: 'x' })).toEqual({
      sent: false,
      reason: 'SMS_MODE=off',
      freno: true,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('SMS_MODE=dry no llama a fetch y lo marca como freno', async () => {
    process.env.SMS_MODE = 'dry'
    expect(await sendSms({ to: '633492344', body: 'x' })).toEqual({
      sent: false,
      reason: 'SMS_MODE=dry',
      freno: true,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('un teléfono que no es español no llega a la red', async () => {
    const r = await sendSms({ to: 'no-es-un-telefono', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'teléfono no válido', freno: true })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sin token no llega a la red', async () => {
    delete process.env.ACUMBAMAIL_TOKEN
    const r = await sendSms({ to: '633492344', body: 'x' })
    expect(r).toEqual({ sent: false, reason: 'sin ACUMBAMAIL_TOKEN', freno: true })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('SMS_OVERRIDE_TO manda a ese número en vez de al real', async () => {
    process.env.SMS_OVERRIDE_TO = '699999999'
    vi.mocked(fetch).mockResolvedValue(respuestaReal())
    await sendSms({ to: '633492344', body: 'x' })
    expect(JSON.parse(llamada().url.searchParams.get('messages')!)[0].recipient).toBe(
      '+34699999999',
    )
  })
})
