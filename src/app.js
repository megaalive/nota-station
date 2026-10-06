// Entry point aplikasi. R0 menyediakan shell/command layer; R1 mulai menambahkan
// model Pattern dan audio tanpa membocorkan state mentah ke view/agent.

import { createI18n, DEFAULT_LOCALE } from './i18n/messages.js';
import { commandError, createCommandRegistry } from './core/commands.js';
import { createHistory } from './core/history.js';
import { createFocusStore, patternForFocus } from './core/focus.js';
import { createSharedPatternGuard } from './core/shared-pattern-guard.js';
import {
  addSection,
  assignOrderEntrySection,
  createSectionOccurrence,
  insertOrderEntry,
  makeOrderEntryUnique,
  moveOrderEntry,
} from './core/arrangement.js';
import { createTemplateProject } from './core/templates.js';
import { createDemoProject, STABILITY_DEMO_ID } from './core/demos.js';
import {
  configureDrumTrack,
  createBlankProject,
  deleteNote,
  deleteVoiceNote,
  deleteVoiceRow,
  enterNote,
  enterVoiceNote,
  setInitialTempo,
  updateNoteAtCell,
} from './core/project.js';
import { createAudioEngine } from './audio/engine.js';
import {
  createProjectSampleBytesLoader,
} from './audio/sample-buffer-cache.js';
import {
  setTrackDefaultInstrument,
  updateSingleSampleInstrument,
} from './core/sound-edit.js';
import { isDrumKitInstrument } from './core/sound-model.js';
import { applyPreparedWavImport } from './core/sample-import.js';
import {
  prepareWavImport,
  persistPreparedWavImport,
} from './io/wav-import.js';
import { summarizeWavWaveform } from './io/wav-waveform.js';
import { openSampleStore } from './storage/sample-store.js';
import {
  restoreSessionProject,
  saveSessionProject,
} from './storage/session-project.js';
import {
  restoreSessionFocus,
  saveSessionFocus,
} from './storage/session-focus.js';
import {
  restoreSessionSharedPatternGuard,
  saveSessionSharedPatternGuard,
} from './storage/session-shared-pattern.js';
import {
  debugJsonFilename,
  parseDebugProject,
  serializeDebugProject,
} from './io/debug-json.js';
import { Toast } from './ui/kit.js';
import { createPalette } from './ui/palette.js';
import { createPatternView } from './ui/pattern.js';
import { createSoundView } from './ui/sound.js';
import { createSongView } from './ui/song.js';
import { createShell } from './ui/shell.js';
import { createWelcome } from './ui/welcome.js';

const i18n = createI18n(readInitialLocale());
const registry = createCommandRegistry();
const store = window.localStorage;
const THEMES = ['light', 'dark', 'high-contrast'];
const KEYMAPS = ['songwriter', 'openmpt'];
const WELCOME_COMPLETED_KEY = 'notastation.welcome.completed';
const KEYMAP_STORAGE_KEY = 'notastation.keymapPreset';
let sampleStorePromise = null;
const waveformCache = new Map();

function getSampleStore() {
  if (!sampleStorePromise) {
    sampleStorePromise = openSampleStore().catch((error) => {
      sampleStorePromise = null;
      throw error;
    });
  }
  return sampleStorePromise;
}

async function loadSampleWaveform(sampleId) {
  const sample = project.samples.find((item) => item.id === sampleId);
  if (!sample) {
    throw commandError('E_SAMPLE_NOT_FOUND', `Sample tidak dikenal: ${sampleId}`);
  }
  if (waveformCache.has(sample.contentHash)) return waveformCache.get(sample.contentHash);

  const loader = sample.storageRef?.kind === 'indexeddb'
    ? createProjectSampleBytesLoader({ sampleStore: await getSampleStore() })
    : createProjectSampleBytesLoader();
  const bytes = await loader(sample);
  const summary = summarizeWavWaveform(bytes, { bins: 128 });
  waveformCache.set(sample.contentHash, summary);
  return summary;
}

let theme = readInitialTheme();
let buildInfo = null;
let sessionProjectState = Object.freeze({
  restored: false,
  saved: false,
  bytes: 0,
  errorCode: null,
});
const history = createHistory(loadInitialProject());
let project = history.current();
const focus = createFocusStore(loadInitialFocus());
focus.reconcile(project);
persistSessionFocusState();
const sharedPatternGuard = createSharedPatternGuard(loadInitialSharedPatternGuard());
sharedPatternGuard.reconcile(project);
persistSessionSharedPatternGuardState();
let shell = null;
let songView = null;
let patternView = null;
let soundView = null;
const transportState = {
  loopPattern: true,
  metronome: false,
};
const audio = createAudioEngine({
  onStateChange: () => syncTransportUi(),
  onPositionChange: () => syncTransportUi(),
  getSampleStore,
});
audio.setTracks(project.song.tracks);

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

