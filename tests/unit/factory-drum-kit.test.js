import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { FACTORY_DRUM_WAV_BASE64 } from '../../src/audio/factory-drum-samples.js';
import { createProjectSampleBytesLoader } from '../../src/audio/sample-buffer-cache.js';
import {
  createFactoryDrumKitInstrument,
  createFactoryDrumSamples,
} from '../../src/core/factory-drum-kit.js';
import {
  isDrumKitInstrument,
  validateInstrumentModel,
  validateSampleModel,
} from '../../src/core/sound-model.js';
import { parseWav } from '../../src/io/wav-import.js';

test('factory Drum Kit bytes cocok dengan metadata/hash dan WAV valid', async () => {
  const samples = createFactoryDrumSamples();
  const kit = createFactoryDrumKitInstrument();
  const ids = new Set(samples.map((sample) => sample.id));

  assert.equal(samples.length, 4);
  assert.equal(isDrumKitInstrument(kit), true);
  validateInstrumentModel(kit, ids);

  for (const sample of samples) {
    validateSampleModel(sample);
    const encoded = FACTORY_DRUM_WAV_BASE64[sample.storageRef.key];
    assert.equal(typeof encoded, 'string');

    const bytes = Buffer.from(encoded, 'base64');
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(sample.contentHash, `sha256:${hash}`);

    const wav = parseWav(bytes);
    assert.equal(wav.channels, sample.channels);
    assert.equal(wav.sampleRate, sample.sampleRate);
    assert.equal(wav.frameCount, sample.frameCount);
  }
});

test('factory Drum Kit loader membaca pack lazy melalui storageRef factory', async () => {
  const samples = createFactoryDrumSamples();
  const loader = createProjectSampleBytesLoader();

  for (const sample of samples) {
    const bytes = await loader(sample);
    assert.ok(bytes instanceof ArrayBuffer);
    assert.ok(bytes.byteLength > 44);
  }

  const again = await loader(samples[0]);
  assert.equal(again.byteLength, Buffer.from(
    FACTORY_DRUM_WAV_BASE64[samples[0].storageRef.key],
    'base64',
  ).byteLength);
});
