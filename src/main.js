import { mount } from 'svelte';
import App from './App.svelte';
import { verses } from './lib/verses.js';

async function loadPublishedRecordings() {
  if (typeof window === 'undefined') return;

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
      verse.audio = `api/audio?verse=${verse.n}&v=${encodeURIComponent(published.publishedAt || '')}`;
      verse.publishedAt = published.publishedAt || null;
      verse.audioSource = 'published';
    } catch {
      // GitHub Pages and unconfigured Vercel previews simply keep the built-in recording.
    }
  }));
}

await loadPublishedRecordings();
mount(App, { target: document.getElementById('app') });
