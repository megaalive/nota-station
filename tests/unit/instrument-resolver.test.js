import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveSamplerVoice,
  voiceProfileKey,
} from '../../src/audio/instrument-resolver.js';
import { createBlankProject } from '../../src/core/project.js';
import { createSamplerInstrument } from '../../src/core/sound-model.js';

function fixture() {
  const project = createBlankProject({
    idFactory: (() => {
      let seq = 0;
      return (prefix) => `${prefix}-${++seq}`;
    })(),
    now: () => '2026-10-05T09:00:00.000Z',
  });

  const hash = `sha256:${'b'.repeat(64)}`;
  const sample = {
    id: 'sample-custom',
    name: 'Custom',
    sourceFilename: 'custom.wav',
    contentHash: hash,
    channels: 1,
    sampleRate: 1000,
    frameCount: 1000,
    rootNote: 60,
    fineTuneCents: 25,
    gain: 0.8,
    loop: {
      enabled: true,
      startFrame: 100,
      endFrame: 900,
      mode: 'forward',
    },
    storageRef: { kind: 'indexeddb', key: hash.slice(7) },
  };
  const instrument = createSamplerInstrument({
    id: 'instrument-custom',
    name: 'Custom',
    sampleId: sample.id,
    rootNote: 60,
    tuneCents: 50,
    zoneGain: 0.5,
    defaultPan: 0.35,
    ampEnvelope: {
      attackSeconds: 0.02,
      decaySeconds: 0.1,
      sustainLevel: 0.6,
      releaseSeconds: 0.3,
    },
  });

  return {
    ...project,
    samples: [...project.samples, sample],
    instruments: [...project.instruments, instrument],
  };
}

test('resolver memakai root/tune/gain/pan/ADSR/loop dari model', () => {
  const project = fixture();
  const voice = resolveSamplerVoice(project, {
    instrumentId: 'instrument-custom',
    pitch: 72,
  });

  assert.equal(voice.sampleId, 'sample-custom');
  assert.ok(Math.abs(voice.playbackRate - (2 ** (12.75 / 12))) < 1e-12);
  assert.equal(voice.gain, 0.4);
  assert.equal(voice.pan, 0.35);
  assert.deepEqual(voice.envelope, {
    attackSeconds: 0.02,
    decaySeconds: 0.1,
    sustainLevel: 0.6,
    releaseSeconds: 0.3,
  });
  assert.deepEqual(voice.loop, {
    enabled: true,
    startSeconds: 0.1,
    endSeconds: 0.9,
  });
  assert.equal(voiceProfileKey('instrument-custom', 72), 'instrument-custom\u000072');
});

test('resolver fail-closed untuk instrument/sample/zone yang hilang', () => {
  const project = fixture();

  assert.throws(
    () => resolveSamplerVoice(project, { instrumentId: 'missing', pitch: 60 }),
    (error) => error.code === 'E_AUDIO_INSTRUMENT_MISSING',
  );

  const noZone = {
    ...project,
    instruments: project.instruments.map((instrument) => (
      instrument.id === 'instrument-custom'
        ? { ...instrument, zones: [{ ...instrument.zones[0], keyLow: 0, keyHigh: 10 }] }
        : instrument
    )),
  };
  assert.throws(
    () => resolveSamplerVoice(noZone, { instrumentId: 'instrument-custom', pitch: 60 }),
    (error) => error.code === 'E_AUDIO_ZONE_MISSING',
  );

  const noSample = {
    ...project,
    samples: project.samples.filter((sample) => sample.id !== 'sample-custom'),
  };
  assert.throws(
    () => resolveSamplerVoice(noSample, { instrumentId: 'instrument-custom', pitch: 60 }),
    (error) => error.code === 'E_AUDIO_SAMPLE_MISSING',
  );
});
