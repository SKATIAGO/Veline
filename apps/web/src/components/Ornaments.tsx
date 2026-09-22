import { useId } from 'react'
import { cx } from './ui'

/**
 * Adornos de marca. Todos salen del propio proyecto de identidad, no de
 * decoración genérica: el toldo festoneado es la opción 2c del logo y las
 * hojas entornadas son el isotipo elegido (2a).
 *
 * Son puramente decorativos: aria-hidden y sin capturar el ratón.
 */

/** Toldo de comercio de barrio. Sirve de remate entre secciones. */
export function Awning({
  className,
  tone = 'brand',
  flip,
}: {
  className?: string
  tone?: 'brand' | 'ink' | 'accent'
  flip?: boolean
}) {
  const fill = tone === 'ink' ? '#2E2119' : tone === 'accent' ? '#CDAE74' : '#A96A3E'
  const alt = tone === 'ink' ? '#3B2A1F' : tone === 'accent' ? '#B7935A' : '#8E5734'

  return (
    <div
      aria-hidden="true"
      className={cx('pointer-events-none w-full overflow-hidden leading-[0]', className)}
      style={flip ? { transform: 'rotate(180deg)' } : undefined}
    >
      <svg
        viewBox="0 0 120 14"
        preserveAspectRatio="none"
        className="h-3.5 w-full sm:h-4"
        role="presentation"
      >
        <defs>
          <pattern
            id={`awning-${tone}${flip ? '-f' : ''}`}
            width="20"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <polygon points="0,0 10,0 5,13" fill={fill} />
            <polygon points="10,0 20,0 15,13" fill={alt} />
          </pattern>
        </defs>
        <rect width="120" height="14" fill={`url(#awning-${tone}${flip ? '-f' : ''})`} />
      </svg>
    </div>
  )
}

/** Las dos hojas del isotipo, flotando de fondo. */
export function DoorMotif({
  className,
  size = 180,
  tilt = -9,
  opacity = 0.07,
  tone = '#A96A3E',
  delay = 0,
}: {
  className?: string
  size?: number
  tilt?: number
  opacity?: number
  tone?: string
  delay?: number
}) {
  return (
    <div
      aria-hidden="true"
      className={cx('float pointer-events-none absolute', className)}
      style={
        {
          '--tilt': `${tilt}deg`,
          animationDelay: `${delay}ms`,
          opacity,
        } as React.CSSProperties
      }
    >
      <svg width={size} height={size * (56 / 60)} viewBox="0 0 60 56">
        <rect x="6" y="6" width="18" height="44" rx="4" fill={tone} transform="rotate(-9 15 28)" />
        <rect x="36" y="6" width="18" height="44" rx="4" fill={tone} transform="rotate(9 45 28)" />
      </svg>
    </div>
  )
}

/** Halo cálido difuso, para dar profundidad a los fondos planos. */
export function Glow({
  className,
  color = 'rgba(169,106,62,.28)',
  size = 520,
}: {
  className?: string
  color?: string
  size?: number
}) {
  return (
    <div
      aria-hidden="true"
      className={cx('pointer-events-none absolute rounded-full blur-3xl', className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
      }}
    />
  )
}

/**
 * Mezcla orgánica de marrones y crema, tipo mármol o veta de madera, para
 * fondos que piden más presencia que un halo circular pero sin competir con
 * el contenido de encima.
 *
 * No es una imagen: es ruido de baja frecuencia (feTurbulence) usado como
 * máscara de opacidad sobre un degradado de marca. Con baja frecuencia el
 * ruido forma manchas grandes y suaves en vez de estática — es la misma
 * técnica que el grano de la portada (feTurbulence + feColorMatrix), solo que
 * ahí la frecuencia es alta a propósito, para que se vea como grano de papel
 * y no como esto.
 */
export function MarbleWash({
  className,
  seed = 7,
}: {
  className?: string
  /** Cada semilla da una mancha distinta; útil para no repetir el mismo
      dibujo en dos secciones de la misma pantalla. */
  seed?: number
}) {
  const crudo = useId().replace(/[^a-zA-Z0-9]/g, '')
  const filtro = `marble-${crudo}`
  const degradado = `wash-${crudo}`

  return (
    <div
      aria-hidden="true"
      className={cx('pointer-events-none absolute overflow-hidden', className)}
      style={{
        // Sin esto el rectángulo del propio SVG se nota como un corte recto:
        // la mancha se desvanece por dentro, pero la caja que la contiene no.
        maskImage: 'radial-gradient(circle at 62% 38%, black 35%, transparent 72%)',
        WebkitMaskImage: 'radial-gradient(circle at 62% 38%, black 35%, transparent 72%)',
      }}
    >
      <svg className="size-full" preserveAspectRatio="none">
        <defs>
          <filter id={filtro} x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.007 0.012"
              numOctaves={4}
              seed={seed}
              result="ruido"
            />
            {/* R,G,B a cero; el alfa pasa a ser el promedio de los tres
                canales del ruido: lo que queda es una máscara de opacidad,
                no una imagen con su propio color. */}
            <feColorMatrix
              in="ruido"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0"
              result="mascaraCruda"
            />
            {/* Curva de contraste: sin esto la mancha es una niebla uniforme;
                con ella se separan zonas claras y oscuras, como una veta. */}
            <feComponentTransfer in="mascaraCruda" result="mascara">
              <feFuncA type="gamma" amplitude={1.5} exponent={2.6} offset={0} />
            </feComponentTransfer>
            <feComposite in="SourceGraphic" in2="mascara" operator="in" />
          </filter>
          <linearGradient id={degradado} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F2E7D6" />
            <stop offset="45%" stopColor="#CDAE74" />
            <stop offset="100%" stopColor="#8C5833" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${degradado})`} filter={`url(#${filtro})`} />
      </svg>
    </div>
  )
}

/** Cinta de sectores en bucle: recuerda que Veline vale para cualquier rubro. */
export function SectorMarquee({ items }: { items: readonly string[] }) {
  const fila = [...items, ...items]
  return (
    <div
      aria-hidden="true"
      className="marquee relative overflow-hidden border-y border-line bg-cream py-4 select-none"
    >
      {/* Difuminado en los bordes para que no se corte en seco */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-cream to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-cream to-transparent" />
      <div className="marquee-track">
        {fila.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center whitespace-nowrap">
            <span className="px-6 font-display text-[17px] font-medium text-body-2 sm:text-[19px]">
              {item}
            </span>
            <span className="size-1.5 rounded-full bg-accent" />
          </span>
        ))}
      </div>
    </div>
  )
}

/** Comillas decorativas para las reseñas. */
export function QuoteMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 44 32"
      className={cx('h-7 w-9', className)}
      fill="currentColor"
    >
      <path d="M0 32V18.4C0 8.9 5.3 2.4 15.4 0l2.2 4.9C11.4 6.8 8.3 10.3 8.3 15h6.9V32H0Zm26.4 0V18.4C26.4 8.9 31.7 2.4 41.8 0L44 4.9c-6.2 1.9-9.3 5.4-9.3 10.1h6.9V32H26.4Z" />
    </svg>
  )
}
