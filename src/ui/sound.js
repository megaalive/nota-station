import { el } from './dom.js';
import { Button, Toast } from './kit.js';

export function createSoundView({
  root,
  t,
  getProject,
  onImportWav,
  onUndo,
}) {
  let selectedTrackId = getProject().song.tracks[0]?.id ?? null;
  let busy = false;
  let statusKey = 'sound.statusReady';
  let statusVars = {};

  function refresh() {
    const project = getProject();
    if (!project.song.tracks.some((track) => track.id === selectedTrackId)) {
      selectedTrackId = project.song.tracks[0]?.id ?? null;
    }

    root.textContent = '';
    root.classList.add('sound-workspace');

    const trackSelect = el('select', {
      class: 'sound-workspace__select',
      'aria-label': t('sound.targetTrack'),
      dataset: { action: 'sound-target-track' },
      on: {
        change: () => {
          selectedTrackId = trackSelect.value;
        },
      },
    }, project.song.tracks.map((track, index) => el('option', {
      value: track.id,
      text: `${String(index + 1).padStart(2, '0')} · ${track.name}`,
    })));
    trackSelect.value = selectedTrackId ?? '';

    const fileInput = el('input', {
      type: 'file',
      accept: '.wav,audio/wav,audio/x-wav',
      hidden: true,
      dataset: { action: 'sound-wav-input' },
    });

    const importButton = Button({
      label: t('sound.importWav'),
      icon: '＋',
      disabled: busy || !selectedTrackId,
      onClick: () => fileInput.click(),
    });
    importButton.dataset.action = 'sound-import-wav';

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file || !selectedTrackId) return;

      busy = true;
      statusKey = 'sound.statusImporting';
      statusVars = { name: file.name };
      refresh();

      try {
        const result = await onImportWav({
          sourceFilename: file.name,
          bytes: await file.arrayBuffer(),
          trackId: selectedTrackId,
        });
        statusKey = result.sampleAdded
          ? 'sound.statusImported'
          : 'sound.statusDeduplicated';
        statusVars = {
          name: result.instrumentName,
          track: result.trackName,
        };
        Toast({
          message: t(statusKey, statusVars),
          actionLabel: t('history.undo'),
          onAction: () => {
            onUndo();
            statusKey = 'sound.statusUndone';
            statusVars = {};
            refresh();
          },
        });
      } catch (error) {
        statusKey = 'sound.statusImportFailed';
        statusVars = { code: error?.code ?? 'E_WAV_IMPORT' };
      } finally {
        busy = false;
        refresh();
      }
    });

    const toolbar = el('div', { class: 'sound-workspace__toolbar' }, [
      el('div', { class: 'sound-workspace__heading' }, [
        el('h2', { text: t('sound.title') }),
        el('p', { text: t('sound.lead') }),
      ]),
      el('label', { class: 'sound-workspace__field' }, [
        el('span', { class: 'sound-workspace__label', text: t('sound.targetTrack') }),
        trackSelect,
      ]),
      importButton,
      fileInput,
    ]);

    const status = el('div', {
      class: 'sound-workspace__status',
      role: 'status',
      dataset: { action: 'sound-status' },
      text: t(statusKey, statusVars),
    });

    const samples = el('section', { class: 'sound-workspace__section' }, [
      el('div', { class: 'sound-workspace__section-head' }, [
        el('h3', { text: t('sound.samples') }),
        el('span', {
          class: 'sound-workspace__count',
          text: String(project.samples.length),
          'aria-label': t('sound.sampleCount', { count: project.samples.length }),
        }),
      ]),
      project.samples.length
        ? el('div', { class: 'sound-list', dataset: { action: 'sound-sample-list' } },
          project.samples.map((sample) => sampleRow(sample, t)))
        : el('p', { class: 'sound-workspace__empty', text: t('sound.noSamples') }),
    ]);

    const instruments = el('section', { class: 'sound-workspace__section' }, [
      el('div', { class: 'sound-workspace__section-head' }, [
        el('h3', { text: t('sound.instruments') }),
        el('span', {
          class: 'sound-workspace__count',
          text: String(project.instruments.length),
          'aria-label': t('sound.instrumentCount', { count: project.instruments.length }),
        }),
      ]),
      project.instruments.length
        ? el('div', { class: 'sound-list', dataset: { action: 'sound-instrument-list' } },
          project.instruments.map((instrument) => instrumentRow(instrument, project, t)))
        : el('p', { class: 'sound-workspace__empty', text: t('sound.noInstruments') }),
    ]);

    root.append(toolbar, status, el('div', { class: 'sound-workspace__grid' }, [
      samples,
      instruments,
    ]));
  }

  refresh();
  return Object.freeze({ refresh });
}

function sampleRow(sample, t) {
  const rate = Number(sample.sampleRate ?? 0);
  const channels = Number(sample.channels ?? 0);
  return el('article', {
    class: 'sound-card',
    dataset: { action: 'sound-sample', entity: sample.id },
  }, [
    el('div', { class: 'sound-card__title', text: sample.name }),
    el('div', {
      class: 'sound-card__meta',
      text: t('sound.sampleMeta', {
        channels,
        rate: rate ? Math.round(rate / 100) / 10 : 0,
        root: sample.rootNote ?? 60,
      }),
    }),
    el('div', {
      class: 'sound-card__subtle',
      text: sample.sourceFilename ?? sample.id,
    }),
    el('div', { class: 'sound-card__tags' }, [
      tag(sample.storageRef?.kind ?? 'unknown'),
      tag(sample.loop?.enabled ? t('sound.loopOn') : t('sound.loopOff')),
    ]),
  ]);
}

function instrumentRow(instrument, project, t) {
  const assigned = project.song.tracks
    .filter((track) => track.defaultInstrumentId === instrument.id)
    .map((track) => track.name);

  return el('article', {
    class: 'sound-card',
    dataset: { action: 'sound-instrument', entity: instrument.id },
  }, [
    el('div', { class: 'sound-card__title', text: instrument.name }),
    el('div', {
      class: 'sound-card__meta',
      text: t('sound.instrumentMeta', {
        zones: instrument.zones?.length ?? 0,
        pan: Number(instrument.defaultPan ?? 0).toFixed(2),
        sustain: Number(instrument.ampEnvelope?.sustainLevel ?? 1).toFixed(2),
      }),
    }),
    el('div', {
      class: 'sound-card__subtle',
      text: assigned.length
        ? t('sound.assignedTracks', { tracks: assigned.join(', ') })
        : t('sound.unassigned'),
    }),
  ]);
}

function tag(text) {
  return el('span', { class: 'sound-card__tag', text });
}
