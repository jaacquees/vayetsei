const TRANSLITERATIONS = {
  10: ["vayetze", "Ya'akov", "miBe'er", "Sheva", "vayelech", "Charanah"],
  11: ["vayifga", "bamakom", "vayalen", "sham", "ki-va", "hashemesh", "vayikach", "me'avnei", "hamakom", "vayasem", "mera'ashotav", "vayishkav", "bamakom", "hahu"],
  12: ["vayachalom", "vehineh", "sulam", "mutzav", "artzah", "verosho", "magia", "hashamaymah", "vehineh", "mal'achei", "Elohim", "olim", "veyordim", "bo"],
  13: ["vehineh", "Adonai", "nitzav", "alav", "vayomar", "ani", "Adonai", "Elohei", "Avraham", "avicha", "veElohei", "Yitzchak", "ha'aretz", "asher", "atah", "shochev", "aleha", "lecha", "etnenah", "ulezar'echa"],
  14: ["vehayah", "zar'acha", "ka'afar", "ha'aretz", "ufaratzta", "yamah", "vakedmah", "vetzafonah", "vanegbah", "venivrechu", "vecha", "kol-mishpechot", "ha'adamah", "uvezar'echa"],
  15: ["vehineh", "anochi", "imach", "ushmarticha", "bechol", "asher-telech", "vahashivoticha", "el-ha'adamah", "hazot", "ki", "lo", "e'ezovcha", "ad", "asher", "im-asiti", "et", "asher-dibarti", "lach"],
  16: ["vayikatz", "Ya'akov", "mishenato", "vayomer", "achen", "yesh", "Adonai", "bamakom", "hazeh", "ve'anochi", "lo", "yadati"],
  17: ["vayira", "vayomar", "mah-nora", "hamakom", "hazeh", "ein", "zeh", "ki", "im-beit", "Elohim", "vezeh", "sha'ar", "hashamayim"],
  18: ["vayashkem", "Ya'akov", "baboker", "vayikach", "et-ha'even", "asher-sam", "mera'ashotav", "vayasem", "otah", "matzevah", "vayitzok", "shemen", "al-roshah"],
  19: ["vayikra", "et-shem-hamakom", "hahu", "Beit-El", "ve'ulam", "Luz", "shem-ha'ir", "larishonah"],
  20: ["vayidar", "Ya'akov", "neder", "lemor", "im-yihyeh", "Elohim", "imadi", "ushemarani", "baderech", "hazeh", "asher", "anochi", "holech", "venatan-li", "lechem", "le'echol", "uveged", "lilbosh"],
  21: ["veshavti", "veshalom", "el-beit", "avi", "vehayah", "Adonai", "li", "leElohim"],
  22: ["veha'even", "hazot", "asher-samti", "matzevah", "yihyeh", "beit", "Elohim", "vechol", "asher", "titen-li", "aser", "a'asrenu", "lach"]
};

const style = document.createElement('style');
style.textContent = `
  .hebrew.with-transliteration {
    gap: 12px 14px !important;
  }

  .hebrew.with-transliteration .word {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 2px;
    line-height: 1.35;
    padding-bottom: 4px;
  }

  .translit-word {
    direction: ltr;
    unicode-bidi: isolate;
    display: block;
    max-width: 150px;
    color: #8d867a;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 11px;
    font-style: italic;
    font-weight: 450;
    line-height: 1.2;
    letter-spacing: 0;
    text-align: center;
    white-space: nowrap;
  }

  @media (max-width: 780px) {
    .hebrew.with-transliteration {
      gap: 10px 10px !important;
    }

    .translit-word {
      font-size: 10px;
    }
  }
`;
document.head.appendChild(style);

let scheduled = false;

function syncTransliterations() {
  scheduled = false;

  document.querySelectorAll('article[id^="verse-"]').forEach((article) => {
    const verseNumber = Number(article.id.replace('verse-', ''));
    const transliterations = TRANSLITERATIONS[verseNumber];
    const hebrew = article.querySelector('.hebrew');
    if (!hebrew || !transliterations) return;

    const placeholder = article.querySelector('.transliteration');
    const enabled = Boolean(placeholder);
    const wordButtons = Array.from(hebrew.querySelectorAll(':scope > .word'));

    if (!enabled || wordButtons.length !== transliterations.length) {
      hebrew.classList.remove('with-transliteration');
      wordButtons.forEach((button) => button.querySelector(':scope > .translit-word')?.remove());
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

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(syncTransliterations);
}

const observer = new MutationObserver(scheduleSync);
observer.observe(document.body, { childList: true, subtree: true });
scheduleSync();
