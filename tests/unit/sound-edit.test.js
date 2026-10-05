import test from 'node:test';
import assert from 'node:assert/strict';

import { createBlankProject } from '../../src/core/project.js';
import { updateSingleSampleInstrument } from '../../src/core/sound-edit.js';

function fixture() {
  let seq = 0;
  return createBlankProject({
    idFactory: (prefix) => `${prefix}-${++seq}`,
    now: () => '2026-10-05T10:10:00.000Z',
  });
}

test('single-sample edit mengubah zone/pan/ADSR/loop secara immutable', () => {
  const project = fixture();
  const instrument = project.instruments[0];
  const sample = project.samples[0];

  const next = updateSingleSampleInstrument(project, {
    instrumentId: instrument.id,
    rootNote: 48,
    tuneCents: -25,
    zoneGain: 0.72,
    defaultPan: 0.35,
    ampEnvelope: {
      attackSeconds: 0.02,
      decaySeconds: 0.15,
      sustainLevel: 0.64,
      releaseSeconds: 0.4,
    },
    loop: {
      enabled: true,
      startFrame: 100,
      endFrame: 1200,
      mode: 'forward',
    },
  });

  assert.notEqual(next, project);
  assert.equal(project.instruments[0].zones[0].rootNote, 60);
  assert.equal(next.instruments[0].zones[0].rootNote, 48);
  assert.equal(next.instruments[0].zones[0].tuneCents, -25);
  assert.equal(next.instruments[0].zones[0].gain, 0.72);
  assert.equal(next.instruments[0].defaultPan, 0.35);
  assert.equal(next.instruments[0].ampEnvelope.releaseSeconds, 0.4);
  assert.equal(next.samples[0].loop.enabled, true);
  assert.equal(next.samples[0].loop.startFrame, 100);
  assert.equal(next.samples[0].loop.endFrame, 1200);
  assert.equal(sample.loop.enabled, false);
});

test('sound edit menolak nilai di luar kontrak dan multizone', () => {
  const project = fixture();
  const instrument = project.instruments[0];

  assert.throws(
    () => updateSingleSampleInstrument(project, {
      instrumentId: instrument.id,
      defaultPan: 2,
    }),
    (error) => error.code === 'E_SOUND_RANGE',
  );

  const multi = {
    ...project,
    instruments: project.instruments.map((item) => (
      item.id === instrument.id
        ? { ...item, zones: [...item.zones, { ...item.zones[0], keyLow: 64 }] }
        : item
    )),
  };
  assert.throws(
    () => updateSingleSampleInstrument(multi, {
      instrumentId: instrument.id,
      defaultPan: 0,
    }),
    (error) => error.code === 'E_SOUND_EDIT_MULTIZONE',
  );
});
