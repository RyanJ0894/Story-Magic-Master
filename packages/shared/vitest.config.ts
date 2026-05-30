import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'src/generated'],
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      DIRECT_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
});
