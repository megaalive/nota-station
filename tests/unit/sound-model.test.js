import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_AMP_ENVELOPE,
  createFactoryBasicInstrument,
  createFactoryBasicSample,
  createSamplerInstrument,
  normalizeLegacySoundModel,
  validateInstrumentModel,
  validateSampleModel,
} from '../../src/core/sound-model.js';

test('factory sample memakai metadata WAV nyata dan content hash stabil', () => {
  const sample = createFactoryBasicSample();
  assert.deepEqual(
    {
      channels: sample.channels,
      sampleRate: sample.sampleRate,
      frameCount: sample.frameCount,
      rootNote: sample.rootNote,
      fineTuneCents: sample.fineTuneCents,
      gain: sample.gain,
      storageRef: sample.storageRef,
    },
    {
      channels: 1,
      sampleRate: 11025,
      frameCount: 1543,
      rootNote: 60,
      fineTuneCents: 0,
      gain: 1,
      storageRef: { kind: 'factory', key: 'basic' },
    },
  );
  assert.match(sample.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(validateSampleModel(sample), sample);
});

test('factory instrument menyimpan default pan/envelope dan zone sampler di data', () => {
  const sample = createFactoryBasicSample();
  const instrument = createFactoryBasicInstrument();

  assert.equal(instrument.type, 'sampler');
  assert.equal(instrument.defaultPan, 0);
  assert.deepEqual(instrument.ampEnvelope, DEFAULT_AMP_ENVELOPE);
  assert.deepEqual(instrument.zones, [{
    sampleId: sample.id,
    keyLow: 0,
    keyHigh: 127,
    rootNote: 60,
    tuneCents: 0,
    gain: 1,
  }]);
  assert.equal(validateInstrumentModel(instrument, new Set([sample.id])), instrument);
});

test('sampler model menolak sample reference, pan, dan loop invalid', () => {
  const instrument = createSamplerInstrument({
    id: 'inst-1',
    name: 'Inst',
    sampleId: 'sample-hilang',
  });
  assert.throws(
    () => validateInstrumentModel(instrument, new Set(['sample-ok'])),
    (error) => error.code === 'E_SOUND_SAMPLE_REF',
  );

  instrument.defaultPan = 2;
  assert.throws(
    () => validateInstrumentModel(instrument, new Set(['sample-hilang'])),
    (error) => error.code === 'E_SOUND_RANGE',
  );

  const sample = createFactoryBasicSample();
  sample.loop = { ...sample.loop, enabled: true, startFrame: 20, endFrame: 20 };
  assert.throws(
    () => validateSampleModel(sample),
    (error) => error.code === 'E_SOUND_SAMPLE_LOOP',
  );
});

test('normalisasi legacy R1 hanya mengubah sound model lama ke kontrak R2', () => {
  const legacy = {
    id: 'p',
    samples: [{ id: 'factory.basic', factoryKey: 'basic', license: 'CC0-1.0' }],
    instruments: [{ id: 'legacy.lead', name: 'Lead', sampleId: 'factory.basic', rootPitch: 69 }],
  };
  const normalized = normalizeLegacySoundModel(legacy);

  assert.notEqual(normalized, legacy);
  assert.equal(normalized.samples[0].contentHash.startsWith('sha256:'), true);
  assert.equal(normalized.instruments[0].type, 'sampler');
  assert.equal(normalized.instruments[0].zones[0].rootNote, 69);
  assert.equal(normalized.instruments[0].defaultPan, 0);
});
