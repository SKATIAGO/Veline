import { useState } from 'react'
import { CONTACT_EMAIL, PLAN_INFO, formatPrice, planLabel } from '@veline/shared'
import { ButtonLink, Card, Eyebrow, cx } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { DoorMotif, Filete, Glow } from '../components/Ornaments'
import { Texto, useIdioma, type Clave } from '../i18n/idioma'
import { FAQ, INCLUIDO, PLANES, PRUEBA_DIAS } from '../content/precios'

/**
 * Precios, en el orden en que se decide: primero cuánto te costaría a ti
 * (la calculadora, según cuántas personas atienden), luego los tres planes
 * —pre-lanzamiento gratis, Negocio y Equipo—, lo que va incluido en todos y
 * las preguntas.
 *
 * La calculadora iba debajo de los planes, pequeña, y casi nadie llegaba a
 * ella: es lo primero que pregunta quien tiene equipo. Lo que iba aparte (web
 * a medida, gestión de redes) ya no se ofrece, y la comisión del 15 % del
 * marketplace se quitó el 19 oct 2026.
 */

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2.5 text-body leading-relaxed text-body-2">
      <span className="shrink-0 font-bold text-brand-text">✓</span>
      {children}
    </li>
  )
}

/**
 * Pregunta desplegable. Un grid de 0fr a 1fr hace que el texto se despliegue
 * como una cortina en vez de aparecer con un salto.
 */
function FaqRow({ q, a }: { q: Clave; a: Clave }) {
  const { t } = useIdioma()
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 px-6 py-4 text-left text-ui font-semibold text-ink transition-colors duration-200 hover:bg-cream/60"
      >
        {t(q, { n: PRUEBA_DIAS })}
        <span
          aria-hidden="true"
          className={cx(
            'shrink-0 text-subheading leading-none text-brand-text transition-transform duration-300',
            open && 'rotate-45',
          )}
        >
          +
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-body leading-relaxed text-body">{t(a)}</p>
        </div>
      </div>
    </div>
  )
}

const MAX_PERSONAS = 12

/** Cuántas personas atienden → cuánto es al mes, con su desglose. */
function Calculadora() {
  const { t, idioma } = useIdioma()
  const { priceCents, seatsIncluded, extraSeatCents } = PLAN_INFO.NEGOCIO
  const [personas, setPersonas] = useState<number>(seatsIncluded)
  const deMas = Math.max(0, personas - seatsIncluded)
  const total = priceCents + deMas * extraSeatCents
  const precioExtra = formatPrice(extraSeatCents, idioma)
  const plan = planLabel('NEGOCIO', idioma)
  const texto = personas === 1 ? t('pre.calcUnaPersona') : t('pre.calcPersonas', { n: personas })
  const poner = (n: number) => setPersonas(Math.max(1, Math.min(MAX_PERSONAS, n)))

  const paso = (delta: -1 | 1) => (
    <button
      type="button"
      aria-label={delta < 0 ? t('pre.calcMenos') : t('pre.calcMas')}
      disabled={delta < 0 ? personas <= 1 : personas >= MAX_PERSONAS}
      onClick={() => poner(personas + delta)}
      className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-surface text-heading-sm leading-none text-ink transition-colors duration-200 hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink"
    >
      <span aria-hidden>{delta < 0 ? '−' : '+'}</span>
    </button>
  )

  return (
    <Card className="relative overflow-hidden border-2 border-brand! p-6 shadow-pop sm:p-10">
      <Eyebrow>{t('pre.calcEyebrow')}</Eyebrow>
      <h2
        id="calculadora"
        className="max-w-[560px] text-heading leading-tight font-semibold text-ink sm:text-display-sm"
      >
        {t('pre.calcTitulo')}
      </h2>
      <p className="mt-2 text-body text-muted">{t('pre.calcPista', { extra: precioExtra })}</p>

      <div className="mt-8 grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {paso(-1)}
            <p
              className="min-w-0 flex-1 text-center font-display text-heading-sm font-semibold text-ink tabular-nums"
              aria-live="polite"
            >
              {texto}
            </p>
            {paso(1)}
          </div>
          <input
            type="range"
            min={1}
            max={MAX_PERSONAS}
            value={personas}
            onChange={(e) => poner(Number(e.target.value))}
            aria-labelledby="calculadora"
            aria-valuetext={texto}
            className="h-11 w-full accent-brand"
          />
        </div>

        <div className="rounded-xl bg-cream px-6 py-5 md:min-w-[280px] md:text-right">
          <p>
            <span className="font-display text-display font-semibold text-ink tabular-nums">
              {formatPrice(total, idioma)}
            </span>{' '}
            <span className="text-body text-muted">{t('pre.calcTotal')}</span>
          </p>
          <p className="mt-1 text-meta text-body-2 tabular-nums">
            {deMas > 0
              ? t('pre.calcDesglose', {
                  plan,
                  incluidas: seatsIncluded,
                  n: deMas,
                  extra: precioExtra,
                })
              : t('pre.calcSoloPlan', { plan, incluidas: seatsIncluded })}
          </p>
          <p className="mt-3 text-meta font-semibold text-brand-text">{t('pre.calcAhora')}</p>
        </div>
      </div>
    </Card>
  )
}

