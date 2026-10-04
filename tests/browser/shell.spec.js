import { test, expect } from '@playwright/test';

import { gotoApp } from './helpers.js';

/**
 * Shell §8.3 + UI kit (§3.2). Fokus tes ini pada yang bisa diuji tanpa milestone
 * berikutnya: struktur, tab, panel tersimpan, palette, dan perilaku keyboard.
 */
test.describe('shell layout §8.3', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('top bar, tab workspace, panel, dock, dan status bar semuanya ada', async ({ page }) => {
    await expect(page.locator('[data-action="topbar"]')).toBeVisible();
    await expect(page.locator('[data-action="workspace-tabs"]')).toBeVisible();
    await expect(page.locator('[data-action="panel-left"]')).toBeVisible();
    await expect(page.locator('[data-action="workspace-view"]')).toBeVisible();
    await expect(page.locator('[data-action="panel-right"]')).toBeVisible();
    await expect(page.locator('[data-action="dock"]')).toBeAttached();
    await expect(page.locator('[data-action="statusbar"]')).toBeVisible();
  });

  test('tujuh tab workspace ada dan Pattern aktif default', async ({ page }) => {
    const tabs = page.locator('[data-action="workspace-tab"]');
    await expect(tabs).toHaveCount(7);
    await expect(page.locator('[data-action="workspace-tab"][data-entity="pattern"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('build id terbaca di UI, bukan cuma di state', async ({ page }) => {
    const sha = await page.evaluate(() => window.tracker.getState().build.sha);
    await expect(page.locator('[data-action="build-id"]')).toHaveText(sha.slice(0, 7));
  });

  test('toolbar memakai ikon ringkas tanpa kehilangan nama aksesibel', async ({ page }) => {
    const topbar = page.locator('[data-action="topbar"]');
    const play = topbar.getByRole('button', { name: 'Putar' });
    const stop = topbar.getByRole('button', { name: 'Berhenti' });
    const palette = topbar.getByRole('button', { name: 'Palet perintah' });

    await expect(play).toHaveClass(/btn--icon-only/);
    await expect(stop).toHaveClass(/btn--icon-only/);
    await expect(palette).toHaveClass(/btn--icon-only/);
    await expect(play).toHaveText('▶');
    await expect(stop).toHaveText('■');
    await expect(palette).toHaveText('⌕');

    await palette.focus();
    const describedBy = await palette.getAttribute('aria-describedby');
    await expect(page.locator(`#${describedBy}`)).toContainText('Ctrl+K');
  });

  test('tab berganti hanya lewat aksi eksplisit (klik atau Alt+digit)', async ({ page }) => {
    await page.locator('[data-action="workspace-tab"][data-entity="sound"]').click();
    await expect(page.locator('[data-action="workspace-view"]')).toHaveAttribute('data-entity', 'sound');

    await page.keyboard.press('Alt+3');
    await expect(page.locator('[data-action="workspace-view"]')).toHaveAttribute('data-entity', 'pianoRoll');
  });

  test('dock terlipat default dan bisa dibuka', async ({ page }) => {
    const dock = page.locator('[data-action="dock"]');
    await expect(page.locator('[data-action="dock-toggle"]')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('[data-action="dock-toggle"]').click();
    await expect(page.locator('[data-action="dock-toggle"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(dock).toHaveClass(/is-open/);
  });

  test('ukuran panel tersimpan di localStorage dan dipulihkan setelah reload', async ({ page }) => {
    const splitter = page.locator('[data-action="splitter"]').first();
    const before = await splitter.getAttribute('aria-valuenow');

    await splitter.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const after = await splitter.getAttribute('aria-valuenow');
    expect(Number(after)).toBeGreaterThan(Number(before));

    const saved = await page.evaluate(() => window.localStorage.getItem('notastation.panel.left'));
    expect(saved).not.toBeNull();

    await page.reload();
    await gotoApp(page);
    const restored = await page.locator('[data-action="splitter"]').first().getAttribute('aria-valuenow');
    expect(restored).toBe(after);
  });

  test('splitter punya aria separator dan bisa diubah dengan keyboard', async ({ page }) => {
    const splitter = page.locator('[data-action="splitter"]').first();
    await expect(splitter).toHaveAttribute('role', 'separator');
    await expect(splitter).toHaveAttribute('aria-valuenow', /\d+/);
    await expect(splitter).toHaveAttribute('aria-valuemin', /\d+/);
    await expect(splitter).toHaveAttribute('aria-valuemax', /\d+/);

    const start = Number(await splitter.getAttribute('aria-valuenow'));
    await splitter.focus();
    await page.keyboard.press('Home');
    await expect(splitter).toHaveAttribute('aria-valuenow', await splitter.getAttribute('aria-valuemin'));
    await page.keyboard.press('End');
    expect(Number(await splitter.getAttribute('aria-valuenow'))).toBeGreaterThan(start);
  });

  test('wrapper splitter benar-benar menyusun panel dan handle secara horizontal', async ({ page }) => {
    const left = page.locator('.splitter-layout--left');
    const right = page.locator('.splitter-layout--right');

    await expect(left).toHaveCSS('display', 'flex');
    await expect(right).toHaveCSS('display', 'flex');
    await expect(right).toHaveCSS('flex-direction', 'row-reverse');
  });

  test('panel kiri dan kanan bisa dilipat, dipakai lewat keyboard, dan statusnya tersimpan', async ({ page }) => {
    const leftPanel = page.locator('[data-action="panel-left"]');
    const leftToggle = page.locator('[data-action="panel-left-toggle"]');
    const rightPanel = page.locator('[data-action="panel-right"]');
    const rightToggle = page.locator('[data-action="panel-right-toggle"]');

    await expect(leftToggle).toHaveAttribute('aria-expanded', 'true');
    await leftToggle.focus();
    await page.keyboard.press('Enter');
    await expect(leftPanel).toHaveClass(/is-collapsed/);
    await expect(leftToggle).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => localStorage.getItem('notastation.panel.left.collapsed'))).toBe('1');

    await rightToggle.click();
    await expect(rightPanel).toHaveClass(/is-collapsed/);

    await page.reload();
    await gotoApp(page);
    await expect(page.locator('[data-action="panel-left"]')).toHaveClass(/is-collapsed/);
    await expect(page.locator('[data-action="panel-right"]')).toHaveClass(/is-collapsed/);
  });

  test('tema terang, gelap, dan kontras tinggi berganti lewat command layer dan tersimpan', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => window.tracker.getState().theme)).toBe('light');

    expect(await page.evaluate(() => window.tracker.commands.execute('ui.cycleTheme'))).toBe('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await gotoApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => window.tracker.commands.execute('ui.cycleTheme'))).toBe('high-contrast');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast');
  });
});

