import { defineConfig } from 'vite';

// base relativa: il sito funziona in qualunque sottocartella di GitHub Pages (es. /<repo>/preview/)
export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true, host: '127.0.0.1' },
  preview: { port: 5181, strictPort: true, host: '127.0.0.1' },
  // MapLibre 6 carica il suo worker come modulo accanto al file: senza pre-bundling il percorso resta giusto
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
