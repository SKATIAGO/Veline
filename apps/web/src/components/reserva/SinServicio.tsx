import { ButtonLink, EmptyState } from '../ui'
import { useIdioma } from '../../i18n/idioma'

/**
 * Se llegó a un paso de la reserva sin servicio (un enlace a medias, una URL
 * editada). Antes se cogía el primer servicio del negocio sin decir nada; una
 * reserva sin servicio elegido a propósito no vale, así que se dice y se
 * vuelve a la ficha.
 */
export function SinServicio({ slug }: { slug: string }) {
  const { t } = useIdioma()
  return (
    <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
      <EmptyState
        title={t('reserva.sinServicio')}
        hint={t('reserva.sinServicioPista')}
        action={<ButtonLink to={`/${slug}`}>{t('reserva.irAFicha')}</ButtonLink>}
      />
    </div>
  )
}