function readInitialKeymap() {
  const stored = store?.getItem(KEYMAP_STORAGE_KEY);
  return KEYMAPS.includes(stored) ? stored : 'songwriter';
}

function applyProjectPreferences(nextProject, {
  locale = i18n.getLocale(),
  keymap = readInitialKeymap(),
} = {}) {
  if (!KEYMAPS.includes(keymap)) {
    throw commandError('E_KEYMAP_UNKNOWN', `Preset keymap tidak dikenal: ${keymap}`);
  }
  return {
    ...nextProject,
    settings: {
      ...nextProject.settings,
      language: locale,
      keymapPreset: keymap,
      theme,
    },
  };
}

function loadInitialProject() {
  let restored = null;
  try {
    restored = restoreSessionProject();
  } catch (error) {
    // Snapshot sesi yang rusak tidak boleh membuat aplikasi gagal boot. Modul storage
    // sudah membuang snapshot invalid; kita fallback ke project kosong yang valid.
    sessionProjectState = Object.freeze({
      restored: false,
      saved: false,
      bytes: 0,
      errorCode: error?.code ?? 'E_SESSION_PROJECT_RESTORE',
    });
  }

  if (restored) {
    sessionProjectState = Object.freeze({
      restored: true,
      saved: true,
      bytes: new TextEncoder().encode(serializeDebugProject(restored)).byteLength,
      errorCode: null,
    });
  }

  return applyProjectPreferences(restored ?? createBlankProject(), {
    locale: i18n.getLocale(),
    keymap: readInitialKeymap(),
  });
}

function persistSessionProjectSnapshot() {
  try {
    const result = saveSessionProject(project);
    sessionProjectState = Object.freeze({
      restored: sessionProjectState.restored,
      saved: result.saved,
      bytes: result.bytes,
      errorCode: null,
    });
    return result;
  } catch (error) {
    // Edit tetap sah walau browser menolak sessionStorage (quota/privacy mode).
    // Persistence sesi hanya recovery untuk reload R2, bukan sumber kebenaran project.
    sessionProjectState = Object.freeze({
      restored: sessionProjectState.restored,
      saved: false,
      bytes: 0,
      errorCode: error?.code ?? 'E_SESSION_PROJECT_SAVE',
    });
    return Object.freeze({ saved: false, reason: 'error', bytes: 0 });
  }
}

function loadInitialFocus() {
  try {
    return restoreSessionFocus() ?? {};
  } catch {
    // Focus cuma state UI. Snapshot rusak tidak boleh menghalangi project yang valid.
    return {};
  }
}

function persistSessionFocusState() {
  try {
    return saveSessionFocus(focus.getState());
  } catch {
    // Privacy mode/quota tidak boleh membuat navigasi occurrence gagal.
    return Object.freeze({ saved: false, reason: 'error' });
  }
}

function reconcileFocus() {
  const before = focus.getState().orderEntryId;
  const state = focus.reconcile(project);
  if (state.orderEntryId !== before) persistSessionFocusState();
  return state;
}

function loadInitialSharedPatternGuard() {
  try {
    return restoreSessionSharedPatternGuard() ?? {};
  } catch {
    // Keputusan warning bersifat UI-session; payload rusak tidak boleh menghalangi project.
    return {};
  }
}

function persistSessionSharedPatternGuardState() {
  try {
    return saveSessionSharedPatternGuard(sharedPatternGuard.getState());
  } catch {
    // Privacy mode/quota tidak boleh membuat editing Pattern gagal.
    return Object.freeze({ saved: false, reason: 'error' });
  }
}

function reconcileSharedPatternGuard() {
  const before = JSON.stringify(sharedPatternGuard.getState().allowedPatternIds);
  const state = sharedPatternGuard.reconcile(project);
  if (JSON.stringify(state.allowedPatternIds) !== before) {
    persistSessionSharedPatternGuardState();
  }
  return state;
}

function requirePatternEditAllowed(args) {
  const patternId = String(args?.patternId ?? '');
  const decision = sharedPatternGuard.inspect(project, patternId);
  if (!decision.required) return decision;

  const focusedOrderId = focus.getState().orderEntryId;
  const focusedEntry = project.song.order.find((entry) => entry.id === focusedOrderId);
  const orderEntryId = focusedEntry?.patternId === patternId
    ? focusedEntry.id
    : project.song.order.find((entry) => entry.patternId === patternId)?.id ?? null;

  const error = commandError(
    'E_SHARED_PATTERN_DECISION_REQUIRED',
    i18n.t('pattern.sharedWarning', {
      pattern: decision.patternName,
      count: decision.usage,
    }),
  );
  error.details = Object.freeze({
    ...decision,
    orderEntryId,
  });
  throw error;
}

function focusedPattern(currentProject = project) {
  return patternForFocus(currentProject, focus.getState());
}

