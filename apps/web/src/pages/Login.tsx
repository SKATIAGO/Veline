import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CONTACT_EMAIL } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, ErrorNote, Logo, Spinner } from '../components/ui'
import { DoorMotif, Glow } from '../components/Ornaments'

export function Login() {
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const recienRestablecida = params.get('restablecida') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (loading) return <Spinner label="Comprobando sesión…" />
  if (user) return <Navigate to="/panel" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      await api.login(email.trim(), password)
      await refresh()
      navigate('/panel', { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se ha podido iniciar sesión. Prueba de nuevo.',
      )
    } finally {
      setSending(false)
    }
  }

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
      <DoorMotif
        className="bottom-12 left-[6%] hidden lg:block"
        size={120}
        tilt={12}
        tone="#F2E7D6"
        opacity={0.05}
        delay={1000}
      />

      <div className="rise relative w-full max-w-[420px] rounded-2xl border border-line bg-surface p-8 shadow-pop sm:p-10">
        <div className="mb-8 flex justify-center">
          <Logo size={24} />
        </div>
        <h1 className="text-center text-[24px] font-semibold text-ink">Panel de gestión</h1>
        <p className="mt-2 mb-8 text-center text-sm text-muted">
          Entra con tu cuenta para gestionar tu negocio.
        </p>

        {recienRestablecida && (
          <p className="mb-5 rounded-lg border border-brand/40 bg-brand/8 px-4 py-3 text-center text-sm text-body-2">
            Contraseña cambiada. Ya puedes entrar con la nueva.
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-body">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
              placeholder="tu@negocio.es"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-body">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
              placeholder="••••••••••"
            />
          </label>

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" disabled={sending} className="sheen mt-2 w-full">
            {sending ? 'Entrando…' : 'Iniciar sesión'}
          </Button>
        </form>

        <Link
          to="/recuperar"
          className="mt-5 block text-center text-[13px] font-medium text-muted hover:text-brand"
        >
          ¿Olvidaste la contraseña?
        </Link>

        <p className="mt-5 text-center text-[12.5px] text-subtle">
          ¿Aún no tienes cuenta? El alta la gestiona Veline: escríbenos a{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand">
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  )
}
