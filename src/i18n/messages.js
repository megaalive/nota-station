// i18n: Indonesian jadi default, English tetap tersedia (§20.2 — user memilih
// Indonesian default pada audit R0, sebelumnya English; dicatat di changelog).
//
// Semua string UI lewat sini. Kalau ada teks yang ditulis langsung di view,
// berarti ada yang bocor dari daftar ini.

export const AVAILABLE_LOCALES = ['id', 'en'];
export const DEFAULT_LOCALE = 'id';

const messages = {
  id: {
    'app.title': 'NotaStation',
    'app.bootFailed': 'Aplikasi gagal mulai. Cek console browser.',
    'app.needsJs': 'NotaStation butuh JavaScript untuk berjalan.',

    'tab.song': 'Song',
    'tab.pattern': 'Pattern',
    'tab.pianoRoll': 'Piano Roll',
    'tab.lyrics': 'Lirik',
    'tab.guitar': 'Gitar',
    'tab.score': 'Partitur',
    'tab.sound': 'Suara',

    'shell.workspaceTabs': 'Ruang kerja',
    'shell.leftPanel': 'Peta lagu',
    'shell.rightPanel': 'Inspector',
    'shell.dock': 'Dock',
    'shell.statusBar': 'Status',
    'shell.buildUnknown': 'build ?',
    'panel.collapse': 'Lipat {panel}',
    'panel.expand': 'Buka {panel}',
    'panel.resize': 'Ubah lebar {panel}',

    'topbar.transport': 'Transport',
    'transport.play': 'Putar',
    'transport.stop': 'Berhenti',
    'transport.loopPattern': 'Loop Pattern',
    'transport.tempoPlaceholder': '♩120 4/4 Am',

    'status.edit': 'EDIT',
    'status.audisi': 'AUDISI',
    'status.octave': 'Oktaf',
    'status.step': 'Step',
    'status.audio': 'Audio',
    'status.idle': 'siap',
    'status.notSaved': '○ Belum disimpan',
    'status.savedLocally': '● Tersimpan lokal',
    'position.barBeat': 'Bar {bar} · 00:00.0',

    'left.placeholder': 'Belum ada section.',
    'right.placeholder': 'Pilih sesuatu untuk melihat propertinya.',
    'view.placeholder': '{tab} masih kosong di R0. Isi workspace menyusul.',

    'dock.toggle': 'Dock (lipat)',
    'dock.keyboard': 'Keyboard layar',
    'dock.problems': 'Masalah',

    'cmd.palette': 'Palet perintah',
    'palette.placeholder': 'Ketik nama perintah…',
    'palette.close': 'Tutup',
    'palette.noResults': 'Tidak ada perintah yang cocok.',
    'palette.openPattern': 'Buka Pattern',
    'palette.toggleTheme': 'Ganti tema',
    'palette.exportWav': 'Export WAV',
    'palette.notAvailable': 'Belum tersedia di milestone ini.',
  },
  en: {
    'app.title': 'NotaStation',
    'app.bootFailed': 'The app could not start. Check the browser console.',
    'app.needsJs': 'NotaStation needs JavaScript to run.',

    'tab.song': 'Song',
    'tab.pattern': 'Pattern',
    'tab.pianoRoll': 'Piano Roll',
    'tab.lyrics': 'Lyrics',
    'tab.guitar': 'Guitar',
    'tab.score': 'Score',
    'tab.sound': 'Sound',

    'shell.workspaceTabs': 'Workspace',
    'shell.leftPanel': 'Song map',
    'shell.rightPanel': 'Inspector',
    'shell.dock': 'Dock',
    'shell.statusBar': 'Status',
    'shell.buildUnknown': 'build ?',
    'panel.collapse': 'Collapse {panel}',
    'panel.expand': 'Expand {panel}',
    'panel.resize': 'Resize {panel}',

    'topbar.transport': 'Transport',
    'transport.play': 'Play',
    'transport.stop': 'Stop',
    'transport.loopPattern': 'Loop Pattern',
    'transport.tempoPlaceholder': '♩120 4/4 Am',

    'status.edit': 'EDIT',
    'status.audisi': 'AUDISI',
    'status.octave': 'Octave',
    'status.step': 'Step',
    'status.audio': 'Audio',
    'status.idle': 'ready',
    'status.notSaved': '○ Not saved',
    'status.savedLocally': '● Saved locally',
    'position.barBeat': 'Bar {bar} · 00:00.0',

    'left.placeholder': 'No sections yet.',
    'right.placeholder': 'Select something to see its properties.',
    'view.placeholder': '{tab} is still empty in R0. Workspace content comes later.',

    'dock.toggle': 'Dock (fold)',
    'dock.keyboard': 'On-screen keyboard',
    'dock.problems': 'Problems',

    'cmd.palette': 'Command palette',
    'palette.placeholder': 'Type a command…',
    'palette.close': 'Close',
    'palette.noResults': 'No matching command.',
    'palette.openPattern': 'Open Pattern',
    'palette.toggleTheme': 'Toggle theme',
    'palette.exportWav': 'Export WAV',
    'palette.notAvailable': 'Not available in this milestone yet.',
  },
};

export function translate(locale, key, vars) {
  const template = messages[locale]?.[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  // Placeholder yang tidak ada isinya dibiarkan utuh — lebih gampang dirapikan
  // daripada tampil sebagai "undefined" di UI.
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}

export function createI18n(locale = DEFAULT_LOCALE) {
  let current = AVAILABLE_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  const listeners = new Set();

  function t(key, vars) {
    return translate(current, key, vars);
  }

  return {
    t,
    getLocale: () => current,
    setLocale(next) {
      if (!AVAILABLE_LOCALES.includes(next)) return false;
      current = next;
      for (const fn of listeners) fn(current);
      return true;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    availableLocales: () => [...AVAILABLE_LOCALES],
  };
}