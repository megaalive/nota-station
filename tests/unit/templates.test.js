import test from 'node:test';
import assert from 'node:assert/strict';

import { activePattern, notesAtCell } from '../../src/core/project.js';
import { createTemplateProject, R1_TEMPLATES } from '../../src/core/templates.js';

function opts() {
  let seq = 0;
  return {
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-05T00:00:00.000Z',
  };
}

test('R1 hanya mengekspos template Kosong dan Pop 4/4', () => {
  assert.deepEqual(R1_TEMPLATES.map((x) => x.id), ['blank', 'pop-4-4']);
});

test('template Kosong tetap project R1 kosong', () => {
  const project = createTemplateProject('blank', opts());
  assert.equal(activePattern(project).notes.length, 0);
  assert.equal(project.song.initial.tempo, 120);
});

test('template Pop 4/4 memakai satu Drum Track polifonik + bass + melodi', () => {
  const project = createTemplateProject('pop-4-4', opts());
  const pattern = activePattern(project);
  const [drums, bass, melody] = project.song.tracks;

  assert.equal(project.title, 'Pop 4/4');
  assert.equal(project.song.initial.tempo, 120);
  assert.deepEqual(project.song.initial.meter, { num: 4, den: 4 });
  assert.deepEqual(project.song.tracks.slice(0, 3).map((t) => t.name), ['Drums', 'Bass', 'Melodi']);
  assert.equal(drums.kind, 'drum');
  assert.equal(drums.polyphony, 'poly');
  assert.equal(drums.defaultInstrumentId, 'factory.drum-kit');

  const row4 = notesAtCell(project, {
    patternId: pattern.id,
    trackId: drums.id,
    row: 4,
  });
  assert.deepEqual(row4.map((note) => note.voiceLane), [0, 1, 2]);
  assert.deepEqual(row4.map((note) => note.pitch), [36, 38, 42]);

  assert.equal(pattern.notes.length, 26);
  assert.ok(pattern.notes.some((n) => n.trackId === bass.id));
  assert.ok(pattern.notes.some((n) => n.trackId === melody.id));
  assert.ok(pattern.notes.every((n) => !Object.hasOwn(n, 'absoluteTick')));
});

test('template asing ditolak dengan kode stabil', () => {
  assert.throws(
    () => createTemplateProject('balada-6-8', opts()),
    (error) => error.code === 'E_TEMPLATE_UNKNOWN',
  );
});
