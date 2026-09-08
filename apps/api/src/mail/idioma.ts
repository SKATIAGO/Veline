import type { Idioma } from '@veline/shared'
import type { Idioma as IdiomaDB } from '@prisma/client'
import type { BookingMailData } from './templates.js'

/**
 * De cómo se guarda (ES / EN) a cómo se escribe en el código ('es' / 'en').
 *
 * Son dos alfabetos del mismo dato: Prisma quiere sus enums en mayúsculas y el
 * resto del producto usa los códigos de idioma de verdad, que son los que
 * entienden Intl y el atributo lang.
 */
export const idiomaDeLaReserva = (v: IdiomaDB): Idioma => (v === 'EN' ? 'en' : 'es')

/**
 * En qué idioma se le escribe a cada uno.
 *
 * En una misma reserva conviven DOS idiomas: el de quien reservó y el del
 * negocio que le atiende. No son el mismo y no tienen por qué coincidir —un
 * taller de Madrid puede recibir a un cliente inglés—, así que el error fácil
 * es coger el que esté a mano en esa función. Estas dos son las únicas que
 * responden a esa pregunta, y por eso tienen nombre.
 *
 * ── Por qué hoy las dos devuelven castellano ──
 *
 * Los textos de los correos y los SMS todavía no están traducidos. Mandar la
 * fecha en inglés dentro de una frase en castellano —«Tu cita en X:
 * Tuesday 15 September»— se lee peor que el correo entero en castellano, y da
 * la impresión de que algo se ha roto justo cuando le estás pidiendo a alguien
 * que se fíe. Así que el idioma se guarda desde ya, pero no se usa para
 * escribir hasta que haya qué escribir.
 *
 * En la fase 3 esto es una línea: `idiomaParaCliente` devuelve
 * `b.idiomaCliente`. Todo lo demás —la columna, el contrato, la web que lo
 * manda y las plantillas que lo aceptan— ya está puesto.
 */

/** El idioma de los avisos que recibe el CLIENTE: confirmación, recordatorio,
    cancelación y petición de reseña. */
export function idiomaParaCliente(_b: Pick<BookingMailData, 'idiomaCliente'>): Idioma {
  // Fase 3: `return _b.idiomaCliente`.
  return 'es'
}

/**
 * El idioma de los avisos que recibe el NEGOCIO: cita nueva y cancelación.
 *
 * Seguirá siendo castellano aunque llegue la fase 3, porque el negocio no
 * tiene idioma guardado: la preferencia del panel vive en el navegador de cada
 * persona, no en el servidor. Ponerle aquí el idioma del cliente haría que un
 * taller de Madrid recibiera sus avisos en inglés porque el cliente reservó en
 * inglés, que es exactamente lo que esto existe para evitar.
 */
export function idiomaParaNegocio(): Idioma {
  return 'es'
}
