# api-contract-kit

`api-contract-kit` is a TypeScript-first library for defining HTTP APIs once and reusing that definition across:

- server handlers
- client consumers
- OpenAPI generation

The library is now framework-agnostic at its core, with adapter layers for multiple server frameworks.

## Migration Notice

This package was renamed from `@svazqz/next-api-generator` to `@svazqz/api-contract-kit`.

Replace imports and installation commands to use the new package name.

## Why this library exists

Many projects duplicate API contracts in multiple places:

- route handlers
- frontend consumers
- OpenAPI specs
- runtime validation code

This library removes that duplication by making your endpoint definition the source of truth.

## Design Principles

1. **Contract-first development**
   - Define method/path/schemas before implementing business logic.
2. **Framework-agnostic core**
   - Build around standard `Request`/`Response` so the same contract works in Node and Edge runtimes.
3. **Runtime validation with Zod**
   - Validate query/body/output at runtime, while keeping full static inference in TypeScript.
4. **Pluggable transport format**
   - JSON is the default codec, but request/response encoding is extensible.
5. **Optional integrations**
   - React Query integration is available, but not required.
6. **Documentation automation**
   - OpenAPI metadata is generated from the same endpoint definitions used at runtime.

## Capabilities

### API Definition

- Define endpoint path and method.
- Attach Zod schemas for:
  - URL params
  - query params
  - payload/body
  - response/output
- Add OpenAPI metadata:
  - summary
  - description
  - tags
  - operationId
  - deprecated
  - security requirements
  - custom responses
- Attach auth function and custom error mapping.
- Attach custom codec for non-JSON protocols.

### Server Runtime

- Framework-agnostic wrapper built on Fetch `Request`/`Response`.
- Default validation flow:
  - URL params
  - query params
  - payload
  - handler execution
  - optional response validation
- Structured error handling through an overridable `errorMapper`.
- Auth handling through an overridable `auth(request)` function.
- Default JSON response encoding, with codec support for custom formats.

### Client Runtime

- Framework-agnostic typed client (`createClient` and `apiConsumer`).
- Supports:
  - typed params/query/body payloads
  - request headers
  - `AbortSignal`
  - configurable fetch implementation
  - optional dynamic headers provider
- Optional React Query adapter shipped as a separate module.

### OpenAPI

- Generates OpenAPI definitions from endpoint contracts.
- Supports operation metadata and response customization.
- CLI-oriented workflow intended for CI/CD pipelines.
- Produces static OpenAPI JSON suitable for artifact publishing and static docs hosting.

## Runtime & Framework Support

### Core Runtime

The core is Fetch-based (`Request`/`Response`) to support both:

- **Node runtimes**
- **Edge-compatible runtimes**

### Server Adapters

First-party adapters are available in the server module:

- `nextAdapter`
- `expressAdapter`
- `fastifyAdapter`
- `honoAdapter`
- `nestAdapter` (via Express-style adapter strategy)

You can also use `apiWrapper` directly when your runtime already speaks Fetch.

## Installation

```bash
npm install @svazqz/api-contract-kit zod @asteasolutions/zod-to-openapi
```

If you want React Query integration:

```bash
npm install @tanstack/react-query
```

## Package Entry Points

- `@svazqz/api-contract-kit/dist/api-contract-kit`
- `@svazqz/api-contract-kit/dist/server`
- `@svazqz/api-contract-kit/dist/client`
- `@svazqz/api-contract-kit/dist/react-query` (optional integration)

## Core Types and Architecture Decisions

### `ServerFnDefinition`

This is the central contract type. It contains endpoint information, runtime behavior hooks, validation schemas, and OpenAPI metadata.

Architectural decision:

- keep one definition object as the single source of truth
- prevent drift between implementation, client code, and docs

### `HandlerFn`

Handler functions are typed from your schemas. This gives strongly typed payload/query/params inside your business logic.

Architectural decision:

- infer types from Zod schemas to avoid parallel interface maintenance

### `ApiCodec`

A codec defines how request bodies are decoded and response bodies are encoded.

Architectural decision:

- default to JSON for usability
- keep protocol support open for future formats (for example protobuf)

### `ErrorMapper`

Error mapping is centralized and overridable.

Architectural decision:

- provide sensible defaults
- let applications align API error shape/status with their platform standards

## Quick Start

### 1) Define schemas

```typescript
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const Coordinates = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
  })
  .openapi('Coordinates');

export const LocationData = z
  .object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
  })
  .openapi('LocationData');
```

### 2) Define endpoints

```typescript
import { createAPIDefinition } from '@svazqz/api-contract-kit/dist/api-contract-kit';
import { Coordinates, LocationData } from './schemas';

export const getGeoData = createAPIDefinition({
  method: 'get',
  path: '/geo',
  schemas: {
    queryParams: Coordinates,
    response: LocationData,
  },
  openapi: {
    summary: 'Get geo data',
    description: 'Returns city/state/country from coordinates',
    tags: ['geo'],
    operationId: 'getGeoData',
  },
});

export const postGeoData = createAPIDefinition({
  method: 'post',
  path: '/geo',
  schemas: {
    payload: Coordinates,
    response: LocationData,
  },
  openapi: {
    summary: 'Create geo lookup',
    tags: ['geo'],
    operationId: 'postGeoData',
  },
});
```

