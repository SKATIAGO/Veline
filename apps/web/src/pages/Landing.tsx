import { CATEGORIES, PLAN_INFO, formatPrice } from '@veline/shared'
import { ButtonLink } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { DoorMotif, Filete, Glow, SectorMarquee } from '../components/Ornaments'
import { DESTACADOS, ESLOGAN, ESLOGAN_NEGOCIO } from '../content/negocio'
import { PRUEBA_DIAS } from '../content/precios'
import { useIdioma, type Clave } from '../i18n/idioma'

/**
 * La portada, en cinco cosas: qué es (con el vídeo del panel), tres
 * beneficios, cómo funciona en tres pasos, el precio en una línea y la
 * llamada final. Un solo botón principal: empezar la prueba.
 *
 * Antes había siete secciones y unas cuarenta frases: la lista de cinco
 * ventajas, la de ocho servicios «Plus» y un bloque de servicios aparte
 * repetían lo que el vídeo ya cuenta. Lo que no cabe aquí se enlaza
 * (precios, servicios aparte), no se explica.
 */

const PASOS = [
  { titulo: 'home.paso1', texto: 'home.paso1Texto' },
  { titulo: 'home.paso2', texto: 'home.paso2Texto' },
  { titulo: 'home.paso3', texto: 'home.paso3Texto' },
] as const satisfies readonly { titulo: Clave; texto: Clave }[]

/** Los tres beneficios que más pesan del brief; el resto está en el vídeo y en Precios. */
const BENEFICIOS = DESTACADOS.slice(0, 3)

const ICONOS = [
  <svg
    key="a"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>,
  <svg
    key="b"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-4 3.2-6 6.5-6s5.9 2 6.5 6M16 5a3.2 3.2 0 0 1 0 6M18 14c2 .6 3.2 2.6 3.5 6" />
  </svg>,
  <svg
    key="c"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>,
]