test.describe('Command Palette §8.14', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('Ctrl+K membuka palette dan Escape menutupnya', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-action="palette"]')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-action="palette"]')).toHaveCount(0);
  });

  test('palette menampilkan perintah dari listCommands, bukan daftar terpisah', async ({ page }) => {
    const commandIds = await page.evaluate(() =>
      window.tracker.commands.listCommands().map((c) => c.id),
    );
    await page.keyboard.press('Control+k');

    const rows = page.locator('[data-action="palette-item"]');
    await expect(rows).toHaveCount(commandIds.length);
    for (const id of commandIds) {
      await expect(page.locator(`[data-action="palette-item"][data-entity="${id}"]`)).toBeVisible();
    }
  });

  test('pencarian menyaring dan Enter menjalankan perintah', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.locator('[data-action="palette-input"]').fill('pattern');

    const rows = page.locator('[data-action="palette-item"]');
    expect(await rows.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('[data-action="palette-item"][data-entity="ui.showPattern"]')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-action="palette"]')).toHaveCount(0);
    await expect(page.locator('[data-action="workspace-view"]')).toHaveAttribute('data-entity', 'pattern');
  });

  test('perintah nonaktif tampil dengan alasan, dan Enter tidak menutup palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.locator('[data-action="palette-input"]').fill('export');
    const row = page.locator('[data-action="palette-item"][data-entity="io.exportWav"]');
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/is-disabled/);

    await page.keyboard.press('Enter');
    // Tetap terbuka supaya user bisa baca kenapa tidak bisa dipakai.
    await expect(page.locator('[data-action="palette"]')).toBeVisible();
  });

  test('ArrowDown/ArrowUp memindahkan sorotan dan Esc menutup dari mana saja', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[data-action="palette-input"]');
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-activedescendant', /palette-option-/);

    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'palette-option-1');

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-action="palette"]')).toHaveCount(0);
  });
});

test.describe('keyboard & focus', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('Tab menjangkau kontrol shell dan fokus selalu terlihat', async ({ page }) => {
    const reached = [];
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const node = document.activeElement;
        if (!node || node === document.body) return null;
        const style = getComputedStyle(node);
        return {
          tag: node.tagName.toLowerCase(),
          action: node.dataset?.action ?? '',
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
        };
      });
      if (info) reached.push(info);
    }

    const focusable = reached.filter((r) => ['button', 'input', 'a'].includes(r.tag));
    expect(focusable.length).toBeGreaterThan(5);
    // Fokus yang terlihat bukan sekadar "ada outline" — harus tebal nyata.
    const visible = focusable.filter((r) => parseFloat(r.outlineWidth) >= 2 && r.outlineStyle !== 'none');
    expect(visible.length).toBe(focusable.length);
  });

  test('semua tab workspace punya tabindex roving: hanya satu yang 0', async ({ page }) => {
    const tabindexes = await page.$$eval('[data-action="workspace-tab"]', (nodes) =>
      nodes.map((n) => n.getAttribute('tabindex')),
    );
    expect(tabindexes.filter((t) => t === '0')).toHaveLength(1);
    expect(tabindexes.filter((t) => t === '-1')).toHaveLength(6);
  });

  test('Tab tidak pernah keluar dari palette selagi terbuka (focus trap)', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-action="palette"]')).toBeVisible();

    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[data-action="palette"]')));
      expect(inside).toBe(true);
    }
  });

  test('status bar dan mode edit punya teks, bukan hanya warna', async ({ page }) => {
    await expect(page.locator('[data-action="edit-mode"]')).toHaveText(/EDIT/);
    await expect(page.locator('[data-action="statusbar"]')).toBeVisible();
  });
});