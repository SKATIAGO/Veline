import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

// promisify pierde la sobrecarga de scrypt con opciones, así que se envuelve
// a mano con el tipo completo.
const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  )

/**
 * Contraseñas con scrypt, del propio Node. Se elige a propósito frente a
 * bcrypt/argon2: mismo nivel de protección para este caso y cero dependencias
 * nativas que compilar en la imagen Docker.
 *
 * Formato almacenado: "sal:hash" en hexadecimal. La sal es única por
 * contraseña, así que dos usuarios con la misma contraseña no comparten hash.
 */

const KEY_LENGTH = 64
/** Coste de CPU/memoria (N). 2^15 ≈ 100 ms por intento: invisible para un
 * login, prohibitivo para probar millones de contraseñas. */
const COST = 32768

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = (await scrypt(plain, salt, KEY_LENGTH, {
    N: COST,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(plain, salt, expected.length, {
    N: COST,
    maxmem: 64 * 1024 * 1024,
  })
  // Comparación en tiempo constante: una comparación normal permite deducir
  // el hash byte a byte midiendo tiempos de respuesta.
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
