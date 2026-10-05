import test from 'node:test';
import assert from 'node:assert/strict';

import { insertOrderEntry, makeOrderEntryUnique } from '../../src/core/arrangement.js';
import { createFocusStore, patternForFocus } from '../../src/core/focus.js';
import { createBlankProject } from '../../src/core/project.js';

function ids() {
  let seq = 0;
  return (prefix) => `${prefix}-focus-${++seq}`;
}

function fixture() {
  const idFactory = ids();
  let project = createBlankProject({
    idFactory,
    now: () => '2026-10-05T15:00:00.000Z',
  });
  const patternId = project.song.patterns[0].id;
  project = insertOrderEntry(project, { patternId, index: 1 }, {
    idFactory,
    now: () => '2026-10-05T15:01:00.000Z',
  });
  project = makeOrderEntryUnique(project, {
    orderEntryId: project.song.order[1].id,
  }, {
    idFactory,
    now: () => '2026-10-05T15:02:00.000Z',
  });
  return project;
}

test('Focus Store fallback ke occurrence pertama dan memilih occurrence tanpa memutasi Project', () => {
  const project = fixture();
  const before = structuredClone(project);
  const focus = createFocusStore();

  assert.deepEqual(focus.reconcile(project), {
    orderEntryId: project.song.order[0].id,
  });

  const selected = focus.setOrderEntry(project, project.song.order[1].id);
  assert.deepEqual(selected, { orderEntryId: project.song.order[1].id });
  assert.deepEqual(project, before);
});

test('patternForFocus mengikuti Pattern milik occurrence yang dipilih', () => {
  const project = fixture();
  const focus = createFocusStore({ orderEntryId: project.song.order[1].id });
  focus.reconcile(project);

  const pattern = patternForFocus(project, focus.getState());
  assert.equal(pattern.id, project.song.order[1].patternId);
  assert.notEqual(pattern.id, project.song.order[0].patternId);
});

test('reconcile memulihkan fallback bila occurrence fokus hilang setelah Undo/project replace', () => {
  const project = fixture();
  const focus = createFocusStore({ orderEntryId: project.song.order[1].id });
  focus.reconcile(project);

  const reduced = {
    ...project,
    song: {
      ...project.song,
      order: [project.song.order[0]],
    },
  };

  assert.deepEqual(focus.reconcile(reduced), {
    orderEntryId: reduced.song.order[0].id,
  });
});

test('setOrderEntry menolak occurrence yang tidak ada dengan kode stabil', () => {
  const project = fixture();
  const focus = createFocusStore();

  assert.throws(
    () => focus.setOrderEntry(project, 'missing'),
    (error) => error.code === 'E_FOCUS_ORDER_MISSING',
  );
});
