import { TIMEZONE, formatDuration, instanteAMadridLocal } from '@veline/shared'
import { useIdioma } from '../../i18n/idioma'

/**
 * Los formatos del fichaje, en el idioma de quien mira. Los usan las dos
 * pantallas (fichar e historial) y los dos diálogos, y todos necesitan lo
 * mismo: la hora, el día y la duración de una jornada, en hora de Madrid.
 */
export function useFormatosFichaje() {
  const { t, idioma, locale } = useIdioma()

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TIMEZONE,
    })

  const dia = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: TIMEZONE,
    })

  const diaCorto = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: TIMEZONE,
    })

  /* La duración la escribe formatDuration, la misma de los servicios: 485 →
     «8 h 5 min». */
  const duracion = (min: number) => formatDuration(min, idioma)

  return { t, hora, dia, diaCorto, duracion }
}

/** Fecha y hora de Madrid en el formato que espera un <input type="datetime-local">. */
export const paraInput = instanteAMadridLocal
