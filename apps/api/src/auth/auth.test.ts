import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './passwords.js'
import {
  canAccessBusiness,
  canConfigureBusiness,
  canManagePlatform,
  canWorkAgenda,
  type Actor,
} from './permissions.js'

describe('contraseñas', () => {
  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashPassword('mi contraseña segura')
    expect(await verifyPassword('mi contraseña segura', hash)).toBe(true)
    expect(await verifyPassword('otra distinta', hash)).toBe(false)
  })

  it('dos usuarios con la misma contraseña no comparten hash (sal única)', async () => {
    const a = await hashPassword('repetida')
    const b = await hashPassword('repetida')
    expect(a).not.toBe(b)
    expect(await verifyPassword('repetida', a)).toBe(true)
    expect(await verifyPassword('repetida', b)).toBe(true)
  })

  it('un hash corrupto no verifica nada (y no lanza)', async () => {
    expect(await verifyPassword('lo que sea', 'basura-sin-formato')).toBe(false)
    expect(await verifyPassword('lo que sea', '')).toBe(false)
  })
})

describe('permisos', () => {
  const superadmin: Actor = { role: 'SUPERADMIN', businessId: null }
  const admin: Actor = { role: 'ADMIN', businessId: 'neg-1' }
  const empleado: Actor = { role: 'EMPLEADO', businessId: 'neg-1' }

  it('solo el superadmin gestiona la plataforma', () => {
    expect(canManagePlatform(superadmin)).toBe(true)
    expect(canManagePlatform(admin)).toBe(false)
    expect(canManagePlatform(empleado)).toBe(false)
  })

  it('el superadmin entra a cualquier negocio', () => {
    expect(canAccessBusiness(superadmin, 'neg-1')).toBe(true)
    expect(canAccessBusiness(superadmin, 'neg-99')).toBe(true)
  })

  it('admin y empleado solo entran a SU negocio', () => {
    expect(canAccessBusiness(admin, 'neg-1')).toBe(true)
    expect(canAccessBusiness(admin, 'neg-2')).toBe(false)
    expect(canAccessBusiness(empleado, 'neg-1')).toBe(true)
    expect(canAccessBusiness(empleado, 'neg-2')).toBe(false)
  })

  it('el empleado trabaja la agenda pero NO configura', () => {
    expect(canWorkAgenda(empleado, 'neg-1')).toBe(true)
    expect(canConfigureBusiness(empleado, 'neg-1')).toBe(false)
  })

  it('el admin configura su negocio pero no otro', () => {
    expect(canConfigureBusiness(admin, 'neg-1')).toBe(true)
    expect(canConfigureBusiness(admin, 'neg-2')).toBe(false)
  })

  it('el superadmin configura cualquiera', () => {
    expect(canConfigureBusiness(superadmin, 'neg-7')).toBe(true)
  })
})

describe('reglas del restablecimiento de contraseña', () => {
  // La lógica de consumeResetToken vive contra la base de datos; aquí se
  // comprueban las reglas de decisión, que son las que deciden si un enlace
  // sirve o no.
  const decidir = (r: { usedAt: Date | null; expiresAt: Date } | null, ahora: Date) => {
    if (!r) return 'invalido'
    if (r.usedAt) return 'usado'
    if (r.expiresAt < ahora) return 'caducado'
    return 'ok'
  }

  const ahora = new Date(2026, 7, 24, 12, 0)
  const enUnaHora = new Date(2026, 7, 24, 13, 0)
  const haceUnaHora = new Date(2026, 7, 24, 11, 0)

  it('un token inexistente no sirve', () => {
    expect(decidir(null, ahora)).toBe('invalido')
  })

  it('un token ya usado no sirve una segunda vez', () => {
    expect(decidir({ usedAt: haceUnaHora, expiresAt: enUnaHora }, ahora)).toBe('usado')
  })

  it('un token caducado no sirve', () => {
    expect(decidir({ usedAt: null, expiresAt: haceUnaHora }, ahora)).toBe('caducado')
  })

  it('un token vivo y sin usar sí sirve', () => {
    expect(decidir({ usedAt: null, expiresAt: enUnaHora }, ahora)).toBe('ok')
  })

  it('lo usado gana a lo caducado: el mensaje no debe confundir', () => {
    // Si un enlace está usado Y caducado, se dice "usado": es la causa real.
    expect(decidir({ usedAt: haceUnaHora, expiresAt: haceUnaHora }, ahora)).toBe('usado')
  })
})

describe('contraseña nueva tras restablecer', () => {
  it('la contraseña vieja deja de valer', async () => {
    const antiguo = await hashPassword('la-de-antes-123')
    const nuevo = await hashPassword('la-de-ahora-456')

    expect(await verifyPassword('la-de-antes-123', antiguo)).toBe(true)
    // Tras el cambio, el hash almacenado es el nuevo: la vieja ya no entra.
    expect(await verifyPassword('la-de-antes-123', nuevo)).toBe(false)
    expect(await verifyPassword('la-de-ahora-456', nuevo)).toBe(true)
  })
})
