import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { expressAdapter, fastifyAdapter } from '../src/server';

describe('framework adapters', () => {
  it('bridges Express request/response to Fetch runtime', async () => {
    const handler = vi.fn(async (_request, _query, urlParams) => ({
      id: (urlParams as { id: string }).id,
    }));

    const adapter = expressAdapter(
      {
        method: 'get',
        path: '/users/{id}',
        schemas: {
          urlArgs: z.object({ id: z.string() }),
          response: z.object({ id: z.string() }),
        },
      },
      handler,
    );

    const req = {
      protocol: 'http',
      get: vi.fn(() => 'localhost:3000'),
      originalUrl: '/users/42',
      url: '/users/42',
      method: 'GET',
      headers: { host: 'localhost:3000' },
      params: { id: '42' },
      body: undefined,
    };

    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      send: vi.fn(),
    };

    await adapter(req, res);

    expect(handler).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
    const bytes = res.send.mock.calls[0][0] as Uint8Array;
    const body = JSON.parse(new TextDecoder().decode(bytes));
    expect(body).toEqual({ id: '42' });
  });

  it('bridges Fastify request/reply to Fetch runtime', async () => {
    const handler = vi.fn(async (_request, _query, urlParams) => ({
      id: (urlParams as { id: string }).id,
    }));

    const adapter = fastifyAdapter(
      {
        method: 'get',
        path: '/users/{id}',
        schemas: {
          urlArgs: z.object({ id: z.string() }),
          response: z.object({ id: z.string() }),
        },
      },
      handler,
    );

    const request = {
      raw: {
        method: 'GET',
        url: '/users/77',
        headers: { host: 'localhost:3000' },
      },
      params: { id: '77' },
    };

    const reply = {
      code: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await adapter(request, reply);

    expect(handler).toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.header).toHaveBeenCalledWith('content-type', 'application/json');
    const bytes = reply.send.mock.calls[0][0] as Uint8Array;
    const body = JSON.parse(new TextDecoder().decode(bytes));
    expect(body).toEqual({ id: '77' });
  });
});
