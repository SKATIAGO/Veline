import type { ComponentPropsWithoutRef, ReactNode } from 'react'
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

/* ── Botones ────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'ghost' | 'accent'

const buttonBase =
  'relative inline-flex items-center justify-center gap-2 font-semibold rounded-lg ' +
  'transition-[background-color,color,border-color,transform,box-shadow] duration-300 ' +
  'hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ' +
  'motion-reduce:transform-none motion-reduce:transition-colors'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-dark hover:shadow-[0_10px_22px_rgba(169,106,62,.28)]',
  ghost: 'border-[1.5px] border-ink text-ink hover:bg-ink hover:text-cream',
  accent: 'bg-accent text-ink hover:brightness-105 hover:shadow-[0_10px_22px_rgba(217,164,65,.32)]',
}

const buttonSizes = {
  sm: 'text-[13px] px-4 py-2.5',
  md: 'text-sm px-6 py-3.5',
} as const

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant
  size?: keyof typeof buttonSizes
}) {
  return (
    <button
      {...props}
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
    />
  )
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  to,
  children,
}: {
  variant?: ButtonVariant
  size?: keyof typeof buttonSizes
  className?: string
  to: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}>
      {children}
    </Link>
  )
}

/* ── Contenedores ───────────────────────────────────────────── */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('bg-surface border border-line rounded-xl', className)}>{children}</div>
}

export function Chip({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cx(
        'whitespace-nowrap rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors',
        active
          ? 'bg-brand border-brand text-white'
          : 'bg-surface border-line-strong text-body-2 hover:border-brand hover:text-brand',
      )}
    >
      {children}
    </span>
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
        'mb-4 text-[13px] font-semibold uppercase tracking-[0.06em]',
        tone === 'accent' ? 'text-accent' : 'text-subtle',
      )}
    >
      {children}
    </p>
  )
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="text-subtle">
      {rating.toLocaleString('es-ES', { minimumFractionDigits: 1 })} ★
      {count !== undefined && ` (${count})`}
    </span>
  )
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-brand/40 bg-brand/8 px-4 py-3 text-sm text-body-2"
    >
      {children}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ph-border bg-ph-bg/40 px-6 py-12 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
    </div>
  )
}
