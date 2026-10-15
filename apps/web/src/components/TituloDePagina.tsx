import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useIdioma } from '../i18n/idioma'

/**
 * El título de la pestaña sale del <h1> de cada pantalla.
 *
 * Todas las pantallas se llamaban igual («Veline — Gestiona tu negocio…»): el
 * lector de pantalla no anunciaba dónde se estaba, el historial y las pestañas
 * eran una columna de títulos idénticos, y un enlace compartido a la ficha de
 * un negocio no decía de cuál. Escribirlo pantalla a pantalla es olvidarse de
 * alguna, y el <h1> ya dice exactamente eso, en el idioma activo y con el
 * nombre del negocio cuando toca.
 *
 * Se vigila el DOM porque el <h1> aparece cuando llegan los datos, no al
 * cambiar de ruta. La portada se queda con el título de la marca.
 */
const MAX = 60

export function TituloDePagina() {
  const { t } = useIdioma()
  const { pathname } = useLocation()

  useEffect(() => {
    const marca = t('meta.titulo')
    const raiz = document.getElementById('root')
    if (!raiz) return

    const poner = () => {
      const h1 = document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()
      const nombre = h1 && h1.length > MAX ? `${h1.slice(0, MAX - 1)}…` : h1
      const titulo = pathname === '/' || !nombre ? marca : `${nombre} · Veline`
      if (document.title !== titulo) document.title = titulo
    }

    poner()
    const observador = new MutationObserver(poner)
    observador.observe(raiz, { childList: true, subtree: true, characterData: true })
    return () => observador.disconnect()
  }, [t, pathname])

  return null
}
