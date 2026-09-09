import type { Clave } from '../i18n/idioma'

/**
 * Contenido del lado negocio, tal y como viene del brief de Eli
 * ("GESTIÓN 1 VELINE", 26 jul 2026). Se centraliza aquí para que la home y la
 * página /negocios no se desincronicen.
 *
 * Aquí viven las CLAVES y el orden, no el texto: el texto está en i18n/es.ts
 * y en i18n/en.ts. Antes estaba escrito aquí, y traducirlo habría significado
 * tener dos copias de la misma lista que acabarían diciendo cosas distintas.
 * El orden sí es de este archivo: es una decisión del brief, no del idioma.
 */

/** Eslogan marcado como favorito en el brief. */
export const ESLOGAN: Clave = 'home.eslogan'

/** Eslogan de la sección para negocios. */
export const ESLOGAN_NEGOCIO: Clave = 'home.esloganNegocio'

/** Los otros dos candidatos del brief, pendientes de decidir. Siguen en
    castellano porque no se usan en ninguna pantalla todavía. */
export const ESLOGANES_ALTERNATIVOS = ['Creado para cuidar cada detalle', 'El lujo de la sencillez']

/** "Qué destacaría en la home" — los cinco puntos del brief. */
export const DESTACADOS = [
  { titulo: 'home.reservas247', texto: 'home.reservas247Texto' },
  { titulo: 'home.recordatorios', texto: 'home.recordatoriosTexto' },
  { titulo: 'home.gestionClientes', texto: 'home.gestionClientesTexto' },
  { titulo: 'home.gestionEmpleados', texto: 'home.gestionEmpleadosTexto' },
  { titulo: 'home.informes', texto: 'home.informesTexto' },
] as const satisfies readonly { titulo: Clave; texto: Clave }[]

/**
 * "Servicios para ofrecer a las empresas".
 * `plus` marca lo que el brief señala explícitamente como extra —
 * la app a medida está pendiente de confirmar si también lo es.
 *
 * Las herramientas de facturación estaban en el brief original pero se
 * retiraron el 2 ago 2026: no se van a ofrecer.
 */
export const SERVICIOS_EMPRESA = [
  { titulo: 'home.areaAdmin', texto: 'home.areaAdminTexto' },
  { titulo: 'home.calendario', texto: 'home.calendarioTexto' },
  { titulo: 'home.gestionAdmin', texto: 'home.gestionAdminTexto', plus: true },
  { titulo: 'home.soporte', texto: 'home.soporteTexto' },
  { titulo: 'home.webPersonalizada', texto: 'home.webPersonalizadaTexto', plus: true },
  { titulo: 'home.appLocal', texto: 'home.appLocalTexto', plus: true },
  { titulo: 'home.analisis', texto: 'home.analisisTexto' },
] as const satisfies readonly { titulo: Clave; texto: Clave; plus?: boolean }[]
