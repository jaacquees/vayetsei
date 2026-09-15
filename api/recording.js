import { get, list } from '@vercel/blob';
import { getVerseByKey, storagePrefixForVerse } from '../src/lib/torahCatalog.js';

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}

async function readJson(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return JSON.parse(await new Response(result.stream).text());
}

function resolveVerse(url) {
  const verseKey = url.searchParams.get('verseKey');
  if (verseKey) return getVerseByKey(verseKey);
  const legacy = Number(url.searchParams.get('verse'));
  return getVerseByKey(`bereshit:vayetzei:rishon:28:${legacy}`);
}

export async function GET(request) {
  const url = new URL(request.url);
  const verse = resolveVerse(url);
  if (!verse) return json({ error: 'Unknown Torah verse.' }, 400);

  try {
    const prefix = `${storagePrefixForVerse(verse)}/meta-`;
    const { blobs } = await list({ prefix, limit: 100 });
    if (!blobs?.length) return json({ published: false, verseKey: verse.key }, 404);

    const newest = [...blobs].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
    const recording = await readJson(newest.pathname);
    if (!recording) return json({ published: false, verseKey: verse.key }, 404);

    return json({ published: true, verseKey: verse.key, aliyahId: verse.aliyahId, chapter: verse.chapter, n: verse.n, ...recording });
  } catch (error) {
    console.error('recording lookup failed', { verseKey: verse.key, message: error?.message, stack: error?.stack });
    return json({ error: error?.message || 'Could not load recording.' }, 500);
  }
}
