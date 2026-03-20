import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { jsonCodec, setOpenAPIMetadata } from '../src/utils';

describe('jsonCodec.decodeRequest', () => {
  it('parses JSON when content-type is application/json', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });

    await expect(jsonCodec.decodeRequest(request)).resolves.toEqual({ ok: true });
  });

  it('parses JSON string even when content-type is not JSON', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ ok: true }),
    });

    await expect(jsonCodec.decodeRequest(request)).resolves.toEqual({ ok: true });
  });

  it('returns plain text when body is non-JSON text', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not-json',
    });

    await expect(jsonCodec.decodeRequest(request)).resolves.toBe('not-json');
  });

  it('returns undefined on empty body', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '',
    });

    await expect(jsonCodec.decodeRequest(request)).resolves.toBeUndefined();
  });
});

describe('setOpenAPIMetadata', () => {
  it('merges default and custom responses', () => {
    const response = z.object({ ok: z.boolean() });

    const result = setOpenAPIMetadata({
      method: 'get',
      endpoint: '/health',
      schemas: { response },
      openapi: {
        tags: ['system'],
        security: [{ bearer: [] }],
        responses: {
          401: {
            description: 'Unauthorized',
          },
        },
      },
    }) as any;

    expect(result.path).toBe('/api/health');
    expect(result.responses[200].content['application/json'].schema).toBe(response);
    expect(result.responses[401]).toEqual({ description: 'Unauthorized' });
    expect(result.tags).toEqual(['system']);
    expect(result.security).toEqual([{ bearer: [] }]);
  });

  it('lets custom 200 response override default generated 200', () => {
    const result = setOpenAPIMetadata({
      method: 'get',
      endpoint: '/users',
      schemas: {
        response: z.object({ id: z.string() }),
      },
      openapi: {
        responses: {
          200: {
            description: 'Custom response',
          },
        },
      },
    }) as any;

    expect(result.responses[200]).toEqual({ description: 'Custom response' });
  });
});
