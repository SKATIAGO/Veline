import { CATEGORIES } from '@veline/shared'
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
/** Sectores que no salen en el carrusel de la portada (siguen en el buscador). */
const SIN_CARRUSEL: readonly string[] = ['tiendas', 'autoescuelas', 'asesorias', 'veterinarias']

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
        items={[
          ...CATEGORIES.filter((c) => !SIN_CARRUSEL.includes(c.slug)).map((c) =>
            idioma === 'en' ? c.labelEn : c.label,
          ),
          t('home.carruselMasajes'),
          t('home.carruselTatuajes'),
        ]}
      />

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
                <div className="mx-auto mb-5 grid size-[68px] place-items-center rounded-full border border-accent bg-ink font-display text-title text-accent ring-[6px] ring-ink">
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

      {/* TRES BENEFICIOS */}
      <section className="relative overflow-hidden bg-canvas py-20 lg:py-24">
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
                {/* Tarjeta de marca: surface sobre canvas con borde line, sin
                    sombra ni degradados inventados. El acento mostaza solo
                    sobre ink (el icono), como dice el libro de marca. */}
                <div className="lift group relative h-full rounded-xl border border-line bg-surface p-7">
                  <div
                    aria-hidden
                    className="mb-5 grid size-11 place-items-center rounded-full bg-ink text-accent"
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
    </>
  )
}
