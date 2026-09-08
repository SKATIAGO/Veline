import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { es } from './es'
import { en } from './en'

/**
 * Los dos idiomas de Veline.
 *
 * Hecho a mano y sin librería a propósito. Lo que se gana no es peso, es esto:
 * el diccionario inglés está tipado contra el español, así que **una
 * traducción que falte no compila**. Con una librería al uso, la clave sin
 * traducir sale en pantalla —o peor, sale en español dentro de la versión
 * inglesa— y nadie se entera hasta que lo ve un cliente.
 *
 * El español es la fuente: es donde se escribe el texto y de donde salen las
 * claves. El inglés solo puede tener exactamente las mismas.
 */

export type Idioma = 'es' | 'en'

/** El español manda: las claves salen de él. */
export type Clave = keyof typeof es

const DICCIONARIOS: Record<Idioma, Record<Clave, string>> = { es, en }

const CLAVE_GUARDADA = 'veline:idioma'

interface Contexto {
  idioma: Idioma
  cambiar: (i: Idioma) => void
  /** El texto de una clave, con los huecos rellenos: t('citas', { n: 3 }). */
  t: (clave: Clave, valores?: Record<string, string | number>) => string
  /** Para fechas y números: 'es-ES' o 'en-GB'. */
  locale: string
}

const Ctx = createContext<Contexto>({
  idioma: 'es',
  cambiar: () => {},
  t: (c) => es[c],
  locale: 'es-ES',
})

/** en-GB y no en-US: el público de Veline está en Europa, y ahí una fecha
    escrita 9/8/2026 significa el 9 de agosto, no el 8 de septiembre. */
const LOCALES: Record<Idioma, string> = { es: 'es-ES', en: 'en-GB' }

function leerGuardado(): Idioma {
  try {
    const v = localStorage.getItem(CLAVE_GUARDADA)
    if (v === 'es' || v === 'en') return v
  } catch {
    // Navegación privada o almacenamiento bloqueado: castellano y a correr.
  }
  return 'es'
}

export function ProveedorIdioma({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(leerGuardado)

  // El atributo lang del documento importa de verdad: es lo que usan los
  // lectores de pantalla para elegir la voz y el navegador para ofrecer
  // traducir la página.
  useEffect(() => {
    document.documentElement.lang = idioma
  }, [idioma])

  const cambiar = useCallback((i: Idioma) => {
    setIdioma(i)
    try {
      localStorage.setItem(CLAVE_GUARDADA, i)
    } catch {
      /* si no se puede recordar, al menos cambia ahora */
    }
  }, [])

  const t = useCallback(
    (clave: Clave, valores?: Record<string, string | number>) => {
      const plantilla = DICCIONARIOS[idioma][clave] ?? es[clave]
      if (!valores) return plantilla
      return plantilla.replace(/\{(\w+)\}/g, (_, k: string) =>
        k in valores ? String(valores[k]) : `{${k}}`,
      )
    },
    [idioma],
  )

  const valor = useMemo<Contexto>(
    () => ({ idioma, cambiar, t, locale: LOCALES[idioma] }),
    [idioma, cambiar, t],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export const useIdioma = () => useContext(Ctx)

/**
 * Singular o plural, eligiendo entre dos claves.
 *
 * No vale con poner una «s»: en castellano «1 cita / 2 citas» y en inglés
 * «1 appointment / 2 appointments» cambian distinto, y hay palabras que ni
 * eso. Con dos claves cada idioma escribe las suyas como le corresponde.
 */
export function usePlural() {
  const { t } = useIdioma()
  return useCallback(
    (n: number, una: Clave, varias: Clave) => t(n === 1 ? una : varias, { n }),
    [t],
  )
}
