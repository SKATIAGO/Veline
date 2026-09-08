import { describe, expect, it } from 'vitest'
import { es } from './es'
import { en } from './en'

/**
 * Las dos cosas que el compilador NO puede comprobar.
 *
 * Que las claves estén las dos veces ya lo garantiza el tipo de `en`: si falta
 * una, no compila. Lo que se le escapa es el contenido, y ahí caben dos
 * errores que no dan ningún síntoma hasta que los ve un cliente.
 */

/** Los {huecos} que trae una frase. */
const huecos = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()

const claves = Object.keys(es) as (keyof typeof es)[]

describe('diccionarios', () => {
  /**
   * Si el inglés se deja un {n}, el número desaparece de la frase y sale
   * «businesses» a secas. Si se inventa un {nombre} que nadie le pasa, sale el
   * literal «{nombre}» en pantalla.
   */
  it.each(claves)('«%s» usa los mismos huecos en los dos idiomas', (clave) => {
    expect(huecos(en[clave])).toEqual(huecos(es[clave]))
  })

  /** Una clave traducida a nada es peor que una sin traducir: no se ve. */
  it('ninguna traducción está vacía', () => {
    const vacias = claves.filter((c) => !en[c].trim() || !es[c].trim())
    expect(vacias).toEqual([])
  })

  /**
   * No es una regla de estilo: una clave copiada tal cual del castellano suele
   * ser un descuido al añadirla, y así aparece en la lista en vez de en la
   * pantalla de un cliente. Las que de verdad se escriben igual en los dos
   * idiomas van aquí, a mano y a propósito.
   */
  it('no hay español colado en el inglés', () => {
    const IGUALES: (keyof typeof es)[] = [
      'nav.marketplace',
      'pie.marketplace',
      'pie.contacto',
      'pie.cookies',
      'ficha.info',
      'ficha.tel',
      'comun.total',
      'comun.no',
      'confirmar.email',
      'agenda.email',
      'panel.rolSuperadmin',
      // Los ejemplos de los campos: un nombre y un correo, no son texto.
      'confirmar.nombreEjemplo',
      'confirmar.emailEjemplo',
    ]
    const sospechosas = claves.filter(
      (c) => en[c] === es[c] && !IGUALES.includes(c) && /[a-zá-ú]/i.test(es[c]),
    )
    expect(sospechosas).toEqual([])
  })
})
