import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'hsl(var(--color-background) / <alpha-value>)',
        surface: 'hsl(var(--color-surface) / <alpha-value>)',
        elevated: 'hsl(var(--color-elevated) / <alpha-value>)',
        ink: 'hsl(var(--color-foreground) / <alpha-value>)',
        text: 'hsl(var(--color-foreground) / <alpha-value>)',
        muted: 'hsl(var(--color-muted-foreground) / <alpha-value>)',
        border: 'hsl(var(--color-border) / <alpha-value>)',
        accent: 'hsl(var(--color-primary) / <alpha-value>)',
        success: 'hsl(var(--color-success) / <alpha-value>)',
        warning: 'hsl(var(--color-warning) / <alpha-value>)',
        danger: 'hsl(var(--color-danger) / <alpha-value>)',
        background: 'hsl(var(--color-background) / <alpha-value>)',
        foreground: 'hsl(var(--color-foreground) / <alpha-value>)',
        primary: 'hsl(var(--color-primary) / <alpha-value>)',
      },
      fontFamily: {
        display: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.08), 0 8px 24px -18px rgb(15 23 42 / 0.3)',
        panel: '0 18px 40px -28px rgb(15 23 42 / 0.38)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '0.9rem',
        '3xl': '1rem',
      },
    },
  },
  plugins: [],
}

export default config
