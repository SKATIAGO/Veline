import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Button, Card, ErrorNote, Spinner } from '../../components/ui'

const ROL_LABEL: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Administrador',
  EMPLEADO: 'Equipo',
}

/** Tu cuenta: cambiar la contraseña estando dentro. */
export function PanelCuenta() {
  const { user, loading } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const [sending, setSending] = useState(false)

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setHecho(false)
    if (next !== repeat) {
      setError('Las dos contraseñas nuevas no coinciden.')
      return
    }
    setSending(true)
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      setHecho(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se ha podido cambiar la contraseña.')
    } finally {
      setSending(false)
    }
  }

  const input =
    'w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-brand'

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Tu cuenta</h1>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 font-display text-lg font-semibold text-ink">Datos</div>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Nombre</dt>
              <dd className="font-medium text-ink">{user.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd className="font-medium text-ink">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Rol</dt>
              <dd className="font-medium text-ink">{ROL_LABEL[user.role] ?? user.role}</dd>
            </div>
            {user.businessName && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Negocio</dt>
                <dd className="font-medium text-ink">{user.businessName}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card className="p-6">
          <div className="mb-4 font-display text-lg font-semibold text-ink">Cambiar contraseña</div>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-body">
                Contraseña actual
              </span>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-body">
                Nueva (mínimo 10 caracteres)
              </span>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                required
                minLength={10}
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-semibold text-body">Repítela</span>
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                required
                minLength={10}
                className={input}
              />
            </label>

            {error && <ErrorNote>{error}</ErrorNote>}
            {hecho && (
              <p className="rounded-lg border border-brand/40 bg-brand/8 px-4 py-3 text-sm text-body-2">
                Contraseña cambiada. Las demás sesiones se han cerrado.
              </p>
            )}

            <Button type="submit" disabled={sending} className="mt-1">
              {sending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
