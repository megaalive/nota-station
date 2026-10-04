// Shell layout §8.3: top bar, tab workspace, panel kiri, area kerja, panel kanan,
// dock terlipat, dan status bar yang selalu tampil.
//
// Isi panel di R0 masih placeholder — yang dibangun di sini strukturnya, supaya
// view berikutnya (Pattern, Piano Roll, dst.) tinggal mengisi slot yang sudah ada.

import { el } from './dom.js';
import { Tabs, Splitter, Button } from './kit.js';

const WORKSPACE_TABS = [
  { id: 'song', labelKey: 'tab.song' },
  { id: 'pattern', labelKey: 'tab.pattern' },
  { id: 'pianoRoll', labelKey: 'tab.pianoRoll' },
  { id: 'lyrics', labelKey: 'tab.lyrics' },
  { id: 'guitar', labelKey: 'tab.guitar' },
  { id: 'score', labelKey: 'tab.score' },
  { id: 'sound', labelKey: 'tab.sound' },
];

export function createShell({ root, t, registry, palette, store, build }) {
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

  const transport = el('div', { class: 'topbar__transport', role: 'group', 'aria-label': t('topbar.transport') }, [
    Button({ label: t('transport.play'), icon: '▶', onClick: () => registry.execute('playback.play') }),
    Button({ label: t('transport.stop'), icon: '■', onClick: () => registry.execute('playback.stop') }),
    el('span', { class: 'topbar__meta', dataset: { action: 'loop-mode' }, text: t('transport.loopPattern') }),
    el('span', { class: 'topbar__meta', dataset: { action: 'tempo-display' }, text: t('transport.tempoPlaceholder') }),
    el('span', { class: 'topbar__saved', role: 'status', dataset: { action: 'save-status' }, text: t('status.notSaved') }),
    buildId,
    Button({ label: t('cmd.palette'), shortcut: 'Ctrl+K', variant: 'ghost', onClick: () => palette.open() }),
  ]);

  const topbar = el('header', { class: 'topbar', dataset: { action: 'topbar' } }, [transport]);

  /* ---------------------------------------------------- workspace tabs */

  const activeView = el('div', {
    class: 'view',
    role: 'tabpanel',
    id: `tabpanel-${activeTab}`,
    dataset: { action: 'workspace-view', entity: activeTab },
  });

  function selectTab(id) {
    // Aturan produk: tab tidak pernah berganti sendiri, hanya aksi eksplisit (§8.2).
    activeTab = id;
    tabs.render(id);
    activeView.id = `tabpanel-${id}`;
    activeView.dataset.entity = id;
    activeView.textContent = '';
    activeView.append(emptyState(t('view.placeholder', { tab: t(`tab.${id}`) })));
    workspace.setAttribute('aria-labelledby', `tab-${id}`);
  }

  const tabs = Tabs({
    tabs: WORKSPACE_TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })),
    activeId: activeTab,
    label: t('shell.workspaceTabs'),
    onSelect: selectTab,
  });
  activeView.append(emptyState(t('view.placeholder', { tab: t(`tab.${activeTab}`) })));

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
  });
  const rightSplit = Splitter({
    container: rightPanel,
    side: 'right',
    min: 200,
    max: 480,
    storageKey: 'notastation.panel.right',
    store,
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

  const statusbar = el('footer', { class: 'statusbar', dataset: { action: 'statusbar' }, 'aria-label': t('shell.statusBar') }, [
    // Teks EDIT ikut di badge: kursor merah saja bukan penanda yang cukup (§8.19).
    el('span', { class: 'statusbar__mode', dataset: { action: 'edit-mode' }, text: `● ${t('status.edit')}` }),
    el('span', { class: 'statusbar__item', dataset: { action: 'octave' }, text: `${t('status.octave')} 4` }),
    el('span', { class: 'statusbar__item', dataset: { action: 'step' }, text: `${t('status.step')} 1` }),
    el('span', { class: 'statusbar__item', dataset: { action: 'position' }, text: t('position.barBeat', { bar: 1 }) }),
    el('span', { class: 'statusbar__item', dataset: { action: 'audio-status' }, text: `${t('status.audio')} ${t('status.idle')}` }),
  ]);

  function render() {
    root.textContent = '';
    root.append(topbar, workspace, dock, statusbar);
    return root;
  }

  return { render, selectTab, getActiveTab: () => activeTab };
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