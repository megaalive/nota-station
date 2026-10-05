import { el } from './dom.js';
import { Button, Toast } from './kit.js';

export function createSoundView({
  root,
  t,
  getProject,
  onImportWav,
  onUpdateInstrument,
  onLoadWaveform,
  onUndo,
}) {
  let selectedTrackId = getProject().song.tracks[0]?.id ?? null;
  let selectedInstrumentId = getProject().instruments[0]?.id ?? null;
  let editorMode = 'simple';
  let busy = false;
  let statusKey = 'sound.statusReady';
  let statusVars = {};
  const waveformCache = new Map();

  function refresh() {
    const project = getProject();
    if (!project.song.tracks.some((track) => track.id === selectedTrackId)) {
      selectedTrackId = project.song.tracks[0]?.id ?? null;
    }
    if (!project.instruments.some((instrument) => instrument.id === selectedInstrumentId)) {
      selectedInstrumentId = project.instruments[0]?.id ?? null;
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
        selectedInstrumentId = result.instrumentId;
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
            onUndo('io.importWav');
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
      sectionHead(t('sound.samples'), t('sound.sampleCount', { count: project.samples.length }), project.samples.length),
      project.samples.length
        ? el('div', { class: 'sound-list', dataset: { action: 'sound-sample-list' } },
          project.samples.map((sample) => sampleRow(sample, t)))
        : el('p', { class: 'sound-workspace__empty', text: t('sound.noSamples') }),
    ]);

    const instruments = el('section', { class: 'sound-workspace__section' }, [
      sectionHead(
        t('sound.instruments'),
        t('sound.instrumentCount', { count: project.instruments.length }),
        project.instruments.length,
      ),
      project.instruments.length
        ? el('div', { class: 'sound-list', dataset: { action: 'sound-instrument-list' } },
          project.instruments.map((instrument) => instrumentRow(
            instrument,
            project,
            t,
            instrument.id === selectedInstrumentId,
            () => {
              selectedInstrumentId = instrument.id;
              refresh();
            },
          )))
        : el('p', { class: 'sound-workspace__empty', text: t('sound.noInstruments') }),
    ]);

    const browserGrid = el('div', { class: 'sound-workspace__grid' }, [
      samples,
      instruments,
    ]);

    root.append(toolbar, status, browserGrid);

    const editor = buildEditor(project);
    if (editor) root.append(editor);
  }

  function buildEditor(project) {
    const instrument = project.instruments.find((item) => item.id === selectedInstrumentId);
    if (!instrument) return null;

    if (instrument.type !== 'sampler' || instrument.zones?.length !== 1) {
      return el('section', { class: 'sound-editor sound-workspace__section' }, [
        el('h3', { text: t('sound.editorTitle') }),
        el('p', { class: 'sound-workspace__empty', text: t('sound.multizoneLater') }),
      ]);
    }

    const zone = instrument.zones[0];
    const sample = project.samples.find((item) => item.id === zone.sampleId);
    if (!sample) return null;

    const simpleButton = modeButton('simple', t('sound.modeSimple'));
    const advancedButton = modeButton('advanced', t('sound.modeAdvanced'));
    const modeBar = el('div', {
      class: 'sound-editor__modes',
      role: 'group',
      'aria-label': t('sound.editorMode'),
    }, [simpleButton, advancedButton]);

    const canvas = el('canvas', {
      class: 'sound-waveform',
      width: '640',
      height: '120',
      role: 'img',
      'aria-label': t('sound.waveform', { name: sample.name }),
      dataset: {
        action: 'sound-waveform',
        sampleId: sample.id,
      },
    });

    loadWaveform(canvas, sample);

    const rootNote = numberField(t('sound.rootNote'), 'sound-root-note', zone.rootNote, 0, 127, 1);
    const tune = numberField(t('sound.fineTune'), 'sound-fine-tune', zone.tuneCents, -1200, 1200, 1);
    const volume = numberField(t('sound.volume'), 'sound-volume', zone.gain, 0, 4, 0.01);
    const pan = numberField(t('sound.pan'), 'sound-pan', instrument.defaultPan, -1, 1, 0.01);

    const loopEnabled = el('input', {
      type: 'checkbox',
      checked: sample.loop.enabled || undefined,
      dataset: { action: 'sound-loop-enabled' },
    });
    const loopField = el('label', { class: 'sound-editor__check' }, [
      loopEnabled,
      el('span', { text: t('sound.loopEnabled') }),
    ]);

    const fields = [
      rootNote.wrapper,
      tune.wrapper,
      volume.wrapper,
      pan.wrapper,
      loopField,
    ];

    let attack;
    let decay;
    let sustain;
    let release;
    let loopStart;
    let loopEnd;

    if (editorMode === 'advanced') {
      attack = numberField(
        t('sound.attack'),
        'sound-attack',
        instrument.ampEnvelope.attackSeconds,
        0,
        60,
        0.001,
      );
      decay = numberField(
        t('sound.decay'),
        'sound-decay',
        instrument.ampEnvelope.decaySeconds,
        0,
        60,
        0.001,
      );
      sustain = numberField(
        t('sound.sustain'),
        'sound-sustain',
        instrument.ampEnvelope.sustainLevel,
        0,
        1,
        0.01,
      );
      release = numberField(
        t('sound.release'),
        'sound-release',
        instrument.ampEnvelope.releaseSeconds,
        0,
        60,
        0.001,
      );
      loopStart = numberField(
        t('sound.loopStart'),
        'sound-loop-start',
        sample.loop.startFrame,
        0,
        sample.frameCount,
        1,
      );
      loopEnd = numberField(
        t('sound.loopEnd'),
        'sound-loop-end',
        sample.loop.endFrame,
        0,
        sample.frameCount,
        1,
      );
      fields.push(
        attack.wrapper,
        decay.wrapper,
        sustain.wrapper,
        release.wrapper,
        loopStart.wrapper,
        loopEnd.wrapper,
      );
    }

    const apply = Button({
      label: t('sound.apply'),
      onClick: async () => {
        try {
          const result = await onUpdateInstrument({
            instrumentId: instrument.id,
            rootNote: Number(rootNote.input.value),
            tuneCents: Number(tune.input.value),
            zoneGain: Number(volume.input.value),
            defaultPan: Number(pan.input.value),
            ampEnvelope: editorMode === 'advanced'
              ? {
                  attackSeconds: Number(attack.input.value),
                  decaySeconds: Number(decay.input.value),
                  sustainLevel: Number(sustain.input.value),
                  releaseSeconds: Number(release.input.value),
                }
              : undefined,
            loop: {
              enabled: loopEnabled.checked,
              startFrame: editorMode === 'advanced'
                ? Number(loopStart.input.value)
                : sample.loop.startFrame,
              endFrame: editorMode === 'advanced'
                ? Number(loopEnd.input.value)
                : sample.loop.endFrame,
              mode: sample.loop.mode,
            },
          });
          statusKey = 'sound.statusUpdated';
          statusVars = { name: result.instrumentName };
          Toast({
            message: t(statusKey, statusVars),
            actionLabel: t('history.undo'),
            onAction: () => {
              onUndo('sound.updateInstrument');
              statusKey = 'sound.statusEditUndone';
              statusVars = {};
              refresh();
            },
          });
          refresh();
        } catch (error) {
          statusKey = 'sound.statusUpdateFailed';
          statusVars = { code: error?.code ?? 'E_SOUND_EDIT' };
          refresh();
        }
      },
    });
    apply.dataset.action = 'sound-apply';

    return el('section', {
      class: 'sound-editor sound-workspace__section',
      dataset: { action: 'sound-editor', entity: instrument.id },
    }, [
      el('div', { class: 'sound-editor__head' }, [
        el('div', {}, [
          el('h3', { text: t('sound.editorTitle') }),
          el('div', { class: 'sound-card__subtle', text: `${instrument.name} · ${sample.name}` }),
        ]),
        modeBar,
      ]),
      el('div', { class: 'sound-editor__waveform-wrap' }, [
        canvas,
        el('div', {
          class: 'sound-card__subtle',
          text: t('sound.waveformMeta', {
            frames: sample.frameCount,
            rate: Math.round(sample.sampleRate / 100) / 10,
            channels: sample.channels,
          }),
        }),
      ]),
      el('div', { class: 'sound-editor__fields' }, fields),
      el('div', { class: 'sound-editor__actions' }, [apply]),
    ]);
  }

  function modeButton(mode, label) {
    const button = Button({
      label,
      variant: 'ghost',
      onClick: () => {
        editorMode = mode;
        refresh();
      },
    });
    button.dataset.action = `sound-mode-${mode}`;
    button.setAttribute('aria-pressed', editorMode === mode ? 'true' : 'false');
    return button;
  }

  async function loadWaveform(canvas, sample) {
    const cached = waveformCache.get(sample.contentHash);
    if (cached) {
      drawWaveform(canvas, cached);
      return;
    }

    canvas.dataset.loading = 'true';
    try {
      const summary = await onLoadWaveform(sample.id);
      waveformCache.set(sample.contentHash, summary);
      if (canvas.isConnected && canvas.dataset.sampleId === sample.id) {
        drawWaveform(canvas, summary);
      }
    } catch (error) {
      if (canvas.isConnected) canvas.dataset.error = error?.code ?? 'E_WAVEFORM';
    } finally {
      if (canvas.isConnected) delete canvas.dataset.loading;
    }
  }

  refresh();
  return Object.freeze({ refresh });
}

