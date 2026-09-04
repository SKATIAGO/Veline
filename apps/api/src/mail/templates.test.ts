import { describe, expect, it } from 'vitest'
import {
  bookingCancelled,
  bookingConfirmedToCustomer,
  bookingCreatedToBusiness,
  bookingReminderMail,
  passwordResetMail,
  reviewRequestMail,
  type BookingMailData,
} from './templates.js'

/**
 * Todo lo que se pinta en un correo lo escribe alguien: el nombre del cliente,
 * sus notas, el nombre del servicio. Si eso entra en el HTML sin escapar, un
 * cliente llamado `<img onerror=…>` inyecta HTML en el correo que le llega al
 * negocio.
 *
 * Es un fallo que no se ve: el correo sale igual y se lee casi igual. De ahí
 * estas pruebas.
 */

const MALO = '<img src=x onerror="alert(1)">'

const base: BookingMailData = {
  code: 'VL-TEST',
  startsAt: new Date('2026-09-15T10:00:00Z'),
  priceCents: 2500,
  serviceName: `${MALO}Corte`,
  businessName: `${MALO}Peluquería`,
  businessSlug: 'x',
  staffName: `${MALO}Marta`,
  address: `${MALO}Calle Mayor`,
  customerName: `${MALO}Marina`,
  customerPhone: '612345678',
  customerEmail: 'marina@ejemplo.es',
  notes: '<script>robar()</script>',
}

const persona = { email: 'ana@ejemplo.es', name: `${MALO}Ana` }

const plantillas: [string, { html: string }][] = [
  ['confirmación al cliente', bookingConfirmedToCustomer(base)],
  ['aviso al negocio', bookingCreatedToBusiness(base, 'negocio@ejemplo.es')],
  ['cancelación (cliente)', bookingCancelled(base, persona, 'cliente')],
  ['cancelación (negocio)', bookingCancelled(base, persona, 'negocio')],
  ['recordatorio', bookingReminderMail(base)],
  [
    'petición de reseña',
    reviewRequestMail(persona, {
      businessName: `${MALO}Peluquería`,
      serviceName: `${MALO}Corte`,
      url: 'https://veline.es/resena/abc',
    }),
  ],
  ['restablecer contraseña', passwordResetMail(persona, 'https://veline.es/x')],
]

describe('las plantillas de correo escapan lo que escribe el cliente', () => {
  for (const [nombre, mensaje] of plantillas) {
    it(`${nombre} no deja pasar HTML`, () => {
      expect(mensaje.html).not.toContain('<img src=x')
      expect(mensaje.html).not.toContain('<script>')
      // Y sí lo escapa, en vez de simplemente perderlo por el camino.
      expect(mensaje.html).toContain('&lt;')
    })
  }

  it('el aviso al negocio deja escribir al cliente de un clic', () => {
    // Acumbamail no tiene Reply-To, así que el contacto va a la vista.
    const html = bookingCreatedToBusiness(base, 'negocio@ejemplo.es').html
    expect(html).toContain('mailto:marina@ejemplo.es')
    expect(html).toContain('tel:612345678')
  })

  it('sin email del cliente, solo ofrece el teléfono', () => {
    const html = bookingCreatedToBusiness(
      { ...base, customerEmail: undefined },
      'negocio@ejemplo.es',
    ).html
    expect(html).not.toContain('mailto:')
    expect(html).toContain('tel:612345678')
  })
})
