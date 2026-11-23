import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createAPIDefinition } from '../src/next-api-generator';
import { jsonCodec } from '../src/utils';

describe('createAPIDefinition', () => {
  it('normalizes path and endpoint and sets default codec', () => {
    const response = z.object({ ok: z.boolean() });
    const def = createAPIDefinition({
      method: 'post',
      path: 'users/{id}',
      schemas: { response },
    });

    expect(def.path).toBe('/users/{id}');
    expect(def.endpoint).toBe('/users/{id}');
    expect(def.codec).toBe(jsonCodec);
    expect((def as any).apiConfig.path).toBe('/api/users/{id}');
  });

  it('uses empty path for root definitions', () => {
    const def = createAPIDefinition({
      method: 'get',
    });

    expect(def.path).toBe('');
    expect(def.endpoint).toBe('');
  });
});

it('includes request bodies, path parameters, and codec media types in OpenAPI', async () => {
  const { extendZodWithOpenApi } = await import('@asteasolutions/zod-to-openapi');
  extendZodWithOpenApi(z);
  const payload = z.object({ message: z.string() });
  const urlArgs = z.object({ id: z.string() });
  const codec = { ...jsonCodec, requestContentType: 'application/vnd.contract+json' };

  const def = createAPIDefinition({
    method: 'post',
    path: 'messages/{id}',
    codec,
    schemas: { payload, urlArgs },
  });

  expect(def).toMatchObject({
    apiConfig: {
      path: '/api/messages/{id}',
      request: {
        params: expect.objectContaining({ safeParse: expect.any(Function) }),
        body: { required: true, content: { [codec.requestContentType]: { schema: payload } } },
      },
    },
  });
});
