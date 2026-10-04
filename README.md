# NotaStation

Web Tracker Songwriting Workstation — static site untuk GitHub Pages.
Seluruh aplikasi berdiri di atas satu model musik kanonik, lalu diproyeksikan ke beberapa
tampilan sekaligus (Pattern, Piano Roll, Lyrics, Guitar, Score).

Status: **R0 — Fondasi statis + UI shell: CLOSED**. Gate unit/check/build dan
Playwright Chromium+Firefox sudah lulus; deployment tetap manual ke branch `gh-pages`.
Milestone berikutnya: **R1 — Tracker yang bisa dimainkan**.

## Menjalankan

```bash
npm install
npm test           # unit test (node:test, tanpa dependency)
npm run check      # gate ringan: syntax, console.log sisa, path absolut, meta CSP
npm run build      # rakit dist/
npm run test:browser   # Playwright Chromium + Firefox, menguji dist/ di subpath
```

Untuk lihat hasilnya di browser:

```bash
npm run build && node tools/serve.mjs   # http://127.0.0.1:8080/nota-station/
```

`BASE_PATH` dan `PORT` bisa diubah lewat env.

Smoke test hanya jalan terhadap URL yang benar-benar hidup, jadi wajib diberi `PAGE_URL`:

```bash
PAGE_URL="https://<user>.github.io/nota-station/" EXPECT_SHA="$(git rev-parse HEAD)" npm run test:smoke
```

Deployment Pages tidak memakai GitHub Actions. Jalankan gate lokal yang relevan, lalu:

```bash
npm run deploy
```

Perintah itu selalu menjalankan build terlebih dahulu, kemudian force-push isi `dist/`
ke branch artifact `gh-pages`. Source tetap di `main`; `gh-pages` bukan history source.

## Aturan kerja

Baca [`AGENTS.md`](./AGENTS.md) — aturan kerja & coding, termasuk aturan komentar
kode berbahasa Indonesia.

Spesifikasi ada di [`rencana-web-tracker-songwriting-workstation-v2.md`](./rencana-web-tracker-songwriting-workstation-v2.md)
(disingkat **PLAN.md** di dokumen aturan).

## Lisensi

[MIT](./LICENSE). Lisensi sample factory ditentukan terpisah di R2.