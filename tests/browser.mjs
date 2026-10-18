import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { verses, storagePrefixForVerse } from '../src/lib/torahCatalog.js';
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/noop.js');
const { chromium } = require('playwright');
const root = resolve('dist');
let suspended = false, catalogs = 0, audioReads = 0;
const v = verses[0];
const pathname = `${storagePrefixForVerse(v)}/audio-test.m4a`;
const fixtureAudio = await readFile('static/audio/01.m4a');
const server = createServer(async (req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/recordings') {
    catalogs++;
    res.writeHead(suspended ? 503 : 200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(suspended ? {error:'Published recordings are temporarily unavailable.'} : {recordings:{[v.key]:{audioPathname:pathname, wordStarts:v.wordStarts}}})); return;
  }
  if (url.pathname === '/api/audio') {
    audioReads++;
    res.writeHead(suspended ? 503 : 200, {'Content-Type':suspended?'application/json':'audio/mp4'});
    res.end(suspended ? '{}' : fixtureAudio); return;
  }
  try {
    const filename = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!filename.startsWith(root+'/')) throw new Error('bad path');
    const content = await readFile(filename);
    const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
    res.writeHead(200, {'Content-Type':types[extname(filename)] || 'application/octet-stream'});res.end(content);
  } catch { res.writeHead(404);res.end('Not found'); }
});
await new Promise(r => server.listen(0,'127.0.0.1',r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE, args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
try {
  // A fresh install during suspension must not play an embedded recording.
  suspended = true;
  const failed = await browser.newContext({serviceWorkers:'block'});
  await failed.route('https://**', route => route.abort());
  const page = await failed.newPage();
  await page.goto(origin);
  await page.getByRole('alert').waitFor();
  assert.equal(catalogs, 1);
  await page.locator('article .row-play').first().click();
  assert.equal(await page.locator('audio').getAttribute('src'), null);
  await page.getByRole('button', {name:'Use original recordings instead'}).click();
  await page.getByText('Playing the original recordings.').waitFor();
  await page.locator('article .row-play').first().click();
  assert.match(await page.locator('audio').getAttribute('src'), /audio\/01.m4a/);
  await page.getByRole('button',{name:'Add to Home Screen'}).click();
  await page.getByText(/On iPhone or iPad:/).waitFor();
  await failed.close();
  console.log('PASS: suspended store, explicit original choice, install instructions');

  suspended = false;
  const context = await browser.newContext();
  await context.route('https://**', route => route.abort());
  const p = await context.newPage();
  p.on('console', msg => { if (msg.type() === 'warning') console.log('Browser warning:', msg.text()); });
  const errors = [];p.on('pageerror', e => errors.push(e.message));
  await p.goto(origin);
  console.log('Worker check:', await p.evaluate(async () => ({available:'serviceWorker' in navigator, registrations:(await navigator.serviceWorker.getRegistrations()).map(r => ({scope:r.scope, active:r.active?.state, installing:r.installing?.state})), readyState:document.readyState})));
  await p.waitForFunction(() => 'serviceWorker' in navigator && navigator.serviceWorker.controller);
  await p.reload();
  await p.getByRole('button',{name:'Save for offline practice'}).click();
  await p.getByText('1 recording saved for offline practice on this device.').waitFor();
  const manifest = await p.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,3);
  const beforeReads = audioReads;
  await context.setOffline(true);
  await p.reload();
  await p.getByText(/Using the last saved recording list/).waitFor();
  await p.locator('article .row-play').first().click();
  await p.waitForFunction(() => document.querySelector('audio').readyState >= 1);
  const range = await p.evaluate(async () => {
    const url = document.querySelector('audio').src;
    const r = await fetch(url, {headers:{Range:'bytes=10-19'}});
    return {status:r.status, size:(await r.arrayBuffer()).byteLength, range:r.headers.get('Content-Range')};
  });
  assert.equal(range.status,206);assert.equal(range.size,10);assert.match(range.range,/bytes 10-19\//);
  assert.equal(audioReads,beforeReads);
  assert.deepEqual(errors,[]);
  console.log('PASS: worker installation, manifest, offline shell/catalog/audio and byte-range seeking');
  await context.close();
} finally { await browser.close(); await new Promise(r => server.close(r)); }
