import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiWrapper } from '../src/server';

const endpoint = { method: 'get', path: '/records' };
const request = new Request('http://localhost/records');

it('honors a failed auth result with its own status, body and headers', async () => {
  const handler = vi.fn(async () => ({ ok: true }));
  const wrap = apiWrapper({
    ...endpoint,
    auth: () => ({
      ok: false,
      status: 401,
      body: { reason: 'Sign in' },
      headers: { 'www-authenticate': 'Bearer' },
    }),
  }, handler);

  const response = await wrap(request);
  expect(response.status).toBe(401);
  expect(response.headers.get('www-authenticate')).toBe('Bearer');
  expect(await response.json()).toEqual({ reason: 'Sign in' });
  expect(handler).not.toHaveBeenCalled();
});

it('accepts a successful token check and wraps primitive responses', async () => {
  const wrap = apiWrapper({ ...endpoint, auth: () => ({ ok: true }) }, async () => 'ready');
  const response = await wrap(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ data: 'ready' });
});

it('sends an auth exception to a custom error mapper', async () => {
  const error = new Error('token unavailable');
  const errorMapper = vi.fn(() => ({
    status: 503, headers: { 'retry-after': '30' }, body: { retry: true },
  }));
  const wrap = apiWrapper({ ...endpoint, auth: () => { throw error; }, errorMapper }, async () => null);

  const response = await wrap(request);
  expect(errorMapper).toHaveBeenCalledWith({ stage: 'auth', error });
  expect(response.status).toBe(503);
  expect(response.headers.get('retry-after')).toBe('30');
  expect(await response.json()).toEqual({ retry: true });
});

it('rejects invalid route params before invoking the handler', async () => {
  const handler = vi.fn(async () => ({ ok: true }));
  const wrap = apiWrapper({ ...endpoint, schemas: { urlArgs: z.object({ id: z.string() }) } }, handler);
  const response = await wrap(request, { params: { id: 123 } });

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ at: 'url_params_validation' });
  expect(handler).not.toHaveBeenCalled();
});

it.each([
  [new Error('failed to save'), 'failed to save'],
  ['unknown', 'Internal error'],
])('maps a rejected handler to a server error', async (failure, message) => {
  const wrap = apiWrapper(endpoint, async () => { throw failure; });
  const response = await wrap(request);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ at: 'response_handler', error: message });
});

it('maps a schema mismatch unless output validation is disabled', async () => {
  const def = { ...endpoint, schemas: { response: z.object({ ok: z.boolean() }) } };
  const handler = vi.fn(async () => ({ ok: 'yes' as unknown as boolean }));
  const rejected = await apiWrapper(def, handler)(request);
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toMatchObject({ at: 'response_validation' });

  const accepted = await apiWrapper({ ...def, skipOutputValidation: true }, handler)(request);
  expect(accepted.status).toBe(200);
  expect(await accepted.json()).toEqual({ ok: 'yes' });
});
