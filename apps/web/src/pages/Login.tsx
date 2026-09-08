import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CONTACT_EMAIL } from '@veline/shared'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, ErrorNote, Logo, Spinner } from '../components/ui'
import { DoorMotif, Glow } from '../components/Ornaments'
import { SelectorIdioma } from '../components/SelectorIdioma'
import { Texto, useIdioma } from '../i18n/idioma'

export function Login() {
  const { t } = useIdioma()
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const recienRestablecida = params.get('restablecida') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (loading) return <Spinner label={t('panel.comprobandoSesion')} />
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
      setError(err instanceof ApiError ? err.message : t('acc.noSePudoEntrar'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grain relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-6">
      {/* Aquí no hay cabecera, así que el idioma vive en una esquina: quien
          llega desde un correo en inglés no tiene otro sitio donde cambiarlo. */}
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <SelectorIdioma />
      </div>

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
        <h1 className="text-center text-[24px] font-semibold text-ink">{t('acc.panelGestion')}</h1>
        <p className="mt-2 mb-8 text-center text-sm text-muted">{t('acc.entraConTuCuenta')}</p>

        {recienRestablecida && (
          <p className="mb-5 rounded-lg border border-brand/40 bg-brand/8 px-4 py-3 text-center text-sm text-body-2">
            {t('acc.restablecida')}
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-meta font-semibold text-body">{t('acc.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
              placeholder={t('acc.emailEjemplo')}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-meta font-semibold text-body">
              {t('acc.contrasena')}
            </span>
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
            {sending ? t('acc.entrando') : t('acc.entrar')}
          </Button>
        </form>

        <Link
          to="/recuperar"
          className="mt-5 block text-center text-meta font-medium text-muted hover:text-brand"
        >
          {t('acc.olvidaste')}
        </Link>

        <p className="mt-5 text-center text-meta text-subtle">
          <Texto
            clave="acc.sinCuenta"
            partes={{
              correo: (
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-text">
                  {CONTACT_EMAIL}
                </a>
              ),
            }}
          />
        </p>
      </div>
    </div>
  )
}
