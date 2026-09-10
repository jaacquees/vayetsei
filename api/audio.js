import { list } from '@vercel/blob';

const VALID_VERSES = new Set(Array.from({ length: 13 }, (_, i) => i + 10));

export async function GET(request) {
  const url = new URL(request.url);
  const verse = Number(url.searchParams.get('verse'));
  if (!VALID_VERSES.has(verse)) return new Response('Invalid verse', { status: 400 });

  try {
    const prefix = `vayetsei/rishon/verse-${verse}/meta-`;
    const { blobs } = await list({ prefix, limit: 100 });
    if (!blobs?.length) return new Response('No published recording', { status: 404 });

    const newest = [...blobs].sort((a, b) => {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    })[0];

    const metadataResponse = await fetch(newest.url, { cache: 'no-store' });
    if (!metadataResponse.ok) return new Response('Could not load recording metadata', { status: 502 });
    const metadata = await metadataResponse.json();
    if (!metadata?.audioUrl) return new Response('Recording has no audio URL', { status: 404 });

    return Response.redirect(metadata.audioUrl, 302);
  } catch (error) {
    console.error('audio lookup failed', error);
    return new Response(error?.message || 'Could not load audio', { status: 500 });
  }
}
