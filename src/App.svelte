<script>
  import { onMount } from 'svelte';
  import {
    sefarim, getSefer, getParasha, getAliyah, getParashiotForSefer, getAliyotForParasha,
    getVersesForAliyah, loadSelection, saveSelection, scrollText
  } from './lib/torahCatalog.js';

  const OVERRIDES_KEY = 'torah-practice-alignment-overrides-v2';

  let mode = 'tikkun';
  let showTransliteration = false;
  let menuOpen = false;
  let screen = 'practice';
  let selection = { seferId:'bereshit', parashaId:'vayetzei', aliyahId:'vayetzei-rishon' };
  let currentVerses = [];
  let selectedKey = null;
  let audio;
  let isPlaying = false;
  let playingVerseKey = null;
  let activeWordIndex = null;
  let wordClipEnd = null;
  let clippedWordIndex = null;
  let audioDuration = 0;
  let audioCurrentTime = 0;
  let timingOverrides = {};
  let notice = '';

  $: currentSefer = getSefer(selection.seferId);
  $: currentParasha = getParasha(selection.parashaId);
  $: currentAliyah = getAliyah(selection.aliyahId);
  $: selectedVerse = currentVerses.find((v) => v.key === selectedKey) ?? currentVerses[0] ?? null;

  onMount(async () => {
    selection = loadSelection();
    try { timingOverrides = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}'); } catch { timingOverrides = {}; }
    await loadAliyah(selection.aliyahId, false);
  });

  function hebrewNumber(n) {
    if (n === 15) return 'טו';
    if (n === 16) return 'טז';
    const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    const ones = ['', 'א','ב','ג','ד','ה','ו','ז','ח','ט'];
    return `${tens[Math.floor(n / 10)] || ''}${ones[n % 10] || ''}`;
  }

  function wordsFor(verse) {
    const words = verse.tikkun.trim().split(/\s+/);
    return mode === 'tikkun' ? words : words.map(scrollText);
  }

  function startsFor(verse) {
    return timingOverrides[verse.key] ?? verse.wordStarts ?? [];
  }

  function cloneAliyahVerses(aliyahId) {
    return getVersesForAliyah(aliyahId).map((v) => ({ ...v, wordStarts:[...(v.wordStarts || [])] }));
  }

  async function hydratePublished(verses) {
    if (typeof window === 'undefined') return verses;
    await Promise.all(verses.map(async (verse) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}api/recording?verseKey=${encodeURIComponent(verse.key)}`, { cache:'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        const count = verse.tikkun.trim().split(/\s+/).length;
        if (!data?.published || !Array.isArray(data.wordStarts) || data.wordStarts.length !== count) return;
        verse.wordStarts = data.wordStarts.map(Number);
        verse.audio = `api/audio?verseKey=${encodeURIComponent(verse.key)}`;
        verse.audioSource = 'published';
        verse.publishedAt = data.publishedAt || null;
      } catch {}
    }));
    return verses;
  }

  async function loadAliyah(aliyahId, persist = true) {
    const aliyah = getAliyah(aliyahId);
    if (!aliyah) return;
    const parasha = getParasha(aliyah.parashaId);
    const sefer = parasha ? getSefer(parasha.seferId) : null;
    if (!parasha || !sefer) return;

    audio?.pause();
    selection = { seferId:sefer.id, parashaId:parasha.id, aliyahId:aliyah.id };
    if (persist) saveSelection(selection);
    currentVerses = cloneAliyahVerses(aliyah.id);
    selectedKey = currentVerses[0]?.key ?? null;
    playingVerseKey = null;
    activeWordIndex = null;
    notice = '';
    screen = 'practice';
    menuOpen = false;
    currentVerses = await hydratePublished(currentVerses);
  }

  function chooseSefer(seferId) {
    selection = { ...selection, seferId };
    const pars = getParashiotForSefer(seferId);
    if (pars[0]) selection = { ...selection, parashaId:pars[0].id };
    screen = 'parashiot';
  }

  function chooseParasha(parashaId) {
    selection = { ...selection, parashaId };
    screen = 'aliyot';
  }

  function goBack() {
    if (screen === 'practice') screen = 'aliyot';
    else if (screen === 'aliyot') screen = 'parashiot';
    else if (screen === 'parashiot') screen = 'sefarim';
  }

  function audioUrl(verse) {
    if (!verse?.audio) return null;
    if (/^https?:/i.test(verse.audio)) return verse.audio;
    return `${import.meta.env.BASE_URL}${verse.audio}`;
  }

  async function loadAndSeek(verse, time = 0) {
    if (!audio || !verse?.audio) {
      notice = 'No recording has been published for this passuk yet.';
      return false;
    }
    notice = '';
    const src = audioUrl(verse);
    const identity = verse.key;
    if (audio.dataset.verseKey !== identity) {
      audio.pause();
      audio.src = src;
      audio.dataset.verseKey = identity;
      await new Promise((resolve) => {
        if (audio.readyState >= 1) resolve();
        else {
          const done = () => resolve();
          audio.addEventListener('loadedmetadata', done, { once:true });
          audio.addEventListener('error', done, { once:true });
        }
      });
    }
    if (!Number.isFinite(audio.duration)) {
      notice = 'This recording could not be loaded.';
      return false;
    }
    audioDuration = audio.duration;
    audio.currentTime = Math.max(0, Math.min(time, audioDuration));
    audioCurrentTime = audio.currentTime;
    return true;
  }

  async function playVerse(verse) {
    selectedKey = verse.key;
    playingVerseKey = verse.key;
    menuOpen = false;
    wordClipEnd = null;
    clippedWordIndex = null;
    activeWordIndex = null;
    const first = startsFor(verse)[0] ?? 0;
    if (!(await loadAndSeek(verse, first))) return;
    try { await audio.play(); isPlaying = true; } catch { isPlaying = false; }
    document.querySelector(`[data-verse-key="${CSS.escape(verse.key)}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  async function playWord(verse, index) {
    const starts = startsFor(verse);
    if (!starts.length || starts[index] == null) {
      notice = 'Record and publish this passuk in the Teacher Publisher before word-by-word practice is available.';
      return;
    }
    selectedKey = verse.key;
    playingVerseKey = verse.key;
    activeWordIndex = index;
    clippedWordIndex = index;
    if (!(await loadAndSeek(verse, starts[index]))) return;
    const next = starts[index + 1];
    wordClipEnd = next == null ? audio.duration : Math.min(audio.duration, next);
    try { await audio.play(); isPlaying = true; } catch { isPlaying = false; }
  }

  function togglePlayback() {
    if (!selectedVerse) return;
    if (!audio?.src || playingVerseKey !== selectedVerse.key || clippedWordIndex != null) return playVerse(selectedVerse);
    if (audio.paused) audio.play(); else audio.pause();
  }

  function handleTimeUpdate() {
    if (!audio) return;
    audioCurrentTime = audio.currentTime;
    audioDuration = Number.isFinite(audio.duration) ? audio.duration : audioDuration;
    const verse = currentVerses.find((v) => v.key === playingVerseKey);
    const starts = verse ? startsFor(verse) : [];
    if (!starts.length) return;
    if (wordClipEnd != null && audio.currentTime >= wordClipEnd - 0.01) {
      audio.pause(); wordClipEnd = null; clippedWordIndex = null; activeWordIndex = null; return;
    }
    if (clippedWordIndex != null) { activeWordIndex = clippedWordIndex; return; }
    let current = null;
    for (let i=0;i<starts.length;i+=1) { if (audio.currentTime >= starts[i]-0.01) current=i; else break; }
    activeWordIndex = current;
  }

  function finishPlayback() {
    isPlaying = false; activeWordIndex = null; wordClipEnd = null; clippedWordIndex = null;
  }
</script>

<audio bind:this={audio} onplay={() => isPlaying=true} onpause={() => isPlaying=false} onended={finishPlayback} ontimeupdate={handleTimeUpdate}></audio>

<header>
  {#if screen !== 'sefarim'}<button class="back" aria-label="Back" onclick={goBack}>‹</button>{/if}
  <button class="menu" aria-label="Open pessukim" onclick={() => menuOpen=!menuOpen} disabled={screen !== 'practice'}>☰</button>
  <div class="title">
    <strong>{currentParasha?.hebrew || 'תּוֹרָה'} · {currentAliyah?.hebrew || ''}</strong>
    <span>{currentSefer?.name || 'Torah'} · {currentParasha?.name || ''}{currentAliyah ? ` · ${currentAliyah.name}` : ''}</span>
  </div>
  {#if screen === 'practice'}
    <div class="controls">
      <div class="segmented"><button class:active={mode==='tikkun'} onclick={() => mode='tikkun'}>Tikkun</button><button class:active={mode==='scroll'} onclick={() => mode='scroll'}>Torah</button></div>
      <label class="switch"><input type="checkbox" bind:checked={showTransliteration}><span>Transliteration</span></label>
      <button class="play" onclick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button>
    </div>
  {/if}
</header>

{#if screen === 'sefarim'}
  <main class="picker"><span class="eyebrow">TORAH LIBRARY</span><h1>Choose a Sefer</h1><div class="grid">
    {#each sefarim as sefer}<button class="choice" onclick={() => chooseSefer(sefer.id)}><strong dir="rtl">{sefer.hebrew}</strong><span>{sefer.name}</span><small>{sefer.english}</small></button>{/each}
  </div></main>
{:else if screen === 'parashiot'}
  <main class="picker"><span class="eyebrow">{currentSefer?.name}</span><h1>Choose a Parasha</h1>
    {#if getParashiotForSefer(selection.seferId).length}
      <div class="grid">{#each getParashiotForSefer(selection.seferId) as p}<button class="choice" onclick={() => chooseParasha(p.id)}><strong dir="rtl">{p.hebrew}</strong><span>{p.name}</span><small>{p.reference}</small></button>{/each}</div>
    {:else}<div class="empty">No parashiot have been added to this Sefer yet.</div>{/if}
  </main>
{:else if screen === 'aliyot'}
  <main class="picker"><span class="eyebrow">{currentSefer?.name} · {currentParasha?.name}</span><h1>Choose an Aliyah</h1><div class="grid">
    {#each getAliyotForParasha(selection.parashaId) as a}<button class="choice" onclick={() => loadAliyah(a.id)}><strong dir="rtl">{a.hebrew}</strong><span>{a.name}</span><small>{a.reference}</small></button>{/each}
  </div></main>
{:else}
  <div class="layout">
    <aside class:open={menuOpen}>
      <div class="aside-title">{currentAliyah?.name} · Pessukim</div>
      {#each currentVerses as verse}
        <button class:selected={selectedKey===verse.key} onclick={() => playVerse(verse)}>
          <span class="verse-index">{verse.chapter}</span><span class="verse-ref">פסוק {hebrewNumber(verse.n)}</span><span class="mini-play">{verse.audio ? '▶' : '○'}</span>
        </button>
      {/each}
    </aside>
    {#if menuOpen}<button class="scrim" aria-label="Close menu" onclick={() => menuOpen=false}></button>{/if}
    <main>
      <div class="intro"><div><span class="eyebrow">{currentParasha?.name.toUpperCase()} · {currentAliyah?.name.toUpperCase()}</span><h1>Parasha Practice tool</h1></div><p>{currentAliyah?.reference}. Tap a passuk for the full recording, or a word for just that word.</p></div>
      {#if notice}<div class="notice">{notice}</div>{/if}
      <section class="text-card" dir="rtl">
        {#each currentVerses as verse}
          <article data-verse-key={verse.key} class:selected={selectedKey===verse.key}>
            <button class="verse-number" onclick={() => playVerse(verse)}>{hebrewNumber(verse.n)}</button>
            <div class="verse-text">
              <div class:scroll={mode==='scroll'} class="hebrew">
                {#each wordsFor(verse) as word, wordIndex}
                  <button class="word" class:active-word={playingVerseKey===verse.key && activeWordIndex===wordIndex} data-word-end={startsFor(verse)[wordIndex+1] ?? ''} onclick={() => playWord(verse,wordIndex)}>{word}</button>
                {/each}
              </div>
              {#if showTransliteration}<div class="transliteration" data-verse-key={verse.key}>Transliteration</div>{/if}
            </div>
            <button class="row-play" onclick={() => playVerse(verse)}>{verse.audio ? '▶' : '○'}</button>
          </article>
        {/each}
      </section>
    </main>
  </div>
{/if}

<style>
  :global(*){box-sizing:border-box}:global(html){scroll-behavior:smooth}:global(body){margin:0;background:#f6f1e7;color:#23231f;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}:global(button){font:inherit}
  header{position:sticky;top:0;z-index:20;height:76px;display:flex;align-items:center;gap:12px;padding:0 24px;background:rgba(246,241,231,.96);backdrop-filter:blur(12px);border-bottom:1px solid #d8d0c2}.back,.menu,.play{width:38px;height:38px;border:0;border-radius:50%;background:#243c34;color:#fff;cursor:pointer}.back{font-size:30px;line-height:1}.menu{display:none}.menu:disabled{opacity:.25}.title{display:flex;flex-direction:column;line-height:1.1;margin-right:auto}.title strong{font-family:"Noto Serif Hebrew",Georgia,serif;font-size:19px}.title span{margin-top:5px;color:#746f66;font-size:11px;letter-spacing:.07em;text-transform:uppercase}.controls{display:flex;align-items:center;gap:10px}.segmented{display:flex;padding:3px;background:#e8e0d2;border-radius:11px}.segmented button{border:0;background:transparent;padding:7px 12px;border-radius:8px;cursor:pointer}.segmented button.active{background:#fffdf8;box-shadow:0 1px 5px rgba(0,0,0,.08)}.switch{display:flex;align-items:center;gap:7px;font-size:13px;color:#5f5a51}
  .picker{width:min(900px,100%);margin:0 auto;padding:64px 28px 100px}.eyebrow{color:#7f6c45;font-size:11px;font-weight:800;letter-spacing:.16em}.picker h1,.intro h1{margin:10px 0 28px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(38px,6vw,62px);font-weight:500;line-height:1;letter-spacing:-.035em}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}.choice{min-height:150px;padding:22px;border:1px solid #d2c7b5;border-radius:18px;background:#fffdf7;box-shadow:0 12px 35px rgba(72,55,29,.06);cursor:pointer;text-align:left}.choice strong{display:block;font-family:"Noto Serif Hebrew",serif;font-size:31px}.choice span{display:block;margin-top:10px;font-size:17px;font-weight:750}.choice small{display:block;margin-top:6px;color:#7b746a;line-height:1.35}.empty,.notice{padding:14px 16px;border:1px solid #d8d0c2;border-radius:12px;background:#fffdf7;color:#6f695f}.notice{margin-bottom:18px}
  .layout{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:calc(100vh - 76px)}aside{position:sticky;top:76px;height:calc(100vh - 76px);border-right:1px solid #d8d0c2;padding:22px 14px;overflow:auto;background:#f1eadf}.aside-title{padding:0 10px 10px;color:#858076;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em}aside button{width:100%;display:grid;grid-template-columns:34px 1fr 24px;align-items:center;gap:5px;padding:11px 10px;border:0;border-radius:10px;background:transparent;text-align:left;cursor:pointer;color:#4b473f}aside button.selected{background:#dce5dc;color:#173c31;font-weight:650}.verse-index{font-size:10px;color:#8c857b}.verse-ref{direction:rtl;text-align:left;font-family:"Noto Serif Hebrew",serif}.mini-play{font-size:10px;opacity:.6}
  main:not(.picker){width:min(1040px,100%);margin:0 auto;padding:58px 54px 100px}.intro{display:grid;grid-template-columns:1.4fr .8fr;align-items:end;gap:40px;margin-bottom:34px}.intro h1{margin-bottom:0}.intro p{margin:0;color:#716b61;font-size:14px;line-height:1.6}.text-card{overflow:hidden;border:1px solid #d2c7b5;border-radius:20px;background:#fffdf7;box-shadow:0 18px 50px rgba(72,55,29,.07)}article{position:relative;display:grid;grid-template-columns:48px 1fr 40px;gap:15px;align-items:start;padding:28px 30px;border-bottom:1px solid #e7dfd2}article:last-child{border-bottom:0}article.selected{background:#eef2e9;box-shadow:inset -4px 0 #527363}.verse-number{width:35px;height:35px;border:1px solid #d7ccbb;border-radius:50%;background:transparent;color:#766b5c;cursor:pointer;font-family:"Noto Serif Hebrew",serif}.hebrew{display:flex;flex-direction:row;flex-wrap:wrap;justify-content:flex-start;gap:9px 11px;font-family:"Taamey Frank CLM","Noto Serif Hebrew","Times New Roman",serif;font-size:clamp(26px,3vw,37px);line-height:1.9}.hebrew.scroll{font-size:clamp(28px,3.2vw,40px);line-height:1.75;letter-spacing:.03em}.word{border:0;padding:0 3px;background:transparent;color:inherit;cursor:pointer;direction:rtl;border-radius:6px;font-family:inherit}.word.active-word{background:#d7e4d5;box-shadow:0 0 0 2px rgba(82,115,99,.14)}.transliteration{margin-top:3px;color:#8d867a;font-size:11px;font-style:italic;text-align:right}.row-play{width:34px;height:34px;border:0;border-radius:50%;background:#eee6d8;color:#425f53;cursor:pointer}.scrim{display:none}
  @media(max-width:780px){header{height:66px;padding:0 10px;gap:8px}.menu{display:block}.title strong{font-size:15px}.title span{display:none}.switch span{display:none}.segmented button{padding:6px 8px;font-size:12px}.layout{display:block}aside{position:fixed;z-index:30;top:66px;left:0;bottom:0;width:min(82vw,310px);height:auto;transform:translateX(-105%);transition:transform .2s ease;box-shadow:16px 0 50px rgba(0,0,0,.18)}aside.open{transform:translateX(0)}.scrim{display:block;position:fixed;z-index:25;inset:66px 0 0;border:0;background:rgba(24,24,20,.25)}main:not(.picker){padding:34px 14px 70px}.picker{padding:42px 14px 70px}.intro{grid-template-columns:1fr;gap:10px;margin-bottom:24px}.intro p{max-width:560px}article{grid-template-columns:32px 1fr;gap:10px;padding:22px 15px}.row-play{display:none}.verse-number{width:30px;height:30px}.hebrew{gap:7px 8px;font-size:29px;line-height:1.8}.word{padding:0 4px;min-height:42px}.grid{grid-template-columns:1fr 1fr}.choice{min-height:130px;padding:16px}.choice strong{font-size:27px}}
</style>
