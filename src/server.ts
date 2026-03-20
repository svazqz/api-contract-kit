import { ZodError, ZodType } from 'zod';
import { HandlerFn, ServerFnDefinition } from './types';
import { jsonCodec, validateQueryParams } from './utils';

export const apiWrapper = <
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
>(
  def: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
  apiHandler: HandlerFn<URLParams, QueryParams, Body, ResponseSchema>,
) => {
  const codec = def.codec ?? jsonCodec;

  const defaultErrorMapper = (input: { stage: string; error: unknown }) => {
    const { stage, error } = input;

    if (stage === 'auth') {
      return {
        status: 403,
        body: { error: 'Access denied', at: stage },
        headers: { 'content-type': codec.responseContentType },
      };
    }

    if (error instanceof ZodError) {
      const zodError = error as ZodError;
      const status = stage === 'payload_validation' ? 422 : 400;
      return {
        status,
        body: { error: zodError.message, issues: zodError.issues, at: stage },
        headers: { 'content-type': codec.responseContentType },
      };
    }

    const message = error instanceof Error ? error.message : 'Internal error';
    return {
      status: 500,
      body: { error: message, at: stage },
      headers: { 'content-type': codec.responseContentType },
    };
  };

  const errorMapper = def.errorMapper ?? defaultErrorMapper;

  const requestHandler = async (
    request: Request,
    ctx?: { params?: unknown },
  ): Promise<Response> => {
    let queryParams: unknown = undefined;
    let urlParams: unknown = ctx?.params;
    let parsedPayload: unknown = undefined;

    if (def.auth && typeof def.auth === 'function') {
      try {
        const authResult = await def.auth(request);
        if (typeof authResult === 'boolean') {
          if (!authResult) {
            const mapped = errorMapper({ stage: 'auth', error: false });
            const encoded = await codec.encodeResponse(mapped.body);
            return new Response(encoded.body, {
              status: mapped.status,
              headers: { ...mapped.headers, ...(encoded.headers ?? {}) },
            });
          }
        } else if (!authResult.ok) {
          const mapped = {
            status: authResult.status ?? 403,
            body: authResult.body ?? { error: 'Access denied', at: 'auth' },
            headers: authResult.headers,
          };
          const encoded = await codec.encodeResponse(mapped.body);
          return new Response(encoded.body, {
            status: mapped.status,
            headers: { ...(mapped.headers ?? {}), ...(encoded.headers ?? {}) },
          });
        }
      } catch (error) {
        const mapped = errorMapper({ stage: 'auth', error });
        const encoded = await codec.encodeResponse(mapped.body);
        return new Response(encoded.body, {
          status: mapped.status,
          headers: { ...mapped.headers, ...(encoded.headers ?? {}) },
        });
      }
    }

    try {
      if (def.schemas?.urlArgs) {
        urlParams = def.schemas.urlArgs.parse(urlParams);
      }
    } catch (error) {
      const mapped = errorMapper({ stage: 'url_params_validation', error });
      const encoded = await codec.encodeResponse(mapped.body);
      return new Response(encoded.body, {
        status: mapped.status,
        headers: { ...mapped.headers, ...(encoded.headers ?? {}) },
      });
    }

    try {
      if (def.schemas?.queryParams) {
        queryParams = validateQueryParams(request, def);
      }
    } catch (error) {
      const mapped = errorMapper({ stage: 'query_validation', error });
      const encoded = await codec.encodeResponse(mapped.body);
      return new Response(encoded.body, {
        status: mapped.status,
        headers: { ...mapped.headers, ...(encoded.headers ?? {}) },
      });
    }

    try {
      if (def.schemas?.payload) {
        parsedPayload = await codec.decodeRequest(request);
        parsedPayload = def.schemas.payload.parse(parsedPayload);
      }
    } catch (error) {
      const mapped = errorMapper({ stage: 'payload_validation', error });
      const encoded = await codec.encodeResponse(mapped.body);
      return new Response(encoded.body, {
        status: mapped.status,
        headers: { ...mapped.headers, ...(encoded.headers ?? {}) },
      });
    }

    let responseHandler: unknown = undefined;
    try {
      responseHandler = await apiHandler(
        request,
        queryParams as any,
        urlParams as any,
        parsedPayload as any,
      );
    } catch (error) {
      const mapped = errorMapper({ stage: 'response_handler', error });
      const encoded = await codec.encodeResponse(mapped.body);
      return new Response(encoded.body, {
        status: mapped.status,
        headers: { ...mapped.headers, ...(encoded.headers ?? {}) },
      });
    }

    if (def.schemas?.response && !def.skipOutputValidation) {
      try {
        def.schemas.response.parse(responseHandler);
      } catch (error) {
        const mapped = errorMapper({ stage: 'response_validation', error });
        const encoded = await codec.encodeResponse(mapped.body);
        return new Response(encoded.body, {
          status: mapped.status,
          headers: { ...mapped.headers, ...(encoded.headers ?? {}) },
        });
      }
    }

    const responseObject =
      typeof responseHandler === 'object' && responseHandler !== null
        ? responseHandler
        : { data: responseHandler };

    const encoded = await codec.encodeResponse(responseObject);
    return new Response(encoded.body, {
      status: 200,
      headers: { ...(encoded.headers ?? {}) },
    });
  };

  return requestHandler;
};

