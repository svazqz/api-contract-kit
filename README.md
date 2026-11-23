# ![API Contract Kit](docs/readme/banner.svg)

Define HTTP endpoints once with Zod. Reuse the same contract for server-side validation, typed clients, and OpenAPI output.

[![Latest release](https://img.shields.io/github/v/release/svazqz/api-contract-kit?label=release)](https://github.com/svazqz/api-contract-kit/releases/latest) [![npm publish workflow](https://github.com/svazqz/api-contract-kit/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/svazqz/api-contract-kit/actions/workflows/npm-publish.yml) [![Validation](https://github.com/svazqz/api-contract-kit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/svazqz/api-contract-kit/actions/workflows/ci.yml)

[Quick start](#quick-start) · [Validation](#validation) · [Project layout](#project-layout) · [Reference](#reference) · [License](#license)

## Quick start

Install the package and its schema dependencies in your application.

```sh
npm install @svazqz/api-contract-kit zod @asteasolutions/zod-to-openapi
```

Define an endpoint with `createAPIDefinition`, then connect a server adapter and a typed client. The [companion demo](https://github.com/svazqz/api-contract-kit-demo) walks through a complete Next.js integration.

## Validation

The Vitest unit suite enforces 95% line coverage of the library runtime. The OpenAPI export integration suite enforces 90% line coverage of the exporter.

```sh
docker run --rm --init \
  --mount "type=bind,source=$PWD,target=/src,readonly" \
  node:22-bookworm-slim sh /src/tests/run-container-tests.sh
```

```sh
npm ci
npm test
npm run build
```

Run `npm run lint` for the ESLint checks.

## Project layout

| Path | Purpose |
| --- | --- |
| [`src/`](src/) | Contract definitions, runtime, adapters, and OpenAPI export |
| [`tests/`](tests/) | Automated behavior checks |
| [`CHANGELOG.txt`](CHANGELOG.txt) | Version history |

## Reference

Read the [project reference](README.reference.md) for detailed examples, configuration, and original notes.

## License

See [`LICENSE.md`](LICENSE.md) for license terms.
