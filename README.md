# NotaStation

Web Tracker Songwriting Workstation — static site untuk GitHub Pages.
Seluruh aplikasi berdiri di atas satu model musik kanonik, lalu diproyeksikan ke beberapa
tampilan sekaligus (Pattern, Piano Roll, Lyrics, Guitar, Score).

Status: **R0 — Fondasi statis + UI shell** (dalam pengerjaan).

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
npm run build && node tools/serve.mjs   # http://127.0.0.1:8080/notastation/
```

`BASE_PATH` dan `PORT` bisa diubah lewat env.

## Aturan kerja

Baca [`AGENTS.md`](./AGENTS.md) — aturan kerja & coding, termasuk aturan komentar
kode berbahasa Indonesia.

Spesifikasi ada di [`rencana-web-tracker-songwriting-workstation-v2.md`](./rencana-web-tracker-songwriting-workstation-v2.md)
(disingkat **PLAN.md** di dokumen aturan).

## Lisensi

[MIT](./LICENSE). Lisensi sample factory ditentukan terpisah di R2.