function setFocusedOrderEntry(orderEntryId) {
  const beforePatternId = focusedPattern(project).id;
  const previousOrderId = focus.getState().orderEntryId;
  const state = focus.setOrderEntry(project, orderEntryId);
  if (state.orderEntryId === previousOrderId) return state;

  persistSessionFocusState();
  const nextPatternId = focusedPattern(project).id;
  if (beforePatternId !== nextPatternId && audio.getState().state === 'playing') {
    audio.stop();
    Toast({ message: i18n.t('song.focusStoppedPlayback') });
  }

  syncTransportUi();
  songView?.refresh();
  patternView?.refresh();
  return state;
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
      id: 'playback.activateAudio',
      group: 'Playback',
      labelKey: 'audio.activate',
      run: () => activateAudio(),
    },
    {
      id: 'playback.pause',
      group: 'Playback',
      labelKey: 'transport.pause',
      run: () => audio.pause(),
    },
    {
      id: 'playback.stop',
      group: 'Playback',
      labelKey: 'transport.stop',
      run: () => {
        audio.stop();
        return 'stop';
      },
    },
    {
      id: 'playback.toggleLoop',
      group: 'Playback',
      labelKey: 'transport.loopPattern',
      run: () => {
        transportState.loopPattern = !transportState.loopPattern;
        audio.setLoop(project, focusedPattern(project), transportState.loopPattern);
        syncTransportUi();
        return transportState.loopPattern;
      },
    },
    {
      id: 'playback.toggleMetronome',
      group: 'Playback',
      labelKey: 'transport.metronome',
      run: () => {
        transportState.metronome = !transportState.metronome;
        audio.setMetronome(project, focusedPattern(project), transportState.metronome);
        syncTransportUi();
        return transportState.metronome;
      },
    },
    {
      id: 'audio.toggleTrackMute',
      group: 'Mixer',
      labelKey: 'audio.trackMute',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('audio.toggleTrackMute', args);
        const trackId = String(args.trackId ?? '');
        if (!project.song.tracks.some((track) => track.id === trackId)) {
          throw commandError('E_TRACK_NOT_FOUND', `Track tidak dikenal: ${trackId}`);
        }
        const result = audio.toggleTrackMute(trackId);
        syncTransportUi();
        return result;
      },
    },
    {
      id: 'audio.toggleTrackSolo',
      group: 'Mixer',
      labelKey: 'audio.trackSolo',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('audio.toggleTrackSolo', args);
        const trackId = String(args.trackId ?? '');
        if (!project.song.tracks.some((track) => track.id === trackId)) {
          throw commandError('E_TRACK_NOT_FOUND', `Track tidak dikenal: ${trackId}`);
        }
        const result = audio.toggleTrackSolo(trackId);
        syncTransportUi();
        return result;
      },
    },
    {
      id: 'playback.seek',
      group: 'Playback',
      labelKey: 'transport.seek',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('playback.seek', args);
        return audio.seek(project, focusedPattern(project), Number(args.tick));
      },
    },
    {
      id: 'project.loadTemplate',
      group: 'Project',
      labelKey: 'project.loadTemplate',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('project.loadTemplate', args);
        return loadTemplateProject(args.templateId, {
          locale: args.locale ?? i18n.getLocale(),
          keymap: args.keymap ?? readInitialKeymap(),
        });
      },
    },
    {
      id: 'project.loadDemo',
      group: 'Project',
      labelKey: 'project.loadDemo',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('project.loadDemo', args);
        return loadDemoProject(args.demoId, {
          locale: args.locale ?? i18n.getLocale(),
          keymap: args.keymap ?? readInitialKeymap(),
        });
      },
    },
    {
      id: 'song.setTempo',
      group: 'Song',
      labelKey: 'transport.tempo',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('song.setTempo', args);
        commitProject(setInitialTempo(project, Number(args.tempo)), 'song.setTempo');
        audio.setTempo(project, focusedPattern(project));
        syncTransportUi();
        return { tempo: project.song.initial.tempo };
      },
    },
    {
      id: 'song.createSectionOccurrence',
      group: 'Song',
      labelKey: 'song.addSection',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('song.createSectionOccurrence', args);
        const afterOrderEntryId = String(
          args.afterOrderEntryId ?? focus.getState().orderEntryId ?? '',
        );
        const afterIndex = project.song.order.findIndex(
          (entry) => entry.id === afterOrderEntryId,
        );
        if (afterIndex < 0) {
          throw commandError(
            'E_PROJECT_ORDER_MISSING',
            `OrderEntry tidak dikenal: ${afterOrderEntryId}`,
          );
        }

        const sourcePatternId = String(
          args.sourcePatternId ?? project.song.order[afterIndex].patternId,
        );
        const nextProject = createSectionOccurrence(project, {
          name: args.name,
          color: args.color,
          patternMode: String(args.patternMode ?? 'reuse'),
          sourcePatternId,
          index: afterIndex + 1,
        });
        const section = nextProject.song.sections[nextProject.song.sections.length - 1];
        const entry = nextProject.song.order[afterIndex + 1];
        commitProject(nextProject, 'song.createSectionOccurrence');
        return {
          section: structuredClone(section),
          orderEntryId: entry.id,
          patternId: entry.patternId,
          index: afterIndex + 1,
        };
      },
    },
    {
      id: 'song.addSection',
      group: 'Song',
      labelKey: 'song.addSection',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('song.addSection', args);
        const nextProject = addSection(project, {
          name: args.name,
          color: args.color,
        });
        const section = nextProject.song.sections[nextProject.song.sections.length - 1];
        commitProject(nextProject, 'song.addSection');
        return structuredClone(section);
      },
    },
    {
      id: 'song.assignSection',
      group: 'Song',
      labelKey: 'song.assignSection',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('song.assignSection', args);
        const orderEntryId = String(args.orderEntryId ?? '');
        const sectionId = args.sectionId === null ? null : String(args.sectionId ?? '');
        const nextProject = assignOrderEntrySection(project, {
          orderEntryId,
          sectionId,
        });
        const changed = nextProject !== project;
        commitProject(nextProject, 'song.assignSection');
        return { orderEntryId, sectionId, changed };
      },
    },
    {
      id: 'focus.setOrderEntry',
      group: 'Song',
      labelKey: 'song.focusOrder',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('focus.setOrderEntry', args);
        return setFocusedOrderEntry(String(args.orderEntryId ?? ''));
      },
    },
    {
      id: 'song.reuseOrderEntry',
      group: 'Song',
      labelKey: 'song.reuse',
      shortcut: 'Ctrl+D',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('song.reuseOrderEntry', args);
        const orderEntryId = String(args.orderEntryId ?? '');
        const index = project.song.order.findIndex((entry) => entry.id === orderEntryId);
        if (index < 0) {
          throw commandError(
            'E_PROJECT_ORDER_MISSING',
            `OrderEntry tidak dikenal: ${orderEntryId}`,
          );
        }

        const source = project.song.order[index];
        const nextProject = insertOrderEntry(project, {
          patternId: source.patternId,
          index: index + 1,
          sectionId: source.sectionId ?? null,
          keyOverride: source.keyOverride ?? null,
        });
        const inserted = nextProject.song.order[index + 1];
        commitProject(nextProject, 'song.reuseOrderEntry');
        return {
          orderEntryId: inserted.id,
          patternId: inserted.patternId,
          index: index + 1,
        };
      },
    },
    {
      id: 'song.makeOrderUnique',
      group: 'Song',
      labelKey: 'song.makeUnique',
      shortcut: 'Ctrl+Shift+D',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('song.makeOrderUnique', args);
        const orderEntryId = String(args.orderEntryId ?? '');
        const nextProject = makeOrderEntryUnique(project, { orderEntryId });
        const changed = nextProject !== project;
        commitProject(nextProject, 'song.makeOrderUnique');
        const entry = project.song.order.find((item) => item.id === orderEntryId);
        return {
          orderEntryId,
          patternId: entry?.patternId ?? null,
          changed,
        };
      },
    },
    {
      id: 'song.moveOrderEntry',
      group: 'Song',
      labelKey: 'song.moveOrder',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('song.moveOrderEntry', args);
        const orderEntryId = String(args.orderEntryId ?? '');
        const toIndex = Number(args.toIndex);
        const nextProject = moveOrderEntry(project, { orderEntryId, toIndex });
        const changed = nextProject !== project;
        commitProject(nextProject, 'song.moveOrderEntry');
        return { orderEntryId, toIndex, changed };
      },
    },
    {
      id: 'pattern.allowSharedEdit',
      group: 'Pattern',
      labelKey: 'pattern.sharedEditAll',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('pattern.allowSharedEdit', args);
        const patternId = String(args.patternId ?? '');
        const state = sharedPatternGuard.allowEditAll(patternId);
        persistSessionSharedPatternGuardState();
        patternView?.refresh();
        return state;
      },
    },
    {
      id: 'pattern.enterNote',
      group: 'Pattern',
      labelKey: 'pattern.enterNote',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('pattern.enterNote', args);
        requirePatternEditAllowed(args);
        commitPatternProject(enterNote(project, args), 'pattern.enterNote');
        return { noteCount: focusedPattern(project).notes.length };
      },
    },
    {
      id: 'pattern.enterVoiceNote',
      group: 'Pattern',
      labelKey: 'pattern.enterDrumHit',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('pattern.enterVoiceNote', args);
        requirePatternEditAllowed(args);
        commitPatternProject(enterVoiceNote(project, args), 'pattern.enterVoiceNote');
        return { noteCount: focusedPattern(project).notes.length };
      },
    },
    {
      id: 'pattern.deleteVoiceNote',
      group: 'Pattern',
      labelKey: 'pattern.deleteDrumHit',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('pattern.deleteVoiceNote', args);
        requirePatternEditAllowed(args);
        const before = project;
        commitPatternProject(deleteVoiceNote(project, args), 'pattern.deleteVoiceNote');
        return {
          changed: project !== before,
          noteCount: focusedPattern(project).notes.length,
        };
      },
    },
    {
      id: 'pattern.clearVoiceRow',
      group: 'Pattern',
      labelKey: 'pattern.clearDrumRow',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('pattern.clearVoiceRow', args);
        requirePatternEditAllowed(args);
        const before = project;
        commitPatternProject(deleteVoiceRow(project, args), 'pattern.clearVoiceRow');
        return {
          changed: project !== before,
          noteCount: focusedPattern(project).notes.length,
        };
      },
    },
    {
      id: 'pattern.deleteNote',
      group: 'Pattern',
      labelKey: 'pattern.deleteNote',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('pattern.deleteNote', args);
        requirePatternEditAllowed(args);
        const before = project;
        commitPatternProject(deleteNote(project, args), 'pattern.deleteNote');
        return {
          changed: project !== before,
          noteCount: focusedPattern(project).notes.length,
        };
      },
    },
    {
      id: 'pattern.updateNote',
      group: 'Pattern',
      labelKey: 'pattern.updateNote',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('pattern.updateNote', args);
        requirePatternEditAllowed(args);
        const before = project;
        commitPatternProject(updateNoteAtCell(project, args), 'pattern.updateNote');
        return {
          changed: project !== before,
          noteCount: focusedPattern(project).notes.length,
        };
      },
    },
    {
      id: 'history.undo',
      group: 'Edit',
      labelKey: 'history.undo',
      shortcut: 'Ctrl+Z',
      isEnabled: () => history.getState().canUndo,
      disabledReason: () => i18n.t('history.nothingUndo'),
      run: () => restoreHistory('undo'),
    },
    {
      id: 'history.redo',
      group: 'Edit',
      labelKey: 'history.redo',
      shortcut: 'Ctrl+Y',
      isEnabled: () => history.getState().canRedo,
      disabledReason: () => i18n.t('history.nothingRedo'),
      run: () => restoreHistory('redo'),
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
      id: 'track.setDefaultInstrument',
      group: 'Sound',
      labelKey: 'sound.setTrackInstrument',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('track.setDefaultInstrument', args);
        const trackId = String(args.trackId ?? '');
        const instrumentId = String(args.instrumentId ?? '');
        const instrument = project.instruments.find((item) => item.id === instrumentId);
        if (!instrument) {
          throw commandError('E_SOUND_EDIT_INSTRUMENT', `Instrument tidak dikenal: ${instrumentId}`);
        }
        const nextProject = isDrumKitInstrument(instrument)
          ? configureDrumTrack(project, { trackId, instrumentId })
          : setTrackDefaultInstrument(project, { trackId, instrumentId });
        const changed = nextProject !== project;
        commitProject(nextProject, 'track.setDefaultInstrument');
        return { trackId, instrumentId, changed };
      },
    },
    {
      id: 'sound.updateInstrument',
      group: 'Sound',
      labelKey: 'sound.apply',
      requiresArgs: true,
      run: (args) => {
        requireCommandArgs('sound.updateInstrument', args);
        const instrumentId = String(args.instrumentId ?? '');
        const instrument = project.instruments.find((item) => item.id === instrumentId);
        if (!instrument) {
          throw commandError('E_SOUND_EDIT_INSTRUMENT', `Instrument tidak dikenal: ${instrumentId}`);
        }

        const nextProject = updateSingleSampleInstrument(project, args);
        commitProject(nextProject, 'sound.updateInstrument');
        return {
          instrumentId,
          instrumentName: instrument.name,
        };
      },
    },
    {
      id: 'io.importWav',
      group: 'File',
      labelKey: 'sound.importWav',
      requiresArgs: true,
      run: async (args) => {
        requireCommandArgs('io.importWav', args);
        const trackId = String(args.trackId ?? '');
        const sourceFilename = String(args.sourceFilename ?? '');
        const bytes = args.bytes;
        const track = project.song.tracks.find((item) => item.id === trackId);
        if (!track) {
          throw commandError('E_TRACK_NOT_FOUND', `Track tidak dikenal: ${trackId}`);
        }

        const beforeProject = project;
        const prepared = await prepareWavImport(project, {
          bytes,
          sourceFilename,
        });
        const sampleStore = await getSampleStore();
        const persisted = await persistPreparedWavImport(prepared, bytes, sampleStore);

        if (project !== beforeProject) {
          throw commandError(
            'E_IMPORT_STALE_PROJECT',
            'Project berubah ketika WAV sedang diproses. Ulangi import pada state terbaru.',
          );
        }

        const applied = applyPreparedWavImport(project, persisted, { trackId });
        commitProject(applied.project, 'io.importWav');

        return {
          sampleAdded: applied.sampleAdded,
          sampleId: applied.sampleId,
          instrumentId: applied.instrumentId,
          instrumentName: persisted.instrument.name,
          trackId,
          trackName: track.name,
          duplicateSampleId: persisted.duplicateSampleId,
          storageInserted: persisted.storage.inserted,
        };
      },
    },
    {
      id: 'io.exportDebugJson',
      group: 'File',
      labelKey: 'io.exportDebugJson',
      run: (args) => exportDebugJson({ download: args?.download !== false }),
    },
    {
      id: 'io.importDebugJson',
      group: 'File',
      labelKey: 'io.importDebugJson',
      run: (args) => {
        if (typeof args?.text === 'string') return importDebugJsonText(args.text);
        openDebugJsonPicker();
        return { pickerOpened: true };
      },
    },
    {
      // Ekspor WAV belum masuk R1. Tetap tampil dengan alasan,
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

function exportDebugJson({ download = true } = {}) {
  const text = serializeDebugProject(project);
  const filename = debugJsonFilename(project);

  if (download) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setSaveStatus('status.jsonExported');
  }

  return { filename, text, schemaVersion: project.schemaVersion };
}

