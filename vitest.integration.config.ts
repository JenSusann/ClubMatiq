
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'json'],
      reportsDirectory: './coverage/integration',

      include: [
        'src/routes/api/**/*.ts',
        'src/lib/**/*.ts',
        'src/hooks.server.ts'
      ],

      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    }
  }
});
