import { ReactNode } from 'react'
import { cn } from '../lib/utils'

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return <div className={cn('rounded-2xl border border-black/5 bg-white/80 p-4 shadow-card backdrop-blur', className)} onClick={onClick}>{children}</div>
}

export function Button({
  className,
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
}: {
  className?: string
  children: ReactNode
  onClick?: (e?: React.MouseEvent) => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
  type?: 'button' | 'submit'
}) {
  const variants = {
    primary: 'bg-accent text-white hover:opacity-90',
    secondary: 'bg-ink text-white hover:opacity-90',
    ghost: 'bg-transparent text-ink hover:bg-black/5',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn('rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50', variants[variant], className)}
    >
      {children}
    </button>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm', props.className)} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm', props.className)} />
}
