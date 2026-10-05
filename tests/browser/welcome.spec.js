import { test, expect } from '@playwright/test';

import { gotoApp, waitForApp } from './helpers.js';

test.describe('welcome + template R1-S9', () => {
  test('first-run default Pop 4/4 dan pilihan OpenMPT memulai Pattern dalam EDIT', async ({ page }) => {
    await gotoApp(page, { firstRun: true });

    await expect(page.locator('[data-action="welcome-dialog"]')).toBeVisible();
    await expect(page.locator('[data-action="welcome-template"]')).toHaveValue('pop-4-4');
    await expect(page.locator('[data-action="welcome-locale"]')).toHaveValue('id');
    await expect(page.locator('[data-action="welcome-keymap"]')).toHaveValue('songwriter');

    await page.locator('[data-action="welcome-keymap"]').selectOption('openmpt');
    await page.locator('[data-action="welcome-start"]').click();

    await expect(page.locator('[data-action="welcome-dialog"]')).toHaveCount(0);
    const state = await page.evaluate(() => ({
      project: window.tracker.getProject(),
      app: window.tracker.getState(),
      completed: localStorage.getItem('notastation.welcome.completed'),
      storedKeymap: localStorage.getItem('notastation.keymapPreset'),
    }));
    expect(state.project.title).toBe('Pop 4/4');
    expect(state.app.project.noteCount).toBe(26);
    expect(state.project.settings.keymapPreset).toBe('openmpt');
    expect(state.completed).toBe('1');
    expect(state.storedKeymap).toBe('openmpt');
    await expect(page.locator('[data-action="pattern-mode"]')).toHaveText('EDIT');

    await page.reload();
    await waitForApp(page);
    await expect(page.locator('[data-action="welcome-dialog"]')).toHaveCount(0);
  });

  test('Lewati menghasilkan proyek Kosong dan menutup first-run', async ({ page }) => {
    await gotoApp(page, { firstRun: true });
    await page.locator('[data-action="welcome-skip"]').click();

    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);
    expect(await page.evaluate(() => window.tracker.getProject().title)).toBe('Untitled');
    expect(await page.evaluate(() => localStorage.getItem('notastation.welcome.completed'))).toBe('1');
  });

  test('command layer loadTemplate memakai jalur yang sama dengan welcome', async ({ page }) => {
    await gotoApp(page);
    const result = await page.evaluate(() =>
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'pop-4-4',
        locale: 'id',
        keymap: 'songwriter',
      }));

    expect(result.templateId).toBe('pop-4-4');
    expect(result.noteCount).toBe(26);
    expect(await page.evaluate(() => window.tracker.getProject().title)).toBe('Pop 4/4');
    await expect(page.locator('[data-action="pattern-mode"]')).toHaveText('AUDISI');
  });

  test('bahasa pilihan welcome langsung diterapkan ke shell', async ({ page }) => {
    await gotoApp(page, { firstRun: true });
    await page.locator('[data-action="welcome-locale"]').selectOption('en');
    await page.locator('[data-action="welcome-start"]').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    expect(await page.evaluate(() => window.tracker.getProject().settings.language)).toBe('en');
  });
});
