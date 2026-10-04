import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

const noteCell = (page, row = 0, channel = 0) =>
  page.locator(`[data-action="pattern-cell"][data-row="${row}"][data-channel="${channel}"][data-field="note"]`);

const instrumentCell = (page, row = 0, channel = 0) =>
  page.locator(`[data-action="pattern-cell"][data-row="${row}"][data-channel="${channel}"][data-field="instrument"]`);

const volumeCell = (page, row = 0, channel = 0) =>
  page.locator(`[data-action="pattern-cell"][data-row="${row}"][data-channel="${channel}"][data-field="volume"]`);

test.describe('Pattern R1 editing', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('grid 8 channel × NOTE/INST/VOL × 64 row memakai windowing dan default AUDISI', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');

    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute('role', 'grid');
    await expect(grid).toHaveAttribute('aria-rowcount', '64');
    await expect(grid).toHaveAttribute('aria-colcount', '24');
    await expect(page.locator('.pattern-grid__channel')).toHaveCount(8);
    await expect(page.locator('.pattern-grid__field-header')).toHaveCount(24);
    await expect(page.locator('.pattern-grid__field-header--note')).toHaveCount(8);
    await expect(page.locator('.pattern-grid__field-header--instrument')).toHaveCount(8);
    await expect(page.locator('.pattern-grid__field-header--volume')).toHaveCount(8);
    await expect(page.locator('.pattern-grid__header-row--field').first()).toContainText('NOTE');
    await expect(page.locator('.pattern-grid__header-row--field').first()).toContainText('INST');
    await expect(page.locator('.pattern-grid__header-row--field').first()).toContainText('VOL');

    expect(await page.locator('.pattern-grid__row').count()).toBeLessThan(64);
    await expect(page.locator('[data-action="pattern-mode"]')).toContainText('AUDISI');
    await expect(page.locator('[data-action="edit-mode"]')).toContainText('AUDISI');
    await expect(noteCell(page)).toHaveCSS('outline-style', 'dashed');
    await expect(page.locator('.pattern-grid__corner--channel')).toHaveCSS('position', 'sticky');
  });

  test('cursor auto-scroll horizontal sampai channel terakhir pada viewport sempit', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 720 });
    const grid = page.locator('[data-action="pattern-grid"]');
    await expect(grid).toBeVisible();
    await grid.focus();

    for (let i = 0; i < 23; i += 1) await page.keyboard.press('ArrowRight');

    await expect(volumeCell(page, 0, 7)).toHaveAttribute('aria-selected', 'true');
    expect(await grid.evaluate((node) => node.scrollWidth)).toBeGreaterThan(
      await grid.evaluate((node) => node.clientWidth),
    );
    expect(await grid.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );

    const visible = await volumeCell(page, 0, 7).evaluate((cell) => {
      const grid = cell.closest('[data-action="pattern-grid"]');
      const cellRect = cell.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      return cellRect.left >= gridRect.left && cellRect.right <= gridRect.right + 1;
    });
    expect(visible).toBe(true);
  });

  test('AUDISI memainkan tombol nada tanpa menulis project', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('z');

    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);
    await expect(noteCell(page)).toHaveText('···');
    await expect(instrumentCell(page)).toHaveText('··');
    await expect(volumeCell(page)).toHaveText('··');
  });

  test('Ctrl+E lalu Z menulis NOTE INST VOL kanonik dan maju satu row', async ({ page }) => {
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
      instrumentId: 'factory.basic',
      velocity: 100,
      source: 'user',
      locked: false,
    });
    expect(project.song.patterns[0].notes[0]).not.toHaveProperty('absoluteTick');

    await expect(noteCell(page)).toHaveText('C-4');
    await expect(instrumentCell(page)).toHaveText('01');
    await expect(volumeCell(page)).toHaveText('64');
    await expect(noteCell(page, 1, 0)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-action="position"]')).toHaveText('Baris 1');
  });

  test('panah horizontal berpindah NOTE → INST → VOL → channel berikutnya tanpa menulis', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');

    await page.keyboard.press('ArrowRight');
    await expect(instrumentCell(page)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('x');
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);

    await page.keyboard.press('ArrowRight');
    await expect(volumeCell(page)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(noteCell(page, 0, 1)).toHaveAttribute('aria-selected', 'true');
  });

  test('VOL memakai dua digit hex sebagai satu transaksi history', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await expect(volumeCell(page)).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(1);

    await page.keyboard.press('5');
    await expect(volumeCell(page)).toHaveText('5_');
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(1);

    await page.keyboard.press('0');
    await expect(volumeCell(page)).toHaveText('50');
    expect(await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes[0].velocity)).toBe(0x50);
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(2);

    await page.keyboard.press('Control+z');
    await expect(volumeCell(page)).toHaveText('64');
    expect(await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes[0].velocity)).toBe(100);

    await page.keyboard.press('Control+y');
    await expect(volumeCell(page)).toHaveText('50');
  });

  test('INST menerima dua digit, no-op untuk 01, dan menolak index yang belum ada', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');

    await expect(instrumentCell(page)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('0');
    await expect(instrumentCell(page)).toHaveText('0_');
    await page.keyboard.press('1');

    await expect(volumeCell(page)).toHaveAttribute('aria-selected', 'true');
    await expect(instrumentCell(page)).toHaveText('01');
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(1);

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('0');
    await page.keyboard.press('2');

    await expect(page.locator('[data-action="pattern-hint"]')).toContainText('tidak tersedia');
    await expect(instrumentCell(page)).toHaveText('01');
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(1);
  });

  test('INST/VOL pada row kosong meminta NOTE lebih dulu tanpa membuat history', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('0');

    await expect(page.locator('[data-action="pattern-hint"]')).toContainText('Isi NOTE lebih dulu');
    await expect(instrumentCell(page)).toHaveText('··');
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(0);
  });

  test('kontrol ringkas oktaf dan step memengaruhi note entry tanpa memindahkan fokus dari grid', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');

    await page.getByRole('button', { name: 'Naikkan oktaf' }).click();
    await expect(page.locator('[data-action="pattern-octave"]')).toHaveText('Oktaf 5');

    await page.getByRole('button', { name: 'Tambah step' }).click();
    await expect(page.locator('[data-action="pattern-step"]')).toHaveText('Step 2');

    await expect(grid).toBeFocused();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');

    const note = await page.evaluate(() => window.tracker.getProject().song.patterns[0].notes[0]);
    expect(note.pitch).toBe(72);
    await expect(noteCell(page, 2, 0)).toHaveAttribute('aria-selected', 'true');
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
    await expect(noteCell(page)).toHaveText('D-4');
  });

  test('Delete adalah transaksi dan Ctrl+Z/Ctrl+Y memulihkan project serta UI', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');
    await page.keyboard.press('ArrowUp');

    await page.keyboard.press('Delete');
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);
    await expect(noteCell(page)).toHaveText('···');
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(2);

    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(1);
    await expect(noteCell(page)).toHaveText('C-4');
    await expect(page.locator('[data-action="pattern-mode"]')).toContainText('EDIT');

    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);
    await expect(noteCell(page)).toHaveText('···');

    await page.keyboard.press('Control+y');
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(1);
    await expect(noteCell(page)).toHaveText('C-4');
    expect(await page.evaluate(() => window.tracker.getState().history.canRedo)).toBe(true);
  });

  test('Delete pada sel kosong tidak membuat history palsu', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('Delete');

    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(0);
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);
  });

  test('Delete dan Backspace pada INST/VOL read-only tidak menghapus note', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');
    await page.keyboard.press('ArrowUp');

    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(1);

    await page.keyboard.press('ArrowRight');
    await expect(instrumentCell(page)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Delete');

    await page.keyboard.press('ArrowRight');
    await expect(volumeCell(page)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Backspace');

    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(1);
    expect(await page.evaluate(() => window.tracker.getState().history.undoDepth)).toBe(1);
    await expect(noteCell(page)).toHaveText('C-4');
    await expect(instrumentCell(page)).toHaveText('01');
    await expect(volumeCell(page)).toHaveText('64');
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

  test('live edit add/delete saat loop berjalan membangun ulang masa depan tanpa re-anchor', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });

    const before = await page.evaluate(() => window.tracker.getState().audio);
    const context = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        patternId: project.song.patterns[0].id,
        trackId: project.song.tracks[0].id,
      };
    });

    await page.evaluate(({ patternId, trackId }) => {
      window.tracker.commands.execute('pattern.enterNote', {
        patternId,
        trackId,
        row: 4,
        pitch: 60,
      });
    }, context);

    let audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.state).toBe('playing');
    expect(audio.scheduleRevision).toBe(before.scheduleRevision);
    expect(audio.liveEditRevision).toBe(before.liveEditRevision + 1);
    expect(audio.liveEditFreezeSeconds).toBeCloseTo(0.03, 6);

    await expect.poll(
      () => page.evaluate(() => window.tracker.getState().audio.scheduledNoteSources),
      { timeout: 1500, intervals: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20] },
    ).toBe(1);

    const revisionAfterAdd = audio.liveEditRevision;
    await page.evaluate(({ patternId, trackId }) => {
      window.tracker.commands.execute('pattern.deleteNote', {
        patternId,
        trackId,
        row: 4,
      });
    }, context);

    audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.state).toBe('playing');
    expect(audio.scheduleRevision).toBe(before.scheduleRevision);
    expect(audio.liveEditRevision).toBe(revisionAfterAdd + 1);
    expect(audio.lastLiveEditCanceledNotes).toBeGreaterThanOrEqual(1);
    expect(audio.scheduledNoteSources).toBe(0);
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);

    await page.getByRole('button', { name: 'Berhenti' }).click();
  });

  test('Undo note saat playback memakai freeze-window live edit, bukan restart transport', async ({ page }) => {
    const project = await page.evaluate(() => window.tracker.getProject());
    const patternId = project.song.patterns[0].id;
    const trackId = project.song.tracks[0].id;

    await page.evaluate(({ patternId, trackId }) => {
      window.tracker.commands.execute('pattern.enterNote', {
        patternId,
        trackId,
        row: 8,
        pitch: 64,
      });
    }, { patternId, trackId });

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });
    const before = await page.evaluate(() => window.tracker.getState().audio);

    await page.keyboard.press('Control+z');

    const after = await page.evaluate(() => window.tracker.getState().audio);
    expect(after.state).toBe('playing');
    expect(after.scheduleRevision).toBe(before.scheduleRevision);
    expect(after.liveEditRevision).toBe(before.liveEditRevision + 1);
    expect(await page.evaluate(() => window.tracker.getState().project.noteCount)).toBe(0);

    await page.getByRole('button', { name: 'Berhenti' }).click();
  });

  test('Play memakai look-ahead scheduler, tempo project, dan loop Pattern', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Control+e');
    await page.keyboard.press('z');

    const tempo = page.locator('[data-action="tempo-input"]');
    await tempo.fill('240');
    await tempo.press('Tab');

    await page.getByRole('button', { name: 'Putar' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('bermain', { timeout: 5000 });

    let audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.sampleReady).toBe(true);
    expect(audio.schedulerActive).toBe(true);
    expect(audio.loop).toBe(true);
    expect(audio.durationSeconds).toBeCloseTo(4, 6);
    expect(audio.notesScheduled).toBeGreaterThanOrEqual(1);

    await page.getByRole('button', { name: 'Loop Pattern' }).click();
    await expect(page.getByRole('button', { name: 'Loop Pattern' })).toHaveAttribute('aria-pressed', 'false');
    audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.loop).toBe(false);

    await page.getByRole('button', { name: 'Berhenti' }).click();
    await expect(page.locator('[data-action="audio-status"]')).toContainText('siap');
    audio = await page.evaluate(() => window.tracker.getState().audio);
    expect(audio.activeVoices).toBe(0);
    expect(audio.schedulerActive).toBe(false);
  });
});
