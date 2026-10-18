import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte(), {
    name: 'practice-pwa',
    generateBundle: { order: 'post', handler(options, bundle) {
      const base = process.env.VERCEL ? '/' : '/vayetsei/';
      const files = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name));
      const precache = [base, `${base}manifest.webmanifest`, `${base}icons/icon-192.png`, ...files.map(name => `${base}${name}`)];
      const template = readFileSync('src/service-worker.js', 'utf8');
      const buildId = createHash('sha256').update(template + JSON.stringify(files)).digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: template.replace('__BUILD_ID__', buildId).replace('__PRECACHE__', JSON.stringify(precache)) });
    }}
  }],
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
