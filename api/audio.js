import { get, issueSignedToken, list, presignUrl } from '@vercel/blob';

const VALID_VERSES = new Set(Array.from({ length: 13 }, (_, i) => i + 10));

function defaultAudioUrl(verse) {
  const file = String(verse - 9).padStart(2, '0');
  return `https://jaacquees.github.io/vayetsei/audio/${file}.m4a`;
}

async function readJson(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export async function GET(request) {
  const url = new URL(request.url);
  const verse = Number(url.searchParams.get('verse'));
  if (!VALID_VERSES.has(verse)) return new Response('Invalid verse', { status: 400 });

  const fallback = defaultAudioUrl(verse);

  try {
    const prefix = `vayetsei/rishon/verse-${verse}/meta-`;
    const { blobs } = await list({ prefix, limit: 100 });
    if (!blobs?.length) return Response.redirect(fallback, 302);

    const newest = [...blobs].sort((a, b) => {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    })[0];

    const metadata = await readJson(newest.pathname);
    if (!metadata?.audioPathname) return Response.redirect(fallback, 302);

    // Do not proxy the audio stream through a Serverless Function. Browsers,
    // especially iOS Safari, rely on byte-range requests for seekable media.
    // A short-lived signed Blob URL lets the browser talk directly to Blob,
    // which preserves normal audio seeking/range behavior while keeping the
    // underlying store private.
    const tokenValidUntil = Date.now() + 60 * 60 * 1000;
    const urlValidUntil = Date.now() + 10 * 60 * 1000;
    const token = await issueSignedToken({
      pathname: metadata.audioPathname,
      operations: ['get'],
      validUntil: tokenValidUntil
    });
    const { presignedUrl } = await presignUrl(token, {
      pathname: metadata.audioPathname,
      operation: 'get',
      validUntil: urlValidUntil
    });

    return Response.redirect(presignedUrl, 302);
  } catch (error) {
    console.error('audio lookup failed; using original recording', error);
    return Response.redirect(fallback, 302);
  }
}
