// Lagu belajar: tujuh Pattern, sembilan occurrence, delapan channel yang bisa
// diedit. Memakai sound bawaan saja sehingga siap dibuka tanpa unduhan WAV.
// Semua note tetap Pattern-local; bagian Chorus dipakai ulang lewat OrderEntry.

import { createBlankProject, DEFAULT_ROW_TICKS } from './project.js';
import { createFactoryDrumKitInstrument, createFactoryDrumSamples } from './factory-drum-kit.js';
import { STABILITY_DEMO_INSTRUMENTS } from './demos.js';

export const LEARNING_SONG_TEMPLATE_ID = 'learning-song';
export const LEARNING_SONG_TITLE = 'Malam Kota — Lagu Contoh';

const TRACKS = Object.freeze([
  { name: 'Drum Kit', instrument: 'factory.drum-kit', color: '#E76F51', drum: true },
  { name: 'Bass Triangle', instrument: 'demo.bass', color: '#318F63' },
  { name: 'Keys Pluck', instrument: 'factory.basic', color: '#D19B2B', poly: true },
  { name: 'Pad Harmoni', instrument: 'demo.harmony', color: '#8A6BC4', poly: true },
  { name: 'Arpeggio Square', instrument: 'demo.arp', color: '#3A8CAA' },
  { name: 'Lead Saw', instrument: 'demo.lead', color: '#CF638A' },
  { name: 'Countermelodi', instrument: 'demo.lead', color: '#7B8CB5' },
  { name: 'Tom Fill Synth', instrument: 'demo.fill', color: '#B67D4B' },
]);

// Progresi minor yang sederhana dan konsisten agar pengguna dapat menelusuri
// hubungan kick, root bass, chord tiga suara, arpeggio, dan melodi.
const CHORDS = Object.freeze({
  Am: { bass: 45, triad: [57, 60, 64] },
  F: { bass: 41, triad: [53, 57, 60] },
  C: { bass: 36, triad: [55, 60, 64] },
  G: { bass: 43, triad: [55, 59, 62] },
  E: { bass: 40, triad: [52, 56, 59] },
  Dm: { bass: 38, triad: [53, 57, 62] },
});

const PATTERNS = Object.freeze([
  { name: '01 Intro — bangun lapisan', part: 'intro', chords: ['Am', 'F', 'C', 'G'] },
  { name: '02 Verse A — tema', part: 'verse', chords: ['Am', 'F', 'C', 'G'] },
  { name: '03 Verse B — variasi', part: 'verse-b', chords: ['Am', 'F', 'C', 'E'] },
  { name: '04 Chorus A — hook', part: 'chorus', chords: ['F', 'C', 'G', 'Am'] },
  { name: '05 Chorus B — jawaban', part: 'chorus-b', chords: ['F', 'C', 'G', 'Am'] },
  { name: '06 Bridge — kontras', part: 'bridge', chords: ['Dm', 'F', 'E', 'Am'] },
  { name: '07 Outro — resolusi', part: 'outro', chords: ['Am', 'F', 'E', 'Am'] },
]);

const SECTIONS = Object.freeze([
  { name: 'Intro', color: '#64748B' },
  { name: 'Verse', color: '#2563EB' },
  { name: 'Chorus', color: '#DB2777' },
  { name: 'Bridge', color: '#7C3AED' },
  { name: 'Outro', color: '#16A34A' },
]);

