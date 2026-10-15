import { categoryLabel, formatLongDate, formatPrice, TIMEZONE, type Idioma } from '@veline/shared'
import type { MailMessage } from './tipos.js'
import { idiomaParaCliente, idiomaParaNegocio } from './idioma.js'

/**
 * En qué idioma se le escribe al negocio.
 *
 * Hoy siempre castellano, y a propósito: el negocio no tiene idioma guardado
 * —la preferencia del panel vive en el navegador de cada persona, no en el
 * servidor—. Es una constante con nombre y no un 'es' suelto por un motivo
 * concreto: en la misma reserva conviven DOS idiomas, el del cliente y el del
 * negocio, y el error fácil es coger el que esté a mano. Con esto, pasarle el
 * del cliente al correo del negocio se ve al leerlo.
 *
 * El día que el negocio tenga idioma propio, se cambia aquí y en quien llame.
 */
export const IDIOMA_DEL_NEGOCIO: Idioma = 'es'

/* Paleta de marca. En correo se escriben literales: los clientes de email no
   entienden variables CSS ni hojas externas. Son los mismos valores que la
   app (brand/tokens.css); el marrón del botón es el de pantalla, que cumple
   AA con texto blanco. */
const INK = '#2E2119'
const INK_2 = '#3B2A1F'
const BRAND = '#A46639'
const ACCENT = '#D9A441'
const CREAM = '#F2E7D6'
const LINE = '#E4D5BE'
const BODY = '#5C4A34'
const MUTED = '#6A5741'
const ONDARK = '#F2E7D6'
const ONDARK_MUTED = '#C9B698'
/** Public Sans no está en ningún cliente de correo: es la primera de la pila
    por si algún día se embebe, y Helvetica/Arial son las que de verdad se ven. */
const FUENTE = "'Public Sans',Helvetica,Arial,sans-serif"

const webUrl = () => (process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '')

/* La hora se enseña SIEMPRE en la de Madrid: la cita es allí, y convertirla
   al huso de quien lee haría que un cliente en Londres viera una hora a la que
   no le van a atender. El idioma solo cambia cómo se escribe. */
