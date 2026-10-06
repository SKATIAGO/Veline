import { lazy, Suspense } from 'react'
import { Photo } from './Photo'
import { cx } from './ui'
import { useIdioma } from '../i18n/idioma'

/** Una foto del visor, con lo que hace falta para saber qué se está viendo. */
export interface FotoGaleria {
  /** Dirección de la foto, sin parámetros de tamaño. */
  src: string
  /** Qué es: el nombre del servicio, del extra o del local. */
  titulo: string
  /** Una línea más: «Servicio · 45 min · 30 €». */
  detalle?: string
}

/* El visor pesa bastante más que el resto de la ficha y la mayoría de visitas
   no abre ninguna foto: se baja solo al abrirla. */
const Visor = lazy(() => import('./Visor'))

/**
 * Galería de fotos a pantalla completa. Se monta solo con una foto elegida
 * (`index` distinto de null); al cerrarse deja de existir.
 */
export function Galeria({
  fotos,
  index,
  onIndex,
  onClose,
  titulo,
}: {
  fotos: FotoGaleria[]
  /** La foto que se ve, o null con la galería cerrada. */
  index: number | null
  onIndex: (i: number) => void
  onClose: () => void
  /** El negocio, para el lector de pantalla. */
  titulo: string
}) {
  if (index === null || fotos.length === 0) return null
  return (
    <Suspense fallback={null}>
      <Visor
        fotos={fotos}
        index={Math.min(index, fotos.length - 1)}
        onIndex={onIndex}
        onClose={onClose}
        titulo={titulo}
      />
    </Suspense>
  )
}

/**
 * Una foto pequeña que se amplía al tocarla.
 *
 * Una miniatura de 56 px no deja ver nada de lo que se va a comprar; sin una
 * señal de que se puede tocar, nadie lo prueba. La lupa de la esquina es esa
 * señal, y el botón entero es la zona pulsable.
 */
export function FotoAmpliable({
  src,
  nombre,
  lado,
  cuantas = 1,
  onOpen,
  className,
}: {
  src: string
  /** Qué es, para el lector de pantalla: «Ver la foto de Tinte». */
  nombre: string
  /** Cuántas fotos hay detrás: con más de una, la insignia dice cuántas. */
  cuantas?: number
  /** Lado de la miniatura en píxeles (se pide al doble para pantallas nítidas). */
  lado: number
  onOpen: () => void
  className?: string
}) {
  const { t } = useIdioma()
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('galeria.verFotoDe', { nombre })}
      className={cx(
        'group relative shrink-0 cursor-zoom-in overflow-hidden rounded-lg',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      )}
    >
      <Photo
        src={src}
        alt=""
        width={lado * 2}
        height={lado * 2}
        className="size-full transition-transform duration-300 group-hover:scale-105"
        fallback=""
      />
      {cuantas > 1 ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 bottom-1 inline-flex h-5 items-center gap-1 rounded-full bg-ink/70 px-1.5 text-caption font-bold text-cream tabular-nums"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <circle cx="9" cy="10.5" r="1.6" />
            <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
          </svg>
          {cuantas}
        </span>
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-ink/65 text-cream"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="m15 15 5 5M10.5 8v5M8 10.5h5" />
          </svg>
        </span>
      )}
    </button>
  )
}

/**
 * Lo que se enseña en el resumen de la reserva para ver cómo es lo que se
 * reserva: las fotos del servicio y un enlace a las del local. Mientras se
 * elige fecha o se confirma, es justo cuando más se quiere comprobar que es lo
 * que se esperaba.
 */
export function AtajoFotos({
  fotosServicio,
  nombreServicio,
  fotosLocal,
  onVerServicio,
  onVerLocal,
}: {
  fotosServicio: string[]
  nombreServicio: string
  /** Cuántas fotos tiene el local. */
  fotosLocal: number
  onVerServicio: () => void
  onVerLocal: () => void
}) {
  const { t } = useIdioma()
  if (fotosServicio.length === 0 && fotosLocal === 0) return null
  return (
    <div className="mb-4 flex items-center gap-3">
      {fotosServicio[0] && (
        <FotoAmpliable
          src={fotosServicio[0]}
          nombre={nombreServicio}
          lado={64}
          cuantas={fotosServicio.length}
          className="size-16 rounded-xl"
          onOpen={onVerServicio}
        />
      )}
      {fotosLocal > 0 && (
        <button
          type="button"
          onClick={onVerLocal}
          className="inline-flex min-h-10 items-center text-meta font-semibold text-brand-text hover:underline"
        >
          {t('galeria.verFotosLocal', { n: fotosLocal })}
        </button>
      )}
    </div>
  )
}
