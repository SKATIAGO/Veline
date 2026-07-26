import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * React Router no toca el scroll al cambiar de ruta: sin esto entras a
 * /precios a la altura a la que estabas en la página anterior.
 *
 *  - Cambio de página → arriba del todo, sin animación.
 *  - Enlace con ancla (/#servicios) → hasta la sección, con animación. Se
 *    espera un frame porque al venir de otra página la sección todavía no
 *    está montada.
 *  - Atrás/adelante del navegador → no se toca, para no perder el sitio al
 *    volver de una ficha al listado.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    // El primer render también cuenta como POP, así que el ancla se atiende
    // igualmente: si alguien abre /#servicios directamente, el navegador no
    // puede saltar solo porque la sección todavía no existe en el HTML.
    if (navigationType === 'POP' && !hash) return

    if (hash) {
      // Intento inmediato: al ejecutarse el efecto la sección ya está en el DOM.
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' })
        return
      }
      // Si aún no está (la página de destino todavía se está montando), se
      // reintenta durante medio segundo largo y se deja de insistir.
      let frames = 0
      let raf = 0
      const retry = () => {
        const el = document.getElementById(hash.slice(1))
        if (el) el.scrollIntoView({ behavior: 'smooth' })
        else if (frames++ < 30) raf = requestAnimationFrame(retry)
      }
      raf = requestAnimationFrame(retry)
      return () => cancelAnimationFrame(raf)
    }

    // 'instant' anula el scroll-behavior: smooth del CSS, que en un cambio de
    // página se vería como un barrido largo hasta arriba.
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash, navigationType])

  return null
}
