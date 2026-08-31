import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [preact(), tailwindcss()],
    // Absolute, not './' — relative asset URLs break on nested client-side
    // routes (e.g. /settings/network resolves "assets/x.js" against
    // /settings/, not /). The server maps URL "/" to the SD/LittleFS "/www"
    // folder regardless of the on-disk path, so "/" is the correct root here.
    base: '/',
    build: { outDir: 'dist', target: 'es2020' },
    server: {
      proxy: {
        '/api': env.VITE_ESP_HOST ?? 'http://192.168.4.1',
      },
    },
  };
});
