import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaybackController } from '../src/lib/playback.js';

class Recording extends EventTarget {
  dataset = {};
  readyState = 0;
  duration = NaN;
  currentTime = 0;
  paused = true;
  playCalls = 0;
  load() { this.readyState = 0; this.duration = NaN; }
  play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  metadata(duration) { this.duration = duration; this.readyState = 1; this.dispatchEvent(new Event('loadedmetadata')); }
}

test('first tap starts playback before metadata and accepts WebM with unknown duration', async () => {
  const media = new Recording();
  const playing = createPlaybackController().play(media, '/published.webm', 'verse-10', 5.687);
  assert.equal(media.playCalls, 1);
  assert.equal(media.readyState, 0);
  media.metadata(Infinity);
  await playing;
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, 5.687);
});

test('switching verses cancels the earlier seek before the next metadata arrives', async () => {
  const media = new Recording();
  const controller = createPlaybackController();
  const first = controller.play(media, '/one.webm', 'one', 8);
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const second = controller.play(media, '/two.webm', 'two', 2);
  media.metadata(Infinity);
  await Promise.all([rejected, second]);
  assert.equal(media.currentTime, 2);
  assert.equal(media.paused, false);
});

test('same-verse word seek reuses audio; finite duration clamps safely', async () => {
  const media = new Recording();
  const controller = createPlaybackController();
  const first = controller.play(media, '/one.m4a', 'one', 1);
  media.metadata(12);
  await first;
  await controller.play(media, '/one.m4a', 'one', 20);
  assert.equal(media.currentTime, 12);
  controller.stop();
  assert.equal(media.paused, true);
});

test('real media errors reject rather than being reported as successful playback', async () => {
  const media = new Recording();
  const playing = createPlaybackController().play(media, '/missing.webm', 'missing');
  media.dispatchEvent(new Event('error'));
  await assert.rejects(playing, /could not be loaded/);
  assert.equal(media.paused, true);
});