export function Pricing() {
  const { t, idioma } = useIdioma()

  return (
    <div className="relative mx-auto max-w-[1440px] overflow-x-clip px-6 py-16 lg:px-16">
      <Glow className="-top-32 left-1/2 -translate-x-1/2" color="rgba(217,164,65,.2)" size={620} />
      <DoorMotif
        className="top-40 left-[-3%] hidden xl:block"
        size={170}
        opacity={0.05}
        tilt={-12}
      />

      {/* HERO */}
      <Reveal className="relative text-center">
        <p className="text-meta font-semibold tracking-[0.22em] text-brand-text uppercase">
          {t('pre.pruebaNombre')}
        </p>
        <h1 className="mt-3 font-display text-display-sm leading-tight font-semibold text-ink sm:text-display-lg">
          <span className="bg-gradient-to-b from-[#d4aa5e] via-[#b98a42] to-[#8f5a2c] bg-clip-text text-transparent">
            {t('pre.tituloOro')}
          </span>{' '}
          {t('pre.tituloResto')}
        </h1>
        <div className="mt-5">
          <Filete />
        </div>
        <p className="mx-auto max-w-[560px] text-ui leading-relaxed text-body">
          {t('pre.entradilla', { n: PRUEBA_DIAS })}
          <br />
          {t('pre.entradilla2')}
        </p>
      </Reveal>

      {/* CALCULADORA: lo primero que pregunta quien tiene equipo */}
      <Reveal delay={60} className="relative mx-auto mt-12 max-w-[1040px]">
        <Calculadora />
      </Reveal>

      {/* PLANES */}
      <div className="relative mt-14 flex flex-col items-stretch gap-6 lg:flex-row">
        {PLANES.map((plan, i) => (
          <Reveal
            key={plan.nombre}
            delay={i * 110}
            variant="zoom"
            className={cx('flex-1', plan.popular && 'lg:-mt-3 lg:-mb-3')}
          >
            <Card
              className={cx(
                'lift relative flex h-full flex-col p-7 sm:p-8',
                plan.popular && 'border-2 border-brand! shadow-pop',
                plan.invitacion &&
                  'border-accent/70! bg-gradient-to-b from-cream to-canvas shadow-pop',
              )}
            >
              {plan.invitacion && (
                <>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-2.5 rounded-[14px] border border-accent/60"
                  />
                  <span className="absolute -top-3 left-7 z-10 rounded-full bg-ink px-3 py-1 text-caption font-semibold text-accent">
                    {t('pre.pruebaNombre')}
                  </span>
                </>
              )}
              {plan.popular && (
                <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-caption font-semibold text-white">
                  {t('pre.masElegido')}
                </span>
              )}
              <div
                className={cx(
                  'font-display text-subheading font-semibold text-ink',
                  plan.invitacion && 'mt-2',
                )}
              >
                {t(plan.nombre)}
              </div>
              <div className="mt-1 mb-6 text-body text-muted">{t(plan.tagline)}</div>
              {plan.priceCents !== undefined && (
                <p className="mb-1 text-caption font-semibold tracking-[0.08em] text-brand-text uppercase">
                  {t('pre.precioFuturo')} · {t('pre.ahoraGratis')}
                </p>
              )}
              <div className="mb-6 flex items-baseline gap-1.5">
                <span
                  className={cx(
                    'font-display text-display font-semibold text-ink',
                    plan.invitacion && 'text-brand-text',
                  )}
                >
                  {plan.priceCents !== undefined
                    ? `${plan.pricePrefix ?? ''}${formatPrice(plan.priceCents, idioma)}`
                    : plan.precio
                      ? t(plan.precio)
                      : ''}
                </span>
                <span className="text-body font-medium text-muted">
                  {t(plan.periodo, { n: PRUEBA_DIAS })}
                </span>
              </div>
              {plan.explicacion && (
                <p className="-mt-2 mb-6 rounded-lg bg-cream px-4 py-3 text-meta leading-relaxed text-body-2">
                  {t(plan.explicacion)}
                </p>
              )}
              {/* `to` para las pantallas de Veline y `href` para salir fuera
                  (el mailto de Equipo). El asunto del correo se traduce: quien
                  escribe en inglés escribe en inglés. */}
              <ButtonLink
                to={plan.to}
                href={
                  plan.asunto
                    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t(plan.asunto))}`
                    : undefined
                }
                variant={plan.variant}
                size="lg"
                block
                className={cx('mb-6', plan.popular && 'sheen')}
              >
                {t(plan.cta)}
              </ButtonLink>
              <ul
                className={cx(
                  'flex flex-col gap-2.5',
                  plan.invitacion && 'divide-y divide-accent/40 *:py-2.5 *:first:pt-0 *:last:pb-0',
                )}
              >
                {plan.features.map((f) => (
                  <Feature key={f}>{t(f)}</Feature>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* A MEDIDA: web o agenda propia, con presupuesto */}
      <Reveal as="section" className="mt-20">
        <div className="relative overflow-hidden rounded-[26px] border border-accent/50 bg-gradient-to-br from-ink-2 via-ink to-[#241811] p-8 text-cream shadow-[0_40px_70px_-35px_rgba(46,33,25,.7),0_0_0_6px_rgba(205,174,116,.12)] sm:p-12">
          <Glow className="top-[-160px] right-[-120px]" color="rgba(205,174,116,.28)" size={480} />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-3.5 rounded-2xl border border-accent/25"
          />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
            <div>
              <p className="text-meta font-semibold tracking-[0.22em] text-accent uppercase">
                {t('pre.medidaEyebrow')}
              </p>
              <h2 className="mt-3 mb-3 font-display text-heading leading-tight font-semibold text-cream sm:text-display-sm">
                {t('pre.medidaTitulo')}
              </h2>
              <p className="max-w-[520px] text-ui leading-relaxed text-ondark-muted-2">
                {t('pre.medidaTexto')}
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <ButtonLink
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('pre.medidaAsunto'))}`}
                variant="accent"
                size="lg"
                className="sheen"
              >
                {t('pre.medidaBoton')}
              </ButtonLink>
              <p className="mt-3 text-meta text-ondark-muted">{t('pre.medidaPie')}</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* INCLUIDO EN TODOS LOS PLANES */}
      <section id="incluido" className="relative mt-20 scroll-mt-24">
        <Reveal>
          <Eyebrow>{t('pre.incluidoEyebrow')}</Eyebrow>
          <h2 className="quill mb-3 max-w-[620px] text-heading leading-tight font-semibold text-ink sm:text-display-sm">
            {t('pre.incluidoTitulo')}
          </h2>
          <p className="mb-8 max-w-[560px] text-ui leading-relaxed text-body">
            {t('pre.incluidoTexto')}
          </p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {INCLUIDO.map((bloque, i) => (
            <Reveal key={bloque.nombre} delay={i * 90}>
              <Card className="flex h-full flex-col p-6 sm:p-7">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-subheading font-semibold text-ink">
                    {t(bloque.nombre)}
                  </span>
                  <span className="rounded-full bg-cream px-3 py-1 text-meta font-semibold text-brand-text">
                    {t(bloque.precio)}
                  </span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {bloque.items.map((item) => (
                    <Feature key={item}>{t(item)}</Feature>
                  ))}
                </ul>
                {'nota' in bloque && bloque.nota && (
                  <p className="mt-4 text-meta text-subtle">{t(bloque.nota)}</p>
                )}
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PREGUNTAS */}
      <section className="mt-20">
        <Reveal>
          <Eyebrow>{t('pre.preguntas')}</Eyebrow>
          <h2 className="quill mb-8 max-w-[620px] text-heading leading-tight font-semibold text-ink sm:text-display-sm">
            {t('pre.loQuePreguntan')}
          </h2>
        </Reveal>
        <Reveal
          delay={80}
          className="mx-auto max-w-[820px] overflow-hidden rounded-xl border border-line bg-surface"
        >
          {FAQ.map((item) => (
            <FaqRow key={item.q} q={item.q} a={item.a} />
          ))}
        </Reveal>
        <p className="mt-6 text-center text-body text-muted">
          <Texto
            clave="pre.algunaDuda"
            partes={{
              escribenos: (
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex min-h-10 items-center px-1 font-semibold text-brand-text hover:text-ink"
                >
                  {t('pre.escribenos')}
                </a>
              ),
            }}
          />
        </p>
      </section>

      {/* CIERRE */}
      <Reveal variant="zoom" as="section" className="mt-20 text-center">
        <p className="font-display text-heading leading-tight font-semibold text-ink sm:text-display-sm">
          {t('pre.pruebaloSinCompromiso', { n: PRUEBA_DIAS })}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/alta" size="lg" className="sheen">
            {t('pre.empezarPrueba')}
          </ButtonLink>
          <ButtonLink to="/#como-funciona" variant="secondary" size="lg">
            {t('home.verComoFunciona')}
          </ButtonLink>
        </div>
      </Reveal>
    </div>
  )
}
