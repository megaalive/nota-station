// Pattern editor R1: DOM windowed, 8 channel, kolom tracker NOTE | INST | VOL.
// View tidak pernah menulis project langsung; semua mutasi lewat command registry.

import { activePattern, noteAtCell } from '../core/project.js';
import { el } from './dom.js';
import { Button } from './kit.js';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 52;
const ROW_NUMBER_WIDTH = 46;
const NOTE_WIDTH = 64;
const INST_WIDTH = 42;
const VOL_WIDTH = 42;
const CHANNEL_WIDTH = NOTE_WIDTH + INST_WIDTH + VOL_WIDTH;
const FIELDS = ['note', 'instrument', 'volume'];
const OVERSCAN = 4;

const NOTE_CODES = new Map([
  ['KeyZ', 0], ['KeyS', 1], ['KeyX', 2], ['KeyD', 3], ['KeyC', 4], ['KeyV', 5],
  ['KeyG', 6], ['KeyB', 7], ['KeyH', 8], ['KeyN', 9], ['KeyJ', 10], ['KeyM', 11],
  ['KeyQ', 12], ['Digit2', 13], ['KeyW', 14], ['Digit3', 15], ['KeyE', 16], ['KeyR', 17],
  ['Digit5', 18], ['KeyT', 19], ['Digit6', 20], ['KeyY', 21], ['Digit7', 22], ['KeyU', 23],
]);

const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