// Chorus A/B pada occurrence 7/8 memakai Pattern yang sama dengan 4/5:
// editor akan memperlihatkan tanda ×2 dan "Jadikan unik" bila dibutuhkan.
const ORDER = Object.freeze([
  [0, 0], [1, 1], [2, 1], [3, 2], [4, 2],
  [5, 3], [3, 2], [4, 2], [6, 4],
]);

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createLearningSongProject(options = {}) {
  const idFactory = options.idFactory ?? makeId;
  const base = createBlankProject(options);
  const tracks = base.song.tracks.map((track, index) => ({
    ...track,
    name: TRACKS[index].name,
    color: TRACKS[index].color,
    kind: TRACKS[index].drum ? 'drum' : 'instrument',
    polyphony: TRACKS[index].drum || TRACKS[index].poly ? 'poly' : 'mono',
    defaultInstrumentId: TRACKS[index].instrument,
  }));

  const patterns = PATTERNS.map((definition) => {
    const pattern = {
      id: idFactory('pattern'),
      name: definition.name,
      lengthTicks: 64 * DEFAULT_ROW_TICKS,
      rowTicks: DEFAULT_ROW_TICKS,
      meter: { num: 4, den: 4 },
      notes: [],
      effects: [],
      chords: [],
      tempoEvents: [],
    };
    fillPattern(pattern, tracks, definition, idFactory);
    pattern.notes.sort((left, right) => (
      left.startTickLocal - right.startTickLocal
      || left.trackId.localeCompare(right.trackId)
      || (left.voiceLane ?? 0) - (right.voiceLane ?? 0)
    ));
    return pattern;
  });

  const sections = SECTIONS.map((section) => ({
    id: idFactory('section'),
    ...section,
  }));
  const order = ORDER.map(([patternIndex, sectionIndex]) => ({
    id: idFactory('order'),
    patternId: patterns[patternIndex].id,
    sectionId: sections[sectionIndex].id,
    keyOverride: null,
  }));

  return {
    ...base,
    title: LEARNING_SONG_TITLE,
    song: {
      ...base.song,
      initial: { ...base.song.initial, tempo: 112, key: 'Am' },
      tracks,
      sections,
      patterns,
      order,
    },
    samples: [...base.samples, ...createFactoryDrumSamples()],
    instruments: [
      ...base.instruments,
      createFactoryDrumKitInstrument(),
      ...STABILITY_DEMO_INSTRUMENTS,
    ],
  };
}

