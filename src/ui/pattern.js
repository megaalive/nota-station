// Pattern editor: DOM windowed, proyeksi NOTE | INST | VOL dan DLY bila ada event off-grid.
// View tidak pernah menulis project langsung; semua mutasi lewat command registry.

import { patternUsageCount } from '../core/arrangement.js';
import {
  EFFECT_UI,
  effectCode,
  formatEffectParam,
  parseEffectParam,
  summarizeEffects,
} from '../core/effect-display.js';
import { EFFECT_TYPES } from '../core/effect-model.js';
import {
  findMatchingLpb,
  notesAtDisplayCell,
  patternHasOffGridNotes,
  projectNoteToDisplayGrid,
  rowTicksForLpb,
  SUPPORTED_LPB,
} from '../core/pattern-grid.js';
import {
  MAX_CHANNELS,
  activePattern,
  firstFreeVoiceLane,
  noteAtCell,
  notesAtCell,
} from '../core/project.js';
import { isDrumKitInstrument } from '../core/sound-model.js';
import { el } from './dom.js';
import { Button, Popover, Tooltip } from './kit.js';
import { playheadFollowScrollTop } from './playhead-follow.js';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 100;
const ROW_NUMBER_WIDTH = 46;
const NOTE_WIDTH = 64;
const INST_WIDTH = 42;
const VOL_WIDTH = 42;
const DLY_WIDTH = 58;
const FX_WIDTH = 72;
const PARAM_WIDTH = 132;
const BASE_FIELDS = ['note', 'instrument', 'volume'];
const FIELD_WIDTHS = Object.freeze({
  note: NOTE_WIDTH,
  instrument: INST_WIDTH,
  volume: VOL_WIDTH,
  delay: DLY_WIDTH,
  effect: FX_WIDTH,
  param: PARAM_WIDTH,
});
const TRACK_COLOR_FALLBACKS = Object.freeze([
  '#4477AA', '#EE6677', '#228833', '#CCBB44',
  '#66CCEE', '#AA3377', '#BBBBBB', '#EE8866',
]);
const OVERSCAN = 1;
const CHANNEL_OVERSCAN = 0;

const NOTE_CODES = new Map([
  ['KeyZ', 0], ['KeyS', 1], ['KeyX', 2], ['KeyD', 3], ['KeyC', 4], ['KeyV', 5],
  ['KeyG', 6], ['KeyB', 7], ['KeyH', 8], ['KeyN', 9], ['KeyJ', 10], ['KeyM', 11],
  ['KeyQ', 12], ['Digit2', 13], ['KeyW', 14], ['Digit3', 15], ['KeyE', 16], ['KeyR', 17],
  ['Digit5', 18], ['KeyT', 19], ['Digit6', 20], ['KeyY', 21], ['Digit7', 22], ['KeyU', 23],
]);

const HEX_CODES = new Map([
  ['Digit0', '0'], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'],
  ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'],
  ['KeyA', 'A'], ['KeyB', 'B'], ['KeyC', 'C'], ['KeyD', 'D'], ['KeyE', 'E'], ['KeyF', 'F'],
]);

const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

const DRUM_KEYS = new Map([
  ['Digit1', { voiceLane: 0, pitch: 36, label: 'K' }],
  ['Digit2', { voiceLane: 1, pitch: 38, label: 'S' }],
  ['Digit3', { voiceLane: 2, pitch: 42, label: 'C' }],
  ['Digit4', { voiceLane: 2, pitch: 46, label: 'O' }],
]);

const DRUM_PITCH_LABELS = new Map([
  [36, 'K'],
  [38, 'S'],
  [42, 'C'],
  [46, 'O'],
]);

