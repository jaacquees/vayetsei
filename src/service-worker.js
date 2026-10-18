const SHELL_CACHE = 'torah-shell-__BUILD_ID__';
const AUDIO_CACHE = 'torah-published-audio-v1';
const CATALOG_CACHE = 'torah-catalog-v1';
const PRECACHE = __PRECACHE__;
const ROOT = new URL('./', self.registration.scope).pathname;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('torah-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function catalog(request) {
  const cache = await caches.open(CATALOG_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) { await cache.put(request, response.clone()); return response; }
    const saved = await cache.match(request);
    if (!saved) return response;
    return offlineCopy(saved);
  } catch {
    const saved = await cache.match(request);
    return saved ? offlineCopy(saved) : Response.json({ error: 'Connect to the internet to load published recordings.' }, { status: 503 });
  }
}
function offlineCopy(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Offline-Copy', 'true');
  return new Response(response.body, { status: 200, headers });
}
async function audio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  // Range headers do not identify a different recording. Save one full, immutable copy.
  const fullRequest = new Request(request.url);
  let response = await cache.match(fullRequest);
  if (!response) {
    response = await fetch(fullRequest);
    if (!response.ok || !response.headers.get('Content-Type')?.startsWith('audio/')) return response;
    await cache.put(fullRequest, response.clone());
  }
  const range = request.headers.get('Range');
  if (!range) return response;
  const bytes = await response.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const total = bytes.byteLength;
  let start = match?.[1] ? Number(match[1]) : 0;
  let end = match?.[2] ? Number(match[2]) : total - 1;
  if (match && !match[1] && match[2]) { start = Math.max(0, total - Number(match[2])); end = total - 1; }
  end = Math.min(end, total - 1);
  if (!match || start > end || start >= total) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
async function navigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    // Do not mix a newer HTML document with the old worker's precached assets.
    // The browser downloads the new worker and its complete shell on the next check.
    return response.ok ? response : (await cache.match(ROOT)) || response;
  } catch { return (await cache.match(ROOT)) || Response.error(); }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === `${ROOT}api/recordings`) { event.respondWith(catalog(request)); return; }
  if (url.pathname === `${ROOT}api/audio` && url.searchParams.has('pathname')) { event.respondWith(audio(request)); return; }
  // Never cache publishing requests, keys, or instructor pages.
  if (request.mode === 'navigate' && [ROOT, `${ROOT}index.html`].includes(url.pathname)) {
    event.respondWith(navigation(request)); return;
  }
  if (url.pathname.startsWith(`${ROOT}assets/`) || PRECACHE.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});
