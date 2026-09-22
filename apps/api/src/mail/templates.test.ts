import { describe, expect, it } from 'vitest'
import {
  bookingCancelled,
  bookingConfirmedToCustomer,
  bookingCreatedToBusiness,
  bookingReminderMail,
  bookingRescheduled,
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
  idiomaCliente: 'es',
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
  ['cambio de hora', bookingRescheduled(base, new Date('2026-09-10T10:00:00Z'))],
  ['recordatorio', bookingReminderMail(base)],
  [
    'petición de reseña',
    reviewRequestMail(persona, {
      businessName: `${MALO}Peluquería`,
      serviceName: `${MALO}Corte`,
      url: 'https://veline.es/resena/abc',
      idiomaCliente: 'es',
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

/** El aviso de cambio de hora es el único que necesita dos fechas a la vez:
    la que tenía la cita y la que tiene ahora. Si se confundieran, el cliente
    llegaría al día que ya no toca. */
describe('el aviso de cambio de hora', () => {
  it('dice la hora de antes y la de ahora, no solo la nueva', () => {
    const antes = new Date('2026-09-10T09:00:00Z')
    const m = bookingRescheduled(base, antes)
    expect(m.text).toContain('10 de septiembre')
    expect(m.text).toContain('15 de septiembre')
  })
})

/**
 * El castellano de los correos, clavado.
 *
 * Existe por la fase 3: para poder escribirle a cada cliente en su idioma hay
 * que meter mano en las seis plantillas, y en ese trabajo es facilísimo mover
 * una coma, perder un acento o cambiar el orden de una fila sin enterarse. Los
 * correos no se miran a diario: el fallo saldría semanas después, en el buzón
 * de un cliente.
 *
 * Si una de estas capturas falla y el cambio era a propósito, se actualiza con
 * `npx vitest -u`. Lo que no puede pasar es que cambie sin que nadie lo vea.
 */
const conIdioma = (i: BookingMailData['idiomaCliente']) => ({ ...base, idiomaCliente: i })

describe('los correos en castellano no cambian solos', () => {
  const persona2 = { email: 'ana@ejemplo.es', name: 'Ana' }
  const b = conIdioma('es')

  const capturas: [string, { subject: string; html: string; text: string }][] = [
    ['confirmación al cliente', bookingConfirmedToCustomer(b)],
    ['aviso al negocio', bookingCreatedToBusiness(b, 'negocio@ejemplo.es')],
    ['cancelación (cliente)', bookingCancelled(b, persona2, 'cliente')],
    ['cancelación (negocio)', bookingCancelled(b, persona2, 'negocio')],
    ['recordatorio', bookingReminderMail(b)],
  ]

  for (const [nombre, m] of capturas) {
    it(nombre, () => {
      expect({ subject: m.subject, html: m.html, text: m.text }).toMatchSnapshot()
    })
  }
})

describe('extras en los correos de la cita', () => {
  const conExtras: BookingMailData = {
    ...base,
    priceCents: 3700,
    extras: [
      { name: `${MALO}Hidratación`, priceCents: 1200, quantity: 1 },
      { name: 'Bebida', priceCents: 0, quantity: 1 },
      { name: 'Uña rota', priceCents: 500, quantity: 3 },
    ],
  }

  it('el cliente y el negocio ven qué extras se eligieron y cuánto', () => {
    for (const m of [
      bookingConfirmedToCustomer(conExtras),
      bookingCreatedToBusiness(conExtras, 'negocio@ejemplo.es'),
    ]) {
      expect(m.text).toContain('Extras:')
      expect(m.text).toContain('Bebida (+0,00')
      expect(m.html).toContain('Hidratación (+12,00')
    }
  })

  /* Lo que se cobra es la línea entera. Enseñar 5,00 € cuando se van a cobrar
     15,00 € es la clase de sorpresa que se descubre pagando. */
  it('un extra pedido varias veces dice cuántas y cuánto suma', () => {
    const m = bookingConfirmedToCustomer(conExtras)
    expect(m.text).toContain('Uña rota ×3 (+15,00')
  })

  it('el nombre del extra lo escribe el negocio: también se escapa', () => {
    const m = bookingCreatedToBusiness(conExtras, 'negocio@ejemplo.es')
    expect(m.html).not.toContain('<img src=x')
  })

  it('sin extras no aparece la fila', () => {
    expect(bookingConfirmedToCustomer(base).text).not.toContain('Extras')
    expect(bookingConfirmedToCustomer({ ...base, extras: [] }).text).not.toContain('Extras')
  })
})
