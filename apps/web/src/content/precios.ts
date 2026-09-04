/**
 * Tarifas — segunda ronda del brief de Eli (26 jul 2026).
 * Los importes van en céntimos para formatearlos con el mismo helper que el
 * resto del producto.
 */

export const PRUEBA_DIAS = 15

export const PLANES = [
  {
    name: 'Prueba gratis',
    tagline: 'Sin compromiso',
    price: 'Gratis',
    period: `${PRUEBA_DIAS} días`,
    cta: 'Empezar la prueba',
    variant: 'secondary' as const,
    features: [
      'Todo lo del plan Negocio',
      'Sin permanencia',
      'Tu perfil en el marketplace desde el primer día',
      'Al acabar decides si sigues',
    ],
  },
  {
    name: 'Negocio',
    tagline: 'Para el día a día de tu local',
    priceCents: 1895,
    period: '/mes',
    popular: true,
    cta: 'Contratar',
    variant: 'primary' as const,
    features: [
      'Incluye 2 personas en el calendario',
      'Reservas ilimitadas desde tu web, Instagram o Google',
      'Recordatorios por SMS y email — 200 mensajes al mes incluidos, luego 0,06 €/mensaje',
      'Estadísticas del negocio',
      'Reseñas de clientes',
      'Soporte prioritario',
    ],
  },
  {
    name: 'Equipo',
    tagline: 'Cuando sois más de dos',
    priceCents: 1095,
    pricePrefix: '+',
    period: '/mes por persona de más',
    cta: 'Hablar con ventas',
    variant: 'secondary' as const,
    features: [
      'Todo lo de Negocio',
      'Personas y locales ilimitados',
      'Panel multi-sucursal',
      'Soporte dedicado',
    ],
  },
]

/** Servicios que se contratan aparte del plan. */
export const EXTRAS = [
  {
    name: 'Creación de web y app móvil',
    price: 'Desde 250 €',
    note: 'pago único',
    items: [
      'Imagen propia de tu negocio',
      'Motor de reservas integrado',
      'Administrador propio',
      'Gestión de varios locales',
      'Correo corporativo — a consultar',
    ],
  },
  {
    name: 'Gestión administrativa',
    price: '50 € /mes',
    note: 'nos ocupamos nosotros',
    items: [
      'Cambios de horarios y precios',
      'Información del negocio al día',
      'Altas y bajas de personas y miembros',
    ],
  },
  {
    name: 'Reseñas',
    price: 'Gratis',
    note: 'incluido siempre',
    items: ['Recogida y publicación de las reseñas de tus clientes'],
  },
  {
    name: 'Recordatorios',
    price: '200 msj/mes gratis',
    note: 'luego 0,06 € por mensaje',
    items: ['Los SMS y el email comparten el mismo cupo mensual'],
  },
]

/** Preguntas frecuentes de quien va a dar de alta su negocio. */
export const FAQ = [
  {
    q: '¿Necesito saber de informática?',
    a: 'No. Creas el perfil, pones tus servicios y tus horarios, y ya puedes recibir reservas. Si prefieres no tocar nada, contratas la gestión administrativa y lo hacemos por ti.',
  },
  {
    q: `¿Qué pasa cuando acaban los ${PRUEBA_DIAS} días de prueba?`,
    a: 'Nada automático: no se te cobra nada sin que tú lo decidas. Si sigues, pasas al plan Negocio; si no, tu perfil deja de aceptar reservas nuevas y tus datos siguen ahí por si vuelves.',
  },
  {
    q: '¿Hay permanencia?',
    a: 'No. Es mes a mes y puedes darte de baja cuando quieras desde el panel.',
  },
  {
    q: '¿Cuántas personas entran en el precio?',
    a: 'El plan Negocio incluye 2 personas en el calendario. A partir de ahí, cada persona de más son 10,95 € al mes.',
  },
  {
    q: '¿Cómo funciona la comisión del 15 %?',
    a: 'Solo se cobra la primera vez que un cliente nuevo te descubre en el marketplace de Veline y reserva contigo. Si ese cliente ya era tuyo, o llega por tu Instagram, por Google o por el boca a boca, no pagas comisión nunca.',
  },
  {
    q: '¿Los recordatorios por SMS tienen coste extra?',
    a: 'Los primeros 200 mensajes de cada mes están incluidos en el plan, sean SMS o email. A partir de ahí, cada mensaje adicional cuesta 0,06 €.',
  },
  {
    q: '¿Puedo usar Veline sin salir en el marketplace?',
    a: 'Sí. Puedes usarlo solo como motor de reservas en tu web y tus redes. En ese caso no hay comisión, porque los clientes no llegan por nosotros.',
  },
  {
    q: '¿Qué pasa con la agenda que ya tengo?',
    a: 'Puedes seguir apuntando citas a mano en el panel mientras te acostumbras: la agenda es la misma para las reservas online y las de siempre, así que no acabas con dos calendarios.',
  },
]
