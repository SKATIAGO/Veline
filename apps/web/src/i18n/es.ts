/**
 * Los textos, en castellano.
 *
 * Esta es la fuente: aquí se escribe y de aquí salen las claves. El inglés
 * (en.ts) está tipado contra este archivo, así que añadir una clave aquí y
 * olvidarla allí NO compila.
 *
 * Las claves se agrupan por dónde se ven, no por lo que dicen: cuando haya que
 * cambiar un texto se busca por la pantalla, que es lo que uno tiene delante.
 *
 * Fase 1: el camino del cliente —buscar, ficha, reservar, su reserva y la
 * reseña— más lo compartido. Es donde el inglés da dinero: alguien de fuera
 * que quiere reservar. El panel y la parte de venta a negocios siguen en
 * castellano y entran en la siguiente tanda.
 */

export const es = {
  // ── Compartido ────────────────────────────────────────────
  'comun.volver': 'Volver',
  'comun.cargando': 'Cargando…',
  'comun.buscar': 'Buscar',
  'comun.cerrado': 'Cerrado',
  'comun.desde': 'Desde',
  'comun.total': 'Total',
  'comun.opcional': '(opcional)',
  'comun.nuevoEnVeline': 'Nuevo en Veline',
  'comun.inicio': 'Veline — inicio',
  'comun.idioma': 'Idioma',

  // ── Cabecera y pie ────────────────────────────────────────
  'nav.comoFunciona': 'Cómo funciona',
  'nav.servicios': 'Servicios',
  'nav.precios': 'Precios',
  'nav.marketplace': 'Marketplace',
  'nav.entrar': 'Iniciar sesión',
  'nav.anadirNegocio': 'Añadir mi negocio',
  'pie.eslogan': 'Reservas online para cualquier negocio.',
  'pie.negocios': 'Negocios',
  'pie.marketplace': 'Marketplace',
  'pie.compania': 'Compañía',
  'pie.buscarNegocios': 'Buscar negocios',
  'pie.consultarReserva': 'Consultar mi reserva',
  'pie.sobreNosotros': 'Sobre nosotros',
  'pie.contacto': 'Contacto',
  'pie.privacidad': 'Privacidad',
  'pie.cookies': 'Cookies',
  'pie.panel': 'Panel de gestión',
  'pie.red': '{red} de Veline',
  'pie.serviciosEmpresas': 'Servicios para empresas',

  // ── Aviso de cookies ──────────────────────────────────────
  'cookies.aviso':
    'Usamos una única cookie, la que mantiene tu sesión abierta en el panel. No hay cookies de publicidad ni de seguimiento.',
  'cookies.masDetalle': 'Más detalle',
  'cookies.entendido': 'Entendido',

  // ── Buscador ──────────────────────────────────────────────
  'buscar.queBuscas': '¿Qué buscas?',
  'buscar.donde': 'Tu barrio o ciudad',
  'buscar.dondeEtiqueta': 'Dónde',
  'buscar.buscando': 'Buscando…',
  'buscar.unNegocio': '{n} negocio',
  'buscar.variosNegocios': '{n} negocios',
  'buscar.para': 'para “{q}”',
  'buscar.sinResultados': 'No hemos encontrado nada por aquí',
  'buscar.sinResultadosPista': 'Prueba con otro sector o quita alguno de los filtros.',
  'buscar.tuNegocioNoEsta': '¿Tu negocio no está?',
  'buscar.anadeloGratis': 'Añádelo gratis',

  // ── Ficha del negocio ─────────────────────────────────────
  'ficha.cargando': 'Cargando el negocio…',
  'ficha.noExiste': 'Este negocio no existe',
  'ficha.noExistePista': 'Puede que haya cambiado de dirección.',
  'ficha.volverBusqueda': 'Volver a la búsqueda',
  'ficha.servicios': 'Servicios',
  'ficha.resenas': 'Reseñas',
  'ficha.info': 'Info',
  'ficha.reservar': 'Reservar',
  'ficha.sinServicios': 'Este negocio todavía no ha publicado servicios.',
  'ficha.sinServiciosBoton': 'Sin servicios disponibles',
  'ficha.verFotos': 'Ver las {n} fotos',
  'ficha.verFotosDe': 'Ver las fotos de {nombre}',
  'ficha.foto': '{nombre} — foto {n}',
  'ficha.fotoPrincipal': 'Foto principal',
  'ficha.fotoNumero': 'Foto {n}',
  'ficha.direccion': 'Dirección',
  'ficha.sinDireccion': 'Sin dirección',
  'ficha.tel': 'Tel.',
  'ficha.horario': 'Horario',
  'ficha.hoy': 'Hoy',
  'ficha.reservarCita': 'Reservar cita',
  'ficha.verHuecos': 'Ver huecos disponibles',
  'ficha.mediaResenas': '{nota} ★ de media en {n} reseñas',
  'ficha.resenasProxima': 'El detalle de las reseñas llega en la próxima versión.',
  'ficha.fotosDe': 'Fotos de {nombre}',
  'ficha.verFoto': 'Ver la foto {n}',
  'ficha.fotoAnterior': 'Foto anterior',
  'ficha.fotoSiguiente': 'Foto siguiente',
  'ficha.fotoNegocio': 'Foto del negocio',
  'ficha.cerrarGaleria': 'Cerrar galería',

  // ── Elegir fecha y hora ───────────────────────────────────
  'fecha.titulo': 'Elige fecha y hora',
  'fecha.servicio': 'Servicio',
  'fecha.local': 'Local',
  'fecha.mesAnterior': 'Mes anterior',
  'fecha.mesSiguiente': 'Mes siguiente',
  'fecha.buscandoHuecos': 'Buscando huecos…',
  'fecha.sinHuecos': 'Sin huecos disponibles',
  'fecha.sinHuecosPista': 'No quedan huecos en este periodo. Prueba con el mes siguiente.',
  'fecha.manana': 'Mañana',
  'fecha.tarde': 'Tarde',
  'fecha.continuar': 'Continuar',
  'fecha.eligeHora': 'Elige una hora',

  // ── Confirmar la reserva ──────────────────────────────────
  'confirmar.titulo': 'Confirma tu reserva',
  'confirmar.nombre': 'Nombre y apellidos',
  'confirmar.nombreEjemplo': 'Marina López',
  'confirmar.telefono': 'Teléfono',
  'confirmar.email': 'Email',
  'confirmar.emailEjemplo': 'marina.lopez@mail.com',
  'confirmar.notas': 'Notas para el negocio',
  'confirmar.notasEjemplo': 'Ej: llego con el coche, dejo las llaves en recepción…',
  'confirmar.sinCuenta':
    'No hace falta crear cuenta. Guardamos tu teléfono para identificar la reserva y avisarte si el negocio necesita cambiar la hora.',
  'confirmar.errNombre': 'Escribe tu nombre y apellidos.',
  'confirmar.errTelefono': 'Introduce un teléfono español de 9 cifras.',
  'confirmar.errEmail': 'Revisa el email.',
  'confirmar.resumen': 'Resumen',
  'confirmar.negocio': 'Negocio',
  'confirmar.servicio': 'Servicio',
  'confirmar.fecha': 'Fecha',
  'confirmar.duracion': 'Duración',
  'confirmar.eligeOtraHora': 'Elige otra hora',
  'confirmar.confirmando': 'Confirmando…',
  'confirmar.confirmar': 'Confirmar reserva',

  // ── Reserva hecha ─────────────────────────────────────────
  'hecha.noEncontrada': 'No encontramos esa reserva',
  'hecha.noEncontradaPista': 'Revisa el enlace o el código.',
  'hecha.cancelada': 'Reserva cancelada',
  'hecha.confirmada': '¡Reserva confirmada!',
  'hecha.canceladaTexto': 'Hemos avisado a {negocio}. Puedes reservar otra hora cuando quieras.',
  'hecha.confirmadaTexto': 'Te esperan el {fecha} a las {hora} en {negocio}.',
  'hecha.ics': 'Reserva {codigo} en Veline',
  'hecha.codigo': 'Código',
  'hecha.teAtiende': 'Te atiende',
  'hecha.donde': 'Dónde',
  'hecha.anadirCalendario': 'Añadir al calendario',
  'hecha.volverInicio': 'Volver al inicio',
  'hecha.reservarOtra': 'Reservar otra hora',
  'hecha.cancelar': 'Cancelar la reserva',
  'hecha.seguro': '¿Seguro?',
  'hecha.siCancelar': 'Sí, cancelar',
  'hecha.guardaEnlace': 'Guarda este enlace para consultar o cancelar tu cita:',

  // ── Reseña ────────────────────────────────────────────────
  'resena.enlaceNoVale': 'Este enlace no vale',
  'resena.enlaceNoValePista':
    'Puede que ya hayas dejado tu opinión, o que el enlace esté incompleto.',
  'resena.gracias': '¡Gracias!',
  'resena.graciasTexto':
    'Tu opinión ya está guardada. Ayuda más de lo que parece a la gente del barrio que está decidiendo.',
  'resena.queTalFue': '¿Qué tal fue en {negocio}?',
  'resena.conPuntuarBasta': 'Con puntuar basta, {nombre}. Lo demás es opcional.',
  'resena.contarMas': '¿Quieres contar algo más?',
  'resena.comentarioEjemplo': 'Qué tal el trato, la puntualidad, el resultado…',
  'resena.eligePuntuacion': 'Elige una puntuación',
  'resena.enviar': 'Enviar mi opinión',
  'resena.noEnviada': 'No se ha podido enviar',
  'resena.mal': 'Mal',
  'resena.regular': 'Regular',
  'resena.bien': 'Bien',
  'resena.muyBien': 'Muy bien',
  'resena.genial': 'Genial',
  'resena.deCinco': '{n} de 5 · {etiqueta}',
} as const
