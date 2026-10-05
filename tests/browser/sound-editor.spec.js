import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('Sound editor + waveform R2-S7', () => {
  test('waveform tampil tanpa decode audio kedua dan edit sederhana ikut Undo', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('tab', { name: 'Suara' }).click();

    const waveform = page.locator('[data-action="sound-waveform"]');
    await expect(waveform).toBeVisible();
    await expect.poll(() => waveform.getAttribute('data-bins'), { timeout: 3000 }).not.toBeNull();
    expect(Number(await waveform.getAttribute('data-bins'))).toBeGreaterThan(0);
    expect(Number(await waveform.getAttribute('data-frames'))).toBeGreaterThan(0);

    const beforeAudio = await page.evaluate(() => window.tracker.getState().audio);
    expect(beforeAudio.sampleDecodeCount).toBe(0);

    const before = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const instrument = project.instruments[0];
      const sample = project.samples.find((item) => item.id === instrument.zones[0].sampleId);
      return {
        rootNote: instrument.zones[0].rootNote,
        tuneCents: instrument.zones[0].tuneCents,
        gain: instrument.zones[0].gain,
        pan: instrument.defaultPan,
        loopEnabled: sample.loop.enabled,
      };
    });

    await page.locator('[data-action="sound-root-note"]').fill('48');
    await page.locator('[data-action="sound-fine-tune"]').fill('-25');
    await page.locator('[data-action="sound-volume"]').fill('0.72');
    await page.locator('[data-action="sound-pan"]').fill('0.35');
    await page.locator('[data-action="sound-loop-enabled"]').check();
    await page.locator('[data-action="sound-apply"]').click();

    await expect(page.locator('[data-action="sound-status"]')).toContainText('Basic diperbarui');

    const edited = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const instrument = project.instruments[0];
      const sample = project.samples.find((item) => item.id === instrument.zones[0].sampleId);
      return {
        rootNote: instrument.zones[0].rootNote,
        tuneCents: instrument.zones[0].tuneCents,
        gain: instrument.zones[0].gain,
        pan: instrument.defaultPan,
        loopEnabled: sample.loop.enabled,
      };
    });

    expect(edited).toEqual({
      rootNote: 48,
      tuneCents: -25,
      gain: 0.72,
      pan: 0.35,
      loopEnabled: true,
    });

    const toast = page.locator('[data-action="toast"]');
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('[data-action="sound-status"]')).toContainText('di-undo');

    const undone = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const instrument = project.instruments[0];
      const sample = project.samples.find((item) => item.id === instrument.zones[0].sampleId);
      return {
        rootNote: instrument.zones[0].rootNote,
        tuneCents: instrument.zones[0].tuneCents,
        gain: instrument.zones[0].gain,
        pan: instrument.defaultPan,
        loopEnabled: sample.loop.enabled,
      };
    });
    expect(undone).toEqual(before);

    const afterAudio = await page.evaluate(() => window.tracker.getState().audio);
    expect(afterAudio.sampleDecodeCount).toBe(0);
  });

  test('mode Lanjutan mengubah ADSR/loop frame dan invalid loop fail-closed', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('tab', { name: 'Suara' }).click();
    await page.locator('[data-action="sound-mode-advanced"]').click();

    await expect(page.locator('[data-action="sound-attack"]')).toBeVisible();
    await expect(page.locator('[data-action="sound-loop-start"]')).toBeVisible();

    await page.locator('[data-action="sound-attack"]').fill('0.02');
    await page.locator('[data-action="sound-decay"]').fill('0.15');
    await page.locator('[data-action="sound-sustain"]').fill('0.64');
    await page.locator('[data-action="sound-release"]').fill('0.4');
    await page.locator('[data-action="sound-loop-enabled"]').check();
    await page.locator('[data-action="sound-loop-start"]').fill('100');
    await page.locator('[data-action="sound-loop-end"]').fill('1200');
    await page.locator('[data-action="sound-apply"]').click();

    const edited = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const instrument = project.instruments[0];
      const sample = project.samples.find((item) => item.id === instrument.zones[0].sampleId);
      return {
        envelope: instrument.ampEnvelope,
        loop: sample.loop,
      };
    });

    expect(edited.envelope).toEqual({
      attackSeconds: 0.02,
      decaySeconds: 0.15,
      sustainLevel: 0.64,
      releaseSeconds: 0.4,
    });
    expect(edited.loop).toEqual({
      enabled: true,
      startFrame: 100,
      endFrame: 1200,
      mode: 'forward',
    });

    const beforeInvalid = await page.evaluate(() => JSON.stringify(window.tracker.getProject()));
    await page.locator('[data-action="sound-loop-start"]').fill('1300');
    await page.locator('[data-action="sound-loop-end"]').fill('200');
    await page.locator('[data-action="sound-apply"]').click();

    await expect(page.locator('[data-action="sound-status"]')).toContainText(
      'Perubahan Sound gagal (E_SOUND_SAMPLE_LOOP)',
    );
    const afterInvalid = await page.evaluate(() => JSON.stringify(window.tracker.getProject()));
    expect(afterInvalid).toBe(beforeInvalid);
  });
});