function importDebugJsonText(text) {
  // Parse + validasi selesai dulu. Kalau gagal, project/history/audio tidak disentuh.
  const nextProject = parseDebugProject(text);
  replaceProject(nextProject, 'status.jsonImported');
  return {
    projectId: project.id,
    schemaVersion: project.schemaVersion,
    noteCount: focusedPattern(project).notes.length,
  };
}

function loadTemplateProject(templateId, {
  locale = i18n.getLocale(),
  keymap = readInitialKeymap(),
} = {}) {
  const nextProject = applyProjectPreferences(createTemplateProject(templateId), { locale, keymap });
  store?.setItem(KEYMAP_STORAGE_KEY, keymap);
  replaceProject(nextProject, 'status.notSaved');
  return {
    templateId,
    projectId: project.id,
    title: project.title,
    noteCount: focusedPattern(project).notes.length,
    keymap: project.settings.keymapPreset,
  };
}

function loadDemoProject(demoId, {
  locale = i18n.getLocale(),
  keymap = readInitialKeymap(),
} = {}) {
  const nextProject = applyProjectPreferences(createDemoProject(demoId), { locale, keymap });
  replaceProject(nextProject, 'status.notSaved');
  return {
    demoId,
    projectId: project.id,
    title: project.title,
    noteCount: focusedPattern(project).notes.length,
    keymap: project.settings.keymapPreset,
  };
}

