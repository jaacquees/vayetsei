import { getAliyah, getVersesForAliyah } from '../src/lib/torahCatalog.js';
import { loadCatalog, catalogHeaders, unavailable } from '../lib/recordings.js';

export async function GET(request) {
  const aliyahId = new URL(request.url).searchParams.get('aliyahId');
  if (!getAliyah(aliyahId)) return Response.json({ error: 'Unknown aliyah.' }, { status: 400 });
  try {
    const catalog = await loadCatalog();
    const recordings = {};
    for (const verse of getVersesForAliyah(aliyahId)) {
      if (catalog.recordings[verse.key]) recordings[verse.key] = catalog.recordings[verse.key];
    }
    return Response.json({ recordings, checkedAt: catalog.checkedAt }, { headers: catalogHeaders() });
  } catch (error) { return unavailable(error); }
}
