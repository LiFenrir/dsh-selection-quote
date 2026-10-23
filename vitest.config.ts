import { defineConfig } from 'vitest/config'

// Node is the default; component specs opt into jsdom with a file-level pragma.
export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
  },
})
