import { useState } from 'react'
import { CONTACT_EMAIL, PLAN_INFO, formatPrice } from '@veline/shared'
import { ButtonLink, Card, Eyebrow, cx } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { DoorMotif, Glow } from '../components/Ornaments'
import { Texto, useIdioma, type Clave } from '../i18n/idioma'
import { EXTRAS, FAQ, PLANES, PRUEBA_DIAS } from '../content/precios'

/**
 * Precios: tres tarjetas —pre-lanzamiento gratis, Negocio y Equipo (10,95 € por
 * empleado de más)—, una calculadora, lo que va aparte y las preguntas.
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

/** Cuántas personas atienden → cuánto es al mes. */
function Calculadora() {
  const { t, idioma } = useIdioma()
  const { priceCents, seatsIncluded, extraSeatCents } = PLAN_INFO.NEGOCIO
  const [personas, setPersonas] = useState<number>(seatsIncluded)
  const total = priceCents + Math.max(0, personas - seatsIncluded) * extraSeatCents
  const precioExtra = formatPrice(extraSeatCents, idioma)

  return (
    <Card className="flex flex-col gap-4 p-6 sm:p-8">
      <div>
        <h3 className="font-display text-subheading font-semibold text-ink">
          {t('pre.calcTitulo')}
        </h3>
        <p className="mt-1 text-meta text-muted">{t('pre.calcPista', { extra: precioExtra })}</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-body font-semibold text-ink tabular-nums">
            {personas === 1 ? t('pre.calcUnaPersona') : t('pre.calcPersonas', { n: personas })}
          </span>
          <input
            type="range"
            min={1}
            max={12}
            value={personas}
            onChange={(e) => setPersonas(Number(e.target.value))}
            aria-valuetext={
              personas === 1 ? t('pre.calcUnaPersona') : t('pre.calcPersonas', { n: personas })
            }
            className="h-11 w-full accent-brand"
          />
        </label>
        <p className="shrink-0 text-right">
          <span className="font-display text-display-sm font-semibold text-ink tabular-nums">
            {formatPrice(total, idioma)}
          </span>{' '}
          <span className="text-body text-muted">{t('pre.calcTotal')}</span>
        </p>
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
        <h1 className="text-display-sm leading-tight font-semibold text-ink sm:text-display">
          {t('pre.titulo')}
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-ui leading-relaxed text-body">
          {t('pre.entradilla', { n: PRUEBA_DIAS })}
        </p>
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
                plan.popular && 'border-2 border-brand shadow-pop',
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-caption font-semibold text-white">
                  {t('pre.masElegido')}
                </span>
              )}
              <div className="font-display text-subheading font-semibold text-ink">
                {t(plan.nombre)}
              </div>
              <div className="mt-1 mb-6 text-body text-muted">{t(plan.tagline)}</div>
              {plan.priceCents !== undefined && (
                <p className="mb-1 text-caption font-semibold tracking-[0.08em] text-brand-text uppercase">
                  {t('pre.precioFuturo')} · {t('pre.ahoraGratis')}
                </p>
              )}
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="font-display text-display font-semibold text-ink">
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
              <ul className="flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <Feature key={f}>{t(f)}</Feature>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* CALCULADORA */}
      <Reveal delay={80} className="mx-auto mt-6 max-w-[920px]">
        <Calculadora />
      </Reveal>

      {/* COMISIÓN */}
      <Reveal delay={80} className="mx-auto mt-6 max-w-[920px]">
        <Card className="flex items-center gap-5 p-6 sm:p-8">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-subheading font-semibold text-accent">
            %
          </div>
          <p className="text-body leading-relaxed text-body-2">
            <Texto
              clave="pre.comision"
              partes={{
                soloPrimeraVez: <strong className="text-ink">{t('pre.soloPrimeraVez')}</strong>,
              }}
            />
          </p>
        </Card>
      </Reveal>

      {/* QUÉ VA APARTE */}
      <section id="extras" className="relative mt-20 scroll-mt-24">
        <Reveal>
          <Eyebrow>{t('pre.noIncluye')}</Eyebrow>
          <h2 className="quill mb-3 max-w-[620px] text-heading leading-tight font-semibold text-ink sm:text-display-sm">
            {t('pre.siQuieresMas')}
          </h2>
          <p className="mb-8 max-w-[560px] text-ui leading-relaxed text-body">
            {t('pre.noIncluyeTexto')}
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2">
          {EXTRAS.map((extra, i) => (
            <Reveal key={extra.nombre} delay={i * 90} variant={i % 2 === 0 ? 'left' : 'right'}>
              <Card className="flex h-full flex-col p-6 sm:p-7">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-subheading font-semibold text-ink">
                    {t(extra.nombre)}
                  </span>
                  {'contacto' in extra && extra.contacto ? (
                    <a
                      href={`mailto:${CONTACT_EMAIL}${
                        'asunto' in extra && extra.asunto
                          ? `?subject=${encodeURIComponent(t(extra.asunto))}`
                          : ''
                      }`}
                      className="inline-flex min-h-10 items-center rounded-full bg-cream px-3 text-meta font-semibold text-brand-text hover:text-ink"
                    >
                      {t('pre.escribenos')}
                    </a>
                  ) : (
                    'precio' in extra &&
                    extra.precio && (
                      <span className="rounded-full bg-cream px-3 py-1 text-meta font-semibold text-brand-text">
                        {t(extra.precio)}
                      </span>
                    )
                  )}
                </div>
                <ul className="flex flex-col gap-2.5">
                  {extra.items.map((item) => (
                    <Feature key={item}>{t(item)}</Feature>
                  ))}
                </ul>
                {'nota' in extra && extra.nota && (
                  <p className="mt-4 text-meta text-subtle">{t(extra.nota)}</p>
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