### 3) Implement server handlers

#### Next.js App Router

```typescript
import { nextAdapter } from '@svazqz/api-contract-kit/dist/server';
import { getGeoData, postGeoData } from './api-definitions';

export const GET = nextAdapter(getGeoData, async (_request, query) => {
  const lat = query?.latitude;
  const lon = query?.longitude;
  const response = await fetch(`https://geocode.xyz/${lat},${lon}?json=1`);
  const json = await response.json();
  const full = json.standard || json;
  return {
    city: full.city,
    state: full.state,
    country: full.country,
  };
});

export const POST = nextAdapter(postGeoData, async (_request, _query, _params, payload) => {
  const lat = payload?.latitude;
  const lon = payload?.longitude;
  const response = await fetch(`https://geocode.xyz/${lat},${lon}?json=1`);
  const json = await response.json();
  const full = json.standard || json;
  return {
    city: full.city,
    state: full.state,
    country: full.country,
  };
});
```

#### Express

```typescript
import express from 'express';
import { expressAdapter } from '@svazqz/api-contract-kit/dist/server';
import { getGeoData } from './api-definitions';

const app = express();
app.use(express.json());

app.get('/geo', expressAdapter(getGeoData, async (_request, query) => {
  return {
    city: 'CDMX',
    state: 'CDMX',
    country: 'MX',
  };
}));
```

#### Fastify

```typescript
import Fastify from 'fastify';
import { fastifyAdapter } from '@svazqz/api-contract-kit/dist/server';
import { getGeoData } from './api-definitions';

const app = Fastify();

app.get('/geo', fastifyAdapter(getGeoData, async () => {
  return {
    city: 'CDMX',
    state: 'CDMX',
    country: 'MX',
  };
}));
```

#### Hono

```typescript
import { Hono } from 'hono';
import { honoAdapter } from '@svazqz/api-contract-kit/dist/server';
import { getGeoData } from './api-definitions';

const app = new Hono();

app.get('/geo', honoAdapter(getGeoData, async () => {
  return {
    city: 'CDMX',
    state: 'CDMX',
    country: 'MX',
  };
}));
```

### 4) Consume from client (framework-agnostic)

#### Using `createClient`

```typescript
import { createClient } from '@svazqz/api-contract-kit/dist/client';
import { getGeoData } from './api-definitions';

const client = createClient({
  baseUrl: 'https://my-api.example.com',
});

const result = await client.call(getGeoData, {
  query: { latitude: 19.43, longitude: -99.13 },
});
```

#### Using `apiConsumer`

```typescript
import { apiConsumer } from '@svazqz/api-contract-kit/dist/client';
import { postGeoData } from './api-definitions';

const callPostGeo = apiConsumer(postGeoData, {
  baseUrl: 'https://my-api.example.com',
});

const result = await callPostGeo({
  body: { latitude: 19.43, longitude: -99.13 },
});
```

### 5) Optional React Query adapter

```typescript
import { createReactQueryAdapter } from '@svazqz/api-contract-kit/dist/react-query';
import { getGeoData } from './api-definitions';

const rq = createReactQueryAdapter({
  baseUrl: 'https://my-api.example.com',
});

const { query } = rq.useApiQuery(
  getGeoData,
  { query: { latitude: 19.43, longitude: -99.13 } },
  { enabled: true },
);
```

## Advanced Configuration

### Auth

Provide `auth(request)` in your API definition. It can return:

- `true` / `false`
- or an object with `ok`, `status`, `body`, `headers`

This allows centralized authorization behavior before business logic runs.

### Error Mapping

Provide `errorMapper` in your definition to transform runtime/validation/auth errors into your API error contract.

### Custom Codecs

You can provide `codec` in your definition to customize request decoding and response encoding.

Current built-in default: JSON codec.

Architectural rationale:

- keep the transport layer extensible without changing business handlers

## OpenAPI Generation

The OpenAPI generator uses your endpoint definitions and metadata to build a static JSON document.

CLI binary:

```bash
export-open-api
```

The generator accepts positional arguments for:

- API definitions index module path
- output directory (optional, defaults to `dist`)
- API path prefix (optional, defaults to `/api`)

Typical CI flow:

1. Build your project definitions.
2. Run OpenAPI export.
3. Publish generated JSON artifact.
4. Serve static API docs (for example in GitHub Pages) from that artifact.

## Current Architectural Trade-offs

1. **Fetch-based core**
   - Great portability to Edge and modern runtimes.
   - Requires adapter conversion for classic Node middleware stacks.
2. **Zod as contract runtime**
   - Strong validation and type inference.
   - Requires schema discipline in all endpoint definitions.
3. **Optional React Query module**
   - Keeps core lightweight and framework-agnostic.
   - Users needing hooks must install adapter peer dependencies.
4. **Codec abstraction**
   - Future-proofs transport format strategy.
   - Adds a small abstraction layer to runtime pipeline.

## Project Status

The library now supports a modular architecture with:

- framework-agnostic server core
- multi-framework adapters
- framework-agnostic client core
- optional React Query integration
- OpenAPI automation designed for CI/CD pipelines

## Donate

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=BTJPCXNPH43YC)
