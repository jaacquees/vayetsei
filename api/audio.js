import { list } from '@vercel/blob';

const VALID_VERSES = new Set(Array.from({ length: 13 }, (_, i) => i + 10));

function defaultAudioUrl(verse) {
  const file = String(verse - 9).padStart(2, '0');
  return `https://jaacquees.github.io/vayetsei/audio/${file}.m4a`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const verse = Number(url.searchParams.get('verse'));
  if (!VALID_VERSES.has(verse)) return new Response('Invalid verse', { status: 400 });

  const fallback = defaultAudioUrl(verse);
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.redirect(fallback, 302);

  try {
    const prefix = `vayetsei/rishon/verse-${verse}/meta-`;
    const { blobs } = await list({ prefix, limit: 100 });
    if (!blobs?.length) return Response.redirect(fallback, 302);

    const newest = [...blobs].sort((a, b) => {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    })[0];

    const metadataResponse = await fetch(newest.url, { cache: 'no-store' });
    if (!metadataResponse.ok) return Response.redirect(fallback, 302);
    const metadata = await metadataResponse.json();
    if (!metadata?.audioUrl) return Response.redirect(fallback, 302);

    return Response.redirect(metadata.audioUrl, 302);
  } catch (error) {
    console.error('audio lookup failed; using original recording', error);
    return Response.redirect(fallback, 302);
  }
}
