import { MAX_FOTOS_POR_ITEM } from '@veline/shared'
import { GestorFotos } from './GestorFotos'
import { useIdioma } from '../i18n/idioma'

/**
 * Las fotos de un servicio o de un extra, dentro de su formulario.
 *
 * Es el gestor de fotos compartido con la cabecera del campo: cada foto sube
 * sola y devuelve su dirección; guardar el formulario es lo que las asocia.
 */
export function CampoFotos({
  slug,
  fotos,
  onChange,
  max = MAX_FOTOS_POR_ITEM,
}: {
  slug: string
  fotos: string[]
  onChange: (fotos: string[]) => void
  max?: number
}) {
  const { t } = useIdioma()
  return (
    <GestorFotos
      slug={slug}
      fotos={fotos}
      onChange={onChange}
      max={max}
      titulo={`${t('fotos.titulo')} · ${t('comun.opcional')}`}
    />
  )
}
