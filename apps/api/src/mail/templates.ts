import { formatLongDate, formatPrice, TIMEZONE } from '@veline/shared'
import type { MailMessage } from './brevo.js'

/* Paleta de marca. En correo se escriben literales: los clientes de email no
   entienden variables CSS ni hojas externas. */
const INK = '#2E2119'
const BRAND = '#A96A3E'
const ACCENT = '#D9A441'
const CREAM = '#F2E7D6'
const LINE = '#E4D5BE'
const MUTED = '#8A7255'

const webUrl = () => (process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '')

const hora = (d: Date) =>
  d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE })

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export interface BookingMailData {
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

/** Marco común: cabecera con el logotipo, cuerpo y pie. */
function layout(opts: {
  preheader: string
  heading: string
  intro: string
  body: string
  cta?: { label: string; url: string }
}) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${CREAM};">
<span style="display:none;font-size:1px;color:${CREAM};">${opts.preheader}</span>
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
      <td style="padding:11px 0 0;font-size:13px;color:${MUTED};">${label}</td>
      <td style="padding:11px 0 0;font-size:13px;color:${INK};font-weight:600;text-align:right;">${value}</td>
    </tr>`,
      )
      .join('')}
  </table>`
}

const textoDetalles = (rows: [string, string][]) => rows.map(([l, v]) => `  ${l}: ${v}`).join('\n')

/* ── 1. Confirmación al cliente ───────────────────────────────── */

export function bookingConfirmedToCustomer(b: BookingMailData): MailMessage {
  const cuando = `${capitalizar(formatLongDate(b.startsAt))} a las ${hora(b.startsAt)}`
  const rows: [string, string][] = [
    ['Servicio', b.serviceName],
    ['Cuándo', cuando],
    ...((b.staffName ? [['Te atiende', b.staffName]] : []) as [string, string][]),
    ...((b.address ? [['Dónde', b.address]] : []) as [string, string][]),
    ['Código', b.code],
    ['Total', formatPrice(b.priceCents)],
  ]

  return {
    to: b.customerEmail!,
    toName: b.customerName,
    subject: `Tu cita en ${b.businessName} — ${cuando}`,
    tag: 'reserva-confirmada',
    html: layout({
      preheader: `${cuando} en ${b.businessName}`,
      heading: '¡Reserva confirmada!',
      intro: `Hola ${b.customerName.split(' ')[0]}, te esperan en <strong style="color:${INK};">${b.businessName}</strong>.`,
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
  const cuando = `${capitalizar(formatLongDate(b.startsAt))} a las ${hora(b.startsAt)}`
  const rows: [string, string][] = [
    ['Servicio', b.serviceName],
    ['Cuándo', cuando],
    ...((b.staffName ? [['Asignada a', b.staffName]] : []) as [string, string][]),
    ['Cliente', b.customerName],
    ['Teléfono', b.customerPhone],
    ...((b.customerEmail ? [['Email', b.customerEmail]] : []) as [string, string][]),
    ['Importe', formatPrice(b.priceCents)],
    ['Código', b.code],
  ]

  return {
    to: businessEmail,
    toName: b.businessName,
    subject: `Nueva cita: ${b.serviceName} — ${cuando}`,
    tag: 'reserva-negocio',
    ...(b.customerEmail ? { replyTo: { email: b.customerEmail, name: b.customerName } } : {}),
    html: layout({
      preheader: `${b.customerName} ha reservado para el ${cuando}`,
      heading: 'Tienes una cita nueva',
      intro: `<strong style="color:${INK};">${b.customerName}</strong> acaba de reservar en ${b.businessName}.`,
      body:
        detalles(rows) +
        (b.notes
          ? `<p style="margin:20px 0 0;padding:14px 16px;background:${CREAM};border-radius:10px;font-size:13.5px;line-height:1.6;color:#4A3826;"><strong>Nota del cliente:</strong> ${b.notes}</p>`
          : ''),
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
  const cuando = `${capitalizar(formatLongDate(b.startsAt))} a las ${hora(b.startsAt)}`
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
      preheader: `La cita del ${cuando} se ha cancelado`,
      heading: 'Cita cancelada',
      intro:
        audience === 'cliente'
          ? `Tu cita en <strong style="color:${INK};">${b.businessName}</strong> se ha cancelado. El hueco vuelve a estar libre por si quieres otro día.`
          : `Se ha cancelado una cita en ${b.businessName}. El hueco ya vuelve a ofrecerse.`,
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
  const cuando = `${capitalizar(formatLongDate(b.startsAt))} a las ${hora(b.startsAt)}`
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
      preheader: `${cuando} en ${b.businessName}`,
      heading: 'Te esperamos mañana',
      intro: `Hola ${b.customerName.split(' ')[0]}, un recordatorio de tu cita en <strong style="color:${INK};">${b.businessName}</strong>.`,
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
  ctx: { businessName: string; serviceName: string; url: string },
): MailMessage {
  return {
    to: to.email,
    toName: to.name,
    subject: `¿Qué tal fue en ${ctx.businessName}?`,
    tag: 'resena',
    html: layout({
      preheader: `Cuéntanos cómo fue tu ${ctx.serviceName}`,
      heading: '¿Cómo fue?',
      intro: `Hola ${to.name.split(' ')[0]}, estuviste en <strong style="color:${INK};">${ctx.businessName}</strong>. Si te apetece, cuéntalo en medio minuto.`,
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
      preheader: 'Enlace para elegir una contraseña nueva',
      heading: 'Restablecer tu contraseña',
      intro: `Hola ${to.name.split(' ')[0]}, hemos recibido una petición para cambiar la contraseña de tu panel.`,
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
