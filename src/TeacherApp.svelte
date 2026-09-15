<script>
  import { onMount } from 'svelte';
  import {
    sefarim, getSefer, getParasha, getAliyah, getParashiotForSefer, getAliyotForParasha,
    getVersesForAliyah, loadSelection, saveSelection
  } from './lib/torahCatalog.js';

  let screen = 'work';
  let selection = { seferId:'bereshit', parashaId:'vayetzei', aliyahId:'vayetzei-rishon' };
  let currentVerses = [];
  let selectedVerseKey = '';

  let recording = false;
  let mediaRecorder = null;
  let mediaStream = null;
  let chunks = [];
  let recordingBlob = null;
  let recordingUrl = '';
  let recordingStart = 0;
  let elapsed = 0;
  let timerHandle = null;
  let countdownText = '';
  let countdownVisible = false;
  let wordStarts = [];
  let nextTapIndex = 0;
  let selectedWordIndex = 0;
  let reviewReady = false;
  let playback;
  let clipFrame = null;
  let publishKey = '';
  let publishStatus = '';
  let statusText = 'Ready.';

  $: currentSefer = getSefer(selection.seferId);
  $: currentParasha = getParasha(selection.parashaId);
  $: currentAliyah = getAliyah(selection.aliyahId);
  $: selectedVerse = currentVerses.find((v) => v.key === selectedVerseKey) ?? currentVerses[0] ?? null;
  $: words = selectedVerse ? selectedVerse.tikkun.trim().split(/\s+/) : [];
  $: canPublish = Boolean(recordingBlob && selectedVerse && wordStarts.length === words.length && publishKey.trim());

  onMount(() => {
    selection = loadSelection();
    currentVerses = getVersesForAliyah(selection.aliyahId);
    selectedVerseKey = currentVerses[0]?.key ?? '';
    try { publishKey = sessionStorage.getItem('torah-teacher-publish-key') || ''; } catch {}
  });

  function verseLabel(v) { return `Genesis ${v.chapter}:${v.n}`; }

  function chooseSefer(seferId) {
    selection = { ...selection, seferId };
    const pars = getParashiotForSefer(seferId);
    if (pars[0]) selection = { ...selection, parashaId: pars[0].id };
    screen = 'parashiot';
  }

  function chooseParasha(parashaId) {
    selection = { ...selection, parashaId };
    screen = 'aliyot';
  }

  function chooseAliyah(aliyahId) {
    const aliyah = getAliyah(aliyahId);
    if (!aliyah) return;
    const parasha = getParasha(aliyah.parashaId);
    const sefer = parasha && getSefer(parasha.seferId);
    if (!parasha || !sefer) return;
    selection = saveSelection({ seferId:sefer.id, parashaId:parasha.id, aliyahId });
    currentVerses = getVersesForAliyah(aliyahId);
    selectedVerseKey = currentVerses[0]?.key ?? '';
    resetTake();
    screen = 'work';
  }

  function goBack() {
    if (screen === 'work') screen = 'aliyot';
    else if (screen === 'aliyot') screen = 'parashiot';
    else if (screen === 'parashiot') screen = 'sefarim';
  }

  function selectVerse(key) {
    if (recording) return;
    selectedVerseKey = key;
    resetTake();
  }

  function cleanupMedia() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  function cancelClipMonitor() {
    if (clipFrame != null) cancelAnimationFrame(clipFrame);
    clipFrame = null;
  }

  function resetTake() {
    cancelClipMonitor();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch {}
    }
    cleanupMedia();
    recording = false;
    chunks = [];
    recordingBlob = null;
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = '';
    wordStarts = [];
    nextTapIndex = 0;
    selectedWordIndex = 0;
    reviewReady = false;
    elapsed = 0;
    publishStatus = '';
    statusText = 'Ready.';
    if (playback) { playback.pause(); playback.removeAttribute('src'); playback.load(); }
  }

  async function runCountdown() {
    countdownVisible = true;
    for (const item of ['3','2','1','GO']) {
      countdownText = item;
      await new Promise((resolve) => setTimeout(resolve, item === 'GO' ? 450 : 650));
    }
    countdownVisible = false;
  }

  function pickMimeType() {
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
  }

  async function startRecording() {
    if (!selectedVerse || recording) return;
    resetTake();
    publishStatus = '';
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const mimeType = pickMimeType();
      mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      chunks = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || mimeType || 'audio/webm';
        recordingBlob = new Blob(chunks, { type });
        recordingUrl = URL.createObjectURL(recordingBlob);
        if (playback) playback.src = recordingUrl;
        reviewReady = true;
        recording = false;
        statusText = wordStarts.length === words.length ? 'Recording complete. Review each word.' : `Recording complete. ${wordStarts.length}/${words.length} word starts marked.`;
        cleanupMedia();
      };
      await runCountdown();
      mediaRecorder.start(200);
      recordingStart = performance.now();
      recording = true;
      statusText = 'Recording — tap each word as you start singing it.';
      timerHandle = setInterval(() => { elapsed = (performance.now() - recordingStart) / 1000; }, 30);
    } catch (error) {
      cleanupMedia();
      statusText = `Microphone error: ${error?.message || error}`;
    }
  }

  function stopRecording() {
    if (!recording || !mediaRecorder) return;
    elapsed = (performance.now() - recordingStart) / 1000;
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    recording = false;
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  function tapWord(index) {
    if (recording) {
      if (index !== nextTapIndex) return;
      const time = Math.max(0, (performance.now() - recordingStart) / 1000);
      wordStarts = [...wordStarts, Number(time.toFixed(3))];
      selectedWordIndex = index;
      nextTapIndex += 1;
      if (nextTapIndex >= words.length) statusText = 'All word starts marked. Finish singing, then press Stop.';
      return;
    }
    if (reviewReady && wordStarts[index] != null) {
      selectedWordIndex = index;
      auditionWord(index);
    }
  }

  function monitorClipEnd(end) {
    cancelClipMonitor();
    const tick = () => {
      if (!playback || playback.paused) { clipFrame = null; return; }
      if (playback.currentTime >= end - 0.012) {
        playback.pause();
        try { playback.currentTime = end; } catch {}
        clipFrame = null;
        return;
      }
      clipFrame = requestAnimationFrame(tick);
    };
    clipFrame = requestAnimationFrame(tick);
  }

  async function auditionWord(index) {
    if (!playback || !recordingUrl || wordStarts[index] == null) return;
    cancelClipMonitor();
    selectedWordIndex = index;
    const start = wordStarts[index];
    const end = wordStarts[index + 1] ?? (Number.isFinite(playback.duration) ? playback.duration : null);
    try {
      playback.currentTime = start;
      await playback.play();
      if (Number.isFinite(end)) monitorClipEnd(end);
    } catch {}
  }

  function clampBoundary(index, value) {
    const min = index === 0 ? 0 : wordStarts[index - 1] + 0.03;
    const max = index === wordStarts.length - 1
      ? (Number.isFinite(playback?.duration) ? playback.duration - 0.03 : Infinity)
      : wordStarts[index + 1] - 0.03;
    return Math.max(min, Math.min(value, max));
  }

  function nudge(delta) {
    if (wordStarts[selectedWordIndex] == null) return;
    const next = [...wordStarts];
    next[selectedWordIndex] = Number(clampBoundary(selectedWordIndex, next[selectedWordIndex] + delta).toFixed(3));
    wordStarts = next;
    auditionWord(selectedWordIndex);
  }

  function setAtPlayhead() {
    if (!playback || wordStarts[selectedWordIndex] == null) return;
    const next = [...wordStarts];
    next[selectedWordIndex] = Number(clampBoundary(selectedWordIndex, playback.currentTime).toFixed(3));
    wordStarts = next;
    auditionWord(selectedWordIndex);
  }

  function boundaryEnd(index) {
    if (wordStarts[index + 1] != null) return wordStarts[index + 1];
    return Number.isFinite(playback?.duration) ? playback.duration : null;
  }

  async function publish() {
    if (!canPublish) return;
    try { sessionStorage.setItem('torah-teacher-publish-key', publishKey); } catch {}
    publishStatus = 'Publishing…';
    const form = new FormData();
    form.set('verseKey', selectedVerse.key);
    form.set('wordStarts', JSON.stringify(wordStarts));
    form.set('duration', String(Number.isFinite(playback?.duration) ? playback.duration : elapsed));
    form.set('audio', recordingBlob, `recording.${recordingBlob.type.includes('mp4') ? 'm4a' : 'webm'}`);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/publish`, {
        method:'POST',
        headers:{ Authorization:`Bearer ${publishKey.trim()}` },
        body:form
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Publish failed (${response.status})`);
      publishStatus = `Published ${verseLabel(selectedVerse)} ✓`;
      statusText = 'Published. The student practice page will use this recording and these boundaries.';
    } catch (error) {
      publishStatus = error?.message || 'Publish failed.';
    }
  }
