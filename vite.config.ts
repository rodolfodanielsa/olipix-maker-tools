import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tune: resolve(__dirname, 'tune/index.html'),
        price: resolve(__dirname, 'price/index.html'),
      },
    },
  },
  test: { environment: 'jsdom' },
});
