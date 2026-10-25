import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite only builds the browser bundle here — `npm run dev` boots the Express
 * server, which mounts Vite in middleware mode so API + HMR share one port.
 *
 * `assetsDir` is deliberately `_bundle` so Vite's hashed output never collides
 * with the restaurant's own media in `public/assets/`. Those URLs
 * (`/assets/logo.png`, `/assets/food/karahi.jpg`) are stored in the database and
 * must stay stable across builds.
 */
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: '_bundle',
    rollupOptions: {
      input: {
        site: 'index.html',
        admin: 'admin.html',
        prd: 'prd.html',
      },
    },
  },
})
