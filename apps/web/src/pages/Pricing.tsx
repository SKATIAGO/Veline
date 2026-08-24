import { CONTACT_EMAIL, formatPrice } from '@veline/shared'
import { ButtonLink, Card, Eyebrow, cx } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { DoorMotif, Glow, QuoteMark } from '../components/Ornaments'
import { EXTRAS, FAQ, PLANES, PRUEBA_DIAS } from '../content/precios'

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-body-2">
      <span className="shrink-0 font-bold text-brand">✓</span>
      {children}
    </li>
  )
}

export function Pricing() {
  return (
    <div className="relative mx-auto max-w-[1440px] px-6 py-16 lg:px-16">
      <Glow className="-top-32 left-1/2 -translate-x-1/2" color="rgba(217,164,65,.2)" size={620} />
      <DoorMotif
        className="top-40 left-[-3%] hidden xl:block"
        size={170}
        opacity={0.05}
        tilt={-12}
      />
      <DoorMotif
        className="top-[52%] right-[-2%] hidden xl:block"
        size={140}
        opacity={0.05}
        tilt={10}
        delay={900}
      />

      {/* HERO */}
      <Reveal className="relative text-center">
        <h1 className="text-[32px] leading-tight font-semibold text-ink sm:text-[42px]">
          Un precio simple, sin sorpresas
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-base leading-relaxed text-body">
          Pruébalo {PRUEBA_DIAS} días sin compromiso. Después, una cuota mes a mes que entiendes de
          una lectura — nunca por adelantado, nunca letra pequeña.
        </p>
      </Reveal>

      {/* PLANES */}
      <div className="relative mt-14 flex flex-col items-stretch gap-6 lg:flex-row">
        {PLANES.map((plan, i) => (
          <Reveal
            key={plan.name}
            delay={i * 110}
            variant="zoom"
            className={cx('flex-1', plan.popular && 'lg:-mt-3 lg:-mb-3')}
          >
            <Card
              className={cx(
                'lift relative flex h-full flex-col p-8',
                plan.popular && 'border-2 border-brand shadow-pop',
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-[11.5px] font-semibold text-white">
                  Más elegido
                </span>
              )}
              <div className="font-display text-lg font-semibold text-ink">{plan.name}</div>
              <div className="mt-1.5 mb-6 text-[13.5px] text-subtle">{plan.tagline}</div>
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="font-display text-[40px] font-semibold text-ink">
                  {'priceCents' in plan && plan.priceCents !== undefined
                    ? `${'pricePrefix' in plan ? plan.pricePrefix : ''}${formatPrice(plan.priceCents)}`
                    : plan.price}
                </span>
                <span className="text-sm font-medium text-subtle">{plan.period}</span>
              </div>
              <ButtonLink
                to="/panel"
                variant={plan.variant}
                size="lg"
                block
                className={cx('mb-7', plan.popular && 'sheen')}
              >
                {plan.cta}
              </ButtonLink>
              <ul className="flex flex-col gap-3">
                {plan.features.map((f) => (
                  <Feature key={f}>{f}</Feature>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* COMISIÓN */}
      <Reveal delay={80} className="mx-auto mt-8 max-w-[1000px]">
        <Card className="lift flex items-center gap-6 p-8">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xl font-semibold text-accent">
            %
          </div>
          <p className="text-[14.5px] leading-relaxed text-body-2">
            Sobre el marketplace: cobramos{' '}
            <strong className="text-ink">15 % solo la primera vez</strong> que un cliente nuevo te
            descubre y reserva a través de la plataforma. Si ya lo conocías, o llega por tu
            Instagram, Google o boca a boca — es gratis, siempre.
          </p>
        </Card>
      </Reveal>

      {/* EXTRAS */}
      <section className="relative mt-24">
        <Reveal>
          <Eyebrow>Servicios aparte</Eyebrow>
          <h2 className="quill mb-6 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
            Si quieres que hagamos más
          </h2>
          <p className="mb-10 max-w-[560px] text-[15.5px] leading-relaxed text-body">
            Se contratan cuando los necesitas y se quitan cuando no. Nada de esto es obligatorio
            para empezar a recibir reservas.
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2">
          {EXTRAS.map((extra, i) => (
            <Reveal key={extra.name} delay={i * 90} variant={i % 2 === 0 ? 'left' : 'right'}>
              <Card className="lift flex h-full flex-col p-7">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-semibold text-ink">{extra.name}</span>
                  <span className="rounded-full bg-cream px-3 py-1 text-[13px] font-semibold text-brand">
                    {extra.price}
                  </span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {extra.items.map((item) => (
                    <Feature key={item}>{item}</Feature>
                  ))}
                </ul>
                <p className="mt-4 text-[12.5px] text-subtle">{extra.note}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* RESEÑAS */}
      <section className="mt-24">
        <Reveal>
          <Eyebrow>Reseñas</Eyebrow>
          <h2 className="quill mb-6 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
            Lo que dicen los negocios que ya lo usan
          </h2>
          <p className="mb-10 max-w-[620px] text-[15.5px] leading-relaxed text-body">
            Aquí van las opiniones reales de los primeros negocios. El espacio está montado y
            maquetado: en cuanto tengamos sus frases y su permiso, se colocan tal cual.
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Reveal key={i} delay={i * 110} variant="zoom">
              <div className="lift flex min-h-[200px] flex-col justify-between rounded-xl border border-dashed border-ph-border bg-ph-bg/40 p-6">
                <QuoteMark className="mb-3 text-ph-border" />
                <p className="flex-1 text-[15px] leading-relaxed text-ph-text">
                  Reseña de un negocio — cita textual
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="size-10 shrink-0 rounded-full border border-dashed border-ph-border bg-ph-bg" />
                  <div>
                    <div className="text-[13.5px] font-semibold text-ph-text">Nombre y negocio</div>
                    <div className="text-[12.5px] text-ph-text/80">Sector · Ciudad</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PREGUNTAS */}
      <section className="mt-24">
        <Reveal>
          <Eyebrow>Preguntas frecuentes</Eyebrow>
          <h2 className="quill mb-10 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
            Lo que suelen preguntarnos
          </h2>
        </Reveal>

        <Reveal
          delay={80}
          className="mx-auto max-w-[820px] overflow-hidden rounded-xl border border-line bg-surface"
        >
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-line last:border-b-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[15.5px] font-semibold text-ink marker:hidden hover:bg-cream/60">
                {item.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xl leading-none text-brand transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-6 pb-5 text-[14.5px] leading-relaxed text-body">{item.a}</p>
            </details>
          ))}
        </Reveal>

        <p className="mt-6 text-center text-sm text-muted">
          ¿Te queda alguna duda?{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand hover:text-ink">
            Escríbenos
          </a>{' '}
          y te contestamos.
        </p>
      </section>

      {/* CIERRE */}
      <Reveal variant="zoom" as="section" className="mt-24 text-center">
        <p className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
          Pruébalo {PRUEBA_DIAS} días. Sin tarjeta.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/panel" size="lg" className="sheen">
            Empezar la prueba
          </ButtonLink>
          <ButtonLink to="/" variant="secondary" size="lg">
            Ver todo lo que incluye
          </ButtonLink>
        </div>
      </Reveal>
    </div>
  )
}
