import { useEffect } from 'react'

/**
 * Cambios sin guardar en una pantalla del panel.
 *
 * Horario y «El negocio» se editan en un formulario largo que se guarda con
 * un botón. Antes, tocar otra sección en la barra de abajo tiraba lo escrito
 * sin decir nada, y en un móvil pasa sin querer: la barra está justo donde
 * apoya el pulgar.
 *
 * No se usa useBlocker de React Router porque solo existe con el enrutador de
 * datos, y la app usa BrowserRouter. Basta con un contador: la pantalla avisa
 * de que tiene cambios, y lo que vaya a tirarlos (cambiar de sección, de
 * local, salir) pasa por `siDescarta`. Cerrar o recargar la pestaña lo cubre
 * beforeunload, que es lo único que puede preguntar el navegador.
 *
 * La pregunta es la confirmación del panel (DescartarCambios), no el diálogo
 * del navegador: aquel no se puede vestir, en el móvil tapa la pantalla
 * entera y era el único sitio del panel que lo usaba.
 */
let pendientes = 0

export function useCambiosSinGuardar(hay: boolean) {
  useEffect(() => {
    if (!hay) return
    pendientes++
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => {
      pendientes--
      window.removeEventListener('beforeunload', aviso)
    }
  }, [hay])
}

export const hayCambios = () => pendientes > 0

/* La acción que espera respuesta. Una sola: no se pueden pulsar dos cosas a
   la vez con la pregunta delante. */
let enEspera: (() => void) | null = null
const oyentes = new Set<() => void>()
const emitir = () => oyentes.forEach((o) => o())

/**
 * Hace `accion` ya si no hay nada pendiente; si lo hay, pregunta antes.
 * Devuelve true si se hizo en el momento: quien llama desde un enlace lo usa
 * para saber si dejar que el enlace siga o cortarlo y esperar la respuesta.
 */
export function siDescarta(accion: () => void): boolean {
  if (!hayCambios()) {
    accion()
    return true
  }
  enEspera = accion
  emitir()
  return false
}

export const descarte = {
  suscribir: (o: () => void) => {
    oyentes.add(o)
    return () => oyentes.delete(o)
  },
  pendiente: () => enEspera,
  confirmar: () => {
    const accion = enEspera
    enEspera = null
    emitir()
    accion?.()
  },
  cancelar: () => {
    enEspera = null
    emitir()
  },
}
