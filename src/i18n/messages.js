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
    'transport.pause': 'Jeda',
    'transport.stop': 'Berhenti',
    'transport.loopPattern': 'Loop Pattern',
    'transport.metronome': 'Metronom',
    'transport.seek': 'Posisi Pattern',
    'transport.tempo': 'Tempo',
    'transport.tempoUnit': 'BPM',
    'transport.tempoInvalid': 'Tempo harus 20–300 BPM.',
    'transport.tempoPlaceholder': '♩120 4/4 Am',

    'status.edit': 'EDIT',
    'status.audisi': 'AUDISI',
    'status.octave': 'Oktaf',
    'status.step': 'Step',
    'status.audio': 'Audio',
    'status.idle': 'siap',
    'status.audioLocked': 'terkunci',
    'status.audioReady': 'siap',
    'status.audioPlaying': 'bermain',
    'status.audioPaused': 'jeda',
    'status.audioError': 'galat',
    'status.notSaved': '○ Belum disimpan',
    'status.savedLocally': '● Tersimpan lokal',
    'position.barBeat': 'Bar {bar} · 00:00.0',
    'position.row': 'Baris {row}',

    'left.placeholder': 'Belum ada section.',
    'right.placeholder': 'Pilih sesuatu untuk melihat propertinya.',
    'view.placeholder': '{tab} belum tersedia di milestone ini.',
    'pattern.gridLabel': 'Editor Pattern',
    'pattern.enterNote': 'Tulis nada',
    'pattern.deleteNote': 'Hapus event',
    'pattern.updateNote': 'Ubah field event',
    'pattern.columnNote': 'NOTE',
    'pattern.columnInstrument': 'INST',
    'pattern.columnVolume': 'VOL',
    'pattern.hintAudition': 'Z mengaudisi C · Ctrl+E untuk EDIT',
    'pattern.hintEdit': 'Z=C · Del hapus · Ctrl+Z Undo',
    'pattern.hintInstrument': 'Ketik 2 digit hex untuk INST · valid 01–{max}',
    'pattern.hintVolume': 'Ketik 2 digit hex untuk VOL · valid 00–7F',
    'pattern.hintNeedsNote': 'Isi NOTE lebih dulu sebelum mengubah INST/VOL.',
    'pattern.invalidInstrument': 'Instrument {value} tidak tersedia.',
    'pattern.invalidVolume': 'Volume {value} di luar 00–7F.',
    'pattern.octaveDown': 'Turunkan oktaf',
    'pattern.octaveUp': 'Naikkan oktaf',
    'pattern.stepDown': 'Kurangi step',
    'pattern.stepUp': 'Tambah step',
    'history.undo': 'Undo',
    'history.redo': 'Redo',
    'history.nothingUndo': 'Belum ada edit untuk di-undo.',
    'history.nothingRedo': 'Belum ada edit untuk di-redo.',

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
    'palette.requiresContext': 'Jalankan dari konteks editor.',
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
    'transport.pause': 'Pause',
    'transport.stop': 'Stop',
    'transport.loopPattern': 'Loop Pattern',
    'transport.metronome': 'Metronome',
    'transport.seek': 'Pattern position',
    'transport.tempo': 'Tempo',
    'transport.tempoUnit': 'BPM',
    'transport.tempoInvalid': 'Tempo must be 20–300 BPM.',
    'transport.tempoPlaceholder': '♩120 4/4 Am',

    'status.edit': 'EDIT',
    'status.audisi': 'AUDISI',
    'status.octave': 'Octave',
    'status.step': 'Step',
    'status.audio': 'Audio',
    'status.idle': 'ready',
    'status.audioLocked': 'locked',
    'status.audioReady': 'ready',
    'status.audioPlaying': 'playing',
    'status.audioPaused': 'paused',
    'status.audioError': 'error',
    'status.notSaved': '○ Not saved',
    'status.savedLocally': '● Saved locally',
    'position.barBeat': 'Bar {bar} · 00:00.0',
    'position.row': 'Row {row}',

    'left.placeholder': 'No sections yet.',
    'right.placeholder': 'Select something to see its properties.',
    'view.placeholder': '{tab} is not available in this milestone yet.',
    'pattern.gridLabel': 'Pattern editor',
    'pattern.enterNote': 'Enter note',
    'pattern.deleteNote': 'Delete event',
    'pattern.updateNote': 'Update event field',
    'pattern.columnNote': 'NOTE',
    'pattern.columnInstrument': 'INST',
    'pattern.columnVolume': 'VOL',
    'pattern.hintAudition': 'Z auditions C · Ctrl+E for EDIT',
    'pattern.hintEdit': 'Z=C · Del deletes · Ctrl+Z Undo',
    'pattern.hintInstrument': 'Type 2 hex digits for INST · valid 01–{max}',
    'pattern.hintVolume': 'Type 2 hex digits for VOL · valid 00–7F',
    'pattern.hintNeedsNote': 'Enter NOTE first before changing INST/VOL.',
    'pattern.invalidInstrument': 'Instrument {value} is not available.',
    'pattern.invalidVolume': 'Volume {value} is outside 00–7F.',
    'pattern.octaveDown': 'Lower octave',
    'pattern.octaveUp': 'Raise octave',
    'pattern.stepDown': 'Decrease step',
    'pattern.stepUp': 'Increase step',
    'history.undo': 'Undo',
    'history.redo': 'Redo',
    'history.nothingUndo': 'There is no edit to undo yet.',
    'history.nothingRedo': 'There is no edit to redo yet.',

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
    'palette.requiresContext': 'Run this from the editor context.',
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