export function createPatternView({
  root,
  t,
  getProject,
  registry,
  onAudition,
  onStatus,
}) {
  let cursorRow = 0;
  let cursorChannel = 0;
  let cursorField = 'note';
  let mode = 'audition';
  let octave = 4;
  let step = 1;

  const modeButton = Button({
    label: t('status.audisi'),
    variant: 'default',
    onClick: () => toggleMode(),
  });
  modeButton.dataset.action = 'pattern-mode';

  const octaveText = el('span', { class: 'pattern-toolbar__meta', dataset: { action: 'pattern-octave' } });
  const stepText = el('span', { class: 'pattern-toolbar__meta', dataset: { action: 'pattern-step' } });
  const hint = el('span', { class: 'pattern-toolbar__hint', dataset: { action: 'pattern-hint' } });

  const toolbar = el('div', { class: 'pattern-toolbar' }, [
    modeButton,
    octaveText,
    stepText,
    hint,
  ]);

  const scroller = el('div', {
    class: 'pattern-grid is-audition',
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

  function projectInfo() {
    const project = getProject();
    const pattern = activePattern(project);
    return {
      project,
      pattern,
      tracks: project.song.tracks,
      rowCount: pattern.lengthTicks / pattern.rowTicks,
    };
  }

  function dataColumns(tracks) {
    return tracks.flatMap(() => [NOTE_WIDTH, INST_WIDTH, VOL_WIDTH]);
  }

  function rowTemplate(tracks) {
    return `${ROW_NUMBER_WIDTH}px ${dataColumns(tracks).map((width) => `${width}px`).join(' ')}`;
  }

  function renderHeader() {
    const { tracks } = projectInfo();
    header.textContent = '';

    const channelRow = el('div', { class: 'pattern-grid__header-row pattern-grid__header-row--channel', role: 'row' });
    channelRow.style.gridTemplateColumns = `${ROW_NUMBER_WIDTH}px repeat(${tracks.length}, ${CHANNEL_WIDTH}px)`;
    channelRow.append(el('div', {
      class: 'pattern-grid__corner pattern-grid__corner--channel',
      'aria-hidden': 'true',
      text: '#',
    }));

    tracks.forEach((track, index) => {
      channelRow.append(el('div', {
        class: 'pattern-grid__channel',
        role: 'columnheader',
        'aria-colindex': String(index * FIELDS.length + 1),
        'aria-colspan': String(FIELDS.length),
        text: `${index + 1} · ${track.name}`,
      }));
    });

    const fieldRow = el('div', { class: 'pattern-grid__header-row pattern-grid__header-row--field', role: 'row' });
    fieldRow.style.gridTemplateColumns = rowTemplate(tracks);
    fieldRow.append(el('div', { class: 'pattern-grid__corner', 'aria-hidden': 'true' }));

    tracks.forEach((track, channel) => {
      const labels = [
        ['note', t('pattern.columnNote')],
        ['instrument', t('pattern.columnInstrument')],
        ['volume', t('pattern.columnVolume')],
      ];
      labels.forEach(([field, label], fieldIndex) => {
        fieldRow.append(el('div', {
          class: `pattern-grid__field-header pattern-grid__field-header--${field}`,
          role: 'columnheader',
          'aria-colindex': String(channel * FIELDS.length + fieldIndex + 1),
          dataset: { channel: String(channel), field },
          text: label,
        }));
      });
    });

    header.append(channelRow, fieldRow);
  }

  function renderWindow() {
    const { project, pattern, tracks, rowCount } = projectInfo();
    const width = ROW_NUMBER_WIDTH + tracks.length * CHANNEL_WIDTH;
    const height = HEADER_HEIGHT + rowCount * ROW_HEIGHT;
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    scroller.setAttribute('aria-rowcount', String(rowCount));
    scroller.setAttribute('aria-colcount', String(tracks.length * FIELDS.length));

    const viewportRows = Math.ceil((scroller.clientHeight || 420) / ROW_HEIGHT);
    const first = Math.max(0, Math.floor(Math.max(0, scroller.scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN);
    const last = Math.min(rowCount, first + viewportRows + OVERSCAN * 2);

    rowsLayer.textContent = '';
    for (let row = first; row < last; row += 1) {
      const rowNode = el('div', {
        class: 'pattern-grid__row',
        role: 'row',
        'aria-rowindex': String(row + 1),
      });
      rowNode.style.top = `${HEADER_HEIGHT + row * ROW_HEIGHT}px`;
      rowNode.style.gridTemplateColumns = rowTemplate(tracks);

      rowNode.append(el('div', {
        class: 'pattern-grid__row-number',
        role: 'rowheader',
        text: row.toString(16).toUpperCase().padStart(2, '0'),
      }));

      tracks.forEach((track, channel) => {
        const note = noteAtCell(project, { patternId: pattern.id, trackId: track.id, row });
        FIELDS.forEach((field, fieldIndex) => {
          const selected = row === cursorRow && channel === cursorChannel && field === cursorField;
          rowNode.append(el('div', {
            class: `pattern-grid__cell pattern-grid__cell--${field}${selected ? ' is-cursor' : ''}`,
            role: 'gridcell',
            'aria-colindex': String(channel * FIELDS.length + fieldIndex + 1),
            'aria-selected': selected ? 'true' : 'false',
            dataset: {
              action: 'pattern-cell',
              row: String(row),
              channel: String(channel),
              field,
              trackId: track.id,
            },
            text: cellText(project, note, field),
            on: {
              click: () => {
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

  function ensureCursorVisible() {
    const top = HEADER_HEIGHT + cursorRow * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < scroller.scrollTop + HEADER_HEIGHT) {
      scroller.scrollTop = Math.max(0, top - HEADER_HEIGHT);
    } else if (bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = bottom - scroller.clientHeight;
    }

    const fieldIndex = FIELDS.indexOf(cursorField);
    const widths = [NOTE_WIDTH, INST_WIDTH, VOL_WIDTH];
    const fieldOffset = widths.slice(0, fieldIndex).reduce((sum, width) => sum + width, 0);
    const fieldWidth = widths[fieldIndex];
    const left = ROW_NUMBER_WIDTH + cursorChannel * CHANNEL_WIDTH + fieldOffset;
    const right = left + fieldWidth;
    const visibleLeft = scroller.scrollLeft + ROW_NUMBER_WIDTH;
    const visibleRight = scroller.scrollLeft + scroller.clientWidth;

    if (left < visibleLeft) {
      scroller.scrollLeft = Math.max(0, left - ROW_NUMBER_WIDTH);
    } else if (right > visibleRight) {
      scroller.scrollLeft = Math.max(0, right - scroller.clientWidth);
    }
  }

  function moveVertical(delta) {
    const { rowCount } = projectInfo();
    cursorRow = Math.max(0, Math.min(rowCount - 1, cursorRow + delta));
    renderWindow();
    ensureCursorVisible();
    syncStatus();
  }

  function moveHorizontal(delta) {
    const { tracks } = projectInfo();
    const fieldIndex = FIELDS.indexOf(cursorField);
    const flat = Math.max(
      0,
      Math.min(tracks.length * FIELDS.length - 1, cursorChannel * FIELDS.length + fieldIndex + delta),
    );
    cursorChannel = Math.floor(flat / FIELDS.length);
    cursorField = FIELDS[flat % FIELDS.length];
    renderWindow();
    ensureCursorVisible();
    syncStatus();
  }

  function toggleMode() {
    mode = mode === 'edit' ? 'audition' : 'edit';
    syncStatus();
    renderWindow();
  }

  function enterPitch(pitch) {
    if (cursorField !== 'note') return;

    const { pattern, tracks } = projectInfo();
    onAudition?.(pitch);

    if (mode !== 'edit') return;

    registry.execute('pattern.enterNote', {
      patternId: pattern.id,
      trackId: tracks[cursorChannel].id,
      row: cursorRow,
      pitch,
    });
    moveVertical(step);
  }

  function deleteCurrentEvent() {
    // INST/VOL masih read-only pada slice ini. Delete di sana tidak boleh
    // diam-diam menghapus seluruh NoteEvent.
    if (mode !== 'edit' || cursorField !== 'note') return;

    const { pattern, tracks } = projectInfo();
    registry.execute('pattern.deleteNote', {
      patternId: pattern.id,
      trackId: tracks[cursorChannel].id,
      row: cursorRow,
    });
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
    hint.textContent = cursorField === 'note'
      ? t(mode === 'edit' ? 'pattern.hintEdit' : 'pattern.hintAudition')
      : t('pattern.hintReadonlyField', {
        field: t(cursorField === 'instrument' ? 'pattern.columnInstrument' : 'pattern.columnVolume'),
      });
    onStatus?.({ mode, octave, step, row: cursorRow });
  }

  function refresh() {
    renderHeader();
    renderWindow();
    syncStatus();
  }

  scroller.addEventListener('scroll', () => renderWindow());
  scroller.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.code === 'KeyE') {
      event.preventDefault();
      toggleMode();
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) return;

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
    if (event.code === 'Delete' || event.code === 'Backspace') {
      event.preventDefault();
      deleteCurrentEvent();
      return;
    }
    if (event.code === 'Minus') {
      event.preventDefault();
      octave = Math.max(0, octave - 1);
      syncStatus();
      return;
    }
    if (event.code === 'Equal') {
      event.preventDefault();
      octave = Math.min(8, octave + 1);
      syncStatus();
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
    getUiState: () => ({
      mode,
      octave,
      step,
      row: cursorRow,
      channel: cursorChannel,
      field: cursorField,
    }),
  };
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
