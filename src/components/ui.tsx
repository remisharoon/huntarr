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
    panel: 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
    row: 'rounded-xl border border-gray-200 bg-gray-50 shadow-sm dark:border-gray-800 dark:bg-gray-900/80',
    muted: 'rounded-xl border border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-900/40',
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
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger' | 'attention'
  type?: 'button' | 'submit'
  title?: string
}) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
    icon: 'h-9 w-9 border border-transparent bg-transparent p-0 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    attention: 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-sm hover:from-cyan-500 hover:to-teal-500',
  }

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-gray-950',
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
      className={cn('rounded-lg', className)}
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
    default: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
    success: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300',
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300',
    info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300',
  }

  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>{children}</span>
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:ring-offset-gray-950',
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
        'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:ring-offset-gray-950',
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
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl dark:text-gray-100">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p> : null}
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
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950',
        active
          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
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
    <div className={cn('inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950',
            option.value === value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
