/**
 * Tarifas — segunda ronda del brief de Eli (26 jul 2026).
 * Los importes van en céntimos para formatearlos con el mismo helper que el
 * resto del producto.
 *
 * Aquí viven las CLAVES, los importes y el orden; el texto está en i18n. Los
 * precios que no son un número —«Gratis», «Desde 350 €»— también son clave,
 * porque en inglés se escriben distinto: «From €350», con el símbolo delante.
 */
import { PRUEBA_DIAS_DEFECTO } from '@veline/shared'
import type { Clave } from '../i18n/idioma'

/* No un 15 propio: el mismo con el que el servidor pone fecha de caducidad a
   la prueba al crear el negocio. Dos copias del mismo número acaban diciendo
   cosas distintas — aquí ya pasó: esta lo prometía y el servidor no la ponía. */
export const PRUEBA_DIAS = PRUEBA_DIAS_DEFECTO

/* Antes los tres botones llevaban a /panel —la pantalla de entrada— y quien
   venía a contratar se topaba con un «inicia sesión» que no podía pasar. Ya
   existe el alta, así que van ahí.

   El de Equipo no: ese plan se cierra hablando (locales ilimitados, soporte
   dedicado, precio por persona), así que sigue abriendo el correo. El asunto
   va traducido: quien escribe en inglés lo escribe en inglés. */
/**
 * Un plan de la tabla de precios.
 *
 * Los tres no tienen la misma forma y por eso los campos son opcionales: la
 * prueba tiene precio escrito («Gratis») y los otros dos lo tienen en
 * céntimos; Equipo se cierra por correo en vez de con un botón a /alta.
 */
interface Plan {
  nombre: Clave
  tagline: Clave
  /** Cuando el precio es una palabra y no un número. */
  precio?: Clave
  priceCents?: number
  pricePrefix?: string
  periodo: Clave
  popular?: boolean
  cta: Clave
  /** Adónde lleva el botón, si es una pantalla de Veline. */
  to?: string
  /** Asunto del correo, si el plan se cierra hablando. */
  asunto?: Clave
  variant: 'primary' | 'secondary'
  features: readonly Clave[]
}

export const PLANES: readonly Plan[] = [
  {
    nombre: 'pre.pruebaNombre',
    tagline: 'pre.pruebaTagline',
    precio: 'pre.gratis',
    periodo: 'pre.pruebaPeriodo',
    cta: 'pre.empezarPrueba',
    to: '/alta',
    variant: 'secondary' as const,
    features: ['pre.pruebaF1', 'pre.pruebaF2', 'pre.pruebaF3', 'pre.pruebaF4'],
  },
  {
    nombre: 'pre.negocioNombre',
    tagline: 'pre.negocioTagline',
    priceCents: 1895,
    periodo: 'pre.alMes',
    popular: true,
    cta: 'pre.contratar',
    to: '/alta',
    variant: 'primary' as const,
    features: [
      'pre.negocioF1',
      'pre.negocioF2',
      'pre.negocioF3',
      'pre.negocioF4',
      'pre.negocioF5',
      'pre.negocioF6',
    ],
  },
  {
    nombre: 'pre.equipoNombre',
    tagline: 'pre.equipoTagline',
    priceCents: 1095,
    pricePrefix: '+',
    periodo: 'pre.equipoPeriodo',
    cta: 'pre.hablarVentas',
    /** Se escribe al pulsar: el asunto necesita el idioma de quien mira. */
    asunto: 'pre.equipoAsunto',
    variant: 'secondary' as const,
    features: ['pre.equipoF1', 'pre.equipoF2', 'pre.equipoF3', 'pre.equipoF4'],
  },
]

/** Servicios que se contratan aparte del plan. */
export const EXTRAS = [
  {
    nombre: 'pre.webNombre',
    precio: 'pre.webPrecio',
    nota: 'pre.pagoUnico',
    items: ['pre.webI1', 'pre.webI2', 'pre.webI3', 'pre.webI4', 'pre.webI5'],
  },
  {
    nombre: 'pre.gestionNombre',
    precio: 'pre.gestionPrecio',
    nota: 'pre.gestionNota',
    items: ['pre.gestionI1', 'pre.gestionI2', 'pre.gestionI3'],
  },
  {
    nombre: 'pre.resenasNombre',
    precio: 'pre.gratis',
    nota: 'pre.incluidoSiempre',
    items: ['pre.resenasI1'],
  },
  {
    nombre: 'pre.recordatoriosNombre',
    precio: 'pre.recordatoriosPrecio',
    nota: 'pre.recordatoriosNota',
    items: ['pre.recordatoriosI1'],
  },
] as const satisfies readonly {
  nombre: Clave
  precio: Clave
  nota: Clave
  items: readonly Clave[]
}[]

/** Preguntas frecuentes de quien va a dar de alta su negocio. */
export const FAQ = [
  { q: 'pre.q1', a: 'pre.a1' },
  { q: 'pre.q2', a: 'pre.a2' },
  { q: 'pre.q3', a: 'pre.a3' },
  { q: 'pre.q4', a: 'pre.a4' },
  { q: 'pre.q5', a: 'pre.a5' },
  { q: 'pre.q6', a: 'pre.a6' },
  { q: 'pre.q7', a: 'pre.a7' },
  { q: 'pre.q8', a: 'pre.a8' },
] as const satisfies readonly { q: Clave; a: Clave }[]
