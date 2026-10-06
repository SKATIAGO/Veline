import { useCallback, useMemo, useState } from 'react'
import {
  formatDuration,
  formatPrice,
  type BusinessDTO,
  type ExtraDTO,
  type ServiceDTO,
} from '@veline/shared'
import type { FotoGaleria } from '../components/Galeria'
import { useIdioma } from '../i18n/idioma'

/**
 * Las fotos de cada cosa, por separado.
 *
 * El visor enseña solo las de lo que se ha tocado: abrirlo desde un extra no
 * debe llevar por las fotos del local ni de los servicios, y al llegar a la
 * última no da la vuelta. Cada foto lleva su nombre y lo que cuesta, para que
 * al verla ampliada se sepa qué es sin volver atrás.
 */
export function useFotosNegocio() {
  const { t, idioma } = useIdioma()

  return useMemo(
    () => ({
      deLocal: (b: BusinessDTO): FotoGaleria[] =>
        b.photos.map((src) => ({ src, titulo: b.name, detalle: t('galeria.local') })),

      deServicio: (s: ServiceDTO): FotoGaleria[] =>
        s.photos.map((src) => ({
          src,
          titulo: s.name,
          detalle: `${t('galeria.servicio')} · ${formatDuration(s.durationMin, idioma)} · ${formatPrice(s.priceCents, idioma)}`,
        })),

      deExtra: (e: ExtraDTO): FotoGaleria[] =>
        e.photos.map((src) => ({
          src,
          titulo: e.name,
          detalle: [
            t('galeria.extra'),
            `+${formatPrice(e.priceCents, idioma)}`,
            e.durationMin > 0 ? `+${formatDuration(e.durationMin, idioma)}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        })),
    }),
    [t, idioma],
  )
}

/** Qué fotos se están viendo y en cuál: un solo estado para el visor de la página. */
export function useVisor() {
  const [estado, setEstado] = useState<{ fotos: FotoGaleria[]; index: number } | null>(null)

  const abrir = useCallback((fotos: FotoGaleria[], index = 0) => {
    if (fotos.length > 0) setEstado({ fotos, index })
  }, [])
  const cerrar = useCallback(() => setEstado(null), [])
  const irA = useCallback((index: number) => setEstado((e) => (e ? { ...e, index } : e)), [])

  return { estado, abrir, cerrar, irA }
}
