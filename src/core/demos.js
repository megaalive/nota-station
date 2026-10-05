// Demo yang dapat dibuka langsung dari URL untuk UAT/stability.
// Bukan template R1: daftar template tetap Kosong + Pop 4/4 sesuai roadmap.

import { activePattern, createBlankProject, enterNote } from './project.js';

export const STABILITY_DEMO_ID = 'stability';

export const STABILITY_DEMO_INSTRUMENTS = Object.freeze([
  { id: 'demo.kick', name: 'Kick Synth', sampleId: 'factory.basic', rootPitch: 36 },
  { id: 'demo.snare', name: 'Snare Noise', sampleId: 'factory.basic', rootPitch: 50 },
  { id: 'demo.hat', name: 'Hi-Hat Noise', sampleId: 'factory.basic', rootPitch: 84 },
  { id: 'demo.bass', name: 'Triangle Bass', sampleId: 'factory.basic', rootPitch: 45 },
  { id: 'demo.arp', name: 'Square Arpeggio', sampleId: 'factory.basic', rootPitch: 60 },
  { id: 'demo.lead', name: 'Saw Lead', sampleId: 'factory.basic', rootPitch: 69 },
  { id: 'demo.harmony', name: 'Sine Harmony', sampleId: 'factory.basic', rootPitch: 64 },
  { id: 'demo.fill', name: 'Pitch Tom Fill', sampleId: 'factory.basic', rootPitch: 55 },
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
    for (const row of [0, 4, 8, 12]) notes.push([kick.id, start + row, 36, 84]);
    notes.push([kick.id, start + 14, 38, 54]);

    for (const row of [4, 12]) notes.push([snare.id, start + row, 50, 72]);
    notes.push([snare.id, start + 11, 48, 34]);

    // Hi-hat 1/8 dengan aksen bergantian.
    for (let row = 0; row < 16; row += 2) {
      notes.push([hat.id, start + row, row % 4 === 0 ? 84 : 88, row % 4 === 0 ? 38 : 24]);
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
      notes.push([bass.id, bar * 16 + beat * 4, pitch, beat === 0 ? 116 : 104]);
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

  // Counter-pulse harmony mengisi sela arpeggio tanpa membentuk chord simultan pada satu track.
  const harmonyBars = [
    [64, 67, 64, 67],
    [60, 64, 60, 64],
    [67, 72, 67, 72],
    [62, 67, 62, 67],
  ];
  harmonyBars.forEach((pitches, bar) => {
    pitches.forEach((pitch, beat) => {
      notes.push([harmony.id, bar * 16 + beat * 4 + 2, pitch, 76]);
    });
  });

  // Melodi utama dibuat lapang supaya motifnya tetap terbaca di atas pola ritmis.
  const melody = [
    [0, 69, 118], [4, 72, 112], [8, 76, 122], [12, 72, 104],
    [16, 69, 114], [20, 72, 108], [24, 74, 116], [28, 72, 102],
    [32, 67, 110], [36, 72, 114], [40, 76, 120], [44, 74, 106],
    [48, 71, 112], [52, 74, 118], [56, 72, 108], [60, 69, 124],
  ];
  for (const [row, pitch, velocity] of melody) {
    notes.push([lead.id, row, pitch, velocity]);
  }

  // Fill menjelang pergantian bar; bar terakhir lebih padat sebagai penanda loop kembali ke awal.
  for (const row of [14, 30, 46]) notes.push([fill.id, row, 55, 58]);
  for (const [row, pitch, velocity] of [
    [56, 52, 46], [58, 55, 52], [60, 57, 58], [62, 60, 66],
  ]) {
    notes.push([fill.id, row, pitch, velocity]);
  }

  for (const [trackId, row, pitch, velocity] of notes) {
    project = enterNote(project, {
      patternId: pattern.id,
      trackId,
      row,
      pitch,
      velocity,
    }, options);
  }

  return project;
}
