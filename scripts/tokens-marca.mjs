#!/usr/bin/env node
/**
 * Regenera brand/tokens.css a partir del @theme de apps/web/src/index.css.
 *
 * La app es la única fuente de verdad de los tokens: ahí se miden los
 * contrastes y ahí se corrigen. brand/tokens.css es la copia que lee Claude
 * Design y cualquier otra herramienta, y antes se editaba a mano y se quedaba
 * atrás (el marrón AA, los grises). Ahora se escribe desde aquí:
 *
 *   node scripts/tokens-marca.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(raiz, 'apps/web/src/index.css'), 'utf8')

const inicio = css.indexOf('@theme {')
const fin = css.indexOf('\n}', inicio)
const bloque = css.slice(inicio + '@theme {'.length, fin)

// Se conservan los comentarios de bloque: explican por qué cada valor es el
// que es, y eso es lo que Claude Design tiene que leer.
const lineas = bloque
  .split('\n')
  .map((l) => l.replace(/^ {2}/, ''))
  .filter((l) => !/^\s*$/.test(l) || true)

const salida = `/* Veline — tokens de marca
 *
 * GENERADO por scripts/tokens-marca.mjs a partir de apps/web/src/index.css.
 * No se edita a mano: lo que cambie aquí se pierde en la siguiente
 * regeneración. Los valores son los de la app en producción (contrastes
 * medidos, escala tipográfica con nombre, capas y radios).
 *
 * Nombres: los mismos que usa Tailwind v4 en la app (--color-*, --text-*,
 * --z-index-*, --radius-*, --shadow-*, --font-*).
 */

:root {
${lineas.map((l) => (l ? '  ' + l : '')).join('\n')}
}
`

writeFileSync(join(raiz, 'brand/tokens.css'), salida)
console.log('brand/tokens.css regenerado')
