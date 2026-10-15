import { createContext, useContext, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type AuthUser } from './api'
import { reintentarLecturas } from './errores'

/**
 * Sesión del panel. La cookie es httpOnly (el JS no puede leerla), así que la
 * única fuente de verdad es /api/auth/me: si responde, hay sesión.
 */

interface AuthState {
  user: AuthUser | null
  loading: boolean
  /** No se ha podido saber si hay sesión (límite de peticiones, servidor caído,
      sin red). No es «sin sesión»: no hay que mandar al login. */
  fallo: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  fallo: false,
  refresh: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return (await api.me()).user
      } catch (err) {
        // 401 = simplemente no hay sesión. No es un error a reintentar.
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    staleTime: 5 * 60 * 1000,
    // Solo se reintenta lo que se arregla solo. Un 401 ya vuelve como null.
    retry: reintentarLecturas,
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }

  const logout = async () => {
    await api.logout()
    // Fuera todo lo cacheado: lo que viera el usuario anterior no debe
    // quedar en memoria para el siguiente.
    queryClient.clear()

    /* Y se sale con una carga de verdad, no navegando por dentro.
     *
     * Vaciar la caché no bastaba: los componentes que ya estaban leyendo la
     * sesión se quedan con el último valor que recibieron —nadie les avisa de
     * que su consulta ha desaparecido—, así que el panel seguía puesto con la
     * sesión ya cerrada en el servidor, y al ir a /login creía que aún había
     * usuario y devolvía al panel. Se podía pelear con la caché hasta
     * convencerla, pero cerrar sesión es justo el momento de no depender de
     * eso: una carga limpia se lleva por delante toda la memoria del usuario
     * anterior, y el panel se usa en el mostrador de un negocio, que es un
     * ordenador compartido.
     */
    window.location.assign('/login')
  }

  return (
    <AuthContext.Provider
      value={{ user: data ?? null, loading: isLoading, fallo: isError && !data, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
