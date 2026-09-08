import type { es } from './es'

/**
 * The texts, in English.
 *
 * Traducción, no calco. Donde el castellano dice «huecos» el inglés dice
 * «times», no «gaps»; donde dice «Te atiende» dice «With», que es lo que pone
 * una peluquería inglesa. Si se traduce palabra por palabra se nota, y lo que
 * se nota da desconfianza justo cuando alguien va a dejar su teléfono.
 *
 * Inglés británico: el público está en Europa. «Mobile», no «cell»;
 * «Postcode», no «zip».
 *
 * Este objeto está tipado contra el español: si allí se añade una clave y aquí
 * no, esto no compila. Es todo el motivo de hacerlo a mano.
 */

export const en: Record<keyof typeof es, string> = {
  // ── Shared ────────────────────────────────────────────────
  'comun.volver': 'Back',
  'comun.cargando': 'Loading…',
  'comun.buscar': 'Search',
  'comun.cerrado': 'Closed',
  'comun.desde': 'From',
  'comun.total': 'Total',
  'comun.opcional': '(optional)',
  'comun.nuevoEnVeline': 'New on Veline',
  'comun.inicio': 'Veline — home',
  'comun.idioma': 'Language',

  // ── Header and footer ─────────────────────────────────────
  'nav.comoFunciona': 'How it works',
  'nav.servicios': 'Services',
  'nav.precios': 'Pricing',
  'nav.marketplace': 'Marketplace',
  'nav.entrar': 'Log in',
  'nav.anadirNegocio': 'Add my business',
  'pie.eslogan': 'Online booking for any business.',
  'pie.negocios': 'For businesses',
  'pie.marketplace': 'Marketplace',
  'pie.compania': 'Company',
  'pie.buscarNegocios': 'Find a business',
  'pie.consultarReserva': 'Check my booking',
  'pie.sobreNosotros': 'About us',
  'pie.contacto': 'Contact',
  'pie.privacidad': 'Privacy',
  'pie.cookies': 'Cookies',
  'pie.panel': 'Business dashboard',
  'pie.red': 'Veline on {red}',
  'pie.serviciosEmpresas': 'Services for companies',

  // ── Cookie notice ─────────────────────────────────────────
  'cookies.aviso':
    'We use a single cookie: the one that keeps you logged in to the dashboard. No advertising or tracking cookies.',
  'cookies.masDetalle': 'More detail',
  'cookies.entendido': 'Got it',

  // ── Search ────────────────────────────────────────────────
  'buscar.queBuscas': 'What are you looking for?',
  'buscar.donde': 'Your area or city',
  'buscar.dondeEtiqueta': 'Where',
  'buscar.buscando': 'Searching…',
  'buscar.unNegocio': '{n} business',
  'buscar.variosNegocios': '{n} businesses',
  'buscar.para': 'for “{q}”',
  'buscar.sinResultados': 'Nothing found around here',
  'buscar.sinResultadosPista': 'Try another category, or remove one of the filters.',
  'buscar.tuNegocioNoEsta': 'Business not listed?',
  'buscar.anadeloGratis': 'Add it for free',

  // ── Business page ─────────────────────────────────────────
  'ficha.cargando': 'Loading the business…',
  'ficha.noExiste': 'This business doesn’t exist',
  'ficha.noExistePista': 'It may have moved somewhere else.',
  'ficha.volverBusqueda': 'Back to search',
  'ficha.servicios': 'Services',
  'ficha.resenas': 'Reviews',
  'ficha.info': 'Info',
  'ficha.reservar': 'Book',
  'ficha.sinServicios': 'This business hasn’t published any services yet.',
  'ficha.sinServiciosBoton': 'No services available',
  'ficha.verFotos': 'See all {n} photos',
  'ficha.verFotosDe': 'See photos of {nombre}',
  'ficha.foto': '{nombre} — photo {n}',
  'ficha.fotoPrincipal': 'Main photo',
  'ficha.fotoNumero': 'Photo {n}',
  'ficha.direccion': 'Address',
  'ficha.sinDireccion': 'No address',
  'ficha.tel': 'Tel.',
  'ficha.horario': 'Opening hours',
  'ficha.hoy': 'Today',
  'ficha.reservarCita': 'Book an appointment',
  'ficha.verHuecos': 'See available times',
  'ficha.mediaResenas': '{nota} ★ average from {n} reviews',
  'ficha.resenasProxima': 'Full reviews are coming in the next release.',
  'ficha.fotosDe': 'Photos of {nombre}',
  'ficha.verFoto': 'See photo {n}',
  'ficha.fotoAnterior': 'Previous photo',
  'ficha.fotoSiguiente': 'Next photo',
  'ficha.fotoNegocio': 'Business photo',
  'ficha.cerrarGaleria': 'Close gallery',

  // ── Pick a date and time ──────────────────────────────────
  'fecha.titulo': 'Pick a date and time',
  'fecha.servicio': 'Service',
  'fecha.local': 'Location',
  'fecha.mesAnterior': 'Previous month',
  'fecha.mesSiguiente': 'Next month',
  'fecha.buscandoHuecos': 'Looking for times…',
  'fecha.sinHuecos': 'No times available',
  'fecha.sinHuecosPista': 'Nothing left in this period. Try next month.',
  'fecha.manana': 'Morning',
  'fecha.tarde': 'Afternoon',
  'fecha.continuar': 'Continue',
  'fecha.eligeHora': 'Pick a time',

  // ── Confirm the booking ───────────────────────────────────
  'confirmar.titulo': 'Confirm your booking',
  'confirmar.nombre': 'Full name',
  'confirmar.nombreEjemplo': 'Marina López',
  'confirmar.telefono': 'Mobile number',
  'confirmar.email': 'Email',
  'confirmar.emailEjemplo': 'marina.lopez@mail.com',
  'confirmar.notas': 'Notes for the business',
  'confirmar.notasEjemplo': 'E.g. I’ll come by car, I’ll leave the keys at reception…',
  'confirmar.sinCuenta':
    'No account needed. We keep your number to identify the booking and to let you know if the business has to move the time.',
  'confirmar.errNombre': 'Please enter your full name.',
  'confirmar.errTelefono': 'Enter a Spanish phone number — 9 digits.',
  'confirmar.errEmail': 'Check the email address.',
  'confirmar.resumen': 'Summary',
  'confirmar.negocio': 'Business',
  'confirmar.servicio': 'Service',
  'confirmar.fecha': 'Date',
  'confirmar.duracion': 'Duration',
  'confirmar.eligeOtraHora': 'Pick another time',
  'confirmar.confirmando': 'Confirming…',
  'confirmar.confirmar': 'Confirm booking',

  // ── Booking done ──────────────────────────────────────────
  'hecha.noEncontrada': 'We can’t find that booking',
  'hecha.noEncontradaPista': 'Check the link or the code.',
  'hecha.cancelada': 'Booking cancelled',
  'hecha.confirmada': 'Booking confirmed!',
  'hecha.canceladaTexto': 'We’ve let {negocio} know. You can book another time whenever you like.',
  'hecha.confirmadaTexto': 'See you on {fecha} at {hora}, at {negocio}.',
  'hecha.ics': 'Booking {codigo} on Veline',
  'hecha.codigo': 'Code',
  'hecha.teAtiende': 'With',
  'hecha.donde': 'Where',
  'hecha.anadirCalendario': 'Add to calendar',
  'hecha.volverInicio': 'Back to home',
  'hecha.reservarOtra': 'Book another time',
  'hecha.cancelar': 'Cancel this booking',
  'hecha.seguro': 'Are you sure?',
  'hecha.siCancelar': 'Yes, cancel',
  'hecha.guardaEnlace': 'Save this link to check or cancel your appointment:',

  // ── Review ────────────────────────────────────────────────
  'resena.enlaceNoVale': 'This link doesn’t work',
  'resena.enlaceNoValePista': 'You may have already left a review, or the link may be incomplete.',
  'resena.gracias': 'Thank you!',
  'resena.graciasTexto':
    'Your review is saved. It helps more than you’d think when someone nearby is deciding where to go.',
  'resena.queTalFue': 'How was it at {negocio}?',
  'resena.conPuntuarBasta': 'A rating is enough, {nombre}. The rest is optional.',
  'resena.contarMas': 'Anything else you’d like to say?',
  'resena.comentarioEjemplo': 'How they treated you, whether they ran on time, the result…',
  'resena.eligePuntuacion': 'Pick a rating',
  'resena.enviar': 'Send my review',
  'resena.noEnviada': 'It couldn’t be sent',
  'resena.mal': 'Bad',
  'resena.regular': 'Poor',
  'resena.bien': 'Good',
  'resena.muyBien': 'Very good',
  'resena.genial': 'Great',
  'resena.deCinco': '{n} of 5 · {etiqueta}',
}