function fillPattern(pattern, tracks, definition, idFactory) {
  const { part, chords } = definition;
  const chorus = part.startsWith('chorus');
  const intro = part === 'intro';
  const bridge = part === 'bridge';
  const outro = part === 'outro';

  function note(trackIndex, row, pitch, velocity, durationRows = 1, voiceLane = 0) {
    if (row < 0 || row >= 64 || durationRows < 1 || row + durationRows > 64) {
      throw new RangeError(`Note lagu contoh melewati Pattern: ${row} + ${durationRows}`);
    }
    const track = tracks[trackIndex];
    const event = {
      id: idFactory('note'),
      trackId: track.id,
      startTickLocal: row * DEFAULT_ROW_TICKS,
      durationTicks: durationRows * DEFAULT_ROW_TICKS,
      pitch,
      instrumentId: track.defaultInstrumentId,
      velocity,
      source: 'user',
      locked: false,
    };
    if (track.polyphony === 'poly') event.voiceLane = voiceLane;
    pattern.notes.push(event);
  }

  chords.forEach((name, bar) => {
    const chord = CHORDS[name];
    const start = bar * 16;
    const quiet = intro || outro;
    const finalBar = outro && bar === 3;

    // Drum Kit adalah satu channel polifonik: lane 0 kick, 1 snare,
    // lane 2 hi-hat; tidak menghabiskan channel lain untuk drum.
    const kicks = intro && bar === 0 ? [0] : bridge ? [0, 8] : [0, 8, 12];
    for (const beat of kicks) {
      if (!finalBar || beat === 0) note(0, start + beat, 36, quiet ? 58 : chorus ? 82 : 70, 1, 0);
    }
    if (!intro || bar >= 2) {
      for (const beat of [4, 12]) {
        if (!finalBar || beat === 4) note(0, start + beat, 38, quiet ? 50 : 69, 1, 1);
      }
    }
    if (!finalBar) {
      for (let eighth = 0; eighth < 8; eighth += 1) {
        const offset = eighth * 2;
        const open = chorus && eighth === 7;
        note(0, start + offset, open ? 46 : 42,
          quiet ? 31 : eighth % 2 === 0 ? 46 : 34, 1, 2);
      }
    }

    // Root/fifth mengikuti perubahan chord, bass tidak sekadar satu nada.
    const bassNotes = [chord.bass, chord.bass + 7, chord.bass, chord.bass + 7];
    const bassCount = intro && bar === 0 ? 2 : finalBar ? 1 : 4;
    for (let beat = 0; beat < bassCount; beat += 1) {
      note(1, start + beat * 4, bassNotes[beat], beat === 0 ? 104 : 82, finalBar ? 15 : 4);
    }

    // Keys: tiga voice lane pendek (chord stabs). Pad: triad tahan 1 bar,
    // menjadi contoh visual chord poly dan sustain berbeda.
    const stabs = intro && bar === 0 ? [0] : finalBar ? [0] : [0, 8];
    for (const offset of stabs) {
      chord.triad.forEach((pitch, lane) => note(2, start + offset,
        pitch + 12, quiet ? 46 : chorus ? 72 : 57, 3, lane));
    }
    chord.triad.forEach((pitch, lane) => note(3, start,
      pitch, quiet ? 45 : chorus ? 66 : 56, finalBar ? 16 : 15, lane));

    // Arpeggio memperlihatkan perbedaan Note pendek versus sustain Pad.
    if (!intro || bar > 0) {
      if (!finalBar) {
        const pitches = [
          chord.triad[0] + 12, chord.triad[1] + 12,
          chord.triad[2] + 12, chord.triad[1] + 12,
        ];
        for (let index = 0; index < 8; index += 1) {
          note(4, start + index * 2, pitches[index % 4], quiet ? 42 : 57, 1);
        }
      }
    }
  });

  // Lead dibuat berdasarkan frase melodis, bukan deret random.
  const phrases = {
    intro: [[0, 69, 8], [24, 67, 8], [40, 64, 8], [56, 67, 8]],
    verse: [[0, 69, 6], [8, 72, 4], [12, 69, 4], [16, 67, 8],
      [24, 69, 4], [28, 67, 4], [32, 64, 8], [40, 67, 8],
      [48, 71, 6], [56, 69, 8]],
    'verse-b': [[0, 69, 6], [8, 72, 4], [12, 76, 4], [16, 72, 8],
      [24, 69, 8], [32, 72, 8], [40, 74, 8],
      [48, 76, 6], [56, 80, 8]],
    chorus: [[0, 76, 8], [8, 79, 4], [12, 77, 4], [16, 76, 8],
      [24, 72, 8], [32, 74, 8], [40, 76, 8],
      [48, 79, 8], [56, 81, 8]],
    'chorus-b': [[0, 77, 8], [8, 79, 4], [12, 81, 4], [16, 79, 8],
      [24, 76, 8], [32, 74, 8], [40, 76, 8],
      [48, 72, 6], [56, 69, 8]],
    bridge: [[0, 74, 8], [8, 72, 8], [16, 77, 8], [24, 76, 8],
      [32, 80, 8], [40, 76, 8], [48, 72, 8], [56, 69, 8]],
    outro: [[0, 69, 8], [16, 72, 8], [32, 68, 8], [48, 69, 16]],
  };
  for (const [row, pitch, duration] of phrases[part]) {
    note(5, row, pitch, chorus ? 104 : intro || outro ? 69 : 88, duration);
  }

  // Countermelody hanya masuk saat hook/bridge, memberi ruang untuk Verse.
  if (chorus || bridge) {
    const reply = chorus ? [[4, 67], [20, 64], [36, 69], [52, 72]]
      : [[4, 65], [20, 69], [36, 68], [52, 64]];
    for (const [row, pitch] of reply) note(6, row, pitch, 50, 4);
  }

  // Fill penanda phrase setiap empat bar, jangan terus menutupi melodi.
  if (!intro && !outro) {
    for (const [row, pitch, velocity] of [
      [56, 50, 38], [58, 53, 42], [60, 55, 47], [62, 57, 54],
    ]) note(7, row, pitch, velocity);
  }
}
