import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addSection,
  assignOrderEntrySection,
  insertOrderEntry,
  makeOrderEntryUnique,
  moveOrderEntry,
  patternUsageCount,
} from '../../src/core/arrangement.js';
import { createBlankProject, enterNote } from '../../src/core/project.js';
import { parseDebugProject, serializeDebugProject } from '../../src/io/debug-json.js';

function ids() {
  let seq = 0;
  return (prefix) => `${prefix}-r3-${++seq}`;
}

function fixture() {
  const idFactory = ids();
  let project = createBlankProject({
    idFactory,
    now: () => '2026-10-05T14:00:00.000Z',
  });
  const patternId = project.song.patterns[0].id;
  const trackId = project.song.tracks[0].id;
  project = enterNote(project, {
    patternId,
    trackId,
    row: 0,
    pitch: 60,
  }, {
    idFactory,
    now: () => '2026-10-05T14:01:00.000Z',
  });

  project = {
    ...project,
    song: {
      ...project.song,
      patterns: project.song.patterns.map((pattern) => pattern.id === patternId ? {
        ...pattern,
        effects: [{ id: 'effect-source', trackId, tickLocal: 120, type: 'volume', value: 90 }],
        chords: [{
          id: 'chord-source',
          tickLocal: 0,
          durationTicks: 1920,
          rootPitchClass: 0,
          quality: 'major',
        }],
        tempoEvents: [{ id: 'tempo-source', tickLocal: 960, tempo: 132 }],
      } : pattern),
    },
  };
  return { project, idFactory, patternId };
}

test('addSection menambah Section immutable dengan nama/warna tervalidasi', () => {
  const { project, idFactory } = fixture();
  const next = addSection(project, {
    name: ' Verse 1 ',
    color: '#336699',
  }, {
    idFactory,
    now: () => '2026-10-05T14:01:30.000Z',
  });

  assert.equal(project.song.sections.length, 0);
  assert.equal(next.song.sections.length, 1);
  assert.deepEqual(next.song.sections[0], {
    id: 'section-r3-7',
    name: 'Verse 1',
    color: '#336699',
  });
  assert.equal(next.modifiedAt, '2026-10-05T14:01:30.000Z');

  assert.throws(
    () => addSection(project, { name: '   ' }),
    (error) => error.code === 'E_PROJECT_SECTION_NAME',
  );
  assert.throws(
    () => addSection(project, { name: 'Verse', color: 'red' }),
    (error) => error.code === 'E_PROJECT_SECTION_COLOR',
  );
});

test('assignOrderEntrySection memasang/melepas section tanpa mengubah Pattern', () => {
  const { project, idFactory, patternId } = fixture();
  const withSection = addSection(project, {
    name: 'Verse',
    color: '#336699',
  }, {
    idFactory,
    now: () => '2026-10-05T14:01:30.000Z',
  });
  const sectionId = withSection.song.sections[0].id;
  const orderEntryId = withSection.song.order[0].id;
  const patternsBefore = structuredClone(withSection.song.patterns);

  const assigned = assignOrderEntrySection(withSection, {
    orderEntryId,
    sectionId,
  }, {
    now: () => '2026-10-05T14:01:40.000Z',
  });
  assert.equal(assigned.song.order[0].sectionId, sectionId);
  assert.deepEqual(assigned.song.patterns, patternsBefore);

  const unassigned = assignOrderEntrySection(assigned, {
    orderEntryId,
    sectionId: null,
  }, {
    now: () => '2026-10-05T14:01:50.000Z',
  });
  assert.equal(unassigned.song.order[0].sectionId, null);

  assert.throws(
    () => assignOrderEntrySection(withSection, { orderEntryId, sectionId: 'missing' }),
    (error) => error.code === 'E_PROJECT_SECTION_MISSING',
  );
  assert.throws(
    () => assignOrderEntrySection(withSection, { orderEntryId: 'missing', sectionId }),
    (error) => error.code === 'E_PROJECT_ORDER_MISSING',
  );
});

test('Section + assignment round-trip lewat debug JSON dan sectionId yatim ditolak', () => {
  const { project, idFactory } = fixture();
  let next = addSection(project, {
    name: 'Chorus',
    color: '#7C3AED',
  }, { idFactory });
  next = assignOrderEntrySection(next, {
    orderEntryId: next.song.order[0].id,
    sectionId: next.song.sections[0].id,
  });

  assert.deepEqual(parseDebugProject(serializeDebugProject(next)), next);

  const invalid = structuredClone(next);
  invalid.song.order[0].sectionId = 'section-yatim';
  assert.throws(
    () => serializeDebugProject(invalid),
    (error) => error.code === 'E_DEBUG_JSON_SECTION_REF',
  );
});

test('insertOrderEntry memakai ulang Pattern tanpa menduplikasi definisi', () => {
  const { project, idFactory, patternId } = fixture();
  const next = insertOrderEntry(project, {
    patternId,
    index: 1,
  }, {
    idFactory,
    now: () => '2026-10-05T14:02:00.000Z',
  });

  assert.equal(next.song.patterns.length, 1);
  assert.equal(next.song.order.length, 2);
  assert.deepEqual(next.song.order.map((entry) => entry.patternId), [patternId, patternId]);
  assert.equal(patternUsageCount(next, patternId), 2);
  assert.equal(project.song.order.length, 1, 'input tidak dimutasi');
});

