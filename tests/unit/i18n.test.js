import test from 'node:test';
import assert from 'node:assert/strict';

import { createI18n, AVAILABLE_LOCALES, DEFAULT_LOCALE } from '../../src/i18n/index.js';

test('default locale English, dan Indonesia tetap tersedia sebagai pilihan', () => {
  const i18n = createI18n();
  assert.equal(i18n.getLocale(), DEFAULT_LOCALE);
  assert.deepEqual(i18n.availableLocales(), AVAILABLE_LOCALES);
  assert.ok(AVAILABLE_LOCALES.includes('id'));
});

test('locale tak dikenal jatuh ke default, bukan crash', () => {
  const i18n = createI18n('zz');
  assert.equal(i18n.getLocale(), 'en');
});

test('setLocale menukar bahasa dan memberi tahu listener', () => {
  const i18n = createI18n('en');
  const seen = [];
  const off = i18n.onChange((loc) => seen.push(loc));

  assert.equal(i18n.setLocale('id'), true);
  assert.equal(i18n.getLocale(), 'id');
  assert.equal(i18n.setLocale('klingon'), false);
  assert.deepEqual(seen, ['id']);

  off();
  i18n.setLocale('en');
  assert.deepEqual(seen, ['id'], 'setelah unsubscribe tidak ada notifikasi lagi');
});

test('key hilang di locale aktif fallback ke English, lalu ke key itu sendiri', () => {
  const i18n = createI18n('id');
  assert.equal(i18n.t('shell.buildUnknown'), 'build ?');

  i18n.setLocale('en');
  assert.equal(i18n.t('tidak.ada'), 'tidak.ada');
});

test('interpolasi variabel mengisi placeholder, placeholder tak dikenal dibiarkan utuh', () => {
  const i18n = createI18n('en');
  assert.equal(i18n.t('shell.sectionCount', { count: 3 }), '3 sections');
  assert.equal(i18n.t('shell.sectionCount', { jumlah: 3 }), '{count} sections');
});