import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const unit = mode === 'coverage-unit';
  const integration = mode === 'coverage-integration';
  return {
    test: {
      environment: 'node',
      include: integration ? ['tests/**/*.integration.test.ts'] : ['tests/**/*.test.ts'],
      exclude: unit ? ['tests/**/*.integration.test.ts'] : undefined,
      coverage: {
        include: integration ? ['src/open-api/index.ts'] : ['src/**/*.ts'],
        exclude: unit ? ['src/types.ts', 'src/open-api/index.ts'] : ['src/types.ts'],
        reporter: ['text', 'json-summary'],
        thresholds: { lines: integration ? 90 : 95 },
      },
    },
  };
});
