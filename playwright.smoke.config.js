import { defineConfig, devices } from '@playwright/test';

// Smoke test kena URL live, bukan server lokal — itu bedanya dengan test:browser (§13.4).
const PAGE_URL = process.env.PAGE_URL;
const EXPECT_SHA = process.env.EXPECT_SHA;

if (!PAGE_URL) {
  throw new Error('PAGE_URL wajib diisi — smoke test hanya jalan terhadap build yang live.');
}

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 2,
  // Give Pages a moment to propagate the deployment before we hammer it.
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: PAGE_URL.endsWith('/') ? PAGE_URL : `${PAGE_URL}/`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  metadata: { EXPECT_SHA: EXPECT_SHA ?? null },
});