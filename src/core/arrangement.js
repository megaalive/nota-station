import { projectError } from './project.js';

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isoNow() {
  return new Date().toISOString();
}

export function patternUsageCount(project, patternId) {
  return project.song.order.reduce(
    (count, entry) => count + (entry.patternId === patternId ? 1 : 0),
    0,
  );
}

export function insertOrderEntry(
  project,
  {
    patternId,
    index = project.song.order.length,
    sectionId = null,
    keyOverride = null,
  },
  { idFactory = makeId, now = isoNow } = {},
) {
  if (!project.song.patterns.some((pattern) => pattern.id === patternId)) {
    throw projectError('E_PROJECT_PATTERN_MISSING', `Pattern tidak ditemukan: ${patternId}`);
  }
  if (!Number.isInteger(index) || index < 0 || index > project.song.order.length) {
    throw projectError('E_PROJECT_ORDER_INDEX', `Index Order di luar rentang: ${index}`);
  }
  if (
    sectionId !== null
    && !project.song.sections.some((section) => section.id === sectionId)
  ) {
    throw projectError('E_PROJECT_SECTION_MISSING', `Section tidak ditemukan: ${sectionId}`);
  }

  const order = [...project.song.order];
  order.splice(index, 0, {
    id: idFactory('order'),
    patternId,
    sectionId,
    keyOverride,
  });

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      order,
    },
  };
}

export function moveOrderEntry(
  project,
  { orderEntryId, toIndex },
  { now = isoNow } = {},
) {
  const fromIndex = project.song.order.findIndex((entry) => entry.id === orderEntryId);
  if (fromIndex < 0) {
    throw projectError(
      'E_PROJECT_ORDER_MISSING',
      `OrderEntry tidak ditemukan: ${orderEntryId}`,
    );
  }
  if (
    !Number.isInteger(toIndex)
    || toIndex < 0
    || toIndex >= project.song.order.length
  ) {
    throw projectError('E_PROJECT_ORDER_INDEX', `Index Order di luar rentang: ${toIndex}`);
  }
  if (fromIndex === toIndex) return project;

  const order = [...project.song.order];
  const [entry] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, entry);

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      order,
    },
  };
}

export function makeOrderEntryUnique(
  project,
  { orderEntryId },
  { idFactory = makeId, now = isoNow } = {},
) {
  const orderIndex = project.song.order.findIndex((entry) => entry.id === orderEntryId);
  if (orderIndex < 0) {
    throw projectError(
      'E_PROJECT_ORDER_MISSING',
      `OrderEntry tidak ditemukan: ${orderEntryId}`,
    );
  }

  const entry = project.song.order[orderIndex];
  if (patternUsageCount(project, entry.patternId) <= 1) return project;

  const source = project.song.patterns.find((pattern) => pattern.id === entry.patternId);
  if (!source) {
    throw projectError(
      'E_PROJECT_PATTERN_MISSING',
      `Pattern tidak ditemukan: ${entry.patternId}`,
    );
  }

  const { pattern: clone, noteIdMap } = clonePattern(source, project.song.patterns, idFactory);
  const patterns = [...project.song.patterns, clone];
  const order = project.song.order.map((item, index) => (
    index === orderIndex ? { ...item, patternId: clone.id } : item
  ));
  const lyrics = remapOccurrenceLyrics(project.song.lyrics, orderEntryId, noteIdMap);

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      patterns,
      order,
      lyrics,
    },
  };
}

function clonePattern(source, patterns, idFactory) {
  const clone = structuredClone(source);
  clone.id = idFactory('pattern');
  clone.name = nextPatternName(patterns, source.name);
  const noteIdMap = new Map();
  clone.notes = source.notes.map((event) => {
    const cloned = { ...structuredClone(event), id: idFactory('note') };
    noteIdMap.set(event.id, cloned.id);
    return cloned;
  });
  clone.effects = cloneEvents(source.effects, 'effect', idFactory);
  clone.chords = cloneEvents(source.chords, 'chord', idFactory);
  clone.tempoEvents = cloneEvents(source.tempoEvents, 'tempo', idFactory);
  return { pattern: clone, noteIdMap };
}

function remapOccurrenceLyrics(lyrics, orderEntryId, noteIdMap) {
  return lyrics.map((block) => ({
    ...block,
    syllables: (block.syllables ?? []).map((syllable) => ({
      ...syllable,
      anchors: (syllable.anchors ?? []).map((anchor) => (
        anchor.orderEntryId === orderEntryId && noteIdMap.has(anchor.noteId)
          ? { ...anchor, noteId: noteIdMap.get(anchor.noteId) }
          : anchor
      )),
    })),
  }));
}

function cloneEvents(events, prefix, idFactory) {
  return events.map((event) => ({
    ...structuredClone(event),
    id: idFactory(prefix),
  }));
}

function nextPatternName(patterns, sourceName) {
  const names = new Set(patterns.map((pattern) => pattern.name));
  let suffix = 2;
  while (names.has(`${sourceName} (${suffix})`)) suffix += 1;
  return `${sourceName} (${suffix})`;
}
