// Gate `npm run check` (§16.1). Sengaja tanpa dependency: yang dicek cuma hal yang
// bisa salah diam-diam dan mahal diperbaiki nanti — syntax, sisa console.log, path absolut.

import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// tools/ dilewati: itu perkakas CLI yang memang boleh mencetak ke stdout.
// Yang kita jaga tetap runtime yang dikirim ke browser.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'vendor', 'tools']);

// Dirangkai dari potongan biar file ini sendiri nggak kena deteksi oleh polanya sendiri.
const LEFTOVER_MARKERS = ['TO' + 'DO', 'FIX' + 'ME'];

async function jsFiles(dir = ROOT) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...(await jsFiles(join(dir, entry.name))));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

async function main() {
  const problems = [];
  for (const file of await jsFiles()) {
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
    const source = await readFile(file, 'utf8');
    const lines = source.split('\n');

    try {
      await execFileAsync(process.execPath, ['--check', file]);
    } catch (error) {
      const detail = String(error?.stderr ?? error?.message ?? 'syntax invalid')
        .split('\n')
        .find((line) => line.trim().length > 0);
      problems.push(`${rel}: syntax invalid${detail ? ` — ${detail.trim()}` : ''}`);
      continue;
    }

    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/\bconsole\.(log|debug|info)\s*\(/.test(code)) {
        problems.push(`${rel}:${i + 1} console.log sisa`);
      }
      // Path absolut bakal bikin 404 begitu di-host di /<repo>/ (§3.3).
      if (/(?:src|href)\s*=\s*["']\/(?!\/)/.test(code)) {
        problems.push(`${rel}:${i + 1} path absolut, harus relatif`);
      }
      if (LEFTOVER_MARKERS.some((marker) => code.includes(marker))) {
        problems.push(`${rel}:${i + 1} sisa TODO/FIXME — tidak boleh jadi syarat acceptance`);
      }
    });
  }

  const index = join(ROOT, 'index.html');
  const html = await readFile(index, 'utf8');
  if (!/Content-Security-Policy/.test(html)) {
    problems.push('index.html: meta CSP tidak ada (§3.4)');
  }

  if (problems.length > 0) {
    console.error('check gagal:');
    for (const p of problems) console.error('  -', p);
    process.exit(1);
  }
  console.log('check ok');
}

await main();