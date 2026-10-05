// Model Sample/Instrument R2 (§6). Semua nilai default berada di data,
// bukan di UI/fixture, supaya import, picker, sampler, dan export berbagi kontrak.

export const FACTORY_BASIC_SAMPLE_ID = 'factory.basic';
export const FACTORY_BASIC_INSTRUMENT_ID = 'factory.basic';

export const DEFAULT_AMP_ENVELOPE = Object.freeze({
  attackSeconds: 0.005,
  decaySeconds: 0.08,
  sustainLevel: 0.88,
  releaseSeconds: 0.12,
});

export function createFactoryBasicSample() {
  return {
    id: FACTORY_BASIC_SAMPLE_ID,
    name: 'Basic',
    sourceFilename: 'factory-basic.wav',
    contentHash: 'sha256:1239a6983b871bda0ff4863346b1770f99ec30dc2685962e0c19c90a1f489557',
    channels: 1,
    sampleRate: 11025,
    frameCount: 1543,
    rootNote: 60,
    fineTuneCents: 0,
    gain: 1,
    loop: {
      enabled: false,
      startFrame: 0,
      endFrame: 1543,
      mode: 'forward',
    },
    storageRef: {
      kind: 'factory',
      key: 'basic',
    },
    license: 'CC0-1.0',
  };
}

export function createFactoryBasicInstrument() {
  return createSamplerInstrument({
    id: FACTORY_BASIC_INSTRUMENT_ID,
    name: 'Basic',
    sampleId: FACTORY_BASIC_SAMPLE_ID,
    rootNote: 60,
  });
}

export function createSamplerInstrument({
  id,
  name,
  sampleId,
  rootNote = 60,
  keyLow = 0,
  keyHigh = 127,
  tuneCents = 0,
  zoneGain = 1,
  ampEnvelope = DEFAULT_AMP_ENVELOPE,
  defaultPan = 0,
  chokeGroup = null,
}) {
  return {
    id,
    name,
    type: 'sampler',
    zones: [{
      sampleId,
      keyLow,
      keyHigh,
      rootNote,
      tuneCents,
      gain: zoneGain,
    }],
    ampEnvelope: { ...ampEnvelope },
    defaultPan,
    chokeGroup,
  };
}

export function createDrumKitInstrument({
  id,
  name,
  zones,
  ampEnvelope = DEFAULT_AMP_ENVELOPE,
  defaultPan = 0,
}) {
  if (!Array.isArray(zones) || zones.length === 0) {
    throw soundError('E_SOUND_ZONES', 'Drum kit harus memiliki minimal satu zone.');
  }

  return {
    id,
    name,
    type: 'sampler',
    drumKit: true,
    zones: zones.map((zone) => {
      const note = zone.note;
      return {
        sampleId: zone.sampleId,
        keyLow: note,
        keyHigh: note,
        rootNote: zone.rootNote ?? note,
        tuneCents: zone.tuneCents ?? 0,
        gain: zone.gain ?? 1,
        chokeGroup: zone.chokeGroup ?? null,
      };
    }),
    ampEnvelope: { ...ampEnvelope },
    defaultPan,
    chokeGroup: null,
  };
}

export function normalizeLegacySoundModel(project) {
  if (!project || typeof project !== 'object') return project;

  let changed = false;
  const samples = Array.isArray(project.samples)
    ? project.samples.map((sample) => {
        if (isCanonicalSample(sample)) return sample;
        if (sample?.id === FACTORY_BASIC_SAMPLE_ID && sample?.factoryKey === 'basic') {
          changed = true;
          return createFactoryBasicSample();
        }
        return sample;
      })
    : project.samples;

  const instruments = Array.isArray(project.instruments)
    ? project.instruments.map((instrument) => {
        if (isCanonicalInstrument(instrument)) return instrument;
        if (
          instrument
          && typeof instrument.id === 'string'
          && typeof instrument.name === 'string'
          && typeof instrument.sampleId === 'string'
        ) {
          changed = true;
          return createSamplerInstrument({
            id: instrument.id,
            name: instrument.name,
            sampleId: instrument.sampleId,
            rootNote: Number.isInteger(instrument.rootPitch) ? instrument.rootPitch : 60,
          });
        }
        return instrument;
      })
    : project.instruments;

  return changed ? { ...project, samples, instruments } : project;
}

