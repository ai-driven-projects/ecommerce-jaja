import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // One file at a time: the messaging e2e files share the development
    // database and broker (rows with `aggregate_type = 'MessagingTest'`, the
    // outbox relay), so running them in parallel would mix their data.
    fileParallelism: false,
  },
});
