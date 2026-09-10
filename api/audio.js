import { get, list } from '@vercel/blob';

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

    const result = await get(metadata.audioPathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined
    });

    if (!result) return Response.redirect(fallback, 302);
    if (result.statusCode === 304) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          'Cache-Control': 'private, no-cache'
        }
      });
    }
    if (result.statusCode !== 200) return Response.redirect(fallback, 302);

    return new Response(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || metadata.audioType || 'audio/webm',
        'X-Content-Type-Options': 'nosniff',
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache'
      }
    });
  } catch (error) {
    console.error('audio lookup failed; using original recording', error);
    return Response.redirect(fallback, 302);
  }
}
