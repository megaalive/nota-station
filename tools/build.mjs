// Build statis (§13.2): bukan bundler, cuma "assembling" — bersihkan dist, salin runtime,
// cap SHA/versi, validasi import relatif, buat .nojekyll.

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Yang boleh ikut ke build. Daftar eksplisit, bukan "salin semua" — biar
// file ngawur (tes, konfigurasi editor) nggak ikut ter-deploy.
const COPY_DIRS = ['src', 'styles', 'assets', 'vendor'];
const COPY_FILES = ['index.html'];

async function gitSha() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: ROOT });
    return stdout.trim();
  } catch {
    // Di CI tanpa .git (artifact download) kita tetap bisa deploy, cuma tanpa SHA.
    return 'unknown';
  }
}

/** Semua import harus relatif danresolved. Ini yang cegah Pages 404 di subpath (§3.3). */
export async function validateRelativeImports(dir = ROOT, rel = '') {
  const problems = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'tests', 'tools'].includes(entry.name)) continue;
      problems.push(...(await validateRelativeImports(abs, relPath)));
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    // File config root (playwright.config.js dsb) adalah perkakas dev, bukan runtime,
    // jadi import bare dari npm di sana memang wajar.
    if (entry.name.endsWith('.config.js')) continue;
    const source = await readFile(abs, 'utf8');
    const specifiers = [
      // import ... from '...' dan export ... from '...'
      ...[...source.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
      // side-effect import: import '...'  (CDN sering disembunyikan di sini)
      ...[...source.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
      // dynamic import('...')
      ...[...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ];
    for (const spec of specifiers) {
      if (spec.startsWith('./') || spec.startsWith('../')) {
        const target = resolve(dirname(abs), spec);
        try {
          await stat(target);
        } catch {
          problems.push(`${relPath}: import relatif tidak ketemu -> ${spec}`);
        }
      } else if (!spec.startsWith('node:') && spec !== 'data:text/javascript') {
        // Bare specifier berarti ada dependency runtime — dilarang di static site (§3.2).
        problems.push(`${relPath}: import non-relatif "${spec}" (kalau bukan dependency yang di-vendor)`);
      }
    }
  }
  return problems;
}

async function main() {
  const problems = await validateRelativeImports();
  if (problems.length > 0) {
    console.error('Build gagal — import tidak valid:');
    for (const p of problems) console.error('  -', p);
    process.exit(1);
  }

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  for (const file of COPY_FILES) {
    try {
      await stat(join(ROOT, file));
      await cp(join(ROOT, file), join(DIST, file));
    } catch {
      // File opsional belum dibuat pada milestone ini — lewati, bukan gagalkan build.
    }
  }
  for (const dir of COPY_DIRS) {
    try {
      await cp(join(ROOT, dir), join(DIST, dir), { recursive: true });
    } catch {
      // Folder belum ada belum juga error.
    }
  }

  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const build = { version: pkg.version, sha: await gitSha() };
  await writeFile(join(DIST, 'build.json'), `${JSON.stringify(build, null, 2)}\n`);

  // .nojekyll biar folder berawalan underscore/kapital nggak diabaikan Jekyll.
  await writeFile(join(DIST, '.nojekyll'), '');

  const total = await dirSize(DIST);
  console.log(`build ok -> dist/ (${(total / 1024).toFixed(1)} KiB, sha ${build.sha.slice(0, 7)})`);
}

async function dirSize(dir) {
  let sum = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) sum += await dirSize(abs);
    else sum += (await stat(abs)).size;
  }
  return sum;
}

// Dipakai juga oleh tests/unit/build.test.js, jadi jalan sebagai modul atau CLI.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}