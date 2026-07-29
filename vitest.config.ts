import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Node-environment tests only. These deliberately need no database and no
// browser: they assert the permission matrix and the shape of the server-action
// layer, so they run in seconds on every push (see .github/workflows/ci.yml).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
