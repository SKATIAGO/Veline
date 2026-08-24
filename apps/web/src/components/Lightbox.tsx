import { useCallback, useEffect } from 'react'
import { photoSrc } from './Photo'
import { cx } from './ui'

interface LightboxProps {
  photos: string[]
  /** Índice visible, o null cuando está cerrado. */
  index: number | null
  onIndex: (i: number) => void
  onClose: () => void
  title: string
}

/**
 * Visor de la galería. Teclado completo (← → Esc), clic fuera para cerrar y
 * bloqueo del scroll de fondo mientras está abierto.
 */
export function Lightbox({ photos, index, onIndex, onClose, title }: LightboxProps) {
  const open = index !== null && photos.length > 0

  const go = useCallback(
    (delta: number) => {
      if (index === null) return
      onIndex((index + delta + photos.length) % photos.length)
    },
    [index, onIndex, photos.length],
  )

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }

    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, go, onClose])

  // Las fotos contiguas se precargan para que el salto sea instantáneo
  useEffect(() => {
    if (index === null) return
    for (const delta of [1, -1]) {
      const next = photos[(index + delta + photos.length) % photos.length]
      if (next) new Image().src = photoSrc(next, 1600, 1100)
    }
  }, [index, photos])

  if (!open || index === null) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${title}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-sm"
    >
      {/* Barra superior */}
      <div className="flex shrink-0 items-center justify-between px-5 py-4">
        <span className="text-meta font-medium text-ondark-muted">
          {index + 1} / {photos.length} · {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar galería"
          className="flex size-10 items-center justify-center rounded-full text-2xl leading-none text-ondark transition-colors hover:bg-ondark/15"
        >
          ×
        </button>
      </div>

      {/* Imagen */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        <img
          key={photos[index]}
          src={photoSrc(photos[index]!, 1600, 1100)}
          alt={`${title} — foto ${index + 1}`}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
      </div>

      {/* Flechas */}
      {photos.length > 1 && (
        <>
          <NavArrow side="left" onClick={() => go(-1)} />
          <NavArrow side="right" onClick={() => go(1)} />
        </>
      )}

      {/* Miniaturas */}
      {photos.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 justify-center gap-2 overflow-x-auto px-5 pb-5"
        >
          {photos.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === index}
              className={cx(
                'h-14 w-20 shrink-0 overflow-hidden rounded-lg transition-opacity',
                i === index ? 'ring-2 ring-accent' : 'opacity-55 hover:opacity-100',
              )}
            >
              <img src={photoSrc(p, 160, 112)} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NavArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Foto anterior' : 'Foto siguiente'}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cx(
        'absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-ondark/10 text-2xl text-ondark transition-colors hover:bg-ondark/25',
        side === 'left' ? 'left-3 sm:left-6' : 'right-3 sm:right-6',
      )}
    >
      {side === 'left' ? '‹' : '›'}
    </button>
  )
}
