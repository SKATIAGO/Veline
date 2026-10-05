import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { cx } from './ui'
import { useIdioma, type Clave } from '../i18n/idioma'
import { hayCambios, siDescarta } from '../lib/cambios'

/**
 * Las partes de una sección del menú: «Horario · Cierres y vacaciones ·
 * Locales».
 *
 * El menú tenía 14 entradas, varias de ellas para cosas que se miran juntas
 * (el horario y los días cerrados estaban en dos sitios distintos, el dinero
 * en otros dos). Ahora son 9, y lo que se agrupa va en pestañas.
 *
 * Son enlaces y no pestañas de una ficha: cada parte tiene su dirección, se
 * puede guardar y el «atrás» del navegador funciona. En control segmentado,
 * como el selector de idioma, para no confundirse con las pestañas
 * subrayadas de las fichas.
 */

export type SeccionConPestanas = 'servicios' | 'horario' | 'negocio'

/** Ruta (tras /panel/:slug/) y nombre de cada parte. */
export const PESTANAS: Record<SeccionConPestanas, { ruta: string; clave: Clave }[]> = {
  servicios: [
    { ruta: 'servicios', clave: 'panel.servicios' },
    { ruta: 'servicios/extras', clave: 'comun.extras' },
  ],
  horario: [
    { ruta: 'horario', clave: 'secc.horario' },
    { ruta: 'cierres', clave: 'secc.cierres' },
    { ruta: 'locales', clave: 'panel.locales' },
  ],
  negocio: [
    { ruta: 'negocio', clave: 'secc.fichaPublica' },
    { ruta: 'negocio/fotos', clave: 'secc.fotos' },
  ],
}

export function PestanasSeccion({ seccion }: { seccion: SeccionConPestanas }) {
  const { t } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()

  return (
    <nav aria-label={t('secc.partes')} className="-mt-2 overflow-x-auto">
      <div className="inline-flex gap-0.5 rounded-full border border-line bg-cream p-1">
        {PESTANAS[seccion].map((p) => {
          const to = `/panel/${slug}/${p.ruta}`
          return (
            <NavLink
              key={p.ruta}
              to={to}
              end
              onClick={(e) => {
                // Con cambios a medias (el horario, la ficha), se pregunta antes.
                if (!hayCambios()) return
                e.preventDefault()
                siDescarta(() => navigate(to))
              }}
              className={({ isActive }) =>
                cx(
                  'inline-flex min-h-9 items-center rounded-full px-4 text-meta font-semibold whitespace-nowrap',
                  'transition-colors duration-200',
                  isActive ? 'bg-surface text-ink shadow-raised' : 'text-body-2 hover:text-ink',
                )
              }
            >
              {t(p.clave)}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
