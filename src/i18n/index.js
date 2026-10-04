// i18n: Indonesian sama-sama prepared, tapi default-nya English (§20.2: user pilih English default).
// Semua string UI lewat sini — nggak ada teks yang ditulis langsung di view.

export const AVAILABLE_LOCALES = ['en', 'id'];
export const DEFAULT_LOCALE = 'en';

const messages = {
  en: {
    'app.title': 'NotaStation',
    'app.bootFailed': 'The app could not start. Check the browser console.',
    'shell.workspaceTabs': 'Workspace',
    'shell.leftPanel': 'Song map',
    'shell.rightPanel': 'Inspector',
    'shell.dock': 'Dock',
    'shell.statusBar': 'Status',
    'shell.buildUnknown': 'build ?',
    'shell.sectionCount': '{count} sections',
    'status.edit': 'EDIT',
    'status.audisi': 'AUDISI',
    'cmd.palette': 'Command palette',
  },
  id: {
    'app.title': 'NotaStation',
    'app.bootFailed': 'Aplikasi gagal start. Cek console browser.',
    'shell.workspaceTabs': 'Ruang kerja',
    'shell.leftPanel': 'Peta lagu',
    'shell.rightPanel': 'Inspector',
    'shell.dock': 'Dock',
    'shell.statusBar': 'Status',
    'shell.buildUnknown': 'build ?',
    'shell.sectionCount': '{count} bagian',
    'status.edit': 'EDIT',
    'status.audisi': 'AUDISI',
    'cmd.palette': 'Palet perintah',
  },
};

export function createI18n(locale = DEFAULT_LOCALE) {
  let current = AVAILABLE_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
  const listeners = new Set();

  function t(key, vars) {
    // Fallback ke English dulu sebelum nyerah: kalau ada locale yang belum lengkap,
    // user nggak lihat string kosong.
    const template = messages[current][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.hasOwn(vars, name) ? String(vars[name]) : match,
    );
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