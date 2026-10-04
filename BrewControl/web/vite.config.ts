import { readFileSync, rmSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [
      preact(),
      tailwindcss(),
      {
        // public/ is copied into dist/ as is, also untracked files. The BJCP data
        // must not end up in a release build by accident (see STYLE_COMPARISON).
        name: 'drop-bjcp-data',
        apply: 'build',
        closeBundle() {
          const file = 'dist/modules/recipes/bjcp-2021.json';
          if (env.VITE_STYLE_COMPARISON !== '1') { rmSync(file, { force: true }); return; }
          // Windows PowerShell 5.1 redirects (">") write UTF-16, which the browser cannot parse.
          try { JSON.parse(readFileSync(file, 'utf8')); } catch (e: unknown) {
            if ((e as { code?: string }).code !== 'ENOENT') throw new Error(`${file} is not valid UTF-8 JSON (created with PowerShell ">"? see README)`);
          }
        },
      },
    ],
    // Absolute, not './' — relative asset URLs break on nested client-side
    // routes (e.g. /settings/network resolves "assets/x.js" against
    // /settings/, not /). The server maps URL "/" to the SD/LittleFS "/www"
    // folder regardless of the on-disk path, so "/" is the correct root here.
    base: '/',
    build: {
      outDir: 'dist',
      target: 'es2020',
      rollupOptions: {
        output: {
          // An optional package (src/modules/<name>.ts) lands in dist/modules/<name>/
          // next to its manifest and data, so the release can leave the whole folder
          // out of the small-partition build.
          chunkFileNames: (chunk) => {
            const pkg = chunk.facadeModuleId?.match(/\/src\/modules\/([^/.]+)\.ts$/)?.[1];
            return pkg ? `modules/${pkg}/[name]-[hash].js` : 'assets/[name]-[hash].js';
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': env.VITE_ESP_HOST ?? 'http://192.168.4.1',
      },
    },
  };
});
