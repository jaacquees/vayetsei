import { get, issueSignedToken, list, presignUrl } from '@vercel/blob';

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

async function signedAudioUrl(pathname) {
  // Give the practice page a direct Blob URL rather than proxying media
  // through a Function. This is important for iOS/Safari seeking and ranges.
  const token = await issueSignedToken({
    pathname,
    operations: ['get'],
    validUntil: Date.now() + 8 * 60 * 60 * 1000
  });

  const { presignedUrl } = await presignUrl(token, {
    pathname,
    operation: 'get',
    access: 'private',
    useCache: false,
    validUntil: Date.now() + 6 * 60 * 60 * 1000
  });

  return presignedUrl;
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

    const audioUrl = recording.audioPathname
      ? await signedAudioUrl(recording.audioPathname)
      : null;

    return json({ published: true, ...recording, audioUrl });
  } catch (error) {
    console.error('recording lookup failed', error);
    return json({ error: error?.message || 'Could not load recording.' }, 500);
  }
}