test('moveOrderEntry hanya mengubah urutan occurrence, bukan isi Pattern', () => {
  const { project, idFactory, patternId } = fixture();
  let arranged = insertOrderEntry(project, { patternId, index: 1 }, {
    idFactory,
    now: () => '2026-10-05T14:02:00.000Z',
  });
  arranged = makeOrderEntryUnique(arranged, {
    orderEntryId: arranged.song.order[1].id,
  }, {
    idFactory,
    now: () => '2026-10-05T14:03:00.000Z',
  });

  const patternsBefore = structuredClone(arranged.song.patterns);
  const orderBefore = arranged.song.order.map((entry) => entry.id);
  const moved = moveOrderEntry(arranged, {
    orderEntryId: orderBefore[1],
    toIndex: 0,
  }, {
    now: () => '2026-10-05T14:04:00.000Z',
  });

  assert.deepEqual(moved.song.patterns, patternsBefore);
  assert.deepEqual(moved.song.order.map((entry) => entry.id), [orderBefore[1], orderBefore[0]]);
  assert.deepEqual(arranged.song.order.map((entry) => entry.id), orderBefore);
});

test('makeOrderEntryUnique clone Pattern dan remap ID event lokal hanya untuk occurrence target', () => {
  const { project, idFactory, patternId } = fixture();
  let arranged = insertOrderEntry(project, { patternId, index: 1 }, {
    idFactory,
    now: () => '2026-10-05T14:02:00.000Z',
  });
  const targetOrderId = arranged.song.order[1].id;
  const sourceNoteId = arranged.song.patterns[0].notes[0].id;
  arranged = {
    ...arranged,
    song: {
      ...arranged.song,
      lyrics: [{
        id: 'lyrics-r3',
        label: 'Verse 2',
        rawText: 'la',
        syllables: [{
          id: 'syllable-r3',
          text: 'la',
          joinNext: false,
          phraseBreakAfter: true,
          anchors: [
            { orderEntryId: arranged.song.order[0].id, noteId: sourceNoteId },
            { orderEntryId: targetOrderId, noteId: sourceNoteId },
          ],
        }],
      }],
    },
  };

  const next = makeOrderEntryUnique(arranged, {
    orderEntryId: targetOrderId,
  }, {
    idFactory,
    now: () => '2026-10-05T14:03:00.000Z',
  });

  assert.equal(next.song.patterns.length, 2);
  assert.equal(next.song.order[0].patternId, patternId);
  assert.notEqual(next.song.order[1].patternId, patternId);
  assert.equal(patternUsageCount(next, patternId), 1);
  assert.equal(patternUsageCount(next, next.song.order[1].patternId), 1);

  const source = next.song.patterns.find((pattern) => pattern.id === patternId);
  const clone = next.song.patterns.find((pattern) => pattern.id === next.song.order[1].patternId);
  assert.ok(source);
  assert.ok(clone);
  assert.equal(clone.name, 'Pattern 01 (2)');
  assert.deepEqual(
    {
      lengthTicks: clone.lengthTicks,
      meter: clone.meter,
      rowTicks: clone.rowTicks,
    },
    {
      lengthTicks: source.lengthTicks,
      meter: source.meter,
      rowTicks: source.rowTicks,
    },
  );

  for (const key of ['notes', 'effects', 'chords', 'tempoEvents']) {
    assert.equal(clone[key].length, source[key].length);
    assert.notDeepEqual(
      clone[key].map((item) => item.id),
      source[key].map((item) => item.id),
      `${key} harus mendapat ID baru`,
    );
    assert.deepEqual(
      clone[key].map(({ id, ...item }) => item),
      source[key].map(({ id, ...item }) => item),
      `${key} selain ID harus tetap sama`,
    );
  }

  assert.deepEqual(
    arranged.song.patterns.find((pattern) => pattern.id === patternId),
    source,
    'Pattern sumber tidak dimutasi',
  );

  const anchors = next.song.lyrics[0].syllables[0].anchors;
  assert.deepEqual(anchors[0], {
    orderEntryId: arranged.song.order[0].id,
    noteId: sourceNoteId,
  });
  assert.deepEqual(anchors[1], {
    orderEntryId: targetOrderId,
    noteId: clone.notes[0].id,
  });
  assert.notEqual(anchors[1].noteId, sourceNoteId);
});

test('hasil reuse + Jadikan unik tetap round-trip lewat debug JSON', () => {
  const { project, idFactory, patternId } = fixture();
  let arranged = insertOrderEntry(project, { patternId, index: 1 }, {
    idFactory,
    now: () => '2026-10-05T14:02:00.000Z',
  });
  arranged = makeOrderEntryUnique(arranged, {
    orderEntryId: arranged.song.order[1].id,
  }, {
    idFactory,
    now: () => '2026-10-05T14:03:00.000Z',
  });

  const restored = parseDebugProject(serializeDebugProject(arranged));
  assert.deepEqual(restored, arranged);
});

test('makeOrderEntryUnique no-op bila Pattern memang hanya dipakai satu occurrence', () => {
  const { project } = fixture();
  const next = makeOrderEntryUnique(project, {
    orderEntryId: project.song.order[0].id,
  });
  assert.equal(next, project);
});

test('operasi Order menolak referensi dan index invalid dengan kode stabil', () => {
  const { project } = fixture();

  assert.throws(
    () => insertOrderEntry(project, { patternId: 'missing', index: 1 }),
    (error) => error.code === 'E_PROJECT_PATTERN_MISSING',
  );
  assert.throws(
    () => insertOrderEntry(project, { patternId: project.song.patterns[0].id, index: 2 }),
    (error) => error.code === 'E_PROJECT_ORDER_INDEX',
  );
  assert.throws(
    () => moveOrderEntry(project, { orderEntryId: 'missing', toIndex: 0 }),
    (error) => error.code === 'E_PROJECT_ORDER_MISSING',
  );
  assert.throws(
    () => moveOrderEntry(project, { orderEntryId: project.song.order[0].id, toIndex: 1 }),
    (error) => error.code === 'E_PROJECT_ORDER_INDEX',
  );
});
