import { get, list } from '@vercel/blob';

const VALID_VERSES = new Set(Array.from({ length: 13 }, (_, i) => i + 10));

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
}

async function readJson(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export async function GET(request) {
  const url = new URL(request.url);
  const verse = Number(url.searchParams.get('verse'));
  if (!VALID_VERSES.has(verse)) return json({ error: 'Verse must be between 10 and 22.' }, 400);

  try {
    const prefix = `vayetsei/rishon/verse-${verse}/meta-`;
    const { blobs } = await list({ prefix, limit: 100 });
    if (!blobs?.length) return json({ published: false, n: verse }, 404);

    const newest = [...blobs].sort((a, b) => {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    })[0];

    const recording = await readJson(newest.pathname);
    if (!recording) return json({ published: false, n: verse }, 404);

    return json({ published: true, ...recording });
  } catch (error) {
    console.error('recording lookup failed', { verse, message: error?.message, stack: error?.stack });
    return json({ error: error?.message || 'Could not load recording.' }, 500);
  }
}
