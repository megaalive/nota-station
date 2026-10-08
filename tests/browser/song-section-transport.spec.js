import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

test.describe('R3-S11 Song/Section transport surface', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'songwriter',
      });
    });
  });

  test('registry mengekspos command Shift+Space Songwriter sebagai aksi nyata', async ({ page }) => {
    const commands = await page.evaluate(() => window.tracker.commands.listCommands());
    const command = commands.find((item) => item.id === 'playback.playSectionStart');

    expect(command, JSON.stringify(commands.map((item) => item.id))).toBeTruthy();
    expect(command.shortcut).toBe('Shift+Space');
    expect(command.enabled).toBe(true);
  });

  test('transport global memutar seluruh lagu dari Order pertama pada tab apa pun', async ({ page }) => {
    const setup = await page.evaluate(() => {
      const first = window.tracker.getProject().song.order[0];
      const second = window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: first.id,
      });
      window.tracker.commands.execute('focus.setOrderEntry', {
        orderEntryId: second.orderEntryId,
      });
      return { first: first.id };
    });

    await page.getByRole('tab', { name: 'Pattern' }).click();
    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
    const playSong = page.getByRole('button', { name: 'Mulai lagu dari awal', exact: true });
    await expect(playSong).toBeVisible();
    await expect(playSong.locator('xpath=..').locator('[role="tooltip"]'))
      .toHaveText('Putar lagu dari awal');
    await playSong.click();
    await expect.poll(() => page.evaluate(() => window.tracker.getState().audio.transportMode), { timeout: 15000 })
      .toBe('song');

    const state = await page.evaluate(() => window.tracker.getState());
    expect(state.audio.orderIndex).toBe(0);
    expect(state.audio.orderEntryId).toBe(setup.first);
    expect(state.audio.sectionStartOrderIndex).toBe(0);
    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
  });

  test('overlay shortcut menampilkan Shift+Space untuk mulai dari awal Section', async ({ page }) => {
    await page.keyboard.press('Shift+/');

    const row = page.locator(
      '[data-action="shortcut-row"][data-entity="playback.playSectionStart"]',
    );
    await expect(row).toBeVisible();
    await expect(row.locator('kbd')).toHaveText('Shift+Space');
    await expect(row).not.toContainText('playback.playSectionStart');
  });

  test('Command Palette menampilkan aksi mulai dari awal Section', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const row = page.locator(
      '[data-action="palette-item"][data-entity="playback.playSectionStart"]',
    );
    await expect(row).toBeVisible();
    await expect(row.locator('kbd')).toHaveText('Shift+Space');
    await expect(row).toContainText('Putar dari awal Section');
  });

  test('Shift+Space tidak menjalankan transport saat fokus di input teks', async ({ page }) => {
    const tempo = page.locator('[data-action="tempo-input"]');
    await tempo.focus();
    await page.keyboard.press('Shift+Space');
    const state = await page.evaluate(() => window.tracker.getState().audio);
    expect(state.state).toBe('locked');
    expect(state.transportMode).toBe('pattern');
  });

  test('Shift+Space dari occurrence Section kedua mulai di run awal dan mengikuti fokus', async ({ page }) => {
    const setup = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const first = project.song.order[0];
      const second = window.tracker.commands.execute('song.createSectionOccurrence', {
        name: 'Verse',
        patternMode: 'reuse',
        sourcePatternId: first.patternId,
        afterOrderEntryId: first.id,
      });
      const third = window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: second.orderEntryId,
      });
      window.tracker.commands.execute('focus.setOrderEntry', {
        orderEntryId: third.orderEntryId,
      });
      return { second: second.orderEntryId, third: third.orderEntryId };
    });

    await page.getByRole('tab', { name: 'Song' }).click();
    await page.locator(`[data-action="song-entry"][data-entity="${setup.third}"]`).click();
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.tracker.getState().audio.state))
      .toBe('playing');
    expect(await page.evaluate(() => window.tracker.getState().audio.transportMode)).toBe('pattern');
    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
    await page.keyboard.press('Shift+Space');
    await expect.poll(() => page.evaluate(() => window.tracker.getState().audio.state))
      .toBe('playing');

    const state = await page.evaluate(() => window.tracker.getState());
    expect(state.audio.transportMode).toBe('song');
    expect(state.audio.orderEntryId).toBe(setup.second);
    expect(state.audio.orderIndex).toBe(1);
    expect(state.audio.sectionStartOrderIndex).toBe(1);
    expect(state.focus.orderEntryId).toBe(setup.second);

    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
    const stopped = await page.evaluate(() => window.tracker.getState().audio);
    expect(stopped.state).toBe('ready');
    expect(stopped.transportMode).toBe('pattern');
    expect(stopped.orderEntryId).toBeNull();
    expect(stopped.schedulerActive).toBe(false);
    expect(stopped.activeVoices).toBe(0);
  });

  test('Space tetap Pattern, sedangkan Shift+Space memakai Song transport', async ({ page }) => {
    const grid = page.locator('[data-action="pattern-grid"]');
    await grid.focus();
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(() => window.tracker.getState().audio.transportMode))
      .toBe('pattern');

    await page.keyboard.press('Shift+Space');
    await expect.poll(() => page.evaluate(() => window.tracker.getState().audio.transportMode))
      .toBe('song');
    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
  });

  test('live edit memperbarui semua occurrence Pattern reuse setelah freeze tanpa mengulang source beku', async ({ page }) => {
    const setup = await page.evaluate(() => {
      let project = window.tracker.getProject();
      const first = project.song.order[0];
      const trackId = project.song.tracks[0].id;
      window.tracker.commands.execute('pattern.enterNote', {
        patternId: first.patternId,
        trackId,
        row: 0,
        pitch: 60,
        velocity: 100,
      });
      const second = window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: first.id,
      });
      window.tracker.commands.execute('pattern.allowSharedEdit', { patternId: first.patternId });
      window.tracker.commands.execute('focus.setOrderEntry', { orderEntryId: first.id });
      return { patternId: first.patternId, trackId, first: first.id, second: second.orderEntryId };
    });

    await page.getByRole('tab', { name: 'Song' }).click();
    await page.locator(`[data-action="song-entry"][data-entity="${setup.first}"]`).click();
    await page.keyboard.press('Shift+Space');
    await expect.poll(() => page.evaluate(() => window.tracker.getState().audio.state))
      .toBe('playing');
    const before = await page.evaluate(() => window.tracker.getState().audio.liveEditRevision);

    const result = await page.evaluate(async ({ patternId, trackId }) => {
      window.tracker.commands.execute('pattern.updateNote', {
        patternId,
        trackId,
        row: 0,
        velocity: 80,
      });
      const project = window.tracker.getProject();
      const { songNoteEventTemplates } = await import('./src/audio/song-scheduler.js');
      return {
        audio: window.tracker.getState().audio,
        events: songNoteEventTemplates(project, project.song.initial.tempo)
          .filter((event) => event.sourceNoteId === project.song.patterns[0].notes[0].id)
          .map((event) => ({ id: event.id, orderEntryId: event.orderEntryId, velocity: event.velocity })),
        note: project.song.patterns[0].notes[0],
      };
    }, setup);

    expect(result.audio.state).toBe('playing');
    expect(result.audio.transportMode).toBe('song');
    expect(result.audio.liveEditRevision).toBe(before + 1);
    expect(result.events).toEqual([
      { id: `${setup.first}:${result.note.id}`, orderEntryId: setup.first, velocity: 80 },
      { id: `${setup.second}:${result.note.id}`, orderEntryId: setup.second, velocity: 80 },
    ]);
    expect(result.note.startTickSong).toBeUndefined();
    expect(result.note.absoluteTick).toBeUndefined();

    await page.evaluate(() => window.tracker.commands.execute('playback.stop'));
  });

  test('OfflineAudioContext membuktikan batas Pattern rapat dan mix FX kembali ke baseline', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createSongNoteScheduleCursor, songMixEffectEventTemplates } = await import('./src/audio/song-scheduler.js');
      const { scheduleTrackMixEffect, scheduleTrackMixReset } = await import('./src/audio/track-mix-effects.js');
      const project = {
        song: {
          patterns: [
            {
              id: 'p1',
              lengthTicks: 960,
              notes: [{ id: 'n1', trackId: 't1', startTickLocal: 840, durationTicks: 120, pitch: 60, velocity: 100 }],
              effects: [
                { id: 'vol', trackId: 't1', tickLocal: 0, type: 'volume', value: { level: 32 } },
                { id: 'pan', trackId: 't1', tickLocal: 0, type: 'pan', value: { position: 64 } },
              ],
            },
            {
              id: 'p2',
              lengthTicks: 480,
              notes: [{ id: 'n2', trackId: 't1', startTickLocal: 0, durationTicks: 120, pitch: 64, velocity: 100 }],
              effects: [],
            },
          ],
          order: [
            { id: 'o1', patternId: 'p1', sectionId: 'a' },
            { id: 'o2', patternId: 'p2', sectionId: 'a' },
          ],
        },
      };
      const cursor = createSongNoteScheduleCursor(project, 120);
      const notes = cursor.drainUntil(0, 2);
      const sampleRate = 48000;
      const context = new OfflineAudioContext(2, sampleRate * 2, sampleRate);
      const buffer = context.createBuffer(1, sampleRate, sampleRate);
      buffer.getChannelData(0).fill(0.5);
      const channelGain = context.createGain();
      channelGain.gain.setValueAtTime(0.5, 0);
      const fxGain = context.createGain();
      const fxPanner = context.createStereoPanner();
      channelGain.connect(fxGain);
      fxGain.connect(fxPanner);
      fxPanner.connect(context.destination);

      for (const event of songMixEffectEventTemplates(project, 120)) {
        if (event.kind === 'mix-reset') {
          scheduleTrackMixReset({ fxGain, fxPanner }, { when: event.offsetSecondsSong, currentTime: 0 });
        } else {
          scheduleTrackMixEffect({ fxGain, fxPanner }, event, {
            when: event.offsetSecondsSong,
            currentTime: 0,
          });
        }
      }
      for (const event of notes) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(channelGain);
        source.start(event.when);
        source.stop(event.when + event.durationSeconds);
      }

      const rendered = await context.startRendering();
      const left = rendered.getChannelData(0);
      const right = rendered.getChannelData(1);
      const rms = (data, start, end) => {
        const first = Math.floor(start * sampleRate);
        const last = Math.floor(end * sampleRate);
        let sum = 0;
        for (let index = first; index < last; index += 1) sum += data[index] ** 2;
        return Math.sqrt(sum / Math.max(1, last - first));
      };
      const boundaryDifference = notes[0].when + notes[0].durationSeconds - notes[1].when;
      return {
        boundaryDifference,
        beforeBoundary: Math.max(rms(left, 0.99, 1), rms(right, 0.99, 1)),
        afterBoundaryLeft: rms(left, 1.05, 1.15),
        afterBoundaryRight: rms(right, 1.05, 1.15),
        mixResetCount: songMixEffectEventTemplates(project, 120)
          .filter((event) => event.kind === 'mix-reset').length,
      };
    });

    expect(Math.abs(result.boundaryDifference)).toBeLessThan(1 / 48000);
    expect(result.beforeBoundary).toBeGreaterThan(0.02);
    expect(Math.abs(result.afterBoundaryLeft - result.afterBoundaryRight)).toBeLessThan(0.01);
    expect(result.afterBoundaryLeft).toBeGreaterThan(0.14);
    expect(result.mixResetCount).toBe(1);
  });
});
