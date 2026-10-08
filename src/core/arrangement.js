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

const SECTION_COLORS = Object.freeze([
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#16A34A',
  '#0891B2',
]);

export function addSection(
  project,
  {
    name,
    color = SECTION_COLORS[project.song.sections.length % SECTION_COLORS.length],
  },
  { idFactory = makeId, now = isoNow } = {},
) {
  const section = createSectionRecord(project, { name, color }, idFactory);

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      sections: [...project.song.sections, section],
    },
  };
}

export function createSectionOccurrence(
  project,
  {
    name,
    color = SECTION_COLORS[project.song.sections.length % SECTION_COLORS.length],
    patternMode,
    sourcePatternId,
    index = project.song.order.length,
  },
  { idFactory = makeId, now = isoNow } = {},
) {
  if (!['new', 'clone', 'reuse'].includes(patternMode)) {
    throw projectError(
      'E_PROJECT_SECTION_PATTERN_MODE',
      `Mode Pattern Section tidak dikenal: ${patternMode}`,
    );
  }
  if (!Number.isInteger(index) || index < 0 || index > project.song.order.length) {
    throw projectError('E_PROJECT_ORDER_INDEX', `Index Order di luar rentang: ${index}`);
  }

  const source = project.song.patterns.find((pattern) => pattern.id === sourcePatternId);
  if (!source) {
    throw projectError(
      'E_PROJECT_PATTERN_MISSING',
      `Pattern tidak ditemukan: ${sourcePatternId}`,
    );
  }

  const section = createSectionRecord(project, { name, color }, idFactory);
  let patternId = source.id;
  let patterns = project.song.patterns;

  if (patternMode === 'clone') {
    const cloned = clonePattern(source, project.song.patterns, idFactory).pattern;
    patternId = cloned.id;
    patterns = [...project.song.patterns, cloned];
  } else if (patternMode === 'new') {
    const created = createBlankPatternFrom(source, project.song.patterns, idFactory);
    patternId = created.id;
    patterns = [...project.song.patterns, created];
  }

  const order = [...project.song.order];
  const orderEntry = {
    id: idFactory('order'),
    patternId,
    sectionId: section.id,
    keyOverride: null,
  };
  order.splice(index, 0, orderEntry);

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      sections: [...project.song.sections, section],
      patterns,
      order,
    },
  };
}

export function assignOrderEntrySection(
  project,
  { orderEntryId, sectionId },
  { now = isoNow } = {},
) {
  const orderIndex = project.song.order.findIndex((entry) => entry.id === orderEntryId);
  if (orderIndex < 0) {
    throw projectError(
      'E_PROJECT_ORDER_MISSING',
      `OrderEntry tidak ditemukan: ${orderEntryId}`,
    );
  }
  if (
    sectionId !== null
    && !project.song.sections.some((section) => section.id === sectionId)
  ) {
    throw projectError(
      'E_PROJECT_SECTION_MISSING',
      `Section tidak ditemukan: ${sectionId}`,
    );
  }

  const current = project.song.order[orderIndex];
  if ((current.sectionId ?? null) === sectionId) return project;

  const order = project.song.order.map((entry, index) => (
    index === orderIndex ? { ...entry, sectionId } : entry
  ));

  return {
    ...project,
    modifiedAt: now(),
    song: {
      ...project.song,
      order,
    },
  };
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

function createSectionRecord(project, { name, color }, idFactory) {
  const normalizedName = String(name ?? '').trim();
  if (normalizedName.length < 1 || normalizedName.length > 80) {
    throw projectError(
      'E_PROJECT_SECTION_NAME',
      'Nama Section harus berisi 1..80 karakter.',
    );
  }
  if (typeof color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw projectError(
      'E_PROJECT_SECTION_COLOR',
      `Warna Section harus hex #RRGGBB: ${color}`,
    );
  }

  return {
    id: idFactory('section'),
    name: normalizedName,
    color: color.toUpperCase(),
  };
}

function createBlankPatternFrom(source, patterns, idFactory) {
  return {
    id: idFactory('pattern'),
    name: nextBlankPatternName(patterns),
    lengthTicks: source.lengthTicks,
    meter: structuredClone(source.meter),
    rowTicks: source.rowTicks,
    notes: [],
    effects: [],
    chords: [],
    tempoEvents: [],
  };
}

function nextBlankPatternName(patterns) {
  const names = new Set(patterns.map((pattern) => pattern.name));
  let number = 1;
  let candidate;
  do {
    candidate = `Pattern ${String(number).padStart(2, '0')}`;
    number += 1;
  } while (names.has(candidate));
  return candidate;
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