function loadDemoFromQuery() {
  const demoId = new URL(window.location.href).searchParams.get('demo');
  if (!demoId) return false;
  if (demoId !== STABILITY_DEMO_ID) return false;

  registry.execute('project.loadDemo', {
    demoId,
    locale: i18n.getLocale(),
    keymap: readInitialKeymap(),
  });
  return true;
}

function replaceProject(nextProject, statusKey) {
  audio.stop();
  history.reset(nextProject);
  project = nextProject;
  reconcileFocus();
  reconcileSharedPatternGuard();
  audio.setTracks(project.song.tracks);
  persistSessionProjectSnapshot();
  persistSessionFocusState();

  // Recreate Pattern view supaya mode awal mengikuti keymap project baru.
  const activeTab = shell?.getActiveTab() ?? 'pattern';
  mountShell(activeTab);
  setSaveStatus(statusKey);
}

function openDebugJsonPicker() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.webtrack.json,application/json';
  input.hidden = true;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) {
      input.remove();
      return;
    }
    try {
      importDebugJsonText(await file.text());
    } catch {
      setSaveStatus('status.jsonImportFailed');
    } finally {
      input.remove();
    }
  }, { once: true });
  document.body.append(input);
  input.click();
}

function syncTransportUi() {
  const pattern = focusedPattern(project);
  const audioState = audio.getState();
  shell?.setAudioStatus(audioState.state);
  shell?.setTransportStatus({
    tempo: project.song.initial.tempo,
    meter: project.song.initial.meter,
    loopPattern: transportState.loopPattern,
    metronome: transportState.metronome,
    audioState: audioState.state,
    positionTick: audioState.positionTick,
    lengthTicks: pattern.lengthTicks,
    rowTicks: pattern.rowTicks,
  });
  patternView?.setPlaybackState(audioState);
}


