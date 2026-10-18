import { use, type ComponentType } from 'react'

/**
 * Una pantalla cuyo código se baja al entrar en ella (o antes, si se precarga).
 *
 * Es lo que hacía React.lazy, con una diferencia que se nota: React.lazy
 * suspende SIEMPRE la primera vez que pinta, aunque el código ya esté
 * descargado, así que cada sección del panel pasaba un instante por el
 * esqueleto genérico antes de pintarse. Aquí, si el código ya ha llegado
 * (precargado al pasar el ratón por el menú, o en segundo plano), la pantalla
 * se pinta directamente. Si no, suspende como antes.
 *
 * Tras un despliegue, una pestaña abierta puede pedir un paquete que ya no
 * existe: se recarga una vez para coger los nuevos.
 */

type Cargador = () => Promise<void>
const registro = new Map<string, Cargador>()

const CLAVE_RECARGA = 'veline:recarga-paquete'

/* Las pantallas de ruta no reciben props: se pintan desde <Route element>. */
export function perezoso<K extends string>(carga: () => Promise<Record<K, unknown>>, nombre: K) {
  let Componente: ComponentType | null = null
  let promesa: Promise<void> | null = null

  const cargar: Cargador = () =>
    (promesa ??= carga()
      .then((m) => {
        Componente = m[nombre] as ComponentType
        try {
          sessionStorage.removeItem(CLAVE_RECARGA)
        } catch {
          /* da igual */
        }
      })
      .catch((err) => {
        try {
          if (!sessionStorage.getItem(CLAVE_RECARGA)) {
            sessionStorage.setItem(CLAVE_RECARGA, '1')
            window.location.reload()
            return new Promise<never>(() => {})
          }
        } catch {
          /* sin almacenamiento: no se recarga, se propaga */
        }
        promesa = null
        throw err
      }))

  registro.set(nombre, cargar)

  function Perezoso() {
    if (!Componente) use(cargar())
    const C = Componente!
    return <C />
  }
  Perezoso.displayName = `Perezoso(${nombre})`
  return Perezoso
}

/** Baja el código de esas pantallas (por su nombre de componente) sin pintarlas. */
export function precargarPantallas(nombres: string[]) {
  for (const n of nombres)
    void registro
      .get(n)?.()
      .catch(() => {})
}
