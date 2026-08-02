import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ButtonLink, Card, Eyebrow, Spinner } from '../components/ui'
import { BusinessCard } from '../components/BusinessCard'
import {
  DESTACADOS,
  ESLOGAN,
  ESLOGAN_NEGOCIO,
  SERVICIOS_EMPRESA,
} from '../content/negocio'
import { PRUEBA_DIAS } from '../content/precios'

/**
 * Home orientada al negocio. El marketplace dejó de ser la portada: aparece
 * como argumento de venta ("así te ven tus clientes") y vive en /buscar.
 */

const PASOS = [
  {
    title: 'Crea el perfil de tu negocio',
    text: 'Servicios, precios y horarios en unos minutos. Sin conocimientos técnicos.',
  },
  {
    title: 'Comparte tu enlace',
    text: 'En Instagram, en Google o en la puerta del local. Tus clientes reservan solos.',
  },
  {
    title: 'Gestiona todo desde el panel',
    text: 'Agenda, clientes y métricas en un único sitio, desde el móvil o el ordenador.',
  },
]

function Check() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-brand text-[11px] font-bold text-brand"
    >
      ✓
    </span>
  )
}

export function Landing() {
  const { data: businesses, isLoading } = useQuery({
    queryKey: ['businesses', 'home'],
    queryFn: () => api.listBusinesses({ limit: 3 }),
  })

  return (
    <>
      {/* HERO */}
      <section className="bg-ink">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-14 px-6 py-20 lg:flex-row lg:px-16 lg:py-24">
          <div className="min-w-0 flex-1">
            <p
              className="rise mb-5 text-[13px] font-semibold tracking-[0.08em] text-accent uppercase"
            >
              {ESLOGAN}
            </p>
            <h1
              className="rise text-[34px] leading-[1.12] font-semibold text-ondark sm:text-[44px] lg:text-[52px]"
              style={{ animationDelay: '80ms' }}
            >
              {ESLOGAN_NEGOCIO}
            </h1>
            <p
              className="rise mt-5 mb-8 max-w-[500px] text-[17px] leading-relaxed text-ondark-muted-2"
              style={{ animationDelay: '160ms' }}
            >
              Veline se encarga de las citas, los recordatorios y los números para que tú te
              dediques a atender. Sin conocimientos técnicos y sin comisiones ocultas.
            </p>
            <div className="rise flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
              <ButtonLink to="/precios" variant="accent">
                Añadir mi negocio
              </ButtonLink>
              <ButtonLink
                to="/panel"
                variant="ghost"
                className="border-ondark-muted text-ondark hover:bg-ondark hover:text-ink"
              >
                Ver el panel
              </ButtonLink>
            </div>
            <p className="mt-5 text-[13px] font-medium text-ondark-muted">
              {PRUEBA_DIAS} días de prueba sin permanencia
            </p>
          </div>
          <div
            className="ph rise h-[280px] w-full flex-1 rounded-2xl border-line-dark bg-ink-2 text-ph-border lg:h-[400px]"
            style={{ animationDelay: '120ms' }}
          >
            Vista previa del panel del negocio
          </div>
        </div>
      </section>

      {/* DESTACADOS */}
      <section className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
        <Eyebrow>Todo lo que tu negocio necesita</Eyebrow>
        <h2 className="mb-10 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
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
            <div className="mb-2 font-display text-lg font-semibold text-ink">
              ¿Echas algo en falta?
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Cuéntanoslo y lo estudiamos. La lista está abierta a propósito.
            </p>
          </Card>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section
        id="como-funciona"
        className="scroll-mt-24 border-y border-line bg-canvas"
      >
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
          <h2 className="mb-12 text-center text-[26px] font-semibold text-ink sm:text-[32px]">
            Cómo funciona
          </h2>
          <div className="flex flex-col gap-10 sm:flex-row">
            {PASOS.map((paso, i) => (
              <div key={paso.title} className="flex-1 text-center">
                <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-ink font-semibold text-cream">
                  {i + 1}
                </div>
                <div className="mb-2 font-semibold text-ink">{paso.title}</div>
                <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted">
                  {paso.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICIOS PARA EMPRESAS */}
      <section id="servicios" className="mx-auto max-w-[1440px] scroll-mt-24 px-6 py-20 lg:px-16">
        <Eyebrow>Servicios para empresas</Eyebrow>
        <h2 className="mb-4 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
          Desde la agenda hasta el último detalle
        </h2>
        <p className="mb-10 max-w-[560px] text-[15.5px] leading-relaxed text-body">
          Lo básico entra con la suscripción. Lo marcado como{' '}
          <span className="font-semibold text-ink">Plus</span> se contrata aparte, según lo que
          cada negocio necesite.
        </p>

        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {SERVICIOS_EMPRESA.map((s) => (
            <div key={s.title} className="flex gap-3.5">
              <Check />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{s.title}</span>
                  {'plus' in s && s.plus && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-ink uppercase">
                      Plus
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EL MARKETPLACE, COMO ARGUMENTO DE VENTA */}
      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Y además, clientes nuevos</Eyebrow>
              <h2 className="max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
                Así te ven tus clientes
              </h2>
              <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-body">
                Tu negocio entra en el marketplace de Veline, donde la gente de tu zona busca y
                reserva. Solo cobramos el 15 % la primera vez que un cliente nuevo te descubre
                ahí; si ya era tuyo, es gratis siempre.
              </p>
            </div>
            <Link to="/buscar" className="text-sm font-semibold text-brand hover:text-ink">
              Ver el marketplace →
            </Link>
          </div>

          {isLoading ? (
            <Spinner />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {businesses?.map((b) => (
                <BusinessCard key={b.id} business={b} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CIERRE */}
      <section className="mx-auto max-w-[1440px] px-6 py-24 text-center lg:px-16">
        <p className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[34px]">
          {ESLOGAN}
        </p>
        <p className="mx-auto mt-4 mb-8 max-w-[460px] text-[15.5px] leading-relaxed text-muted">
          Pruébalo {PRUEBA_DIAS} días sin tarjeta y decide después.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink to="/precios">Ver planes y precios</ButtonLink>
          <ButtonLink to="/panel" variant="ghost">
            Ver el panel
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