function requireCommandArgs(id, args) {
  if (!args || typeof args !== 'object') {
    throw commandError('E_CMD_ARGS_REQUIRED', `${id} membutuhkan argumen konteks editor.`);
  }
}

function commitProject(nextProject, label) {
  if (nextProject === project) return project;

  project = history.commit(nextProject, label);
  reconcileFocus();
  reconcileSharedPatternGuard();
  persistSessionProjectSnapshot();
  setSaveStatus('status.notSaved');
  syncTransportUi();
  songView?.refresh();
  patternView?.refresh();
  soundView?.refresh();
  return project;
}

function commitPatternProject(nextProject, label) {
  const before = project;
  commitProject(nextProject, label);
  if (project !== before) {
    audio.reschedulePattern(project, focusedPattern(project));
  }
  return project;
}

function undoSoundEdit(expectedLabel) {
  if (history.getState().undoLabel !== expectedLabel) {
    return { changed: false, reason: 'history-moved' };
  }
  restoreHistory('undo');
  return { changed: true };
}

function restoreHistory(direction) {
  const nextProject = direction === 'undo' ? history.undo() : history.redo();
  if (!nextProject) return history.getState();

  const previous = project;
  project = nextProject;
  reconcileFocus();
  reconcileSharedPatternGuard();
  persistSessionProjectSnapshot();
  setSaveStatus('status.notSaved');

  if (previous.song.initial.tempo !== project.song.initial.tempo) {
    audio.setTempo(project, focusedPattern(project));
  } else {
    audio.reschedulePattern(project, focusedPattern(project));
  }

  syncTransportUi();
  songView?.refresh();
  patternView?.refresh();
  soundView?.refresh();
  return history.getState();
}


