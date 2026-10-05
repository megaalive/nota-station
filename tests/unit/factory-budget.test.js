import test from 'node:test';
import assert from 'node:assert/strict';

import { FACTORY_DRUM_WAV_BASE64 } from '../../src/audio/factory-drum-samples.js';
import { FACTORY_BASIC_WAV_BASE64 } from '../../src/audio/factory-sample.js';

const FACTORY_PACK_BUDGET_BYTES = 12 * 1024 * 1024;

function decodedLength(base64) {
  return Buffer.from(base64, 'base64').byteLength;
}

test('factory sample pack tetap jauh di bawah budget 12 MiB', () => {
  const entries = [
    ['basic', FACTORY_BASIC_WAV_BASE64],
    ...Object.entries(FACTORY_DRUM_WAV_BASE64),
  ];

  const bytes = entries.reduce((sum, [, encoded]) => sum + decodedLength(encoded), 0);

  assert.equal(entries.length, 5);
  assert.equal(bytes, 57330);
  assert.ok(bytes <= FACTORY_PACK_BUDGET_BYTES);
});