export function createPatternView({
  root,
  t,
  getProject,
  getActivePattern = activePattern,
  getFocusedOrderEntryId = null,
  registry,
  onAudition,
  onInstrumentAudition,
  onStatus,
  keymapPreset = 'songwriter',
  initialMode = 'audition',
}) {
  let cursorRow = 0;
  let cursorChannel = 0;
  let cursorField = 'note';
  let cursorVoiceLane = 0;
  const expandedTracks = new Set();
  let geometryRevision = 0;
  let cachedInfo = null;
  let mode = initialMode === 'edit' ? 'edit' : 'audition';
  let octave = 4;
  let step = 1;
  let pendingHex = null;
  let feedback = null;
  let playbackRow = null;
  let playbackState = 'ready';
  let latestTrackMeters = [];
  let pendingSharedEdit = null;
  let sharedWarningDetails = null;
  let blockAnchor = null;
  let blockSelection = null;
  let displayPatternId = null;
  let displayLpb = 4;
  let fxColumnsPinned = false;
  let selectedEffectType = 'volume';
  let renderedHeaderSignature = null;
  let suppressCommandRefresh = false;
  const trackUi = new Map();
  let renderedRows = new Map();
  let renderedRowTemplate = null;

  const modeButton = Button({
    label: t(mode === 'edit' ? 'status.edit' : 'status.audisi'),
    variant: 'default',
    onClick: () => toggleMode(),
  });
  modeButton.dataset.action = 'pattern-mode';

  const octaveText = el('span', { class: 'pattern-toolbar__meta', dataset: { action: 'pattern-octave' } });
  const stepText = el('span', { class: 'pattern-toolbar__meta', dataset: { action: 'pattern-step' } });
  const hint = el('span', { class: 'pattern-toolbar__hint', dataset: { action: 'pattern-hint' } });

  const octaveGroup = el('span', { class: 'pattern-toolbar__stepper' }, [
    toolButton('pattern-octave-down', t('pattern.octaveDown'), '−', () => adjustOctave(-1), '-'),
    octaveText,
    toolButton('pattern-octave-up', t('pattern.octaveUp'), '+', () => adjustOctave(1), '='),
  ]);
  const stepGroup = el('span', { class: 'pattern-toolbar__stepper' }, [
    toolButton('pattern-step-down', t('pattern.stepDown'), '−', () => adjustStep(-1)),
    stepText,
    toolButton('pattern-step-up', t('pattern.stepUp'), '+', () => adjustStep(1)),
  ]);

  const modeControl = Tooltip({
    text: t('pattern.toggleMode'),
    shortcut: 'Ctrl+E',
    child: modeButton,
  });

  const sharedWarningMessage = el('p', {
    class: 'pattern-shared-warning__message',
    dataset: { action: 'pattern-shared-message' },
  });
  const editAllButton = Button({
    label: t('pattern.sharedEditAll'),
    onClick: resolveSharedEditAll,
  });
  editAllButton.dataset.action = 'pattern-shared-edit-all';

  const makeUniqueButton = Button({
    label: t('pattern.sharedMakeUnique'),
    onClick: resolveSharedMakeUnique,
  });
  makeUniqueButton.dataset.action = 'pattern-shared-make-unique';

  const sharedWarningContent = el('div', {
    class: 'pattern-shared-warning',
    dataset: { action: 'pattern-shared-warning' },
  }, [
    sharedWarningMessage,
    el('div', { class: 'pattern-shared-warning__actions' }, [
      editAllButton,
      makeUniqueButton,
    ]),
  ]);

  const sharedBadge = Button({
    label: t('pattern.sharedBadge', { count: 2 }),
    variant: 'ghost',
    onClick: () => showSharedWarning(),
  });
  sharedBadge.dataset.action = 'pattern-shared-badge';
  sharedBadge.hidden = true;

  const sharedPopover = Popover({
    content: sharedWarningContent,
    anchor: sharedBadge,
    placement: 'bottom',
  });
  sharedPopover.dataset.action = 'pattern-shared-popover';

  const lpbSelect = el('select', {
    class: 'pattern-toolbar__select',
    'aria-label': t('pattern.resolution'),
    dataset: { action: 'pattern-lpb' },
    on: {
      change: () => setDisplayLpb(Number(lpbSelect.value)),
    },
  }, SUPPORTED_LPB.map((lpb) => el('option', {
    value: String(lpb),
    text: `LPB ${lpb}`,
  })));

  const matchLpbButton = Button({
    label: t('pattern.matchResolution'),
    variant: 'ghost',
    onClick: matchCurrentCellResolution,
  });
  matchLpbButton.dataset.action = 'pattern-match-lpb';

  const quantizeButton = Button({
    label: t('pattern.quantize'),
    variant: 'ghost',
    onClick: quantizeCurrentCell,
  });
  quantizeButton.dataset.action = 'pattern-quantize';

  const timingGroup = el('span', {
    class: 'pattern-toolbar__timing',
    dataset: { action: 'pattern-timing-tools' },
  }, [
    el('span', { class: 'pattern-toolbar__timing-label', text: t('pattern.resolution') }),
    lpbSelect,
    matchLpbButton,
    quantizeButton,
  ]);

  const addChannelButton = Button({
    label: t('pattern.addChannel'),
    variant: 'ghost',
    onClick: () => {
      const result = registry.execute('song.addTrack');
      feedback = {
        key: 'pattern.channelAdded',
        vars: { count: result.trackCount },
      };
      syncStatus();
      scroller.focus({ preventScroll: true });
    },
  });
  addChannelButton.dataset.action = 'pattern-add-channel';

  const fxToggleButton = Button({
    label: t('pattern.toggleFxColumns'),
    variant: 'ghost',
    onClick: () => toggleFxColumns(),
  });
  fxToggleButton.dataset.action = 'pattern-toggle-fx';

  const effectTypeSelect = el('select', {
    class: 'pattern-toolbar__select pattern-fx-editor__type',
    'aria-label': t('pattern.effectType'),
    dataset: { action: 'pattern-effect-type' },
    on: {
      change: () => {
        selectedEffectType = effectTypeSelect.value;
        syncEffectEditor();
      },
    },
  }, EFFECT_TYPES.map((type) => el('option', {
    value: type,
    text: effectCode(type),
  })));

  const effectParamInput = el('input', {
    class: 'pattern-fx-editor__param',
    type: 'text',
    spellcheck: 'false',
    autocomplete: 'off',
    'aria-label': t('pattern.effectParam'),
    dataset: { action: 'pattern-effect-param' },
    on: {
      keydown: (event) => {
        if (event.code === 'Enter') {
          event.preventDefault();
          applyEffectAtCursor();
        } else if (event.code === 'Escape') {
          event.preventDefault();
          scroller.focus({ preventScroll: true });
        }
      },
    },
  });

  const effectApplyButton = Button({
    label: t('pattern.effectApply'),
    variant: 'default',
    onClick: () => applyEffectAtCursor(),
  });
  effectApplyButton.dataset.action = 'pattern-effect-apply';

  const effectDeleteButton = Button({
    label: t('pattern.effectDelete'),
    variant: 'ghost',
    onClick: () => deleteEffectAtCursor(),
  });
  effectDeleteButton.dataset.action = 'pattern-effect-delete';

  const effectEditor = el('span', {
    class: 'pattern-fx-editor',
    dataset: { action: 'pattern-effect-editor' },
  }, [
    effectTypeSelect,
    effectParamInput,
    effectApplyButton,
    effectDeleteButton,
  ]);
  effectEditor.hidden = true;

  const toolbar = el('div', { class: 'pattern-toolbar' }, [
    modeControl,
    octaveGroup,
    stepGroup,
    timingGroup,
    addChannelButton,
    fxToggleButton,
    effectEditor,
    sharedPopover,
    hint,
  ]);

  const scroller = el('div', {
    class: `pattern-grid ${mode === 'edit' ? 'is-edit' : 'is-audition'}`,
    role: 'grid',
    tabindex: '0',
    'aria-label': t('pattern.gridLabel'),
    dataset: { action: 'pattern-grid' },
  });
  const surface = el('div', { class: 'pattern-grid__surface' });
  const header = el('div', { class: 'pattern-grid__header' });
  const rowsLayer = el('div', { class: 'pattern-grid__rows' });

  surface.append(header, rowsLayer);
  scroller.append(surface);
  root.textContent = '';
  root.append(toolbar, scroller);

  function openTrackFx(channel) {
    const { tracks } = projectInfo();
    if (!tracks[channel]) return;
    clearInputState();
    clearBlockSelection();
    cursorChannel = channel;
    cursorField = 'effect';
    cursorVoiceLane = 0;
    fxColumnsPinned = true;
    feedback = null;
    renderHeader();
    renderWindow();
    ensureCursorVisible();
    syncStatus();
    syncEffectEditor();
    scroller.focus({ preventScroll: true });
  }

  function toggleFxColumns() {
    const { pattern } = projectInfo();
    fxColumnsPinned = !fxColumnsPinned;
    if (!fxColumnsPinned && pattern.effects.length > 0) {
      feedback = { key: 'pattern.fxDataVisible' };
    } else {
      feedback = null;
    }
    const { fields } = projectInfo();
    if (!fields.includes(cursorField)) cursorField = 'note';
    renderHeader();
    renderWindow();
    ensureCursorVisible();
    syncStatus();
    syncEffectEditor();
    scroller.focus({ preventScroll: true });
  }

  function effectsAtDisplayCell(pattern, { trackId, row, rowTicks }) {
    const start = row * rowTicks;
    const end = start + rowTicks;
    return pattern.effects
      .filter((effect) => (
        effect.trackId === trackId
        && effect.tickLocal >= start
        && effect.tickLocal < end
      ))
      .sort((a, b) => (
        a.tickLocal - b.tickLocal
        || EFFECT_TYPES.indexOf(a.type) - EFFECT_TYPES.indexOf(b.type)
        || a.id.localeCompare(b.id)
      ));
  }

  function exactEffectsAtCursor() {
    const { pattern, tracks, displayRowTicks } = projectInfo();
    const track = tracks[cursorChannel];
    if (!track) return [];
    const tickLocal = cursorRow * displayRowTicks;
    return pattern.effects.filter((effect) => (
      effect.trackId === track.id && effect.tickLocal === tickLocal
    ));
  }

  function selectedEffectAtCursor() {
    return exactEffectsAtCursor().find((effect) => effect.type === selectedEffectType) ?? null;
  }

  function selectExistingEffectTypeAtCursor() {
    const cellEffects = exactEffectsAtCursor();
    if (
      cellEffects.length > 0
      && !cellEffects.some((effect) => effect.type === selectedEffectType)
    ) {
      selectedEffectType = cellEffects[0].type;
    }
  }

  function cursorHasOffGridEffect() {
    const { pattern, tracks, displayRowTicks } = projectInfo();
    const track = tracks[cursorChannel];
    if (!track) return false;
    return effectsAtDisplayCell(pattern, {
      trackId: track.id,
      row: cursorRow,
      rowTicks: displayRowTicks,
    }).some((effect) => effect.tickLocal % displayRowTicks !== 0);
  }

  function syncEffectEditor() {
    const { pattern, showEffects, projectionOnly } = projectInfo();
    effectEditor.hidden = !showEffects;
    fxToggleButton.setAttribute('aria-pressed', showEffects ? 'true' : 'false');
    if (!showEffects) return;

    const cellEffects = exactEffectsAtCursor();
    effectTypeSelect.value = selectedEffectType;

    const current = selectedEffectAtCursor();
    effectParamInput.placeholder = EFFECT_UI[selectedEffectType]?.placeholder ?? '';
    effectParamInput.value = current
      ? formatEffectParam(current.type, current.value)
      : '';

    const readOnly = mode !== 'edit' || projectionOnly || cursorHasOffGridEffect();
    effectTypeSelect.disabled = readOnly;
    effectParamInput.disabled = readOnly;
    effectApplyButton.disabled = readOnly;
    effectDeleteButton.disabled = readOnly || !current;

    effectEditor.dataset.patternId = pattern.id;
    effectEditor.dataset.row = String(cursorRow);
    effectEditor.dataset.channel = String(cursorChannel);
  }

  function applyEffectAtCursor() {
    if (mode !== 'edit') return;
    if (rejectProjectionMutation()) return;
    if (cursorHasOffGridEffect()) {
      feedback = { key: 'pattern.fxOffGridReadOnly' };
      syncStatus();
      return;
    }

    let value;
    try {
      value = parseEffectParam(selectedEffectType, effectParamInput.value);
    } catch (error) {
      feedback = {
        key: 'pattern.effectParamInvalid',
        vars: { message: error.message },
      };
      syncStatus();
      return;
    }

    const { pattern, tracks, displayRowTicks } = projectInfo();
    const track = tracks[cursorChannel];
    const current = selectedEffectAtCursor();
    const tickLocal = cursorRow * displayRowTicks;
    const command = current ? 'pattern.updateEffect' : 'pattern.addEffect';
    const args = current
      ? {
          patternId: pattern.id,
          effectId: current.id,
          value,
        }
      : {
          patternId: pattern.id,
          trackId: track.id,
          tickLocal,
          type: selectedEffectType,
          value,
        };

    feedback = null;
    runPatternCommand(command, args, () => {
      fxColumnsPinned = true;
      feedback = {
        key: current ? 'pattern.effectUpdated' : 'pattern.effectAdded',
        vars: { effect: effectCode(selectedEffectType) },
      };
      renderHeader();
      renderWindow();
      syncStatus();
      syncEffectEditor();
    });
  }

  function deleteEffectAtCursor() {
    if (mode !== 'edit') return;
    if (rejectProjectionMutation()) return;
    if (cursorHasOffGridEffect()) {
      feedback = { key: 'pattern.fxOffGridReadOnly' };
      syncStatus();
      return;
    }

    const current = selectedEffectAtCursor();
    if (!current) {
      feedback = { key: 'pattern.effectNothingToDelete' };
      syncStatus();
      return;
    }

    const { pattern } = projectInfo();
    runPatternCommand('pattern.deleteEffect', {
      patternId: pattern.id,
      effectId: current.id,
    }, () => {
      feedback = {
        key: 'pattern.effectDeleted',
        vars: { effect: effectCode(current.type) },
      };
      renderHeader();
      renderWindow();
      syncStatus();
      syncEffectEditor();
    });
  }

  function sharedPatternInfo() {
    const { project, pattern } = projectInfo();
    const usage = patternUsageCount(project, pattern.id);
    return {
      patternId: pattern.id,
      patternName: pattern.name,
      usage,
      orderEntryId: getFocusedOrderEntryId?.()
        ?? project.song.order.find((entry) => entry.patternId === pattern.id)?.id
        ?? null,
    };
  }

  function syncSharedPatternBadge() {
    const info = sharedPatternInfo();
    sharedBadge.hidden = info.usage <= 1;
    if (info.usage <= 1) {
      sharedPopover.close();
      sharedWarningDetails = null;
      return;
    }
    sharedBadge.querySelector('.btn__label').textContent = t('pattern.sharedBadge', {
      count: info.usage,
    });
  }

  function showSharedWarning(details = null) {
    const info = details ?? sharedPatternInfo();
    if (!info || info.usage <= 1) return;
    sharedWarningDetails = {
      patternId: info.patternId,
      patternName: info.patternName,
      usage: info.usage,
      orderEntryId: info.orderEntryId
        ?? getFocusedOrderEntryId?.()
        ?? null,
    };
    sharedBadge.hidden = false;
    sharedBadge.querySelector('.btn__label').textContent = t('pattern.sharedBadge', {
      count: info.usage,
    });
    sharedWarningMessage.textContent = t('pattern.sharedWarning', {
      pattern: info.patternName,
      count: info.usage,
    });
    sharedPopover.open();
  }

  function runPatternCommand(id, args, onSuccess = null) {
    let result;
    suppressCommandRefresh = true;
    try {
      result = registry.execute(id, args);
    } catch (error) {
      if (error?.code !== 'E_SHARED_PATTERN_DECISION_REQUIRED') throw error;
      pendingSharedEdit = {
        id,
        args: structuredClone(args),
        onSuccess,
      };
      showSharedWarning(error.details);
      return false;
    } finally {
      suppressCommandRefresh = false;
    }

    onSuccess?.(result);
    return true;
  }

  function resolveSharedEditAll() {
    const details = sharedWarningDetails;
    if (!details?.patternId) return;

    const pending = pendingSharedEdit;
    pendingSharedEdit = null;
    sharedWarningDetails = null;
    sharedPopover.close();
    registry.execute('pattern.allowSharedEdit', {
      patternId: details.patternId,
    });
    if (pending) {
      runPatternCommand(pending.id, pending.args, pending.onSuccess);
    }
    scroller.focus({ preventScroll: true });
  }

  function resolveSharedMakeUnique() {
    const details = sharedWarningDetails;
    if (!details?.orderEntryId) return;

    const pending = pendingSharedEdit;
    pendingSharedEdit = null;
    sharedWarningDetails = null;
    sharedPopover.close();
    registry.execute('song.makeOrderUnique', {
      orderEntryId: details.orderEntryId,
    });

    if (pending) {
      const nextPattern = projectInfo().pattern;
      runPatternCommand(
        pending.id,
        { ...pending.args, patternId: nextPattern.id },
        pending.onSuccess,
      );
    }
    scroller.focus({ preventScroll: true });
  }

  function projectInfo() {
    const project = getProject();
    const pattern = getActivePattern(project);
    if (displayPatternId !== pattern.id) {
      displayPatternId = pattern.id;
      displayLpb = defaultLpbForPattern(pattern);
      blockAnchor = null;
      blockSelection = null;
    }
    if (cachedInfo?.project === project && cachedInfo.pattern === pattern
      && cachedInfo.displayLpb === displayLpb && cachedInfo.fxColumnsPinned === fxColumnsPinned
      && cachedInfo.geometryRevision === geometryRevision) return cachedInfo;
    const displayRowTicks = rowTicksForLpb(displayLpb);
    const hasOffGrid = patternHasOffGridNotes(pattern, displayRowTicks)
      || pattern.effects.some((effect) => effect.tickLocal % displayRowTicks !== 0);
    const showEffects = fxColumnsPinned || pattern.effects.length > 0;
    const fields = [
      ...BASE_FIELDS,
      ...(hasOffGrid ? ['delay'] : []),
      ...(showEffects ? ['effect', 'param'] : []),
    ];
    // Prefix offset menjaga spacer dan ARIA tetap sejalan meski lebar tiap track berbeda.
    let pixelOffset = 0;
    let columnOffset = 0;
    const geometry = project.song.tracks.map((track) => {
      const expanded = track.polyphony === 'poly' && expandedTracks.has(track.id);
      const lanes = expanded
        ? [...new Set([0, ...pattern.notes.filter((note) => note.trackId === track.id)
          .map((note) => note.voiceLane ?? 0)])].sort((a, b) => a - b)
        : [0];
      const columns = [
        ...lanes.flatMap((voiceLane) => BASE_FIELDS.map((field) => ({ field, voiceLane }))),
        ...fields.filter((field) => !BASE_FIELDS.includes(field))
          .map((field) => ({ field, voiceLane: 0 })),
      ];
      let offset = 0;
      for (const column of columns) {
        column.offset = offset;
        column.width = FIELD_WIDTHS[column.field];
        offset += column.width;
      }
      const result = { trackId: track.id, expanded, lanes, columns, width: offset, pixelOffset, columnOffset };
      pixelOffset += offset;
      columnOffset += columns.length;
      return result;
    });
    cachedInfo = {
      project,
      pattern,
      tracks: project.song.tracks,
      fields,
      geometry,
      columnSignature: geometry.map((track) => `${track.trackId}:${track.columns
        .map((column) => `${column.field}:${column.voiceLane}`).join(',')}`).join('|'),
      totalWidth: pixelOffset,
      columnCount: columnOffset,
      displayLpb,
      fxColumnsPinned,
      geometryRevision,
      displayRowTicks,
      showEffects,
      projectionOnly: displayRowTicks !== pattern.rowTicks,
      rowCount: Math.ceil(pattern.lengthTicks / displayRowTicks),
    };
    return cachedInfo;
  }

  function dataColumns(tracks, fields) {
    return projectInfo().geometry.flatMap((track) => track.columns.map((column) => column.width));
  }

  function rowTemplate(tracks, fields) {
    return `${ROW_NUMBER_WIDTH}px ${dataColumns(tracks, fields).map((width) => `${width}px`).join(' ')}`;
  }

  function visibleChannelWindow(tracks, fields) {
    const { geometry, totalWidth } = projectInfo();
    const viewportLeft = Math.max(0, scroller.scrollLeft - ROW_NUMBER_WIDTH);
    const viewportRight = viewportLeft + Math.max(1, scroller.clientWidth || 800);
    const first = Math.max(
      0,
      geometry.findIndex((track) => track.pixelOffset + track.width > viewportLeft) - CHANNEL_OVERSCAN,
    );
    const last = Math.min(
      tracks.length,
      geometry.filter((track) => track.pixelOffset < viewportRight).length + CHANNEL_OVERSCAN,
    );
    return {
      first,
      last,
      leftSpacer: geometry[first]?.pixelOffset ?? totalWidth,
      rightSpacer: totalWidth - (geometry[last]?.pixelOffset ?? totalWidth),
    };
  }

  function windowedRowTemplate(tracks, fields, window) {
    const columns = [`${ROW_NUMBER_WIDTH}px`];
    if (window.leftSpacer > 0) columns.push(`${window.leftSpacer}px`);
    for (let channel = window.first; channel < window.last; channel += 1) {
      for (const column of projectInfo().geometry[channel].columns) columns.push(`${column.width}px`);
    }
    if (window.rightSpacer > 0) columns.push(`${window.rightSpacer}px`);
    return columns.join(' ');
  }

  function headerSignature({ project, tracks, fields }) {
    return JSON.stringify({
      fields,
      lanes: projectInfo().geometry.map((track) => [track.expanded, track.lanes]),
      tracks: tracks.map((track) => [
        track.id,
        track.name,
        track.kind,
        track.polyphony,
        track.defaultInstrumentId,
        track.color,
      ]),
      instruments: project.instruments.map((instrument) => [
        instrument.id,
        instrument.name,
      ]),
    });
  }

  function renderHeaderIfNeeded() {
    const info = projectInfo();
    if (headerSignature(info) === renderedHeaderSignature) return false;
    renderHeader();
    return true;
  }

  function renderHeader() {
    const { project, pattern, tracks, fields } = projectInfo();
    renderedHeaderSignature = headerSignature({ project, tracks, fields });
    header.textContent = '';

    trackUi.clear();
    const channelRow = el('div', { class: 'pattern-grid__header-row pattern-grid__header-row--channel', role: 'row' });
    const { geometry } = projectInfo();
    channelRow.style.gridTemplateColumns = `${ROW_NUMBER_WIDTH}px ${geometry.map((track) => `${track.width}px`).join(' ')}`;
    channelRow.append(el('div', {
      class: 'pattern-grid__corner pattern-grid__corner--channel',
      'aria-hidden': 'true',
      text: '#',
    }));

    tracks.forEach((track, index) => {
      const label = el('span', {
        class: 'pattern-channel__name',
        text: track.kind === 'drum'
          ? `${index + 1} · ${track.name} · ${t('pattern.drumBadge')}`
          : `${index + 1} · ${track.name}`,
      });
      const mute = el('button', {
        type: 'button',
        class: 'pattern-channel__toggle',
        'aria-label': t('pattern.muteTrack', { track: index + 1 }),
        'aria-pressed': 'false',
        dataset: { action: 'track-mute', trackId: track.id },
        text: 'M',
        on: {
          click: (event) => {
            event.stopPropagation();
            registry.execute('audio.toggleTrackMute', { trackId: track.id });
          },
        },
      });
      const solo = el('button', {
        type: 'button',
        class: 'pattern-channel__toggle',
        'aria-label': t('pattern.soloTrack', { track: index + 1 }),
        'aria-pressed': 'false',
        dataset: { action: 'track-solo', trackId: track.id },
        text: 'S',
        on: {
          click: (event) => {
            event.stopPropagation();
            registry.execute('audio.toggleTrackSolo', { trackId: track.id });
          },
        },
      });
      const poly = el('button', {
        type: 'button',
        class: 'pattern-channel__toggle',
        'aria-label': t('pattern.trackPolyphony', { track: index + 1 }),
        'aria-pressed': track.polyphony === 'poly' ? 'true' : 'false',
        disabled: track.kind === 'drum',
        dataset: { action: 'track-polyphony', trackId: track.id },
        text: 'P',
        on: {
          click: (event) => {
            event.stopPropagation();
            if (track.kind === 'drum') return;
            try {
              registry.execute('track.setPolyphony', {
                trackId: track.id,
                polyphony: track.polyphony === 'poly' ? 'mono' : 'poly',
              });
            } catch (error) {
              if (error?.code !== 'E_PROJECT_POLYPHONY_ACTIVE_VOICES') throw error;
              feedback = { key: 'pattern.polyphonyHasVoices' };
              syncStatus();
            }
          },
        },
      });
      const fx = el('button', {
        type: 'button',
        class: 'pattern-channel__toggle pattern-channel__fx',
        'aria-label': t('pattern.trackFx', { track: index + 1 }),
        dataset: { action: 'track-fx', trackId: track.id },
        text: 'FX',
        on: {
          click: (event) => {
            event.stopPropagation();
            openTrackFx(index);
          },
        },
      });
      const resolvedTrackColor = track.color ?? TRACK_COLOR_FALLBACKS[index % TRACK_COLOR_FALLBACKS.length];
      const color = el('input', {
        class: 'pattern-channel__color',
        type: 'color',
        value: resolvedTrackColor,
        'aria-label': t('pattern.trackColor', { track: index + 1 }),
        dataset: { action: 'track-color', trackId: track.id },
        on: {
          change: (event) => {
            event.stopPropagation();
            registry.execute('track.setColor', {
              trackId: track.id,
              color: color.value,
            });
          },
        },
      });
      const volume = el('input', {
        class: 'pattern-channel__volume',
        type: 'range',
        min: '0',
        max: '100',
        step: '1',
        value: '100',
        'aria-label': t('pattern.trackVolume', { track: index + 1 }),
        dataset: { action: 'track-volume', trackId: track.id },
        on: {
          input: (event) => {
            event.stopPropagation();
            registry.execute('audio.setTrackVolume', {
              trackId: track.id,
              volume: Number(volume.value) / 100,
            });
          },
        },
      });
      const meterFill = el('span', { class: 'pattern-channel__meter-fill' });
      const meter = el('span', {
        class: 'pattern-channel__meter',
        role: 'meter',
        'aria-label': t('pattern.trackMeter', { track: index + 1 }),
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0',
        dataset: { action: 'track-meter', trackId: track.id, level: '0' },
      }, [meterFill]);
      const instrumentChoices = track.kind === 'drum'
        ? project.instruments.filter((instrument) => isDrumKitInstrument(instrument))
        : project.instruments;
      const instrumentSelect = el('select', {
        class: 'pattern-channel__instrument',
        'aria-label': t('pattern.instrumentPicker', { track: index + 1 }),
        dataset: { action: 'track-instrument', trackId: track.id },
        on: {
          change: (event) => {
            event.stopPropagation();
            const instrumentId = instrumentSelect.value;
            registry.execute('track.setDefaultInstrument', {
              trackId: track.id,
              instrumentId,
            });
            onInstrumentAudition?.(instrumentId);
          },
          keydown: (event) => {
            if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();

            const currentIndex = instrumentChoices.findIndex(
              (instrument) => instrument.id === instrumentSelect.value,
            );
            const delta = event.key === 'ArrowUp' ? -1 : 1;
            const nextIndex = (
              currentIndex + delta + instrumentChoices.length
            ) % instrumentChoices.length;
            const instrumentId = instrumentChoices[nextIndex].id;

            registry.execute('track.setDefaultInstrument', {
              trackId: track.id,
              instrumentId,
            });
            onInstrumentAudition?.(instrumentId);
          },
        },
      }, instrumentChoices.map((instrument) => {
        const instrumentIndex = project.instruments.findIndex((item) => item.id === instrument.id);
        return el('option', {
          value: instrument.id,
          text: `${String(instrumentIndex + 1).padStart(2, '0')} · ${instrument.name}`,
        });
      }));
      instrumentSelect.value = track.defaultInstrumentId;

      const controls = el('span', { class: 'pattern-channel__controls' }, [mute, solo, poly]);
      if (track.polyphony === 'poly') {
        controls.append(el('button', {
          type: 'button',
          class: 'pattern-channel__toggle',
          'aria-label': t('pattern.toggleLanes', { track: index + 1 }),
          'aria-expanded': String(geometry[index].expanded),
          dataset: { action: 'track-lanes-toggle', trackId: track.id },
          text: geometry[index].expanded ? '−' : '+',
          on: { click: () => {
            if (expandedTracks.has(track.id)) expandedTracks.delete(track.id);
            else expandedTracks.add(track.id);
            geometryRevision += 1;
            cursorVoiceLane = 0;
            clearInputState();
            renderHeader();
            renderWindow();
            ensureCursorVisible();
            syncStatus();
          } },
        }));
      }
      controls.append(fx, color);
      const mix = el('span', { class: 'pattern-channel__mix' }, [volume, meter]);
      const channel = el('div', {
        class: `pattern-grid__channel${track.kind === 'drum' ? ' is-drum' : ''}`,
        role: 'columnheader',
        'aria-colindex': String(geometry[index].columnOffset + 1),
        'aria-colspan': String(geometry[index].columns.length),
      }, [label, instrumentSelect, controls, mix]);
      channel.style.setProperty('--track-color', resolvedTrackColor);
      channelRow.append(channel);
      trackUi.set(track.id, { channel, mute, solo, poly, volume, meter, meterFill });
    });

    const fieldRow = el('div', { class: 'pattern-grid__header-row pattern-grid__header-row--field', role: 'row' });
    fieldRow.style.gridTemplateColumns = rowTemplate(tracks, fields);
    fieldRow.append(el('div', { class: 'pattern-grid__corner', 'aria-hidden': 'true' }));

    tracks.forEach((track, channel) => {
      geometry[channel].columns.forEach(({ field, voiceLane }, fieldIndex) => {
        const label = t({
          note: 'pattern.columnNote',
          instrument: 'pattern.columnInstrument',
          volume: 'pattern.columnVolume',
          delay: 'pattern.columnDelay',
          effect: 'pattern.columnEffect',
          param: 'pattern.columnParam',
        }[field]);
        fieldRow.append(el('div', {
          class: `pattern-grid__field-header pattern-grid__field-header--${field}`,
          role: 'columnheader',
          'aria-colindex': String(geometry[channel].columnOffset + fieldIndex + 1),
          dataset: { channel: String(channel), field, voiceLane: String(voiceLane) },
          text: geometry[channel].expanded && BASE_FIELDS.includes(field)
            ? `${t('pattern.lane', { lane: voiceLane + 1 })} ${label}` : label,
        }));
      });
    });

    header.append(channelRow, fieldRow);
    applyTrackMeters();
  }

  function applyTrackMeters() {
    const states = new Map(latestTrackMeters.map((item) => [item.trackId, item]));
    for (const [trackId, ui] of trackUi) {
      const state = states.get(trackId) ?? {
        level: 0,
        mute: false,
        solo: false,
        volume: 1,
        audible: true,
      };
      const level = Math.max(0, Math.min(1, Number(state.level) || 0));
      ui.meterFill.style.width = `${Math.round(level * 100)}%`;
      ui.meter.dataset.level = level.toFixed(3);
      ui.meter.setAttribute('aria-valuenow', String(Math.round(level * 100)));
      ui.mute.setAttribute('aria-pressed', state.mute ? 'true' : 'false');
      ui.solo.setAttribute('aria-pressed', state.solo ? 'true' : 'false');
      const volume = Math.max(0, Math.min(1, Number(state.volume ?? 1)));
      ui.volume.value = String(Math.round(volume * 100));
      ui.volume.setAttribute('aria-valuenow', String(Math.round(volume * 100)));
      ui.channel.classList.toggle('is-muted', Boolean(state.mute));
      ui.channel.classList.toggle('is-solo', Boolean(state.solo));
      ui.channel.classList.toggle('is-inaudible', !state.audible);
    }
  }

  function renderWindow() {
    renderHeaderIfNeeded();
    const { project, pattern, tracks, fields, geometry, totalWidth, columnCount, displayRowTicks, rowCount } = projectInfo();
    normalizeCursorLane();
    const width = ROW_NUMBER_WIDTH + totalWidth;
    const height = HEADER_HEIGHT + rowCount * ROW_HEIGHT;
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    scroller.setAttribute('aria-rowcount', String(rowCount));
    scroller.setAttribute('aria-colcount', String(columnCount));

    const viewportRows = Math.ceil((scroller.clientHeight || 420) / ROW_HEIGHT);
    const first = Math.max(0, Math.floor(Math.max(0, scroller.scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN);
    const last = Math.min(rowCount, first + viewportRows + OVERSCAN * 2);
    const channelWindow = visibleChannelWindow(tracks, fields);
    const template = windowedRowTemplate(tracks, fields, channelWindow);
    const rowSignature = `${channelWindow.first}:${channelWindow.last}:${template}:${projectInfo().columnSignature}:${geometryRevision}`;
    if (renderedRowTemplate !== rowSignature) renderedRows = new Map();
    renderedRowTemplate = rowSignature;
    const nextRows = new Map();

    const rowFragment = document.createDocumentFragment();
    for (let row = first; row < last; row += 1) {
      const isPlayhead = row === playbackRow;
      const previous = renderedRows.get(row);
      const rowNode = previous?.node ?? el('div', {
        class: `pattern-grid__row${isPlayhead ? ' is-playhead' : ''}`,
        role: 'row',
        'aria-rowindex': String(row + 1),
        'aria-current': isPlayhead ? 'true' : null,
        dataset: { row: String(row) },
      });
      rowNode.classList.toggle('is-playhead', isPlayhead);
      rowNode.setAttribute('aria-current', isPlayhead ? 'true' : 'false');
      rowNode.style.top = `${HEADER_HEIGHT + row * ROW_HEIGHT}px`;
      rowNode.style.gridTemplateColumns = template;
      const cells = previous?.cells ?? [];
      let cellIndex = 0;

      if (!previous) rowNode.append(el('div', {
        class: 'pattern-grid__row-number',
        role: 'rowheader',
        text: row.toString(16).toUpperCase().padStart(2, '0'),
      }));

      if (!previous && channelWindow.leftSpacer > 0) {
        rowNode.append(el('div', {
          class: 'pattern-grid__channel-spacer',
          'aria-hidden': 'true',
        }));
      }

      tracks
        .slice(channelWindow.first, channelWindow.last)
        .forEach((track, offset) => {
        const channel = channelWindow.first + offset;
        const projectedNotes = notesAtDisplayCell(project, {
          patternId: pattern.id,
          trackId: track.id,
          row,
          rowTicks: displayRowTicks,
        });
        const projectedEffects = effectsAtDisplayCell(pattern, {
          trackId: track.id,
          row,
          rowTicks: displayRowTicks,
        });
        geometry[channel].columns.forEach(({ field, voiceLane }, fieldIndex) => {
          const laneNotes = geometry[channel].expanded && BASE_FIELDS.includes(field)
            ? projectedNotes.filter((note) => (note.voiceLane ?? 0) === voiceLane) : projectedNotes;
          const note = laneNotes[0] ?? null;
          const selected = row === cursorRow && channel === cursorChannel && field === cursorField
            && voiceLane === cursorVoiceLane;
          const blockSelected = isBlockSelected(row, channel);
          const className = `pattern-grid__cell pattern-grid__cell--${field}${blockSelected ? ' is-block-selected' : ''}${selected ? ' is-cursor' : ''}`;
          const text = displayCellText(project, note, field, row, channel, laneNotes, projectedEffects, voiceLane);
          const title = cellTitle(project, note, field, row, channel, laneNotes, projectedEffects);
          const previousCell = cells[cellIndex];
          cellIndex += 1;
          if (previousCell) {
            if (previousCell.className !== className) previousCell.className = className;
            if (previousCell.textContent !== text) previousCell.textContent = text;
            previousCell.setAttribute('aria-selected', selected || blockSelected ? 'true' : 'false');
            if (title) previousCell.title = title;
            else previousCell.removeAttribute('title');
            return;
          }
          const cell = el('div', {
            class: `pattern-grid__cell pattern-grid__cell--${field}${blockSelected ? ' is-block-selected' : ''}${selected ? ' is-cursor' : ''}`,
            role: 'gridcell',
            'aria-colindex': String(geometry[channel].columnOffset + fieldIndex + 1),
            'aria-selected': selected || blockSelected ? 'true' : 'false',
            dataset: {
              action: 'pattern-cell',
              row: String(row),
              channel: String(channel),
              field,
              voiceLane: String(voiceLane),
              trackId: track.id,
            },
            text,
            title,
            on: {
              click: () => {
                clearInputState();
                clearBlockSelection();
                cursorRow = row;
                cursorChannel = channel;
                cursorField = field;
                cursorVoiceLane = voiceLane;
                if (field === 'effect' || field === 'param') {
                  selectExistingEffectTypeAtCursor();
                }
                scroller.focus();
                renderWindow();
                syncStatus();
                syncEffectEditor();
              },
            },
          });
          cells.push(cell);
          rowNode.append(cell);
        });
      });
      if (!previous && channelWindow.rightSpacer > 0) {
        rowNode.append(el('div', {
          class: 'pattern-grid__channel-spacer',
          'aria-hidden': 'true',
        }));
      }
      rowFragment.append(rowNode);
      nextRows.set(row, { node: rowNode, cells });
    }
    rowsLayer.replaceChildren(rowFragment);
    renderedRows = nextRows;
  }

  function ensurePlaybackVisible(row) {
    if (playbackState !== 'playing') return;
    if (scroller.clientHeight <= HEADER_HEIGHT) return;

    const { rowCount } = projectInfo();
    scroller.scrollTop = playheadFollowScrollTop({
      row,
      rowCount,
      rowHeight: ROW_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      clientHeight: scroller.clientHeight,
    });
  }

  function setPlaybackState(audioState) {
    latestTrackMeters = Array.isArray(audioState?.trackMeters) ? audioState.trackMeters : [];
    applyTrackMeters();

    const { displayRowTicks, rowCount } = projectInfo();
    const tick = Number(audioState?.positionTick) || 0;
    const nextRow = Math.max(0, Math.min(rowCount - 1, Math.floor(tick / displayRowTicks)));
    const nextState = audioState?.state ?? 'ready';
    const changed = nextRow !== playbackRow || nextState !== playbackState;

    playbackRow = nextRow;
    playbackState = nextState;
    if (nextState === 'playing') ensurePlaybackVisible(nextRow);
    if (changed) renderWindow();
  }

  function ensureCursorVisible() {
    const { geometry } = projectInfo();
    const top = HEADER_HEIGHT + cursorRow * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < scroller.scrollTop + HEADER_HEIGHT) {
      scroller.scrollTop = Math.max(0, top - HEADER_HEIGHT);
    } else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight;
    }

    const track = geometry[cursorChannel];
    const column = track.columns.find((item) => item.field === cursorField && item.voiceLane === cursorVoiceLane)
      ?? track.columns[0];
    const left = ROW_NUMBER_WIDTH + track.pixelOffset + column.offset;
    const right = left + column.width;
    const visibleLeft = scroller.scrollLeft + ROW_NUMBER_WIDTH;
    const visibleRight = scroller.scrollLeft + scroller.clientWidth;

    if (left < visibleLeft) {
      scroller.scrollLeft = Math.max(0, left - ROW_NUMBER_WIDTH);
    } else if (right > visibleRight) {
      scroller.scrollLeft = Math.max(0, right - scroller.clientWidth);
    }
  }

  function selectionBoundsOrCursor() {
    return blockSelection ?? {
      rowStart: cursorRow,
      rowEnd: cursorRow,
      channelStart: cursorChannel,
      channelEnd: cursorChannel,
    };
  }

  function isBlockSelected(row, channel) {
    return Boolean(
      blockSelection
      && row >= blockSelection.rowStart
      && row <= blockSelection.rowEnd
      && channel >= blockSelection.channelStart
      && channel <= blockSelection.channelEnd
    );
  }

  function clearBlockSelection() {
    blockAnchor = null;
    blockSelection = null;
  }

  function updateBlockSelection() {
    if (!blockAnchor) return;
    blockSelection = {
      rowStart: Math.min(blockAnchor.row, cursorRow),
      rowEnd: Math.max(blockAnchor.row, cursorRow),
      channelStart: Math.min(blockAnchor.channel, cursorChannel),
      channelEnd: Math.max(blockAnchor.channel, cursorChannel),
    };
  }

  function beginBlockSelection() {
    if (!blockAnchor) {
      blockAnchor = { row: cursorRow, channel: cursorChannel };
    }
  }

  function moveVertical(delta, { extend = false } = {}) {
    clearInputState();
    if (extend) beginBlockSelection();
    else clearBlockSelection();
    const { rowCount } = projectInfo();
    cursorRow = Math.max(0, Math.min(rowCount - 1, cursorRow + delta));
    if (extend) updateBlockSelection();
    renderWindow();
    ensureCursorVisible();
    syncStatus();
  }

  function moveHorizontal(delta) {
    clearInputState();
    clearBlockSelection();
    const { geometry, columnCount } = projectInfo();
    const track = geometry[cursorChannel];
    const fieldIndex = Math.max(0, track.columns.findIndex((column) => column.field === cursorField
      && column.voiceLane === cursorVoiceLane));
    const flat = Math.max(
      0,
      Math.min(columnCount - 1, track.columnOffset + fieldIndex + delta),
    );
    cursorChannel = geometry.findIndex((item) => flat < item.columnOffset + item.columns.length);
    const column = geometry[cursorChannel].columns[flat - geometry[cursorChannel].columnOffset];
    cursorField = column.field;
    cursorVoiceLane = column.voiceLane;
    renderWindow();
    ensureCursorVisible();
    syncStatus();
  }

  function moveBlockChannel(delta) {
    clearInputState();
    beginBlockSelection();
    const { tracks } = projectInfo();
    cursorChannel = Math.max(0, Math.min(tracks.length - 1, cursorChannel + delta));
    updateBlockSelection();
    renderWindow();
    ensureCursorVisible();
    syncStatus();
  }

  function selectProgressively() {
    clearInputState();
    const { rowCount, tracks } = projectInfo();
    const fullCurrentChannel = blockSelection
      && blockSelection.rowStart === 0
      && blockSelection.rowEnd === rowCount - 1
      && blockSelection.channelStart === cursorChannel
      && blockSelection.channelEnd === cursorChannel;

    if (fullCurrentChannel) {
      blockAnchor = { row: 0, channel: 0 };
      blockSelection = {
        rowStart: 0,
        rowEnd: rowCount - 1,
        channelStart: 0,
        channelEnd: tracks.length - 1,
      };
    } else {
      blockAnchor = { row: 0, channel: cursorChannel };
      blockSelection = {
        rowStart: 0,
        rowEnd: rowCount - 1,
        channelStart: cursorChannel,
        channelEnd: cursorChannel,
      };
    }
    renderWindow();
    syncStatus();
  }

  function copyBlock() {
    if (rejectProjectionMutation()) return;
    const { pattern } = projectInfo();
    const bounds = selectionBoundsOrCursor();
    const result = registry.execute('pattern.copyBlock', {
      patternId: pattern.id,
      ...bounds,
    });
    feedback = { key: 'pattern.blockCopied', vars: { count: result.eventCount } };
    syncStatus();
  }

  function pasteBlock() {
    if (rejectProjectionMutation()) return;
    if (mode !== 'edit') return;
    const { pattern, rowCount, tracks } = projectInfo();
    runPatternCommand('pattern.pasteBlock', {
      patternId: pattern.id,
      targetRow: cursorRow,
      targetChannel: cursorChannel,
    }, (result) => {
      blockAnchor = { row: cursorRow, channel: cursorChannel };
      blockSelection = {
        rowStart: cursorRow,
        rowEnd: Math.min(rowCount - 1, cursorRow + result.rowCount - 1),
        channelStart: cursorChannel,
        channelEnd: Math.min(tracks.length - 1, cursorChannel + result.channelCount - 1),
      };
      feedback = { key: 'pattern.blockPasted', vars: { count: result.eventCount } };
      renderWindow();
      syncStatus();
    });
  }

  function transposeBlock(semitones) {
    if (rejectProjectionMutation()) return;
    if (mode !== 'edit') return;
    const { pattern } = projectInfo();
    const bounds = selectionBoundsOrCursor();
    runPatternCommand('pattern.transposeBlock', {
      patternId: pattern.id,
      ...bounds,
      semitones,
    }, () => {
      feedback = {
        key: 'pattern.blockTransposed',
        vars: { amount: semitones > 0 ? `+${semitones}` : String(semitones) },
      };
      renderWindow();
      syncStatus();
    });
  }

  function rowOperationArgs({ allChannels = false } = {}) {
    const { pattern, tracks } = projectInfo();
    const bounds = selectionBoundsOrCursor();
    return {
      patternId: pattern.id,
      row: bounds.rowStart,
      count: bounds.rowEnd - bounds.rowStart + 1,
      channelStart: allChannels ? 0 : bounds.channelStart,
      channelEnd: allChannels ? tracks.length - 1 : bounds.channelEnd,
    };
  }

  function editRows(action, { allChannels = false } = {}) {
    if (rejectProjectionMutation()) return;
    if (mode !== 'edit') return;
    const args = rowOperationArgs({ allChannels });
    const id = action === 'insert' ? 'pattern.insertRows' : 'pattern.deleteRows';
    runPatternCommand(id, args, () => {
      feedback = {
        key: action === 'insert' ? 'pattern.rowsInserted' : 'pattern.rowsDeleted',
        vars: { count: args.count },
      };
      renderWindow();
      syncStatus();
    });
  }

  function interpolateVelocity() {
    if (rejectProjectionMutation()) return;
    if (mode !== 'edit') return;
    if (!blockSelection) {
      feedback = { key: 'pattern.interpolateNeedsSelection' };
      syncStatus();
      return;
    }

    const { pattern } = projectInfo();
    runPatternCommand('pattern.interpolateVelocity', {
      patternId: pattern.id,
      ...blockSelection,
    }, (result) => {
      feedback = {
        key: result.changed
          ? 'pattern.velocityInterpolated'
          : 'pattern.velocityInterpolationNoop',
      };
      renderWindow();
      syncStatus();
    });
  }

  function projectedNotesAt(row = cursorRow, channel = cursorChannel) {
    const { project, pattern, tracks, displayRowTicks } = projectInfo();
    const track = tracks[channel];
    if (!track) return [];
    return notesAtDisplayCell(project, {
      patternId: pattern.id,
      trackId: track.id,
      row,
      rowTicks: displayRowTicks,
    });
  }

  function projectedCellHasOffGrid(row = cursorRow, channel = cursorChannel) {
    const { displayRowTicks } = projectInfo();
    return projectedNotesAt(row, channel).some(
      (note) => projectNoteToDisplayGrid(note, displayRowTicks).offGrid,
    );
  }

  function rejectProjectionMutation() {
    const { projectionOnly } = projectInfo();
    if (!projectionOnly) return false;
    pendingHex = null;
    feedback = { key: 'pattern.projectionReadOnly' };
    renderWindow();
    syncStatus();
    return true;
  }

  function rejectOffGridCellEdit() {
    if (rejectProjectionMutation()) return true;
    if (!projectedCellHasOffGrid()) return false;
    pendingHex = null;
    feedback = { key: 'pattern.offGridReadOnly' };
    renderWindow();
    syncStatus();
    return true;
  }

  function setDisplayLpb(nextLpb, { focusTick = null } = {}) {
    if (!SUPPORTED_LPB.includes(nextLpb) || nextLpb === displayLpb) {
      lpbSelect.value = String(displayLpb);
      return;
    }

    const before = projectInfo();
    const anchorTick = Number.isInteger(focusTick)
      ? focusTick
      : cursorRow * before.displayRowTicks;

    displayLpb = nextLpb;
    clearInputState();
    clearBlockSelection();

    const after = projectInfo();
    cursorRow = Math.max(
      0,
      Math.min(after.rowCount - 1, Math.floor(anchorTick / after.displayRowTicks)),
    );
    if (!after.fields.includes(cursorField)) cursorField = 'note';

    renderHeader();
    renderWindow();
    syncStatus();
    ensureCursorVisible();
  }

  function matchCurrentCellResolution() {
    const notes = projectedNotesAt();
    if (notes.length === 0) {
      feedback = { key: 'pattern.matchResolutionEmpty' };
      syncStatus();
      return;
    }

    const nextLpb = findMatchingLpb(
      notes.map((note) => note.startTickLocal),
      { currentLpb: displayLpb },
    );
    if (nextLpb === null) {
      feedback = { key: 'pattern.matchResolutionUnavailable' };
      syncStatus();
      return;
    }
    if (nextLpb === displayLpb) {
      feedback = { key: 'pattern.matchResolutionCurrent', vars: { lpb: displayLpb } };
      syncStatus();
      return;
    }

    const focusTick = notes[0].startTickLocal;
    setDisplayLpb(nextLpb, { focusTick });
    feedback = { key: 'pattern.matchResolutionApplied', vars: { lpb: nextLpb } };
    syncStatus();
  }

  function quantizeCurrentCell() {
    const { pattern, tracks, displayRowTicks } = projectInfo();
    const track = tracks[cursorChannel];
    const notes = projectedNotesAt().filter(
      (note) => projectNoteToDisplayGrid(note, displayRowTicks).offGrid,
    );
    if (!track || notes.length === 0) {
      feedback = { key: 'pattern.quantizeNothing' };
      syncStatus();
      return;
    }

    runPatternCommand('pattern.quantizeCell', {
      patternId: pattern.id,
      trackId: track.id,
      row: cursorRow,
      rowTicks: displayRowTicks,
    }, (result) => {
      feedback = {
        key: result.changed ? 'pattern.quantized' : 'pattern.quantizeNothing',
      };
      const info = projectInfo();
      if (!info.fields.includes(cursorField)) cursorField = 'note';
      renderHeader();
      renderWindow();
      syncStatus();
    });
  }

  function syncTimingControls() {
    const { displayRowTicks, pattern, projectionOnly } = projectInfo();
    lpbSelect.value = String(displayLpb);
    timingGroup.dataset.projectionOnly = projectionOnly ? 'true' : 'false';

    const notes = projectedNotesAt();
    const hasOffGrid = notes.some(
      (note) => projectNoteToDisplayGrid(note, displayRowTicks).offGrid,
    );
    matchLpbButton.disabled = !hasOffGrid;
    quantizeButton.disabled = !hasOffGrid;

    lpbSelect.title = projectionOnly
      ? t('pattern.projectionOnlyTitle', {
          lpb: displayLpb,
          defaultLpb: defaultLpbForPattern(pattern),
        })
      : t('pattern.resolutionDefaultTitle', { lpb: displayLpb });
  }

  function toggleMode() {
    clearInputState();
    mode = mode === 'edit' ? 'audition' : 'edit';
    syncStatus();
    renderWindow();
  }

  function enterPitch(pitch, { appendVoice = false } = {}) {
    if (cursorField !== 'note') return;

    const { project, pattern, tracks } = projectInfo();
    const track = tracks[cursorChannel];
    // AudioContext pertama bisa sibuk membuka perangkat. Selesaikan sel dulu,
    // lalu audisi di microtask yang sama; jam musikal tetap milik audio engine.
    if (mode === 'edit') queueMicrotask(() => onAudition?.(pitch));
    else onAudition?.(pitch);

    if (mode !== 'edit') return;
    if (rejectOffGridCellEdit()) return;

    if (appendVoice && track?.polyphony === 'poly' && track.kind !== 'drum') {
      let voiceLane;
      try {
        voiceLane = firstFreeVoiceLane(project, {
          patternId: pattern.id,
          trackId: track.id,
          row: cursorRow,
        });
      } catch (error) {
        if (error?.code !== 'E_PROJECT_VOICE_LANE_FULL') throw error;
        feedback = { key: 'pattern.polyVoiceFull' };
        syncStatus();
        return;
      }
      runPatternCommand('pattern.enterVoiceNote', {
        patternId: pattern.id,
        trackId: track.id,
        row: cursorRow,
        voiceLane,
        pitch,
      }, () => {
        feedback = { key: 'pattern.polyVoiceAdded', vars: { lane: voiceLane + 1 } };
        renderWindow();
        syncStatus();
      });
      return;
    }

    const expanded = projectInfo().geometry[cursorChannel].expanded;
    runPatternCommand(expanded ? 'pattern.enterVoiceNote' : 'pattern.enterNote', {
      patternId: pattern.id,
      trackId: track.id,
      row: cursorRow,
      pitch,
      ...(expanded ? { voiceLane: cursorVoiceLane } : {}),
    }, () => moveVertical(step));
  }

  function toggleDrumHit(code) {
    if (cursorField !== 'note') return false;
    const hit = DRUM_KEYS.get(code);
    if (!hit) return false;

    const { project, pattern, tracks } = projectInfo();
    const track = tracks[cursorChannel];
    if (track?.kind !== 'drum') return false;

    onInstrumentAudition?.(track.defaultInstrumentId, hit.pitch);
    if (mode !== 'edit') return true;
    if (rejectOffGridCellEdit()) return true;

    const hits = notesAtCell(project, {
      patternId: pattern.id,
      trackId: track.id,
      row: cursorRow,
    });
    const existing = hits.find((note) => (note.voiceLane ?? 0) === hit.voiceLane);

    if (existing?.pitch === hit.pitch) {
      runPatternCommand('pattern.deleteVoiceNote', {
        patternId: pattern.id,
        trackId: track.id,
        row: cursorRow,
        voiceLane: hit.voiceLane,
      });
    } else {
      runPatternCommand('pattern.enterVoiceNote', {
        patternId: pattern.id,
        trackId: track.id,
        row: cursorRow,
        voiceLane: hit.voiceLane,
        pitch: hit.pitch,
      });
    }
    renderWindow();
    syncStatus();
    return true;
  }

  function toolButton(action, label, icon, onClick, shortcut = null) {
    const button = Button({
      label,
      icon,
      iconOnly: true,
      variant: 'ghost',
      onClick,
    });
    button.dataset.action = action;
    return Tooltip({ text: label, shortcut, child: button });
  }

  function clearInputState() {
    pendingHex = null;
    feedback = null;
  }

  function adjustOctave(delta) {
    clearInputState();
    octave = Math.max(0, Math.min(8, octave + delta));
    syncStatus();
    scroller.focus({ preventScroll: true });
  }

  function adjustStep(delta) {
    clearInputState();
    step = Math.max(0, Math.min(16, step + delta));
    syncStatus();
    scroller.focus({ preventScroll: true });
  }

  function handleHexInput(digit) {
    if (mode !== 'edit' || cursorField === 'note' || cursorField === 'delay') return false;
    if (rejectOffGridCellEdit()) return true;

    const { project, pattern, tracks } = projectInfo();
    const track = tracks[cursorChannel];
    const note = noteAtCell(project, { patternId: pattern.id, trackId: track.id, row: cursorRow, voiceLane: cursorVoiceLane });
    if (!note) {
      pendingHex = null;
      feedback = { key: 'pattern.hintNeedsNote' };
      renderWindow();
      syncStatus();
      return true;
    }

    const sameCell = pendingHex
      && pendingHex.row === cursorRow
      && pendingHex.channel === cursorChannel
      && pendingHex.field === cursorField
      && pendingHex.voiceLane === cursorVoiceLane;

    if (!sameCell) {
      pendingHex = { row: cursorRow, channel: cursorChannel, field: cursorField, voiceLane: cursorVoiceLane, first: digit };
      feedback = null;
      renderWindow();
      syncStatus();
      return true;
    }

    const valueText = `${pendingHex.first}${digit}`;
    const value = Number.parseInt(valueText, 16);
    pendingHex = null;

    if (cursorField === 'instrument') {
      if (value < 1 || value > project.instruments.length) {
        feedback = { key: 'pattern.invalidInstrument', vars: { value: valueText } };
        renderWindow();
        syncStatus();
        return true;
      }

      feedback = null;
      runPatternCommand('pattern.updateNote', {
        patternId: pattern.id,
        trackId: track.id,
        row: cursorRow,
        instrumentId: project.instruments[value - 1].id,
        voiceLane: cursorVoiceLane,
      }, () => moveHorizontal(1));
      return true;
    }

    if (value > 0x7F) {
      feedback = { key: 'pattern.invalidVolume', vars: { value: valueText } };
      renderWindow();
      syncStatus();
      return true;
    }

    feedback = null;
    runPatternCommand('pattern.updateNote', {
      patternId: pattern.id,
      trackId: track.id,
      row: cursorRow,
      velocity: value,
      voiceLane: cursorVoiceLane,
    }, () => moveVertical(step));
    return true;
  }

  function emptyFirstCell(project, note, field, row, channel) {
    return !note
      && field === 'note'
      && row === 0
      && channel === 0
      && getActivePattern(project).notes.length === 0;
  }

  function displayCellText(
    project,
    note,
    field,
    row,
    channel,
    projectedNotes = [],
    projectedEffects = [],
    voiceLane = 0,
  ) {
    const track = project.song.tracks[channel];
    const pattern = getActivePattern(project);
    const displayRowTicks = projectInfo().displayRowTicks;
    const delays = [
      ...projectedNotes.map(
        (item) => projectNoteToDisplayGrid(item, displayRowTicks).delayTicks,
      ),
      ...projectedEffects.map((effect) => effect.tickLocal % displayRowTicks),
    ];
    const hasOffGrid = delays.some((delay) => delay !== 0);

    if (field === 'delay') {
      if (projectedNotes.length === 0 && projectedEffects.length === 0) return '··';
      const unique = [...new Set(delays)].sort((a, b) => a - b);
      if (unique.length === 1) return unique[0] === 0 ? '0t' : `+${unique[0]}t`;
      return `+${unique[0]}…+${unique[unique.length - 1]}`;
    }

    if (field === 'effect' || field === 'param') {
      const summary = summarizeEffects(projectedEffects);
      return field === 'effect' ? summary.fx : summary.param;
    }

    if (field === 'note' && track?.kind === 'drum') {
      if (projectedNotes.length > 0) {
        const text = projectedNotes
          .map((hit) => DRUM_PITCH_LABELS.get(hit.pitch) ?? '•')
          .join('');
        return hasOffGrid ? `${text}⌁` : text;
      }
      if (emptyFirstCell(project, note, field, row, channel)) {
        return t('pattern.emptyDrumCell');
      }
      return '···';
    }

    if (emptyFirstCell(project, note, field, row, channel)) {
      return t('pattern.emptyCell');
    }
    if (
      pendingHex
      && pendingHex.row === row
      && pendingHex.channel === channel
      && pendingHex.field === field
      && pendingHex.voiceLane === voiceLane
    ) {
      return `${pendingHex.first}_`;
    }

    const text = cellText(project, note, field);
    if (field !== 'note' || !note) return text;
    const suffix = [
      hasOffGrid ? '⌁' : '',
      projectedNotes.length > 1 ? `×${projectedNotes.length}` : '',
    ].join('');
    return `${text}${suffix}`;
  }

  function cellTitle(
    project,
    note,
    field,
    row,
    channel,
    projectedNotes = [],
    projectedEffects = [],
  ) {
    if (emptyFirstCell(project, note, field, row, channel)) {
      return t('pattern.emptyCellTitle');
    }
    if (field === 'effect' || field === 'param') {
      return summarizeEffects(projectedEffects).title;
    }
    if (projectedNotes.length === 0 && projectedEffects.length === 0) return null;

    const displayRowTicks = projectInfo().displayRowTicks;
    const delays = [
      ...projectedNotes.map(
        (item) => projectNoteToDisplayGrid(item, displayRowTicks).delayTicks,
      ),
      ...projectedEffects.map((effect) => effect.tickLocal % displayRowTicks),
    ];
    const offGridCount = delays.filter((delay) => delay !== 0).length;
    if (offGridCount === 0) return null;

    return t('pattern.offGridCellTitle', {
      count: projectedNotes.length,
      delays: [...new Set(delays)].map((delay) => `+${delay}t`).join(', '),
    });
  }

  function deleteCurrentEvent() {
    if (mode !== 'edit') return;
    if (cursorField === 'effect' || cursorField === 'param') {
      deleteEffectAtCursor();
      return;
    }
    // Instrument dan velocity wajib ada pada NoteEvent, jadi Delete pada INST/VOL
    // tidak dimaknai "kosongkan field". Hanya NOTE yang menghapus seluruh event.
    if (cursorField !== 'note') return;
    if (rejectOffGridCellEdit()) return;

    const { pattern, tracks } = projectInfo();
    const track = tracks[cursorChannel];
    const expanded = projectInfo().geometry[cursorChannel].expanded;
    runPatternCommand(
      expanded ? 'pattern.deleteVoiceNote'
        : track.polyphony === 'poly' ? 'pattern.clearVoiceRow' : 'pattern.deleteNote',
      {
        patternId: pattern.id,
        trackId: track.id,
        row: cursorRow,
        ...(expanded ? { voiceLane: cursorVoiceLane } : {}),
      },
    );
    renderWindow();
    syncStatus();
  }

  function syncStatus() {
    modeButton.querySelector('.btn__label').textContent = t(mode === 'edit' ? 'status.edit' : 'status.audisi');
    modeButton.setAttribute('aria-pressed', mode === 'edit' ? 'true' : 'false');
    scroller.classList.toggle('is-edit', mode === 'edit');
    scroller.classList.toggle('is-audition', mode !== 'edit');
    octaveText.textContent = `${t('status.octave')} ${octave}`;
    stepText.textContent = `${t('status.step')} ${step}`;
    const currentInfo = projectInfo();
    const currentTrack = currentInfo.tracks[cursorChannel];
    addChannelButton.disabled = currentInfo.tracks.length >= MAX_CHANNELS;
    if (feedback) {
      hint.textContent = t(feedback.key, feedback.vars);
    } else if (blockSelection) {
      hint.textContent = t('pattern.blockHint', {
        rows: blockSelection.rowEnd - blockSelection.rowStart + 1,
        channels: blockSelection.channelEnd - blockSelection.channelStart + 1,
      });
    } else if (currentInfo.projectionOnly) {
      hint.textContent = t('pattern.projectionReadOnly');
    } else if (cursorField === 'note' && currentTrack?.kind === 'drum') {
      hint.textContent = t(mode === 'edit' ? 'pattern.hintDrum' : 'pattern.hintDrumAudition');
    } else if (mode !== 'edit') {
      hint.textContent = t('pattern.hintAudition');
    } else if (cursorField === 'note' && currentTrack?.polyphony === 'poly') {
      hint.textContent = t('pattern.hintPolyEdit');
    } else if (cursorField === 'note') {
      hint.textContent = t('pattern.hintEdit');
    } else if (cursorField === 'instrument') {
      hint.textContent = t('pattern.hintInstrument', {
        max: formatHexByte(projectInfo().project.instruments.length),
      });
    } else if (cursorField === 'delay') {
      hint.textContent = t('pattern.hintDelay');
    } else if (cursorField === 'effect' || cursorField === 'param') {
      hint.textContent = t('pattern.hintEffect');
    } else {
      hint.textContent = t('pattern.hintVolume');
    }
    syncTimingControls();
    syncEffectEditor();
    onStatus?.({
      mode,
      octave,
      step,
      row: cursorRow,
      displayLpb,
      displayRowTicks: currentInfo.displayRowTicks,
    });
  }

  function refresh() {
    // Command dari Pattern UI sudah merender sekali setelah cursor/selection final.
    // Hindari rebuild sinkron kedua dari commitProject pada jalur yang sama.
    if (suppressCommandRefresh) return;

    // Refresh dari history/command eksternal harus membuang input dua-nibble yang
    // belum menjadi transaksi project.
    clearInputState();
    const { fields, tracks } = projectInfo();
    cursorChannel = Math.min(cursorChannel, Math.max(0, tracks.length - 1));
    if (!fields.includes(cursorField)) cursorField = 'note';
    renderHeaderIfNeeded();
    renderWindow();
    syncSharedPatternBadge();
    syncTimingControls();
    syncStatus();
    syncEffectEditor();
  }

  function normalizeCursorLane() {
    const track = projectInfo().geometry[cursorChannel];
    if (!track?.expanded || !BASE_FIELDS.includes(cursorField)
      || !track.lanes.includes(cursorVoiceLane)) cursorVoiceLane = 0;
  }

  scroller.addEventListener('scroll', () => renderWindow());
  scroller.addEventListener('keydown', (event) => {
    if (keymapPreset === 'openmpt' && event.code === 'Tab') {
      event.preventDefault();
      clearInputState();
      clearBlockSelection();
      const { tracks } = projectInfo();
      const delta = event.shiftKey ? -1 : 1;
      cursorChannel = (cursorChannel + delta + tracks.length) % tracks.length;
      renderWindow();
      syncStatus();
      ensureCursorVisible();
      return;
    }
    if (event.ctrlKey && event.code === 'KeyE') {
      event.preventDefault();
      toggleMode();
      return;
    }
    if (event.ctrlKey && event.code === 'KeyA') {
      event.preventDefault();
      selectProgressively();
      return;
    }
    if (event.ctrlKey && event.code === 'KeyC') {
      event.preventDefault();
      copyBlock();
      return;
    }
    if (event.ctrlKey && event.code === 'KeyV') {
      event.preventDefault();
      pasteBlock();
      return;
    }
    if (event.ctrlKey && event.code === 'KeyJ') {
      event.preventDefault();
      interpolateVelocity();
      return;
    }
    if (event.ctrlKey && event.code === 'Insert') {
      event.preventDefault();
      editRows('insert', { allChannels: true });
      return;
    }
    if (event.ctrlKey && event.code === 'Backspace') {
      event.preventDefault();
      editRows('delete', { allChannels: true });
      return;
    }
    if (event.ctrlKey && event.code === 'ArrowUp') {
      event.preventDefault();
      transposeBlock(event.shiftKey ? 12 : 1);
      return;
    }
    if (event.ctrlKey && event.code === 'ArrowDown') {
      event.preventDefault();
      transposeBlock(event.shiftKey ? -12 : -1);
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.shiftKey && event.code === 'ArrowUp') {
      event.preventDefault();
      moveVertical(-1, { extend: true });
      return;
    }
    if (event.shiftKey && event.code === 'ArrowDown') {
      event.preventDefault();
      moveVertical(1, { extend: true });
      return;
    }
    if (event.shiftKey && event.code === 'ArrowLeft') {
      event.preventDefault();
      moveBlockChannel(-1);
      return;
    }
    if (event.shiftKey && event.code === 'ArrowRight') {
      event.preventDefault();
      moveBlockChannel(1);
      return;
    }
    if (event.code === 'Escape' && blockSelection) {
      event.preventDefault();
      clearInputState();
      clearBlockSelection();
      renderWindow();
      syncStatus();
      return;
    }

    if (DRUM_KEYS.has(event.code) && toggleDrumHit(event.code)) {
      event.preventDefault();
      return;
    }

    if (event.code === 'ArrowUp') {
      event.preventDefault();
      moveVertical(-1);
      return;
    }
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      moveVertical(1);
      return;
    }
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      moveHorizontal(-1);
      return;
    }
    if (event.code === 'ArrowRight') {
      event.preventDefault();
      moveHorizontal(1);
      return;
    }
    if (event.code === 'Insert') {
      event.preventDefault();
      editRows('insert');
      return;
    }
    if (event.code === 'Backspace') {
      event.preventDefault();
      clearInputState();
      if (cursorField === 'note' || blockSelection) {
        editRows('delete');
      } else {
        syncStatus();
      }
      return;
    }
    if (event.code === 'Delete') {
      event.preventDefault();
      clearInputState();
      deleteCurrentEvent();
      return;
    }
    if (
      event.code === 'Enter'
      && (cursorField === 'effect' || cursorField === 'param')
      && !effectEditor.hidden
    ) {
      event.preventDefault();
      selectExistingEffectTypeAtCursor();
      syncEffectEditor();
      effectParamInput.focus();
      effectParamInput.select();
      return;
    }

    const hexDigit = HEX_CODES.get(event.code);
    if (hexDigit !== undefined && ['instrument', 'volume'].includes(cursorField)) {
      event.preventDefault();
      handleHexInput(hexDigit);
      return;
    }

    if (event.code === 'Minus') {
      event.preventDefault();
      adjustOctave(-1);
      return;
    }
    if (event.code === 'Equal') {
      event.preventDefault();
      adjustOctave(1);
      return;
    }

    const semitone = NOTE_CODES.get(event.code);
    if (semitone === undefined) return;
    const pitch = octave * 12 + 12 + semitone;
    if (pitch > 127) return;
    event.preventDefault();
    enterPitch(pitch, { appendVoice: event.shiftKey });
  });

  refresh();
  requestAnimationFrame(() => renderWindow());

  return {
    focus: () => scroller.focus(),
    refresh,
    setPlaybackState,
    toggleMode: () => {
      toggleMode();
      return mode;
    },
    getActiveTrackId: () => projectInfo().tracks[cursorChannel]?.id ?? null,
    getUiState: () => ({
      mode,
      octave,
      step,
      row: cursorRow,
      channel: cursorChannel,
      field: cursorField,
      voiceLane: cursorVoiceLane,
      displayLpb,
      displayRowTicks: projectInfo().displayRowTicks,
      projectionOnly: projectInfo().projectionOnly,
      fxColumnsVisible: projectInfo().showEffects,
      selectedEffectType,
      selection: blockSelection ? { ...blockSelection } : null,
    }),
  };
}

function defaultLpbForPattern(pattern) {
  return SUPPORTED_LPB.find((lpb) => rowTicksForLpb(lpb) === pattern.rowTicks) ?? 4;
}

function cellText(project, note, field) {
  if (!note) return field === 'note' ? '···' : '··';
  if (field === 'note') return formatPitch(note.pitch);
  if (field === 'instrument') return formatInstrument(project, note.instrumentId);
  return formatHexByte(note.velocity);
}

function formatInstrument(project, instrumentId) {
  const index = project.instruments.findIndex((instrument) => instrument.id === instrumentId);
  return index >= 0 ? (index + 1).toString(16).toUpperCase().padStart(2, '0') : '??';
}

function formatHexByte(value) {
  return Number(value).toString(16).toUpperCase().padStart(2, '0');
}

function formatPitch(pitch) {
  const octave = Math.floor(pitch / 12) - 1;
  return `${NOTE_NAMES[pitch % 12]}${octave}`;
}
