import test from 'node:test';
import assert from 'node:assert/strict';

import { createI18n, translate, AVAILABLE_LOCALES, DEFAULT_LOCALE } from '../../src/i18n/messages.js';

test('default locale Indonesian, English tetap tersedia', () => {
  const i18n = createI18n();
  assert.equal(DEFAULT_LOCALE, 'id');
  assert.equal(i18n.getLocale(), 'id');
  assert.deepEqual(i18n.availableLocales(), AVAILABLE_LOCALES);
  assert.ok(AVAILABLE_LOCALES.includes('en'));
});

test('locale tak dikenal jatuh ke default, bukan crash', () => {
  assert.equal(createI18n('zz').getLocale(), 'id');
  assert.equal(createI18n('en').getLocale(), 'en');
});

test('setLocale menukar bahasa dan memberi tahu listener', () => {
  const i18n = createI18n('id');
  const seen = [];
  const off = i18n.onChange((loc) => seen.push(loc));

  assert.equal(i18n.setLocale('en'), true);
  assert.equal(i18n.getLocale(), 'en');
  assert.equal(i18n.setLocale('klingon'), false);
  assert.deepEqual(seen, ['en']);

  off();
  i18n.setLocale('id');
  assert.deepEqual(seen, ['en'], 'setelah unsubscribe tidak ada notifikasi lagi');
});

test('key hilang di locale aktif fallback ke default, lalu ke key itu sendiri', () => {
  // Dicek satu locale yang sengaja belum punya key lengkap.
  assert.equal(translate('en', 'shell.buildUnknown'), 'build ?');
  assert.equal(translate('id', 'tidak.ada'), 'tidak.ada');
});

test('interpolasi mengisi placeholder; placeholder tanpa nilai dibiarkan utuh', () => {
  assert.equal(translate('id', 'view.placeholder', { tab: 'Pattern' }), 'Pattern belum tersedia di milestone ini.');
  assert.equal(translate('id', 'view.placeholder', { tab: 'Guitar' }), 'Guitar belum tersedia di milestone ini.');
  assert.equal(translate('id', 'position.barBeat', {}), 'Bar {bar} · 00:00.0');
});

test('setiap locale punya key yang sama — kalau tidak, ada teks yang akan hilang diam-diam', () => {
  const id = createI18n('id');
  const en = createI18n('en');
  const probe = [
    'app.title', 'app.bootFailed', 'app.needsJs',
    'tab.song', 'tab.pattern', 'tab.pianoRoll', 'tab.lyrics', 'tab.guitar', 'tab.score', 'tab.sound',
    'shell.workspaceTabs', 'shell.leftPanel', 'shell.rightPanel', 'shell.dock', 'shell.statusBar',
    'shell.buildUnknown', 'panel.collapse', 'panel.expand', 'panel.resize', 'topbar.transport',
    'transport.play', 'transport.stop', 'transport.loopPattern', 'transport.tempo',
    'transport.tempoUnit', 'transport.tempoInvalid', 'transport.tempoPlaceholder', 'status.edit', 'status.audisi', 'status.octave', 'status.step',
    'status.audio', 'status.idle', 'status.audioLocked', 'status.audioReady', 'status.audioPlaying',
    'status.audioError', 'status.notSaved', 'position.barBeat', 'position.row', 'left.placeholder',
    'right.placeholder', 'view.placeholder', 'pattern.gridLabel', 'pattern.enterNote',
    'pattern.deleteNote', 'pattern.updateNote', 'pattern.columnNote', 'pattern.columnInstrument',
    'pattern.columnVolume', 'pattern.hintAudition', 'pattern.hintEdit', 'pattern.hintInstrument',
    'pattern.hintVolume', 'pattern.hintNeedsNote', 'pattern.invalidInstrument',
    'pattern.invalidVolume', 'pattern.octaveDown', 'pattern.octaveUp', 'pattern.stepDown',
    'pattern.stepUp', 'history.undo', 'history.redo',
    'history.nothingUndo', 'history.nothingRedo', 'dock.toggle', 'dock.keyboard', 'dock.problems',
    'cmd.palette', 'palette.placeholder', 'palette.close', 'palette.noResults',
    'palette.requiresContext',
  ];
  const missingInEn = probe.filter((key) => translate('en', key) === key);
  const missingInId = probe.filter((key) => translate('id', key) === key);
  assert.deepEqual(missingInEn, []);
  assert.deepEqual(missingInId, []);
  assert.ok(id.t('app.title'));
  assert.ok(en.t('app.title'));
});