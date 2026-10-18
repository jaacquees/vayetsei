export function applyPublished(verses, recordings) {
  return verses.map(verse => {
    const data = recordings[verse.key];
    if (!data) return { ...verse, audio: null, audioSource: 'missing' };
    const count = verse.tikkun.trim().split(/\s+/).length;
    if (!Array.isArray(data.wordStarts) || data.wordStarts.length !== count || !data.audioPathname) {
      throw new Error('The saved recording details could not be read.');
    }
    return {
      ...verse, wordStarts: data.wordStarts,
      audio: `api/audio?verseKey=${encodeURIComponent(verse.key)}&pathname=${encodeURIComponent(data.audioPathname)}`,
      audioSource: 'published', publishedAt: data.publishedAt
    };
  });
}
