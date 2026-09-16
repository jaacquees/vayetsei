// iOS Safari's `timeupdate` event is too coarse for word-sized clips.
// The Svelte app writes the next shared boundary onto each word button;
// this helper watches the actual media clock every animation frame and
// stops just before that boundary. It is independent of Sefer/Parasha/Aliyah.
const STOP_EARLY_SECONDS = 0.012;
let monitorId = 0;
let frameId = null;

function cancelMonitor() {
  monitorId += 1;
  if (frameId != null) cancelAnimationFrame(frameId);
  frameId = null;
}

function hiddenPracticeAudio() {
  return document.querySelector('body > audio') || document.querySelector('audio');
}

function stopAudioAt(audio, end) {
  audio.pause();
  try { if (Number.isFinite(end)) audio.currentTime = end; } catch {}
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
      if (audio.currentTime >= end - STOP_EARLY_SECONDS) return stopAudioAt(audio, end);
      if (audio.paused) return cancelMonitor();
    }
    frameId = requestAnimationFrame(tick);
  };
  frameId = requestAnimationFrame(tick);
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const wordButton = target?.closest('article[data-verse-key] .hebrew .word');
  if (!wordButton) {
    if (target?.closest('button, input[type="range"]')) cancelMonitor();
    return;
  }

  // Final words deliberately have no next-word boundary. Their data-word-end
  // attribute is therefore an empty string. Number('') is 0 in JavaScript,
  // which previously caused the precision monitor to stop final words
  // immediately. An absent/blank boundary means: let the native audio element
  // play from the final word's start until the recording naturally ends.
  const rawEnd = wordButton.dataset.wordEnd;
  if (rawEnd == null || rawEnd.trim() === '') return cancelMonitor();

  const end = Number(rawEnd);
  if (!Number.isFinite(end)) return cancelMonitor();
  const audio = hiddenPracticeAudio();
  if (audio) monitorWordEnd(audio, end);
}, true);
