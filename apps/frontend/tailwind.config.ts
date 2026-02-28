import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f4f7ef',
        ink: '#1c2328',
        accent: '#0d9f6e',
        muted: '#5f6b73',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 12px 30px -20px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}

export default config
