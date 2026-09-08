import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui'
import { useIdioma } from '../i18n/idioma'

/**
 * El aviso de cookies.
 *
 * Informa, no pide permiso — y eso es lo correcto AHORA MISMO, no un atajo:
 * Veline solo pone una cookie, la de sesión, que hace falta para que el panel
 * funcione. Las cookies técnicas necesarias están exentas de consentimiento
 * tanto en España (LSSI, art. 22.2) como en México, así que un cartel de
 * «aceptar / rechazar» sería teatro: no habría nada que rechazar, y el botón
 * de rechazar no podría hacer nada.
 *
 * EL DÍA QUE SE AÑADA UNA COOKIE QUE NO SEA NECESARIA —analítica, un mapa
 * incrustado, un píxel de Meta— esto deja de valer y hay que convertirlo en un
 * consentimiento de verdad: rechazar tan fácil como aceptar, y sin poner nada
 * hasta que la persona diga que sí. Está anotado también en content/legal.ts,
 * donde se lleva el inventario.
 *
 * Se recuerda en el navegador de quien lo lee, no en el servidor: es una
 * preferencia de esa persona en ese dispositivo, y guardarla en el servidor
 * obligaría a identificarla, que es justo lo contrario de lo que se pretende.
 */

const CLAVE = 'veline:aviso-cookies'

export function AvisoCookies() {
  const { t } = useIdioma()

  // Arranca oculto y solo aparece si hace falta: si empezara visible, quien ya
  // lo cerró vería el cartel parpadear en cada carga.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CLAVE)) setVisible(true)
    } catch {
      // Navegación privada o almacenamiento bloqueado: no se puede recordar
      // que ya lo vio, así que mejor no enseñarlo en bucle en cada página.
    }
  }, [])

  if (!visible) return null

  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, '1')
    } catch {
      /* igual que arriba: si no se puede guardar, al menos se cierra ahora */
    }
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label={t('pie.cookies')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line-strong bg-cream/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
        <p className="flex-1 text-body leading-relaxed text-body-2">
          {t('cookies.aviso')}{' '}
          <Link to="/cookies" className="font-semibold text-brand-text hover:underline">
            {t('cookies.masDetalle')}
          </Link>
          .
        </p>
        <Button onClick={cerrar} className="shrink-0 sm:min-w-[130px]">
          {t('cookies.entendido')}
        </Button>
      </div>
    </div>
  )
}