const hora = (d: Date, idioma: Idioma) =>
  d.toLocaleTimeString(idioma === 'en' ? 'en-GB' : 'es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  })

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export interface BookingMailData {
  /** El idioma en el que reservó el cliente. NO es el del negocio. */
  idiomaCliente: Idioma
  code: string
  startsAt: Date
  priceCents: number
  serviceName: string
  businessName: string
  businessSlug: string
  staffName?: string | null
  address?: string | null
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  notes?: string | null
  /** Extras elegidos, con el precio que tenían al reservar. priceCents ya los incluye. */
  extras?: { name: string; priceCents: number; quantity: number }[]
}

/**
 * Escapa antes de meter nada en el HTML del correo.
 *
 * Todo lo que se pinta aquí lo escribe alguien: el nombre del cliente, sus
 * notas, el nombre del servicio. Sin esto, un cliente que se llame
 * `<img onerror=…>` inyecta HTML en el correo que le llega al negocio.
 */
const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * El botón «a prueba de Outlook»: las versiones de escritorio de Outlook no
 * pintan el relleno ni el radio de un <a>, así que para ellas va un
 * <v:roundrect> entre comentarios condicionales y el <a> normal para el
 * resto. El ancho fijo es lo que hace que el VML se vea igual que el enlace.
 */
function boton(label: string, url: string) {
  const texto = esc(label)
  const href = esc(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
<tr><td align="left">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="50%" strokecolor="${BRAND}" fillcolor="${BRAND}">
<w:anchorlock/>
<center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;">${texto}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="${href}" class="btn" style="display:inline-block;min-width:200px;padding:14px 28px;background:${BRAND};border-radius:999px;font-family:${FUENTE};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;text-align:center;mso-hide:all;">${texto}</a>
<!--<![endif]-->
</td></tr></table>`
}

/**
 * Marco común: cabecera con la marca, cuerpo y pie.
 *
 * Maquetación en tablas, estilos en línea, 600 px de ancho máximo (el ancho
 * seguro en Outlook y Gmail), un bloque condicional para que Outlook respete
 * el ancho, y un <style> solo para lo que los clientes modernos sí leen: el
 * modo oscuro (`prefers-color-scheme`) y el móvil. Cada color que importa va
 * también con `!important` en la clase oscura, porque Gmail y Apple Mail
 * reescriben los colores en línea si no se les dice lo contrario.
 */
function layout(opts: {
  /** Va en <html lang>: es lo que usa el lector de pantalla para elegir voz y
      el cliente de correo para ofrecer traducir. */
  idioma: Idioma
  preheader: string
  heading: string
  intro: string
  body: string
  cta?: { label: string; url: string }
}) {
  // El preheader se rellena con espacios invisibles para que el cliente de
  // correo no siga leyendo el cuerpo en la vista previa.
  const relleno = '&#847;&zwnj;&nbsp;'.repeat(40)
  return `<!doctype html>
<html lang="${opts.idioma}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(opts.heading)}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<style>table,td{font-family:Helvetica,Arial,sans-serif;}</style>
<![endif]-->
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0; mso-table-rspace:0; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a.btn:hover { background:#935A33 !important; }
  @media only screen and (max-width: 620px) {
    .wrap { padding:16px 8px !important; }
    .card { border-radius:12px !important; }
    .pad { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:22px !important; }
    .btn { display:block !important; width:100% !important; box-sizing:border-box !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg { background:${INK} !important; }
    .card { background:${INK_2} !important; border-color:#4A3826 !important; }
    .h1, .ink, .valor { color:${ONDARK} !important; }
    .texto { color:${ONDARK_MUTED} !important; }
    .muted { color:${ONDARK_MUTED} !important; }
    .linea { border-color:#4A3826 !important; }
    .nota { background:${INK} !important; color:${ONDARK} !important; }
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:${CREAM};word-break:break-word;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${CREAM};opacity:0;">${esc(opts.preheader)}${relleno}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:${CREAM};">
<tr><td align="center" class="wrap" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;font-family:${FUENTE};">
    <tr><td style="background:${INK};border-radius:16px 16px 0 0;padding:20px 28px;" class="pad">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:${FUENTE};font-size:20px;line-height:24px;font-weight:700;color:${CREAM};letter-spacing:-.01em;">
          <span aria-hidden="true" style="display:inline-block;width:12px;height:22px;margin-right:6px;background:${ACCENT};border-radius:3px;vertical-align:middle;"></span>Veline
        </td>
        <td align="right" style="font-family:${FUENTE};font-size:12px;line-height:16px;color:${ACCENT};">Donde cada cita encuentra su lugar</td>
      </tr></table>
    </td></tr>
    <tr><td class="pad" style="padding:32px 28px 8px;">
      <h1 class="h1" style="margin:0 0 12px;font-family:${FUENTE};font-size:24px;line-height:30px;color:${INK};font-weight:700;">${opts.heading}</h1>
      <p class="texto" style="margin:0 0 20px;font-family:${FUENTE};font-size:16px;line-height:24px;color:${BODY};">${opts.intro}</p>
      ${opts.body}
      ${opts.cta ? boton(opts.cta.label, opts.cta.url) : ''}
    </td></tr>
    <tr><td class="pad linea" style="padding:20px 28px 28px;border-top:1px solid ${LINE};">
      <p class="muted" style="margin:0;font-family:${FUENTE};font-size:13px;line-height:20px;color:${MUTED};">
        Este correo se ha enviado automáticamente desde <a href="${webUrl()}" style="color:${MUTED};text-decoration:underline;">Veline</a>. Si no esperabas recibirlo, puedes ignorarlo.
      </p>
    </td></tr>
  </table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`
}

/** Filas de detalle reutilizadas por todas las plantillas. */
function detalles(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="linea" style="border-top:1px solid ${LINE};margin-top:4px;">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td class="muted" style="padding:12px 12px 0 0;font-family:${FUENTE};font-size:14px;line-height:20px;color:${MUTED};vertical-align:top;">${esc(label)}</td>
      <td class="valor" style="padding:12px 0 0;font-family:${FUENTE};font-size:14px;line-height:20px;color:${INK};font-weight:600;text-align:right;vertical-align:top;">${esc(value)}</td>
    </tr>`,
      )
      .join('')}
  </table>`
}

/** Los extras en una sola fila: «Hidratación (+12,00 €), Uña rota ×3 (+15,00 €)».
    El precio es el de la línea entera, que es lo que se va a cobrar; la
    cantidad solo se dice cuando es más de una, para no escribir «×1» en la
    mayoría de las citas.

    Sin extras no hay fila: la mayoría no llevan, y una fila vacía haría
    pensar que falta algo. */
const filaExtras = (b: BookingMailData, idioma: Idioma): [string, string][] =>
  b.extras?.length
    ? [
        [
          'Extras',
          b.extras
            .map(
              (e) =>
                `${e.name}${e.quantity > 1 ? ` ×${e.quantity}` : ''} (+${formatPrice(
                  e.priceCents * e.quantity,
                  idioma,
                )})`,
            )
            .join(', '),
        ],
      ]
    : []

const textoDetalles = (rows: [string, string][]) => rows.map(([l, v]) => `  ${l}: ${v}`).join('\n')

/* ── 1. Confirmación al cliente ───────────────────────────────── */

export function bookingConfirmedToCustomer(b: BookingMailData): MailMessage {
  const idioma = idiomaParaCliente(b)
  const cuando = `${capitalizar(formatLongDate(b.startsAt, idioma))} a las ${hora(b.startsAt, idioma)}`
  const rows: [string, string][] = [
    ['Servicio', b.serviceName],
    ...filaExtras(b, idioma),
    ['Cuándo', cuando],
    ...((b.staffName ? [['Te atiende', b.staffName]] : []) as [string, string][]),
    ...((b.address ? [['Dónde', b.address]] : []) as [string, string][]),
    ['Código', b.code],
    ['Total', formatPrice(b.priceCents, idioma)],
  ]

  return {
    to: b.customerEmail!,
    toName: b.customerName,
    subject: `Tu cita en ${b.businessName} — ${cuando}`,
    tag: 'reserva-confirmada',
    html: layout({
      idioma,
      preheader: `${cuando} en ${b.businessName}`,
      heading: '¡Reserva confirmada!',
      intro: `Hola ${esc(b.customerName.split(' ')[0])}, te esperan en <strong class="ink" style="color:${INK};">${esc(b.businessName)}</strong>.`,
      body: detalles(rows),
      cta: { label: 'Ver o cancelar mi reserva', url: `${webUrl()}/reserva/${b.code}` },
    }),
    text: [
      `¡Reserva confirmada!`,
      ``,
      `Te esperan en ${b.businessName}.`,
      ``,
      textoDetalles(rows),
      ``,
      `Ver o cancelar tu reserva: ${webUrl()}/reserva/${b.code}`,
    ].join('\n'),
  }
}

/* ── 2. Aviso al negocio ──────────────────────────────────────── */

export function bookingCreatedToBusiness(b: BookingMailData, businessEmail: string): MailMessage {
  /* Aquí NO se usa b.idiomaCliente: este correo lo lee el negocio. Un taller
     de Madrid no debe recibir sus avisos en inglés porque el cliente reservara
     en inglés. */
  const idioma = idiomaParaNegocio()
  const cuando = `${capitalizar(formatLongDate(b.startsAt, idioma))} a las ${hora(b.startsAt, idioma)}`
  const rows: [string, string][] = [
    ['Servicio', b.serviceName],
    ...filaExtras(b, idioma),
    ['Cuándo', cuando],
    ...((b.staffName ? [['Asignada a', b.staffName]] : []) as [string, string][]),
    ['Cliente', b.customerName],
    ['Teléfono', b.customerPhone],
    ...((b.customerEmail ? [['Email', b.customerEmail]] : []) as [string, string][]),
    // Ojo con el orden: estas filas se escapan, así que el enlace de contacto
    // va aparte, más abajo.
    ['Importe', formatPrice(b.priceCents, idioma)],
    ['Código', b.code],
  ]

  return {
    to: businessEmail,
    toName: b.businessName,
    subject: `Nueva cita: ${b.serviceName} — ${cuando}`,
    tag: 'reserva-negocio',
    ...(b.customerEmail ? { replyTo: { email: b.customerEmail, name: b.customerName } } : {}),
    html: layout({
      idioma,
      preheader: `${b.customerName} ha reservado para el ${cuando}`,
      heading: 'Tienes una cita nueva',
      intro: `<strong class="ink" style="color:${INK};">${esc(b.customerName)}</strong> acaba de reservar en ${esc(b.businessName)}.`,
      body:
        detalles(rows) +
        (b.notes
          ? `<p class="nota" style="margin:20px 0 0;padding:14px 16px;background:${CREAM};border-radius:10px;font-family:${FUENTE};font-size:14px;line-height:21px;color:#4A3826;"><strong>Nota del cliente:</strong> ${esc(b.notes)}</p>`
          : '') +
        // Enlaces directos al cliente. Antes bastaba con darle a «Responder»
        // porque el correo llevaba su dirección en Reply-To; Acumbamail no
        // tiene ese campo, así que se ponen a la vista.
        `<p class="muted" style="margin:18px 0 0;font-family:${FUENTE};font-size:14px;line-height:21px;color:${MUTED};">
          ${
            b.customerEmail
              ? `Escríbele a <a href="mailto:${encodeURI(b.customerEmail)}" style="color:${BRAND};font-weight:600;">${esc(b.customerEmail)}</a> o llámale`
              : 'Llámale'
          }
          al <a href="tel:${encodeURI(b.customerPhone)}" style="color:${BRAND};font-weight:600;">${esc(b.customerPhone)}</a>.
        </p>`,
      cta: { label: 'Abrir la agenda', url: `${webUrl()}/panel/${b.businessSlug}` },
    }),
    text: [
      `Tienes una cita nueva`,
      ``,
      `${b.customerName} ha reservado en ${b.businessName}.`,
      ``,
      textoDetalles(rows),
      ...(b.notes ? ['', `Nota del cliente: ${b.notes}`] : []),
      ``,
      `Abrir la agenda: ${webUrl()}/panel/${b.businessSlug}`,
    ].join('\n'),
  }
}

/* ── 3. Cancelación ───────────────────────────────────────────── */

export function bookingCancelled(
  b: BookingMailData,
  to: { email: string; name: string },
  audience: 'cliente' | 'negocio',
  /** La explicación que el negocio escribió al cancelar, si la escribió. */
  motivo?: string | null,
): MailMessage {
  /* La única plantilla que sirve a los dos, y por eso la que más fácil se
     equivoca: el idioma sale de a quién se le escribe, no de la reserva. */
  const idioma = audience === 'cliente' ? idiomaParaCliente(b) : idiomaParaNegocio()
  const cuando = `${capitalizar(formatLongDate(b.startsAt, idioma))} a las ${hora(b.startsAt, idioma)}`
  const rows: [string, string][] = [
    ['Servicio', b.serviceName],
    ['Era el', cuando],
    ['Código', b.code],
    ...((audience === 'negocio'
      ? [
          ['Cliente', b.customerName],
          ['Teléfono', b.customerPhone],
        ]
      : []) as [string, string][]),
    ...((motivo?.trim() ? [['Motivo', motivo.trim()]] : []) as [string, string][]),
  ]

  return {
    to: to.email,
    toName: to.name,
    subject: `Cita cancelada: ${b.serviceName} — ${cuando}`,
    tag: 'reserva-cancelada',
    html: layout({
      idioma,
      preheader: `La cita del ${cuando} se ha cancelado`,
      heading: 'Cita cancelada',
      intro:
        audience === 'cliente'
          ? `Tu cita en <strong class="ink" style="color:${INK};">${esc(b.businessName)}</strong> se ha cancelado. El hueco vuelve a estar libre por si quieres otro día.`
          : `Se ha cancelado una cita en ${esc(b.businessName)}. El hueco ya vuelve a ofrecerse.`,
      body: detalles(rows),
      cta:
        audience === 'cliente'
          ? { label: 'Reservar otra hora', url: `${webUrl()}/${b.businessSlug}` }
          : { label: 'Abrir la agenda', url: `${webUrl()}/panel/${b.businessSlug}` },
    }),
    text: [
      `Cita cancelada`,
      ``,
      audience === 'cliente'
        ? `Tu cita en ${b.businessName} se ha cancelado.`
        : `Se ha cancelado una cita en ${b.businessName}.`,
      ``,
      textoDetalles(rows),
      ``,
      audience === 'cliente'
        ? `Reservar otra hora: ${webUrl()}/${b.businessSlug}`
        : `Abrir la agenda: ${webUrl()}/panel/${b.businessSlug}`,
    ].join('\n'),
  }
}

/* ── 3b. Cambio de hora ───────────────────────────────────────── */

export function bookingRescheduled(b: BookingMailData, antes: Date): MailMessage {
  const idioma = idiomaParaCliente(b)
  const cuandoAntes = `${capitalizar(formatLongDate(antes, idioma))} a las ${hora(antes, idioma)}`
  const cuandoDespues = `${capitalizar(formatLongDate(b.startsAt, idioma))} a las ${hora(b.startsAt, idioma)}`
  const rows: [string, string][] = [
    ['Servicio', b.serviceName],
    ['Antes', cuandoAntes],
    ['Ahora', cuandoDespues],
    ...((b.staffName ? [['Te atiende', b.staffName]] : []) as [string, string][]),
    ...((b.address ? [['Dónde', b.address]] : []) as [string, string][]),
    ['Código', b.code],
  ]

  return {
    to: b.customerEmail!,
    toName: b.customerName,
    subject: `Tu cita en ${b.businessName} ha cambiado de hora`,
    tag: 'reserva-movida',
    html: layout({
      idioma,
      preheader: `Ahora es el ${cuandoDespues}`,
      heading: 'Hemos cambiado tu cita',
      intro: `Hola ${esc(b.customerName.split(' ')[0])}, tu cita en <strong class="ink" style="color:${INK};">${esc(b.businessName)}</strong> ha cambiado de hora.`,
      body: detalles(rows),
      cta: { label: 'Ver o cancelar mi reserva', url: `${webUrl()}/reserva/${b.code}` },
    }),
    text: [
      `Hemos cambiado tu cita`,
      ``,
      `Tu cita en ${b.businessName} ha cambiado de hora.`,
      ``,
      textoDetalles(rows),
      ``,
      `Ver o cancelar tu reserva: ${webUrl()}/reserva/${b.code}`,
    ].join('\n'),
  }
}

/* ── 4. Recordatorio de la cita ───────────────────────────────── */

export function bookingReminderMail(b: BookingMailData): MailMessage {
  const idioma = idiomaParaCliente(b)
  const cuando = `${capitalizar(formatLongDate(b.startsAt, idioma))} a las ${hora(b.startsAt, idioma)}`
  const rows: [string, string][] = [
    ['Servicio', b.serviceName],
    ['Cuándo', cuando],
    ...((b.staffName ? [['Te atiende', b.staffName]] : []) as [string, string][]),
    ...((b.address ? [['Dónde', b.address]] : []) as [string, string][]),
    ['Código', b.code],
  ]

  return {
    to: b.customerEmail!,
    toName: b.customerName,
    subject: `Mañana tienes cita en ${b.businessName}`,
    tag: 'recordatorio',
    html: layout({
      idioma,
      preheader: `${cuando} en ${b.businessName}`,
      heading: 'Te esperamos mañana',
      intro: `Hola ${esc(b.customerName.split(' ')[0])}, un recordatorio de tu cita en <strong class="ink" style="color:${INK};">${esc(b.businessName)}</strong>.`,
      body: detalles(rows),
      cta: { label: 'Ver o cancelar mi cita', url: `${webUrl()}/reserva/${b.code}` },
    }),
    text: [
      'Te esperamos mañana',
      '',
      `Un recordatorio de tu cita en ${b.businessName}.`,
      '',
      textoDetalles(rows),
      '',
      `Ver o cancelar tu cita: ${webUrl()}/reserva/${b.code}`,
    ].join('\n'),
  }
}

/* ── 5. Pedir la reseña ───────────────────────────────────────── */

export function reviewRequestMail(
  to: { email: string; name: string },
  ctx: { businessName: string; serviceName: string; url: string; idiomaCliente: Idioma },
): MailMessage {
  const idioma = idiomaParaCliente(ctx)

  return {
    to: to.email,
    toName: to.name,
    subject: `¿Qué tal fue en ${ctx.businessName}?`,
    tag: 'resena',
    html: layout({
      idioma,
      preheader: `Cuéntanos cómo fue tu ${ctx.serviceName}`,
      heading: '¿Cómo fue?',
      intro: `Hola ${esc(to.name.split(' ')[0])}, estuviste en <strong class="ink" style="color:${INK};">${esc(ctx.businessName)}</strong>. Si te apetece, cuéntalo en medio minuto.`,
      body: `<p class="texto" style="margin:0;font-family:${FUENTE};font-size:15px;line-height:23px;color:${BODY};">
        Tu opinión es lo que ayuda a otra gente del barrio a decidir. Puedes
        puntuar sin escribir nada si vas con prisa.
      </p>`,
      cta: { label: 'Dejar mi opinión', url: ctx.url },
    }),
    text: [
      '¿Cómo fue?',
      '',
      `Estuviste en ${ctx.businessName}. Si te apetece, cuéntalo en medio minuto.`,
      '',
      ctx.url,
    ].join('\n'),
  }
}

/* ── 6. Restablecer contraseña ────────────────────────────────── */

export function passwordResetMail(to: { email: string; name: string }, url: string): MailMessage {
  return {
    to: to.email,
    toName: to.name,
    subject: 'Restablecer tu contraseña de Veline',
    tag: 'restablecer-contrasena',
    html: layout({
      // Lo lee alguien del panel, no un cliente: idioma del negocio.
      idioma: idiomaParaNegocio(),
      preheader: 'Enlace para elegir una contraseña nueva',
      heading: 'Restablecer tu contraseña',
      intro: `Hola ${esc(to.name.split(' ')[0])}, hemos recibido una petición para cambiar la contraseña de tu panel.`,
      body: `<p class="texto" style="margin:0;font-family:${FUENTE};font-size:15px;line-height:23px;color:${BODY};">
        El enlace caduca en <strong class="ink" style="color:${INK};">1 hora</strong> y solo sirve una vez.
        Si no has sido tú, puedes ignorar este correo: tu contraseña no cambia.
      </p>`,
      cta: { label: 'Elegir contraseña nueva', url },
    }),
    text: [
      'Restablecer tu contraseña',
      '',
      'Hemos recibido una petición para cambiar la contraseña de tu panel de Veline.',
      'El enlace caduca en 1 hora y solo sirve una vez.',
      '',
      url,
      '',
      'Si no has sido tú, ignora este correo: tu contraseña no cambia.',
    ].join('\n'),
  }
}

/* ── 6b. Alta de una cuenta del panel (empleado o admin) ──────────
 * El administrador no tiene que copiar la contraseña y pasársela él mismo
 * por WhatsApp o de palabra: se le manda directo a quien se ha dado de
 * alta, a su propio correo, en cuanto se crea la cuenta.
 */
export function panelUserCreatedMail(
  to: { email: string; name: string },
  ctx: { businessName: string; password: string; role: 'ADMIN' | 'EMPLEADO' },
): MailMessage {
  const idioma = idiomaParaNegocio()
  const rows: [string, string][] = [
    ['Correo', to.email],
    ['Contraseña', ctx.password],
  ]
  const paraQueHtml =
    ctx.role === 'EMPLEADO'
      ? `podrás entrar a tu agenda de <strong class="ink" style="color:${INK};">${esc(ctx.businessName)}</strong>`
      : `podrás administrar <strong class="ink" style="color:${INK};">${esc(ctx.businessName)}</strong>`
  const paraQueTexto =
    ctx.role === 'EMPLEADO'
      ? `podrás entrar a tu agenda de ${ctx.businessName}`
      : `podrás administrar ${ctx.businessName}`

  return {
    to: to.email,
    toName: to.name,
    subject: `Ya tienes acceso al panel de ${ctx.businessName}`,
    tag: 'alta-usuario-panel',
    html: layout({
      idioma,
      preheader: 'Tus datos para entrar al panel de Veline',
      heading: 'Ya tienes acceso',
      intro: `Hola ${esc(to.name.split(' ')[0])}, te han dado de alta en Veline: ${paraQueHtml}.`,
      body: `${detalles(rows)}
      <p class="texto" style="margin:14px 0 0;font-family:${FUENTE};font-size:15px;line-height:23px;color:${BODY};">
        Una vez dentro puedes cambiar la contraseña desde tu cuenta.
      </p>`,
      cta: { label: 'Entrar en Veline', url: `${webUrl()}/login` },
    }),
    text: [
      'Ya tienes acceso',
      '',
      `Te han dado de alta en Veline: ${paraQueTexto}.`,
      '',
      textoDetalles(rows),
      '',
      `Entrar en Veline: ${webUrl()}/login`,
      '',
      'Una vez dentro puedes cambiar la contraseña desde tu cuenta.',
    ].join('\n'),
  }
}

/* ── 7. Confirmar el correo al darse de alta ──────────────────── */

export function signupVerifyMail(
  to: { email: string; name: string },
  ctx: { businessName: string; url: string },
): MailMessage {
  return {
    to: to.email,
    toName: to.name,
    subject: 'Confirma tu correo para entrar en Veline',
    tag: 'alta-verificar',
    html: layout({
      /* Quien se da de alta puede haber rellenado el formulario en inglés,
         pero no guardamos su idioma en ningún sitio —el negocio no tiene
         columna para eso—, así que va en castellano. Está anotado en el
         informe de la fase 3. */
      idioma: idiomaParaNegocio(),
      preheader: `Un clic y ya puedes preparar la ficha de ${ctx.businessName}`,
      heading: 'Confirma tu correo',
      intro: `Hola ${esc(to.name.split(' ')[0])}, ya casi está. Has dado de alta <strong class="ink" style="color:${INK};">${esc(ctx.businessName)}</strong> en Veline.`,
      body: `<p class="texto" style="margin:0;font-family:${FUENTE};font-size:15px;line-height:23px;color:${BODY};">
        Confirma que esta dirección es tuya y podrás entrar al panel a poner tus
        servicios y tu horario. Es importante que sea correcta: aquí es donde te
        avisaremos de cada cita nueva.
      </p>
      <p class="texto" style="margin:14px 0 0;font-family:${FUENTE};font-size:15px;line-height:23px;color:${BODY};">
        El enlace vale <strong class="ink" style="color:${INK};">48 horas</strong>. Después
        revisaremos tu ficha antes de publicarla en el marketplace — te
        escribiremos en cuanto esté.
      </p>`,
      cta: { label: 'Confirmar mi correo', url: ctx.url },
    }),
    text: [
      'Confirma tu correo',
      '',
      `Has dado de alta ${ctx.businessName} en Veline.`,
      'Confirma que esta dirección es tuya y podrás entrar al panel:',
      '',
      ctx.url,
      '',
      'El enlace vale 48 horas. Después revisaremos tu ficha antes de publicarla.',
    ].join('\n'),
  }
}

/* ── 8. Aviso interno de alta nueva ────────────────────────────
 * A quien lleva la plataforma, no al negocio: hasta ahora un alta por su
 * cuenta no avisaba a nadie de Veline, así que se descubría mirando el panel
 * por costumbre o cuando el propio negocio escribía preguntando por qué no
 * salía en el buscador. La promesa de «lo revisamos y te escribimos» del
 * correo de arriba no se podía cumplir sin esto.
 */
export function signupNotifyTeamMail(
  to: { email: string },
  ctx: {
    businessName: string
    category: string
    street: string
    city: string
    postalCode: string
    responsable: string
    email: string
    phone?: string
    slug: string
  },
): MailMessage {
  const idioma = idiomaParaNegocio()
  const rows: [string, string][] = [
    ['Categoría', categoryLabel(ctx.category, idioma)],
    ['Dirección', `${ctx.street}, ${ctx.postalCode} ${ctx.city}`],
    ['Responsable', ctx.responsable],
    ['Email', ctx.email],
    ...((ctx.phone ? [['Teléfono', ctx.phone]] : []) as [string, string][]),
  ]

  return {
    to: to.email,
    subject: `Alta nueva por revisar: ${ctx.businessName}`,
    tag: 'alta-aviso-interno',
    html: layout({
      idioma,
      preheader: `${ctx.businessName} se ha dado de alta y espera revisión`,
      heading: 'Alta nueva por revisar',
      intro: `<strong class="ink" style="color:${INK};">${esc(ctx.businessName)}</strong> se acaba de dar de alta por su cuenta. No sale en el marketplace hasta que se revise y se apruebe.`,
      body: detalles(rows),
      cta: { label: 'Revisar en la plataforma', url: `${webUrl()}/panel/admin` },
    }),
    text: [
      'Alta nueva por revisar',
      '',
      `${ctx.businessName} se ha dado de alta por su cuenta. No sale en el marketplace hasta que se revise y se apruebe.`,
      '',
      textoDetalles(rows),
      '',
      `Revisar en la plataforma: ${webUrl()}/panel/admin`,
    ].join('\n'),
  }
}

/* ── 9. Aviso interno de local nuevo ───────────────────────────
 * Un negocio ya aprobado que abre otro local no pasa por el alta, así que
 * sin este aviso nadie en Veline se enteraba: el local nuevo se quedaba
 * esperando revisión sin que hubiera forma de verlo salvo mirar el panel.
 */
export function newLocationNotifyTeamMail(
  to: { email: string },
  ctx: {
    businessName: string
    locationName: string
    street: string
    city: string
    postalCode: string
    slug: string
  },
): MailMessage {
  const idioma = idiomaParaNegocio()
  const rows: [string, string][] = [
    ['Negocio', ctx.businessName],
    ['Local', ctx.locationName],
    ['Dirección', `${ctx.street}, ${ctx.postalCode} ${ctx.city}`],
  ]

  return {
    to: to.email,
    subject: `Local nuevo por aprobar: ${ctx.businessName} · ${ctx.locationName}`,
    tag: 'local-aviso-interno',
    html: layout({
      idioma,
      preheader: `${ctx.businessName} ha abierto un local y espera aprobación`,
      heading: 'Local nuevo por aprobar',
      intro: `<strong class="ink" style="color:${INK};">${esc(ctx.businessName)}</strong> ha abierto un local nuevo. No acepta reservas del público hasta que lo apruebes.`,
      body: detalles(rows),
      cta: { label: 'Revisar en la plataforma', url: `${webUrl()}/panel/admin` },
    }),
    text: [
      'Local nuevo por aprobar',
      '',
      `${ctx.businessName} ha abierto un local nuevo. No acepta reservas del público hasta que lo apruebes.`,
      '',
      textoDetalles(rows),
      '',
      `Revisar en la plataforma: ${webUrl()}/panel/admin`,
    ].join('\n'),
  }
}
