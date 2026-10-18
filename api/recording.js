import { getVerseByKey } from '../src/lib/torahCatalog.js';
import { loadCatalog, catalogHeaders, unavailable } from '../lib/recordings.js';

export async function GET(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('verseKey') || `bereshit:vayetzei:rishon:28:${Number(url.searchParams.get('verse'))}`;
  const verse = getVerseByKey(key);
  if (!verse) return Response.json({ error: 'Unknown Torah verse.' }, { status: 400 });
  try {
    const recording = (await loadCatalog()).recordings[key];
    if (!recording) return Response.json({ published: false, verseKey: key }, { status: 404, headers: catalogHeaders() });
    return Response.json({ ...recording, published: true, verseKey: key }, { headers: catalogHeaders() });
  } catch (error) { return unavailable(error); }
}
