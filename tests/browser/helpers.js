import { expect } from '@playwright/test';

// page.waitForFunction() menyuntikkan polling via requestAnimationFrame yang
// ketahan oleh CSP `script-src 'self'` di Firefox. Menunggu lewat locator
// Playwright jauh lebih baik: tanpa eval sama sekali, jadi aman di Pages live
// yang CSP-nya sama persis dengan build lokal.
export async function waitForApp(page) {
  await expect(page.locator('[data-action="topbar"]')).toBeVisible();
  await expect(page.locator('[data-action="statusbar"]')).toBeVisible();
}

export async function gotoApp(page, { firstRun = false } = {}) {
  if (firstRun) {
    await page.goto('./');
    await page.evaluate(() => {
      localStorage.removeItem('notastation.welcome.completed');
      localStorage.removeItem('notastation.keymapPreset');
    });
    await page.reload();
  } else {
    await page.addInitScript(() => {
      localStorage.setItem('notastation.welcome.completed', '1');
    });
    await page.goto('./');
  }
  await waitForApp(page);
}