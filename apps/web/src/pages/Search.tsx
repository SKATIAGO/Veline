import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CATEGORIES } from '@veline/shared'
import { api } from '../lib/api'
import { Button, Card, Chip, EmptyState, Skeleton } from '../components/ui'
import { BusinessCard } from '../components/BusinessCard'
import { Reveal } from '../components/Reveal'

/** Misma silueta que una tarjeta real, para que la carga no dé un salto. */
function CardSkeleton() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* Sin radio propio: son las esquinas de la tarjeta las que lo recortan,
          igual que con una foto de verdad. Si el bloque trajera su propio
          radio, asomaría una esquina redondeada de más justo donde la foto
          termina y empieza el texto. */}
      <div className="h-[140px] shrink-0 animate-pulse bg-line/60" />
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-auto h-9" />
      </div>
    </Card>
  )
}

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const city = params.get('donde') ?? ''
  const category = params.get('categoria') ?? ''

  const [draftQ, setDraftQ] = useState(q)
  const [draftCity, setDraftCity] = useState(city)

  const { data, isLoading } = useQuery({
    queryKey: ['businesses', { q, city, category }],
    queryFn: () => api.listBusinesses({ q, city, category, limit: 40 }),
  })

  const setCategory = (slug: string) => {
    const next = new URLSearchParams(params)
    if (slug === category) next.delete('categoria')
    else next.set('categoria', slug)
    setParams(next)
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-10 lg:px-16">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const next = new URLSearchParams(params)
          if (draftQ.trim()) next.set('q', draftQ.trim())
          else next.delete('q')
          if (draftCity.trim()) next.set('donde', draftCity.trim())
          else next.delete('donde')
          setParams(next)
        }}
        className="flex max-w-[640px] flex-col gap-2 rounded-xl border border-line bg-surface p-2 transition-shadow duration-300 focus-within:shadow-[0_8px_24px_rgba(46,33,25,.08)] sm:flex-row sm:items-center"
      >
        <input
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          placeholder="¿Qué buscas?"
          aria-label="Qué buscas"
          className="min-w-0 flex-1 rounded-lg px-3.5 py-2.5 text-sm outline-none placeholder:text-subtle"
        />
        <div className="hidden w-px self-stretch bg-line sm:block" />
        <input
          value={draftCity}
          onChange={(e) => setDraftCity(e.target.value)}
          placeholder="Tu barrio o ciudad"
          aria-label="Dónde"
          className="min-w-0 flex-1 rounded-lg px-3.5 py-2.5 text-sm outline-none placeholder:text-subtle"
        />
        <Button type="submit" size="sm" className="shrink-0">
          Buscar
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setCategory(c.slug)}
            className="transition-transform duration-150 active:scale-95"
          >
            <Chip active={c.slug === category}>{c.label}</Chip>
          </button>
        ))}
      </div>

      <h1 className="mt-10 mb-6 text-[26px] font-semibold text-ink">
        {isLoading
          ? 'Buscando…'
          : `${data?.length ?? 0} ${data?.length === 1 ? 'negocio' : 'negocios'}`}
        {q && <span className="text-subtle"> para “{q}”</span>}
      </h1>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((b, i) => (
            <Reveal key={b.id} delay={Math.min(i, 8) * 60} variant="up">
              <BusinessCard business={b} />
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No hemos encontrado nada por aquí"
          hint="Prueba con otro sector o quita alguno de los filtros."
        />
      )}

      <p className="mt-10 text-body text-muted">
        ¿Tu negocio no está?{' '}
        <Link
          to="/precios"
          className="inline-flex min-h-10 items-center px-1 font-semibold text-brand-text hover:text-ink"
        >
          Añádelo gratis
        </Link>
        .
      </p>
    </div>
  )
}