</script>

<header>
  {#if screen !== 'sefarim'}<button class="back" onclick={goBack}>‹</button>{/if}
  <div class="title"><strong>{currentParasha?.hebrew || 'תּוֹרָה'} · {currentAliyah?.hebrew || ''}</strong><span>Teacher Publisher · {currentSefer?.name || 'Torah'}</span></div>
</header>

{#if screen === 'sefarim'}
  <main class="picker"><span class="eyebrow">TEACHER LIBRARY</span><h1>Choose a Sefer</h1><div class="grid">{#each sefarim as s}<button class="choice" onclick={() => chooseSefer(s.id)}><strong dir="rtl">{s.hebrew}</strong><span>{s.name}</span><small>{s.english}</small></button>{/each}</div></main>
{:else if screen === 'parashiot'}
  <main class="picker"><span class="eyebrow">{currentSefer?.name}</span><h1>Choose a Parasha</h1>{#if getParashiotForSefer(selection.seferId).length}<div class="grid">{#each getParashiotForSefer(selection.seferId) as p}<button class="choice" onclick={() => chooseParasha(p.id)}><strong dir="rtl">{p.hebrew}</strong><span>{p.name}</span><small>{p.reference}</small></button>{/each}</div>{:else}<div class="empty">No parashiot have been added to this Sefer yet.</div>{/if}</main>
{:else if screen === 'aliyot'}
  <main class="picker"><span class="eyebrow">{currentSefer?.name} · {currentParasha?.name}</span><h1>Choose an Aliyah</h1><div class="grid">{#each getAliyotForParasha(selection.parashaId) as a}<button class="choice" onclick={() => chooseAliyah(a.id)}><strong dir="rtl">{a.hebrew}</strong><span>{a.name}</span><small>{a.reference}</small></button>{/each}</div></main>
{:else}
  <main>
    <span class="eyebrow">INSTRUCTOR TOOL · {currentParasha?.name.toUpperCase()} · {currentAliyah?.name.toUpperCase()}</span>
    <h1>Record the passuk and publish it</h1>
    <p class="lede">Tap each word exactly when you begin singing it. Then audition each word, adjust the shared boundaries, and publish the finished take to the student app.</p>

    <section class="card">
      <div class="setup">
        <label>Passuk<select value={selectedVerseKey} onchange={(e) => selectVerse(e.currentTarget.value)} disabled={recording}>{#each currentVerses as v}<option value={v.key}>{verseLabel(v)}</option>{/each}</select></label>
        <div class="record-actions"><button class="primary" onclick={startRecording} disabled={recording}>● Start recording</button><button class="danger" onclick={stopRecording} disabled={!recording}>■ Stop</button><button class="secondary" onclick={resetTake} disabled={recording}>Reset</button></div>
      </div>

      <div class="statusbar"><span class:recording class="dot"></span><span>{statusText}</span><span class="timer">{elapsed.toFixed(2)}s</span></div>
      <div class="instructions">During recording, only the next word is active. In review, tap any marked word to hear precisely that word.</div>
      <div class="words" dir="rtl">
        {#each words as word,index}
          <button class="word" class:next={recording && index===nextTapIndex} class:marked={wordStarts[index]!=null} class:review-selected={reviewReady && index===selectedWordIndex} onclick={() => tapWord(index)}>
            <span>{word}</span><small>{wordStarts[index]!=null ? `${wordStarts[index].toFixed(2)}s` : '—'}</small>
          </button>
        {/each}
      </div>

      {#if reviewReady}
        <section class="review">
          <h2>Review</h2>
          <p>Tap any word above to audition it from its start boundary to the next shared boundary.</p>
          <audio bind:this={playback} controls src={recordingUrl}></audio>
          <div class="review-grid">
            <div class="boundary-card">
              <strong dir="rtl">{words[selectedWordIndex] || '—'}</strong>
              <div class="time">{wordStarts[selectedWordIndex]?.toFixed(3) ?? '—'}s → {boundaryEnd(selectedWordIndex)?.toFixed?.(3) ?? 'end'}s</div>
              <div class="nudges"><button onclick={() => nudge(-.10)}>−100 ms</button><button onclick={() => nudge(-.05)}>−50 ms</button><button onclick={setAtPlayhead}>Set at playhead</button><button onclick={() => nudge(.05)}>+50 ms</button><button onclick={() => nudge(.10)}>+100 ms</button></div>
            </div>
            <div class="publish-card">
              <p>Publish writes this audio and its exact word boundaries to the selected Torah verse.</p>
              <label>Teacher publish key<input type="password" bind:value={publishKey} autocomplete="current-password" placeholder="Enter publish key"></label>
              <button class="publish" onclick={publish} disabled={!canPublish}>Publish to practice app</button>
              <div class="publish-status">{publishStatus}</div>
            </div>
          </div>
        </section>
      {/if}
    </section>
  </main>
{/if}

{#if countdownVisible}<div class="countdown">{countdownText}</div>{/if}

<style>
  :global(*){box-sizing:border-box}:global(body){margin:0;min-height:100vh;background:#f6f1e7;color:#25241f;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}:global(button),:global(select),:global(input){font:inherit}:global(button){touch-action:manipulation}
  header{position:sticky;top:0;z-index:10;height:68px;display:flex;align-items:center;gap:12px;padding:0 22px;background:rgba(246,241,231,.96);backdrop-filter:blur(12px);border-bottom:1px solid #d8d0c2}.back{width:38px;height:38px;border:0;border-radius:50%;background:#243c34;color:#fff;font-size:29px;line-height:1;cursor:pointer}.title strong{display:block;font-family:"Noto Serif Hebrew",Georgia,serif;font-size:18px}.title span{display:block;margin-top:3px;color:#766f64;font-size:11px;letter-spacing:.08em;text-transform:uppercase}
  main{width:min(980px,100%);margin:0 auto;padding:42px 24px 90px}.eyebrow{color:#7f6c45;font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}h1{margin:8px 0 12px;font-family:Georgia,"Times New Roman",serif;font-size:clamp(34px,6vw,56px);font-weight:500;line-height:1;letter-spacing:-.035em}.lede{max-width:760px;margin:0 0 26px;color:#6f695f;line-height:1.55}.card{border:1px solid #d2c7b5;border-radius:20px;background:#fffdf7;box-shadow:0 18px 50px rgba(72,55,29,.07);overflow:hidden}.setup{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:16px;align-items:end;padding:22px 24px;border-bottom:1px solid #e7dfd2}label{display:grid;gap:7px;color:#716b61;font-size:12px;font-weight:700}select,input[type=password]{width:100%;border:1px solid #cfc5b5;border-radius:10px;padding:10px 12px;background:#fff;color:#2e2d28}.record-actions,.nudges{display:flex;gap:8px;align-items:center;flex-wrap:wrap}button{border:0;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:750}.primary{background:#243c34;color:#fff}.danger{background:#8b3a32;color:#fff}.secondary{border:1px solid #c8c0b4;background:#f8f4ec;color:#45423c}.publish{margin-top:12px;background:#294f3e;color:#fff;width:100%}button:disabled{opacity:.42;cursor:default}.statusbar{display:flex;align-items:center;gap:10px;min-height:42px;padding:10px 24px;background:#f5efe5;color:#69635a;font-size:12px}.dot{width:9px;height:9px;border-radius:50%;background:#aaa}.dot.recording{background:#c64134;box-shadow:0 0 0 5px rgba(198,65,52,.11)}.timer{margin-left:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700}.instructions{padding:18px 24px 4px;color:#5f5a51;font-size:13px;line-height:1.5}.words{display:flex;flex-wrap:wrap;gap:10px 12px;padding:20px 24px 28px;font-family:"Taamey Frank CLM","Noto Serif Hebrew",serif}.word{min-width:70px;min-height:68px;border:1px solid #ddd3c4;border-radius:13px;padding:10px 10px 8px;background:#fffdf8;color:#282721;font-family:inherit;font-size:26px;line-height:1.25}.word small{display:block;margin-top:6px;direction:ltr;color:#9b9387;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px}.word.next{border-color:#4d6f5f;box-shadow:0 0 0 3px rgba(77,111,95,.14);background:#edf3e9}.word.marked{background:#dfe9dc;border-color:#b5c9b7}.word.review-selected{outline:3px solid rgba(127,108,69,.28);outline-offset:2px}.review{border-top:1px solid #e7dfd2;padding:24px;background:#f5f7f1}.review h2{margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:500}.review>p{margin:0 0 16px;color:#6f695f;font-size:12px}.review audio{width:100%;margin:4px 0 16px}.review-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.boundary-card,.publish-card{border:1px solid #ccd5c9;border-radius:14px;padding:14px;background:rgba(255,255,255,.72)}.boundary-card strong{display:block;font-family:"Noto Serif Hebrew",serif;font-size:28px}.time{margin-top:4px;color:#5c665f;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.nudges{margin-top:12px}.nudges button{border:1px solid #c7d0c5;background:#fffdf8;padding:8px 10px;font-size:12px}.publish-card p{margin:0 0 12px;color:#6f695f;font-size:12px;line-height:1.45}.publish-status{margin-top:10px;color:#365c48;font-size:12px;font-weight:650}.countdown{position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:rgba(25,25,21,.5);color:#fff;font-family:Georgia,serif;font-size:min(30vw,160px);font-weight:700}
  .picker{width:min(900px,100%);padding-top:60px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:28px}.choice{min-height:150px;padding:22px;border:1px solid #d2c7b5;border-radius:18px;background:#fffdf7;box-shadow:0 12px 35px rgba(72,55,29,.06);text-align:left}.choice strong{display:block;font-family:"Noto Serif Hebrew",serif;font-size:31px}.choice span{display:block;margin-top:10px;font-size:17px}.choice small{display:block;margin-top:6px;color:#7b746a}.empty{margin-top:24px;padding:14px;border:1px solid #d8d0c2;border-radius:12px;background:#fffdf7;color:#6f695f}
  @media(max-width:680px){header{height:62px;padding:0 12px}main{padding:30px 12px 60px}.setup{grid-template-columns:1fr;padding:18px 16px}.statusbar,.instructions{padding-left:16px;padding-right:16px}.words{padding:16px 12px 24px;gap:8px}.word{min-width:62px;min-height:64px;font-size:23px}.review{padding:18px 14px}.review-grid{grid-template-columns:1fr}.grid{grid-template-columns:1fr 1fr}.choice{min-height:130px;padding:16px}.choice strong{font-size:27px}}
</style>
