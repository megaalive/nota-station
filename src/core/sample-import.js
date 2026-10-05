// Commit Project setelah WAV bytes sudah berhasil dipersist.
// Fungsi ini murni: tidak menyentuh IndexedDB dan tidak memutasi Project input.

import {
  validateInstrumentModel,
  validateSampleModel,
} from './sound-model.js';

export function applyPreparedWavImport(
  project,
  prepared,
  { trackId },
) {
  validateProjectShell(project);
  if (!prepared?.sample || !prepared?.instrument || typeof prepared.contentHash !== 'string') {
    throw importError('E_IMPORT_PREPARED', 'Candidate import WAV tidak valid.');
  }

  const selectedTrack = project.song.tracks.find((track) => track.id === trackId);
  if (!selectedTrack) {
    throw importError('E_IMPORT_TRACK', `Track tujuan tidak ditemukan: ${trackId}`);
  }

  const candidateSample = prepared.sample;
  if (candidateSample.contentHash !== prepared.contentHash) {
    throw importError('E_IMPORT_HASH', 'contentHash candidate tidak cocok dengan Sample.');
  }

  const existingByHash = project.samples.find(
    (sample) => sample.contentHash === candidateSample.contentHash,
  ) ?? null;
  const resolvedSample = existingByHash ?? candidateSample;

  if (!existingByHash) {
    try {
      validateSampleModel(candidateSample);
    } catch (error) {
      throw importError('E_IMPORT_SAMPLE', error.message);
    }
  }

  if (project.instruments.some((item) => item.id === prepared.instrument.id)) {
    throw importError(
      'E_IMPORT_INSTRUMENT_ID',
      `ID instrument sudah dipakai: ${prepared.instrument.id}`,
    );
  }

  const resolvedInstrument = remapInstrumentSample(
    prepared.instrument,
    candidateSample.id,
    resolvedSample.id,
  );

  const sampleIds = new Set(project.samples.map((sample) => sample.id));
  sampleIds.add(resolvedSample.id);
  try {
    validateInstrumentModel(resolvedInstrument, sampleIds);
  } catch (error) {
    throw importError('E_IMPORT_INSTRUMENT', error.message);
  }

  const nextSamples = existingByHash
    ? project.samples
    : [...project.samples, resolvedSample];
  const nextInstruments = [...project.instruments, resolvedInstrument];
  const nextTracks = project.song.tracks.map((track) => (
    track.id === trackId
      ? { ...track, defaultInstrumentId: resolvedInstrument.id }
      : track
  ));

  const nextProject = {
    ...project,
    samples: nextSamples,
    instruments: nextInstruments,
    song: {
      ...project.song,
      tracks: nextTracks,
    },
  };

  return Object.freeze({
    project: nextProject,
    sampleAdded: !existingByHash,
    sampleId: resolvedSample.id,
    instrumentId: resolvedInstrument.id,
    trackId,
    previousInstrumentId: selectedTrack.defaultInstrumentId,
  });
}

function remapInstrumentSample(instrument, fromSampleId, toSampleId) {
  if (fromSampleId === toSampleId) return instrument;

  return {
    ...instrument,
    zones: instrument.zones.map((zone) => (
      zone.sampleId === fromSampleId
        ? { ...zone, sampleId: toSampleId }
        : zone
    )),
  };
}

function validateProjectShell(project) {
  if (
    !project
    || typeof project !== 'object'
    || !Array.isArray(project.samples)
    || !Array.isArray(project.instruments)
    || !Array.isArray(project.song?.tracks)
  ) {
    throw importError('E_IMPORT_PROJECT', 'Project tujuan import tidak valid.');
  }
}

function importError(code, message) {
  const error = new Error(message);
  error.name = 'SampleImportError';
  error.code = code;
  return error;
}
