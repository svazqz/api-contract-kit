import { UseMutationResult, UseQueryResult, useMutation, useQuery } from '@tanstack/react-query';
import { ZodType } from 'zod';
import { APIConsumerPayload, DTO, ServerFnDefinition } from './types';
import { ApiClientConfig, createClient } from './client';

const getQueryKey = <URLParams, QueryParams, Body>(
  endpoint: string,
  payload: APIConsumerPayload<URLParams, QueryParams, Body>,
) => [
  endpoint,
  ...(payload.urlParams ? Object.values(payload.urlParams) : []),
  ...(payload.query ? Object.values(payload.query) : []),
  ...(payload.body ? Object.values(payload.body) : []),
];

export const createReactQueryAdapter = (config: ApiClientConfig) => {
  const client = createClient(config);

  const useApiQuery = <
    URLParams extends ZodType,
    QueryParams extends ZodType,
    Body extends ZodType,
    ResponseSchema extends ZodType,
  >(
    apiDefinition: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
    payload: APIConsumerPayload<DTO<URLParams>, DTO<QueryParams>, DTO<Body>>,
    options?: {
      enabled?: boolean;
      initialData?: DTO<ResponseSchema>;
    },
  ): {
    queryKey: unknown[];
    query: UseQueryResult<DTO<ResponseSchema>>;
  } => {
    const endpoint = apiDefinition.endpoint || apiDefinition.path || '/';
    const queryKey = getQueryKey(endpoint, payload);
    const query = useQuery({
      queryKey,
      enabled: options?.enabled,
      initialData: options?.initialData,
      queryFn: async () => client.call(apiDefinition, payload),
    });
    return { queryKey, query };
  };

  const useApiMutation = <
    URLParams extends ZodType,
    QueryParams extends ZodType,
    Body extends ZodType,
    ResponseSchema extends ZodType,
  >(
    apiDefinition: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
    payloadBase?: Omit<
      APIConsumerPayload<DTO<URLParams>, DTO<QueryParams>, DTO<Body>>,
      'body'
    >,
  ): UseMutationResult<
    DTO<ResponseSchema>,
    Error,
    DTO<Body>,
    unknown
  > =>
    useMutation({
      mutationFn: async (body: DTO<Body>) =>
        client.call(apiDefinition, {
          ...(payloadBase ?? {}),
          body,
        }),
    });

  return {
    useApiQuery,
    useApiMutation,
  };
};
