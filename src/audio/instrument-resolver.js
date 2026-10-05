// Resolver Instrument/Zone R2 untuk jalur sampler.
// Memilih zone deterministik sesuai urutan array; UI multisample kompleks belum masuk R2.

export function resolveSamplerVoice(project, { instrumentId, pitch }) {
  if (!project || typeof project !== 'object') {
    throw resolverError('E_AUDIO_PROJECT', 'Project audio tidak valid.');
  }
  if (typeof instrumentId !== 'string' || instrumentId.length === 0) {
    throw resolverError('E_AUDIO_INSTRUMENT', 'instrumentId note tidak valid.');
  }
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) {
    throw resolverError('E_AUDIO_PITCH', `Pitch MIDI tidak valid: ${pitch}`);
  }

  const instrument = project.instruments?.find((item) => item.id === instrumentId);
  if (!instrument) {
    throw resolverError('E_AUDIO_INSTRUMENT_MISSING', `Instrument tidak ditemukan: ${instrumentId}`);
  }
  if (instrument.type !== 'sampler' || !Array.isArray(instrument.zones)) {
    throw resolverError('E_AUDIO_INSTRUMENT_TYPE', `Instrument bukan sampler: ${instrumentId}`);
  }

  const zone = instrument.zones.find(
    (item) => pitch >= item.keyLow && pitch <= item.keyHigh,
  );
  if (!zone) {
    throw resolverError(
      'E_AUDIO_ZONE_MISSING',
      `Tidak ada zone ${instrumentId} untuk pitch ${pitch}.`,
    );
  }

  const sample = project.samples?.find((item) => item.id === zone.sampleId);
  if (!sample) {
    throw resolverError('E_AUDIO_SAMPLE_MISSING', `Sample tidak ditemukan: ${zone.sampleId}`);
  }

  const cents = Number(zone.tuneCents ?? 0) + Number(sample.fineTuneCents ?? 0);
  const semitones = pitch - zone.rootNote + cents / 100;
  const playbackRate = 2 ** (semitones / 12);
  const gain = Number(sample.gain ?? 1) * Number(zone.gain ?? 1);
  const pan = Number(instrument.defaultPan ?? 0);
  const chokeGroup = zone.chokeGroup ?? instrument.chokeGroup ?? null;
  const envelope = instrument.ampEnvelope ?? {
    attackSeconds: 0,
    decaySeconds: 0,
    sustainLevel: 1,
    releaseSeconds: 0,
  };

  const loop = sample.loop?.enabled
    ? {
        enabled: true,
        startSeconds: sample.loop.startFrame / sample.sampleRate,
        endSeconds: sample.loop.endFrame / sample.sampleRate,
      }
    : { enabled: false, startSeconds: 0, endSeconds: 0 };

  return Object.freeze({
    instrumentId,
    sampleId: sample.id,
    sample,
    zone,
    playbackRate,
    gain,
    pan,
    chokeGroup,
    envelope: Object.freeze({ ...envelope }),
    loop: Object.freeze(loop),
  });
}

export function voiceProfileKey(instrumentId, pitch) {
  return `${instrumentId}\u0000${pitch}`;
}

function resolverError(code, message) {
  const error = new Error(message);
  error.name = 'InstrumentResolverError';
  error.code = code;
  return error;
}
