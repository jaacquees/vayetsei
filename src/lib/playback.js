export function createPlaybackController() {
  let cancelPending;
  let element;

  function stop() {
    cancelPending?.();
    cancelPending = null;
    element?.pause();
  }

  function play(media, src, identity, time = 0) {
    stop();
    element = media;
    const changed = media.dataset.verseKey !== identity || media.error;
    if (changed) {
      media.src = src;
      media.dataset.verseKey = identity;
      media.load();
    }
    let cleanup;
    const ready = new Promise((resolve, reject) => {
      let timer;
      cleanup = () => {
        clearTimeout(timer);
        media.removeEventListener('loadedmetadata', seek);
        media.removeEventListener('error', failed);
      };
      const failed = () => reject(new Error('The recording could not be loaded.'));
      const seek = () => {
        try {
          if (media.error || media.readyState < 1) return failed();
          // MediaRecorder WebM files can play and seek with duration === Infinity.
          const end = Number.isFinite(media.duration) ? media.duration : Infinity;
          media.currentTime = Math.max(0, Math.min(time, end));
          resolve();
        } catch (error) { reject(error); }
      };
      cancelPending = () => reject(new DOMException('Playback superseded', 'AbortError'));
      media.addEventListener('loadedmetadata', seek);
      media.addEventListener('error', failed);
      timer = setTimeout(() => reject(new Error('The recording took too long to load.')), 15000);
      if (media.readyState >= 1) seek();
    });
    // Start within the tap's user activation, before waiting for metadata.
    let started;
    try { started = media.play(); } catch (error) { started = Promise.reject(error); }
    const cancel = cancelPending;
    return Promise.all([ready, started]).catch(error => {
      if (cancelPending === cancel) media.pause();
      throw error;
    }).finally(() => {
      cleanup();
      if (cancelPending === cancel) cancelPending = null;
    });
  }

  return { play, stop };
}
