import { useNavigate, useParams } from 'react-router-dom'
import { Segmentado } from './Segmentado'
import { useIdioma, type Clave } from '../i18n/idioma'
import { siDescarta } from '../lib/cambios'
import { usePrecargaPanel } from '../lib/precarga'

/**
 * Las partes de una sección del menú: «Horario · Cierres y vacaciones ·
 * Locales».
 *
 * El menú tenía 14 entradas, varias de ellas para cosas que se miran juntas
 * (el horario y los días cerrados estaban en dos sitios distintos, el dinero
 * en otros dos). Ahora son 9, y lo que se agrupa va en pestañas.
 *
 * Son enlaces y no pestañas de una ficha: cada parte tiene su dirección, se
 * puede guardar y el «atrás» del navegador funciona. Van en el control
 * segmentado compartido (a ancho completo en el móvil), para no confundirse
 * con las pestañas subrayadas de las fichas.
 */

export type SeccionConPestanas = 'servicios' | 'horario' | 'negocio' | 'fichaje'

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
    { ruta: 'negocio/resenas', clave: 'ficha.resenas' },
  ],
  fichaje: [
    { ruta: 'fichaje', clave: 'fic.fichar' },
    { ruta: 'fichaje/historial', clave: 'fic.historial' },
  ],
}

export function PestanasSeccion({ seccion }: { seccion: SeccionConPestanas }) {
  const { t } = useIdioma()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const precargar = usePrecargaPanel(slug)

  return (
    <Segmentado
      label={t('secc.partes')}
      className="-mt-2 sm:max-w-md"
      opciones={PESTANAS[seccion].map((p) => ({
        id: p.ruta,
        label: t(p.clave),
        to: `/panel/${slug}/${p.ruta}`,
      }))}
      // Con cambios a medias (el horario, la ficha), se pregunta antes.
      onAntesDeNavegar={(to) => siDescarta(() => navigate(to))}
      onIntencion={(to) => precargar(to.replace(`/panel/${slug}/`, ''))}
    />
  )
}
