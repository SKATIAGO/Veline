import { QueryCache, type QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'
import { aviso } from '../components/Avisos'
import { textoFuera } from '../i18n/idioma'

/**
 * Qué se hace con un fallo que ninguna pantalla ha recogido.
 *
 * Antes todo fallo de lectura acababa igual que «no hay nada»: un 403 enseñaba
 * «todavía no hay servicios» y un 429 echaba al login. Aquí se separa lo que es
 * la sesión (401), lo que es un permiso (403) y lo que es el servidor o la red.
 */

/** Un fallo que merece repetirse: límite de peticiones, servidor caído, sin red.
    El resto de 4xx no cambia por volver a preguntar. */
export function merecePenaReintentar(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true // fallo de red
  return err.status === 429 || err.status >= 500
}

export const reintentarLecturas = (intentos: number, err: unknown) =>
  intentos < 2 && merecePenaReintentar(err)

const CLAVE_SESION = ['auth', 'me'] as const

// Un mismo motivo no se avisa dos veces seguidas: una pantalla lanza varias
// lecturas a la vez y todas fallan juntas.
const ultimoAviso = new Map<string, number>()
const VENTANA_MS = 8_000

function avisarUnaVez(clave: string, texto: string) {
  const ahora = Date.now()
  if (ahora - (ultimoAviso.get(clave) ?? 0) < VENTANA_MS) return
  ultimoAviso.set(clave, ahora)
  aviso.error(texto)
}

export function crearCacheDeConsultas(obtenerCliente: () => QueryClient) {
  return new QueryCache({
    onError: (err, consulta) => {
      // Las consultas que ya tienen su propio manejo (la sesión) no se avisan.
      if (consulta.queryKey[0] === 'auth') return
      if (!(err instanceof ApiError)) {
        // Sin red. Solo se avisa si es de verdad un fallo de conexión.
        if (err instanceof TypeError) {
          avisarUnaVez('red', textoFuera('error.sinConexion'))
        }
        return
      }
      if (err.status === 401) {
        // La sesión ha caducado en mitad de una pantalla: se deja constancia y
        // el panel manda al login con la dirección de vuelta.
        const cliente = obtenerCliente()
        if (cliente.getQueryData(CLAVE_SESION)) cliente.setQueryData(CLAVE_SESION, null)
        return
      }
      if (err.status === 403) {
        avisarUnaVez('403', textoFuera('error.sinAcceso'))
      } else if (err.status === 429) {
        avisarUnaVez('429', textoFuera('error.demasiadasPeticiones'))
      } else if (err.status >= 500) {
        avisarUnaVez('5xx', textoFuera('error.servidor'))
      }
    },
  })
}
