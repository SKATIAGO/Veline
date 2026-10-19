import { CATEGORIES, PLAN_INFO, formatPrice } from '@veline/shared'
import { ButtonLink, Card, Eyebrow } from '../components/ui'
import { Reveal } from '../components/Reveal'
import { DoorMotif, Glow, SectorMarquee } from '../components/Ornaments'
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
      <section className="relative mx-auto max-w-[1440px] px-6 py-16 lg:px-16 lg:py-20">
        <Reveal>
          <Eyebrow>{t('home.todoLoQueNecesitas')}</Eyebrow>
          <h2 className="quill mb-10 max-w-[620px] text-heading leading-tight font-semibold text-ink sm:text-display-sm">
            {t('home.tresCosas')}
          </h2>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-3">
          {BENEFICIOS.map((d, i) => (
            <Reveal key={d.titulo} delay={i * 80} variant="zoom">
              <Card className="lift group h-full p-6">
                <div className="mb-2 font-display text-subheading font-semibold text-ink transition-colors duration-300 group-hover:text-brand">
                  {t(d.titulo)}
                </div>
                <p className="text-body leading-relaxed text-muted">{t(d.texto)}</p>
              </Card>
            </Reveal>
          ))}
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
        <div className="relative mx-auto max-w-[1440px] px-6 py-16 lg:px-16 lg:py-20">
          <Reveal>
            <h2 className="mb-12 text-center text-heading font-semibold text-ink sm:text-display-sm">
              {t('home.comoFunciona')}
            </h2>
          </Reveal>
          <div className="relative flex flex-col gap-10 sm:flex-row">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-[22px] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent sm:block"
            />
            {PASOS.map((paso, i) => (
              <Reveal key={paso.titulo} delay={i * 140} className="relative flex-1 text-center">
                <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-ink font-semibold text-cream ring-8 ring-canvas">
                  {i + 1}
                </div>
                <div className="mb-2 text-ui font-semibold text-ink">{t(paso.titulo)}</div>
                <p className="mx-auto max-w-[280px] text-body leading-relaxed text-muted">
                  {t(paso.texto)}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PRECIO EN UNA LÍNEA */}
      <section className="relative mx-auto max-w-[1440px] px-6 py-16 lg:px-16 lg:py-20">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-line bg-surface p-7 sm:flex-row sm:items-center sm:p-8">
            <div className="min-w-0">
              <Eyebrow>{t('home.precioEyebrow')}</Eyebrow>
              <p className="max-w-[560px] text-ui leading-relaxed text-body">
                {t('home.precioLinea', {
                  precio: formatPrice(PLAN_INFO.NEGOCIO.priceCents, idioma),
                  n: PRUEBA_DIAS,
                })}
              </p>
              <p className="mt-2 text-meta text-muted">
                {t('home.masServicios')}{' '}
                <a href="/precios#extras" className="font-semibold text-brand-text hover:underline">
                  {t('home.verServicios')}
                </a>
              </p>
            </div>
            <ButtonLink to="/precios" variant="secondary" size="lg" className="shrink-0">
              {t('home.precioBoton')}
            </ButtonLink>
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
