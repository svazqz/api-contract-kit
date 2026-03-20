import { ZodType } from 'zod';
import { jsonCodec, setOpenAPIMetadata } from './utils';
import { ServerFnDefinition } from './types';

export const createAPIDefinition = <
  URLParams extends ZodType,
  QueryParams extends ZodType,
  Body extends ZodType,
  ResponseSchema extends ZodType,
>(
  def: ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema>,
): ServerFnDefinition<URLParams, QueryParams, Body, ResponseSchema> => {
  const path = `${def.path ?? def.endpoint ?? ''}`;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const _def = {
    method: 'get',
    ...def,
    ...{
      path: normalizedPath === '/' ? '' : normalizedPath,
      endpoint: normalizedPath === '/' ? '' : normalizedPath,
    },
    codec: def.codec ?? jsonCodec,
  };

  (_def as any).apiConfig = setOpenAPIMetadata(_def);

  return _def;
};
