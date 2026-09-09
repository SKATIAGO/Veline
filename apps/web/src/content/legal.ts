import { CONTACT_EMAIL } from '@veline/shared'

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
 */

/** Fecha de la última revisión de estos textos. */
export const LEGAL_ACTUALIZADO = '8 de septiembre de 2026'

export const COOKIES = [
  {
    nombre: 'veline_session',
    quien: 'Veline (propia)',
    para: 'Mantener la sesión abierta en el panel de gestión. Sin ella habría que escribir la contraseña en cada pantalla.',
    dura: '14 días',
    necesaria: true,
  },
] as const

/** No son cookies, pero se guardan en el navegador y se cuentan igual. */
export const ALMACENAMIENTO = [
  {
    nombre: 'veline:origen',
    donde: 'Almacenamiento de sesión del navegador',
    para: 'Recordar si has llegado a un negocio desde su Instagram, su Google o su web, para no cobrarle comisión por un cliente que ya era suyo.',
    dura: 'Hasta que cierras la pestaña',
  },
] as const

/** Qué datos se guardan, de quién y para qué. */
export const DATOS = [
  {
    quien: 'Si reservas una cita',
    que: 'Nombre, teléfono y, si lo das, tu correo. También las notas que escribas para el negocio.',
    para: 'Que el negocio sepa quién va, poder avisarte si algo cambia y mandarte la confirmación y el recordatorio.',
    cuanto:
      'Mientras el negocio siga dado de alta. Puedes pedir que se borren escribiendo al correo de abajo.',
  },
  {
    quien: 'Si dejas una reseña',
    que: 'La puntuación y, si escribes algo, tu comentario. Se publica con tu nombre de pila.',
    para: 'Ayudar a otras personas a decidir.',
    cuanto: 'Mientras la ficha del negocio esté publicada.',
  },
  {
    quien: 'Si tienes cuenta en el panel',
    que: 'Nombre, correo y la contraseña cifrada. Nunca se guarda la contraseña en claro.',
    para: 'Dejarte entrar y saber qué puedes hacer dentro.',
    cuanto: 'Mientras la cuenta siga activa.',
  },
  {
    quien: 'Registro de actividad',
    que: 'De cada acción importante en el panel se guarda quién la hizo, cuándo, su dirección IP y el navegador.',
    para: 'Poder saber quién cambió qué si algo sale mal, y detectar intentos de entrar en una cuenta ajena.',
    cuanto: 'Mientras el negocio siga dado de alta.',
  },
] as const

/** Con quién se comparten los datos, y para qué exactamente. */
export const ENCARGADOS = [
  {
    nombre: 'Acumbamail',
    donde: 'España',
    para: 'Mandar los correos y los SMS de confirmación y recordatorio. Recibe el correo o el teléfono de destino y el texto del mensaje.',
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
    donde: 'España',
    para: 'El servidor donde vive Veline y su base de datos.',
  },
] as const

export const CONTACTO_LEGAL = CONTACT_EMAIL
