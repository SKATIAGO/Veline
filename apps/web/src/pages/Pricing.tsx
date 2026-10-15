import { useState } from 'react'
import { CONTACT_EMAIL, PLAN_INFO, formatPrice } from '@veline/shared'
import { ButtonLink, Card, Eyebrow, cx } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { DoorMotif, Glow } from '../components/Ornaments'
import { Texto, useIdioma, type Clave } from '../i18n/idioma'
import { EXTRAS, FAQ, PRUEBA_DIAS } from '../content/precios'

/**
 * Precios, para que no quede ninguna duda de qué se paga y qué se lleva.
 *
 * Había tres tarjetas y dos de ellas (Negocio y Equipo) costaban lo mismo
 * con las mismas plazas: la diferencia estaba en letra pequeña. Ahora:
 *
 *   1. Dos planes de verdad: la prueba gratis y Negocio. Equipo no es otro
 *      precio, es el mismo plan con más gente o más locales, y se cierra
 *      hablando: va en una franja aparte, no en una tarjeta que compita.
 *   2. Una calculadora: cuántas personas atienden → cuánto es al mes. Es la
 *      única cuenta que hace alguien antes de contratar.
 *   3. «Qué incluye» como lista única y «Qué va aparte» con los servicios
 *      que se contratan por separado. Nada escondido.
 */

const NEGOCIO_INCLUYE: Clave[] = [
  'pre.negocioF1',
  'pre.negocioF2',
  'pre.negocioF3',
  'pre.negocioF4',
  'pre.negocioF5',
  'pre.negocioFichaje',
  'pre.negocioF6',
]

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
  const negocio = PLAN_INFO.NEGOCIO

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

      {/* DOS PLANES */}
      <div className="relative mx-auto mt-12 grid max-w-[920px] gap-6 md:grid-cols-2">
        <Reveal variant="zoom">
          <Card className="flex h-full flex-col p-7 sm:p-8">
            <div className="font-display text-subheading font-semibold text-ink">
              {t('pre.pruebaNombre')}
            </div>
            <div className="mt-1 mb-6 text-body text-muted">{t('pre.pruebaTagline')}</div>
            <div className="mb-6 flex items-baseline gap-1.5">
              <span className="font-display text-display font-semibold text-ink">
                {t('pre.gratis')}
              </span>
              <span className="text-body font-medium text-muted">
                {t('pre.pruebaPeriodo', { n: PRUEBA_DIAS })}
              </span>
            </div>
            <ButtonLink to="/alta" variant="secondary" size="lg" block className="mb-6">
              {t('pre.empezarPrueba')}
            </ButtonLink>
            <ul className="flex flex-col gap-2.5">
              <Feature>{t('pre.pruebaIncluye', { n: PRUEBA_DIAS })}</Feature>
              <Feature>{t('pre.pruebaF2')}</Feature>
              <Feature>{t('pre.pruebaF3')}</Feature>
              <Feature>{t('pre.pruebaF4')}</Feature>
            </ul>
          </Card>
        </Reveal>

        <Reveal variant="zoom" delay={100}>
          <Card className="relative flex h-full flex-col border-2 border-brand p-7 shadow-pop sm:p-8">
            <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-caption font-semibold text-white">
              {t('pre.masElegido')}
            </span>
            <div className="font-display text-subheading font-semibold text-ink">
              {t('pre.negocioNombre')}
            </div>
            <div className="mt-1 mb-6 text-body text-muted">{t('pre.negocioTagline')}</div>
            <div className="mb-1 flex items-baseline gap-1.5">
              <span className="font-display text-display font-semibold text-ink">
                {formatPrice(negocio.priceCents, idioma)}
              </span>
              <span className="text-body font-medium text-muted">{t('pre.alMes')}</span>
            </div>
            <p className="mb-6 text-meta text-muted">
              {t('pre.calcPista', { extra: formatPrice(negocio.extraSeatCents, idioma) })}
            </p>
            <ButtonLink to="/alta" size="lg" block className="sheen mb-6">
              {t('pre.contratar')}
            </ButtonLink>
            <ul className="flex flex-col gap-2.5">
              {NEGOCIO_INCLUYE.map((f) => (
                <Feature key={f}>{t(f)}</Feature>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      {/* CALCULADORA */}
      <Reveal delay={80} className="mx-auto mt-6 max-w-[920px]">
        <Calculadora />
      </Reveal>

      {/* EQUIPO: el mismo plan, más gente o más locales, se cierra hablando. */}
      <Reveal delay={80} className="mx-auto mt-6 max-w-[920px]">
        <div className="flex flex-col items-start justify-between gap-5 rounded-xl bg-ink p-7 sm:flex-row sm:items-center sm:p-8">
          <div className="min-w-0">
            <h2 className="font-display text-subheading font-semibold text-ondark">
              {t('pre.equipoStrip')}
            </h2>
            <p className="mt-1.5 max-w-[520px] text-body leading-relaxed text-ondark-muted-2">
              {t('pre.equipoStripTexto')}
            </p>
          </div>
          <ButtonLink
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('pre.equipoAsunto'))}`}
            variant="accent"
            size="lg"
            className="shrink-0"
          >
            {t('pre.hablarVentas')}
          </ButtonLink>
        </div>
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
