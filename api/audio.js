import { get, issueSignedToken, list, presignUrl } from '@vercel/blob';
import { getVerseByKey, storagePrefixForVerse } from '../src/lib/torahCatalog.js';

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

function fallbackUrl(request, verse) {
  if (!verse?.audio) return null;
  return new URL(`/${verse.audio.replace(/^\//,'')}`, request.url).toString();
}

export async function GET(request) {
  const url = new URL(request.url);
  const verse = resolveVerse(url);
  if (!verse) return new Response('Unknown Torah verse', { status: 400 });
  const fallback = fallbackUrl(request, verse);

  try {
    const prefix = `${storagePrefixForVerse(verse)}/meta-`;
    const { blobs } = await list({ prefix, limit: 100 });
    if (!blobs?.length) return fallback ? Response.redirect(fallback, 302) : new Response('No recording yet', { status: 404 });

    const newest = [...blobs].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
    const metadata = await readJson(newest.pathname);
    if (!metadata?.audioPathname) return fallback ? Response.redirect(fallback, 302) : new Response('No recording yet', { status: 404 });

    const token = await issueSignedToken({
      pathname: metadata.audioPathname,
      operations: ['get'],
      validUntil: Date.now() + 8 * 60 * 60 * 1000
    });
    const { presignedUrl } = await presignUrl(token, {
      pathname: metadata.audioPathname,
      operation: 'get',
      access: 'private',
      useCache: false,
      validUntil: Date.now() + 6 * 60 * 60 * 1000
    });
    return Response.redirect(presignedUrl, 302);
  } catch (error) {
    console.error('audio lookup failed', { verseKey: verse.key, message: error?.message, stack: error?.stack });
    return fallback ? Response.redirect(fallback, 302) : new Response('Audio unavailable', { status: 500 });
  }
}
