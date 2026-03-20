import { ZodType } from 'zod';
import { APIConsumerPayload, ConsumerFn, DTO, ServerFnDefinition } from './types';
import { jsonCodec } from './utils';

const getEndpointWithArgsAndQuery = <
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  _ResponseSchema extends ZodType,
>(
  endpoint: string,
  consumerPayload: APIConsumerPayload<
    DTO<URLParams>,
    DTO<QueryParams>,
    DTO<Body>
  >,
) => {
  let url = `${endpoint}${
    consumerPayload.query
      ? `?${new URLSearchParams(consumerPayload.query || {})}`
      : ''
  }`;

  if (consumerPayload && consumerPayload.urlParams) {
    Object.keys(consumerPayload.urlParams).forEach(
      (arg: keyof typeof consumerPayload.urlParams) => {
        url = url.replace(
          `{${arg as string}}`,
          consumerPayload?.urlParams![arg],
        );
      },
    );
  }

  return url;
};

export type ApiClientConfig = {
  baseUrl: string;
  fetchFn?: typeof fetch;
  headersProvider?:
    | (() => Promise<Record<string, string>>)
    | (() => Record<string, string>);
};

export const createClient = (config: ApiClientConfig) => {
  const fetchFn = config.fetchFn ?? fetch;
  const headersProvider = config.headersProvider;

  const call = async <
    URLParams extends ZodType,
    QueryParams extends ZodType,
    Body extends ZodType,
    ResponseSchema extends ZodType,
  >(
    apiDefinition: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
    consumerPayload: APIConsumerPayload<
      DTO<URLParams>,
      DTO<QueryParams>,
      DTO<Body>
    >,
  ): Promise<DTO<ResponseSchema>> => {
    const endpointKey = getEndpointWithArgsAndQuery(
      apiDefinition?.endpoint || apiDefinition?.path || '/',
      consumerPayload,
    );

    const resolvedHeaders =
      (await headersProvider?.()) ?? ({} as Record<string, string>);

    const url = `${config.baseUrl}${endpointKey}`;
    const response = await fetchFn(url, {
      method: apiDefinition.method || 'get',
      body:
        consumerPayload.body === undefined
          ? undefined
          : JSON.stringify(consumerPayload.body),
      headers: {
        ...resolvedHeaders,
        ...(consumerPayload.headers ?? {}),
        ...(consumerPayload.body === undefined
          ? {}
          : { 'content-type': jsonCodec.requestContentType }),
      },
      signal: consumerPayload.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }

    const parsed = (await jsonCodec.decodeRequest(response)) as DTO<ResponseSchema>;
    return parsed;
  };

  return { call };
};

export const apiConsumer =
  <
    URLParams extends ZodType,
    QueryParams extends ZodType,
    Body extends ZodType,
    ResponseSchema extends ZodType,
  >(
    apiDefinition: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
    config?: Partial<ApiClientConfig> & { baseUrl: string },
  ): ConsumerFn<URLParams, QueryParams, Body, ResponseSchema> =>
  async (
    consumerPayload: APIConsumerPayload<
      DTO<URLParams>,
      DTO<QueryParams>,
      DTO<Body>
    >,
  ) => {
    const runtimeEnv = (globalThis as any)?.process?.env;
    const fallbackBaseUrl =
      runtimeEnv?.NEXT_PUBLIC_BASE_API_URL || '';

    const client = createClient({
      baseUrl: config?.baseUrl ?? fallbackBaseUrl,
      fetchFn: config?.fetchFn,
      headersProvider: config?.headersProvider,
    });

    return client.call(apiDefinition, consumerPayload);
  };
