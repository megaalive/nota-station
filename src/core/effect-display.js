import { normalizeEffectValue } from './effect-model.js';

export const EFFECT_UI = Object.freeze({
  volume: Object.freeze({ code: 'VOL', placeholder: '0..127' }),
  pan: Object.freeze({ code: 'PAN', placeholder: '-64..64' }),
  pitchSlide: Object.freeze({ code: 'SLD', placeholder: 'semitone/durationTicks' }),
  porta: Object.freeze({ code: 'PRT', placeholder: 'targetPitch/durationTicks' }),
  vibrato: Object.freeze({ code: 'VIB', placeholder: 'depth/rateHz' }),
  retrigger: Object.freeze({ code: 'RTR', placeholder: 'intervalTicks/count' }),
  offset: Object.freeze({ code: 'OFF', placeholder: 'frames' }),
  cut: Object.freeze({ code: 'CUT', placeholder: 'afterTicks' }),
  delay: Object.freeze({ code: 'DLY', placeholder: 'ticks' }),
  arpeggio: Object.freeze({ code: 'ARP', placeholder: '0,4,7/stepTicks' }),
});

const CODE_TO_TYPE = new Map(
  Object.entries(EFFECT_UI).map(([type, meta]) => [meta.code, type]),
);

export function effectCode(type) {
  return EFFECT_UI[type]?.code ?? '???';
}

export function effectTypeFromCode(code) {
  return CODE_TO_TYPE.get(String(code ?? '').trim().toUpperCase()) ?? null;
}

export function formatEffectParam(type, value) {
  const normalized = normalizeEffectValue(type, value);
  switch (type) {
    case 'volume':
      return String(normalized.level);
    case 'pan':
      return signed(normalized.position);
    case 'pitchSlide':
      return `${signed(normalized.semitones)}/${normalized.durationTicks}t`;
    case 'porta':
      return `${normalized.targetPitch}/${normalized.durationTicks}t`;
    case 'vibrato':
      return `${compactNumber(normalized.depthSemitones)}/${compactNumber(normalized.rateHz)}Hz`;
    case 'retrigger':
      return `${normalized.intervalTicks}t×${normalized.count}`;
    case 'offset':
      return `${normalized.frames}f`;
    case 'cut':
      return `${normalized.afterTicks}t`;
    case 'delay':
      return `${normalized.ticks}t`;
    case 'arpeggio':
      return `${normalized.semitones.map(signed).join(',')}/${normalized.stepTicks}t`;
    default:
      throw paramError(`Effect type tidak dikenal: ${type}`);
  }
}

export function parseEffectParam(type, text) {
  const raw = String(text ?? '').trim();
  if (!raw) throw paramError('PARAM tidak boleh kosong.');

  let value;
  switch (type) {
    case 'volume':
      value = { level: integer(raw, 'volume') };
      break;
    case 'pan':
      value = { position: integer(raw, 'pan') };
      break;
    case 'pitchSlide': {
      const [semitones, durationTicks] = pair(raw, '/');
      value = {
        semitones: finite(stripUnit(semitones, ''), 'pitchSlide.semitones'),
        durationTicks: integer(stripUnit(durationTicks, 't'), 'pitchSlide.durationTicks'),
      };
      break;
    }
    case 'porta': {
      const [targetPitch, durationTicks] = pair(raw, '/');
      value = {
        targetPitch: integer(stripUnit(targetPitch, ''), 'porta.targetPitch'),
        durationTicks: integer(stripUnit(durationTicks, 't'), 'porta.durationTicks'),
      };
      break;
    }
    case 'vibrato': {
      const [depthSemitones, rateHz] = pair(raw, '/');
      value = {
        depthSemitones: finite(stripUnit(depthSemitones, ''), 'vibrato.depthSemitones'),
        rateHz: finite(stripUnit(rateHz, 'Hz'), 'vibrato.rateHz'),
      };
      break;
    }
    case 'retrigger': {
      const parts = raw.split(/[x×]/i);
      if (parts.length !== 2) throw paramError('Retrigger memakai intervalTicks/count.');
      value = {
        intervalTicks: integer(stripUnit(parts[0], 't'), 'retrigger.intervalTicks'),
        count: integer(parts[1], 'retrigger.count'),
      };
      break;
    }
    case 'offset':
      value = { frames: integer(stripUnit(raw, 'f'), 'offset.frames') };
      break;
    case 'cut':
      value = { afterTicks: integer(stripUnit(raw, 't'), 'cut.afterTicks') };
      break;
    case 'delay':
      value = { ticks: integer(stripUnit(raw, 't'), 'delay.ticks') };
      break;
    case 'arpeggio': {
      const [intervalText, stepTicks] = pair(raw, '/');
      const semitones = intervalText.split(',').map((part, index) => (
        integer(part, `arpeggio.semitones[${index}]`)
      ));
      value = {
        semitones,
        stepTicks: integer(stripUnit(stepTicks, 't'), 'arpeggio.stepTicks'),
      };
      break;
    }
    default:
      throw paramError(`Effect type tidak dikenal: ${type}`);
  }

  try {
    return structuredClone(normalizeEffectValue(type, value));
  } catch (error) {
    throw paramError(error.message, error);
  }
}

export function summarizeEffects(effects) {
  if (!Array.isArray(effects) || effects.length === 0) {
    return Object.freeze({ fx: '···', param: '···', title: null });
  }

  const sorted = [...effects].sort((a, b) => (
    effectCode(a.type).localeCompare(effectCode(b.type)) || a.id.localeCompare(b.id)
  ));
  return Object.freeze({
    fx: sorted.map((effect) => effectCode(effect.type)).join('+'),
    param: sorted.map((effect) => formatEffectParam(effect.type, effect.value)).join(' | '),
    title: sorted
      .map((effect) => `${effectCode(effect.type)} ${formatEffectParam(effect.type, effect.value)}`)
      .join(' · '),
  });
}

function pair(raw, separator) {
  const parts = raw.split(separator);
  if (parts.length !== 2 || parts.some((part) => !part.trim())) {
    throw paramError(`PARAM harus memiliki dua bagian dipisahkan "${separator}".`);
  }
  return parts.map((part) => part.trim());
}

function stripUnit(raw, unit) {
  const text = String(raw).trim();
  if (!unit) return text;
  return text.toLowerCase().endsWith(unit.toLowerCase())
    ? text.slice(0, -unit.length).trim()
    : text;
}

function integer(raw, label) {
  if (!/^[+-]?\d+$/.test(String(raw).trim())) {
    throw paramError(`${label} harus integer.`);
  }
  return Number.parseInt(raw, 10);
}

function finite(raw, label) {
  const value = Number(raw);
  if (!Number.isFinite(value)) throw paramError(`${label} harus angka finite.`);
  return value;
}

function signed(value) {
  return value > 0 ? `+${compactNumber(value)}` : compactNumber(value);
}

function compactNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function paramError(message, cause = null) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = 'EffectDisplayError';
  error.code = 'E_EFFECT_PARAM';
  return error;
}
