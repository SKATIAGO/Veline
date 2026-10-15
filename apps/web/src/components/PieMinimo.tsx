import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '@veline/shared'
import { useIdioma } from '../i18n/idioma'

/**
 * El pie de la reserva: lo imprescindible y nada más.
 *
 * Mientras alguien reserva, el pie completo (cuatro columnas de enlaces,
 * redes, eslogan) es una salida en cada paso y empuja el botón de continuar
 * hacia abajo. Aquí quedan solo la ayuda y lo legal, en una línea, a 44 px
 * de alto por enlace.
 */
export function PieMinimo() {
  const { t } = useIdioma()
  const enlace = 'inline-flex min-h-11 items-center px-2 text-meta text-subtle hover:text-ink'
  return (
    <footer className="border-t border-line">
      <nav
        aria-label={t('pieMin.label')}
        className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-x-2 px-4 py-2 sm:px-6"
      >
        <a href={`mailto:${CONTACT_EMAIL}`} className={enlace}>
          {t('pieMin.ayuda')}
        </a>
        <span aria-hidden className="text-line-strong">
          ·
        </span>
        <Link to="/privacidad" className={enlace}>
          {t('pieMin.privacidad')}
        </Link>
        <span aria-hidden className="text-line-strong">
          ·
        </span>
        <Link to="/cookies" className={enlace}>
          {t('pieMin.cookies')}
        </Link>
      </nav>
    </footer>
  )
}
