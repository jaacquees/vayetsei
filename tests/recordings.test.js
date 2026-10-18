import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogLoader, CACHE_KEY } from '../lib/recordings.js';
import { verses, storagePrefixForVerse } from '../src/lib/torahCatalog.js';
import { applyPublished } from '../src/lib/publishedRecordings.js';
import { audioResponse } from '../lib/audioResponse.js';

function memoryCache() {
  const values = new Map();
  return { get: async key => values.get(key), set: async (key, value) => values.set(key, value), delete: async key => values.delete(key) };
}
const verse = verses[0];
const prefix = storagePrefixForVerse(verse);
const metadata = { audioPathname: `${prefix}/audio-new.m4a`, wordStarts: verse.wordStarts, publishedAt: '2026-10-18T19:00:00Z' };
function blobJson(value) { return { statusCode: 200, stream: new Response(JSON.stringify(value)).body }; }

test('one paginated discovery selects newest take; concurrent users and cold starts use shared cache', async () => {
  let lists = 0, reads = 0;
  const sharedCache = memoryCache();
  const blobList = async ({ cursor }) => {
    lists++;
    return cursor ? { blobs: [{ pathname: `${prefix}/meta-new.json`, uploadedAt:'2026-10-18' }], hasMore:false }
      : { blobs: [{ pathname: `${prefix}/meta-old.json`, uploadedAt:'2026-09-07' }], hasMore:true, cursor:'next' };
  };
  const blobGet = async path => { reads++; assert.equal(path, `${prefix}/meta-new.json`); return blobJson(metadata); };
  const loader = createCatalogLoader({ sharedCache, blobList, blobGet });
  const results = await Promise.all(Array.from({length:13}, () => loader()));
  assert.equal(results[0].recordings[verse.key].audioPathname, metadata.audioPathname);
  assert.equal(lists, 2); assert.equal(reads, 1);
  await createCatalogLoader({ sharedCache, blobList, blobGet })();
  assert.equal(lists, 2); assert.equal(reads, 1);
  await sharedCache.delete(CACHE_KEY);
  await loader();
  assert.equal(lists, 4);
});

test('suspension throws and backs off instead of returning an empty catalog or old recording', async () => {
  let lists = 0;
  const loader = createCatalogLoader({ sharedCache:memoryCache(), blobList:async () => { lists++; throw new Error('403 Forbidden'); } });
  await assert.rejects(loader(), /403/);
  await assert.rejects(loader(), /403/);
  assert.equal(lists, 1);
});

test('published takes are versioned; absent takes never inherit embedded originals', () => {
  const mapped = applyPublished(verses.slice(0,2), { [verse.key]:metadata });
  assert.match(mapped[0].audio, /api\/audio\?verseKey=.*&pathname=/);
  assert.equal(mapped[0].audioSource, 'published');
  assert.equal(mapped[1].audio, null);
});

test('bad word timings fail clearly instead of silently using an old take', async () => {
  const loader = createCatalogLoader({ sharedCache:memoryCache(), blobList:async () => ({ blobs:[{ pathname:`${prefix}/meta-new.json`, uploadedAt:'2026-10-18' }], hasMore:false }), blobGet:async () => blobJson({...metadata, wordStarts:[1]}) });
  await assert.rejects(loader(), /invalid/);
});

test('audio supports Safari full, bounded and suffix byte ranges and rejects invalid ranges', async () => {
  const bytes = new Uint8Array([0,1,2,3,4,5]);
  const response = async range => audioResponse({blob:{ contentType:'audio/mp4', size:6 }, stream:new Response(bytes).body}, new Request('https://example.test/audio', {headers: range ? {Range:range} : {}}), true);
  let r = await response(); assert.equal(r.status,200); assert.equal(r.headers.get('Content-Length'),'6');
  r = await response('bytes=1-3'); assert.equal(r.status,206); assert.equal(r.headers.get('Content-Range'),'bytes 1-3/6'); assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3]);
  r = await response('bytes=-2'); assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[4,5]);
  assert.equal((await response('bytes=99-100')).status,416);
});
