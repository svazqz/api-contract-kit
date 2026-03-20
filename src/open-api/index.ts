import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { setOpenAPIMetadata } from '../utils';

type ExportOpenApiConfig = {
  baseDir: string;
  indexPath: string;
  outPath?: string;
  pathPrefix?: string;
  loadDefinitions?: (absolutePath: string) => unknown;
  mkdirFn?: (dirPath: string) => void;
  writeFileFn?: (filePath: string, contents: string) => void;
};

const defaultLoader = (absolutePath: string) => require(absolutePath);

export const exportOpenApi = (config: ExportOpenApiConfig) => {
  const registry = new OpenAPIRegistry();
  extendZodWithOpenApi(z);

  const outPath = config.outPath || `${config.baseDir}/dist`;
  const pathPrefix = config.pathPrefix || '/api';
  const loadDefinitions = config.loadDefinitions ?? defaultLoader;
  const mkdirFn = config.mkdirFn ?? ((dirPath: string) => fs.mkdirSync(dirPath, { recursive: true }));
  const writeFileFn =
    config.writeFileFn ??
    ((filePath: string, contents: string) =>
      fs.writeFileSync(filePath, contents, {
        encoding: 'utf-8',
      }));
  const definitionsPath = path.resolve(config.baseDir, config.indexPath);
  const apiDefinitions = loadDefinitions(definitionsPath) as Record<string, unknown>;

  Object.entries(apiDefinitions).forEach(([_namespace, definitions]) => {
    Object.entries(definitions as any).forEach(([_key, def]) => {
      const d = def as any;
      const routeConfig =
        d.apiConfig ??
        setOpenAPIMetadata({
          ...d,
          endpoint: d.endpoint ?? d.path,
          openapiPathPrefix: pathPrefix,
        });
      registry.registerPath(routeConfig);
    });
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const result = generator.generateDocument({
    info: {
      title: '',
      version: '1',
    },
    openapi: '3.0.0',
  });

  const docsDir = path.resolve(outPath, 'apps/openapi');
  mkdirFn(docsDir);
  writeFileFn(path.resolve(docsDir, 'docs.json'), JSON.stringify(result, null, 2));

  return result;
};

type RunCliConfig = {
  baseDir?: string;
  loadDefinitions?: (absolutePath: string) => unknown;
  mkdirFn?: (dirPath: string) => void;
  writeFileFn?: (filePath: string, contents: string) => void;
};

export const runOpenApiCli = (argv = process.argv, config: RunCliConfig = {}) => {
  if (argv.length < 4) {
    throw new Error('You need to specify the index file (relative to project root) for API generation.');
  }

  const baseDir = config.baseDir ?? `${process.cwd()}`;
  const indexPath = argv[3];
  const outPath = argv[4] || `${baseDir}/dist`;
  const pathPrefix = argv[5] || '/api';
  const result = exportOpenApi({
    baseDir,
    indexPath,
    outPath,
    pathPrefix,
    loadDefinitions: config.loadDefinitions,
    mkdirFn: config.mkdirFn,
    writeFileFn: config.writeFileFn,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
};

const scriptPath = process.argv[1] || '';
if (
  scriptPath.endsWith('open-api.cjs.js') ||
  scriptPath.endsWith('open-api.es.js')
) {
  runOpenApiCli();
}
