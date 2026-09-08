import { formatLongDate, formatPrice, TIMEZONE, type Idioma } from '@veline/shared'
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
   entienden variables CSS ni hojas externas. */
const INK = '#2E2119'
const BRAND = '#A96A3E'
const ACCENT = '#D9A441'
const CREAM = '#F2E7D6'
const LINE = '#E4D5BE'
const MUTED = '#8A7255'

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

/** Marco común: cabecera con el logotipo, cuerpo y pie. */
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
  return `<!doctype html>
<html lang="${opts.idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${CREAM};">
<span style="display:none;font-size:1px;color:${CREAM};">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;font-family:'Public Sans',Helvetica,Arial,sans-serif;">
    <tr><td style="background:${INK};padding:22px 28px;">
      <span style="font-size:20px;font-weight:600;color:${CREAM};letter-spacing:-.01em;">Veline</span>
      <span style="font-size:12px;color:${ACCENT};padding-left:10px;">Donde cada cita encuentra su lugar</span>
    </td></tr>
    <tr><td style="padding:32px 28px 8px;">
      <h1 style="margin:0 0 12px;font-size:23px;line-height:1.25;color:${INK};font-weight:600;">${opts.heading}</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#5C4A34;">${opts.intro}</p>
      ${opts.body}
      ${
        opts.cta
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;"><tr><td style="background:${BRAND};border-radius:8px;">
              <a href="${opts.cta.url}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${opts.cta.label}</a>
            </td></tr></table>`
          : ''
      }
    </td></tr>
    <tr><td style="padding:20px 28px 28px;border-top:1px solid ${LINE};">
      <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
        Este correo se ha enviado automáticamente desde Veline. Si no esperabas recibirlo, puedes ignorarlo.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}

/** Filas de detalle reutilizadas por todas las plantillas. */
function detalles(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};margin-top:4px;">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td style="padding:11px 0 0;font-size:13px;color:${MUTED};">${esc(label)}</td>
      <td style="padding:11px 0 0;font-size:13px;color:${INK};font-weight:600;text-align:right;">${esc(value)}</td>
    </tr>`,
      )
      .join('')}
  </table>`
}

const textoDetalles = (rows: [string, string][]) => rows.map(([l, v]) => `  ${l}: ${v}`).join('\n')

/* ── 1. Confirmación al cliente ───────────────────────────────── */

export function bookingConfirmedToCustomer(b: BookingMailData): MailMessage {
  const idioma = idiomaParaCliente(b)
  const cuando = `${capitalizar(formatLongDate(b.startsAt, idioma))} a las ${hora(b.startsAt, idioma)}`
  const rows: [string, string][] = [
    ['Servicio', b.serviceName],
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
      intro: `Hola ${esc(b.customerName.split(' ')[0])}, te esperan en <strong style="color:${INK};">${esc(b.businessName)}</strong>.`,
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
      intro: `<strong style="color:${INK};">${esc(b.customerName)}</strong> acaba de reservar en ${esc(b.businessName)}.`,
      body:
        detalles(rows) +
        (b.notes
          ? `<p style="margin:20px 0 0;padding:14px 16px;background:${CREAM};border-radius:10px;font-size:13.5px;line-height:1.6;color:#4A3826;"><strong>Nota del cliente:</strong> ${esc(b.notes)}</p>`
          : '') +
        // Enlaces directos al cliente. Antes bastaba con darle a «Responder»
        // porque el correo llevaba su dirección en Reply-To; Acumbamail no
        // tiene ese campo, así que se ponen a la vista.
        `<p style="margin:18px 0 0;font-size:13px;color:${MUTED};">
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
          ? `Tu cita en <strong style="color:${INK};">${esc(b.businessName)}</strong> se ha cancelado. El hueco vuelve a estar libre por si quieres otro día.`
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
      intro: `Hola ${esc(b.customerName.split(' ')[0])}, un recordatorio de tu cita en <strong style="color:${INK};">${esc(b.businessName)}</strong>.`,
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
      intro: `Hola ${esc(to.name.split(' ')[0])}, estuviste en <strong style="color:${INK};">${esc(ctx.businessName)}</strong>. Si te apetece, cuéntalo en medio minuto.`,
      body: `<p style="margin:0;font-size:14px;line-height:1.6;color:#5C4A34;">
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
      body: `<p style="margin:0;font-size:14px;line-height:1.6;color:#5C4A34;">
        El enlace caduca en <strong style="color:${INK};">1 hora</strong> y solo sirve una vez.
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
      intro: `Hola ${esc(to.name.split(' ')[0])}, ya casi está. Has dado de alta <strong style="color:${INK};">${esc(ctx.businessName)}</strong> en Veline.`,
      body: `<p style="margin:0;font-size:14px;line-height:1.6;color:#5C4A34;">
        Confirma que esta dirección es tuya y podrás entrar al panel a poner tus
        servicios y tu horario. Es importante que sea correcta: aquí es donde te
        avisaremos de cada cita nueva.
      </p>
      <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#5C4A34;">
        El enlace vale <strong style="color:${INK};">48 horas</strong>. Después
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
