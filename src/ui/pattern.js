// Pattern editor R1-S1: 8 channel × 64 row, DOM windowed, input nada via
// KeyboardEvent.code. View hanya memanggil command; project tidak pernah ditulis langsung.

import { activePattern, noteAtCell } from '../core/project.js';
import { el } from './dom.js';
import { Button } from './kit.js';

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 32;
const CHANNEL_WIDTH = 92;
const ROW_NUMBER_WIDTH = 46;
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
  const header = el('div', { class: 'pattern-grid__header', role: 'row' });
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

  function renderHeader() {
    const { tracks } = projectInfo();
    header.textContent = '';
    header.style.gridTemplateColumns = `${ROW_NUMBER_WIDTH}px repeat(${tracks.length}, ${CHANNEL_WIDTH}px)`;
    header.append(el('div', { class: 'pattern-grid__corner', 'aria-hidden': 'true', text: '#' }));
    tracks.forEach((track, index) => {
      header.append(el('div', {
        class: 'pattern-grid__channel',
        role: 'columnheader',
        'aria-colindex': String(index + 1),
        text: `${index + 1} · ${track.name}`,
      }));
    });
  }

  function renderWindow() {
    const { project, pattern, tracks, rowCount } = projectInfo();
    const width = ROW_NUMBER_WIDTH + tracks.length * CHANNEL_WIDTH;
    const height = HEADER_HEIGHT + rowCount * ROW_HEIGHT;
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    scroller.setAttribute('aria-rowcount', String(rowCount));
    scroller.setAttribute('aria-colcount', String(tracks.length));

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
      rowNode.style.gridTemplateColumns = `${ROW_NUMBER_WIDTH}px repeat(${tracks.length}, ${CHANNEL_WIDTH}px)`;

      rowNode.append(el('div', {
        class: 'pattern-grid__row-number',
        role: 'rowheader',
        text: row.toString(16).toUpperCase().padStart(2, '0'),
      }));

      tracks.forEach((track, channel) => {
        const note = noteAtCell(project, { patternId: pattern.id, trackId: track.id, row });
        const selected = row === cursorRow && channel === cursorChannel;
        const cell = el('div', {
          class: `pattern-grid__cell${selected ? ' is-cursor' : ''}`,
          role: 'gridcell',
          'aria-colindex': String(channel + 1),
          'aria-selected': selected ? 'true' : 'false',
          dataset: {
            action: 'pattern-cell',
            row: String(row),
            channel: String(channel),
            trackId: track.id,
          },
          text: note ? formatPitch(note.pitch) : '···',
          on: {
            click: () => {
              cursorRow = row;
              cursorChannel = channel;
              scroller.focus();
              renderWindow();
              syncStatus();
            },
          },
        });
        rowNode.append(cell);
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
  }

  function moveCursor(rowDelta, channelDelta = 0) {
    const { tracks, rowCount } = projectInfo();
    cursorRow = Math.max(0, Math.min(rowCount - 1, cursorRow + rowDelta));
    cursorChannel = Math.max(0, Math.min(tracks.length - 1, cursorChannel + channelDelta));
    ensureCursorVisible();
    renderWindow();
    syncStatus();
  }

  function toggleMode() {
    mode = mode === 'edit' ? 'audition' : 'edit';
    syncStatus();
    renderWindow();
  }

  function enterPitch(pitch) {
    const { pattern, tracks } = projectInfo();
    onAudition?.(pitch);

    if (mode !== 'edit') return;

    registry.execute('pattern.enterNote', {
      patternId: pattern.id,
      trackId: tracks[cursorChannel].id,
      row: cursorRow,
      pitch,
    });
    renderWindow();
    moveCursor(step, 0);
  }

  function syncStatus() {
    modeButton.querySelector('.btn__label').textContent = t(mode === 'edit' ? 'status.edit' : 'status.audisi');
    modeButton.setAttribute('aria-pressed', mode === 'edit' ? 'true' : 'false');
    scroller.classList.toggle('is-edit', mode === 'edit');
    scroller.classList.toggle('is-audition', mode !== 'edit');
    octaveText.textContent = `${t('status.octave')} ${octave}`;
    stepText.textContent = `${t('status.step')} ${step}`;
    hint.textContent = t(mode === 'edit' ? 'pattern.hintEdit' : 'pattern.hintAudition');
    onStatus?.({ mode, octave, step, row: cursorRow });
  }

  scroller.addEventListener('scroll', () => renderWindow());
  scroller.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.code === 'KeyE') {
      event.preventDefault();
      toggleMode();
      return;
    }
    if (event.code === 'ArrowUp') {
      event.preventDefault();
      moveCursor(-1);
      return;
    }
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      moveCursor(1);
      return;
    }
    if (event.code === 'ArrowLeft') {
      event.preventDefault();
      moveCursor(0, -1);
      return;
    }
    if (event.code === 'ArrowRight') {
      event.preventDefault();
      moveCursor(0, 1);
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
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const semitone = NOTE_CODES.get(event.code);
    if (semitone === undefined) return;
    const pitch = octave * 12 + 12 + semitone;
    if (pitch > 127) return;
    event.preventDefault();
    enterPitch(pitch);
  });

  renderHeader();
  renderWindow();
  syncStatus();
  requestAnimationFrame(() => renderWindow());

  return {
    focus: () => scroller.focus(),
    getUiState: () => ({ mode, octave, step, row: cursorRow, channel: cursorChannel }),
  };
}

function formatPitch(pitch) {
  const octave = Math.floor(pitch / 12) - 1;
  return `${NOTE_NAMES[pitch % 12]}${octave}`;
}
