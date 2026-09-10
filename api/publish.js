import { put } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

const VALID_VERSES = new Set(Array.from({ length: 13 }, (_, i) => i + 10));
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function isAuthorized(request) {
  const expected = process.env.TEACHER_PUBLISH_KEY;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function extensionFor(type) {
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  return 'webm';
}

function validateStarts(value) {
  if (!Array.isArray(value) || !value.length) return null;
  const starts = value.map(Number);
  if (starts.some((v) => !Number.isFinite(v) || v < 0)) return null;
  for (let i = 1; i < starts.length; i += 1) {
    if (starts[i] <= starts[i - 1]) return null;
  }
  return starts.map((v) => Number(v.toFixed(3)));
}

export async function POST(request) {
  if (!process.env.TEACHER_PUBLISH_KEY) {
    return json({ error: 'TEACHER_PUBLISH_KEY is not configured on Vercel.' }, 503);
  }
  if (!isAuthorized(request)) return json({ error: 'Invalid publish key.' }, 401);

  try {
    const form = await request.formData();
    const verse = Number(form.get('verse'));
    const audio = form.get('audio');
    let parsedStarts;

    try {
      parsedStarts = JSON.parse(String(form.get('wordStarts') || '[]'));
    } catch {
      return json({ error: 'wordStarts must be valid JSON.' }, 400);
    }

    const wordStarts = validateStarts(parsedStarts);
    if (!VALID_VERSES.has(verse)) return json({ error: 'Verse must be between 10 and 22.' }, 400);
    if (!(audio instanceof File) || !audio.type.startsWith('audio/')) return json({ error: 'An audio recording is required.' }, 400);
    if (!audio.size || audio.size > MAX_AUDIO_BYTES) return json({ error: 'Audio file must be between 1 byte and 8 MB.' }, 400);
    if (!wordStarts) return json({ error: 'wordStarts must be a non-empty, strictly increasing array.' }, 400);

    const publishedAt = new Date().toISOString();
    const stamp = publishedAt.replace(/[:.]/g, '-');
    const root = `vayetsei/rishon/verse-${verse}`;
    const ext = extensionFor(audio.type);

    const audioBlob = await put(`${root}/audio-${stamp}.${ext}`, audio, {
      access: 'public',
      addRandomSuffix: true,
      contentType: audio.type
    });

    const metadata = {
      version: 1,
      n: verse,
      wordStarts,
      audioUrl: audioBlob.url,
      audioType: audio.type,
      audioSize: audio.size,
      publishedAt
    };

    const metadataBlob = await put(
      `${root}/meta-${stamp}.json`,
      JSON.stringify(metadata, null, 2),
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json'
      }
    );

    return json({ ok: true, recording: metadata, metadataUrl: metadataBlob.url }, 201);
  } catch (error) {
    console.error('publish failed', error);
    return json({ error: error?.message || 'Publish failed.' }, 500);
  }
}
