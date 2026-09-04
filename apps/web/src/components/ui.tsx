import { useState } from 'react'
import type { ComponentPropsWithoutRef, ReactNode, Ref } from 'react'
import { Link } from 'react-router-dom'

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ')

/* ── Logo ───────────────────────────────────────────────────
 * Isotipo "puertas gemelas" (opción 2a del proyecto de marca):
 * dos hojas apenas entornadas hacia afuera = abrir el local.
 */
export function LogoMark({
  size = 22,
  variant = 'light',
}: {
  size?: number
  variant?: 'light' | 'dark'
}) {
  const left = variant === 'dark' ? '#D9A441' : '#A96A3E'
  const right = variant === 'dark' ? '#F2E7D6' : '#2E2119'
  return (
    <svg width={size * (60 / 56)} height={size} viewBox="0 0 60 56" aria-hidden="true">
      <rect x="6" y="6" width="18" height="44" rx="4" fill={left} transform="rotate(-9 15 28)" />
      <rect x="36" y="6" width="18" height="44" rx="4" fill={right} transform="rotate(9 45 28)" />
    </svg>
  )
}

export function Logo({
  variant = 'light',
  size = 22,
}: {
  variant?: 'light' | 'dark'
  size?: number
}) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Veline — inicio">
      <LogoMark size={size} variant={variant} />
      <span
        className={cx(
          'font-display font-semibold tracking-[-0.01em]',
          variant === 'dark' ? 'text-ondark' : 'text-ink',
        )}
        style={{ fontSize: size }}
      >
        Veline
      </span>
    </Link>
  )
}

/* ── Botones ──────────────────────────────────────────────────
 *
 * La regla que arregla el problema real: **ningún control baja de 36 px de
 * alto, y los de página entera son de 44**. Antes las acciones del panel
 * («Editar», «Dar de baja», «Salir») eran texto subrayado de 12,5 px sin
 * padding: un blanco de unos 12 px de alto, imposible de acertar con el dedo.
 * Las guías de iOS y Android piden 44 px y 48 dp respectivamente.
 *
 * Radios: los botones son píldora y los campos 8 px. Así, de un vistazo, lo
 * redondo se pulsa y lo recto se escribe.
 */

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'accent' | 'danger' | 'dark'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonBase =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold ' +
  'whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] ' +
  'duration-200 active:scale-[.98] ' +
  'disabled:pointer-events-none disabled:opacity-45 ' +
  'motion-reduce:transform-none motion-reduce:transition-colors'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  // Borde de 1 px, no 1,5: la referencia usa filetes finos. El relleno al
  // pasar por encima da la respuesta, sin engordar el trazo.
  secondary: 'border border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-cream',
  // Para acciones dentro de una fila. Sin borde en reposo para no ensuciar la
  // lista, pero con superficie al acercarse: la zona pulsable existe siempre.
  quiet: 'text-body-2 hover:bg-canvas hover:text-ink',
  accent: 'bg-accent text-ink hover:brightness-105',
  danger: 'text-brand-text hover:bg-brand/10',
  // Marrón oscuro, casi negro: para la llamada a la acción de cierre,
  // donde el marrón de marca (más claro) se pedía más serio.
  dark: 'bg-ink text-cream hover:bg-ink-2',
}

/* Alto mínimo garantizado + padding horizontal proporcionado.
   `lg` es la medida de las llamadas a la acción de la web pública. */
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 text-meta',
  md: 'min-h-11 px-5 text-body',
  lg: 'min-h-12 px-7 text-ui',
}

/* El leve levantamiento se reserva a las llamadas grandes de la web pública.
   En controles densos hace que la interfaz parezca inestable al recorrerla. */
const lift =
  'hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(169,106,62,.22)] active:translate-y-0'

