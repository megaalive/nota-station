// Demo yang dapat dibuka langsung dari URL untuk UAT/stability.
// Bukan template R1: daftar template tetap Kosong + Pop 4/4 sesuai roadmap.

import { activePattern, createBlankProject, enterNote } from './project.js';
import { createSamplerInstrument } from './sound-model.js';

export const STABILITY_DEMO_ID = 'stability';

export const STABILITY_DEMO_INSTRUMENTS = Object.freeze([
  createSamplerInstrument({ id: 'demo.kick', name: 'Kick Synth', sampleId: 'factory.basic', rootNote: 36 }),
  createSamplerInstrument({ id: 'demo.snare', name: 'Snare Noise', sampleId: 'factory.basic', rootNote: 50 }),
  createSamplerInstrument({ id: 'demo.hat', name: 'Hi-Hat Noise', sampleId: 'factory.basic', rootNote: 84 }),
  createSamplerInstrument({ id: 'demo.bass', name: 'Triangle Bass', sampleId: 'factory.basic', rootNote: 45 }),
  createSamplerInstrument({ id: 'demo.arp', name: 'Square Arpeggio', sampleId: 'factory.basic', rootNote: 60 }),
  createSamplerInstrument({ id: 'demo.lead', name: 'Saw Lead', sampleId: 'factory.basic', rootNote: 69 }),
  createSamplerInstrument({ id: 'demo.harmony', name: 'Sine Harmony', sampleId: 'factory.basic', rootNote: 64 }),
  createSamplerInstrument({ id: 'demo.fill', name: 'Pitch Tom Fill', sampleId: 'factory.basic', rootNote: 55 }),
]);

export function createDemoProject(demoId, options = {}) {
  if (demoId !== STABILITY_DEMO_ID) {
    const error = new Error(`Demo tidak dikenal: ${demoId}`);
    error.code = 'E_DEMO_UNKNOWN';
    throw error;
  }

  let project = createBlankProject(options);
  const pattern = activePattern(project);
  const [kick, snare, hat, bass, arp, lead, harmony, fill] = project.song.tracks;

  const names = [
    'Kick Pulse',
    'Snare Pulse',
    'Hi-Hat',
    'Bass',
    'Arpeggio',
    'Lead',
    'Harmony',
    'Fill',
  ];

  project = {
    ...project,
    title: 'Malam Kota — Stability Loop',
    song: {
      ...project.song,
      initial: {
        ...project.song.initial,
        tempo: 116,
        meter: { num: 4, den: 4 },
        key: 'Am',
      },
      tracks: project.song.tracks.map((track, index) => ({
        ...track,
        name: names[index],
        defaultInstrumentId: STABILITY_DEMO_INSTRUMENTS[index].id,
      })),
    },
    instruments: [
      ...project.instruments,
      ...STABILITY_DEMO_INSTRUMENTS,
    ],
  };

  const notes = [];

  // Empat bar 4/4. Pulse kick memberi anchor yang stabil untuk didengar lama.
  for (let bar = 0; bar < 4; bar += 1) {
    const start = bar * 16;
    for (const row of [0, 4, 8, 12]) notes.push([kick.id, start + row, 36, 92]);
    notes.push([kick.id, start + 14, 38, 54]);

    for (const row of [4, 12]) notes.push([snare.id, start + row, 50, 80]);
    notes.push([snare.id, start + 11, 48, 34]);

    // Hi-hat 1/8 dengan aksen bergantian.
    for (let row = 0; row < 16; row += 2) {
      notes.push([hat.id, start + row, row % 4 === 0 ? 84 : 88, row % 4 === 0 ? 46 : 30]);
    }
  }

  // Progression Am | F | C | G.
  const bassBars = [
    [45, 52, 45, 52],
    [41, 48, 41, 48],
    [36, 43, 36, 43],
    [43, 50, 43, 50],
  ];
  bassBars.forEach((pitches, bar) => {
    pitches.forEach((pitch, beat) => {
      notes.push([bass.id, bar * 16 + beat * 4, pitch, beat === 0 ? 116 : 104, 4]);
    });
  });

  const arpBars = [
    [57, 60, 64, 60, 57, 60, 64, 60],
    [53, 57, 60, 57, 53, 57, 60, 57],
    [60, 64, 67, 64, 60, 64, 67, 64],
    [55, 59, 62, 59, 55, 59, 62, 59],
  ];
  arpBars.forEach((pitches, bar) => {
    pitches.forEach((pitch, step) => {
      notes.push([arp.id, bar * 16 + step * 2, pitch, step % 4 === 0 ? 92 : 76]);
    });
  });

  // Harmony menjadi nada tahan satu bar penuh. Ini sengaja memberi fixture
  // sustain panjang (~2,07 dtk pada 116 BPM) untuk UAT scheduler/voice.
  const harmonyBars = [64, 60, 67, 62];
  harmonyBars.forEach((pitch, bar) => {
    notes.push([harmony.id, bar * 16, pitch, 72, 16]);
  });

  // Lead berganti setiap setengah bar dengan sustain 8 row (~1,03 dtk).
  const melody = [
    [0, 69, 116, 8], [8, 76, 120, 8],
    [16, 69, 112, 8], [24, 74, 118, 8],
    [32, 67, 110, 8], [40, 76, 120, 8],
    [48, 71, 114, 8], [56, 69, 122, 8],
  ];
  for (const [row, pitch, velocity, durationRows] of melody) {
    notes.push([lead.id, row, pitch, velocity, durationRows]);
  }

  // Fill menjelang pergantian bar; bar terakhir lebih padat sebagai penanda loop kembali ke awal.
  for (const row of [14, 30, 46]) notes.push([fill.id, row, 55, 58]);
  for (const [row, pitch, velocity] of [
    [56, 52, 46], [58, 55, 52], [60, 57, 58], [62, 60, 66],
  ]) {
    notes.push([fill.id, row, pitch, velocity]);
  }

  for (const [trackId, row, pitch, velocity, durationRows = 1] of notes) {
    project = enterNote(project, {
      patternId: pattern.id,
      trackId,
      row,
      pitch,
      velocity,
      durationTicks: durationRows * pattern.rowTicks,
    }, options);
  }

  return project;
}
