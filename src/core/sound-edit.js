import {
  validateInstrumentModel,
  validateSampleModel,
} from './sound-model.js';

export function updateSingleSampleInstrument(
  project,
  {
    instrumentId,
    rootNote,
    tuneCents,
    zoneGain,
    defaultPan,
    ampEnvelope,
    loop,
  },
) {
  if (!project || typeof project !== 'object') {
    throw editError('E_SOUND_EDIT_PROJECT', 'Project tidak valid.');
  }

  const instrument = project.instruments?.find((item) => item.id === instrumentId);
  if (!instrument) {
    throw editError('E_SOUND_EDIT_INSTRUMENT', `Instrument tidak ditemukan: ${instrumentId}`);
  }
  if (instrument.type !== 'sampler' || instrument.zones?.length !== 1) {
    throw editError(
      'E_SOUND_EDIT_MULTIZONE',
      'Editor R2-S7 hanya mengubah instrument sampler single-zone.',
    );
  }

  const zone = instrument.zones[0];
  const sample = project.samples?.find((item) => item.id === zone.sampleId);
  if (!sample) {
    throw editError('E_SOUND_EDIT_SAMPLE', `Sample tidak ditemukan: ${zone.sampleId}`);
  }

  const nextZone = {
    ...zone,
    rootNote: rootNote ?? zone.rootNote,
    tuneCents: tuneCents ?? zone.tuneCents,
    gain: zoneGain ?? zone.gain,
  };

  const nextEnvelope = {
    ...instrument.ampEnvelope,
    ...(ampEnvelope ?? {}),
  };

  const nextInstrument = {
    ...instrument,
    zones: [nextZone],
    defaultPan: defaultPan ?? instrument.defaultPan,
    ampEnvelope: nextEnvelope,
  };

  const nextSample = loop
    ? {
        ...sample,
        loop: {
          ...sample.loop,
          ...loop,
        },
      }
    : sample;

  try {
    validateSampleModel(nextSample);
    const sampleIds = new Set(project.samples.map((item) => item.id));
    validateInstrumentModel(nextInstrument, sampleIds);
  } catch (error) {
    throw editError(error.code ?? 'E_SOUND_EDIT_VALUE', error.message);
  }

  const nextSamples = nextSample === sample
    ? project.samples
    : project.samples.map((item) => (item.id === sample.id ? nextSample : item));
  const nextInstruments = project.instruments.map((item) => (
    item.id === instrument.id ? nextInstrument : item
  ));

  return {
    ...project,
    samples: nextSamples,
    instruments: nextInstruments,
  };
}

function editError(code, message) {
  const error = new Error(message);
  error.name = 'SoundEditError';
  error.code = code;
  return error;
}
