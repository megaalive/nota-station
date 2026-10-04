// Entry point aplikasi. Yang penting di R0: boot tanpa galat console, semua path relatif,
// shell §8.3 lengkap, dan window.tracker tersedia buat agent (§9).

import { createI18n, DEFAULT_LOCALE } from './i18n/messages.js';
import { createCommandRegistry } from './core/commands.js';
import { createPalette } from './ui/palette.js';
import { createShell } from './ui/shell.js';

const i18n = createI18n(readInitialLocale());
const registry = createCommandRegistry();
const store = window.localStorage;
const THEMES = ['light', 'dark', 'high-contrast'];

let theme = readInitialTheme();
let buildInfo = null;
let shell = null;

applyTheme(theme);

/**
 * Metadata build dibaca relatif, bukan dari path absolut — biar tetap jalan di
 * https://<user>.github.io/<repo>/ tanpa perlu tahu nama repo (§3.3).
 */
async function loadBuildInfo() {
  try {
    const res = await fetch('./build.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    return { version: data.version ?? null, sha: data.sha ?? null };
  } catch {
    // Waktu development di file:// atau server statis tanpa build.json — bukan kondisi fatal.
    return null;
  }
}

function readInitialLocale() {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('lang');
  if (fromQuery) return fromQuery;
  const stored = window.localStorage?.getItem('notastation.locale');
  return stored || DEFAULT_LOCALE;
}

function setLocale(next) {
  if (!i18n.setLocale(next)) return false;
  store?.setItem('notastation.locale', next);
  syncHtmlLang();

  // Shell R0 dibuat dari string terjemahan saat konstruksi. Jadi ganti bahasa
  // harus membuat ulang node-nya, bukan sekadar memasang ulang node lama.
  if (shell) mountShell(shell.getActiveTab());
  return true;
}

function readInitialTheme() {
  const stored = store?.getItem('notastation.theme');
  return THEMES.includes(stored) ? stored : 'light';
}

function applyTheme(next) {
  document.documentElement.dataset.theme = next;
}

function setTheme(next) {
  if (!THEMES.includes(next)) return false;
  theme = next;
  store?.setItem('notastation.theme', next);
  applyTheme(next);
  return true;
}

function cycleTheme() {
  const index = THEMES.indexOf(theme);
  const next = THEMES[(index + 1) % THEMES.length];
  setTheme(next);
  return next;
}

/** Satu-satunya tempat yang menulis `lang` di <html> — jangan disalin ke tempat lain. */
function syncHtmlLang() {
  document.documentElement.lang = i18n.getLocale();
}

const palette = createPalette({
  registry,
  t: (key, vars) => i18n.t(key, vars),
  onRun: () => shell?.render(),
});

function registerCommands() {
  registry.registerAll([
    {
      id: 'playback.play',
      group: 'Playback',
      labelKey: 'transport.play',
      shortcut: 'Space',
      run: () => {
        setSaveStatus('status.notSaved');
        return 'play';
      },
    },
    {
      id: 'playback.stop',
      group: 'Playback',
      labelKey: 'transport.stop',
      run: () => 'stop',
    },
    {
      id: 'ui.showPattern',
      group: 'Tampilan',
      labelKey: 'palette.openPattern',
      shortcut: 'Alt+2',
      run: () => {
        shell?.selectTab('pattern');
        return 'pattern';
      },
    },
    {
      id: 'ui.openPalette',
      group: 'Tampilan',
      labelKey: 'cmd.palette',
      shortcut: 'Ctrl+K',
      run: () => {
        palette.open();
        return 'palette';
      },
    },
    {
      id: 'ui.cycleTheme',
      group: 'Tampilan',
      labelKey: 'palette.toggleTheme',
      run: () => cycleTheme(),
    },
    {
      // Sengaja nonaktif di R0: audio baru ada di R1. Tampilkan denngan alasan,
      // bukan disembunyikan — user jadi tahu kenapa tidak bisa dipakai (§8.14).
      id: 'io.exportWav',
      group: 'Ekspor',
      labelKey: 'palette.exportWav',
      isEnabled: () => false,
      disabledReason: () => i18n.t('palette.notAvailable'),
      run: () => 'wav',
    },
  ]);
}

function setSaveStatus(key) {
  const chip = document.querySelector('[data-action="save-status"]');
  if (chip) chip.textContent = i18n.t(key);
}

function mountShell(activeTab = 'pattern') {
  shell = createShell({
    root: document.getElementById('app'),
    t: (key, vars) => i18n.t(key, vars),
    registry,
    palette,
    store,
    build: buildInfo,
  });
  shell.render();
  if (activeTab !== 'pattern') shell.selectTab(activeTab);
}

function bindShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Shortcut pakai KeyboardEvent.code, bukan karakter, supaya tetap benar di
    // AZERTY/Dvorak/QWERTZ (§8.14 aturan 1).
    if (event.ctrlKey && event.code === 'KeyK') {
      event.preventDefault();
      registry.execute('ui.openPalette');
      return;
    }
    if (event.altKey && /^Digit[1-7]$/.test(event.code)) {
      event.preventDefault();
      const index = Number(event.code.slice(5)) - 1;
      const ids = ['song', 'pattern', 'pianoRoll', 'lyrics', 'guitar', 'score', 'sound'];
      shell?.selectTab(ids[index]);
    }
  });
}

async function boot() {
  registerCommands();
  buildInfo = await loadBuildInfo();

  mountShell();
  syncHtmlLang();
  bindShortcuts();

  // Hook agent: satu-satunya jalan keluar state/aksi (§9). Nggak ada AudioContext
  // atau raw storage yang di-expose lewat sini.
  window.tracker = {
    getState: () => ({
      ready: true,
      locale: i18n.getLocale(),
      theme,
      build: buildInfo,
      activeTab: shell.getActiveTab(),
    }),
    commands: registry,
    setLocale,
    i18n,
  };
}

boot().catch((err) => {
  const root = document.getElementById('app');
  if (root) root.textContent = i18n.t('app.bootFailed');
  // Galat boot itu harus kelihatan di console juga — di sini console.error memang
  // yang tepat, bukan sisa debug yang perlu dihapus.
  console.error('[NotaStation] boot gagal:', err);
});