import { defineConfig, devices } from '@playwright/test';

// Tes browser selalu melawan ARTEFAK build di subpath, bukan source tree (§13.3).
// Default-nya nama repo asli supaya kondisi lokal = kondisi Pages. Di CI, BASE_PATH
// di-override dari github.event.repository.name oleh workflow, jadi rename repo
// tidak diam-diam menguji subpath yang salah.
const BASE_PATH = process.env.BASE_PATH ?? '/nota-station/';
const PORT = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Default 30 detik kadang habis untuk page.reload() di Firefox saat mesin
  // sedang paralel penuh. Timeout dinaikkan, bukan assertion yang dilonggarkan.
  timeout: 60_000,
  // Worker dibatasi supaya tidak saling berebut CPU: beberapa tes memang
  // navigate + reload, dan tabrakan di situ muncul sebagai timeout palsu.
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tools/serve.mjs',
    env: { PORT: String(PORT), BASE_PATH },
    url: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});