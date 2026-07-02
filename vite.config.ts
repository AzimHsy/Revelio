import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.config'

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    rollupOptions: {
      // The offscreen recorder page is created at runtime via chrome.offscreen,
      // not referenced in the manifest, so crxjs won't discover it — add it as an
      // explicit input so it gets bundled to dist.
      input: { offscreen: 'src/offscreen/recorder.html' },
    },
  },
})
