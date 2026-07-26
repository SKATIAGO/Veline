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
export const ESLOGANES_ALTERNATIVOS = [
  'Creado para cuidar cada detalle',
  'El lujo de la sencillez',
]

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
 */
export const SERVICIOS_EMPRESA = [
  {
    title: 'Área administrativa cómoda y sencilla',
    text: 'Un panel que se entiende sin manual: agenda, clientes y servicios a un clic.',
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
    text: 'Alguien al otro lado para dudas o problemas, sin tickets que se pierden.',
  },
  {
    title: 'Web personalizada',
    text: 'Creamos la web de la empresa con su marca y su propio motor de reservas.',
    plus: true,
  },
  {
    title: 'Aplicación para su local',
    text: 'Una app propia del negocio para que sus clientes reserven desde el móvil.',
    plus: true,
  },
  {
    title: 'Análisis de rendimiento',
    text: 'Rendimiento del trabajo y fidelidad de los clientes, en datos claros.',
  },
  {
    title: 'Herramientas de facturación',
    text: 'Facturas y cobros conectados con las citas, sin duplicar trabajo.',
  },
] as const
