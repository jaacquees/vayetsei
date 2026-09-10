import { mount } from 'svelte';
import App from './App.svelte';
import { verses } from './lib/verses.js';

async function loadPublishedRecordings() {
  if (typeof window === 'undefined') return;

  const runningOnVercel = import.meta.env.BASE_URL === '/';

  await Promise.all(verses.map(async (verse) => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/recording?verse=${verse.n}`, {
        cache: 'no-store'
      });
      if (!response.ok) return;

      const published = await response.json();
      if (!published?.published || !Array.isArray(published.wordStarts)) return;
      if (published.wordStarts.length !== verse.wordStarts.length) return;

      verse.wordStarts = published.wordStarts.map(Number);
      verse.publishedAt = published.publishedAt || null;
      verse.audioSource = 'published';

      // For a teacher-published recording, this endpoint resolves to a
      // short-lived signed private-Blob URL. The browser then reads Blob
      // directly, preserving byte-range seeking on iOS Safari.
      if (runningOnVercel) {
        verse.audio = `api/audio?verse=${verse.n}`;
      }
    } catch {
      // Keep built-in recording/timings if no teacher publish is available.
    }
  }));
}

await loadPublishedRecordings();
mount(App, { target: document.getElementById('app') });
