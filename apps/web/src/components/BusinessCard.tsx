import { Link } from 'react-router-dom'
import { categoryLabel, formatPrice } from '@veline/shared'
import { Card, Stars } from './ui'
import { Photo } from './Photo'
import { useIdioma } from '../i18n/idioma'

export interface BusinessCardData {
  slug: string
  name: string
  category: string
  rating: number
  reviewCount: number
  city: string
  photo: string | null
  fromPriceCents: number | null
}

export function BusinessCard({ business }: { business: BusinessCardData }) {
  const { t, idioma } = useIdioma()

  return (
    /* Toda la tarjeta lleva a la ficha: el enlace estirado la cubre entera y
       el foco con teclado dibuja el aro en la tarjeta. «Reservar» se queda
       como acción visible, pero ya no es la única zona que responde. */
    <Card className="lift group relative flex h-full flex-col overflow-hidden focus-within:ring-2 focus-within:ring-brand/50">
      <div className="h-[140px] shrink-0 overflow-hidden">
        <Photo
          src={business.photo}
          alt={business.name}
          width={640}
          height={360}
          className="h-full transition-transform duration-[600ms] group-hover:scale-[1.06]"
        />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="font-semibold text-ink transition-colors duration-300 group-hover:text-brand">
          {business.name}
        </div>
        <div className="mt-1 mb-3 text-meta font-medium text-subtle">
          {categoryLabel(business.category, idioma)} ·{' '}
          <Stars rating={business.rating} count={business.reviewCount} /> · {business.city}
        </div>
        {business.fromPriceCents !== null && (
          <div className="mb-3 text-meta text-muted">
            {t('comun.desde')}{' '}
            <span className="font-semibold text-ink">
              {formatPrice(business.fromPriceCents, idioma)}
            </span>
          </div>
        )}
        <Link
          to={`/${business.slug}`}
          aria-label={business.name}
          className="absolute inset-0 rounded-xl outline-none after:absolute after:inset-0"
        />
        {/* Parece el botón de antes, pero el que responde es el enlace que cubre
            la tarjeta: así no hay dos destinos iguales en el orden de tabulación. */}
        <span
          aria-hidden
          className="pointer-events-none relative mt-auto inline-flex min-h-9 w-full items-center justify-center rounded-full border border-line bg-surface text-meta font-semibold text-ink transition-colors duration-200 group-hover:border-line-strong max-sm:min-h-11"
        >
          {t('ficha.reservar')}
        </span>
      </div>
    </Card>
  )
}
