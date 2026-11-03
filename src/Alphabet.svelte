<script>
  let showNames = true;
  let showSounds = true;
  const alphabet = [
    ['א','Alef','Silent; carries a vowel'],['בּ','Bet','b as in book'],['ב','Vet','v as in very'],
    ['ג','Gimel','g as in go'],['ד','Dalet','d as in dog'],['ה','He','h as in hat'],
    ['ו','Vav','v as in very'],['ז','Zayin','z as in zebra'],['ח','Chet','kh, a throaty sound'],
    ['ט','Tet','t as in top'],['י','Yod','y as in yes'],['כּ','Kaf','k as in kite'],
    ['כ','Khaf','kh, a throaty sound'],['ל','Lamed','l as in lamp'],['מ','Mem','m as in moon'],
    ['נ','Nun','n as in nose'],['ס','Samekh','s as in sun'],['ע','Ayin','Usually silent in modern Hebrew; carries a vowel'],
    ['פּ','Pe','p as in pen'],['פ','Fe','f as in fish'],['צ','Tsadi','ts as in cats'],
    ['ק','Qof','k as in kite'],['ר','Resh','r'],['שׁ','Shin','sh as in ship'],
    ['שׂ','Sin','s as in sun'],['ת','Tav','t as in top']
  ];
  const finals = [['ך','Final Khaf','kh'],['ם','Final Mem','m'],['ן','Final Nun','n'],['ף','Final Fe','f'],['ץ','Final Tsadi','ts']];
  const dots = [['גּ','Gimel with dagesh','g'],['דּ','Dalet with dagesh','d'],['תּ','Tav with dagesh','t'],['הּ','He with mappiq','Pronounced h at the end of a word'],['וּ','Vav with shuruk','oo as in moon'],['וֹ','Vav with holam','o as in go'],['ךּ','Final Kaf with dagesh','k; uncommon']];
</script>

<main class="alphabet-page">
  <span class="eyebrow">LEARN TO READ HEBREW</span>
  <h1>The Alef-Bet</h1>
  <p>Start at the top right and read each row from right to left. Learn the shapes first, then try hiding their names.</p>
  <div class="toggles">
    <label><input type="checkbox" bind:checked={showNames} /> Show letter names (transliteration)</label>
    <label><input type="checkbox" bind:checked={showSounds} /> Show sounds</label>
  </div>
  {#each [{title:'Alphabet', rows:alphabet}, {title:'Final letters', rows:finals}, {title:'More dotted forms', rows:dots}] as section}
    <section>
      <h2>{section.title}</h2>
      {#if section.title === 'Final letters'}<p>These five letters change shape at the end of a word.</p>{/if}
      <div class="letters" dir="rtl">
        {#each section.rows as [letter, name, sound]}
          <article>
            <div class="glyph" lang="he" dir="rtl">{letter}</div>
            {#if showNames}<strong dir="ltr">{name}</strong>{/if}
            {#if showSounds}<small dir="ltr">{sound}</small>{/if}
          </article>
        {/each}
      </div>
    </section>
  {/each}
  <div class="note">
    <h2>What do the dots mean?</h2>
    <p>The dot inside a letter is usually a <em>dagesh</em>. In modern Hebrew it changes Bet/Vet, Kaf/Khaf and Pe/Fe. Other letters can also have a dagesh, usually without changing their modern sound. The dots above Shin distinguish <strong>sh</strong> (right) from <strong>s</strong> (left).</p>
    <p>Some dots are vowel signs: וּ makes “oo” and וֹ makes “o”. The dot in הּ is a <em>mappiq</em>. This page uses modern Hebrew sounds; some Torah-reading traditions pronounce certain letters differently.</p>
  </div>
</main>

<style>
  .alphabet-page{max-width:1040px;margin:auto;padding:36px 20px 80px;color:#23231f}
  .eyebrow{color:#7f6c45;font-size:11px;letter-spacing:.16em;font-weight:800}
  h1{font-family:Georgia,serif;font-size:clamp(38px,6vw,62px);font-weight:500;margin:10px 0 16px}
  p{color:#635e54;line-height:1.65;max-width:760px}
  .toggles{display:flex;gap:18px;flex-wrap:wrap;background:#e8e0d2;border-radius:14px;padding:16px;margin:24px 0}
  label{display:flex;align-items:center;gap:8px;cursor:pointer}
  input{accent-color:#243c34;width:20px;height:20px}
  section{margin-top:32px}h2{font-size:22px;color:#243c34}
  .letters{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
  article{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-height:190px;padding:15px 10px;border:1px solid #d2c7b5;border-radius:18px;background:#fffdf7;text-align:center;box-shadow:0 8px 25px #48371d0a}
  .glyph{font-family:"Noto Serif Hebrew",serif;font-size:76px;line-height:1.55;color:#243c34;min-height:118px}
  strong{font-size:17px}small{font-size:13px;line-height:1.5;margin-top:8px;color:#635e54}
  .note{margin-top:36px;padding:8px 20px;background:#e8e0d2;border-radius:16px}
  @media(max-width:480px){.letters{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.glyph{font-size:62px;min-height:96px}article{min-height:165px;padding:10px 5px}strong{font-size:14px}small{font-size:12px}}
</style>
