import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readMailConfig } from './tipos.js'

/**
 * Qué proveedor acaba mandando el correo. Se prueba porque equivocarse aquí no
 * rompe nada visible: la API arranca, las reservas se confirman y simplemente
 * no sale ningún correo hasta que alguien se queja.
 */

const guardadas = { ...process.env }

beforeEach(() => {
  delete process.env.MAIL_PROVIDER
  delete process.env.ACUMBAMAIL_TOKEN
  delete process.env.BREVO_API_KEY
})

afterEach(() => {
  process.env = { ...guardadas }
})

describe('elección de proveedor de correo', () => {
  it('respeta MAIL_PROVIDER aunque el otro sea el que tiene credencial', () => {
    process.env.MAIL_PROVIDER = 'brevo'
    process.env.ACUMBAMAIL_TOKEN = 'x'
    expect(readMailConfig().provider).toBe('brevo')
  })

  it('sin decir nada, manda Acumbamail si tiene token', () => {
    process.env.ACUMBAMAIL_TOKEN = 'x'
    process.env.BREVO_API_KEY = 'y'
    expect(readMailConfig().provider).toBe('acumbamail')
  })

  it('cae a Brevo mientras no haya token de Acumbamail', () => {
    // El caso del día de la migración: producción tenía la clave vieja y
    // ninguna variable nueva. Sin este respaldo, el despliegue apagaba el
    // correo hasta que alguien entrase al servidor a mano.
    process.env.BREVO_API_KEY = 'y'
    expect(readMailConfig().provider).toBe('brevo')
  })

  it('sin ninguna credencial se queda en Acumbamail, que es el destino', () => {
    expect(readMailConfig().provider).toBe('acumbamail')
  })
})
