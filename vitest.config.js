import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname + '/src/renderer',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js'],
    include: ['**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['**/*.{js,jsx}'],
      exclude: [
        '**/*.test.{js,jsx}',
        '**/node_modules/**',
        'vitest.setup.js',
        'main.jsx'
      ]
    }
  },
  resolve: {
    alias: {
      '@': __dirname + '/src/renderer'
    }
  }
});
