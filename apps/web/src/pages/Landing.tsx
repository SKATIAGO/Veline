import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CATEGORIES, categoryLabel, formatPrice } from '@veline/shared'
import { api } from '../lib/api'
import { Button, ButtonLink, Card, Chip, Eyebrow, Placeholder, Spinner, Stars } from '../components/ui'
import { DESTACADOS, ESLOGAN } from '../content/negocio'

const STEPS = [
  {
    title: 'Busca tu negocio',
    text: 'Por sector, nombre o ubicación — sin importar de qué tipo sea.',
  },
  {
    title: 'Elige día y hora',
    text: 'Ves los huecos disponibles en tiempo real, sin llamar.',
  },
  {
    title: 'Recibe la confirmación',
    text: 'Tu cita queda agendada al instante, para ti y para el negocio.',
  },
]

function SearchBox() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const params = new URLSearchParams()
        if (q.trim()) params.set('q', q.trim())
        if (city.trim()) params.set('donde', city.trim())
        navigate(`/buscar?${params.toString()}`)
      }}
      className="flex max-w-[520px] flex-col gap-2 rounded-xl border border-line bg-surface p-2 sm:flex-row sm:items-center"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="¿Qué buscas?"
        aria-label="Qué buscas"
        className="min-w-0 flex-1 rounded-lg px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-subtle"
      />
      <div className="hidden w-px self-stretch bg-line sm:block" />
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Tu barrio o ciudad"
        aria-label="Dónde"
        className="min-w-0 flex-1 rounded-lg px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-subtle"
      />
      <Button type="submit" size="sm" className="shrink-0">
        Buscar
      </Button>
    </form>
  )
}

export function BusinessCard({
  business,
}: {
  business: {
    slug: string
    name: string
    category: string
    rating: number
    reviewCount: number
    city: string
    fromPriceCents: number | null
  }
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <Placeholder label="Foto del negocio" className="h-[140px] rounded-none" />
      <div className="flex flex-1 flex-col p-4">
        <div className="font-semibold text-ink">{business.name}</div>
        <div className="mt-1 mb-3 text-[12.5px] font-medium text-subtle">
          {categoryLabel(business.category)} · <Stars rating={business.rating} count={business.reviewCount} /> ·{' '}
          {business.city}
        </div>
        {business.fromPriceCents !== null && (
          <div className="mb-3 text-[12.5px] text-muted">
            Desde <span className="font-semibold text-ink">{formatPrice(business.fromPriceCents)}</span>
          </div>
        )}
        <ButtonLink to={`/${business.slug}`} variant="ghost" size="sm" className="mt-auto w-full">
          Reservar
        </ButtonLink>
      </div>
    </Card>
  )
}

