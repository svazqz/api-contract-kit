import { expect, it } from 'vitest';
import { createAPIDefinition } from '../src/api-contract-kit';
import { createAPIDefinition as implementation } from '../src/next-api-generator';

it('exports createAPIDefinition from its public entry point', () => {
  expect(createAPIDefinition).toBe(implementation);
});
