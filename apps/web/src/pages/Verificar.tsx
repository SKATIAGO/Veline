import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CONTACT_EMAIL } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { Logo, Spinner } from '../components/ui'
import { DoorMotif, Glow } from '../components/Ornaments'

/**
 * Donde aterriza el enlace del correo de alta.
 *
 * Se confirma solo al abrir, sin pedir que se pulse nada: quien llega aquí ya
 * ha hecho el gesto de pinchar el enlace, y poner otro botón encima es
 * preguntarle dos veces lo mismo.
 */

export function Verificar() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [estado, setEstado] = useState<'yendo' | 'ok' | 'error'>('yendo')
  const [mensaje, setMensaje] = useState('')

  /* En desarrollo React monta dos veces, y el token solo sirve una: sin este
     candado la segunda llamada se encontraría el enlace ya usado y enseñaría
     un error a quien acaba de verificar bien. */
  const lanzado = useRef(false)

  useEffect(() => {
    if (lanzado.current) return
    lanzado.current = true

    if (!token) {
      setEstado('error')
      setMensaje('Este enlace está incompleto: le falta el código.')
      return
    }

    api
      .verifyEmail(token)
      .then(() => setEstado('ok'))
      .catch((err) => {
        setEstado('error')
        setMensaje(err instanceof ApiError ? err.message : 'No hemos podido confirmar tu correo.')
      })
  }, [token])

  return (
    <div className="grain relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-6">
      <Glow className="-top-40 -left-32" color="rgba(169,106,62,.35)" size={620} />
      <Glow className="-right-40 -bottom-52" color="rgba(217,164,65,.18)" size={560} />
      <DoorMotif
        className="top-14 right-[10%] hidden lg:block"
        size={180}
        tone="#D9A441"
        opacity={0.08}
      />

      <div className="rise relative w-full max-w-[460px] rounded-2xl border border-line bg-surface p-8 text-center shadow-pop sm:p-10">
        <div className="mb-7 flex justify-center">
          <Logo size={24} />
        </div>

        {estado === 'yendo' && <Spinner label="Confirmando tu correo…" />}

        {estado === 'ok' && (
          <>
            <h1 className="font-display text-[26px] font-semibold text-ink">Correo confirmado</h1>
            <p className="mt-3 text-body leading-relaxed text-muted">
              Ya puedes entrar y preparar tus servicios y tu horario. Mientras tanto revisamos la
              ficha; en cuanto le demos el visto bueno saldrá publicada en el marketplace.
            </p>
            <Link
              to="/login"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-ui font-semibold text-white hover:bg-brand-dark"
            >
              Entrar al panel
            </Link>
          </>
        )}

        {estado === 'error' && (
          <>
            <h1 className="font-display text-[26px] font-semibold text-ink">
              No hemos podido confirmarlo
            </h1>
            <p className="mt-3 text-body leading-relaxed text-muted">{mensaje}</p>
            <p className="mt-5 text-meta text-subtle">
              Escríbenos a{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-brand-text hover:underline"
              >
                {CONTACT_EMAIL}
              </a>{' '}
              y lo arreglamos.
            </p>
            <Link
              to="/login"
              className="mt-6 flex min-h-11 items-center justify-center text-body font-semibold text-brand-text hover:text-ink"
            >
              Ir a entrar
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
