/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['./tests/**/*.ts'],
    update: false,
    reporters: 'verbose',
  },
  build: {
    sourcemap: true,
    lib: {
      entry: 'src/turbo-query.ts',
      name: 'TurboQuery',
      fileName: 'turbo-query',
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
  },
})
