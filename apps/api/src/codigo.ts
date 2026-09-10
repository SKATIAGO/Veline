import { randomInt } from 'node:crypto'

/**
 * Código de reserva. Es lo único que protege los datos del cliente en
 * /reserva/{código} —y desde ahí se puede CANCELAR la cita—, así que se genera
 * con el generador criptográfico del sistema, no con Math.random()
 * (predecible con suficientes muestras).
 *
 * Vive aquí y no en una ruta porque lo usan las dos puertas por las que entra
 * una cita: la web y el panel. Antes el panel tenía el suyo propio, con
 * Math.random() y 6 caracteres, justo lo que este comentario prohibía. Pasaba
 * poco porque ese código no salía del panel; ahora va en el SMS.
 *
 * Alfabeto sin caracteres que se confundan al dictarlo por teléfono: sin
 * I, O, 0, 1. Con 8 caracteres son 32^8 ≈ 1,1 billones de combinaciones;
 * junto al límite de peticiones, recorrerlos deja de ser viable.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export const bookingCode = () =>
  'VL-' + Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
