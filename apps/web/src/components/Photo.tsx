import { useCallback, useState } from 'react'
import { cx } from './ui'

/**
 * Las fotos se guardan sin parámetros de tamaño. Unsplash recorta y comprime
 * en su CDN, así que cada sitio pide exactamente lo que necesita en vez de
 * bajarse la original.
 */
function sized(url: string, w: number, h: number) {
  if (!url.startsWith('https://images.unsplash.com/')) return url
  return `${url}?auto=format&fit=crop&w=${w}&h=${h}&q=70`
}

interface PhotoProps {
  src: string | null | undefined
  alt: string
  /** Ancho y alto del recorte que se pide al CDN, en píxeles. */
  width: number
  height: number
  className?: string
  /** Texto del placeholder cuando no hay foto o falla la carga. */
  fallback?: string
  priority?: boolean
}

export function Photo({
  src,
  alt,
  width,
  height,
  className,
  fallback = 'Foto del negocio',
  priority,
}: PhotoProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Si la imagen ya está en caché puede completarse antes de que React
  // enganche el onLoad, y entonces ese evento no llega nunca. Se comprueba el
  // estado real del nodo al montarlo.
  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true)
  }, [])

  if (!src || failed) {
    return <div className={cx('ph', className)}>{fallback}</div>
  }

  return (
    <div className={cx('relative overflow-hidden bg-ph-bg', className)}>
      <img
        ref={ref}
        src={sized(src, width, height)}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cx(
          'size-full object-cover transition-opacity duration-500',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
