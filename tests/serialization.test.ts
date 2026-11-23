import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { expressAdapter, honoAdapter, nestAdapter, nextAdapter } from '../src/server';
import { jsonCodec, validatePayload } from '../src/utils';

const def = { method: 'post', path: '/messages', schemas: { payload: z.object({ text: z.string() }) } };
const echo = async (_request: Request, _query: unknown, _params: unknown, payload: unknown) => payload;
const body = '{"text":"hello"}';

it.each([
  ['object', { text: 'hello' }],
  ['string', body],
  ['bytes', new TextEncoder().encode(body)],
  ['stream', undefined],
])('decodes a Node %s body', async (_name, input) => {
  const req = Object.assign(new EventEmitter(), {
    method: 'POST',
    socket: { encrypted: true },
    headers: { host: 'test.local', 'content-type': 'application/json' },
    url: '/messages',
    body: input,
  });
  const res = { statusCode: 0, end: vi.fn() };
  const handler = vi.fn(echo);
  const adapter = expressAdapter(def, handler);
  const pending = adapter(req, res);

  if (input === undefined) {
    req.emit('data', new TextEncoder().encode('{"text":'));
    req.emit('data', new TextEncoder().encode('"hello"}'));
    req.emit('end');
  }
  await pending;

  expect(handler.mock.calls[0][0].url).toBe('https://test.local/messages');
  expect(res.statusCode).toBe(200);
  expect(new TextDecoder().decode(res.end.mock.calls[0][0])).toBe(body);
});

it.each(['end', 'error'])('handles streams with no incoming data (%s)', async (event) => {
  const req = Object.assign(new EventEmitter(), { method: 'POST' });
  const res = { statusCode: 0, end: vi.fn() };
  const pending = expressAdapter(def, echo)(req, res);

  req.emit(event, new Error('interrupted'));
  await pending;

  expect(res.statusCode).toBe(422);
});

it('passes path parameters from the framework request', async () => {
  const urlDef = { method: 'get', path: '/messages/{id}', schemas: { urlArgs: z.object({ id: z.string() }) } };
  const handler = async (_req: Request, _query: unknown, params?: { id: string }) => params;
  const request = new Request('http://localhost/messages/5');
  const next = await nextAdapter(urlDef, handler)(request, { params: { id: '5' } });
  const hono = await honoAdapter(urlDef, handler)({ req: { raw: request, param: () => ({ id: '5' }) } });
  const nest = { statusCode: 0, send: vi.fn() };

  await nestAdapter(urlDef, handler)({ method: 'GET', params: { id: '5' } }, nest);

  expect(await next.json()).toEqual({ id: '5' });
  expect(await hono.json()).toEqual({ id: '5' });
  expect(nest.statusCode).toBe(200);
  expect(JSON.parse(new TextDecoder().decode(nest.send.mock.calls[0][0]))).toEqual({ id: '5' });
});

it('supports empty and plain-text JSON-codec requests', async () => {
  await expect(jsonCodec.decodeRequest(new Response())).resolves.toBeUndefined();
  await expect(jsonCodec.decodeRequest(new Response(null, {
    headers: { 'content-type': 'application/json' },
  }))).resolves.toBeUndefined();
  await expect(jsonCodec.decodeRequest(new Response('hello'))).resolves.toBe('hello');
  await expect(jsonCodec.decodeRequest(new Response(body))).resolves.toEqual({ text: 'hello' });
});

it('validates decoded protobuf and rejects decode failures', async () => {
  const protobuf = { decode: vi.fn().mockReturnValue({ text: 'hello' }) };
  const request = () => new Request('http://localhost/messages', { method: 'POST', body: new Uint8Array([1, 2]) });
  await expect(validatePayload(request(), def, protobuf)).resolves.toEqual({ text: 'hello' });
  expect(protobuf.decode).toHaveBeenCalledWith(new Uint8Array([1, 2]));
  protobuf.decode.mockImplementationOnce(() => { throw new Error('invalid wire data'); });
  await expect(validatePayload(request(), def, protobuf)).rejects.toThrow('Protocol buffer parsing error');
});
