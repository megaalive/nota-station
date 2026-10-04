// Server statis kecil buat Playwright. Sengaja tanpa dependency: yang perlu cuma
// menyajikan dist/ di subpath BASE_PATH supaya tes_close sama kondisi Pages (§13.3).

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export function startServer({ basePath = '/nota-station/', dir = join(ROOT, 'dist'), port = 0 } = {}) {
  // Normalisasi supaya basePath selalu "/repo/" dan cocok dengan URL Pages.
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    if (!pathname.startsWith(prefix)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('di luar base path');
      return;
    }
    let rel = pathname.slice(prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';

    // Cegah path traversal: hasil normalize harus tetap di dalam dir.
    const target = normalize(join(dir, rel));
    if (!target.startsWith(dir)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('ditolak');
      return;
    }

    try {
      const info = await stat(target);
      if (!info.isFile()) throw new Error('bukan file');
      res.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('tidak ditemukan');
    }
  });

  return new Promise((resolvePromise) => {
    server.listen(port, () => {
      const { port: actual } = server.address();
      resolvePromise({
        baseUrl: `http://127.0.0.1:${actual}${prefix}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

// Dipakai CI smoke: jalankan sebagai proses panjang.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const port = Number(process.env.PORT ?? 8080);
  const basePath = process.env.BASE_PATH ?? '/nota-station/';
  const { baseUrl } = await startServer({ port, basePath });
  console.log(`serving dist/ di ${baseUrl}`);
}