<script>
  import { onMount } from 'svelte';
  import { verses, scrollText } from './lib/verses.js';

  const STORAGE_KEY = 'vayetsei-alignment-overrides-v1';
  const WORD_PREROLL = 0.08;
  const WORD_POSTROLL = 0.06;

  let mode = 'tikkun';
  let showTransliteration = false;
  let selected = 10;
  let menuOpen = false;
  let audio;
  let isPlaying = false;
  let playingVerseN = null;
  let activeWordIndex = null;
  let wordClipEnd = null;
  let clippedWordIndex = null;

  let alignmentMode = false;
  let editorWordIndex = 0;
  let timingOverrides = {};
  let editorMessage = '';
  let audioDuration = 0;
  let audioCurrentTime = 0;

  const hebrewNumber = (n) => ({10:'י',11:'יא',12:'יב',13:'יג',14:'יד',15:'טו',16:'טז',17:'יז',18:'יח',19:'יט',20:'כ',21:'כא',22:'כב'}[n]);

  onMount(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) timingOverrides = JSON.parse(saved);
    } catch {
      timingOverrides = {};
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('align') === '1') alignmentMode = true;
  });

  function selectedVerse() {
    return verses.find((v) => v.n === selected) ?? verses[0];
  }

  function sourceWords(verse) {
    return verse.tikkun.trim().split(/\s+/);
  }

  function wordsFor(verse) {
    return sourceWords(verse).map((word) => mode === 'tikkun' ? word : scrollText(word));
  }

  function startsFor(verse) {
    return timingOverrides[verse.n] ?? verse.wordStarts ?? [];
  }

  function saveOverrides(next) {
    timingOverrides = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The editor still works for this session if localStorage is unavailable.
    }
  }

  function setVerseStarts(verse, starts) {
    saveOverrides({ ...timingOverrides, [verse.n]: starts });
  }

  function audioUrl(verse) {
    return `${import.meta.env.BASE_URL}${verse.audio}`;
  }

  async function loadAndSeek(verse, time = 0) {
    if (!audio) return false;
    const src = audioUrl(verse);
    if (!audio.src || !audio.src.endsWith(`/${verse.audio}`)) {
      audio.src = src;
      await new Promise((resolve) => {
        if (audio.readyState >= 1) resolve();
        else audio.addEventListener('loadedmetadata', resolve, { once: true });
      });
    }
    audioDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = Math.max(0, Math.min(time, audioDuration || time));
    audioCurrentTime = audio.currentTime;
    return true;
  }

  async function playVerse(verse) {
    selected = verse.n;
    playingVerseN = verse.n;
    menuOpen = false;
    wordClipEnd = null;
    clippedWordIndex = null;
    activeWordIndex = null;
    if (!(await loadAndSeek(verse, 0))) return;
    try {
      await audio.play();
      isPlaying = true;
    } catch {
      isPlaying = false;
    }
    document.getElementById(`verse-${verse.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function playWord(verse, index) {
    const starts = startsFor(verse);
    const boundary = starts[index];
    if (boundary == null) {
      await playVerse(verse);
      return;
    }

    selected = verse.n;
    playingVerseN = verse.n;
    menuOpen = false;
    activeWordIndex = index;
    clippedWordIndex = index;
    editorWordIndex = index;

    const seekTime = Math.max(0, boundary - WORD_PREROLL);
    if (!(await loadAndSeek(verse, seekTime))) return;

    const nextBoundary = starts[index + 1];
    wordClipEnd = nextBoundary == null
      ? audio.duration
      : Math.min(audio.duration, nextBoundary + WORD_POSTROLL);

    try {
      await audio.play();
      isPlaying = true;
    } catch {
      isPlaying = false;
    }
  }

  function togglePlayback() {
    const verse = selectedVerse();
    if (!audio?.src || playingVerseN !== verse.n || clippedWordIndex != null) {
      playVerse(verse);
      return;
    }
    if (audio.paused) audio.play(); else audio.pause();
  }

  function handleTimeUpdate() {
    if (!audio) return;
    audioCurrentTime = audio.currentTime;
    audioDuration = Number.isFinite(audio.duration) ? audio.duration : audioDuration;

    if (playingVerseN == null) return;
    const verse = verses.find((v) => v.n === playingVerseN);
    const starts = verse ? startsFor(verse) : [];
    if (!starts.length) return;

    if (wordClipEnd != null && audio.currentTime >= wordClipEnd - 0.02) {
      audio.pause();
      wordClipEnd = null;
      clippedWordIndex = null;
      activeWordIndex = null;
      return;
    }

    if (clippedWordIndex != null) {
      activeWordIndex = clippedWordIndex;
      return;
    }

    let current = null;
    for (let i = 0; i < starts.length; i += 1) {
      if (audio.currentTime >= starts[i] - 0.02) current = i;
      else break;
    }
    activeWordIndex = current;
  }

  function finishPlayback() {
    isPlaying = false;
    activeWordIndex = null;
    wordClipEnd = null;
    clippedWordIndex = null;
  }

  function clampBoundary(starts, index, value) {
    const min = index === 0 ? 0 : starts[index - 1] + 0.03;
    const durationLimit = audioDuration > 0 ? audioDuration - 0.03 : Number.POSITIVE_INFINITY;
    const max = index === starts.length - 1 ? durationLimit : starts[index + 1] - 0.03;
    return Math.max(min, Math.min(value, max));
  }

  function nudgeWord(verse, index, delta) {
    const starts = [...startsFor(verse)];
    if (starts[index] == null) return;
    starts[index] = Number(clampBoundary(starts, index, starts[index] + delta).toFixed(2));
    setVerseStarts(verse, starts);
    editorWordIndex = index;
    editorMessage = `Saved ${sourceWords(verse)[index]} at ${starts[index].toFixed(2)}s`;
  }

  async function setBoundaryHere(verse, index) {
    const starts = [...startsFor(verse)];
    if (!starts.length || starts[index] == null) return;
    starts[index] = Number(clampBoundary(starts, index, audioCurrentTime).toFixed(2));
    setVerseStarts(verse, starts);
    editorWordIndex = index;
    editorMessage = `Set ${sourceWords(verse)[index]} to ${starts[index].toFixed(2)}s`;
  }

  async function seekEditor(verse, time) {
    selected = verse.n;
    playingVerseN = verse.n;
    wordClipEnd = null;
    clippedWordIndex = null;
    activeWordIndex = null;
    if (!(await loadAndSeek(verse, time))) return;
    audio.pause();
    audioCurrentTime = audio.currentTime;
  }

  function jumpEditorWord(delta) {
    const verse = selectedVerse();
    const last = Math.max(0, sourceWords(verse).length - 1);
    editorWordIndex = Math.max(0, Math.min(editorWordIndex + delta, last));
    playWord(verse, editorWordIndex);
  }

  function toggleAlignmentMode() {
    alignmentMode = !alignmentMode;
    editorWordIndex = 0;
    editorMessage = '';
    if (alignmentMode) {
      const verse = selectedVerse();
      loadAndSeek(verse, startsFor(verse)[0] ?? 0).then(() => audio?.pause());
    }
  }

  function resetVerse(verse) {
    const next = { ...timingOverrides };
    delete next[verse.n];
    saveOverrides(next);
    editorMessage = `Reset passuk ${verse.n} to the built-in timings`;
  }

  function resetAll() {
    if (!confirm('Reset all locally edited word timings?')) return;
    saveOverrides({});
    editorMessage = 'Reset all timings to the built-in values';
  }

  async function copyVerseTimings(verse) {
    const payload = JSON.stringify({ n: verse.n, wordStarts: startsFor(verse) });
    try {
      await navigator.clipboard.writeText(payload);
      editorMessage = `Copied passuk ${verse.n} timings`;
    } catch {
      editorMessage = payload;
    }
  }

  async function copyAllTimings() {
    const payload = JSON.stringify(
      verses.map((verse) => ({ n: verse.n, wordStarts: startsFor(verse) })),
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(payload);
      editorMessage = 'Copied all 13 passuk timings';
    } catch {
      editorMessage = payload;
    }
  }
</script>

<svelte:head>
  <meta name="description" content="Interactive Vayetsei Rishon parasha practice" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Hebrew:wght@400;600&display=swap" rel="stylesheet" />
</svelte:head>

<audio
  bind:this={audio}
  onplay={() => isPlaying = true}
  onpause={() => isPlaying = false}
  onended={finishPlayback}
  ontimeupdate={handleTimeUpdate}
  onloadedmetadata={() => audioDuration = Number.isFinite(audio?.duration) ? audio.duration : 0}
></audio>

<header>
  <button class="menu" aria-label="Open pessukim" onclick={() => menuOpen = !menuOpen}>☰</button>
  <div class="title">
    <strong>וַיֵּצֵא · רִאשׁוֹן</strong>
    <span>Bereishit 28:10–22</span>
  </div>
  <div class="controls">
    <div class="segmented" aria-label="Text mode">
      <button class:active={mode === 'tikkun'} onclick={() => mode = 'tikkun'}>Tikkun</button>
      <button class:active={mode === 'scroll'} onclick={() => mode = 'scroll'}>Torah</button>
    </div>
    <label class="switch"><input type="checkbox" bind:checked={showTransliteration} /><span>Transliteration</span></label>
    <button class:active={alignmentMode} class="align-toggle" onclick={toggleAlignmentMode}>Align</button>
    <button class="play" aria-label={isPlaying ? 'Pause' : 'Play'} onclick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button>
  </div>
</header>

<div class="layout">
  <aside class:open={menuOpen}>
    <div class="aside-title">Pessukim</div>
    {#each verses as verse, i}
      <button class:selected={selected === verse.n} onclick={() => playVerse(verse)}>
        <span class="verse-index">{i + 1}</span>
        <span class="verse-ref">פסוק {hebrewNumber(verse.n)}</span>
        <span class="mini-play">▶</span>
      </button>
    {/each}
  </aside>

  {#if menuOpen}<button class="scrim" aria-label="Close menu" onclick={() => menuOpen = false}></button>{/if}

  <main>
    <div class="intro">
      <div>
        <span class="eyebrow">RISHON · 13 PESSUKIM</span>
        <h1>Parasha Practice tool</h1>
      </div>
      <p>Tap a passuk to hear the complete recording. Tap a word to hear that part of the recording; the active word follows along as the passuk plays.</p>
    </div>

    {#if alignmentMode}
      <section class="alignment-card">
        <div class="alignment-header">
          <div>
            <span class="eyebrow">ALIGNMENT EDITOR</span>
            <h2>פסוק {hebrewNumber(selectedVerse().n)} · Passuk {selectedVerse().n - 9}</h2>
          </div>
          <button class="done-button" onclick={toggleAlignmentMode}>Done</button>
        </div>

        <div class="alignment-words" dir="rtl">
          {#each sourceWords(selectedVerse()) as word, wordIndex}
            <button
              class:editor-selected={wordIndex === editorWordIndex}
              onclick={() => { editorWordIndex = wordIndex; playWord(selectedVerse(), wordIndex); }}
            >
              <span>{word}</span>
              <small>{startsFor(selectedVerse())[wordIndex]?.toFixed(2)}s</small>
            </button>
          {/each}
        </div>

        <div class="editor-focus-row">
          <button onclick={() => jumpEditorWord(-1)} disabled={editorWordIndex === 0}>← Previous</button>
          <div class="editor-focus" dir="rtl">
            <strong>{sourceWords(selectedVerse())[editorWordIndex]}</strong>
            <span>{startsFor(selectedVerse())[editorWordIndex]?.toFixed(2)}s</span>
          </div>
          <button onclick={() => jumpEditorWord(1)} disabled={editorWordIndex >= sourceWords(selectedVerse()).length - 1}>Next →</button>
        </div>

        <div class="nudge-row">
          <button onclick={() => nudgeWord(selectedVerse(), editorWordIndex, -0.10)}>−0.10s</button>
          <button onclick={() => nudgeWord(selectedVerse(), editorWordIndex, -0.05)}>−0.05s</button>
          <button class="audition" onclick={() => playWord(selectedVerse(), editorWordIndex)}>▶ Hear word</button>
          <button onclick={() => nudgeWord(selectedVerse(), editorWordIndex, 0.05)}>+0.05s</button>
          <button onclick={() => nudgeWord(selectedVerse(), editorWordIndex, 0.10)}>+0.10s</button>
        </div>

        <div class="timeline-row">
          <button class="full-passuk" onclick={() => playVerse(selectedVerse())}>▶ Full passuk</button>
          <input
            aria-label="Audio position"
            type="range"
            min="0"
            max={Math.max(audioDuration, 0.01)}
            step="0.01"
            value={Math.min(audioCurrentTime, audioDuration || 0)}
            oninput={(event) => seekEditor(selectedVerse(), Number(event.currentTarget.value))}
          />
          <span class="time-readout">{audioCurrentTime.toFixed(2)} / {audioDuration.toFixed(2)}s</span>
          <button class="set-boundary" onclick={() => setBoundaryHere(selectedVerse(), editorWordIndex)}>Set start here</button>
        </div>

        <div class="editor-footer">
          <span>Edits save in this browser. Copy the timings when you want them committed to the site.</span>
          <div class="editor-actions">
            <button onclick={() => copyVerseTimings(selectedVerse())}>Copy passuk</button>
            <button onclick={copyAllTimings}>Copy all</button>
            <button onclick={() => resetVerse(selectedVerse())}>Reset passuk</button>
            <button onclick={resetAll}>Reset all</button>
          </div>
        </div>
        {#if editorMessage}<div class="editor-message">{editorMessage}</div>{/if}
      </section>
    {/if}

    <section class="text-card" dir="rtl">
      {#each verses as verse}
        <article id={`verse-${verse.n}`} class:selected={selected === verse.n}>
          <button class="verse-number" aria-label={`Play verse ${verse.n}`} onclick={() => playVerse(verse)}>{hebrewNumber(verse.n)}</button>
          <div class="verse-text">
            <div class:scroll={mode === 'scroll'} class="hebrew">
              {#each wordsFor(verse) as word, wordIndex}
                <button
                  class="word"
                  class:active-word={playingVerseN === verse.n && activeWordIndex === wordIndex}
                  onclick={() => playWord(verse, wordIndex)}
                >{word}</button>
              {/each}
            </div>
            {#if showTransliteration}
              <div class="transliteration" dir="ltr">Transliteration layer is next.</div>
            {/if}
          </div>
          <button class="row-play" aria-label={`Play verse ${verse.n}`} onclick={() => playVerse(verse)}>▶</button>
        </article>
      {/each}
    </section>
  </main>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { scroll-behavior: smooth; }
  :global(body) { margin: 0; background: #f6f1e7; color: #23231f; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  :global(button) { font: inherit; }

  header { position: sticky; top: 0; z-index: 20; height: 76px; display: flex; align-items: center; gap: 18px; padding: 0 28px; background: rgba(246,241,231,.95); backdrop-filter: blur(12px); border-bottom: 1px solid #d8d0c2; }
  .title { display: flex; flex-direction: column; line-height: 1.1; margin-right: auto; }
  .title strong { font-family: "Noto Serif Hebrew", Georgia, serif; font-size: 19px; }
  .title span { margin-top: 6px; color: #746f66; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
  .controls { display: flex; align-items: center; gap: 10px; }
  .segmented { display: flex; padding: 3px; background: #e8e0d2; border-radius: 11px; }
  .segmented button { border: 0; background: transparent; padding: 7px 12px; border-radius: 8px; cursor: pointer; }
  .segmented button.active { background: #fffdf8; box-shadow: 0 1px 5px rgba(0,0,0,.08); }
  .switch { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #5f5a51; }
  .align-toggle { border: 1px solid #cabfae; background: transparent; color: #5f5a51; padding: 8px 11px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700; }
  .align-toggle.active { background: #dce5dc; border-color: #9daf9f; color: #173c31; }
  .play, .menu { width: 38px; height: 38px; border-radius: 50%; border: 0; background: #243c34; color: white; cursor: pointer; }
  .menu { display: none; }

  .layout { display: grid; grid-template-columns: 230px minmax(0,1fr); min-height: calc(100vh - 76px); }
  aside { position: sticky; top: 76px; height: calc(100vh - 76px); border-right: 1px solid #d8d0c2; padding: 22px 14px; overflow-y: auto; background: #f1eadf; }
  .aside-title { padding: 0 10px 10px; color: #858076; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
  aside button { width: 100%; display: grid; grid-template-columns: 30px 1fr 24px; align-items: center; gap: 5px; padding: 11px 10px; border: 0; border-radius: 10px; background: transparent; text-align: left; cursor: pointer; color: #4b473f; }
  aside button:hover { background: rgba(255,255,255,.6); }
  aside button.selected { background: #dce5dc; color: #173c31; font-weight: 650; }
  .verse-index { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.65); font-size: 11px; }
  .verse-ref { direction: rtl; text-align: left; font-family: "Noto Serif Hebrew", serif; }
  .mini-play { font-size: 10px; opacity: .55; }

  main { width: min(1040px, 100%); margin: 0 auto; padding: 58px 54px 100px; }
  .intro { display: grid; grid-template-columns: 1.4fr .8fr; align-items: end; gap: 40px; margin-bottom: 42px; }
  .eyebrow { color: #7f6c45; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
  h1 { max-width: 680px; margin: 10px 0 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(34px,5vw,62px); font-weight: 500; line-height: .98; letter-spacing: -.035em; }
  .intro p { margin: 0; color: #716b61; font-size: 14px; line-height: 1.6; }

  .alignment-card { margin-bottom: 26px; padding: 24px; border: 1px solid #bfcabf; border-radius: 18px; background: #eef2e9; box-shadow: 0 14px 40px rgba(42,69,54,.08); }
  .alignment-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
  .alignment-header h2 { margin: 6px 0 0; font-family: "Noto Serif Hebrew", Georgia, serif; font-size: 24px; font-weight: 600; }
  .done-button { border: 0; border-radius: 10px; padding: 8px 12px; background: #243c34; color: #fff; cursor: pointer; }
  .alignment-words { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px; border: 1px solid #d3ddd2; border-radius: 13px; background: rgba(255,255,255,.66); }
  .alignment-words button { min-width: 68px; border: 1px solid transparent; border-radius: 10px; padding: 7px 9px 6px; background: transparent; cursor: pointer; color: #30362f; font-family: "Noto Serif Hebrew", serif; font-size: 20px; line-height: 1.2; }
  .alignment-words button small { display: block; margin-top: 5px; direction: ltr; color: #858b82; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; }
  .alignment-words button.editor-selected { border-color: #527363; background: #d7e4d5; box-shadow: 0 0 0 2px rgba(82,115,99,.10); }
  .editor-focus-row { display: grid; grid-template-columns: 110px 1fr 110px; align-items: center; gap: 14px; margin-top: 16px; }
  .editor-focus-row > button, .nudge-row button, .timeline-row button, .editor-actions button { border: 1px solid #c7d0c5; border-radius: 9px; background: #fffdf8; padding: 9px 11px; cursor: pointer; color: #405046; }
  .editor-focus-row > button:disabled { opacity: .4; cursor: default; }
  .editor-focus { display: flex; align-items: baseline; justify-content: center; gap: 14px; min-width: 0; font-family: "Noto Serif Hebrew", serif; }
  .editor-focus strong { font-size: 30px; font-weight: 600; }
  .editor-focus span { direction: ltr; color: #6f776f; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .nudge-row { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .nudge-row .audition { background: #243c34; border-color: #243c34; color: #fff; padding-left: 18px; padding-right: 18px; }
  .timeline-row { display: grid; grid-template-columns: auto minmax(120px,1fr) auto auto; align-items: center; gap: 12px; margin-top: 18px; padding-top: 18px; border-top: 1px solid #cfd9ce; }
  .timeline-row input[type="range"] { width: 100%; accent-color: #527363; }
  .time-readout { color: #687169; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; white-space: nowrap; }
  .timeline-row .set-boundary { background: #e1eadf; border-color: #9daf9f; font-weight: 700; }
  .editor-footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 16px; color: #697168; font-size: 11px; line-height: 1.4; }
  .editor-actions { display: flex; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
  .editor-actions button { padding: 7px 9px; font-size: 11px; }
  .editor-message { margin-top: 10px; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,.65); color: #456052; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }

  .text-card { overflow: hidden; border: 1px solid #d2c7b5; border-radius: 20px; background: #fffdf7; box-shadow: 0 18px 50px rgba(72,55,29,.07); }
  article { position: relative; display: grid; grid-template-columns: 48px 1fr 40px; gap: 15px; align-items: start; padding: 28px 30px; border-bottom: 1px solid #e7dfd2; transition: background .2s ease; }
  article:last-child { border-bottom: 0; }
  article.selected { background: #eef2e9; box-shadow: inset -4px 0 #527363; }
  .verse-number { width: 35px; height: 35px; border: 1px solid #d7ccbb; border-radius: 50%; background: transparent; color: #766b5c; cursor: pointer; font-family: "Noto Serif Hebrew", Georgia, serif; }
  .verse-text { min-width: 0; }
  .hebrew { display: flex; flex-direction: row; flex-wrap: wrap; justify-content: flex-start; gap: 9px 11px; font-family: "Noto Serif Hebrew", "Times New Roman", serif; font-size: clamp(26px,3vw,37px); line-height: 1.9; }
  .hebrew.scroll { font-size: clamp(28px,3.2vw,40px); line-height: 1.75; letter-spacing: .03em; }
  .word { border: 0; padding: 0 3px; background: transparent; color: inherit; cursor: pointer; direction: rtl; border-radius: 6px; transition: background .12s ease, box-shadow .12s ease; font-family: inherit; }
  .word:hover { background: #e6ebdf; }
  .word.active-word { background: #d7e4d5; box-shadow: 0 0 0 2px rgba(82,115,99,.14); }
  .transliteration { margin-top: 3px; color: #8d867a; font-size: 11px; font-style: italic; text-align: right; }
  .row-play { width: 34px; height: 34px; border: 0; border-radius: 50%; background: #eee6d8; color: #425f53; cursor: pointer; }
  .scrim { display: none; }

  @media (max-width: 780px) {
    header { height: 66px; padding: 0 14px; gap: 10px; }
    .menu { display: block; flex: 0 0 auto; }
    .title strong { font-size: 16px; }
    .title span { display: none; }
    .switch span { display: none; }
    .segmented button { padding: 6px 8px; font-size: 12px; }
    .align-toggle { padding: 7px 8px; font-size: 11px; }
    .layout { display: block; }
    aside { position: fixed; z-index: 30; top: 66px; left: 0; bottom: 0; width: min(82vw,310px); height: auto; transform: translateX(-105%); transition: transform .2s ease; box-shadow: 16px 0 50px rgba(0,0,0,.18); }
    aside.open { transform: translateX(0); }
    .scrim { display: block; position: fixed; z-index: 25; inset: 66px 0 0; border: 0; background: rgba(24,24,20,.25); }
    main { padding: 34px 14px 70px; }
    .intro { grid-template-columns: 1fr; gap: 16px; margin-bottom: 26px; }
    .intro p { max-width: 560px; }
    .alignment-card { padding: 16px 12px; }
    .alignment-words { padding: 10px; gap: 6px; }
    .alignment-words button { min-width: 58px; padding: 7px; font-size: 18px; }
    .editor-focus-row { grid-template-columns: 82px 1fr 82px; gap: 7px; }
    .editor-focus-row > button { padding: 8px 5px; font-size: 11px; }
    .editor-focus strong { font-size: 26px; }
    .timeline-row { grid-template-columns: 1fr auto; }
    .timeline-row input[type="range"] { grid-column: 1 / -1; grid-row: 1; }
    .timeline-row .full-passuk { grid-column: 1; grid-row: 2; }
    .time-readout { grid-column: 2; grid-row: 2; }
    .timeline-row .set-boundary { grid-column: 1 / -1; }
    .editor-footer { align-items: flex-start; flex-direction: column; }
    .editor-actions { justify-content: flex-start; }
    article { grid-template-columns: 32px 1fr; gap: 10px; padding: 22px 15px; }
    .row-play { display: none; }
    .verse-number { width: 30px; height: 30px; }
    .hebrew { gap: 7px 8px; font-size: 29px; line-height: 1.8; }
    .word { padding: 0 4px; min-height: 42px; }
  }
</style>
