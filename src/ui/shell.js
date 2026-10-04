// Shell layout §8.3: top bar, tab workspace, panel kiri, area kerja, panel kanan,
// dock terlipat, dan status bar yang selalu tampil.
//
// Shell ini berasal dari R0. Mulai R1, view seperti Pattern mengisi slot tengah
// lewat renderView; view lain tetap mendapat empty state sampai milestone pemiliknya.

import { el } from './dom.js';
import { Tabs, Splitter, Button, Tooltip } from './kit.js';

const WORKSPACE_TABS = [
  { id: 'song', labelKey: 'tab.song' },
  { id: 'pattern', labelKey: 'tab.pattern' },
  { id: 'pianoRoll', labelKey: 'tab.pianoRoll' },
  { id: 'lyrics', labelKey: 'tab.lyrics' },
  { id: 'guitar', labelKey: 'tab.guitar' },
  { id: 'score', labelKey: 'tab.score' },
  { id: 'sound', labelKey: 'tab.sound' },
];

export function createShell({
  root,
  t,
  registry,
  palette,
  store,
  build,
  renderView = null,
  transport = {
    tempo: 120,
    meter: { num: 4, den: 4 },
    loopPattern: true,
    metronome: false,
    audioState: 'locked',
    positionTick: 0,
    lengthTicks: 7680,
    rowTicks: 120,
  },
}) {
  let activeTab = 'pattern';

  /* ------------------------------------------------------------- top bar */

  const buildId = el('span', {
    class: 'topbar__build',
    dataset: { action: 'build-id' },
    // Build id harus terbaca manusia, bukan cuma ada di state — user perlu bisa
    // cek sendiri build mana yang sedang mereka pakai (§13.4).
    title: build?.sha ?? '',
    text: build?.sha ? build.sha.slice(0, 7) : t('shell.buildUnknown'),
  });

  const playButton = Button({
    label: t('transport.play'),
    icon: '▶',
    iconOnly: true,
    onClick: () => registry.execute('playback.play'),
  });
  const pauseButton = Button({
    label: t('transport.pause'),
    icon: '⏸',
    iconOnly: true,
    disabled: true,
    onClick: () => registry.execute('playback.pause'),
  });
  pauseButton.dataset.action = 'transport-pause';

  const stopButton = Button({
    label: t('transport.stop'),
    icon: '■',
    iconOnly: true,
    onClick: () => registry.execute('playback.stop'),
  });
  const paletteButton = Button({
    label: t('cmd.palette'),
    icon: '⌕',
    iconOnly: true,
    variant: 'ghost',
    onClick: () => palette.open(),
  });
  const loopButton = Button({
    label: t('transport.loopPattern'),
    icon: '↻',
    iconOnly: true,
    variant: 'ghost',
    onClick: () => registry.execute('playback.toggleLoop'),
  });
  loopButton.dataset.action = 'loop-mode';

  const metronomeButton = Button({
    label: t('transport.metronome'),
    icon: '♩',
    iconOnly: true,
    variant: 'ghost',
    onClick: () => registry.execute('playback.toggleMetronome'),
  });
  metronomeButton.dataset.action = 'metronome-mode';

  let currentTransport = {
    tempo: transport.tempo ?? 120,
    meter: transport.meter ?? { num: 4, den: 4 },
    loopPattern: transport.loopPattern ?? true,
    metronome: transport.metronome ?? false,
    audioState: transport.audioState ?? 'locked',
    positionTick: transport.positionTick ?? 0,
    lengthTicks: transport.lengthTicks ?? 7680,
    rowTicks: transport.rowTicks ?? 120,
  };

  const tempoInput = el('input', {
    type: 'number',
    class: 'topbar__tempo-input',
    min: '20',
    max: '300',
    step: '1',
    inputmode: 'numeric',
    'aria-label': t('transport.tempo'),
    dataset: { action: 'tempo-input' },
    value: String(currentTransport.tempo),
    on: {
      change: () => {
        const tempo = Number(tempoInput.value);
        if (!Number.isInteger(tempo) || tempo < 20 || tempo > 300) {
          tempoInput.setCustomValidity(t('transport.tempoInvalid'));
          tempoInput.reportValidity();
          tempoInput.value = String(currentTransport.tempo);
          return;
        }
        tempoInput.setCustomValidity('');
        try {
          registry.execute('song.setTempo', { tempo });
        } catch {
          tempoInput.setCustomValidity(t('transport.tempoInvalid'));
          tempoInput.reportValidity();
          tempoInput.value = String(currentTransport.tempo);
        }
      },
    },
  });

  const tempoControl = el('label', {
    class: 'topbar__tempo',
    title: t('transport.tempoUnit'),
  }, [
    el('span', { 'aria-hidden': 'true', text: '♩' }),
    tempoInput,
  ]);

  const meterDisplay = el('span', {
    class: 'topbar__meta',
    dataset: { action: 'meter-display' },
  });

  const seekInput = el('input', {
    type: 'range',
    class: 'topbar__seek',
    min: '0',
    max: String(currentTransport.lengthTicks),
    step: String(currentTransport.rowTicks),
    value: String(currentTransport.positionTick),
    'aria-label': t('transport.seek'),
    dataset: { action: 'transport-seek' },
    on: {
      change: () => registry.execute('playback.seek', { tick: Number(seekInput.value) }),
    },
  });

  const transportBar = el('div', {
    class: 'topbar__transport',
    role: 'group',
    'aria-label': t('topbar.transport'),
  }, [
    Tooltip({ text: t('transport.play'), child: playButton }),
    Tooltip({ text: t('transport.pause'), child: pauseButton }),
    Tooltip({ text: t('transport.stop'), child: stopButton }),
    Tooltip({ text: t('transport.loopPattern'), child: loopButton }),
    Tooltip({ text: t('transport.metronome'), child: metronomeButton }),
    tempoControl,
    meterDisplay,
    Tooltip({ text: t('transport.seek'), child: seekInput }),
    el('span', { class: 'topbar__saved', role: 'status', dataset: { action: 'save-status' }, text: t('status.notSaved') }),
    buildId,
    Tooltip({ text: t('cmd.palette'), shortcut: 'Ctrl+K', child: paletteButton }),
  ]);

  const topbar = el('header', { class: 'topbar', dataset: { action: 'topbar' } }, [transportBar]);

  /* ---------------------------------------------------- workspace tabs */

  const activeView = el('div', {
    class: 'view',
    role: 'tabpanel',
    id: `tabpanel-${activeTab}`,
    dataset: { action: 'workspace-view', entity: activeTab },
  });

  function renderActiveView() {
    activeView.textContent = '';
    const handled = renderView?.(activeTab, activeView) === true;
    if (!handled) {
      activeView.append(emptyState(t('view.placeholder', { tab: t(`tab.${activeTab}`) })));
    }
  }

  function selectTab(id) {
    // Aturan produk: tab tidak pernah berganti sendiri, hanya aksi eksplisit (§8.2).
    activeTab = id;
    tabs.render(id);
    activeView.id = `tabpanel-${id}`;
    activeView.dataset.entity = id;
    workspace.setAttribute('aria-labelledby', `tab-${id}`);
    renderActiveView();
  }

  const tabs = Tabs({
    tabs: WORKSPACE_TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })),
    activeId: activeTab,
    label: t('shell.workspaceTabs'),
    onSelect: selectTab,
  });
  /* ------------------------------------------------------------- panels */

  const leftPanel = panel('left', t('shell.leftPanel'), t('left.placeholder'), { t, store });
  const rightPanel = panel('right', t('shell.rightPanel'), t('right.placeholder'), { t, store });

  // Ukuran panel disimpan di localStorage: ini preference UI, bukan data lagu (§10.1).
  const leftSplit = Splitter({
    container: leftPanel,
    side: 'left',
    min: 180,
    max: 420,
    storageKey: 'notastation.panel.left',
    store,
    label: t('panel.resize', { panel: t('shell.leftPanel') }),
  });
  const rightSplit = Splitter({
    container: rightPanel,
    side: 'right',
    min: 200,
    max: 480,
    storageKey: 'notastation.panel.right',
    store,
    label: t('panel.resize', { panel: t('shell.rightPanel') }),
  });

  const workspace = el('main', {
    class: 'workspace',
    'aria-labelledby': `tab-${activeTab}`,
    dataset: { action: 'workspace' },
  }, [
    tabs,
    el('div', { class: 'workspace__body' }, [leftSplit, activeView, rightSplit]),
  ]);

  /* --------------------------------------------------------------- dock */

  const dock = el('section', { class: 'dock', dataset: { action: 'dock' }, 'aria-label': t('shell.dock') }, [
    // Dock terlipat secara default (§8.3): alat bantu, bukan tempat utama.
    el('button', {
      type: 'button',
      class: 'dock__toggle',
      'aria-expanded': 'false',
      dataset: { action: 'dock-toggle' },
      text: t('dock.toggle'),
      on: {
        click: (event) => {
          const open = dock.classList.toggle('is-open');
          event.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
        },
      },
    }),
    el('div', { class: 'dock__items' }, [
      el('span', { class: 'dock__item', text: t('dock.keyboard') }),
      el('span', { class: 'dock__item', text: t('dock.problems') }),
    ]),
  ]);

  /* --------------------------------------------------------- status bar */

  const modeStatus = el('span', {
    class: 'statusbar__mode is-audition',
    dataset: { action: 'edit-mode' },
    text: `○ ${t('status.audisi')}`,
  });
  const octaveStatus = el('span', {
    class: 'statusbar__item',
    dataset: { action: 'octave' },
    text: `${t('status.octave')} 4`,
  });
  const stepStatus = el('span', {
    class: 'statusbar__item',
    dataset: { action: 'step' },
    text: `${t('status.step')} 1`,
  });
  const positionStatus = el('span', {
    class: 'statusbar__item',
    dataset: { action: 'position' },
    text: t('position.row', { row: 0 }),
  });
  const audioStatus = el('span', {
    class: 'statusbar__item',
    dataset: { action: 'audio-status' },
    text: `${t('status.audio')} · ${t('status.audioLocked')}`,
  });

  const statusbar = el('footer', {
    class: 'statusbar',
    dataset: { action: 'statusbar' },
    'aria-label': t('shell.statusBar'),
  }, [modeStatus, octaveStatus, stepStatus, positionStatus, audioStatus]);

  function setPatternStatus({ mode, octave, step, row }) {
    const edit = mode === 'edit';
    modeStatus.textContent = `${edit ? '●' : '○'} ${t(edit ? 'status.edit' : 'status.audisi')}`;
    modeStatus.classList.toggle('is-edit', edit);
    modeStatus.classList.toggle('is-audition', !edit);
    octaveStatus.textContent = `${t('status.octave')} ${octave}`;
    stepStatus.textContent = `${t('status.step')} ${step}`;
    positionStatus.textContent = t('position.row', { row });
  }

  function setAudioStatus(state) {
    const key = {
      locked: 'status.audioLocked',
      ready: 'status.audioReady',
      playing: 'status.audioPlaying',
      paused: 'status.audioPaused',
      error: 'status.audioError',
    }[state] ?? 'status.audioReady';
    audioStatus.textContent = `${t('status.audio')} · ${t(key)}`;
    audioStatus.dataset.state = state;
  }

  function setTransportStatus(next) {
    currentTransport = {
      ...currentTransport,
      ...next,
      meter: next.meter ?? currentTransport.meter,
    };
    const playing = currentTransport.audioState === 'playing';
    playButton.disabled = playing;
    pauseButton.disabled = !playing;
    loopButton.setAttribute('aria-pressed', currentTransport.loopPattern ? 'true' : 'false');
    loopButton.classList.toggle('is-active', currentTransport.loopPattern);
    metronomeButton.setAttribute('aria-pressed', currentTransport.metronome ? 'true' : 'false');
    metronomeButton.classList.toggle('is-active', currentTransport.metronome);
    if (document.activeElement !== tempoInput) {
      tempoInput.value = String(currentTransport.tempo);
    }
    meterDisplay.textContent = `${currentTransport.meter.num}/${currentTransport.meter.den}`;
    seekInput.max = String(currentTransport.lengthTicks);
    seekInput.step = String(currentTransport.rowTicks);
    if (document.activeElement !== seekInput) {
      seekInput.value = String(Math.max(0, Math.min(
        currentTransport.lengthTicks,
        Math.round(currentTransport.positionTick),
      )));
    }
  }

  function render() {
    root.textContent = '';
    root.append(topbar, workspace, dock, statusbar);
    setTransportStatus(currentTransport);
    renderActiveView();
    return root;
  }

  return {
    render,
    selectTab,
    getActiveTab: () => activeTab,
    setPatternStatus,
    setAudioStatus,
    setTransportStatus,
    refreshView: renderActiveView,
  };
}

