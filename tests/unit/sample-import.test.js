import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPreparedWavImport } from '../../src/core/sample-import.js';
import { createBlankProject } from '../../src/core/project.js';
import {
  createSamplerInstrument,
  createFactoryBasicSample,
} from '../../src/core/sound-model.js';

function fixture() {
  let seq = 0;
  const project = createBlankProject({
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-05T08:30:00.000Z',
  });
  return { project, trackId: project.song.tracks[1].id };
}

function preparedSample({
  sampleId = 'sample-user-1',
  instrumentId = 'instrument-user-1',
  contentHash = `sha256:${'1'.repeat(64)}`,
} = {}) {
  const sample = {
    ...createFactoryBasicSample(),
    id: sampleId,
    name: 'User Bass',
    sourceFilename: 'User_Bass.wav',
    contentHash,
    storageRef: { kind: 'indexeddb', key: contentHash.slice(7) },
  };
  const instrument = createSamplerInstrument({
    id: instrumentId,
    name: 'User Bass',
    sampleId,
    rootNote: 48,
  });
  return { contentHash, sample, instrument };
}

test('applyPreparedWavImport menambah Sample+Instrument dan memasang ke track secara immutable', () => {
  const { project, trackId } = fixture();
  const before = JSON.stringify(project);
  const prepared = preparedSample();

  const result = applyPreparedWavImport(project, prepared, { trackId });

  assert.equal(JSON.stringify(project), before);
  assert.notEqual(result.project, project);
  assert.equal(result.sampleAdded, true);
  assert.equal(result.project.samples.at(-1).id, prepared.sample.id);
  assert.equal(result.project.instruments.at(-1).id, prepared.instrument.id);
  assert.equal(
    result.project.song.tracks.find((track) => track.id === trackId).defaultInstrumentId,
    prepared.instrument.id,
  );
  assert.equal(
    result.previousInstrumentId,
    project.song.tracks.find((track) => track.id === trackId).defaultInstrumentId,
  );
});

test('commit candidate stale tetap dedup berdasarkan contentHash dan remap zone', () => {
  const { project, trackId } = fixture();
  const contentHash = `sha256:${'2'.repeat(64)}`;
  const existing = {
    ...createFactoryBasicSample(),
    id: 'sample-existing',
    name: 'Existing',
    sourceFilename: 'existing.wav',
    contentHash,
    storageRef: { kind: 'indexeddb', key: contentHash.slice(7) },
  };
  const withExisting = { ...project, samples: [...project.samples, existing] };
  const prepared = preparedSample({
    sampleId: 'sample-stale-new-id',
    instrumentId: 'instrument-stale',
    contentHash,
  });

  const result = applyPreparedWavImport(withExisting, prepared, { trackId });

  assert.equal(result.sampleAdded, false);
  assert.equal(result.sampleId, existing.id);
  assert.equal(result.project.samples.length, withExisting.samples.length);
  assert.equal(result.project.instruments.at(-1).zones[0].sampleId, existing.id);
});

test('track/instrument collision gagal tanpa mengubah Project', () => {
  const { project, trackId } = fixture();
  const before = JSON.stringify(project);

  assert.throws(
    () => applyPreparedWavImport(project, preparedSample(), { trackId: 'missing' }),
    (error) => error.code === 'E_IMPORT_TRACK',
  );

  const collision = preparedSample({
    instrumentId: project.instruments[0].id,
  });
  assert.throws(
    () => applyPreparedWavImport(project, collision, { trackId }),
    (error) => error.code === 'E_IMPORT_INSTRUMENT_ID',
  );

  assert.equal(JSON.stringify(project), before);
});
