// Entry point aplikasi. R0 menyediakan shell/command layer; R1 mulai menambahkan
// model Pattern dan audio tanpa membocorkan state mentah ke view/agent.

import { createI18n, DEFAULT_LOCALE } from './i18n/messages.js';
import { commandError, createCommandRegistry } from './core/commands.js';
import { activePattern, createBlankProject, enterNote } from './core/project.js';
import { createAudioEngine } from './audio/engine.js';
import { createPalette } from './ui/palette.js';
import { createPatternView } from './ui/pattern.js';
import { createShell } from './ui/shell.js';

const i18n = createI18n(readInitialLocale());
const registry = createCommandRegistry();
const store = window.localStorage;
const THEMES = ['light', 'dark', 'high-contrast'];

let theme = readInitialTheme();
let buildInfo = null;
let project = createBlankProject();
const audio = createAudioEngine();
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
        void playActivePattern();
        return 'play';
      },
    },
    {
      id: 'playback.stop',
      group: 'Playback',
      labelKey: 'transport.stop',
      run: () => {
        audio.stop();
        shell?.setAudioStatus(audio.getState().state);
        return 'stop';
      },
    },
    {
      id: 'pattern.enterNote',
      group: 'Pattern',
      labelKey: 'pattern.enterNote',
      run: (args) => {
        if (!args || typeof args !== 'object') {
          throw commandError('E_CMD_ARGS_REQUIRED', 'pattern.enterNote membutuhkan argumen sel dan pitch.');
        }
        project = enterNote(project, args);
        setSaveStatus('status.notSaved');
        return { noteCount: activePattern(project).notes.length };
      },
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
      // Ekspor WAV belum masuk slice R1-S1. Tetap tampil dengan alasan,
      // bukan disembunyikan — user jadi tahu kenapa belum bisa dipakai (§8.14).
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

async function playActivePattern() {
  try {
    const result = await audio.playPattern(project, activePattern(project));
    shell?.setAudioStatus('playing');
    return result;
  } catch {
    shell?.setAudioStatus('error');
    return null;
  }
}

function auditionPitch(pitch) {
  void audio.preview(pitch)
    .then(() => shell?.setAudioStatus('ready'))
    .catch(() => shell?.setAudioStatus('error'));
}

function renderWorkspace(tab, root) {
  if (tab !== 'pattern') return false;

  createPatternView({
    root,
    t: (key, vars) => i18n.t(key, vars),
    getProject: () => project,
    registry,
    onAudition: auditionPitch,
    onStatus: (status) => shell?.setPatternStatus(status),
  });
  return true;
}

function mountShell(activeTab = 'pattern') {
  shell = createShell({
    root: document.getElementById('app'),
    t: (key, vars) => i18n.t(key, vars),
    registry,
    palette,
    store,
    build: buildInfo,
    renderView: renderWorkspace,
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
      return;
    }
    if (event.code === 'Space' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      if (event.target.closest?.('input, textarea, button, [role="tab"], [contenteditable="true"]')) return;
      event.preventDefault();
      registry.execute(audio.getState().state === 'playing' ? 'playback.stop' : 'playback.play');
    }
  });
}

async function boot() {
  registerCommands();
  buildInfo = await loadBuildInfo();

  mountShell();
  syncHtmlLang();
  bindShortcuts();
  void audio.preload();

  // Hook agent: satu-satunya jalan keluar state/aksi (§9). Nggak ada AudioContext
  // atau raw storage yang di-expose lewat sini.
  window.tracker = {
    getState: () => ({
      ready: true,
      locale: i18n.getLocale(),
      theme,
      build: buildInfo,
      activeTab: shell.getActiveTab(),
      audio: audio.getState(),
      project: {
        id: project.id,
        patternId: activePattern(project).id,
        noteCount: activePattern(project).notes.length,
      },
    }),
    getProject: () => structuredClone(project),
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