import type { InputHTMLAttributes, MouseEvent, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

export function Card({
  className,
  children,
  onClick,
  variant = 'panel',
}: {
  className?: string
  children: ReactNode
  onClick?: () => void
  variant?: 'panel' | 'row' | 'muted'
}) {
  const variants = {
    panel: 'rounded-2xl border border-border bg-surface shadow-card',
    row: 'rounded-xl border border-border bg-elevated/70 shadow-card',
    muted: 'rounded-xl border border-border bg-elevated/40',
  }

  return (
    <div className={cn(variants[variant], 'p-4', className)} onClick={onClick}>
      {children}
    </div>
  )
}

export function Button({
  className,
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
  title,
}: {
  className?: string
  children: ReactNode
  onClick?: (e?: MouseEvent) => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger'
  type?: 'button' | 'submit'
  title?: string
}) {
  const variants = {
    primary: 'bg-accent text-white hover:brightness-110',
    secondary: 'bg-elevated text-text border border-border hover:bg-surface',
    ghost: 'bg-transparent text-text hover:bg-elevated',
    icon: 'bg-transparent text-text hover:bg-elevated h-9 w-9 p-0',
    danger: 'bg-danger text-white hover:brightness-110',
  }

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function IconButton({
  className,
  children,
  onClick,
  disabled,
  title,
}: {
  className?: string
  children: ReactNode
  onClick?: (e?: MouseEvent) => void
  disabled?: boolean
  title: string
}) {
  return (
    <Button
      variant="icon"
      className={cn('rounded-lg border border-transparent', className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <span aria-hidden>{children}</span>
      <span className="sr-only">{title}</span>
    </Button>
  )
}

export function Badge({
  className,
  children,
  tone = 'default',
}: {
  className?: string
  children: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    default: 'bg-elevated text-text border-border',
    success: 'bg-success/20 text-success border-success/45',
    warning: 'bg-warning/20 text-warning border-warning/45',
    danger: 'bg-danger/20 text-danger border-danger/45',
    info: 'bg-accent/20 text-accent border-accent/45',
  }

  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>{children}</span>
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app',
        props.className,
      )}
    />
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app',
        props.className,
      )}
    />
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between', className)}>
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-text">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app',
        active
          ? 'border-accent bg-accent/20 text-accent'
          : 'border-border bg-elevated text-muted hover:bg-surface hover:text-text',
      )}
    >
      {children}
    </button>
  )
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; label: string }>
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-xl border border-border bg-elevated p-1', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app',
            option.value === value ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('rounded-md border border-border bg-elevated px-1.5 py-0.5 text-[11px] font-semibold text-muted', className)}>{children}</kbd>
}
