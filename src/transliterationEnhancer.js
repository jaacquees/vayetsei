const TRANSLITERATIONS = {
  'bereshit:vayetzei:rishon:28:10': ["vayetze", "Ya'akov", "miBe'er", "Sheva", "vayelech", "Charanah"],
  'bereshit:vayetzei:rishon:28:11': ["vayifga", "bamakom", "vayalen", "sham", "ki-va", "hashemesh", "vayikach", "me'avnei", "hamakom", "vayasem", "mera'ashotav", "vayishkav", "bamakom", "hahu"],
  'bereshit:vayetzei:rishon:28:12': ["vayachalom", "vehineh", "sulam", "mutzav", "artzah", "verosho", "magia", "hashamaymah", "vehineh", "mal'achei", "Elohim", "olim", "veyordim", "bo"],
  'bereshit:vayetzei:rishon:28:13': ["vehineh", "Adonai", "nitzav", "alav", "vayomar", "ani", "Adonai", "Elohei", "Avraham", "avicha", "veElohei", "Yitzchak", "ha'aretz", "asher", "atah", "shochev", "aleha", "lecha", "etnenah", "ulezar'echa"],
  'bereshit:vayetzei:rishon:28:14': ["vehayah", "zar'acha", "ka'afar", "ha'aretz", "ufaratzta", "yamah", "vakedmah", "vetzafonah", "vanegbah", "venivrechu", "vecha", "kol-mishpechot", "ha'adamah", "uvezar'echa"],
  'bereshit:vayetzei:rishon:28:15': ["vehineh", "anochi", "imach", "ushmarticha", "bechol", "asher-telech", "vahashivoticha", "el-ha'adamah", "hazot", "ki", "lo", "e'ezovcha", "ad", "asher", "im-asiti", "et", "asher-dibarti", "lach"],
  'bereshit:vayetzei:rishon:28:16': ["vayikatz", "Ya'akov", "mishenato", "vayomer", "achen", "yesh", "Adonai", "bamakom", "hazeh", "ve'anochi", "lo", "yadati"],
  'bereshit:vayetzei:rishon:28:17': ["vayira", "vayomar", "mah-nora", "hamakom", "hazeh", "ein", "zeh", "ki", "im-beit", "Elohim", "vezeh", "sha'ar", "hashamayim"],
  'bereshit:vayetzei:rishon:28:18': ["vayashkem", "Ya'akov", "baboker", "vayikach", "et-ha'even", "asher-sam", "mera'ashotav", "vayasem", "otah", "matzevah", "vayitzok", "shemen", "al-roshah"],
  'bereshit:vayetzei:rishon:28:19': ["vayikra", "et-shem-hamakom", "hahu", "Beit-El", "ve'ulam", "Luz", "shem-ha'ir", "larishonah"],
  'bereshit:vayetzei:rishon:28:20': ["vayidar", "Ya'akov", "neder", "lemor", "im-yihyeh", "Elohim", "imadi", "ushemarani", "baderech", "hazeh", "asher", "anochi", "holech", "venatan-li", "lechem", "le'echol", "uveged", "lilbosh"],
  'bereshit:vayetzei:rishon:28:21': ["veshavti", "veshalom", "el-beit", "avi", "vehayah", "Adonai", "li", "leElohim"],
  'bereshit:vayetzei:rishon:28:22': ["veha'even", "hazot", "asher-samti", "matzevah", "yihyeh", "beit", "Elohim", "vechol", "asher", "titen-li", "aser", "a'asrenu", "lach"]
};

const style = document.createElement('style');
style.textContent = `
  .hebrew.with-transliteration { gap: 12px 14px !important; }
  .hebrew.with-transliteration .word { display:inline-flex; flex-direction:column; align-items:center; gap:2px; line-height:1.35; padding-bottom:4px; }
  .translit-word { direction:ltr; unicode-bidi:isolate; display:block; max-width:150px; color:#8d867a; font-family:Inter,ui-sans-serif,system-ui,sans-serif; font-size:11px; font-style:italic; font-weight:450; line-height:1.2; text-align:center; white-space:nowrap; }
  @media(max-width:780px){ .hebrew.with-transliteration{gap:10px 10px!important}.translit-word{font-size:10px} }
`;
document.head.appendChild(style);

let scheduled = false;
function syncTransliterations() {
  scheduled = false;
  document.querySelectorAll('article[data-verse-key]').forEach((article) => {
    const key = article.dataset.verseKey;
    const transliterations = TRANSLITERATIONS[key];
    const hebrew = article.querySelector('.hebrew');
    const placeholder = article.querySelector('.transliteration');
    if (!hebrew) return;
    const enabled = Boolean(placeholder);
    const wordButtons = Array.from(hebrew.querySelectorAll(':scope > .word'));

    if (!enabled || !transliterations || wordButtons.length !== transliterations.length) {
      hebrew.classList.remove('with-transliteration');
      wordButtons.forEach((button) => button.querySelector(':scope > .translit-word')?.remove());
      if (placeholder && !transliterations) {
        placeholder.style.display = '';
        placeholder.textContent = 'Transliteration for this passuk has not been added yet.';
      }
      return;
    }

    placeholder.style.display = 'none';
    hebrew.classList.add('with-transliteration');
    wordButtons.forEach((button, index) => {
      let label = button.querySelector(':scope > .translit-word');
      if (!label) {
        label = document.createElement('span');
        label.className = 'translit-word';
        label.setAttribute('aria-hidden', 'true');
        button.appendChild(label);
      }
      label.textContent = transliterations[index];
    });
  });
}
function scheduleSync(){ if(scheduled)return; scheduled=true; requestAnimationFrame(syncTransliterations); }
new MutationObserver(scheduleSync).observe(document.body,{childList:true,subtree:true});
scheduleSync();
