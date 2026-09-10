import { put } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

const WORD_COUNTS = {
  10: 6, 11: 14, 12: 14, 13: 20, 14: 14, 15: 18, 16: 12,
  17: 13, 18: 13, 19: 8, 20: 18, 21: 8, 22: 13
};
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

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

function validateStarts(value, expectedCount) {
  if (!Array.isArray(value) || value.length !== expectedCount) return null;
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
    const expectedCount = WORD_COUNTS[verse];
    const audio = form.get('audio');
    const duration = Number(form.get('duration'));
    let parsedStarts;

    try {
      parsedStarts = JSON.parse(String(form.get('wordStarts') || '[]'));
    } catch {
      return json({ error: 'wordStarts must be valid JSON.' }, 400);
    }

    if (!expectedCount) return json({ error: 'Verse must be between 10 and 22.' }, 400);
    const wordStarts = validateStarts(parsedStarts, expectedCount);
    if (!wordStarts) {
      return json({ error: `This passuk requires exactly ${expectedCount} strictly increasing word boundaries.` }, 400);
    }
    if (!(audio instanceof File) || !audio.type.startsWith('audio/')) {
      return json({ error: 'An audio recording is required.' }, 400);
    }
    if (!audio.size || audio.size > MAX_AUDIO_BYTES) {
      return json({ error: 'Audio file must be between 1 byte and 4 MB.' }, 400);
    }
    if (Number.isFinite(duration) && duration > 0 && wordStarts.at(-1) > duration + 0.25) {
      return json({ error: 'The final word boundary is beyond the end of the recording.' }, 400);
    }

    const publishedAt = new Date().toISOString();
    const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const root = `vayetsei/rishon/verse-${verse}`;
    const ext = extensionFor(audio.type);
    const audioPathname = `${root}/audio-${stamp}.${ext}`;

    const audioBlob = await put(audioPathname, audio, {
      access: 'private',
      addRandomSuffix: false,
      contentType: audio.type,
      cacheControlMaxAge: 31536000
    });

    const metadata = {
      version: 3,
      n: verse,
      wordStarts,
      audioPathname: audioBlob.pathname,
      audioType: audio.type,
      audioSize: audio.size,
      duration: Number.isFinite(duration) ? Number(duration.toFixed(3)) : null,
      publishedAt
    };

    const metadataBlob = await put(
      `${root}/meta-${stamp}.json`,
      JSON.stringify(metadata, null, 2),
      {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
        cacheControlMaxAge: 60
      }
    );

    return json({ ok: true, recording: metadata, metadataPathname: metadataBlob.pathname }, 201);
  } catch (error) {
    console.error('publish failed', error);
    return json({ error: error?.message || 'Publish failed.' }, 500);
  }
}