async function activateAudio() {
  try {
    const result = await audio.activate();
    syncTransportUi();
    return result;
  } catch {
    shell?.setAudioStatus('error');
    return null;
  }
}

async function playActivePattern() {
  try {
    const result = await audio.playPattern(project, focusedPattern(project), {
      loop: transportState.loopPattern,
      metronome: transportState.metronome,
    });
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

function auditionInstrument(instrumentId, pitchOverride = null) {
  const instrument = project.instruments.find((item) => item.id === instrumentId);
  const pitch = Number.isInteger(pitchOverride)
    ? pitchOverride
    : isDrumKitInstrument(instrument)
      ? instrument.zones[0]?.keyLow ?? 36
      : 60;
  void audio.previewInstrument(project, instrumentId, pitch, 100)
    .then(() => shell?.setAudioStatus('ready'))
    .catch(() => shell?.setAudioStatus('error'));
}

function renderWorkspace(tab, root) {
  songView = null;
  patternView = null;
  soundView = null;

  if (tab === 'song') {
    songView = createSongView({
      root,
      t: (key, vars) => i18n.t(key, vars),
      getProject: () => project,
      registry,
      getFocusedOrderEntryId: () => focus.getState().orderEntryId,
      initialMode: project.settings.keymapPreset === 'openmpt' ? 'order' : 'map',
    });
    return true;
  }

  if (tab === 'pattern') {
    patternView = createPatternView({
      root,
      t: (key, vars) => i18n.t(key, vars),
      getProject: () => project,
      getActivePattern: (currentProject) => focusedPattern(currentProject),
      getFocusedOrderEntryId: () => focus.getState().orderEntryId,
      registry,
      onAudition: auditionPitch,
      onInstrumentAudition: auditionInstrument,
      onStatus: (status) => shell?.setPatternStatus(status),
      initialMode: project.settings.keymapPreset === 'openmpt' ? 'edit' : 'audition',
    });
    return true;
  }

  if (tab === 'sound') {
    soundView = createSoundView({
      root,
      t: (key, vars) => i18n.t(key, vars),
      getProject: () => project,
      onImportWav: (args) => registry.execute('io.importWav', args),
      onUpdateInstrument: (args) => registry.execute('sound.updateInstrument', args),
      onLoadWaveform: loadSampleWaveform,
      onUndo: undoSoundEdit,
    });
    return true;
  }

  return false;
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
    transport: {
      tempo: project.song.initial.tempo,
      meter: project.song.initial.meter,
      loopPattern: transportState.loopPattern,
      metronome: transportState.metronome,
    },
  });
  shell.render();
  if (activeTab !== 'pattern') shell.selectTab(activeTab);
  syncTransportUi();
}

function activeImportTrackId() {
  return patternView?.getActiveTrackId()
    ?? soundView?.getSelectedTrackId()
    ?? project.song.tracks[0]?.id
    ?? null;
}

function transferHasFiles(dataTransfer) {
  return Array.from(dataTransfer?.types ?? []).includes('Files');
}

function wavFilesFromTransfer(dataTransfer) {
  return [...(dataTransfer?.files ?? [])].filter((file) => (
    /\.wav$/iu.test(file.name)
    || ['audio/wav', 'audio/x-wav', 'audio/wave'].includes(file.type)
  ));
}

