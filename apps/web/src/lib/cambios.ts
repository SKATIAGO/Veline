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
 * de que tiene cambios, y los enlaces del marco del panel preguntan antes de
 * irse. Cerrar o recargar la pestaña lo cubre beforeunload.
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

/** true si no hay nada pendiente o si quien navega acepta perderlo. */
export function puedeSalir(pregunta: string): boolean {
  return pendientes === 0 || window.confirm(pregunta)
}