const buttonClass = (variant: ButtonVariant, size: ButtonSize, block?: boolean) =>
  cx(
    buttonBase,
    buttonVariants[variant],
    buttonSizes[size],
    size === 'lg' && (variant === 'primary' || variant === 'accent') && lift,
    block && 'w-full',
  )

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  /** Muestra un giro y bloquea el botón, para no enviar dos veces. */
  loading?: boolean
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size, block), className)}
    >
      {loading && (
        <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      )}
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block,
  className,
  to,
  children,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
  to: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cx(buttonClass(variant, size, block), className)}>
      {children}
    </Link>
  )
}

/**
 * Botón circular de solo icono. 40 px, como pide la referencia. Exige
 * `label`: un botón sin texto no dice nada a un lector de pantalla.
 */
export function IconButton({
  label,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'button'> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-body-2',
        'transition-colors duration-200 hover:bg-canvas hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * Acción destructiva con confirmación en el sitio. Sustituye a `confirm()`,
 * que corta el hilo de lo que estabas haciendo con un diálogo del navegador
 * imposible de vestir y que en móvil tapa la pantalla entera.
 *
 * El botón se convierte en la pregunta y la respuesta, sin mover nada de
 * sitio. Se sale con Escape o pulsando fuera de la acción.
 */
export function ConfirmAction({
  label,
  question = '¿Seguro?',
  confirmLabel = 'Sí',
  onConfirm,
  loading,
  size = 'sm',
  disabled,
}: {
  label: string
  question?: string
  confirmLabel?: string
  onConfirm: () => void
  loading?: boolean
  size?: ButtonSize
  disabled?: boolean
}) {
  const [armado, setArmado] = useState(false)

  if (!armado) {
    return (
      <Button size={size} variant="danger" disabled={disabled} onClick={() => setArmado(true)}>
        {label}
      </Button>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1"
      onKeyDown={(e) => e.key === 'Escape' && setArmado(false)}
    >
      <span className="pl-1 text-meta text-muted">{question}</span>
      <Button
        size={size}
        variant="danger"
        autoFocus
        loading={loading}
        onClick={() => {
          setArmado(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </Button>
      <Button size={size} variant="quiet" onClick={() => setArmado(false)}>
        No
      </Button>
    </span>
  )
}

/* ── Campos ───────────────────────────────────────────────────
 * 44 px de alto y radio de 8 px. El borde se marca al enfocar, además del
 * anillo del navegador: en un formulario largo hay que ver dónde estás sin
 * tener que buscarlo.
 */

const fieldBase =
  'w-full rounded-lg border border-line bg-surface px-3.5 text-body text-ink ' +
  'placeholder:text-subtle transition-colors duration-200 ' +
  'hover:border-line-strong focus:border-brand focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted'

export function Input({
  className,
  invalid,
  ref,
  ...props
}: ComponentPropsWithoutRef<'input'> & { invalid?: boolean; ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      {...props}
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(fieldBase, 'h-11', invalid && 'border-brand', className)}
    />
  )
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentPropsWithoutRef<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cx(fieldBase, 'min-h-24 py-3', invalid && 'border-brand', className)}
    />
  )
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select {...props} className={cx(fieldBase, 'h-11 cursor-pointer pr-9', className)}>
      {children}
    </select>
  )
}

/**
 * Etiqueta + campo + pista o error. Une la etiqueta al control por `htmlFor`,
 * que es lo que permite pulsar el texto para enfocar y lo que lee un lector
 * de pantalla.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-meta font-semibold text-body-2">
        {label}
        {required && <span className="text-brand-text"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-meta text-brand-text">{error}</p>
      ) : hint ? (
        <p className="text-meta text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * Barra de «volver» de las pantallas de reserva.
 *
 * Existe porque la misma migaja estaba copiada en tres páginas, y en las tres
 * el enlace atrás era el carácter «‹» suelto: un blanco de 4 px de ancho.
 * Aquí es un círculo de 40 px con el nombre al lado, que también se puede
 * pulsar.
 */
export function BackBar({ to, children }: { to: string; children: ReactNode }) {
  return (
    <div className="border-b border-line">
      <div className="mx-auto flex max-w-[1440px] items-center gap-1 px-4 py-2.5 sm:px-6 lg:px-16">
        <Link
          to={to}
          aria-label="Volver"
          className={cx(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full',
            'text-subheading leading-none text-body-2 transition-colors duration-200',
            'hover:bg-canvas hover:text-ink',
          )}
        >
          <span aria-hidden>‹</span>
        </Link>
        <Link
          to={to}
          className="min-w-0 truncate rounded-lg px-1 py-2 text-body font-medium text-body hover:text-brand"
        >
          {children}
        </Link>
      </div>
    </div>
  )
}

/* ── Contenedores ───────────────────────────────────────────── */

export function Card({
  className,
  padded,
  children,
}: {
  className?: string
  /** Relleno estándar de tarjeta. Sin esto hay que recordarlo en cada uso. */
  padded?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cx('rounded-xl border border-line bg-surface', padded && 'p-5 sm:p-6', className)}
    >
      {children}
    </div>
  )
}

/** Cabecera de pantalla del panel: título, explicación y acciones a la derecha. */
export function PageHeader({
  title,
  hint,
  actions,
}: {
  title: string
  hint?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-heading-sm font-semibold text-ink">{title}</h1>
        {hint && <p className="mt-1 text-body text-muted">{hint}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/* ── Etiquetas y filtros ────────────────────────────────────── */

type BadgeTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'off'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'border-line bg-canvas text-body-2',
  brand: 'border-brand bg-brand text-white',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  off: 'border-rose-200 bg-rose-50 text-rose-800',
}

/** Etiqueta de estado. No se pulsa: para eso está FilterChip. */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5',
        'text-caption font-semibold whitespace-nowrap',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Chip({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-4 py-2 text-meta font-semibold whitespace-nowrap',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-line-strong bg-surface text-body-2 hover:border-brand hover:text-brand',
      )}
    >
      {children}
    </span>
  )
}

/** Filtro pulsable. Píldora de 36 px: se puede acertar con el pulgar. */
export function FilterChip({
  active,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={cx(
        'inline-flex min-h-9 items-center rounded-full border px-4 text-meta font-semibold',
        'whitespace-nowrap transition-colors duration-200',
        active
          ? 'border-ink bg-ink text-cream'
          : 'border-line-strong bg-surface text-body-2 hover:border-brand hover:text-brand',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Placeholder({ label, className }: { label: string; className?: string }) {
  return <div className={cx('ph rounded-xl', className)}>{label}</div>
}

export function Eyebrow({
  children,
  tone = 'brand',
}: {
  children: ReactNode
  tone?: 'brand' | 'accent'
}) {
  return (
    <p
      className={cx(
        'mb-4 text-meta font-semibold tracking-[0.06em] uppercase',
        tone === 'accent' ? 'text-accent' : 'text-subtle',
      )}
    >
      {children}
    </p>
  )
}

/**
 * La nota del negocio. Sin reseñas NO se enseña «0,0 ★»: un negocio recién
 * entrado no es un negocio malo, y esa cifra lo hunde al lado de los demás.
 * Se dice lo que es — que acaba de llegar.
 */
export function Stars({ rating, count }: { rating: number; count?: number }) {
  if (!count) return <span className="text-subtle">Nuevo en Veline</span>
  return (
    <span className="text-subtle">
      {rating.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ★ ({count})
    </span>
  )
}

/* ── Estados ────────────────────────────────────────────────── */

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-body text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-brand/40 bg-brand/8 px-4 py-3 text-body text-body-2"
    >
      {children}
    </div>
  )
}

/** Confirmación de que algo salió bien. Desaparece sola en quien la use. */
export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-body text-emerald-900"
    >
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-ph-border bg-ph-bg/40 px-6 py-12 text-center">
      <p className="font-display text-subheading text-ink">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-md text-body text-muted">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/** Bloque de carga con la forma del contenido, en vez de un giro en el vacío. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-line/60', className)} />
}
