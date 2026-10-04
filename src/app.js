// Entry point aplikasi. Yang penting di R0: boot tanpa galat console, semua path relatif,
// dan window.tracker tersedia buat agent (§9).

import { createI18n, DEFAULT_LOCALE } from './i18n/index.js';
import { createCommandRegistry } from './core/commands.js';

const i18n = createI18n(readInitialLocale());
const registry = createCommandRegistry();

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
  return stored || navigator.language?.split('-')[0] || DEFAULT_LOCALE;
}

function setLocale(next) {
  if (!i18n.setLocale(next)) return false;
  window.localStorage?.setItem('notastation.locale', next);
  document.documentElement.lang = next;
  render();
  return true;
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;
  root.textContent = '';
  const heading = document.createElement('h1');
  heading.textContent = i18n.t('app.title');
  const placeholder = document.createElement('p');
  placeholder.dataset.action = 'shell-placeholder';
  placeholder.textContent = `${i18n.t('shell.workspaceTabs')} — ${i18n.t('shell.buildUnknown')}`;
  root.append(heading, placeholder);
}

async function boot() {
  // `lang` di <html> ngikutin locale awal juga, bukan cuma pas user ganti locale —
  // screen reader dan ::lang() selector butuh nyambung dari frame pertama.
  document.documentElement.lang = i18n.getLocale();
  render();
  const build = await loadBuildInfo();
  const placeholder = document.querySelector('[data-action="shell-placeholder"]');
  if (placeholder) {
    placeholder.textContent =
      `${i18n.t('shell.workspaceTabs')} — ${build?.version ?? i18n.t('shell.buildUnknown')}`;
  }

  // Hook agent: satu-satunya jalan keluar state/aksi (§9). Nggak ada AudioContext
  // atau raw storage yang di-expose lewat sini.
  window.tracker = {
    getState: () => ({ ready: true, locale: i18n.getLocale(), build }),
    commands: registry,
    setLocale,
    i18n,
  };
}

boot().catch((err) => {
  const root = document.getElementById('app');
  if (root) root.textContent = i18n.t('app.bootFailed');
  // eslint-disable-next-line no-console -- boot gagal itu harus kelihatan di console juga
  console.error('[NotaStation] boot gagal:', err);
});