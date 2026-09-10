import { verses } from './lib/verses.js';

// HTMLMediaElement's `timeupdate` event is deliberately low-frequency, and on
// iOS Safari it can arrive noticeably after a word boundary.  The Svelte app
// keeps `timeupdate` for highlighting, while this tiny helper watches tapped
// word clips every animation frame and stops them at the shared boundary.
// This does not change any stored timings.

const STORAGE_KEY = 'vayetsei-alignment-overrides-v1';
const STOP_EARLY_SECONDS = 0.012;

let monitorId = 0;
let frameId = null;

function cancelMonitor() {
  monitorId += 1;
  if (frameId != null) cancelAnimationFrame(frameId);
  frameId = null;
}

function startsFor(verseNumber) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (Array.isArray(saved?.[verseNumber])) return saved[verseNumber].map(Number);
  } catch {
    // Ignore malformed/localStorage-disabled state and use the app data.
  }

  const verse = verses.find((item) => item.n === verseNumber);
  return Array.isArray(verse?.wordStarts) ? verse.wordStarts.map(Number) : [];
}

function hiddenPracticeAudio() {
  // The practice app has one unadorned audio element before the header.
  return document.querySelector('body > audio') || document.querySelector('audio');
}

function stopAudioAt(audio, end) {
  audio.pause();

  // Move the paused playhead to the exact boundary. Besides making the next
  // seek deterministic, this lets the existing Svelte timeupdate handler clear
  // its active-word state without playing any sound beyond the boundary.
  try {
    if (Number.isFinite(end)) audio.currentTime = end;
  } catch {
    // Seeking after pause is a cosmetic cleanup only; playback is already off.
  }

  cancelMonitor();
}

function monitorWordEnd(audio, end) {
  cancelMonitor();
  const id = monitorId;
  let playbackHasStarted = false;

  const tick = () => {
    if (id !== monitorId) return;

    if (!audio.paused) playbackHasStarted = true;

    if (playbackHasStarted) {
      if (audio.currentTime >= end - STOP_EARLY_SECONDS) {
        stopAudioAt(audio, end);
        return;
      }

      // If something else paused playback (another control, interruption,
      // etc.), don't leave a stale frame loop running.
      if (audio.paused) {
        cancelMonitor();
        return;
      }
    }

    frameId = requestAnimationFrame(tick);
  };

  frameId = requestAnimationFrame(tick);
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const wordButton = target?.closest('article[id^="verse-"] .hebrew .word');

  if (!wordButton) {
    // Any other playback/control click should cancel a pending word stop.
    if (target?.closest('button, input[type="range"]')) cancelMonitor();
    return;
  }

  const article = wordButton.closest('article[id^="verse-"]');
  const verseNumber = Number(article?.id.replace('verse-', ''));
  const wordButtons = [...article.querySelectorAll('.hebrew .word')];
  const wordIndex = wordButtons.indexOf(wordButton);
  const starts = startsFor(verseNumber);
  const end = starts[wordIndex + 1];

  // The final word naturally ends at the recording end, so the native ended
  // event is already precise enough there.
  if (wordIndex < 0 || !Number.isFinite(end)) {
    cancelMonitor();
    return;
  }

  const audio = hiddenPracticeAudio();
  if (!audio) return;

  monitorWordEnd(audio, end);
}, true);
