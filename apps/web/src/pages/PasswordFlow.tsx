import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { Button, ErrorNote, Logo } from '../components/ui'
import { DoorMotif, Glow } from '../components/Ornaments'
import { SelectorIdioma } from '../components/SelectorIdioma'
import { useIdioma } from '../i18n/idioma'

/** Marco compartido con la pantalla de login, para que se reconozca igual. */
function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="grain relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-6">
      {/* Igual que en el login: sin cabecera, el idioma vive en la esquina. */}
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

      <div className="rise relative w-full max-w-[420px] rounded-2xl border border-line bg-surface p-8 shadow-pop sm:p-10">
        <div className="mb-8 flex justify-center">
          <Logo size={24} />
        </div>
        <h1 className="text-center text-[24px] font-semibold text-ink">{title}</h1>
        <p className="mt-2 mb-8 text-center text-sm text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand'

/** Paso 1: pedir el enlace por email. */
export function ForgotPassword() {
  const { t } = useIdioma()
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [sending, setSending] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSending(true)
    // La API responde igual exista o no la cuenta, así que aquí tampoco se
    // distingue: se enseña el mismo mensaje siempre.
    await api.forgotPassword(email.trim()).catch(() => {})
    setSending(false)
    setEnviado(true)
  }

  if (enviado) {
    return (
      <AuthCard title={t('acc.revisaCorreo')} subtitle={t('acc.revisaCorreoSub')}>
        <p className="text-center text-meta text-muted">{t('acc.enlaceCaduca')}</p>
        <Link
          to="/login"
          className="mt-4 flex min-h-11 items-center justify-center text-body font-semibold text-brand-text hover:text-ink"
        >
          {t('acc.volverEntrar')}
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title={t('acc.olvidaste')} subtitle={t('acc.olvidasteSub')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-meta font-semibold text-body">{t('acc.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={inputClass}
            placeholder={t('acc.emailEjemplo')}
          />
        </label>
        <Button type="submit" disabled={sending} className="sheen mt-2 w-full">
          {sending ? t('acc.enviando') : t('acc.enviarEnlace')}
        </Button>
      </form>
      <Link
        to="/login"
        className="mt-4 flex min-h-11 items-center justify-center text-body font-medium text-muted hover:text-brand"
      >
        {t('acc.volverEntrar')}
      </Link>
    </AuthCard>
  )
}

/** Paso 2: elegir la contraseña nueva con el token del enlace. */
export function ResetPassword() {
  const { t } = useIdioma()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  if (!token) {
    return (
      <AuthCard title={t('acc.enlaceIncompleto')} subtitle={t('acc.enlaceIncompletoSub')}>
        <Link
          to="/recuperar"
          className="flex min-h-11 items-center justify-center text-body font-semibold text-brand-text hover:text-ink"
        >
          {t('acc.pedirNuevo')}
        </Link>
      </AuthCard>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== repeat) {
      setError(t('acc.noCoinciden'))
      return
    }
    setSending(true)
    try {
      await api.resetPassword(token, password)
      navigate('/login?restablecida=1', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('acc.noSePudoCambiar'))
    } finally {
      setSending(false)
    }
  }

  return (
    <AuthCard title={t('acc.eligeNueva')} subtitle={t('acc.eligeNuevaSub')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-meta font-semibold text-body">
            {t('acc.nuevaContrasena')}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={10}
            className={inputClass}
            placeholder="••••••••••"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-meta font-semibold text-body">
            {t('acc.repitela')}
          </span>
          <input
            type="password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            autoComplete="new-password"
            required
            minLength={10}
            className={inputClass}
            placeholder="••••••••••"
          />
        </label>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" disabled={sending} className="sheen mt-2 w-full">
          {sending ? t('acc.guardando') : t('acc.guardarContrasena')}
        </Button>
      </form>
      <p className="mt-6 text-center text-meta text-subtle">{t('acc.cierraSesiones')}</p>
    </AuthCard>
  )
}
