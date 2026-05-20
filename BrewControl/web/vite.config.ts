import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [preact(), tailwindcss()],
    base: './',
    build: { outDir: 'dist', target: 'es2020' },
    server: {
      proxy: {
        '/api': env.VITE_ESP_HOST ?? 'http://192.168.4.1',
      },
    },
  };
});
