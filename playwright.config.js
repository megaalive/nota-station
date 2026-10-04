import { defineConfig, devices } from '@playwright/test';

// Tes browser selalu melawan ARTEFAK build di subpath, bukan source tree (§13.3).
// Default-nya nama repo asli supaya kondisi lokal = kondisi Pages. BASE_PATH tetap
// bisa di-override oleh pemanggil bila repo di-rename atau suite dijalankan di lingkungan lain.
const BASE_PATH = process.env.BASE_PATH ?? '/nota-station/';
const PORT = Number(process.env.PORT ?? 4173);

const ALL_PROJECTS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
];

// PW_PROJECTS=chromium menjalankan satu browser saja. Dipakai untuk mengisolasi
// browser yang lambat tanpa mengubah isi tes — bukan untuk menghilangkan cakupan
// (§16.3 tetap minta Chromium + Firefox di gate penuh).
const wanted = (process.env.PW_PROJECTS ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const projects = wanted.length > 0 ? ALL_PROJECTS.filter((p) => wanted.includes(p.name)) : ALL_PROJECTS;

// Reporter 'list' mencetak satu baris per tes secara streaming, jadi dari timestamp
// log GitHub bisa dilihat tes mana yang lambat. Reporter 'github' sengaja diam per
// tes, jadi tidak bisa dipakai untuk diagnosa.
const reporter = process.env.PW_REPORTER ?? (process.env.CI ? 'github' : 'list');

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
  reporter,
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
  projects,
});