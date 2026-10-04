import { expect } from '@playwright/test';

// page.waitForFunction() menyuntikkan polling via requestAnimationFrame yang
// ketahan oleh CSP `script-src 'self'` di Firefox. Menunggu lewat locator
// Playwright jauh lebih baik: tanpa eval sama sekali, jadi aman di Pages live
// yang CSP-nya sama persis dengan build lokal.
export async function waitForApp(page) {
  await expect(page.locator('[data-action="topbar"]')).toBeVisible();
  await expect(page.locator('[data-action="statusbar"]')).toBeVisible();
}

export async function gotoApp(page) {
  await page.goto('./');
  await waitForApp(page);
}