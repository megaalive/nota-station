import { test, expect } from '@playwright/test';
import { gotoApp, waitForApp } from './helpers.js';

test('pilih lagu lengkap di Welcome lalu pelajari dan putar dari Song Map', async ({ page }) => {
  await gotoApp(page, { firstRun: true });
  const selector = page.locator('[data-action="welcome-template"]');
  await selector.selectOption('learning-song');
  await expect(page.locator('[data-action="welcome-template-hint"]')).toContainText('8 channel');
  await page.locator('[data-action="welcome-start"]').click();

  await expect(page.locator('[data-action="song-workspace"]')).toBeVisible();
  await expect(page.locator('[data-action="song-summary"]')).toContainText('9 tempat');
  await expect(page.locator('[data-action="song-entry"]')).toHaveCount(9);
  await expect(page.locator('[data-action="song-learning-guide"]')).toBeVisible();

  const guide = page.locator('[data-action="song-learning-guide"]');
  await guide.locator('summary').click();
  await expect(guide).toContainText('Mute/Solo');
  await expect(guide).toContainText('Jadikan unik');

  // Fokus berada di Outro, tombol play song wajib mulai dari Intro.
  await page.locator('[data-action="song-entry"]').last().click();
  const first = await page.evaluate(() => window.tracker.getProject().song.order[0].id);
  expect(await page.evaluate(() => window.tracker.getState().focus.orderEntryId))
    .not.toBe(first);
  await page.locator('[data-action="song-play-from-start"]').click();
  await expect.poll(() => page.evaluate(
    () => window.tracker.getState().focus.orderEntryId,
  )).toBe(first);

  const project = await page.evaluate(() => window.tracker.getProject());
  expect(project.song.patterns).toHaveLength(7);
  expect(project.song.order).toHaveLength(9);
});

test('pengguna lama bisa membuka contoh tanpa mengganti proyek sebelum konfirmasi', async ({ page }) => {
  await gotoApp(page);
  await page.getByRole('tab', { name: 'Song' }).click();
  const before = await page.evaluate(() => window.tracker.getProject().id);
  const button = page.locator('[data-action="song-open-learning-song"]');
  await button.click();
  const dialog = page.locator('[data-action="song-learning-confirm"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('mengganti proyek saat ini');
  await dialog.getByRole('button', { name: 'Batal' }).click();
  expect(await page.evaluate(() => window.tracker.getProject().id)).toBe(before);

  await button.click();
  await dialog.getByRole('button', { name: 'Buka lagu contoh' }).click();
  await expect(page.locator('[data-action="song-workspace"]')).toBeVisible();
  await expect(page.locator('[data-action="song-entry"]')).toHaveCount(9);
  await expect(page.locator('[data-action="song-learning-confirm"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.tracker.getProject().id)).not.toBe(before);
});

test('tautan langsung template memuat lagu tanpa dialog first-run', async ({ page }) => {
  await page.goto('./?template=learning-song');
  await waitForApp(page);
  await expect(page.locator('[data-action="welcome-dialog"]')).toHaveCount(0);
  await expect(page.locator('[data-action="song-workspace"]')).toBeVisible();
  await expect(page.locator('[data-action="song-entry"]')).toHaveCount(9);
  expect(await page.evaluate(() => window.tracker.getProject().title))
    .toBe('Malam Kota — Lagu Contoh');
});

test('pilihan template lama dan demo stability tidak berubah', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => window.tracker.commands.execute('project.loadTemplate', {
    templateId: 'pop-4-4', locale: 'id', keymap: 'songwriter',
  }));
  expect(await page.evaluate(() => window.tracker.getProject().title)).toBe('Pop 4/4');
  await expect(page.locator('[data-action="song-learning-guide"]')).toHaveCount(0);
});
