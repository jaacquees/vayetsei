import { list } from '@vercel/blob';

const VALID_VERSES = new Set(Array.from({ length: 13 }, (_, i) => i + 10));

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  });
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

    const response = await fetch(newest.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not read metadata (${response.status})`);
    const recording = await response.json();

    return json({ published: true, ...recording });
  } catch (error) {
    console.error('recording lookup failed', error);
    return json({ error: error?.message || 'Could not load recording.' }, 500);
  }
}