const getNodeRequestUrl = (req: any) => {
  if (req.protocol && typeof req.get === 'function') {
    return `${req.protocol}://${req.get('host')}${req.originalUrl || req.url}`;
  }

  const protocol = req.socket?.encrypted ? 'https' : 'http';
  const host = req.headers?.host || 'localhost';
  return `${protocol}://${host}${req.url || '/'}`;
};

const readNodeBody = async (req: any): Promise<BodyInit | undefined> => {
  if (req.body === undefined || req.body === null) {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return undefined;
    }

    return new Promise((resolve) => {
      const chunks: Uint8Array[] = [];
      req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      req.on('end', () => {
        if (!chunks.length) {
          resolve(undefined);
          return;
        }
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        chunks.forEach((chunk) => {
          merged.set(chunk, offset);
          offset += chunk.length;
        });
        resolve(merged);
      });
      req.on('error', () => resolve(undefined));
    });
  }

  if (typeof req.body === 'string') {
    return req.body;
  }

  if (req.body instanceof Uint8Array) {
    return req.body;
  }

  return JSON.stringify(req.body);
};

const toFetchRequest = async (req: any): Promise<Request> => {
  const body = await readNodeBody(req);
  return new Request(getNodeRequestUrl(req), {
    method: req.method || 'GET',
    headers: req.headers as HeadersInit,
    body,
  });
};

const writeNodeResponse = async (res: any, response: Response) => {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (typeof res.setHeader === 'function') {
      res.setHeader(key, value);
    }
  });
  const body = await response.arrayBuffer();
  const bytes = new Uint8Array(body);
  if (typeof res.send === 'function') {
    res.send(bytes);
    return;
  }
  if (typeof res.end === 'function') {
    res.end(bytes);
  }
};

export const nextAdapter = <
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
>(
  def: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
  apiHandler: HandlerFn<URLParams, QueryParams, Body, ResponseSchema>,
) => {
  const wrapped = apiWrapper(def, apiHandler);
  return async (request: Request, ctx?: { params?: unknown }) =>
    wrapped(request, ctx);
};

export const expressAdapter = <
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
>(
  def: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
  apiHandler: HandlerFn<URLParams, QueryParams, Body, ResponseSchema>,
) => {
  const wrapped = apiWrapper(def, apiHandler);
  return async (req: any, res: any) => {
    const request = await toFetchRequest(req);
    const response = await wrapped(request, { params: req.params });
    await writeNodeResponse(res, response);
  };
};

export const fastifyAdapter = <
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
>(
  def: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
  apiHandler: HandlerFn<URLParams, QueryParams, Body, ResponseSchema>,
) => {
  const wrapped = apiWrapper(def, apiHandler);
  return async (request: any, reply: any) => {
    const fetchRequest = await toFetchRequest(request.raw || request);
    const response = await wrapped(fetchRequest, {
      params: request.params,
    });

    reply.code(response.status);
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });
    const body = await response.arrayBuffer();
    reply.send(new Uint8Array(body));
  };
};

export const honoAdapter = <
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
>(
  def: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
  apiHandler: HandlerFn<URLParams, QueryParams, Body, ResponseSchema>,
) => {
  const wrapped = apiWrapper(def, apiHandler);
  return async (c: any) => {
    const params = typeof c.req.param === 'function' ? c.req.param() : {};
    return wrapped(c.req.raw, { params });
  };
};

export const nestAdapter = <
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
>(
  def: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
  apiHandler: HandlerFn<URLParams, QueryParams, Body, ResponseSchema>,
) => expressAdapter(def, apiHandler);