function bindGlobalWavDrop() {
  const overlay = document.createElement('div');
  overlay.className = 'wav-drop-overlay';
  overlay.dataset.action = 'wav-drop-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'status');
  document.body.append(overlay);

  let dragDepth = 0;

  function updateOverlay() {
    const trackId = activeImportTrackId();
    const track = project.song.tracks.find((item) => item.id === trackId);
    overlay.textContent = i18n.t('sound.dropOverlay', {
      track: track?.name ?? i18n.t('sound.targetTrack'),
    });
  }

  document.addEventListener('dragenter', (event) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepth += 1;
    updateOverlay();
    overlay.hidden = false;
  });

  document.addEventListener('dragover', (event) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('dragleave', (event) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) overlay.hidden = true;
  });

  document.addEventListener('drop', async (event) => {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepth = 0;
    overlay.hidden = true;

    const files = wavFilesFromTransfer(event.dataTransfer);
    if (files.length !== 1) {
      Toast({ message: i18n.t('sound.dropSingleWav') });
      return;
    }

    const trackId = activeImportTrackId();
    const track = project.song.tracks.find((item) => item.id === trackId);
    if (!track) {
      Toast({ message: i18n.t('sound.dropFailed', { code: 'E_TRACK_NOT_FOUND' }) });
      return;
    }

    try {
      const file = files[0];
      const result = await registry.execute('io.importWav', {
        sourceFilename: file.name,
        bytes: await file.arrayBuffer(),
        trackId,
      });
      Toast({
        message: i18n.t('sound.dropImported', {
          name: result.instrumentName,
          track: result.trackName,
        }),
        actionLabel: i18n.t('history.undo'),
        onAction: () => undoSoundEdit('io.importWav'),
      });
    } catch (error) {
      Toast({
        message: i18n.t('sound.dropFailed', {
          code: error?.code ?? 'E_WAV_IMPORT',
        }),
      });
    }
  });
}

function bindShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Shortcut pakai KeyboardEvent.code, bukan karakter, supaya tetap benar di
    // AZERTY/Dvorak/QWERTZ (§8.14 aturan 1).
    if (event.ctrlKey && !event.altKey && !event.metaKey && !isTextInputTarget(event.target)) {
      if (event.code === 'KeyZ') {
        event.preventDefault();
        if (registry.canRun('history.undo')) registry.execute('history.undo');
        return;
      }
      if (event.code === 'KeyY') {
        event.preventDefault();
        if (registry.canRun('history.redo')) registry.execute('history.redo');
        return;
      }
    }
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

function isTextInputTarget(target) {
  const node = target?.closest?.('input, textarea, [contenteditable="true"]');
  if (!node) return false;
  if (node.matches?.('textarea, [contenteditable="true"]')) return true;
  const type = String(node.type ?? 'text').toLowerCase();
  return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
}

function openWelcomeIfNeeded() {
  if (store?.getItem(WELCOME_COMPLETED_KEY) === '1') return false;

  const welcome = createWelcome({
    t: (key, vars) => i18n.t(key, vars),
    initialLocale: i18n.getLocale(),
    initialKeymap: readInitialKeymap(),
    initialTemplate: 'pop-4-4',
    onSubmit: ({ locale, keymap, templateId }) => {
      setLocale(locale);
      registry.execute('project.loadTemplate', { templateId, locale, keymap });
      store?.setItem(WELCOME_COMPLETED_KEY, '1');
    },
    onSkip: () => {
      registry.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: i18n.getLocale(),
        keymap: readInitialKeymap(),
      });
      store?.setItem(WELCOME_COMPLETED_KEY, '1');
    },
  });
  welcome.open();
  return true;
}

async function boot() {
  registerCommands();
  buildInfo = await loadBuildInfo();

  mountShell();
  syncHtmlLang();
  bindShortcuts();
  bindGlobalWavDrop();
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
      transport: {
        tempo: project.song.initial.tempo,
        meter: project.song.initial.meter,
        loopPattern: transportState.loopPattern,
        metronome: transportState.metronome,
        positionTick: audio.getState().positionTick,
      },
      history: history.getState(),
      session: sessionProjectState,
      focus: focus.getState(),
      sharedPatternGuard: sharedPatternGuard.getState(),
      project: {
        id: project.id,
        patternId: focusedPattern(project).id,
        noteCount: focusedPattern(project).notes.length,
      },
    }),
    getProject: () => structuredClone(project),
    commands: registry,
    setLocale,
    i18n,
  };

  if (!loadDemoFromQuery()) openWelcomeIfNeeded();
}

boot().catch((err) => {
  const root = document.getElementById('app');
  if (root) root.textContent = i18n.t('app.bootFailed');
  // Galat boot itu harus kelihatan di console juga — di sini console.error memang
  // yang tepat, bukan sisa debug yang perlu dihapus.
  console.error('[NotaStation] boot gagal:', err);
});