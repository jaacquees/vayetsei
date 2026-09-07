<script>
  import { verses, scrollText } from './lib/verses.js';

  let mode = 'tikkun';
  let showTransliteration = false;
  let selected = 10;
  let menuOpen = false;
  let audio;
  let isPlaying = false;

  const hebrewNumber = (n) => ({10:'י',11:'יא',12:'יב',13:'יג',14:'יד',15:'טו',16:'טז',17:'יז',18:'יח',19:'יט',20:'כ',21:'כא',22:'כב'}[n]);

  function wordsFor(verse) {
    const source = mode === 'tikkun' ? verse.tikkun : scrollText(verse.tikkun);
    return source.split(/\s+/);
  }

  async function playVerse(verse) {
    selected = verse.n;
    menuOpen = false;
    if (!audio) return;
    audio.src = verse.audio;
    audio.currentTime = 0;
    try {
      await audio.play();
      isPlaying = true;
    } catch {
      isPlaying = false;
    }
    document.getElementById(`verse-${verse.n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function togglePlayback() {
    const verse = verses.find((v) => v.n === selected) ?? verses[0];
    if (!audio?.src || !audio.src.includes(verse.audio)) {
      playVerse(verse);
      return;
    }
    if (audio.paused) audio.play(); else audio.pause();
  }

  function wordTap() {
    // Word-specific playback will use the alignment timestamps added in the next data pass.
  }
</script>

<svelte:head>
  <meta name="description" content="Interactive Vayetsei Rishon tikkun practice" />
</svelte:head>

<audio bind:this={audio} onplay={() => isPlaying = true} onpause={() => isPlaying = false} onended={() => isPlaying = false}></audio>

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
    <button class="play" onclick={togglePlayback}>{isPlaying ? '❚❚' : '▶'}</button>
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
        <h1>Practice from the Tikkun.<br />Read from the Torah.</h1>
      </div>
      <p>Tap a passuk to hear the complete recording. Word-by-word playback and live highlighting plug into the same interface once alignment timings are added.</p>
    </div>

    <section class="text-card" dir="rtl">
      {#each verses as verse, i}
        <article id={`verse-${verse.n}`} class:selected={selected === verse.n}>
          <button class="verse-number" aria-label={`Play verse ${verse.n}`} onclick={() => playVerse(verse)}>{hebrewNumber(verse.n)}</button>
          <div class="verse-text">
            <div class:scroll={mode === 'scroll'} class="hebrew">
              {#each wordsFor(verse) as word}
                <button class="word" onclick={wordTap}>{word}</button>
              {/each}
            </div>
            {#if showTransliteration}
              <div class="transliteration" dir="ltr">Transliteration layer ready for word-level data.</div>
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
  .title strong { font-family: Georgia, "Times New Roman", serif; font-size: 19px; }
  .title span { margin-top: 6px; color: #746f66; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
  .controls { display: flex; align-items: center; gap: 10px; }
  .segmented { display: flex; padding: 3px; background: #e8e0d2; border-radius: 11px; }
  .segmented button { border: 0; background: transparent; padding: 7px 12px; border-radius: 8px; cursor: pointer; }
  .segmented button.active { background: #fffdf8; box-shadow: 0 1px 5px rgba(0,0,0,.08); }
  .switch { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #5f5a51; }
  .play, .menu { width: 38px; height: 38px; border-radius: 50%; border: 0; background: #243c34; color: white; cursor: pointer; }
  .menu { display: none; }

  .layout { display: grid; grid-template-columns: 230px minmax(0,1fr); min-height: calc(100vh - 76px); }
  aside { position: sticky; top: 76px; height: calc(100vh - 76px); border-right: 1px solid #d8d0c2; padding: 22px 14px; overflow-y: auto; background: #f1eadf; }
  .aside-title { padding: 0 10px 10px; color: #858076; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
  aside button { width: 100%; display: grid; grid-template-columns: 30px 1fr 24px; align-items: center; gap: 5px; padding: 11px 10px; border: 0; border-radius: 10px; background: transparent; text-align: left; cursor: pointer; color: #4b473f; }
  aside button:hover { background: rgba(255,255,255,.6); }
  aside button.selected { background: #dce5dc; color: #173c31; font-weight: 650; }
  .verse-index { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.65); font-size: 11px; }
  .verse-ref { direction: rtl; text-align: left; }
  .mini-play { font-size: 10px; opacity: .55; }

  main { width: min(1040px, 100%); margin: 0 auto; padding: 58px 54px 100px; }
  .intro { display: grid; grid-template-columns: 1.4fr .8fr; align-items: end; gap: 40px; margin-bottom: 42px; }
  .eyebrow { color: #7f6c45; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
  h1 { max-width: 680px; margin: 10px 0 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(34px,5vw,62px); font-weight: 500; line-height: .98; letter-spacing: -.035em; }
  .intro p { margin: 0; color: #716b61; font-size: 14px; line-height: 1.6; }

  .text-card { overflow: hidden; border: 1px solid #d2c7b5; border-radius: 20px; background: #fffdf7; box-shadow: 0 18px 50px rgba(72,55,29,.07); }
  article { position: relative; display: grid; grid-template-columns: 48px 1fr 40px; gap: 15px; align-items: start; padding: 28px 30px; border-bottom: 1px solid #e7dfd2; transition: background .2s ease; }
  article:last-child { border-bottom: 0; }
  article.selected { background: #eef2e9; box-shadow: inset -4px 0 #527363; }
  .verse-number { width: 35px; height: 35px; border: 1px solid #d7ccbb; border-radius: 50%; background: transparent; color: #766b5c; cursor: pointer; font-family: Georgia, serif; }
  .verse-text { min-width: 0; }
  .hebrew { display: flex; flex-direction: row; flex-wrap: wrap; justify-content: flex-start; gap: 9px 11px; font-family: "Times New Roman", "Noto Serif Hebrew", serif; font-size: clamp(26px,3vw,37px); line-height: 1.9; }
  .hebrew.scroll { font-size: clamp(28px,3.2vw,40px); line-height: 1.75; letter-spacing: .03em; }
  .word { border: 0; padding: 0 1px; background: transparent; color: inherit; cursor: pointer; direction: rtl; border-radius: 5px; }
  .word:hover { background: #e6ebdf; }
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
    .layout { display: block; }
    aside { position: fixed; z-index: 30; top: 66px; left: 0; bottom: 0; width: min(82vw,310px); height: auto; transform: translateX(-105%); transition: transform .2s ease; box-shadow: 16px 0 50px rgba(0,0,0,.18); }
    aside.open { transform: translateX(0); }
    .scrim { display: block; position: fixed; z-index: 25; inset: 66px 0 0; border: 0; background: rgba(24,24,20,.25); }
    main { padding: 34px 14px 70px; }
    .intro { grid-template-columns: 1fr; gap: 16px; margin-bottom: 26px; }
    .intro p { max-width: 560px; }
    article { grid-template-columns: 32px 1fr; gap: 10px; padding: 22px 15px; }
    .row-play { display: none; }
    .verse-number { width: 30px; height: 30px; }
    .hebrew { gap: 7px 8px; font-size: 29px; line-height: 1.8; }
  }
</style>