export function Landing() {
  const { t, idioma } = useIdioma()

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

        <div className="relative mx-auto flex max-w-[1440px] flex-col items-center gap-12 px-6 py-16 lg:flex-row lg:px-16 lg:py-24">
          <div className="min-w-0 flex-1">
            <p className="rise mb-5 text-meta font-semibold tracking-[0.08em] text-accent uppercase">
              {t(ESLOGAN)}
            </p>
            <h1
              className="rise text-display-sm leading-[1.12] font-semibold text-ondark sm:text-display lg:text-display-lg"
              style={{ animationDelay: '80ms' }}
            >
              {t(ESLOGAN_NEGOCIO)}
            </h1>
            <p
              className="rise mt-5 mb-6 max-w-[500px] text-lead leading-relaxed text-ondark-muted-2"
              style={{ animationDelay: '160ms' }}
            >
              {t('home.entradilla')}
            </p>
            <div
              className="rise mb-8 max-w-[500px] rounded-xl border border-accent/40 bg-white/5 p-4"
              style={{ animationDelay: '200ms' }}
            >
              <p className="mb-1 text-caption font-semibold tracking-[0.08em] text-accent uppercase">
                {t('home.preBadge')}
              </p>
              <p className="text-body leading-relaxed text-ondark">{t('home.preIntro')}</p>
            </div>
            <div
              className="rise flex flex-wrap items-center gap-3"
              style={{ animationDelay: '240ms' }}
            >
              <ButtonLink to="/alta" variant="accent" size="lg" className="sheen">
                {t('home.empezarGratis', { n: PRUEBA_DIAS })}
              </ButtonLink>
              <a
                href="#como-funciona"
                className="inline-flex min-h-12 items-center px-2 text-body font-semibold text-ondark hover:underline"
              >
                {t('home.verComoFunciona')}
              </a>
            </div>
            <p
              className="rise mt-5 text-meta font-medium text-ondark-muted"
              style={{ animationDelay: '320ms' }}
            >
              {t('home.pruebaDias', { n: PRUEBA_DIAS })}
            </p>
          </div>

          <div
            className="rise float h-[280px] w-full flex-1 overflow-hidden rounded-2xl bg-ink-2 lg:h-[400px]"
            style={{ animationDelay: '120ms' }}
          >
            {/* Muted + playsInline: sin esto los navegadores (sobre todo en
                móvil) bloquean el autoplay. En bucle porque es la vista
                previa del panel, no un anuncio con final. */}
            <video
              className="size-full object-cover"
              src="/video/promo.mp4"
              poster="/video/promo-poster.jpg"
              preload="auto"
              autoPlay
              muted
              loop
              playsInline
              aria-label={t('home.videoAlt')}
            />
          </div>
        </div>
      </section>

      <SectorMarquee
        items={CATEGORIES.filter((c) => c.slug !== 'tiendas').map((c) =>
          idioma === 'en' ? c.labelEn : c.label,
        )}
      />

      {/* TRES BENEFICIOS */}
      <section className="relative overflow-hidden bg-[radial-gradient(900px_400px_at_50%_0,#f7eedf,transparent)] py-20 lg:py-24">
        <div className="relative mx-auto max-w-[1440px] px-6 text-center lg:px-16">
          <Reveal>
            <Filete />
            <p className="mb-3 text-meta font-semibold tracking-[0.22em] text-brand-text uppercase">
              {t('home.todoLoQueNecesitas')}
            </p>
            <h2 className="mx-auto mb-12 max-w-[620px] text-heading leading-tight font-semibold text-ink sm:text-display-sm">
              {t('home.tresCosas')}
            </h2>
          </Reveal>
          <div className="grid gap-6 text-left sm:grid-cols-3">
            {BENEFICIOS.map((d, i) => (
              <Reveal key={d.titulo} delay={i * 80} variant="zoom">
                <div className="lift group relative h-full rounded-2xl border border-[#d9c299] bg-gradient-to-br from-[#f8f0e2] to-[#efe2cb] p-7 shadow-[0_1px_0_#fff_inset,0_24px_40px_-26px_rgba(46,33,25,.45)]">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-2.5 left-2.5 size-5 rounded-tl-lg border-t border-l border-accent"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-2.5 bottom-2.5 size-5 rounded-br-lg border-r border-b border-accent"
                  />
                  <div
                    aria-hidden
                    className="mb-5 grid size-11 place-items-center rounded-full bg-ink text-accent ring-4 ring-accent/30"
                  >
                    {ICONOS[i]}
                  </div>
                  <div className="mb-2 font-display text-subheading font-semibold text-ink transition-colors duration-300 group-hover:text-brand">
                    {t(d.titulo)}
                  </div>
                  <p className="text-body leading-relaxed text-muted">{t(d.texto)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="relative scroll-mt-24 overflow-hidden bg-ink">
        <Glow className="top-[-160px] left-[-120px]" color="rgba(205,174,116,.18)" size={700} />
        <Glow className="right-[-140px] bottom-[-200px]" color="rgba(164,102,57,.28)" size={640} />
        <div className="relative mx-auto max-w-[1440px] px-6 py-20 text-center lg:px-16 lg:py-24">
          <Reveal>
            <Filete />
            <h2 className="mb-14 text-heading font-semibold text-cream sm:text-display-sm">
              {t('home.comoFunciona')}
            </h2>
          </Reveal>
          <div className="relative flex flex-col gap-10 sm:flex-row">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-[34px] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-accent to-transparent sm:block"
            />
            {PASOS.map((paso, i) => (
              <Reveal key={paso.titulo} delay={i * 140} className="relative flex-1 text-center">
                <div className="mx-auto mb-5 grid size-[68px] place-items-center rounded-full border border-accent bg-ink font-display text-2xl text-accent shadow-[0_0_0_6px_#2e2119,0_0_30px_rgba(205,174,116,.25)]">
                  {i + 1}
                </div>
                <div className="mb-2 text-ui font-semibold text-cream">{t(paso.titulo)}</div>
                <p className="mx-auto max-w-[290px] text-body leading-relaxed text-ondark-muted">
                  {t(paso.texto)}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIO: AHORA GRATIS, Y LO QUE COSTARÁ DESPUÉS */}
      <section className="relative mx-auto max-w-[1440px] px-6 py-20 lg:px-16 lg:py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[26px] border border-accent/50 bg-gradient-to-br from-ink-2 via-ink to-[#241811] p-8 text-cream shadow-[0_40px_70px_-35px_rgba(46,33,25,.7),0_0_0_6px_rgba(205,174,116,.12)] sm:p-14">
            <Glow
              className="top-[-160px] right-[-120px]"
              color="rgba(205,174,116,.28)"
              size={520}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-3.5 rounded-2xl border border-accent/25"
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
              <div>
                <p className="text-meta font-semibold tracking-[0.22em] text-accent uppercase">
                  {t('pre.pruebaNombre')}
                </p>
                <h2 className="mt-3 mb-4 bg-gradient-to-b from-[#f3dfb2] via-accent to-[#b89150] bg-clip-text font-display text-[48px] leading-none font-semibold text-transparent sm:text-[64px]">
                  {t('home.ahoraGratis')}
                </h2>
                <p className="max-w-[470px] text-ui leading-relaxed text-ondark-muted-2">
                  {t('home.ahoraTexto')}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink to="/alta" variant="accent" size="lg" className="sheen">
                    {t('home.empezarGratis')}
                  </ButtonLink>
                  <ButtonLink to="/precios" variant="ghost-dark" size="lg">
                    {t('home.precioBoton')}
                  </ButtonLink>
                </div>
              </div>
              <div className="border-t border-accent/40 pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
                <p className="mb-2 text-meta tracking-[0.18em] text-ondark-muted uppercase">
                  {t('home.despuesLanzamiento')}
                </p>
                <p className="font-display text-[46px] leading-none text-cream">
                  {formatPrice(PLAN_INFO.NEGOCIO.priceCents, idioma)}{' '}
                  <span className="text-ui text-ondark-muted">{t('home.alMes')}</span>
                </p>
                <ul className="mt-4 flex flex-col gap-1.5 text-body text-ondark-muted-2">
                  {(['home.despuesF1', 'home.despuesF2', 'home.despuesF3'] as const).map((k) => (
                    <li key={k} className="flex items-center gap-2.5">
                      <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
                      {t(k, { extra: formatPrice(PLAN_INFO.NEGOCIO.extraSeatCents, idioma) })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* CIERRE */}
      <section className="relative overflow-hidden border-t border-line">
        <Glow
          className="bottom-[-220px] left-1/2 -translate-x-1/2"
          color="rgba(169,106,62,.16)"
          size={640}
        />
        <div className="relative mx-auto max-w-[1440px] px-6 py-20 text-center lg:px-16">
          <Reveal variant="zoom">
            <p className="font-display text-heading leading-tight font-semibold text-ink sm:text-display-sm">
              {t(ESLOGAN)}
            </p>
            <p className="mx-auto mt-4 mb-8 max-w-[460px] text-ui leading-relaxed text-muted">
              {t('home.pruebaloYDecide', { n: PRUEBA_DIAS })}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink to="/alta" variant="dark" size="lg" className="sheen">
                {t('home.empezarGratis', { n: PRUEBA_DIAS })}
              </ButtonLink>
              <ButtonLink to="/panel" variant="secondary" size="lg">
                {t('home.verPanel')}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
