import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

/**
 * El local que se está mirando en el panel.
 *
 * Con varios locales, cada uno tiene sus citas, sus clientes, su horario y sus
 * cierres. Antes el panel los mezclaba todos (la agenda, los clientes) o
 * trabajaba siempre sobre el primero (los cierres), y no había forma de mirar
 * solo uno.
 *
 * Quien administra elige: un local, o todos a la vez. Un empleado ve solo el
 * suyo (el de su ficha de Equipo) y no tiene nada que elegir; si su ficha dice
 * que atiende en todos, elige como quien administra. El servidor aplica lo
 * mismo por su cuenta: esto solo decide qué se pide.
 *
 * La elección se recuerda por negocio en este navegador, para no tener que
 * repetirla cada vez que se abre el panel.
 */

export interface LocalVisible {
  id: string
  name: string
  approved: boolean
}

interface ContextoLocal {
  /** Ya se sabe qué locales ve quien mira. Hasta entonces las pantallas
      esperan: pedir sus datos antes y repetirlos al saberlo doblaba las
      peticiones y hacía parpadear la lista. */
  listo: boolean
  /** Los locales que puede ver quien abre el panel. */
  locales: LocalVisible[]
  /** Si hay algo que elegir: más de un local a la vista. */
  varios: boolean
  /** Si el negocio tiene más de un local, aunque quien mira solo vea el suyo. */
  negocioConVarios: boolean
  /** Si puede mirar todos a la vez. */
  verTodos: boolean
  /** El elegido, o null para «todos». Con uno solo a la vista, ese. */
  actual: string | null
  elegir: (id: string | null) => void
  /** El nombre del elegido, o null con «todos». */
  nombreActual: string | null
  /** Para las pantallas que trabajan sobre UN local (horario, cierres): el
      elegido, o el primero si se están mirando todos. */
  paraEditar: string | null
}

const VACIO: ContextoLocal = {
  listo: true,
  locales: [],
  varios: false,
  negocioConVarios: false,
  verTodos: true,
  actual: null,
  elegir: () => {},
  nombreActual: null,
  paraEditar: null,
}

const Contexto = createContext<ContextoLocal>(VACIO)

const clave = (slug: string) => `veline.local.${slug}`
const leer = (slug: string) => {
  try {
    return localStorage.getItem(clave(slug))
  } catch {
    return null
  }
}
const guardar = (slug: string, id: string | null) => {
  try {
    if (id) localStorage.setItem(clave(slug), id)
    else localStorage.removeItem(clave(slug))
  } catch {
    /* Sin almacenamiento, la elección dura lo que dure la pestaña. */
  }
}

export function LocalProvider({
  slug,
  children,
}: {
  slug: string | undefined
  children: ReactNode
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['panel', slug, 'mis-locales'],
    queryFn: () => api.misLocales(slug!),
    enabled: !!slug,
    staleTime: 60_000,
  })
  // El elegido de cada negocio: cambiar de negocio no arrastra el local del otro.
  const [elegidos, setElegidos] = useState<Record<string, string | null>>({})

  const elegir = useCallback(
    (id: string | null) => {
      if (!slug) return
      guardar(slug, id)
      setElegidos((e) => ({ ...e, [slug]: id }))
    },
    [slug],
  )

  const valor = useMemo<ContextoLocal>(() => {
    if (!slug) return VACIO
    // Sin respuesta (cargando, o un fallo): nada elegido. Si falla, el panel
    // sigue; el servidor, sin local pedido, ya aplica lo que toca a cada uno.
    if (!data) return { ...VACIO, listo: !isLoading }
    const locales = data.locales
    const pedido = slug in elegidos ? elegidos[slug] : leer(slug)
    // Solo vale si es de los que se pueden ver: un local cerrado o ajeno se olvida.
    const valido = pedido && locales.some((l) => l.id === pedido) ? pedido : null
    /* Solo hay un local «elegido» cuando de verdad se ha podido elegir entre
       varios. Con uno solo, o con un empleado de uno, no hay elección: no se
       manda ningún local y el servidor aplica el que toca. Así la clave de las
       consultas no cambia al cargar y no se repite ninguna petición. */
    const actual = locales.length > 1 && data.verTodos ? valido : null
    const unico = locales.length === 1 ? locales[0]! : null
    return {
      listo: true,
      locales,
      varios: locales.length > 1 && data.verTodos,
      negocioConVarios: data.total > 1,
      verTodos: data.verTodos,
      actual,
      elegir,
      nombreActual: (locales.find((l) => l.id === actual) ?? unico)?.name ?? null,
      paraEditar: actual ?? locales[0]?.id ?? null,
    }
  }, [slug, data, isLoading, elegidos, elegir])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useLocal = () => useContext(Contexto)
