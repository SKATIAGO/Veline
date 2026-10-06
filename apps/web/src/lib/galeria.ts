import { useMemo } from 'react'
import { formatDuration, formatPrice, type BusinessDTO } from '@veline/shared'
import type { FotoGaleria } from '../components/Galeria'
import { useIdioma } from '../i18n/idioma'

/** De dónde sale una foto: para saber en cuál abrir el visor. */
export type OrigenFoto = { de: 'local'; n: number } | { de: 'servicio' | 'extra'; id: string }

/**
 * Todas las fotos de un negocio, en el orden en que se ven al pasarlas: las
 * del local, luego las de sus servicios y al final las de los extras. Cada una
 * lleva su nombre y lo que cuesta, para que al verla ampliada se sepa qué es
 * sin tener que volver atrás: un servicio y un extra se parecen mucho en una
 * foto.
 *
 * `indiceDe` devuelve en qué posición está una foto, para abrir el visor justo
 * en la que se ha tocado.
 */
export function useFotosNegocio(business: BusinessDTO | undefined) {
  const { t, idioma } = useIdioma()

  return useMemo(() => {
    const fotos: FotoGaleria[] = []
    const posiciones = new Map<string, number>()
    if (!business) return { fotos, indiceDe: () => null as number | null }

    business.photos.forEach((src, n) => {
      posiciones.set(`local:${n}`, fotos.length)
      fotos.push({ src, titulo: business.name, detalle: t('galeria.local') })
    })
    for (const s of business.services) {
      if (!s.photo) continue
      posiciones.set(`servicio:${s.id}`, fotos.length)
      fotos.push({
        src: s.photo,
        titulo: s.name,
        detalle: `${t('galeria.servicio')} · ${formatDuration(s.durationMin, idioma)} · ${formatPrice(s.priceCents, idioma)}`,
      })
    }
    for (const e of business.extras) {
      if (!e.photo) continue
      posiciones.set(`extra:${e.id}`, fotos.length)
      fotos.push({
        src: e.photo,
        titulo: e.name,
        detalle: [
          t('galeria.extra'),
          `+${formatPrice(e.priceCents, idioma)}`,
          e.durationMin > 0 ? `+${formatDuration(e.durationMin, idioma)}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      })
    }

    const indiceDe = (o: OrigenFoto) =>
      posiciones.get(o.de === 'local' ? `local:${o.n}` : `${o.de}:${o.id}`) ?? null
    return { fotos, indiceDe }
  }, [business, t, idioma])
}
