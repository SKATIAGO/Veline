import { describe, expect, it } from 'vitest'
import { idiomaDeLaReserva, idiomaParaCliente, idiomaParaNegocio } from './idioma.js'
import {
  bookingCancelled,
  bookingConfirmedToCustomer,
  bookingCreatedToBusiness,
  bookingReminderMail,
  type BookingMailData,
} from './templates.js'

/**
 * En una reserva conviven dos idiomas: el de quien reservó y el del negocio.
 * Estas pruebas fijan cuál se usa para cada uno, que es la parte que se puede
 * equivocar sin que nadie lo note hasta que un negocio de Madrid recibe sus
 * avisos en inglés.
 */

const enIngles: BookingMailData = {
  idiomaCliente: 'en',
  code: 'VL-TEST',
  startsAt: new Date('2026-09-15T10:00:00Z'),
  priceCents: 2500,
  serviceName: 'Corte',
  businessName: 'Peluquería Lola',
  businessSlug: 'peluqueria-lola',
  staffName: 'Marta',
  address: 'Calle Mayor 12',
  customerName: 'Marina',
  customerPhone: '612345678',
  customerEmail: 'marina@ejemplo.es',
  notes: null,
}

const enCastellano: BookingMailData = { ...enIngles, idiomaCliente: 'es' }
const persona = { email: 'ana@ejemplo.es', name: 'Ana' }

describe('de dónde sale el idioma de cada correo', () => {
  it('ES y EN de la base de datos se leen como es y en', () => {
    expect(idiomaDeLaReserva('ES')).toBe('es')
    expect(idiomaDeLaReserva('EN')).toBe('en')
  })

  /**
   * Esta es LA regla. El negocio no tiene idioma guardado, así que sus avisos
   * van en castellano pase lo que pase con la reserva. Si algún día alguien
   * cablea aquí el idioma del cliente, esto se cae.
   */
  it('al negocio se le escribe en castellano aunque el cliente reserve en inglés', () => {
    expect(idiomaParaNegocio()).toBe('es')

    const aviso = bookingCreatedToBusiness(enIngles, 'negocio@ejemplo.es')
    expect(aviso.html).toContain('<html lang="es">')

    const cancelacion = bookingCancelled(enIngles, persona, 'negocio')
    expect(cancelacion.html).toContain('<html lang="es">')
  })

  /**
   * ── Tripwire de la fase 3 ──
   *
   * Hoy, a un cliente que reservó en inglés se le escribe igualmente en
   * castellano, a propósito: los textos no están traducidos y media frase en
   * inglés dentro de un correo en castellano se lee peor que el correo entero
   * en castellano.
   *
   * Cuando en la fase 3 `idiomaParaCliente` devuelva `b.idiomaCliente`, esta
   * prueba fallará. Eso NO es un fallo: es el aviso de que la fase 3 llegó y
   * hay que sustituirla por su contraria —que el correo del cliente inglés
   * salga en inglés—, con los textos ya escritos.
   */
  it('hoy el cliente inglés recibe el correo en castellano, y es a propósito', () => {
    expect(idiomaParaCliente({ idiomaCliente: 'en' })).toBe('es')

    const parejas = [
      [bookingConfirmedToCustomer(enIngles), bookingConfirmedToCustomer(enCastellano)],
      [bookingReminderMail(enIngles), bookingReminderMail(enCastellano)],
      [
        bookingCancelled(enIngles, persona, 'cliente'),
        bookingCancelled(enCastellano, persona, 'cliente'),
      ],
    ] as const

    for (const [ingles, castellano] of parejas) {
      expect(ingles.subject).toBe(castellano.subject)
      expect(ingles.html).toBe(castellano.html)
      expect(ingles.text).toBe(castellano.text)
    }
  })

  /**
   * Que la cañería llega hasta el final. Las plantillas ya escriben la fecha,
   * la hora y el precio con el idioma que reciben: lo único que falta en la
   * fase 3 son las frases.
   */
  it('las plantillas ya escriben fechas y precios según el idioma que reciben', () => {
    // El correo del negocio sale en castellano, así que su fecha va en
    // castellano: es la prueba de que el formato sigue al idioma y no está
    // clavado en la plantilla.
    const aviso = bookingCreatedToBusiness(enIngles, 'negocio@ejemplo.es')
    expect(aviso.subject).toContain('de septiembre')
    expect(aviso.html).toContain('25,00')
  })
})
