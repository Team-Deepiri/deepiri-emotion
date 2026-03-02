import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname + '/src/renderer',
  plugins: [react()],
  build: {
    outDir: __dirname + '/dist-renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
