import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runOpenApiCli } from '../src/open-api/index';

describe('open-api cli integration', () => {
  it('generates docs.json in a temp directory', () => {
    const tmpRoot = '/tmp/api-contract-kit-cli-test';
    const writes = new Map<string, string>();
    const createdDirs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const outPath = path.join(tmpRoot, 'generated');
      const result = runOpenApiCli([
        'node',
        'open-api.cjs.js',
        'ignored',
        'fixtures/definitions.cjs',
        outPath,
        '/v1',
      ], {
        baseDir: tmpRoot,
        loadDefinitions: () => ({
          v1: {
            getHealth: {
              method: 'get',
              endpoint: '/health',
              schemas: {},
              openapi: {
                tags: ['health'],
                security: [{ bearer: [] }],
                responses: { 401: { description: 'Unauthorized' } },
              },
            },
          },
        }),
        mkdirFn: (dirPath) => {
          createdDirs.push(dirPath);
        },
        writeFileFn: (filePath, contents) => {
          writes.set(filePath, contents);
        },
      }) as any;

      const docsPath = path.join(outPath, 'apps/openapi/docs.json');
      const docs = JSON.parse(writes.get(docsPath) || '{}');

      expect(result.openapi).toBe('3.0.0');
      expect(createdDirs).toContain(path.join(outPath, 'apps/openapi'));
      expect(writes.has(docsPath)).toBe(true);
      expect(docs.paths['/v1/health']).toBeDefined();
      expect(docs.paths['/v1/health'].get.tags).toEqual(['health']);
    } finally {
      logSpy.mockRestore();
    }
  });
});
