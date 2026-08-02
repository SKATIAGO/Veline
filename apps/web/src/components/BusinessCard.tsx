import { categoryLabel, formatPrice } from '@veline/shared'
import { ButtonLink, Card, Stars } from './ui'
import { Photo } from './Photo'

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
  return (
    <Card className="lift group flex h-full flex-col overflow-hidden">
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
        <div className="mt-1 mb-3 text-[12.5px] font-medium text-subtle">
          {categoryLabel(business.category)} ·{' '}
          <Stars rating={business.rating} count={business.reviewCount} /> · {business.city}
        </div>
        {business.fromPriceCents !== null && (
          <div className="mb-3 text-[12.5px] text-muted">
            Desde{' '}
            <span className="font-semibold text-ink">{formatPrice(business.fromPriceCents)}</span>
          </div>
        )}
        <ButtonLink to={`/${business.slug}`} variant="ghost" size="sm" className="mt-auto w-full">
          Reservar
        </ButtonLink>
      </div>
    </Card>
  )
}
