// Timbre khusus fixture UAT stability.
// Project normal R1 tetap memakai factory.basic; voice ini hanya aktif untuk ID demo.*.

import { STABILITY_DEMO_INSTRUMENTS } from '../core/demos.js';

const DEMO_IDS = new Set(STABILITY_DEMO_INSTRUMENTS.map((item) => item.id));
const noiseBuffers = new WeakMap();

export const DEMO_TIMBRE_SIGNATURES = Object.freeze({
  'demo.kick': 'osc:sine:pitch-drop:pan0.00',
  'demo.snare': 'noise:bandpass1850:pan+0.12',
  'demo.hat': 'noise:highpass6800:pan-0.58',
  'demo.bass': 'osc:triangle:lowpass720:pan-0.08',
  'demo.arp': 'osc:square:lowpass2600:pan-0.42',
  'demo.lead': 'osc:sawtooth:lowpass2100:pan+0.26',
  'demo.harmony': 'osc:sine:steady:pan+0.56',
  'demo.fill': 'osc:sine:pitch-drop:pan-0.20',
});

export function isDemoInstrument(instrumentId) {
  return DEMO_IDS.has(instrumentId);
}

export function scheduleDemoVoice(context, {
  instrumentId,
  pitch,
  velocity = 100,
  when,
  durationSeconds,
}) {
  if (!isDemoInstrument(instrumentId)) {
    throw new RangeError(`Instrument demo tidak dikenal: ${instrumentId}`);
  }

  const level = Math.max(0, Math.min(1, velocity / 127));
  const hz = midiHz(pitch);

  switch (instrumentId) {
    case 'demo.kick':
      return oscillatorVoice(context, {
        type: 'sine',
        when,
        duration: 0.14,
        gain: 0.34 * level,
        pan: 0,
        frequency: { from: 118, to: 43 },
      });

    case 'demo.snare':
      return noiseVoice(context, {
        when,
        duration: 0.11,
        gain: 0.16 * level,
        pan: 0.12,
        filterType: 'bandpass',
        filterFrequency: 1850,
        q: 0.7,
      });

    case 'demo.hat':
      return noiseVoice(context, {
        when,
        duration: 0.045,
        gain: 0.065 * level,
        pan: -0.58,
        filterType: 'highpass',
        filterFrequency: 6800,
        q: 0.5,
      });

    case 'demo.bass':
      return oscillatorVoice(context, {
        type: 'triangle',
        when,
        duration: Math.max(0.34, Math.min(0.46, durationSeconds * 3.2)),
        gain: 0.40 * level,
        pan: -0.12,
        frequency: { from: hz, to: hz },
        lowpass: 980,
      });

    case 'demo.arp':
      return oscillatorVoice(context, {
        type: 'square',
        when,
        duration: Math.max(0.15, Math.min(0.21, durationSeconds * 1.7)),
        gain: 0.16 * level,
        pan: -0.46,
        frequency: { from: hz, to: hz },
        lowpass: 3000,
      });

    case 'demo.lead':
      return oscillatorVoice(context, {
        type: 'sawtooth',
        when,
        duration: Math.max(0.34, Math.min(0.46, durationSeconds * 3.2)),
        gain: 0.30 * level,
        pan: 0.30,
        frequency: { from: hz, to: hz },
        lowpass: 3300,
      });

    case 'demo.harmony':
      return oscillatorVoice(context, {
        type: 'sine',
        when,
        duration: Math.max(0.28, Math.min(0.40, durationSeconds * 2.8)),
        gain: 0.18 * level,
        pan: 0.58,
        frequency: { from: hz, to: hz },
      });

    case 'demo.fill':
      return oscillatorVoice(context, {
        type: 'sine',
        when,
        duration: 0.13,
        gain: 0.12 * level,
        pan: -0.20,
        frequency: { from: hz * 1.12, to: hz * 0.58 },
      });

    default:
      throw new RangeError(`Instrument demo tidak memiliki voice: ${instrumentId}`);
  }
}

function oscillatorVoice(context, {
  type,
  when,
  duration,
  gain,
  pan,
  frequency,
  lowpass = null,
}) {
  const source = context.createOscillator();
  source.type = type;
  source.frequency.setValueAtTime(Math.max(1, frequency.from), when);
  if (frequency.to !== frequency.from) {
    source.frequency.exponentialRampToValueAtTime(Math.max(1, frequency.to), when + duration);
  }

  const amp = context.createGain();
  amp.gain.setValueAtTime(Math.max(0.0001, gain), when);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  let input = source;
  if (lowpass) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpass, when);
    filter.Q.setValueAtTime(0.7, when);
    source.connect(filter);
    input = filter;
  }

  input.connect(amp);
  connectOutput(context, amp, pan);
  source.start(when);
  source.stop(when + duration + 0.01);
  return source;
}

function noiseVoice(context, {
  when,
  duration,
  gain,
  pan,
  filterType,
  filterFrequency,
  q,
}) {
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);

  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFrequency, when);
  filter.Q.setValueAtTime(q, when);

  const amp = context.createGain();
  amp.gain.setValueAtTime(Math.max(0.0001, gain), when);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  source.connect(filter);
  filter.connect(amp);
  connectOutput(context, amp, pan);
  source.start(when);
  source.stop(when + duration + 0.01);
  return source;
}

function connectOutput(context, node, pan) {
  if (typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), context.currentTime);
    node.connect(panner);
    panner.connect(context.destination);
    return;
  }
  node.connect(context.destination);
}

function getNoiseBuffer(context) {
  const existing = noiseBuffers.get(context);
  if (existing) return existing;

  const length = Math.max(1, Math.round(context.sampleRate * 0.5));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x13579bdf;
  for (let i = 0; i < data.length; i += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

function midiHz(pitch) {
  return 440 * (2 ** ((pitch - 69) / 12));
}
