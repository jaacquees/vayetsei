export async function audioResponse(result, request, immutable) {
  const headers = new Headers({
    'Content-Type': result.blob.contentType || 'audio/mp4',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
    'X-Recording-Source': 'published',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes'
  });
  const range = request.headers.get('Range');
  if (!range) {
    if (result.blob.size) headers.set('Content-Length', String(result.blob.size));
    return new Response(result.stream, { headers });
  }
  const bytes = await new Response(result.stream).arrayBuffer();
  const total = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = match?.[1] ? Number(match[1]) : 0;
  let end = match?.[2] ? Number(match[2]) : total - 1;
  if (match && !match[1] && match[2]) { start = Math.max(0, total - Number(match[2])); end = total - 1; }
  end = Math.min(end, total - 1);
  if (!match || start > end || start >= total) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}`, 'Cache-Control': 'no-store' } });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
