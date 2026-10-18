import { get, list } from '@vercel/blob';
import { getCache } from '@vercel/functions';
import { verses, storagePrefixForVerse } from '../src/lib/torahCatalog.js';

export const RECORDINGS_TAG = 'vayetsei-recordings-v1';
export const CACHE_KEY = `vayetsei:${process.env.BLOB_STORE_ID || 'local'}:catalog-v1`;
export const cache = getCache();

export function validRecording(verse, recording) {
  const starts = recording?.wordStarts;
  return typeof recording?.audioPathname === 'string'
    && recording.audioPathname.startsWith(`${storagePrefixForVerse(verse)}/audio-`)
    && !recording.audioPathname.includes('..')
    && Array.isArray(starts) && starts.length === verse.tikkun.trim().split(/\s+/).length
    && starts.every((n, i) => Number.isFinite(n) && n >= 0 && (i === 0 || n > starts[i - 1]));
}

// Shared Runtime Cache survives function cold starts; single-flight collapses concurrent misses.
export function createCatalogLoader({ blobList = list, blobGet = get, sharedCache = cache } = {}) {
  let pending;
  return async function loadCatalog() {
    const cached = await sharedCache.get(CACHE_KEY);
    if (cached) {
      if (cached.error) throw new Error(cached.error);
      return cached;
    }
    if (pending) return pending;
    pending = (async () => {
      try {
        const byPrefix = new Map(verses.map(v => [`${storagePrefixForVerse(v)}/meta-`, v]));
        const latest = new Map();
        let cursor;
        do {
          const page = await blobList({ limit: 1000, ...(cursor ? { cursor } : {}) });
          for (const blob of page.blobs) {
            const marker = blob.pathname.lastIndexOf('/meta-');
            const verse = byPrefix.get(blob.pathname.slice(0, marker + 6));
            if (!verse || !blob.pathname.endsWith('.json')) continue;
            const previous = latest.get(verse.key);
            if (!previous || new Date(blob.uploadedAt) > new Date(previous.uploadedAt)) latest.set(verse.key, blob);
          }
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
        const recordings = {};
        await Promise.all([...latest].map(async ([key, blob]) => {
          const result = await blobGet(blob.pathname, { access: 'private' });
          if (!result || result.statusCode !== 200) throw new Error('Published recording details are unavailable.');
          const metadata = JSON.parse(await new Response(result.stream).text());
          const verse = verses.find(v => v.key === key);
          if (!validRecording(verse, metadata)) throw new Error(`Published recording details are invalid for Genesis ${verse.chapter}:${verse.n}.`);
          recordings[key] = metadata;
        }));
        const catalog = { recordings, checkedAt: new Date().toISOString() };
        await sharedCache.set(CACHE_KEY, catalog, { ttl: 86400, tags: [RECORDINGS_TAG] });
        return catalog;
      } catch (error) {
        // Back off on suspension; refreshing the page must not hammer Blob again.
        await sharedCache.set(CACHE_KEY, { error: error.message }, { ttl: 60, tags: [RECORDINGS_TAG] }).catch(() => {});
        throw error;
      } finally { pending = null; }
    })();
    return pending;
  };
}

export const loadCatalog = createCatalogLoader();
export function catalogHeaders() {
  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vercel-CDN-Cache-Control': 'public, max-age=3600',
    'Vercel-Cache-Tag': RECORDINGS_TAG
  };
}
export function unavailable(error) {
  console.error('Published recordings unavailable', { message: error?.message });
  return Response.json({
    error: 'Published recordings are temporarily unavailable. Your original recordings have not been substituted.',
    code: 'RECORDINGS_UNAVAILABLE'
  }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
}
