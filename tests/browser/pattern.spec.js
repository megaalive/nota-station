import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Pattern R1-S1', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('grid 8 channel × 64 row memakai windowing dan default AUDISI', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');

    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute('role', 'grid');
    await expect(grid).toHaveAttribute('aria-rowcount', '64');
    await expect(grid).toHaveAttribute('aria-colcount', '8');
    await expect(page.locator('.pattern-grid__channel')).toHaveCount(8);
    expect(await page.locator('.pattern-grid__row').count()).toBeLessThan(64);
    await expect(page.locator('[data-action="pattern-mode"]')).toContainText('AUDISI');
    await expect(page.locator('[data-action="edit-mode"]')).toContainText('AUDISI');
    await expect(page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="0"]')).toHaveCSS(
      'outline-style',
      'dashed',
    );
  });

  test('AUDISI memainkan tombol nada tanpa menulis project', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('z');

    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);
    await expect(page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="0"]')).toHaveText('···');
  });

  test('Ctrl+E lalu Z menulis C-4 melalui command layer dan maju satu row', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await expect(page.locator('[data-action="pattern-mode"]')).toContainText('EDIT');

    await page.keyboard.press('z');

    const project = await page.evaluate(() => window.tracker.getProject());
    expect(project.song.patterns[0].notes).toHaveLength(1);
    expect(project.song.patterns[0].notes[0]).toMatchObject({
      startTickLocal: 0,
      durationTicks: 120,
      pitch: 60,
      velocity: 100,
      source: 'user',
      locked: false,
    });
    expect(project.song.patterns[0].notes[0]).not.toHaveProperty('absoluteTick');

    await expect(page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="0"]')).toHaveText('C-4');
    await expect(page.locator('[data-action="pattern-cell"][data-row="1"][data-channel="0"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('[data-action="position"]')).toHaveText('Baris 1');
  });

  test('mengetik ulang sel mengganti pitch tanpa duplikat', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('x');

    const notes = await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes);
    expect(notes).toHaveLength(1);
    expect(notes[0].pitch).toBe(62);
    await expect(page.locator('[data-action="pattern-cell"][data-row="0"][data-channel="0"]')).toHaveText('D-4');
  });

  test('scroll ke bawah merender window row akhir tanpa membuat 64 row DOM sekaligus', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
      node.dispatchEvent(new Event('scroll'));
    });

    await expect(page.locator('.pattern-grid__row[aria-rowindex="64"]')).toBeAttached();
    expect(await page.locator('.pattern-grid__row').count()).toBeLessThan(64);
  });

  test('Play setelah gestur pengguna menjadwalkan note dengan Web Audio lalu Stop membersihkan voice', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });
    expect(await page.evaluate(() => window.tracker.getState().audio.sampleReady)).toBe(true);

    await page.getByRole('button', { name: 'Berhenti' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('siap');
    expect(await page.evaluate(() => window.tracker.getState().audio.activeVoices)).toBe(0);
  });
});
