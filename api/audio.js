import { get } from '@vercel/blob';
import { audioResponse } from '../lib/audioResponse.js';
import { getVerseByKey, storagePrefixForVerse } from '../src/lib/torahCatalog.js';
import { loadCatalog, unavailable } from '../lib/recordings.js';

export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('verseKey') || `bereshit:vayetzei:rishon:28:${Number(url.searchParams.get('verse'))}`;
  const verse = getVerseByKey(key);
  if (!verse) return new Response('Unknown Torah verse', { status: 400 });
  try {
    // The catalog supplies an immutable version: playback never lists Blob objects.
    const pathname = url.searchParams.get('pathname') || (await loadCatalog()).recordings[key]?.audioPathname;
    if (!pathname) return new Response('No recording published', { status: 404 });
    const prefix = `${storagePrefixForVerse(verse)}/audio-`;
    if (!pathname.startsWith(prefix) || !/^[\w/.-]+$/.test(pathname) || pathname.includes('..')) {
      return new Response('Invalid recording path', { status: 400 });
    }
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) return new Response('Recording unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return audioResponse(result, request, url.searchParams.has('pathname'));
  } catch (error) { return unavailable(error); }
}
