import { useId, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Spinner,
  SuccessNote,
  cx,
} from '../../components/ui'
import { useIdioma, type Clave } from '../../i18n/idioma'

const ROL_CLAVE: Record<string, Clave> = {
  SUPERADMIN: 'panel.rolSuperadmin',
  ADMIN: 'panel.rolAdmin',
  EMPLEADO: 'panel.rolEmpleado',
}

const ROL_ALCANCE: Record<string, Clave> = {
  SUPERADMIN: 'cta.alcanceSuperadmin',
  ADMIN: 'cta.alcanceAdmin',
  EMPLEADO: 'cta.alcanceEmpleado',
}

/**
 * Fuerza de la contraseña. No bloquea nada —el mínimo son 10 caracteres— pero
 * enseña por qué una es mejor que otra en vez de exigir reglas a ciegas.
 */
function fuerza(valor: string) {
  if (!valor) return null
  let puntos = 0
  if (valor.length >= 10) puntos++
  if (valor.length >= 14) puntos++
  if (/[a-z]/.test(valor) && /[A-Z]/.test(valor)) puntos++
  if (/\d/.test(valor)) puntos++
  if (/[^A-Za-z0-9]/.test(valor)) puntos++

  if (valor.length < 10) return { nivel: 0, clave: 'cta.fuerzaCorta' as Clave, tono: 'bg-rose-400' }
  if (puntos <= 2) return { nivel: 1, clave: 'cta.fuerzaJusta' as Clave, tono: 'bg-amber-400' }
  if (puntos === 3) return { nivel: 2, clave: 'cta.fuerzaBien' as Clave, tono: 'bg-emerald-400' }
  return { nivel: 3, clave: 'cta.fuerzaMuyBien' as Clave, tono: 'bg-emerald-500' }
}

/** Tu cuenta: quién eres y cambiar la contraseña estando dentro. */
export function PanelCuenta() {
  const { t } = useIdioma()
  const { user, loading } = useAuth()
  const id = useId()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const [sending, setSending] = useState(false)

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />

  const nivel = fuerza(next)
  const noCoinciden = repeat.length > 0 && next !== repeat

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setHecho(false)
    if (next !== repeat) {
      setError(t('cta.noCoincidenLargo'))
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
      setError(err instanceof ApiError ? err.message : t('cta.noSePudoCambiar'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('panel.tuPerfil')} />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card padded>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-subheading font-bold text-white"
            >
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-subheading font-semibold text-ink">{user.name}</p>
              <p className="truncate text-meta text-muted">{user.email}</p>
            </div>
          </div>

          <dl className="mt-5 flex flex-col gap-3 border-t border-line pt-5 text-body">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">{t('cta.permisos')}</dt>
              <dd>
                <Badge tone={user.role === 'SUPERADMIN' ? 'brand' : 'neutral'}>
                  {ROL_CLAVE[user.role] ? t(ROL_CLAVE[user.role]) : user.role}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t('cta.alcance')}</dt>
              <dd className="max-w-[62%] text-right text-meta text-body-2">
                {ROL_ALCANCE[user.role] ? t(ROL_ALCANCE[user.role]) : ''}
              </dd>
            </div>
            {user.businessName && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t('cta.negocio')}</dt>
                <dd className="font-semibold text-ink">{user.businessName}</dd>
              </div>
            )}
          </dl>

          <p className="mt-5 border-t border-line pt-4 text-meta text-subtle">
            {t('cta.loCambiaAdmin')}
          </p>
        </Card>

        <Card padded>
          <h2 className="mb-4 font-display text-subheading font-semibold text-ink">
            {t('cta.cambiarContrasena')}
          </h2>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label={t('cta.actual')} htmlFor={`${id}-cur`} required>
              <Input
                id={`${id}-cur`}
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            <Field label={t('cta.nueva')} htmlFor={`${id}-new`} hint={t('cta.nuevaPista')} required>
              <Input
                id={`${id}-new`}
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                required
                minLength={10}
              />
              {nivel && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="flex h-1 flex-1 gap-1" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cx(
                          'h-full flex-1 rounded-full transition-colors',
                          i <= nivel.nivel ? nivel.tono : 'bg-line',
                        )}
                      />
                    ))}
                  </span>
                  <span className="text-caption font-semibold text-muted">{t(nivel.clave)}</span>
                </div>
              )}
            </Field>

            <Field
              label={t('cta.repitela')}
              htmlFor={`${id}-rep`}
              error={noCoinciden ? t('cta.noCoinciden') : undefined}
              required
            >
              <Input
                id={`${id}-rep`}
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                required
                minLength={10}
                invalid={noCoinciden}
              />
            </Field>

            {error && <ErrorNote>{error}</ErrorNote>}
            {hecho && <SuccessNote>{t('cta.cambiada')}</SuccessNote>}

            <Button
              type="submit"
              loading={sending}
              disabled={!current || next.length < 10 || noCoinciden}
              block
            >
              {t('cta.cambiarContrasena')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
