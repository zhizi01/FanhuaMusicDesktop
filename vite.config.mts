import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('./src/renderer'),
  // Relative asset URLs so the production build works when loaded via file:// by Electron.
  base: './',
  plugins: [vue()],
  build: {
    outDir: r('./dist/renderer'),
    emptyOutDir: true,
    target: 'esnext',
  },
  server: { port: 5173 },
});
