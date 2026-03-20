import { ZodType, ZodNumber, ZodBoolean } from 'zod';
import { ApiCodec, ServerFnDefinition } from './types';
import { RouteConfig } from '@asteasolutions/zod-to-openapi';

export function validateQueryParams<
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  Response extends ZodType,
>(
  request: Request,
  def: ServerFnDefinition<URLParams, QueryParams, Body, Response>,
) {
  const queryParams = {};
  const params = new URL(request.url).searchParams.keys();
  for (const param of params) {
    if ((def.schemas?.queryParams as any).shape[param] instanceof ZodNumber) {
      (queryParams as unknown as any)[param as unknown as string] = Number(
        new URL(request.url).searchParams.get(param),
      );
    } else if (
      (def.schemas?.queryParams as any).shape[param] instanceof ZodBoolean
    ) {
      (queryParams as unknown as any)[param as unknown as string] = Boolean(
        new URL(request.url).searchParams.get(param),
      );
    } else {
      (queryParams as unknown as any)[param as unknown as string] =
        new URL(request.url).searchParams.get(param);
    }
  }
  def.schemas?.queryParams?.parse(queryParams);
  return queryParams;
}

export async function validatePayload<
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  Response extends ZodType,
>(
  request: Request,
  def: ServerFnDefinition<URLParams, QueryParams, Body, Response>,
  ProtoClass: any,
) {
  let parsedPayload: Body | undefined = undefined;

  if (ProtoClass) {
    try {
      const lResponse = await request.arrayBuffer();
      parsedPayload = ProtoClass.decode(new Uint8Array(lResponse));
    } catch {
      throw new Error('Protocol buffer parsing error');
    }
  } else {
    parsedPayload = await request.json();
  }
  def.schemas?.payload?.parse(parsedPayload);
  return parsedPayload;
}

export const setOpenAPIMetadata = (_def: any) => {
  const openapiPathPrefix = `${_def.openapiPathPrefix ?? '/api'}`;
  const endpoint = `${_def.endpoint ?? _def.path ?? ''}`;
  const codec = _def.codec ?? jsonCodec;

  const apiConfig = {
    method: _def.method,
    path: `${openapiPathPrefix}${endpoint}`,
    summary: _def.openapi?.summary ?? '',
    request: {},
    responses: {},
  } as RouteConfig;

  const baseResponses =
    _def.schemas?.response
      ? {
          200: {
            description: _def.openapi?.responses?.[200]?.description ?? '',
            content: {
              [codec.responseContentType]: {
                schema: _def.schemas?.response,
              },
            },
          },
        }
      : {};

  const customResponses = _def.openapi?.responses ?? {};
  apiConfig.responses = { ...baseResponses, ...customResponses };

  if (_def.schemas?.queryParams) {
    (apiConfig.request as any).query = (
      _def.schemas?.queryParams as any
    )?.openapi('Query Params');
  }
  if (_def.schemas?.payload) {
    (apiConfig.request as any).body = {
      description: 'Body',
      content: {
        [codec.requestContentType]: {
          schema: _def.schemas?.payload,
        },
      },
      required: true,
    };
  }
  if (_def.schemas?.urlArgs) {
    (apiConfig.request as any).params = (_def.schemas?.urlArgs as any)?.openapi(
      'URL Params',
    );
  }

  (apiConfig as any).description = _def.openapi?.description;
  (apiConfig as any).tags = _def.openapi?.tags;
  (apiConfig as any).operationId = _def.openapi?.operationId;
  (apiConfig as any).deprecated = _def.openapi?.deprecated;
  (apiConfig as any).security = _def.openapi?.security;

  return apiConfig;
};

export const jsonCodec: ApiCodec = {
  id: 'json',
  requestContentType: 'application/json',
  responseContentType: 'application/json',
  decodeRequest: async (request) => {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await request.text();
      if (!text) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    const text = await request.text();
    if (!text) return undefined;
    return JSON.parse(text);
  },
  encodeResponse: async (value) => ({
    body: JSON.stringify(value),
    headers: { 'content-type': 'application/json' },
  }),
};
