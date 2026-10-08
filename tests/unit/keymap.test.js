import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bindingsFor,
  matchKeyBinding,
  shortcutFor,
} from '../../src/core/keymap.js';

function keyEvent(code, {
  ctrlKey = false,
  shiftKey = false,
  altKey = false,
  metaKey = false,
} = {}) {
  return { code, ctrlKey, shiftKey, altKey, metaKey };
}

test('Songwriter memakai Space untuk Play/Stop dan ? untuk bantuan', () => {
  assert.equal(
    matchKeyBinding(keyEvent('Space'), 'songwriter', { context: 'pattern' })?.commandId,
    'playback.togglePlayStop',
  );
  assert.equal(
    matchKeyBinding(keyEvent('Slash', { shiftKey: true }), 'songwriter', { context: 'pattern' })?.commandId,
    'ui.showShortcuts',
  );
});

test('Songwriter Shift+Space memulai playback dari awal Section', () => {
  assert.equal(
    matchKeyBinding(
      keyEvent('Space', { shiftKey: true }),
      'songwriter',
      { context: 'pattern' },
    )?.commandId,
    'playback.playSectionStart',
  );
  assert.equal(
    shortcutFor('playback.playSectionStart', 'songwriter', { context: 'pattern' }),
    'Shift+Space',
  );
});

test('OpenMPT-like memetakan subset yang diverifikasi dan tidak memakai Space sebagai transport', () => {
  assert.equal(matchKeyBinding(keyEvent('Space'), 'openmpt', { context: 'pattern' }), null);
  assert.equal(
    matchKeyBinding(keyEvent('F7'), 'openmpt', { context: 'pattern' })?.commandId,
    'playback.playPatternStart',
  );
  assert.equal(
    matchKeyBinding(keyEvent('F7', { ctrlKey: true }), 'openmpt', { context: 'pattern' })?.commandId,
    'playback.playPatternCursor',
  );
  assert.equal(
    matchKeyBinding(keyEvent('F10'), 'openmpt', { context: 'pattern' })?.commandId,
    'audio.toggleActiveTrackMute',
  );
  assert.equal(
    matchKeyBinding(keyEvent('F10', { ctrlKey: true }), 'openmpt', { context: 'pattern' })?.commandId,
    'audio.toggleActiveTrackSolo',
  );
  assert.equal(
    matchKeyBinding(keyEvent('F11', { shiftKey: true }), 'openmpt', { context: 'pattern' })?.commandId,
    'playback.toggleLoop',
  );
  assert.equal(
    matchKeyBinding(keyEvent('Space', { ctrlKey: true }), 'openmpt', { context: 'pattern' })?.commandId,
    'pattern.toggleEditMode',
  );
});

test('binding Pattern tidak bocor ke view non-Pattern', () => {
  assert.equal(matchKeyBinding(keyEvent('F10'), 'openmpt', { context: 'global' }), null);
  assert.equal(shortcutFor('audio.toggleActiveTrackMute', 'openmpt', { context: 'global' }), null);
  assert.equal(shortcutFor('audio.toggleActiveTrackMute', 'openmpt', { context: 'pattern' }), 'F10');
});

test('bindingsFor fallback ke Songwriter untuk preset asing', () => {
  const ids = bindingsFor('asing', { context: 'pattern' }).map((item) => item.commandId);
  assert.ok(ids.includes('playback.togglePlayStop'));
  assert.ok(ids.includes('ui.openPalette'));
});
