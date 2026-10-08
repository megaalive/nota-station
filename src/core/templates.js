// Template R1/R2. Kosong tetap minimal; Pop 4/4 memakai factory Drum Kit R2
// agar satu top-level channel dapat membawa kick/snare/hi-hat polifonik.

import {
  activePattern,
  configureDrumTrack,
  createBlankProject,
  enterNote,
  enterVoiceNote,
} from './project.js';
import { createLearningSongProject, LEARNING_SONG_TEMPLATE_ID } from './learning-song.js';
import {
  createFactoryDrumKitInstrument,
  createFactoryDrumSamples,
} from './factory-drum-kit.js';

export const R1_TEMPLATES = Object.freeze([
  { id: 'blank', labelKey: 'template.blank' },
  { id: 'pop-4-4', labelKey: 'template.pop44' },
  { id: LEARNING_SONG_TEMPLATE_ID, labelKey: 'template.learningSong' },
]);

export function createTemplateProject(templateId, options = {}) {
  if (templateId === 'blank') return createBlankProject(options);
  if (templateId === LEARNING_SONG_TEMPLATE_ID) return createLearningSongProject(options);
  if (templateId !== 'pop-4-4') {
    const error = new Error(`Template tidak dikenal: ${templateId}`);
    error.code = 'E_TEMPLATE_UNKNOWN';
    throw error;
  }

  let project = createBlankProject(options);
  const pattern = activePattern(project);
  const [drums, bass, melody] = project.song.tracks;
  const drumSamples = createFactoryDrumSamples();
  const drumKit = createFactoryDrumKitInstrument();

  const tracks = project.song.tracks.map((track, index) => ({
    ...track,
    name: ['Drums', 'Bass', 'Melodi'][index] ?? track.name,
  }));
  project = {
    ...project,
    title: 'Pop 4/4',
    samples: [...project.samples, ...drumSamples],
    instruments: [...project.instruments, drumKit],
    song: {
      ...project.song,
      initial: {
        ...project.song.initial,
        tempo: 120,
        meter: { num: 4, den: 4 },
      },
      tracks,
    },
  };
  project = configureDrumTrack(project, {
    trackId: drums.id,
    instrumentId: drumKit.id,
  }, options);

  const drumHits = [
    // Kick lane 0.
    [0, 0, 36, 96], [4, 0, 36, 92], [8, 0, 36, 96], [12, 0, 36, 92],
    // Snare lane 1; row 4/12 bersamaan dengan kick + hi-hat.
    [4, 1, 38, 82], [12, 1, 38, 84],
    // Hi-hat lane 2. Closed/Open saling choke melalui zone chokeGroup.
    [0, 2, 42, 48], [2, 2, 42, 42], [4, 2, 42, 50], [6, 2, 42, 42],
    [8, 2, 42, 48], [10, 2, 42, 42], [12, 2, 42, 50], [14, 2, 46, 46],
  ];
  for (const [row, voiceLane, pitch, velocity] of drumHits) {
    project = enterVoiceNote(project, {
      patternId: pattern.id,
      trackId: drums.id,
      row,
      voiceLane,
      pitch,
      velocity,
    }, options);
  }

  const notes = [
    // Bass guide: C-C-F-G.
    [bass.id, 0, 36], [bass.id, 4, 36], [bass.id, 8, 41], [bass.id, 12, 43],
    // Melodi sederhana 16 row agar langsung terdengar dan mudah diedit.
    [melody.id, 0, 60], [melody.id, 2, 64], [melody.id, 4, 67], [melody.id, 6, 69],
    [melody.id, 8, 67], [melody.id, 10, 64], [melody.id, 12, 62], [melody.id, 14, 60],
  ];

  for (const [trackId, row, pitch] of notes) {
    project = enterNote(project, {
      patternId: pattern.id,
      trackId,
      row,
      pitch,
      velocity: trackId === bass.id ? 90 : 100,
    }, options);
  }

  return project;
}
