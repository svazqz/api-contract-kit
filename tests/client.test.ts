import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiConsumer, createClient } from '../src/client';
import { createAPIDefinition } from '../src/next-api-generator';

describe('client', () => {
  it('builds request URL, body and headers', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createClient({
      baseUrl: 'https://api.example.com',
      fetchFn: fetchFn as typeof fetch,
      headersProvider: () => ({ authorization: 'Bearer token' }),
    });

    const def = createAPIDefinition({
      method: 'post',
      path: '/users/{id}',
      schemas: {
        response: z.object({ ok: z.boolean() }),
      },
    });

    const response = await client.call(def, {
      urlParams: { id: '42' },
      query: { include: 'profile' },
      body: { name: 'Sergio' },
      headers: { 'x-request-id': 'abc' },
    });

    expect(response).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.example.com/users/42?include=profile',
      expect.objectContaining({
        method: 'post',
        body: JSON.stringify({ name: 'Sergio' }),
        headers: expect.objectContaining({
          authorization: 'Bearer token',
          'x-request-id': 'abc',
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('throws on non-ok responses', async () => {
    const client = createClient({
      baseUrl: 'https://api.example.com',
      fetchFn: (async () => new Response('Nope', { status: 500 })) as typeof fetch,
    });

    const def = createAPIDefinition({
      method: 'get',
      path: '/users',
      schemas: {
        response: z.object({ ok: z.boolean() }),
      },
    });

    await expect(client.call(def, {})).rejects.toThrow('Nope');
  });

  it('uses NEXT_PUBLIC_BASE_API_URL as fallback in apiConsumer', async () => {
    const previousEnv = (globalThis as any).process?.env;
    const previousFetch = globalThis.fetch;
    (globalThis as any).process = {
      env: { NEXT_PUBLIC_BASE_API_URL: 'https://fallback.example.com' },
    };

    try {
      const def = createAPIDefinition({
        method: 'get',
        path: '/health',
        schemas: {
          response: z.object({ ok: z.boolean() }),
        },
      });

      globalThis.fetch = (async (input: RequestInfo | URL) => {
        expect(`${input}`).toBe('https://fallback.example.com/health');
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch;

      const consumer = apiConsumer(def);

      await expect(consumer({})).resolves.toEqual({ ok: true });
    } finally {
      (globalThis as any).process = { env: previousEnv };
      globalThis.fetch = previousFetch;
    }
  });
});