export function Landing() {
  const { data: businesses, isLoading } = useQuery({
    queryKey: ['businesses', 'home'],
    queryFn: () => api.listBusinesses({ limit: 6 }),
  })

  return (
    <>
      {/* HERO */}
      <section className="mx-auto flex max-w-[1440px] flex-col items-center gap-14 px-6 py-16 lg:flex-row lg:px-16 lg:py-20">
        <div className="min-w-0 flex-1">
          <p className="rise mb-5 text-[13px] font-semibold tracking-[0.08em] text-brand uppercase">
            {ESLOGAN}
          </p>
          <h1
            className="rise text-[34px] leading-[1.12] font-semibold text-ink sm:text-[44px] lg:text-[52px]"
            style={{ animationDelay: '80ms' }}
          >
            Encuentra y reserva en cualquier negocio de tu zona
          </h1>
          <p
            className="rise mt-5 mb-8 max-w-[460px] text-[17px] leading-relaxed text-body"
            style={{ animationDelay: '160ms' }}
          >
            Talleres, academias, veterinarias, tiendas y más — todos en un solo sitio, sin llamadas
            ni WhatsApp perdidos.
          </p>
          <div className="rise" style={{ animationDelay: '240ms' }}>
            <SearchBox />
            <p className="mt-4 text-[13px] font-medium text-muted">
              Reservar no cuesta nada · Confirmación al instante
            </p>
          </div>
        </div>
        <Placeholder
          label="Vista previa de la app — mapa de negocios cercanos"
          className="rise h-[280px] w-full flex-1 rounded-2xl lg:h-[420px]"
        />
      </section>

      {/* CATEGORÍAS */}
      <section id="categorias" className="mx-auto max-w-[1440px] scroll-mt-24 px-6 pb-20 lg:px-16">
        <Eyebrow>Cualquier sector, un solo sitio</Eyebrow>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} to={`/buscar?categoria=${c.slug}`}>
              <Chip>{c.label}</Chip>
            </Link>
          ))}
        </div>
      </section>

      {/* MARKETPLACE */}
      <section className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-16">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-[26px] font-semibold text-ink sm:text-[30px]">Negocios cerca de ti</h2>
          <Link to="/buscar" className="text-sm font-semibold text-brand hover:text-ink">
            Ver todos →
          </Link>
        </div>
        {isLoading ? (
          <Spinner label="Buscando negocios…" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {businesses?.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        )}
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="mx-auto max-w-[1440px] scroll-mt-24 px-6 pb-24 lg:px-16">
        <h2 className="mb-10 text-center text-[26px] font-semibold text-ink sm:text-[30px]">
          Cómo funciona
        </h2>
        <div className="flex flex-col gap-10 sm:flex-row">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex-1 text-center">
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-ink font-semibold text-cream">
                {i + 1}
              </div>
              <div className="mb-2 font-semibold text-ink">{step.title}</div>
              <p className="mx-auto max-w-[260px] text-sm leading-relaxed text-muted">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PARA NEGOCIOS */}
      <section
        id="negocios"
        className="scroll-mt-24 bg-ink"
      >
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-14 px-6 py-20 lg:flex-row lg:px-16">
          <div className="flex-1">
            <Eyebrow tone="accent">Para negocios</Eyebrow>
            <h2 className="mb-5 text-[28px] leading-tight font-semibold text-ondark sm:text-[36px]">
              Tu negocio, reservable en minutos
            </h2>
            <ul className="mb-8 flex flex-col gap-3.5">
              {[
                'Sin conocimientos técnicos ni web propia',
                'Sin comisiones ocultas',
                'Tus clientes reservan solos, tú atiendes',
              ].map((item) => (
                <li key={item} className="flex items-baseline gap-2.5 text-[15.5px] text-ondark-muted-2">
                  <span className="text-accent">—</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/negocios" variant="accent">
                Añadir mi negocio
              </ButtonLink>
              <ButtonLink
                to="/negocios"
                variant="ghost"
                className="border-ondark-muted text-ondark hover:bg-ondark hover:text-ink"
              >
                Ver todo lo que incluye
              </ButtonLink>
            </div>
          </div>
          <div className="ph h-[240px] w-full flex-1 rounded-2xl border-line-dark bg-ink-2 text-ph-border lg:h-[340px]">
            Vista previa del panel del negocio
          </div>
        </div>
      </section>

      {/* DESTACADOS DEL NEGOCIO */}
      <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
        <Eyebrow>Todo lo que tu negocio necesita</Eyebrow>
        <h2 className="mb-10 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[30px]">
          Las citas dejan de ser un problema el primer día
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DESTACADOS.map((d) => (
            <Card key={d.title} className="p-6">
              <div className="mb-2 font-display text-lg font-semibold text-ink">{d.title}</div>
              <p className="text-sm leading-relaxed text-muted">{d.text}</p>
            </Card>
          ))}
          <Card className="flex flex-col justify-center border-dashed bg-transparent p-6">
            <div className="mb-2 font-display text-lg font-semibold text-ink">Y lo que le falte</div>
            <p className="mb-4 text-sm leading-relaxed text-muted">
              Web propia, app del local, facturación o gestión administrativa.
            </p>
            <Link to="/negocios" className="text-sm font-semibold text-brand hover:text-ink">
              Ver servicios para empresas →
            </Link>
          </Card>
        </div>
      </section>
    </>
  )
}
