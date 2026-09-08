import { createHash, randomBytes } from 'node:crypto'
import { PRUEBA_DIAS_DEFECTO } from '@veline/shared'
import { prisma } from '../prisma.js'
import { slugLibre } from '../slug.js'
import { hashPassword } from './passwords.js'

/**
 * Alta de un negocio por su cuenta, desde la web.
 *
 * Dos puertas, y cada una responde a un problema distinto:
 *
 *  - **Verificar el correo.** A esa dirección le llegan los avisos de cita
 *    nueva. Si está mal escrita el negocio no se entera de sus reservas y no
 *    sabe por qué, así que hasta confirmarla no se entra al panel.
 *  - **Aprobar el negocio.** El marketplace es la cara pública de Veline;
 *    sin revisión, cualquiera publicaría ahí un negocio inventado. Hasta que
 *    alguien lo mira, la ficha no existe de cara al público — aunque su dueño
 *    ya puede entrar y dejarla preparada.
 *
 * El alta que hacemos nosotros desde el panel no pasa por ninguna de las dos:
 * darla de alta a mano ES la revisión.
 */

const VERIFICACION_HORAS = 48

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export interface AltaInput {
  negocio: string
  categoria: string
  email: string
  telefono?: string
  calle: string
  ciudad: string
  codigoPostal: string
  responsable: string
  password: string
}

export type AltaResultado =
  | { ok: true; token: string; businessId: string; slug: string; userId: string }
  | { ok: false; motivo: 'email-ocupado' | 'nombre-invalido' }

/**
 * Crea negocio, local, cuenta de administrador y token de verificación.
 *
 * Todo en una transacción: media alta —un negocio sin dueño, o un dueño sin
 * negocio— dejaría basura que nadie sabría interpretar después.
 */
export async function crearAlta(d: AltaInput): Promise<AltaResultado> {
  const email = d.email.trim().toLowerCase()

  const ocupado = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (ocupado) return { ok: false, motivo: 'email-ocupado' }

  const slug = await slugLibre(d.negocio)
  if (!slug) return { ok: false, motivo: 'nombre-invalido' }

  const passwordHash = await hashPassword(d.password)
  const token = randomBytes(32).toString('base64url')

  const business = await prisma.business.create({
    data: {
      slug,
      name: d.negocio.trim(),
      category: d.categoria,
      email,
      phone: d.telefono?.trim() || null,
      // La prueba empieza a contar ya, igual que en el alta del panel.
      trialEndsAt: new Date(Date.now() + PRUEBA_DIAS_DEFECTO * 86_400_000),
      // Sin aprobar: no sale en el marketplace hasta que alguien lo mire.
      approvedAt: null,
      locations: {
        create: {
          street: d.calle.trim(),
          city: d.ciudad.trim(),
          postalCode: d.codigoPostal.trim(),
        },
      },
      users: {
        create: {
          email,
          name: d.responsable.trim(),
          passwordHash,
          role: 'ADMIN',
          // Sin verificar: no entra hasta pinchar el enlace del correo.
          emailVerifiedAt: null,
          emailVerifications: {
            create: {
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + VERIFICACION_HORAS * 60 * 60 * 1000),
            },
          },
        },
      },
    },
    include: { users: { select: { id: true } } },
  })

  return { ok: true, token, businessId: business.id, slug, userId: business.users[0].id }
}

export type VerificacionResultado =
  | { ok: true; userId: string; email: string; name: string; slug: string | null }
  | { ok: false; motivo: 'invalido' | 'caducado' | 'usado' }

/** Confirma el correo con el token del enlace. Un enlace, una vez. */
export async function consumirVerificacion(token: string): Promise<VerificacionResultado> {
  const fila = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { email: true, name: true, business: { select: { slug: true } } } },
    },
  })

  if (!fila) return { ok: false, motivo: 'invalido' }
  if (fila.usedAt) return { ok: false, motivo: 'usado' }
  if (fila.expiresAt < new Date()) return { ok: false, motivo: 'caducado' }

  await prisma.$transaction([
    prisma.user.update({ where: { id: fila.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerification.update({ where: { id: fila.id }, data: { usedAt: new Date() } }),
  ])

  return {
    ok: true,
    userId: fila.userId,
    email: fila.user.email,
    name: fila.user.name,
    slug: fila.user.business?.slug ?? null,
  }
}
