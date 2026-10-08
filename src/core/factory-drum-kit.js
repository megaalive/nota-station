import { createDrumKitInstrument } from './sound-model.js';

export const FACTORY_DRUM_KIT_INSTRUMENT_ID = 'factory.drum-kit';

const SAMPLE_DEFS = Object.freeze([
  {
    id: 'factory.drum.kick',
    name: 'Kick',
    sourceFilename: 'factory-drum-kick.wav',
    contentHash: 'sha256:8195b130d6058bb6f9cc32c920ef411831eb799b935124b25efe1280009f5f7a',
    frameCount: 7938,
    rootNote: 36,
    gain: 1.0,
    storageKey: 'drum.kick',
  },
  {
    id: 'factory.drum.snare',
    name: 'Snare',
    sourceFilename: 'factory-drum-snare.wav',
    contentHash: 'sha256:30da25d85145c3dcd5817230d29e4b34776150096de7477b2ad009bf4888cedc',
    frameCount: 6174,
    rootNote: 38,
    gain: 0.82,
    storageKey: 'drum.snare',
  },
  {
    id: 'factory.drum.hat.closed',
    name: 'Closed Hi-Hat',
    sourceFilename: 'factory-drum-hat-closed.wav',
    contentHash: 'sha256:214318295184516f457576b722cf8039540ade1849a829783fd21edb78e2047c',
    frameCount: 2205,
    rootNote: 42,
    gain: 0.58,
    storageKey: 'drum.hat.closed',
  },
  {
    id: 'factory.drum.hat.open',
    name: 'Open Hi-Hat',
    sourceFilename: 'factory-drum-hat-open.wav',
    contentHash: 'sha256:7b33136e3dee2e66ed0a3f62966d351109c5de1ab7fbe29c215a1ce861cde080',
    frameCount: 11466,
    rootNote: 46,
    gain: 0.52,
    storageKey: 'drum.hat.open',
  },
]);

export function createFactoryDrumSamples() {
  return SAMPLE_DEFS.map((item) => ({
    id: item.id,
    name: item.name,
    sourceFilename: item.sourceFilename,
    contentHash: item.contentHash,
    channels: 1,
    sampleRate: 22050,
    frameCount: item.frameCount,
    rootNote: item.rootNote,
    fineTuneCents: 0,
    gain: item.gain,
    loop: {
      enabled: false,
      startFrame: 0,
      endFrame: item.frameCount,
      mode: 'forward',
    },
    storageRef: {
      kind: 'factory',
      key: item.storageKey,
    },
    license: 'CC0-1.0',
  }));
}

export function createFactoryDrumKitInstrument() {
  return createDrumKitInstrument({
    id: FACTORY_DRUM_KIT_INSTRUMENT_ID,
    name: 'Factory Drum Kit',
    zones: [
      { note: 36, sampleId: 'factory.drum.kick' },
      { note: 38, sampleId: 'factory.drum.snare' },
      { note: 42, sampleId: 'factory.drum.hat.closed', chokeGroup: 'hihat' },
      { note: 46, sampleId: 'factory.drum.hat.open', chokeGroup: 'hihat' },
    ],
    ampEnvelope: {
      attackSeconds: 0,
      decaySeconds: 0,
      sustainLevel: 1,
      releaseSeconds: 0.35,
    },
    defaultPan: 0,
  });
}
