// Demo yang dapat dibuka langsung dari URL untuk UAT/stability.
// Bukan template R1: daftar template tetap Kosong + Pop 4/4 sesuai roadmap.

import { activePattern, createBlankProject, enterNote } from './project.js';

export const STABILITY_DEMO_ID = 'stability';

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
      })),
    },
  };

  const notes = [];

  // Empat bar 4/4. Pulse kick memberi anchor yang stabil untuk didengar lama.
  for (let bar = 0; bar < 4; bar += 1) {
    const start = bar * 16;
    for (const row of [0, 4, 8, 12]) notes.push([kick.id, start + row, 36, 112]);
    notes.push([kick.id, start + 14, 38, 76]);

    for (const row of [4, 12]) notes.push([snare.id, start + row, 50, 96]);
    notes.push([snare.id, start + 11, 48, 48]);

    // Hi-hat 1/8 dengan aksen bergantian.
    for (let row = 0; row < 16; row += 2) {
      notes.push([hat.id, start + row, row % 4 === 0 ? 84 : 88, row % 4 === 0 ? 62 : 44]);
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
      notes.push([bass.id, bar * 16 + beat * 4, pitch, beat === 0 ? 104 : 88]);
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
      notes.push([arp.id, bar * 16 + step * 2, pitch, step % 4 === 0 ? 78 : 62]);
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
      notes.push([harmony.id, bar * 16 + beat * 4 + 2, pitch, 52]);
    });
  });

  // Melodi utama dibuat lapang supaya motifnya tetap terbaca di atas pola ritmis.
  const melody = [
    [0, 69, 98], [4, 72, 92], [8, 76, 104], [12, 72, 84],
    [16, 69, 94], [20, 72, 86], [24, 74, 96], [28, 72, 82],
    [32, 67, 90], [36, 72, 94], [40, 76, 102], [44, 74, 86],
    [48, 71, 92], [52, 74, 98], [56, 72, 88], [60, 69, 106],
  ];
  for (const [row, pitch, velocity] of melody) {
    notes.push([lead.id, row, pitch, velocity]);
  }

  // Fill menjelang pergantian bar; bar terakhir lebih padat sebagai penanda loop kembali ke awal.
  for (const row of [14, 30, 46]) notes.push([fill.id, row, 55, 58]);
  for (const [row, pitch, velocity] of [
    [56, 52, 62], [58, 55, 70], [60, 57, 78], [62, 60, 92],
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
