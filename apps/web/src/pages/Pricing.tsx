import { useState } from 'react'
import { CONTACT_EMAIL, formatPrice } from '@veline/shared'
import { ButtonLink, Card, Eyebrow, cx } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { DoorMotif, Glow, QuoteMark } from '../components/Ornaments'
import { Texto, useIdioma, type Clave } from '../i18n/idioma'
import { EXTRAS, FAQ, PLANES, PRUEBA_DIAS } from '../content/precios'

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2.5 text-body leading-relaxed text-body-2">
      <span className="shrink-0 font-bold text-brand-text">✓</span>
      {children}
    </li>
  )
}

/**
 * Pregunta desplegable. Antes era un <details> nativo: correcto, pero el
 * contenido aparecía de golpe porque los navegadores no animan su apertura.
 * Con la fila controlada a mano, un grid de 0fr a 1fr hace que el texto
 * se despliegue como una cortina en vez de aparecer con un salto.
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
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-ui font-semibold text-ink transition-colors duration-200 hover:bg-cream/60"
      >
        {t(q, { n: PRUEBA_DIAS })}
        <span
          aria-hidden="true"
          className={cx(
            'shrink-0 text-xl leading-none text-brand-text transition-transform duration-300',
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

export function Pricing() {
  const { t, idioma } = useIdioma()

  return (
    // overflow-x-clip: el halo decorativo mide 620 px y va centrado, así que en
    // un móvil de 375 asomaba 122 px por cada lado y la página entera se movía
    // de lado. Se recorta en vez de ocultarse («clip» y no «hidden») para no
    // convertir esto en un contenedor de scroll.
    <div className="relative mx-auto max-w-[1440px] overflow-x-clip px-6 py-16 lg:px-16">
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
          {t('pre.titulo')}
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-base leading-relaxed text-body">
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
                'lift relative flex h-full flex-col p-8',
                plan.popular && 'border-2 border-brand shadow-pop',
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-caption font-semibold text-white">
                  {t('pre.masElegido')}
                </span>
              )}
              <div className="font-display text-lg font-semibold text-ink">{t(plan.nombre)}</div>
              <div className="mt-1.5 mb-6 text-body text-subtle">{t(plan.tagline)}</div>
              <div className="mb-6 flex items-baseline gap-1.5">
                <span className="font-display text-[40px] font-semibold text-ink">
                  {plan.priceCents !== undefined
                    ? `${plan.pricePrefix ?? ''}${formatPrice(plan.priceCents, idioma)}`
                    : plan.precio
                      ? t(plan.precio)
                      : ''}
                </span>
                <span className="text-sm font-medium text-subtle">
                  {t(plan.periodo, { n: PRUEBA_DIAS })}
                </span>
              </div>
              {/* `to` para las pantallas de Veline y `href` para salir fuera
                  (el mailto de Equipo). Con href a una ruta interna el
                  navegador recargaría la aplicación entera. */}
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
                className={cx('mb-7', plan.popular && 'sheen')}
              >
                {t(plan.cta)}
              </ButtonLink>
              <ul className="flex flex-col gap-3">
                {plan.features.map((f) => (
                  <Feature key={f}>{t(f)}</Feature>
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

      {/* EXTRAS */}
      <section className="relative mt-24">
        <Reveal>
          <Eyebrow>{t('pre.serviciosAparte')}</Eyebrow>
          <h2 className="quill mb-6 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
            {t('pre.siQuieresMas')}
          </h2>
          <p className="mb-10 max-w-[560px] text-ui leading-relaxed text-body">
            {t('pre.extrasTexto')}
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2">
          {EXTRAS.map((extra, i) => (
            <Reveal key={extra.nombre} delay={i * 90} variant={i % 2 === 0 ? 'left' : 'right'}>
              <Card className="lift flex h-full flex-col p-7">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-semibold text-ink">
                    {t(extra.nombre)}
                  </span>
                  <span className="rounded-full bg-cream px-3 py-1 text-meta font-semibold text-brand-text">
                    {t(extra.precio)}
                  </span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {extra.items.map((item) => (
                    <Feature key={item}>{t(item)}</Feature>
                  ))}
                </ul>
                <p className="mt-4 text-meta text-subtle">{t(extra.nota)}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* RESEÑAS */}
      <section className="mt-24">
        <Reveal>
          <Eyebrow>{t('pre.resenasNombre')}</Eyebrow>
          <h2 className="quill mb-6 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
            {t('pre.loQueDicen')}
          </h2>
          <p className="mb-10 max-w-[620px] text-ui leading-relaxed text-body">
            {t('pre.resenasPendientes')}
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Reveal key={i} delay={i * 110} variant="zoom">
              <div className="lift flex min-h-[200px] flex-col justify-between rounded-xl border border-dashed border-ph-border bg-ph-bg/40 p-6">
                <QuoteMark className="mb-3 text-ph-border" />
                <p className="flex-1 text-ui leading-relaxed text-ph-text">
                  {t('pre.resenaHueco')}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="size-10 shrink-0 rounded-full border border-dashed border-ph-border bg-ph-bg" />
                  <div>
                    <div className="text-body font-semibold text-ph-text">
                      {t('pre.nombreYNegocio')}
                    </div>
                    <div className="text-meta text-ph-text/80">{t('pre.sectorCiudad')}</div>
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
          <Eyebrow>{t('pre.preguntas')}</Eyebrow>
          <h2 className="quill mb-10 max-w-[620px] text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
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
      <Reveal variant="zoom" as="section" className="mt-24 text-center">
        <p className="font-display text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
          {t('pre.pruebaloSinCompromiso', { n: PRUEBA_DIAS })}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/alta" size="lg" className="sheen">
            {t('pre.empezarPrueba')}
          </ButtonLink>
          <ButtonLink to="/" variant="secondary" size="lg">
            {t('pre.verTodoIncluye')}
          </ButtonLink>
        </div>
      </Reveal>
    </div>
  )
}
