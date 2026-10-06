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
  onOpen,
  className,
}: {
  src: string
  /** Qué es, para el lector de pantalla: «Ver la foto de Tinte». */
  nombre: string
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
    </button>
  )
}

/**
 * Lo que se enseña en el resumen de la reserva para ver cómo es lo que se
 * reserva: la foto del servicio y un enlace a todas las demás (local, otros
 * servicios, extras). Mientras se elige fecha o se confirma, es justo cuando
 * más se quiere comprobar que es lo que se esperaba.
 */
export function AtajoFotos({
  fotoServicio,
  nombreServicio,
  total,
  onVerServicio,
  onVerTodas,
}: {
  fotoServicio: string | null
  nombreServicio: string
  /** Cuántas fotos hay en total en el negocio. */
  total: number
  onVerServicio: () => void
  onVerTodas: () => void
}) {
  const { t } = useIdioma()
  if (!fotoServicio && total === 0) return null
  return (
    <div className="mb-4 flex items-center gap-3">
      {fotoServicio && (
        <FotoAmpliable
          src={fotoServicio}
          nombre={nombreServicio}
          lado={64}
          className="size-16 rounded-xl"
          onOpen={onVerServicio}
        />
      )}
      {total > 0 && (
        <button
          type="button"
          onClick={onVerTodas}
          className="inline-flex min-h-10 items-center text-meta font-semibold text-brand-text hover:underline"
        >
          {t('ficha.verFotos', { n: total })}
        </button>
      )}
    </div>
  )
}
