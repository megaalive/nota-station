import { patternUsageCount } from '../core/arrangement.js';
import { LEARNING_SONG_TITLE } from '../core/learning-song.js';
import { el } from './dom.js';
import { Button, Dialog } from './kit.js';

export function createSongView({
  root,
  t,
  getProject,
  registry,
  getFocusedOrderEntryId = null,
  initialMode = 'map',
}) {
  let mode = initialMode === 'order' ? 'order' : 'map';
  let selectedOrderId = null;

  const heading = el('div', { class: 'song-workspace__heading' }, [
    el('h2', { text: t('song.title') }),
    el('p', { text: t('song.lead') }),
  ]);
  const summary = el('span', {
    class: 'song-workspace__summary',
    dataset: { action: 'song-summary' },
  });

  const sectionPreset = el('select', {
    dataset: { action: 'song-section-preset' },
    'aria-label': t('song.sectionPreset'),
  }, [
    ['Intro', 'song.sectionPresetIntro'],
    ['Verse', 'song.sectionPresetVerse'],
    ['Chorus', 'song.sectionPresetChorus'],
    ['Bridge', 'song.sectionPresetBridge'],
    ['Outro', 'song.sectionPresetOutro'],
  ].map(([value, labelKey]) => el('option', {
    value,
    text: t(labelKey),
  })));
  sectionPreset.value = 'Verse';

  const sectionName = el('input', {
    type: 'text',
    maxlength: '80',
    dataset: { action: 'song-section-name' },
    'aria-label': t('song.sectionName'),
  });
  sectionName.value = 'Verse';
  sectionPreset.addEventListener('change', () => {
    sectionName.value = sectionPreset.value;
  });

  const patternMode = el('select', {
    dataset: { action: 'song-section-pattern-mode' },
    'aria-label': t('song.sectionPatternAction'),
  }, [
    el('option', { value: 'new', text: t('song.sectionPatternNew') }),
    el('option', { value: 'clone', text: t('song.sectionPatternClone') }),
    el('option', { value: 'reuse', text: t('song.sectionPatternReuse') }),
  ]);
  patternMode.value = 'reuse';

  const sourcePattern = el('select', {
    dataset: { action: 'song-section-source-pattern' },
    'aria-label': t('song.sectionSourcePattern'),
  });

  const sectionFeedback = el('div', {
    class: 'song-section-dialog__feedback',
    role: 'alert',
    dataset: { action: 'song-section-feedback' },
  });
  const sectionAssignHint = el('p', {
    class: 'song-section-dialog__hint',
    dataset: { action: 'song-section-assign-hint' },
    text: t('song.sectionAssignSelectedHint'),
    hidden: true,
  });
  const patternModeField = dialogField(t('song.sectionPatternAction'), patternMode);
  const sourcePatternField = dialogField(t('song.sectionSourcePattern'), sourcePattern);

  const sectionDialogBody = el('div', {
    class: 'song-section-dialog',
  }, [
    dialogField(t('song.sectionPreset'), sectionPreset),
    dialogField(t('song.sectionName'), sectionName),
    sectionAssignHint,
    patternModeField,
    sourcePatternField,
    sectionFeedback,
  ]);

  let sectionDialog;
  let sectionDialogMode = 'append';
  const sectionCancel = Button({
    label: t('song.sectionCancel'),
    variant: 'ghost',
    onClick: () => sectionDialog.close(),
  });
  sectionCancel.dataset.action = 'song-section-cancel';

  const sectionCreate = Button({
    label: t('song.sectionCreate'),
    onClick: createSectionFromDialog,
  });
  sectionCreate.dataset.action = 'song-section-create';

  sectionDialog = Dialog({
    title: t('song.addSectionDialogTitle'),
    body: sectionDialogBody,
    actions: [sectionCancel, sectionCreate],
  });
  sectionDialog.dataset.action = 'song-section-dialog';

  let exampleDialog;
  const exampleCancel = Button({
    label: t('song.sectionCancel'),
    variant: 'ghost',
    onClick: () => exampleDialog.close(),
  });
  const exampleConfirm = Button({
    label: t('song.openLearningSong'),
    onClick: () => {
      // Tutup sebelum shell diganti; jangan tinggalkan dialog di DOM lama.
      exampleDialog.close();
      registry.execute('project.loadTemplate', { templateId: 'learning-song' });
    },
  });
  exampleDialog = Dialog({
    title: t('song.openLearningSong'),
    body: el('p', { text: t('song.learningSongReplaceWarning') }),
    actions: [exampleCancel, exampleConfirm],
  });
  exampleDialog.dataset.action = 'song-learning-confirm';

  const exampleButton = Button({
    label: t('song.openLearningSong'),
    variant: 'ghost',
    onClick: () => exampleDialog.open(exampleButton),
  });
  exampleButton.dataset.action = 'song-open-learning-song';

  const playSongButton = Button({
    label: t('song.playFromStart'),
    onClick: () => registry.execute('playback.playSongStart'),
  });
  playSongButton.dataset.action = 'song-play-from-start';

  const addSectionButton = Button({
    label: t('song.addSection'),
    onClick: openSectionDialog,
  });
  addSectionButton.dataset.action = 'song-add-section';

  const mapButton = Button({
    label: t('song.viewMap'),
    variant: 'ghost',
    onClick: () => setMode('map'),
  });
  mapButton.dataset.action = 'song-view-map';

  const orderButton = Button({
    label: t('song.viewOrder'),
    variant: 'ghost',
    onClick: () => setMode('order'),
  });
  orderButton.dataset.action = 'song-view-order';

  const reuseButton = Button({
    label: t('song.reuse'),
    shortcut: 'Ctrl+D',
    onClick: reuseSelected,
  });
  reuseButton.dataset.action = 'song-reuse';

  const uniqueButton = Button({
    label: t('song.makeUnique'),
    shortcut: 'Ctrl+Shift+D',
    onClick: makeSelectedUnique,
  });
  uniqueButton.dataset.action = 'song-make-unique';

  const earlierButton = Button({
    label: t('song.moveEarlier'),
    shortcut: 'Alt+↑',
    onClick: () => moveSelected(-1),
  });
  earlierButton.dataset.action = 'song-move-earlier';

  const laterButton = Button({
    label: t('song.moveLater'),
    shortcut: 'Alt+↓',
    onClick: () => moveSelected(1),
  });
  laterButton.dataset.action = 'song-move-later';

  const viewToggle = el('div', {
    class: 'song-workspace__view-toggle',
    role: 'group',
    'aria-label': t('song.viewMode'),
  }, [mapButton, orderButton]);

  const actions = el('div', {
    class: 'song-workspace__actions',
    role: 'group',
    'aria-label': t('song.actions'),
  }, [playSongButton, exampleButton, addSectionButton, reuseButton, uniqueButton, earlierButton, laterButton]);

  const toolbar = el('div', { class: 'song-workspace__toolbar' }, [
    heading,
    el('div', { class: 'song-workspace__toolbar-side' }, [summary, viewToggle, actions]),
  ]);

  const hint = el('p', {
    class: 'song-workspace__hint',
    dataset: { action: 'song-hint' },
    text: t('song.keyboardHint'),
  });

  const learningGuide = el('details', {
    class: 'song-learning',
    hidden: true,
    dataset: { action: 'song-learning-guide' },
  }, [
    el('summary', { text: t('song.learningGuideTitle') }),
    el('p', { text: t('song.learningGuideIntro') }),
    el('ol', {}, [
      el('li', { text: t('song.learningGuideStep1') }),
      el('li', { text: t('song.learningGuideStep2') }),
      el('li', { text: t('song.learningGuideStep3') }),
      el('li', { text: t('song.learningGuideStep4') }),
    ]),
  ]);

  const surface = el('div', {
    class: 'song-workspace__surface',
    tabindex: '0',
    on: { keydown: onKeydown },
  });

  const workspace = el('section', {
    class: 'song-workspace',
    dataset: { action: 'song-workspace' },
    'aria-label': t('song.title'),
  }, [toolbar, learningGuide, hint, surface]);

  root.append(workspace);
  refresh();

  function openSectionDialog() {
    const project = projectInfo();
    sourcePattern.textContent = '';
    for (const pattern of project.song.patterns) {
      sourcePattern.append(el('option', {
        value: pattern.id,
        text: pattern.name,
      }));
    }

    const selected = project.song.order.find((entry) => entry.id === selectedOrderId);
    sourcePattern.value = selected?.patternId ?? project.song.patterns[0]?.id ?? '';
    sectionPreset.value = 'Verse';
    sectionName.value = 'Verse';
    patternMode.value = 'reuse';
    sectionFeedback.textContent = '';

    sectionDialogMode = selected && (selected.sectionId ?? null) === null
      ? 'assign'
      : 'append';
    const assigning = sectionDialogMode === 'assign';
    sectionAssignHint.hidden = !assigning;
    patternModeField.hidden = assigning;
    sourcePatternField.hidden = assigning;
    const title = sectionDialog.querySelector('.dialog__title');
    if (title) {
      title.textContent = t(assigning
        ? 'song.assignNewSectionDialogTitle'
        : 'song.addSectionDialogTitle');
    }
    const createLabel = sectionCreate.querySelector('.btn__label');
    if (createLabel) {
      createLabel.textContent = t(assigning
        ? 'song.sectionAssignSelected'
        : 'song.sectionCreate');
    }
    sectionDialog.open(addSectionButton);
  }

  function createSectionFromDialog() {
    try {
      const result = sectionDialogMode === 'assign'
        ? registry.execute('song.createAndAssignSection', {
          name: sectionName.value,
          orderEntryId: selectedOrderId,
        })
        : registry.execute('song.createSectionOccurrence', {
          name: sectionName.value,
          patternMode: patternMode.value,
          sourcePatternId: sourcePattern.value,
          afterOrderEntryId: selectedOrderId,
        });
      selectedOrderId = result.orderEntryId;
      registry.execute('focus.setOrderEntry', {
        orderEntryId: result.orderEntryId,
      });
      sectionDialog.close();
      refresh();
      focusSelected();
    } catch (error) {
      sectionFeedback.textContent = t('song.sectionCreateFailed')
        + ' (' + (error?.code ?? 'E_UNKNOWN') + ')';
    }
  }

  function projectInfo() {
    const project = getProject();
    const focusedOrderId = getFocusedOrderEntryId?.() ?? null;
    if (focusedOrderId && project.song.order.some((entry) => entry.id === focusedOrderId)) {
      selectedOrderId = focusedOrderId;
    }
    if (
      !selectedOrderId
      || !project.song.order.some((entry) => entry.id === selectedOrderId)
    ) {
      selectedOrderId = project.song.order[0]?.id ?? null;
    }
    return project;
  }

  function setMode(next) {
    if (!['map', 'order'].includes(next) || mode === next) return;
    mode = next;
    refresh();
    focusSelected();
  }

  function refresh() {
    const project = projectInfo();
    summary.textContent = t('song.summary', {
      orders: project.song.order.length,
      patterns: project.song.patterns.length,
    });
    learningGuide.hidden = project.title !== LEARNING_SONG_TITLE;
    playSongButton.disabled = project.song.order.length === 0;

    mapButton.setAttribute('aria-pressed', mode === 'map' ? 'true' : 'false');
    orderButton.setAttribute('aria-pressed', mode === 'order' ? 'true' : 'false');

    surface.textContent = '';
    surface.className = 'song-workspace__surface song-workspace__surface--' + mode;
    surface.dataset.action = mode === 'map' ? 'song-map' : 'song-order-list';
    surface.setAttribute(
      'aria-label',
      t(mode === 'map' ? 'song.viewMap' : 'song.viewOrder'),
    );

    const entryModels = project.song.order.map((entry, index) => {
      const pattern = project.song.patterns.find((item) => item.id === entry.patternId);
      const section = project.song.sections.find((item) => item.id === entry.sectionId) ?? null;
      return {
        entry,
        index,
        patternName: pattern?.name ?? entry.patternId,
        usage: patternUsageCount(project, entry.patternId),
        selected: entry.id === selectedOrderId,
        section,
      };
    });

    if (mode === 'map') {
      const runs = [];
      for (const model of entryModels) {
        const sectionId = model.entry.sectionId ?? null;
        const current = runs[runs.length - 1];
        if (!current || current.sectionId !== sectionId) {
          runs.push({
            sectionId,
            section: model.section,
            entries: [model],
          });
        } else {
          current.entries.push(model);
        }
      }

      for (const run of runs) {
        const block = el('div', {
          class: 'song-map__section',
          dataset: {
            action: 'song-section',
            entity: run.sectionId ?? 'unsectioned',
          },
        }, [
          el('div', {
            class: 'song-map__section-title',
            text: run.section?.name ?? t('song.unsectioned'),
          }),
          el('div', {
            class: 'song-map__entries',
          }, run.entries.map((model) => renderEntry(model))),
        ]);
        if (run.section?.color) block.style.borderColor = run.section.color;
        surface.append(block);
      }
    } else {
      surface.append(el('ol', {
        class: 'song-order__entries',
      }, entryModels.map((model) => (
        el('li', { class: 'song-order__item' }, [
          renderEntry({
            ...model,
            sectionName: model.section?.name ?? null,
          }),
        ])
      ))));
    }

    syncActionState(project);
  }

  function renderEntry({
    entry,
    index,
    patternName,
    usage,
    selected,
    sectionName = null,
  }) {
    const usageText = usage > 1 ? ' · ⛓ ×' + usage : '';
    const sectionText = sectionName ? ' · ' + sectionName : '';
    return el('button', {
      type: 'button',
      class: 'song-entry' + (selected ? ' is-selected' : ''),
      'aria-current': selected ? 'true' : 'false',
      dataset: { action: 'song-entry', entity: entry.id },
      on: { click: () => selectEntry(entry.id) },
    }, [
      el('span', {
        class: 'song-entry__body',
        dataset: { action: 'song-entry-body' },
        text: String(index + 1).padStart(2, '0')
          + ' · ' + patternName + usageText + sectionText,
      }),
    ]);
  }

  function selectEntry(orderEntryId) {
    selectedOrderId = orderEntryId;
    registry.execute('focus.setOrderEntry', { orderEntryId });
    refresh();
    focusSelected();
  }

  function reuseSelected() {
    if (!selectedOrderId) return;
    const result = registry.execute('song.reuseOrderEntry', { orderEntryId: selectedOrderId });
    selectedOrderId = result.orderEntryId;
    registry.execute('focus.setOrderEntry', { orderEntryId: selectedOrderId });
    refresh();
    focusSelected();
  }

  function makeSelectedUnique() {
    if (!selectedOrderId) return;
    registry.execute('song.makeOrderUnique', { orderEntryId: selectedOrderId });
    refresh();
    focusSelected();
  }

  function moveSelected(delta) {
    const project = projectInfo();
    const index = project.song.order.findIndex((entry) => entry.id === selectedOrderId);
    if (index < 0) return;
    const toIndex = index + delta;
    if (toIndex < 0 || toIndex >= project.song.order.length) return;
    registry.execute('song.moveOrderEntry', { orderEntryId: selectedOrderId, toIndex });
    refresh();
    focusSelected();
  }

  function moveSelection(delta) {
    const project = projectInfo();
    const index = project.song.order.findIndex((entry) => entry.id === selectedOrderId);
    if (index < 0) return;
    const nextIndex = Math.max(0, Math.min(project.song.order.length - 1, index + delta));
    if (nextIndex === index) return;
    selectEntry(project.song.order[nextIndex].id);
  }

  function onKeydown(event) {
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyD') {
      event.preventDefault();
      makeSelectedUnique();
      return;
    }
    if (event.ctrlKey && !event.altKey && !event.metaKey && event.code === 'KeyD') {
      event.preventDefault();
      reuseSelected();
      return;
    }

    const earlier = mode === 'map' ? event.code === 'ArrowLeft' : event.code === 'ArrowUp';
    const later = mode === 'map' ? event.code === 'ArrowRight' : event.code === 'ArrowDown';
    const crossEarlier = mode === 'map' ? event.code === 'ArrowUp' : event.code === 'ArrowLeft';
    const crossLater = mode === 'map' ? event.code === 'ArrowDown' : event.code === 'ArrowRight';

    if (event.altKey && (earlier || crossEarlier)) {
      event.preventDefault();
      moveSelected(-1);
      return;
    }
    if (event.altKey && (later || crossLater)) {
      event.preventDefault();
      moveSelected(1);
      return;
    }
    if (!event.ctrlKey && !event.altKey && !event.metaKey && (earlier || crossEarlier)) {
      event.preventDefault();
      moveSelection(-1);
      return;
    }
    if (!event.ctrlKey && !event.altKey && !event.metaKey && (later || crossLater)) {
      event.preventDefault();
      moveSelection(1);
    }
  }

  function syncActionState(project) {
    const index = project.song.order.findIndex((entry) => entry.id === selectedOrderId);
    earlierButton.disabled = index <= 0;
    laterButton.disabled = index < 0 || index >= project.song.order.length - 1;

    const entry = project.song.order[index];
    uniqueButton.disabled = !entry || patternUsageCount(project, entry.patternId) <= 1;
    reuseButton.disabled = !entry;
  }

  function focusSelected() {
    for (const entry of surface.querySelectorAll('[data-action="song-entry"]')) {
      if (entry.dataset.entity === selectedOrderId) {
        entry.focus();
        return;
      }
    }
    surface.focus();
  }

  return Object.freeze({
    refresh,
    getSelectedOrderEntryId: () => selectedOrderId,
    getMode: () => mode,
  });
}

function dialogField(label, control) {
  return el('label', { class: 'song-section-dialog__field' }, [
    el('span', { class: 'song-section-dialog__label', text: label }),
    control,
  ]);
}
