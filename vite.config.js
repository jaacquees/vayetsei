import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: process.env.VERCEL ? '/' : '/vayetsei/',
  publicDir: 'static',
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        adjust: resolve(process.cwd(), 'adjust/index.html'),
        recordTest: resolve(process.cwd(), 'record-test/index.html'),
        recordPublish: resolve(process.cwd(), 'record-publish/index.html')
      }
    }
  }
});
