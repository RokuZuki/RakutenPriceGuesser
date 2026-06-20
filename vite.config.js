import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        terms: resolve(__dirname, 'terms.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        contact: resolve(__dirname, 'contact.html'),
        'column-party-tips': resolve(__dirname, 'column-party-tips.html'),
        'column-rakuten-tips': resolve(__dirname, 'column-rakuten-tips.html'),
        'column-p2p-tech': resolve(__dirname, 'column-p2p-tech.html'),
      }
    }
  }
})