export function validateSampleModel(sample) {
  requireObject(sample, 'sample');
  requireString(sample.id, 'sample.id');
  requireString(sample.name, 'sample.name');
  requireString(sample.sourceFilename, 'sample.sourceFilename');
  if (!/^sha256:[0-9a-f]{64}$/u.test(sample.contentHash)) {
    throw soundError('E_SOUND_SAMPLE_HASH', 'contentHash sample harus sha256:<64 hex>.');
  }
  requireIntegerRange(sample.channels, 1, 2, 'sample.channels');
  requireIntegerRange(sample.sampleRate, 4000, 384000, 'sample.sampleRate');
  requireIntegerRange(sample.frameCount, 1, Number.MAX_SAFE_INTEGER, 'sample.frameCount');
  requireIntegerRange(sample.rootNote, 0, 127, 'sample.rootNote');
  requireFiniteRange(sample.fineTuneCents, -1200, 1200, 'sample.fineTuneCents');
  requireFiniteRange(sample.gain, 0, 4, 'sample.gain');

  requireObject(sample.loop, 'sample.loop');
  if (typeof sample.loop.enabled !== 'boolean') {
    throw soundError('E_SOUND_SAMPLE_LOOP', 'sample.loop.enabled harus boolean.');
  }
  requireIntegerRange(sample.loop.startFrame, 0, sample.frameCount, 'sample.loop.startFrame');
  requireIntegerRange(sample.loop.endFrame, 0, sample.frameCount, 'sample.loop.endFrame');
  if (sample.loop.endFrame < sample.loop.startFrame) {
    throw soundError('E_SOUND_SAMPLE_LOOP', 'endFrame loop tidak boleh sebelum startFrame.');
  }
  if (sample.loop.enabled && sample.loop.endFrame <= sample.loop.startFrame) {
    throw soundError('E_SOUND_SAMPLE_LOOP', 'Loop aktif harus punya rentang frame non-kosong.');
  }
  if (!['forward', 'pingpong'].includes(sample.loop.mode)) {
    throw soundError('E_SOUND_SAMPLE_LOOP', 'Mode loop sample tidak didukung.');
  }

  requireObject(sample.storageRef, 'sample.storageRef');
  if (!['factory', 'indexeddb'].includes(sample.storageRef.kind)) {
    throw soundError('E_SOUND_STORAGE_REF', 'storageRef.kind sample tidak didukung.');
  }
  requireString(sample.storageRef.key, 'sample.storageRef.key');
  return sample;
}

