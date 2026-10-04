/**
 * Contraseña inicial legible por teléfono: sin caracteres que se confundan
 * (ni 0/O ni 1/l/I). Quien entra la puede cambiar desde su perfil.
 */
export function generarPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(14)))
    .map((n) => abc[n % abc.length])
    .join('')
}
