import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prefer TS/TSX over legacy JS mirror files in this repo.
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
})
