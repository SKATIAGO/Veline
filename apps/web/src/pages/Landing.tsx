import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CATEGORIES } from '@veline/shared'
import { api } from '../lib/api'
import { ButtonLink, Card, Eyebrow, Spinner } from '../components/ui'
import { BusinessCard } from '../components/BusinessCard'
import { Reveal } from '../components/Reveal'
import { Awning, DoorMotif, Glow, SectorMarquee } from '../components/Ornaments'
import { DESTACADOS, ESLOGAN, ESLOGAN_NEGOCIO, SERVICIOS_EMPRESA } from '../content/negocio'
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
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-brand text-caption font-bold text-brand-text transition-colors duration-300 group-hover/item:bg-brand group-hover/item:text-white"
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
      <section className="grain relative overflow-hidden bg-ink">
        <Glow className="-top-40 -left-32" color="rgba(169,106,62,.35)" size={620} />
        <Glow className="-right-40 -bottom-52" color="rgba(217,164,65,.18)" size={560} />
        <DoorMotif
          className="top-16 right-[8%] hidden lg:block"
          size={210}
          tone="#D9A441"
          opacity={0.08}
        />
        <DoorMotif
          className="bottom-10 left-[4%] hidden lg:block"
          size={130}
          tilt={12}
          tone="#F2E7D6"
          opacity={0.05}
          delay={1200}
        />

        <div className="relative mx-auto flex max-w-[1440px] flex-col items-center gap-14 px-6 py-20 lg:flex-row lg:px-16 lg:py-24">
          <div className="min-w-0 flex-1">
            <p className="rise mb-5 text-meta font-semibold tracking-[0.08em] text-accent uppercase">
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
              <ButtonLink to="/precios" variant="accent" size="lg" className="sheen">
                Añadir mi negocio
              </ButtonLink>
              <ButtonLink
                to="/panel"
                variant="secondary"
                size="lg"
                className="border-ondark-muted text-ondark hover:bg-ondark hover:text-ink"
              >
                Ver el panel
              </ButtonLink>
            </div>
            <p
              className="rise mt-5 text-meta font-medium text-ondark-muted"
              style={{ animationDelay: '320ms' }}
            >
              {PRUEBA_DIAS} días de prueba sin permanencia
            </p>
          </div>

          <div
            className="ph rise float h-[280px] w-full flex-1 rounded-2xl border-line-dark bg-ink-2 text-ph-border lg:h-[400px]"
            style={{ animationDelay: '120ms' }}
          >
            Vista previa del panel del negocio
          </div>
        </div>

        <Awning tone="accent" />
      </section>

      {/* CINTA DE SECTORES */}
      <SectorMarquee items={CATEGORIES.map((c) => c.label)} />

      {/* DESTACADOS */}
      <section className="relative mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
        <DoorMotif
          className="-top-6 right-[3%] hidden xl:block"
          size={150}
          opacity={0.05}
          tilt={8}
        />
        <Reveal>
          <Eyebrow>Todo lo que tu negocio necesita</Eyebrow>
          <h2 className="quill mb-10 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
            Las citas dejan de ser un problema el primer día
          </h2>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DESTACADOS.map((d, i) => (
            <Reveal key={d.title} delay={i * 80} variant="zoom">
              <Card className="lift group h-full p-6">
                <div className="mb-2 font-display text-lg font-semibold text-ink transition-colors duration-300 group-hover:text-brand">
                  {d.title}
                </div>
                <p className="text-sm leading-relaxed text-muted">{d.text}</p>
              </Card>
            </Reveal>
          ))}
          <Reveal delay={DESTACADOS.length * 80} variant="zoom">
            <Card className="lift flex h-full flex-col justify-center border-dashed bg-transparent p-6">
              <div className="mb-2 font-display text-lg font-semibold text-ink">
                ¿Echas algo en falta?
              </div>
              <p className="text-sm leading-relaxed text-muted">
                Cuéntanoslo y lo estudiamos. La lista está abierta a propósito.
              </p>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section
        id="como-funciona"
        className="relative scroll-mt-24 overflow-hidden border-y border-line bg-canvas"
      >
        <Glow
          className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          color="rgba(217,164,65,.14)"
          size={700}
        />
        <div className="relative mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
          <Reveal>
            <h2 className="mb-14 text-center text-[26px] font-semibold text-ink sm:text-[32px]">
              Cómo funciona
            </h2>
          </Reveal>
          <div className="relative flex flex-col gap-12 sm:flex-row">
            {/* Hilo que une los tres pasos */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-[22px] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent sm:block"
            />
            {PASOS.map((paso, i) => (
              <Reveal key={paso.title} delay={i * 140} className="relative flex-1 text-center">
                <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-ink font-semibold text-cream ring-8 ring-canvas transition-transform duration-300 hover:scale-110">
                  {i + 1}
                </div>
                <div className="mb-2 font-semibold text-ink">{paso.title}</div>
                <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted">
                  {paso.text}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICIOS PARA EMPRESAS */}
      <section
        id="servicios"
        className="relative mx-auto max-w-[1440px] scroll-mt-24 px-6 py-20 lg:px-16"
      >
        <DoorMotif
          className="top-24 left-[-2%] hidden xl:block"
          size={190}
          opacity={0.045}
          tilt={-14}
          delay={800}
        />
        <Reveal>
          <Eyebrow>Servicios para empresas</Eyebrow>
          <h2 className="quill mb-6 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
            Desde la agenda hasta el último detalle
          </h2>
          <p className="mb-10 max-w-[560px] text-ui leading-relaxed text-body">
            Lo básico entra con la suscripción. Lo marcado como{' '}
            <span className="font-semibold text-ink">Plus</span> se contrata aparte, según lo que
            cada negocio necesite.
          </p>
        </Reveal>

        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {SERVICIOS_EMPRESA.map((s, i) => (
            <Reveal key={s.title} delay={i * 70} variant={i % 2 === 0 ? 'left' : 'right'}>
              <div className="group/item flex gap-3.5">
                <Check />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{s.title}</span>
                    {'plus' in s && s.plus && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-caption font-semibold tracking-wide text-ink uppercase">
                        Plus
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-body leading-relaxed text-muted">{s.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* EL MARKETPLACE, COMO ARGUMENTO DE VENTA */}
      <section className="relative overflow-hidden border-y border-line bg-canvas">
        <Awning tone="brand" />
        <div className="relative mx-auto max-w-[1440px] px-6 py-20 lg:px-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <Reveal>
              <Eyebrow>Y además, clientes nuevos</Eyebrow>
              <h2 className="quill max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
                Así te ven tus clientes
              </h2>
              <p className="mt-6 max-w-[560px] text-ui leading-relaxed text-body">
                Tu negocio entra en el marketplace de Veline, donde la gente de tu zona busca y
                reserva. Solo cobramos el 15 % la primera vez que un cliente nuevo te descubre ahí;
                si ya era tuyo, es gratis siempre.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <Link
                to="/buscar"
                className="group inline-flex min-h-10 items-center gap-1.5 px-1 text-body font-semibold text-brand-text hover:text-ink"
              >
                Ver el marketplace
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </Reveal>
          </div>

          {isLoading ? (
            <Spinner />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {businesses?.map((b, i) => (
                <Reveal key={b.id} delay={i * 100} variant="zoom">
                  <BusinessCard business={b} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CIERRE */}
      <section className="relative overflow-hidden">
        <Glow
          className="bottom-[-220px] left-1/2 -translate-x-1/2"
          color="rgba(169,106,62,.16)"
          size={640}
        />
        <div className="relative mx-auto max-w-[1440px] px-6 py-24 text-center lg:px-16">
          <Reveal variant="zoom">
            <p className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[34px]">
              {ESLOGAN}
            </p>
            <p className="mx-auto mt-4 mb-8 max-w-[460px] text-ui leading-relaxed text-muted">
              Pruébalo {PRUEBA_DIAS} días sin tarjeta y decide después.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink to="/precios" size="lg" className="sheen">
                Ver planes y precios
              </ButtonLink>
              <ButtonLink to="/panel" variant="secondary" size="lg">
                Ver el panel
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
