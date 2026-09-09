import { CONTACT_EMAIL } from '@veline/shared'
import type { Clave } from '../i18n/idioma'

/**
 * Lo que Veline guarda de verdad, escrito una sola vez.
 *
 * Esto no es texto de relleno: cada fila se corresponde con algo que existe en
 * el código. La cookie de sesión sale de auth/sessions.ts, el origen guardado
 * sale de lib/origen.ts y los datos personales salen del esquema de la base.
 * Un aviso de privacidad que no coincide con lo que hace el sistema es peor
 * que no tener ninguno, así que si mañana se añade una cookie —analítica,
 * mapas, vídeo incrustado— hay que añadirla AQUÍ, y de paso repasar el aviso
 * del banner: en cuanto haya una cookie que no sea necesaria, informar deja de
 * bastar y hace falta pedir permiso de verdad, con opción de rechazar.
 *
 * ── Sobre las dos versiones ──
 * El texto vive en i18n, en castellano y en inglés. Las dos son el mismo
 * aviso: no es una traducción de cortesía, es el mismo compromiso legal dicho
 * dos veces. Si se cambia una frase HAY QUE CAMBIAR LAS DOS — que digan cosas
 * distintas sobre lo que se guarda o cuánto tiempo es peor que tener solo una.
 * La prueba de i18n obliga a que exista la pareja, pero no puede leer si
 * significan lo mismo: eso lo tiene que mirar una persona.
 */

/** Fecha de la última revisión. En ISO y no escrita a mano: así se enseña en
    castellano o en inglés sin tener dos fechas que se desincronizan. */
export const LEGAL_ACTUALIZADO = '2026-09-08'

export const COOKIES = [
  {
    nombre: 'veline_session',
    quien: 'leg.sesionQuien',
    para: 'leg.sesionPara',
    dura: 'leg.sesionDura',
    necesaria: true,
  },
] as const satisfies readonly {
  nombre: string
  quien: Clave
  para: Clave
  dura: Clave
  necesaria: boolean
}[]

/** No son cookies, pero se guardan en el navegador y se cuentan igual. */
export const ALMACENAMIENTO = [
  {
    nombre: 'veline:origen',
    para: 'leg.origenPara',
    dura: 'leg.origenDura',
  },
] as const satisfies readonly { nombre: string; para: Clave; dura: Clave }[]

/** Qué datos se guardan, de quién y para qué. */
export const DATOS = [
  {
    quien: 'leg.reservaQuien',
    que: 'leg.reservaQue',
    para: 'leg.reservaPara',
    cuanto: 'leg.reservaCuanto',
  },
  {
    quien: 'leg.resenaQuien',
    que: 'leg.resenaQue',
    para: 'leg.resenaPara',
    cuanto: 'leg.resenaCuanto',
  },
  {
    quien: 'leg.cuentaQuien',
    que: 'leg.cuentaQue',
    para: 'leg.cuentaPara',
    cuanto: 'leg.cuentaCuanto',
  },
  {
    quien: 'leg.registroQuien',
    que: 'leg.registroQue',
    para: 'leg.registroPara',
    cuanto: 'leg.registroCuanto',
  },
] as const satisfies readonly { quien: Clave; que: Clave; para: Clave; cuanto: Clave }[]

/** Con quién se comparten los datos, y para qué exactamente. */
export const ENCARGADOS = [
  {
    nombre: 'Acumbamail',
    donde: 'leg.espana',
    para: 'leg.acumbamailPara',
  },
  {
    /* Región confirmada por Santiago el 9 sep 2026: los datos están en España.
       Importa porque fuera del Espacio Económico Europeo habría que declararlo
       como transferencia internacional, y eso cambia el aviso entero.

       Es una afirmación legal, así que conviene comprobarla una vez en el
       panel de IONOS antes de publicar el aviso definitivo: la región del
       centro de datos se elige al contratar y no siempre coincide con el país
       de la empresa (IONOS es alemana). */
    nombre: 'IONOS',
    donde: 'leg.espana',
    para: 'leg.ionosPara',
  },
] as const satisfies readonly { nombre: string; donde: Clave; para: Clave }[]

export const CONTACTO_LEGAL = CONTACT_EMAIL
