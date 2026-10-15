import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts'],
    // Runs every unit test in a time zone far from UTC so date bugs show up.
    env: { TZ: 'Pacific/Honolulu' },
  },
});
