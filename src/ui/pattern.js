// Pattern editor: DOM windowed, proyeksi NOTE | INST | VOL dan DLY bila ada event off-grid.
// View tidak pernah menulis project langsung; semua mutasi lewat command registry.

import { patternUsageCount } from '../core/arrangement.js';
import {
  findMatchingLpb,
  notesAtDisplayCell,
  patternHasOffGridNotes,
  projectNoteToDisplayGrid,
  rowTicksForLpb,
  SUPPORTED_LPB,
} from '../core/pattern-grid.js';
import { activePattern, noteAtCell, notesAtCell } from '../core/project.js';
import { isDrumKitInstrument } from '../core/sound-model.js';
import { el } from './dom.js';
import { Button, Popover, Tooltip } from './kit.js';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 92;
const ROW_NUMBER_WIDTH = 46;
const NOTE_WIDTH = 64;
const INST_WIDTH = 42;
const VOL_WIDTH = 42;
const DLY_WIDTH = 58;
const BASE_FIELDS = ['note', 'instrument', 'volume'];
const FIELD_WIDTHS = Object.freeze({
  note: NOTE_WIDTH,
  instrument: INST_WIDTH,
  volume: VOL_WIDTH,
  delay: DLY_WIDTH,
});
const OVERSCAN = 4;

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
  initialMode = 'audition',
}) {
  let cursorRow = 0;
  let cursorChannel = 0;
  let cursorField = 'note';
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
  const trackUi = new Map();

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

  const toolbar = el('div', { class: 'pattern-toolbar' }, [
    modeControl,
    octaveGroup,
    stepGroup,
    timingGroup,
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
    try {
      const result = registry.execute(id, args);
      onSuccess?.(result);
      return true;
    } catch (error) {
      if (error?.code !== 'E_SHARED_PATTERN_DECISION_REQUIRED') throw error;
      pendingSharedEdit = {
        id,
        args: structuredClone(args),
        onSuccess,
      };
      showSharedWarning(error.details);
      return false;
    }
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
    const displayRowTicks = rowTicksForLpb(displayLpb);
    const fields = patternHasOffGridNotes(pattern, displayRowTicks)
      ? [...BASE_FIELDS, 'delay']
      : BASE_FIELDS;
    return {
      project,
      pattern,
      tracks: project.song.tracks,
      fields,
      displayRowTicks,
      projectionOnly: displayRowTicks !== pattern.rowTicks,
      rowCount: Math.ceil(pattern.lengthTicks / displayRowTicks),
    };
  }

  function dataColumns(tracks, fields) {
    return tracks.flatMap(() => fields.map((field) => FIELD_WIDTHS[field]));
  }

  function channelWidth(fields) {
    return fields.reduce((sum, field) => sum + FIELD_WIDTHS[field], 0);
  }

  function rowTemplate(tracks, fields) {
    return `${ROW_NUMBER_WIDTH}px ${dataColumns(tracks, fields).map((width) => `${width}px`).join(' ')}`;
  }

  function renderHeader() {
    const { project, pattern, tracks, fields } = projectInfo();
    header.textContent = '';

    trackUi.clear();
    const channelRow = el('div', { class: 'pattern-grid__header-row pattern-grid__header-row--channel', role: 'row' });
    channelRow.style.gridTemplateColumns = `${ROW_NUMBER_WIDTH}px repeat(${tracks.length}, ${channelWidth(fields)}px)`;
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

      const controls = el('span', { class: 'pattern-channel__controls' }, [mute, solo, meter]);
      const channel = el('div', {
        class: `pattern-grid__channel${track.kind === 'drum' ? ' is-drum' : ''}`,
        role: 'columnheader',
        'aria-colindex': String(index * fields.length + 1),
        'aria-colspan': String(fields.length),
      }, [label, instrumentSelect, controls]);
      channelRow.append(channel);
      trackUi.set(track.id, { channel, mute, solo, meter, meterFill });
    });

    const fieldRow = el('div', { class: 'pattern-grid__header-row pattern-grid__header-row--field', role: 'row' });
    fieldRow.style.gridTemplateColumns = rowTemplate(tracks, fields);
    fieldRow.append(el('div', { class: 'pattern-grid__corner', 'aria-hidden': 'true' }));

    tracks.forEach((track, channel) => {
      const labels = fields.map((field) => [
        field,
        t({
          note: 'pattern.columnNote',
          instrument: 'pattern.columnInstrument',
          volume: 'pattern.columnVolume',
          delay: 'pattern.columnDelay',
        }[field]),
      ]);
      labels.forEach(([field, label], fieldIndex) => {
        fieldRow.append(el('div', {
          class: `pattern-grid__field-header pattern-grid__field-header--${field}`,
          role: 'columnheader',
          'aria-colindex': String(channel * fields.length + fieldIndex + 1),
          dataset: { channel: String(channel), field },
          text: label,
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
        audible: true,
      };
      const level = Math.max(0, Math.min(1, Number(state.level) || 0));
      ui.meterFill.style.width = `${Math.round(level * 100)}%`;
      ui.meter.dataset.level = level.toFixed(3);
      ui.meter.setAttribute('aria-valuenow', String(Math.round(level * 100)));
      ui.mute.setAttribute('aria-pressed', state.mute ? 'true' : 'false');
      ui.solo.setAttribute('aria-pressed', state.solo ? 'true' : 'false');
      ui.channel.classList.toggle('is-muted', Boolean(state.mute));
      ui.channel.classList.toggle('is-solo', Boolean(state.solo));
      ui.channel.classList.toggle('is-inaudible', !state.audible);
    }
  }

  function renderWindow() {
    const { project, pattern, tracks, fields, displayRowTicks, rowCount } = projectInfo();
    const width = ROW_NUMBER_WIDTH + tracks.length * channelWidth(fields);
    const height = HEADER_HEIGHT + rowCount * ROW_HEIGHT;
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    scroller.setAttribute('aria-rowcount', String(rowCount));
    scroller.setAttribute('aria-colcount', String(tracks.length * fields.length));

    const viewportRows = Math.ceil((scroller.clientHeight || 420) / ROW_HEIGHT);
    const first = Math.max(0, Math.floor(Math.max(0, scroller.scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN);
    const last = Math.min(rowCount, first + viewportRows + OVERSCAN * 2);

    rowsLayer.textContent = '';
    for (let row = first; row < last; row += 1) {
      const isPlayhead = row === playbackRow;
      const rowNode = el('div', {
        class: `pattern-grid__row${isPlayhead ? ' is-playhead' : ''}`,
        role: 'row',
        'aria-rowindex': String(row + 1),
        'aria-current': isPlayhead ? 'true' : null,
        dataset: { row: String(row) },
      });
      rowNode.style.top = `${HEADER_HEIGHT + row * ROW_HEIGHT}px`;
      rowNode.style.gridTemplateColumns = rowTemplate(tracks, fields);

      rowNode.append(el('div', {
        class: 'pattern-grid__row-number',
        role: 'rowheader',
        text: row.toString(16).toUpperCase().padStart(2, '0'),
      }));

      tracks.forEach((track, channel) => {
        const projectedNotes = notesAtDisplayCell(project, {
          patternId: pattern.id,
          trackId: track.id,
          row,
          rowTicks: displayRowTicks,
        });
        const note = projectedNotes[0] ?? null;
        fields.forEach((field, fieldIndex) => {
          const selected = row === cursorRow && channel === cursorChannel && field === cursorField;
          const blockSelected = isBlockSelected(row, channel);
          rowNode.append(el('div', {
            class: `pattern-grid__cell pattern-grid__cell--${field}${blockSelected ? ' is-block-selected' : ''}${selected ? ' is-cursor' : ''}`,
            role: 'gridcell',
            'aria-colindex': String(channel * fields.length + fieldIndex + 1),
            'aria-selected': selected || blockSelected ? 'true' : 'false',
            dataset: {
              action: 'pattern-cell',
              row: String(row),
              channel: String(channel),
              field,
              trackId: track.id,
            },
            text: displayCellText(project, note, field, row, channel, projectedNotes),
            title: cellTitle(project, note, field, row, channel, projectedNotes),
            on: {
              click: () => {
                clearInputState();
                clearBlockSelection();
                cursorRow = row;
                cursorChannel = channel;
                cursorField = field;
                scroller.focus();
                renderWindow();
                syncStatus();
              },
            },
          }));
        });
      });
      rowsLayer.append(rowNode);
    }
  }

  function ensurePlaybackVisible(row) {
    if (playbackState !== 'playing') return;
    const viewport = Math.max(ROW_HEIGHT, scroller.clientHeight - HEADER_HEIGHT);
    const rowTop = HEADER_HEIGHT + row * ROW_HEIGHT;
    const visibleTop = scroller.scrollTop + HEADER_HEIGHT;
    const visibleBottom = scroller.scrollTop + scroller.clientHeight;
    const margin = ROW_HEIGHT * 3;

    if (rowTop < visibleTop + margin || rowTop + ROW_HEIGHT > visibleBottom - margin) {
      const target = rowTop - HEADER_HEIGHT - Math.floor(viewport * 0.42);
      scroller.scrollTop = Math.max(0, target);
    }
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
    const { fields } = projectInfo();
    const top = HEADER_HEIGHT + cursorRow * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < scroller.scrollTop + HEADER_HEIGHT) {
      scroller.scrollTop = Math.max(0, top - HEADER_HEIGHT);
    } else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight;
    }

    const fieldIndex = Math.max(0, fields.indexOf(cursorField));
    const widths = fields.map((field) => FIELD_WIDTHS[field]);
    const fieldOffset = widths.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
    const fieldWidth = widths[fieldIndex];
    const left = ROW_NUMBER_WIDTH + cursorChannel * channelWidth(fields) + fieldOffset;
    const right = left + fieldWidth;
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
    const { tracks, fields } = projectInfo();
    const fieldIndex = Math.max(0, fields.indexOf(cursorField));
    const flat = Math.max(
      0,
      Math.min(tracks.length * fields.length - 1, cursorChannel * fields.length + fieldIndex + delta),
    );
    cursorChannel = Math.floor(flat / fields.length);
    cursorField = fields[flat % fields.length];
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

  function enterPitch(pitch) {
    if (cursorField !== 'note') return;

    const { pattern, tracks } = projectInfo();
    onAudition?.(pitch);

    if (mode !== 'edit') return;
    if (rejectOffGridCellEdit()) return;

    runPatternCommand('pattern.enterNote', {
      patternId: pattern.id,
      trackId: tracks[cursorChannel].id,
      row: cursorRow,
      pitch,
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
    const note = noteAtCell(project, { patternId: pattern.id, trackId: track.id, row: cursorRow });
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
      && pendingHex.field === cursorField;

    if (!sameCell) {
      pendingHex = { row: cursorRow, channel: cursorChannel, field: cursorField, first: digit };
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

  function displayCellText(project, note, field, row, channel, projectedNotes = []) {
    const track = project.song.tracks[channel];
    const pattern = getActivePattern(project);
    const delays = projectedNotes.map(
      (item) => projectNoteToDisplayGrid(item, projectInfo().displayRowTicks).delayTicks,
    );
    const hasOffGrid = delays.some((delay) => delay !== 0);

    if (field === 'delay') {
      if (projectedNotes.length === 0) return '··';
      const unique = [...new Set(delays)].sort((a, b) => a - b);
      if (unique.length === 1) return unique[0] === 0 ? '0t' : `+${unique[0]}t`;
      return `+${unique[0]}…+${unique[unique.length - 1]}`;
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

  function cellTitle(project, note, field, row, channel, projectedNotes = []) {
    if (emptyFirstCell(project, note, field, row, channel)) {
      return t('pattern.emptyCellTitle');
    }
    if (projectedNotes.length === 0) return null;

    const pattern = getActivePattern(project);
    const delays = projectedNotes.map(
      (item) => projectNoteToDisplayGrid(item, projectInfo().displayRowTicks).delayTicks,
    );
    const offGridCount = delays.filter((delay) => delay !== 0).length;
    if (offGridCount === 0) return null;

    return t('pattern.offGridCellTitle', {
      count: projectedNotes.length,
      delays: [...new Set(delays)].map((delay) => `+${delay}t`).join(', '),
    });
  }

  function deleteCurrentEvent() {
    // Instrument dan velocity wajib ada pada NoteEvent, jadi Delete pada INST/VOL
    // tidak dimaknai "kosongkan field". Hanya NOTE yang menghapus seluruh event.
    if (mode !== 'edit' || cursorField !== 'note') return;
    if (rejectOffGridCellEdit()) return;

    const { pattern, tracks } = projectInfo();
    const track = tracks[cursorChannel];
    runPatternCommand(
      track.kind === 'drum' ? 'pattern.clearVoiceRow' : 'pattern.deleteNote',
      {
        patternId: pattern.id,
        trackId: track.id,
        row: cursorRow,
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
    } else if (cursorField === 'note') {
      hint.textContent = t('pattern.hintEdit');
    } else if (cursorField === 'instrument') {
      hint.textContent = t('pattern.hintInstrument', {
        max: formatHexByte(projectInfo().project.instruments.length),
      });
    } else if (cursorField === 'delay') {
      hint.textContent = t('pattern.hintDelay');
    } else {
      hint.textContent = t('pattern.hintVolume');
    }
    syncTimingControls();
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
    // Refresh dari history/command eksternal harus membuang input dua-nibble yang
    // belum menjadi transaksi project.
    clearInputState();
    const { fields } = projectInfo();
    if (!fields.includes(cursorField)) cursorField = 'note';
    renderHeader();
    renderWindow();
    syncSharedPatternBadge();
    syncTimingControls();
    syncStatus();
  }

  scroller.addEventListener('scroll', () => renderWindow());
  scroller.addEventListener('keydown', (event) => {
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
    enterPitch(pitch);
  });

  refresh();
  requestAnimationFrame(() => renderWindow());

  return {
    focus: () => scroller.focus(),
    refresh,
    setPlaybackState,
    getActiveTrackId: () => projectInfo().tracks[cursorChannel]?.id ?? null,
    getUiState: () => ({
      mode,
      octave,
      step,
      row: cursorRow,
      channel: cursorChannel,
      field: cursorField,
      displayLpb,
      displayRowTicks: projectInfo().displayRowTicks,
      projectionOnly: projectInfo().projectionOnly,
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
