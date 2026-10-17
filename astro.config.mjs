// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://francio.house',
  trailingSlash: 'ignore',
  devToolbar: { enabled: false },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // three.js is loaded lazily, only for the street scene.
      chunkSizeWarningLimit: 800,
    },
  },
});
