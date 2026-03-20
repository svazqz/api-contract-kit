import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiWrapper } from '../src/server';

describe('apiWrapper', () => {
  it('returns 200 with encoded handler response', async () => {
    const def = {
      method: 'post',
      path: '/geo/{city}',
      schemas: {
        urlArgs: z.object({ city: z.string() }),
        queryParams: z.object({ lat: z.number() }),
        payload: z.object({ name: z.string() }),
        response: z.object({ ok: z.boolean() }),
      },
    };

    const wrapped = apiWrapper(def, async (_request, query, urlParams, payload) => {
      expect(query).toEqual({ lat: 19 });
      expect(urlParams).toEqual({ city: 'cdmx' });
      expect(payload).toEqual({ name: 'Sergio' });
      return { ok: true };
    });

    const request = new Request('http://localhost/geo/cdmx?lat=19', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sergio' }),
    });

    const response = await wrapped(request, { params: { city: 'cdmx' } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it('returns 403 when auth returns false', async () => {
    const handler = vi.fn(async () => ({ ok: true }));

    const def = {
      method: 'get',
      path: '/secure',
      auth: async () => false,
      schemas: {
        response: z.object({ ok: z.boolean() }),
      },
    };

    const wrapped = apiWrapper(def, handler);
    const response = await wrapped(new Request('http://localhost/secure'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Access denied', at: 'auth' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 400 for query validation errors', async () => {
    const def = {
      method: 'get',
      path: '/geo',
      schemas: {
        queryParams: z.object({ lat: z.number() }),
        response: z.object({ ok: z.boolean() }),
      },
    };

    const wrapped = apiWrapper(def, async () => ({ ok: true }));
    const response = await wrapped(new Request('http://localhost/geo?lat=invalid'));

    expect(response.status).toBe(400);
  });

  it('returns 422 for payload validation errors', async () => {
    const def = {
      method: 'post',
      path: '/geo',
      schemas: {
        payload: z.object({ lat: z.number() }),
        response: z.object({ ok: z.boolean() }),
      },
    };

    const wrapped = apiWrapper(def, async () => ({ ok: true }));
    const response = await wrapped(
      new Request('http://localhost/geo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lat: 'invalid' }),
      }),
    );

    expect(response.status).toBe(422);
  });
});
