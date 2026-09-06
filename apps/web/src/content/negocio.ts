/**
 * Contenido del lado negocio, tal y como viene del brief de Eli
 * ("GESTIÓN 1 VELINE", 26 jul 2026). Se centraliza aquí para que la home y la
 * página /negocios no se desincronicen.
 */

/** Eslogan marcado como favorito en el brief. */
export const ESLOGAN = 'Donde cada cita encuentra su lugar'

/** Eslogan de la sección para negocios. */
export const ESLOGAN_NEGOCIO = 'Gestiona tu negocio de forma inteligente'

/** Los otros dos candidatos del brief, pendientes de decidir. */
export const ESLOGANES_ALTERNATIVOS = ['Creado para cuidar cada detalle', 'El lujo de la sencillez']

/** "Qué destacaría en la home" — los cinco puntos del brief. */
export const DESTACADOS = [
  {
    title: 'Reservas 24/7',
    text: 'Tus clientes reservan incluso cuando el negocio está cerrado.',
  },
  {
    title: 'Recordatorios automáticos',
    text: 'Reduce las ausencias y cancelaciones de última hora.',
  },
  {
    title: 'Gestión de clientes',
    text: 'Toda la información en un único lugar.',
  },
  {
    title: 'Gestión de empleados',
    text: 'Controla horarios, servicios y disponibilidad.',
  },
  {
    title: 'Informes y métricas',
    text: 'Conoce el rendimiento real de tu negocio.',
  },
] as const

/**
 * "Servicios para ofrecer a las empresas".
 * `plus` marca lo que el brief señala explícitamente como extra —
 * la app a medida está pendiente de confirmar si también lo es.
 *
 * Las herramientas de facturación estaban en el brief original pero se
 * retiraron el 2 ago 2026: no se van a ofrecer.
 */
export const SERVICIOS_EMPRESA = [
  {
    title: 'Área administrativa cómoda y sencilla',
    text: 'Un panel que se entiende sin manual: agenda, clientes y servicios con un click.',
  },
  {
    title: 'Calendario adaptable',
    text: 'Gestión de calendario que se ajusta a cómo trabaja cada negocio, no al revés.',
  },
  {
    title: 'Gestión administrativa',
    text: 'Nos ocupamos del papeleo del día a día para quien prefiera delegarlo.',
    plus: true,
  },
  {
    title: 'Soporte y atención',
    text: 'Un equipo disponible para ayudarte cuando lo necesites.',
  },
  {
    title: 'Web personalizada',
    text: 'Creamos la web de tu empresa, con tu marca y tu propio motor de reservas.',
    plus: true,
  },
  {
    title: 'Aplicación para tu local',
    text: 'Tu propia aplicación personalizada para reforzar tu marca y facilitar a tus clientes el acceso a todos tus servicios.',
    plus: true,
  },
  {
    title: 'Análisis de rendimiento',
    text: 'Rendimiento del trabajo y fidelidad de los clientes, en datos claros.',
  },
] as const
