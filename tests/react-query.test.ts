import { beforeEach, expect, it, vi } from 'vitest';
import { createReactQueryAdapter } from '../src/react-query';

const { call, useQuery, useMutation } = vi.hoisted(() => ({
  call: vi.fn(),
  useQuery: vi.fn((options) => options),
  useMutation: vi.fn((options) => options),
}));

vi.mock('../src/client', () => ({ createClient: () => ({ call }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery, useMutation }));

beforeEach(() => vi.clearAllMocks());

it('keys queries by endpoint and request data and forwards options', async () => {
  const adapter = createReactQueryAdapter({ baseUrl: 'http://localhost' });
  const definition = { endpoint: '/records/{id}', method: 'get' };
  const payload = { urlParams: { id: 9 }, query: { page: 2 }, body: { enabled: true } };
  const initialData = { rows: [] };
  call.mockResolvedValue({ rows: ['record'] });

  const { queryKey } = adapter.useApiQuery(definition, payload, { enabled: false, initialData });

  expect(queryKey).toEqual(['/records/{id}', 9, 2, true]);
  const options = useQuery.mock.calls[0][0];
  expect(options).toMatchObject({ queryKey, enabled: false, initialData });
  await expect(options.queryFn()).resolves.toEqual({ rows: ['record'] });
  expect(call).toHaveBeenCalledWith(definition, payload);
});

it('uses the path or root when the definition has no endpoint', () => {
  const adapter = createReactQueryAdapter({ baseUrl: 'http://localhost' });
  expect(adapter.useApiQuery({ path: '/records', method: 'get' }, {}).queryKey).toEqual(['/records']);
  expect(adapter.useApiQuery({ method: 'get' }, {}).queryKey).toEqual(['/']);
});

it('combines mutation input with the shared request data', async () => {
  const adapter = createReactQueryAdapter({ baseUrl: 'http://localhost' });
  const definition = { path: '/records/{id}', method: 'post' };
  const base = { urlParams: { id: 9 } };
  const body = { name: 'Updated' };
  call.mockResolvedValue({ id: 9 });

  adapter.useApiMutation(definition, base);
  await expect(useMutation.mock.calls[0][0].mutationFn(body)).resolves.toEqual({ id: 9 });
  expect(call).toHaveBeenLastCalledWith(definition, { ...base, body });

  adapter.useApiMutation(definition);
  await useMutation.mock.calls[1][0].mutationFn(body);
  expect(call).toHaveBeenLastCalledWith(definition, { body });
});
