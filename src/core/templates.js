// Template R1 §6.5. R1 hanya mengirim Kosong + Pop 4/4.
// Balada 6/8 dan Demo lagu tetap R4 sesuai roadmap.

import { activePattern, createBlankProject, enterNote } from './project.js';

export const R1_TEMPLATES = Object.freeze([
  { id: 'blank', labelKey: 'template.blank' },
  { id: 'pop-4-4', labelKey: 'template.pop44' },
]);

export function createTemplateProject(templateId, options = {}) {
  if (templateId === 'blank') return createBlankProject(options);
  if (templateId !== 'pop-4-4') {
    const error = new Error(`Template tidak dikenal: ${templateId}`);
    error.code = 'E_TEMPLATE_UNKNOWN';
    throw error;
  }

  let project = createBlankProject(options);
  const pattern = activePattern(project);
  const [kick, snare, bass, melody] = project.song.tracks;

  const tracks = project.song.tracks.map((track, index) => ({
    ...track,
    name: ['Kick', 'Snare', 'Bass', 'Melodi'][index] ?? track.name,
  }));
  project = {
    ...project,
    title: 'Pop 4/4',
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

  const notes = [
    // Drum-like guide memakai factory Basic R1. Factory drum nyata baru R2.
    [kick.id, 0, 36], [kick.id, 4, 36], [kick.id, 8, 36], [kick.id, 12, 36],
    [snare.id, 4, 38], [snare.id, 12, 38],
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