export function validateInstrumentModel(instrument, sampleIds) {
  requireObject(instrument, 'instrument');
  requireString(instrument.id, 'instrument.id');
  requireString(instrument.name, 'instrument.name');
  if (instrument.type !== 'sampler') {
    throw soundError('E_SOUND_INSTRUMENT_TYPE', 'Instrument R2 harus type=sampler.');
  }
  if (
    Object.hasOwn(instrument, 'drumKit')
    && typeof instrument.drumKit !== 'boolean'
  ) {
    throw soundError('E_SOUND_DRUM_KIT', 'instrument.drumKit harus boolean.');
  }
  if (!Array.isArray(instrument.zones) || instrument.zones.length < 1 || instrument.zones.length > 128) {
    throw soundError('E_SOUND_ZONES', 'Instrument harus punya 1..128 zone.');
  }

  for (const zone of instrument.zones) {
    requireObject(zone, 'instrument.zone');
    requireString(zone.sampleId, 'instrument.zone.sampleId');
    if (sampleIds && !sampleIds.has(zone.sampleId)) {
      throw soundError('E_SOUND_SAMPLE_REF', `Sample zone tidak ditemukan: ${zone.sampleId}`);
    }
    requireIntegerRange(zone.keyLow, 0, 127, 'instrument.zone.keyLow');
    requireIntegerRange(zone.keyHigh, 0, 127, 'instrument.zone.keyHigh');
    if (zone.keyHigh < zone.keyLow) {
      throw soundError('E_SOUND_ZONE_RANGE', 'keyHigh zone tidak boleh di bawah keyLow.');
    }
    requireIntegerRange(zone.rootNote, 0, 127, 'instrument.zone.rootNote');
    requireFiniteRange(zone.tuneCents, -1200, 1200, 'instrument.zone.tuneCents');
    requireFiniteRange(zone.gain, 0, 4, 'instrument.zone.gain');
    if (
      Object.hasOwn(zone, 'chokeGroup')
      && zone.chokeGroup !== null
      && typeof zone.chokeGroup !== 'string'
    ) {
      throw soundError('E_SOUND_CHOKE_GROUP', 'zone.chokeGroup harus null atau string.');
    }
  }

  if (instrument.drumKit === true) {
    if (instrument.zones.length < 2) {
      throw soundError('E_SOUND_DRUM_KIT', 'Drum Kit harus memiliki minimal dua zone.');
    }
    const notes = new Set();
    for (const zone of instrument.zones) {
      if (zone.keyLow !== zone.keyHigh) {
        throw soundError('E_SOUND_DRUM_KIT', 'Zone Drum Kit harus memetakan tepat satu note.');
      }
      if (notes.has(zone.keyLow)) {
        throw soundError('E_SOUND_DRUM_KIT', `Note Drum Kit duplikat: ${zone.keyLow}`);
      }
      notes.add(zone.keyLow);
    }
  }

  requireObject(instrument.ampEnvelope, 'instrument.ampEnvelope');
  requireFiniteRange(instrument.ampEnvelope.attackSeconds, 0, 60, 'ampEnvelope.attackSeconds');
  requireFiniteRange(instrument.ampEnvelope.decaySeconds, 0, 60, 'ampEnvelope.decaySeconds');
  requireFiniteRange(instrument.ampEnvelope.sustainLevel, 0, 1, 'ampEnvelope.sustainLevel');
  requireFiniteRange(instrument.ampEnvelope.releaseSeconds, 0, 60, 'ampEnvelope.releaseSeconds');
  requireFiniteRange(instrument.defaultPan, -1, 1, 'instrument.defaultPan');
  if (instrument.chokeGroup !== null && typeof instrument.chokeGroup !== 'string') {
    throw soundError('E_SOUND_CHOKE_GROUP', 'chokeGroup harus null atau string.');
  }
  return instrument;
}

export function isDrumKitInstrument(instrument) {
  return instrument?.type === 'sampler'
    && instrument.drumKit === true
    && Array.isArray(instrument.zones);
}

function isCanonicalSample(sample) {
  return sample && typeof sample.contentHash === 'string' && sample.loop && sample.storageRef;
}

function isCanonicalInstrument(instrument) {
  return instrument && instrument.type === 'sampler' && Array.isArray(instrument.zones);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw soundError('E_SOUND_SHAPE', `${label} harus object.`);
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw soundError('E_SOUND_SHAPE', `${label} harus string non-kosong.`);
  }
}

function requireIntegerRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw soundError('E_SOUND_RANGE', `${label} di luar rentang ${min}..${max}.`);
  }
}

function requireFiniteRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw soundError('E_SOUND_RANGE', `${label} di luar rentang ${min}..${max}.`);
  }
}

function soundError(code, message) {
  const error = new Error(message);
  error.name = 'SoundModelError';
  error.code = code;
  return error;
}
