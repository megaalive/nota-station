import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

const entries = (page) => page.locator('[data-action="song-entry"]');

test.describe('Song workspace R3-S2', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('tab', { name: 'Song' }).click();
  });

  test('Song Map dan Order List memproyeksikan urutan yang sama', async ({ page }) => {
    const workspace = page.locator('[data-action="song-workspace"]');
    await expect(workspace).toBeVisible();
    await expect(page.locator('[data-action="song-view-map"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(entries(page)).toHaveCount(1);

    const map = await entries(page).evaluateAll((nodes) => nodes.map((node) => ({
      id: node.dataset.entity,
      text: node.textContent,
    })));

    await page.locator('[data-action="song-view-order"]').click();
    await expect(page.locator('[data-action="song-view-order"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(entries(page)).toHaveCount(1);

    const order = await entries(page).evaluateAll((nodes) => nodes.map((node) => ({
      id: node.dataset.entity,
      text: node.textContent,
    })));
    expect(order).toEqual(map);
  });

  test('preset OpenMPT-like membuka Order List sebagai pintu awal Song', async ({ page }) => {
    await page.evaluate(() => {
      window.tracker.commands.execute('project.loadTemplate', {
        templateId: 'blank',
        locale: 'id',
        keymap: 'openmpt',
      });
    });

    await expect(page.locator('[data-action="song-view-order"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-action="song-order-list"]')).toBeVisible();
    await expect(entries(page)).toHaveCount(1);
  });

  test('Tambah section pada tempat Tanpa section menetapkan Section tanpa menambah occurrence', async ({ page }) => {
    const firstId = await page.evaluate(() => window.tracker.getProject().song.order[0].id);
    const addSection = page.locator('[data-action="song-add-section"]');

    await addSection.click();
    await expect(page.locator('[data-action="song-section-dialog"]')).toBeVisible();
    await expect(page.locator('[data-action="song-section-assign-hint"]')).toBeVisible();
    await expect(page.locator('[data-action="song-section-pattern-mode"]')).not.toBeVisible();
    await expect(page.locator('[data-action="song-section-source-pattern"]')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Tetapkan' })).toBeVisible();

    await page.locator('[data-action="song-section-preset"]').selectOption('Verse');
    await page.getByRole('button', { name: 'Tetapkan' }).click();

    let state = await page.evaluate(() => ({
      sections: window.tracker.getProject().song.sections,
      order: window.tracker.getProject().song.order,
      patterns: window.tracker.getProject().song.patterns,
      history: window.tracker.getState().history,
      focus: window.tracker.getState().focus,
    }));
    expect(state.sections).toHaveLength(1);
    expect(state.order).toHaveLength(1);
    expect(state.patterns).toHaveLength(1);
    expect(state.order[0].id).toBe(firstId);
    expect(state.order[0].sectionId).toBe(state.sections[0].id);
    expect(state.sections[0].name).toBe('Verse');
    expect(state.history.undoLabel).toBe('song.createAndAssignSection');
    expect(state.focus.orderEntryId).toBe(firstId);
    await expect(page.locator('[data-action="song-section"]')).toHaveCount(1);
    await expect(page.locator('[data-action="song-section"]').first()).toContainText('Verse');

    await page.keyboard.press('Control+z');
    state = await page.evaluate(() => ({
      sections: window.tracker.getProject().song.sections,
      order: window.tracker.getProject().song.order,
      patterns: window.tracker.getProject().song.patterns,
    }));
    expect(state.sections).toHaveLength(0);
    expect(state.order).toHaveLength(1);
    expect(state.order[0].sectionId).toBeNull();
    expect(state.patterns).toHaveLength(1);
  });

  test('dialog Tambah section mendukung reuse clone dan Pattern baru sebagai satu Undo', async ({ page }) => {
    await page.evaluate(() => {
      const first = window.tracker.getProject().song.order[0];
      window.tracker.commands.execute('song.createAndAssignSection', {
        name: 'Intro',
        orderEntryId: first.id,
      });
      window.tracker.commands.execute('focus.setOrderEntry', { orderEntryId: first.id });
    });

    const addSection = page.locator('[data-action="song-add-section"]');
    const dialog = page.locator('[data-action="song-section-dialog"]');
    const preset = page.locator('[data-action="song-section-preset"]');
    const name = page.locator('[data-action="song-section-name"]');
    const mode = page.locator('[data-action="song-section-pattern-mode"]');
    const create = page.locator('[data-action="song-section-create"]');

    await addSection.click();
    await expect(dialog).toBeVisible();
    await preset.selectOption('Verse');
    await expect(name).toHaveValue('Verse');
    await mode.selectOption('reuse');
    await create.click();

    let state = await page.evaluate(() => ({
      sections: window.tracker.getProject().song.sections,
      patterns: window.tracker.getProject().song.patterns,
      order: window.tracker.getProject().song.order,
      history: window.tracker.getState().history,
      focus: window.tracker.getState().focus,
    }));
    expect(state.sections).toHaveLength(2);
    expect(state.patterns).toHaveLength(1);
    expect(state.order).toHaveLength(2);
    expect(state.order[1].sectionId).toBe(state.sections[1].id);
    expect(state.order[1].patternId).toBe(state.order[0].patternId);
    expect(state.history.undoLabel).toBe('song.createSectionOccurrence');
    expect(state.focus.orderEntryId).toBe(state.order[1].id);

    await page.keyboard.press('Control+z');
    state = await page.evaluate(() => ({
      sections: window.tracker.getProject().song.sections.length,
      patterns: window.tracker.getProject().song.patterns.length,
      order: window.tracker.getProject().song.order.length,
    }));
    expect(state).toEqual({ sections: 1, patterns: 1, order: 1 });

    await addSection.click();
    await preset.selectOption('Chorus');
    await mode.selectOption('clone');
    await create.click();
    state = await page.evaluate(() => ({
      sections: window.tracker.getProject().song.sections,
      patterns: window.tracker.getProject().song.patterns,
      order: window.tracker.getProject().song.order,
    }));
    expect(state.sections).toHaveLength(2);
    expect(state.patterns).toHaveLength(2);
    expect(state.order[1].patternId).toBe(state.patterns[1].id);
    expect(state.patterns[1].notes.map(({ id, ...note }) => note))
      .toEqual(state.patterns[0].notes.map(({ id, ...note }) => note));

    await page.keyboard.press('Control+z');

    await addSection.click();
    await preset.selectOption('Bridge');
    await mode.selectOption('new');
    await create.click();
    state = await page.evaluate(() => ({
      sections: window.tracker.getProject().song.sections,
      patterns: window.tracker.getProject().song.patterns,
      order: window.tracker.getProject().song.order,
    }));
    expect(state.sections[1].name).toBe('Bridge');
    expect(state.patterns).toHaveLength(2);
    expect(state.patterns[1].notes).toHaveLength(0);
    expect(state.order[1].patternId).toBe(state.patterns[1].id);
    await expect(page.locator('[data-action="workspace-view"]')).toHaveAttribute('data-entity', 'song');
  });

  test('Section mengelompokkan Song Map tanpa mengubah urutan Order dan dapat di-Undo', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const project = window.tracker.getProject();
      const firstOrderId = project.song.order[0].id;
      const second = window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: firstOrderId,
      });
      const third = window.tracker.commands.execute('song.reuseOrderEntry', {
        orderEntryId: second.orderEntryId,
      });
      const verse = window.tracker.commands.execute('song.addSection', {
        name: 'Verse',
        color: '#2563EB',
      });
      const chorus = window.tracker.commands.execute('song.addSection', {
        name: 'Chorus',
        color: '#7C3AED',
      });
      window.tracker.commands.execute('song.assignSection', {
        orderEntryId: firstOrderId,
        sectionId: verse.id,
      });
      window.tracker.commands.execute('song.assignSection', {
        orderEntryId: second.orderEntryId,
        sectionId: verse.id,
      });
      window.tracker.commands.execute('song.assignSection', {
        orderEntryId: third.orderEntryId,
        sectionId: chorus.id,
      });
      return {
        orderIds: window.tracker.getProject().song.order.map((entry) => entry.id),
        secondOrderId: second.orderEntryId,
        verseId: verse.id,
        chorusId: chorus.id,
      };
    });

    const sections = page.locator('[data-action="song-section"]');
    await expect(sections).toHaveCount(2);
    await expect(sections.nth(0)).toContainText('Verse');
    await expect(sections.nth(1)).toContainText('Chorus');

    const mapIds = await entries(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.entity));
    expect(mapIds).toEqual(ids.orderIds);

    await page.locator('[data-action="song-view-order"]').click();
    const listIds = await entries(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.entity));
    expect(listIds).toEqual(ids.orderIds);
    await expect(entries(page).nth(0)).toContainText('Verse');
    await expect(entries(page).nth(2)).toContainText('Chorus');

    await page.keyboard.press('Control+z');
    expect(await page.evaluate((orderEntryId) => {
      const entry = window.tracker.getProject().song.order.find((item) => item.id === orderEntryId);
      return entry.sectionId;
    }, ids.orderIds[2])).toBeNull();
  });

  test('T5 regression: project kosong menjadi tepat Verse–Chorus–Verse tiga tempat', async ({ page }) => {
    const addSection = page.locator('[data-action="song-add-section"]');
    const preset = page.locator('[data-action="song-section-preset"]');
    const create = page.locator('[data-action="song-section-create"]');

    await addSection.click();
    await preset.selectOption('Verse');
    await create.click();

    await addSection.click();
    await preset.selectOption('Chorus');
    await create.click();

    await addSection.click();
    await preset.selectOption('Verse');
    await create.click();

    const state = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        order: project.song.order.map((entry) => entry.id),
        patterns: project.song.patterns.map((pattern) => pattern.id),
        sections: project.song.order.map((entry) => (
          project.song.sections.find((section) => section.id === entry.sectionId)?.name ?? null
        )),
      };
    });

    expect(state.order).toHaveLength(3);
    expect(state.patterns).toHaveLength(1);
    expect(state.sections).toEqual(['Verse', 'Chorus', 'Verse']);
    await expect(page.locator('[data-action="song-section"]')).toHaveCount(3);
    await expect(page.locator('[data-action="song-summary"]')).toContainText('3 tempat');
  });

  test('palette membedakan command Section teknis dan memberi arahan Song Map', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[data-action="palette-input"]');
    await input.fill('section');

    const occurrence = page.locator(
      '[data-action="palette-item"][data-entity="song.createSectionOccurrence"]',
    );
    const definition = page.locator(
      '[data-action="palette-item"][data-entity="song.addSection"]',
    );
    const assign = page.locator(
      '[data-action="palette-item"][data-entity="song.assignSection"]',
    );

    await expect(occurrence).toContainText('Tambah tempat ber-section');
    await expect(definition).toContainText('Buat definisi section');
    await expect(assign).toContainText('Atur section');
    const guidance = page.locator('[data-action="palette-guidance"]');
    await expect(guidance).toHaveCount(1);
    await expect(guidance).toContainText('Gunakan kontrol Tambah section di Song Map');
    const guidanceId = await guidance.getAttribute('id');
    for (const row of [occurrence, definition, assign]) {
      await expect(row).toHaveAttribute('aria-describedby', guidanceId);
      await expect(row.locator('.palette__reason')).toHaveCount(0);
    }
  });

  test('Palette section tetap terbaca pada viewport sempit tanpa label pecah per kata', async ({ page }) => {
    await page.setViewportSize({ width: 739, height: 643 });
    await page.keyboard.press('Control+k');
    await page.locator('[data-action="palette-input"]').fill('section');

    const row = page.locator('[data-action="palette-item"][data-entity="song.createSectionOccurrence"]');
    const label = row.locator('.palette__label');
    const metrics = await label.evaluate((node) => ({
      width: node.getBoundingClientRect().width,
      wordBreak: getComputedStyle(node).wordBreak,
    }));
    expect(metrics.width).toBeGreaterThan(180);
    expect(metrics.wordBreak).not.toBe('break-all');
    await expect(page.locator('[data-action="palette-guidance"]')).toHaveCount(1);
    expect(await page.locator('[data-action="palette"]').evaluate(
      (node) => node.scrollWidth <= node.clientWidth + 1,
    )).toBe(true);
  });

  test('Ctrl+D reuse lalu Ctrl+Shift+D membuat occurrence target unik', async ({ page }) => {
    const first = entries(page).first();
    await first.click();
    await first.press('Control+d');

    await expect(entries(page)).toHaveCount(2);
    let state = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        order: project.song.order.map((entry) => ({ id: entry.id, patternId: entry.patternId })),
        patterns: project.song.patterns.map((pattern) => pattern.id),
        history: window.tracker.getState().history,
      };
    });

    expect(state.order).toHaveLength(2);
    expect(state.patterns).toHaveLength(1);
    expect(state.order[0].patternId).toBe(state.order[1].patternId);
    expect(state.history.undoLabel).toBe('song.reuseOrderEntry');

    await expect(entries(page).nth(1)).toHaveAttribute('aria-current', 'true');
    await entries(page).nth(1).press('Control+Shift+d');

    state = await page.evaluate(() => {
      const project = window.tracker.getProject();
      return {
        order: project.song.order.map((entry) => ({ id: entry.id, patternId: entry.patternId })),
        patterns: project.song.patterns.map((pattern) => pattern.id),
        history: window.tracker.getState().history,
      };
    });

    expect(state.patterns).toHaveLength(2);
    expect(state.order[0].patternId).not.toBe(state.order[1].patternId);
    expect(state.history.undoLabel).toBe('song.makeOrderUnique');
    await expect(entries(page).nth(0)).not.toContainText('×2');
    await expect(entries(page).nth(1)).not.toContainText('×2');

    // Pastikan Undo tetap satu gestur untuk "Jadikan unik".
    await page.keyboard.press('Control+z');
    expect((await page.evaluate(() => window.tracker.getProject().song.patterns.length))).toBe(1);
    expect((await page.evaluate(() => window.tracker.getProject().song.order.length))).toBe(2);
  });

  test('Alt+Arrow memindahkan occurrence dan Map/List tetap satu urutan', async ({ page }) => {
    await entries(page).first().click();
    await entries(page).first().press('Control+d');

    const before = await page.evaluate(() =>
      window.tracker.getProject().song.order.map((entry) => entry.id));
    expect(before).toHaveLength(2);

    await entries(page).nth(1).press('Alt+ArrowUp');

    const moved = await page.evaluate(() =>
      window.tracker.getProject().song.order.map((entry) => entry.id));
    expect(moved).toEqual([before[1], before[0]]);

    const mapIds = await entries(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.entity));
    expect(mapIds).toEqual(moved);

    await page.locator('[data-action="song-view-order"]').click();
    const listIds = await entries(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.entity));
    expect(listIds).toEqual(moved);
  });
});
