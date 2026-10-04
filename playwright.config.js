import { defineConfig, devices } from '@playwright/test';

// Tes browser selalu melawan ARTEFAK build di subpath, bukan source tree (§13.3).
// BASE_PATH default "/notastation/" supaya condition-nya sama dengan Pages.
const BASE_PATH = process.env.BASE_PATH ?? '/notastation/';
const PORT = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
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