import { mount } from 'svelte';
import App from './App.svelte';
import { verses } from './lib/verses.js';

async function loadPublishedRecordings() {
  if (typeof window === 'undefined') return;

  const runningOnVercel = import.meta.env.BASE_URL === '/';

  await Promise.all(verses.map(async (verse) => {
    // On Vercel, the audio endpoint serves the newest teacher publish and
    // transparently falls back to the original GitHub Pages recording.
    if (runningOnVercel) {
      verse.audio = `api/audio?verse=${verse.n}`;
    }

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
    } catch {
      // GitHub Pages and unconfigured Vercel previews keep built-in timings.
    }
  }));
}

await loadPublishedRecordings();
mount(App, { target: document.getElementById('app') });