function sectionHead(title, label, count) {
  return el('div', { class: 'sound-workspace__section-head' }, [
    el('h3', { text: title }),
    el('span', {
      class: 'sound-workspace__count',
      text: String(count),
      'aria-label': label,
    }),
  ]);
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

function instrumentRow(instrument, project, t, selected, onSelect) {
  const assigned = project.song.tracks
    .filter((track) => track.defaultInstrumentId === instrument.id)
    .map((track) => track.name);

  const button = el('button', {
    type: 'button',
    class: `sound-card sound-card--selectable${selected ? ' is-selected' : ''}`,
    dataset: { action: 'sound-instrument', entity: instrument.id },
    'aria-pressed': selected ? 'true' : 'false',
    on: { click: onSelect },
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
  return button;
}

function numberField(label, action, value, min, max, step) {
  const input = el('input', {
    type: 'number',
    value: String(value),
    min: String(min),
    max: String(max),
    step: String(step),
    inputmode: 'decimal',
    dataset: { action },
  });
  return {
    input,
    wrapper: el('label', { class: 'sound-workspace__field' }, [
      el('span', { class: 'sound-workspace__label', text: label }),
      input,
    ]),
  };
}

function drawWaveform(canvas, summary) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  const mid = height / 2;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = getComputedStyle(canvas).color;
  context.lineWidth = 1;
  context.beginPath();

  summary.peaks.forEach((peak, index) => {
    const x = summary.peaks.length === 1
      ? width / 2
      : index * (width - 1) / (summary.peaks.length - 1);
    const yTop = mid - peak.max * (mid - 2);
    const yBottom = mid - peak.min * (mid - 2);
    context.moveTo(x, yTop);
    context.lineTo(x, yBottom);
  });
  context.stroke();

  canvas.dataset.bins = String(summary.bins);
  canvas.dataset.frames = String(summary.frameCount);
}

function tag(text) {
  return el('span', { class: 'sound-card__tag', text });
}
