import test from 'node:test';
import assert from 'node:assert/strict';

import { insertOrderEntry } from '../../src/core/arrangement.js';
import { createBlankProject } from '../../src/core/project.js';
import { createSharedPatternGuard } from '../../src/core/shared-pattern-guard.js';

function ids() {
  let seq = 0;
  return (prefix) => `${prefix}-guard-${++seq}`;
}

function sharedFixture() {
  const idFactory = ids();
  let project = createBlankProject({ idFactory });
  const patternId = project.song.patterns[0].id;
  project = insertOrderEntry(project, {
    patternId,
    index: 1,
  }, { idFactory });
  return { project, patternId };
}

test('shared guard meminta keputusan hanya untuk Pattern yang dipakai >1 tempat', () => {
  const { project, patternId } = sharedFixture();
  const guard = createSharedPatternGuard();

  assert.deepEqual(guard.inspect(project, patternId), {
    required: true,
    patternId,
    patternName: 'Pattern 01',
    usage: 2,
  });

  const uniqueProject = {
    ...project,
    song: {
      ...project.song,
      order: [project.song.order[0]],
    },
  };
  assert.equal(guard.inspect(uniqueProject, patternId).required, false);
});

test('allowEditAll diingat pada store tanpa memutasi Project', () => {
  const { project, patternId } = sharedFixture();
  const before = structuredClone(project);
  const guard = createSharedPatternGuard();

  guard.allowEditAll(patternId);
  assert.equal(guard.inspect(project, patternId).required, false);
  assert.deepEqual(guard.getState(), { allowedPatternIds: [patternId] });
  assert.deepEqual(project, before);
});

test('reconcile membuang keputusan untuk Pattern yang sudah tidak ada', () => {
  const { project, patternId } = sharedFixture();
  const guard = createSharedPatternGuard({ allowedPatternIds: [patternId, 'missing'] });

  assert.deepEqual(guard.reconcile(project), {
    allowedPatternIds: [patternId],
  });
});

test('allowEditAll menolak Pattern ID kosong', () => {
  const guard = createSharedPatternGuard();
  assert.throws(
    () => guard.allowEditAll(''),
    (error) => error.code === 'E_SHARED_PATTERN_ID',
  );
});
