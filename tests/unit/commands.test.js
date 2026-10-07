import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommandRegistry, commandError } from '../../src/core/commands.js';

test('listCommands mengembalikan descriptor serializable dengan status aktif', () => {
  const registry = createCommandRegistry();
  registry.register({
    id: 'playback.play',
    group: 'Playback',
    labelKey: 'cmd.play',
    shortcut: 'Space',
    run: () => 'played',
  });

  const list = registry.listCommands();
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], {
    id: 'playback.play',
    group: 'Playback',
    labelKey: 'cmd.play',
    shortcut: 'Space',
    requiresArgs: false,
    enabled: true,
    disabledReason: null,
  });
  // Harus bisa di-JSON-kan apa adanya buat agent (§9).
  assert.deepEqual(JSON.parse(JSON.stringify(list)), list);
});

test('shortcut descriptor boleh dinamis tetapi hasil listCommands tetap serializable', () => {
  let preset = 'songwriter';
  const registry = createCommandRegistry();
  registry.register({
    id: 'playback.toggle',
    group: 'Playback',
    labelKey: 'cmd.play',
    shortcut: () => preset === 'songwriter' ? 'Space' : 'F7',
    run: () => {},
  });

  assert.equal(registry.listCommands()[0].shortcut, 'Space');
  preset = 'openmpt';
  assert.equal(registry.listCommands()[0].shortcut, 'F7');
  assert.deepEqual(JSON.parse(JSON.stringify(registry.listCommands())), registry.listCommands());
});

test('command nonaktif melaporkan alasan, dan execute menolak', () => {
  const registry = createCommandRegistry();
  registry.register({
    id: 'io.exportWav',
    group: 'Ekspor',
    labelKey: 'cmd.exportWav',
    isEnabled: () => false,
    disabledReason: () => 'Audio belum aktif',
    run: () => 'should not run',
  });

  const [entry] = registry.listCommands();
  assert.equal(entry.enabled, false);
  assert.equal(entry.disabledReason, 'Audio belum aktif');

  assert.throws(() => registry.execute('io.exportWav'), (err) => err.code === 'E_CMD_DISABLED');
});

test('command requiresArgs tetap dapat dieksekusi agent/view dengan argumen', () => {
  const registry = createCommandRegistry();
  registry.register({
    id: 'pattern.enterNote',
    group: 'Pattern',
    labelKey: 'pattern.enterNote',
    requiresArgs: true,
    run: (args) => args.pitch,
  });

  const [entry] = registry.listCommands();
  assert.equal(entry.requiresArgs, true);
  assert.equal(entry.enabled, true);
  assert.equal(registry.execute('pattern.enterNote', { pitch: 60 }), 60);
});

test('command tak dikenal punya kode galat stabil E_CMD_NOT_FOUND', () => {
  const registry = createCommandRegistry();
  assert.throws(
    () => registry.execute('tidak.ada'),
    (err) => err.code === 'E_CMD_NOT_FOUND' && err.name === 'CommandError',
  );
});

test('id duplikat dan definisi rusak ditolak saat register', () => {
  const registry = createCommandRegistry();
  const def = { id: 'a.b', group: 'G', labelKey: 'k', run: () => {} };
  registry.register(def);

  assert.throws(() => registry.register(def), (err) => err.code === 'E_CMD_DUPLICATE');
  assert.throws(() => registry.register({ id: 'x', run: () => {} }), (err) => err.code === 'E_CMD_INVALID');
  assert.throws(() => registry.register({ group: 'G', run: () => {} }), (err) => err.code === 'E_CMD_INVALID');
});

test('execute meneruskan argumen dan mengembalikan nilai apa adanya', () => {
  const registry = createCommandRegistry();
  registry.register({ id: 'a.b', group: 'G', labelKey: 'k', run: (args) => args });
  assert.deepEqual(registry.execute('a.b', { pitch: 60 }), { pitch: 60 });
  assert.equal(registry.canRun('a.b'), true);
  assert.equal(registry.has('a.b'), true);
});

test('commandError menyertakan kode di error', () => {
  const err = commandError('E_X', 'msg');
  assert.equal(err.code, 'E_X');
  assert.equal(err.message, 'msg');
});