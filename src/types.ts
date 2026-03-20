import { z, ZodType } from 'zod';

export type DTO<T extends ZodType> = z.infer<T>;

export type HandlerFn<
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
> = (
  request: Request,
  queryParams?: DTO<QueryParams>,
  urlParams?: DTO<URLParams>,
  payload?: DTO<Body>,
) => Promise<DTO<ResponseSchema>>;

export type AuthResult =
  | boolean
  | {
      ok: boolean;
      status?: number;
      body?: unknown;
      headers?: Record<string, string>;
    };

export type ErrorMapper = (input: { stage: string; error: unknown }) => {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

export type ApiCodec = {
  id: string;
  requestContentType: string;
  responseContentType: string;
  decodeRequest: (input: Request | Response) => Promise<unknown>;
  encodeResponse: (value: unknown) => Promise<{
    body: BodyInit | null;
    headers?: Record<string, string>;
  }>;
};

export type OpenApiOperation = {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
  responses?: Record<
    number,
    {
      description?: string;
      content?: Record<string, { schema?: ZodType }>;
    }
  >;
};

export type ServerFnDefinition<
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
> = {
  schemas?: {
    urlArgs?: URLParams;
    queryParams?: QueryParams;
    payload?: Body;
    response?: ResponseSchema;
  };
  endpoint?: string;
  path?: string;
  method?: string;
  protoIn?: string;
  protoOut?: string;
  codec?: ApiCodec;
  auth?: (request: Request) => Promise<AuthResult>;
  errorMapper?: ErrorMapper;
  skipOutputValidation?: boolean;
  openapi?: OpenApiOperation;
};

export type APIConsumerPayload<URLParams, QueryParams, Body> = {
  urlParams?: URLParams;
  query?: QueryParams;
  body?: Body;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ConsumerFn<
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
> = (
  consumerPayload: APIConsumerPayload<
    DTO<URLParams>,
    DTO<QueryParams>,
    DTO<Body>
  >,
) => Promise<DTO<ResponseSchema>>;