function panel(side, title, placeholder, { t, store }) {
  const contentId = `panel-${side}-content`;
  const storageKey = `notastation.panel.${side}.collapsed`;
  const content = el('div', { class: 'panel__content', id: contentId }, [
    el('ul', { class: 'panel__list' }, [el('li', { class: 'panel__item', text: placeholder })]),
  ]);
  const titleNode = el('h2', { class: 'panel__title', text: title });
  const toggle = el('button', {
    type: 'button',
    class: 'panel__toggle',
    'aria-controls': contentId,
    dataset: { action: `panel-${side}-toggle` },
  });

  const root = el('aside', {
    class: `panel panel--${side}`,
    dataset: { action: `panel-${side}` },
    'aria-label': title,
  }, [
    el('div', { class: 'panel__header' }, [titleNode, toggle]),
    content,
  ]);

  function setCollapsed(collapsed, persist = true) {
    root.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', t(collapsed ? 'panel.expand' : 'panel.collapse', { panel: title }));
    // Panahnya menunjukkan arah panel akan bergerak kalau tombol ditekan lagi.
    toggle.textContent = side === 'left'
      ? (collapsed ? '›' : '‹')
      : (collapsed ? '‹' : '›');
    if (persist) store?.setItem(storageKey, collapsed ? '1' : '0');
  }

  toggle.addEventListener('click', () => setCollapsed(!root.classList.contains('is-collapsed')));
  setCollapsed(store?.getItem(storageKey) === '1', false);

  return root;
}

/** Empty state bermakna di setiap view kosong: satu kalimat + satu petunjuk (§8.15). */
function emptyState(message) {
  return el('div', { class: 'view__empty' }, [el('p', { class: 'view__empty-text', text: message })]);
}