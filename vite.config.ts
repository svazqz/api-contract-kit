import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

type LibName =
  | 'api-contract-kit'
  | 'client'
  | 'react-query'
  | 'server'
  | 'export-open-api';

type BuildConfig = {
  entry: string;
  fileName: (format: string) => string;
};

const config: Record<LibName, BuildConfig> = {
  'api-contract-kit': {
    entry: resolve(__dirname, './src/api-contract-kit.ts'),
    fileName: (format) => `api-contract-kit.${format}.js`,
  },
  client: {
    entry: resolve(__dirname, './src/client.ts'),
    fileName: (format) => `client.${format}.js`,
  },
  'react-query': {
    entry: resolve(__dirname, './src/react-query.ts'),
    fileName: (format) => `react-query.${format}.js`,
  },
  server: {
    entry: resolve(__dirname, './src/server.ts'),
    fileName: (format) => `server.${format}.js`,
  },
  'export-open-api': {
    entry: resolve(__dirname, './src/open-api/index.ts'),
    fileName: (format) => `open-api.${format}.js`,
  },
};

const libName = (process?.env?.LIB_NAME || 'api-contract-kit') as LibName;
const currentConfig = config[libName];
if (currentConfig === undefined) {
  throw new Error('LIB_NAME is not defined or is not valid');
}
export default defineConfig({
  build: {
    outDir: "./dist",
    lib: {
      ...currentConfig,
      formats: ["cjs", "es"],
    },
    emptyOutDir: false,
    //Generates sourcemaps for the built files,
    //aiding in debugging.
    sourcemap: true,
  },
  plugins: [dts(), nodePolyfills()],
});
