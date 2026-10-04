import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validateRelativeImports } from '../../tools/build.mjs';

async function scratchProject(files) {
  const dir = await mkdtemp(join(tmpdir(), 'notastation-build-'));
  for (const [relPath, content] of Object.entries(files)) {
    const abs = join(dir, relPath);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content, 'utf8');
  }
  return dir;
}

test('import relatif yang resolve dianggap bersih', async () => {
  const dir = await scratchProject({
    'src/a.js': "import { b } from './b.js';\nexport const a = b;\n",
    'src/b.js': 'export const b = 1;\n',
  });
  try {
    assert.deepEqual(await validateRelativeImports(dir), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('import relatif ke file yang hilang dilaporkan', async () => {
  const dir = await scratchProject({
    'src/a.js': "import { b } from './hilang.js';\n",
  });
  try {
    const problems = await validateRelativeImports(dir);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /src\/a\.js.*hilang\.js/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('import dari CDN atau paket npm ditolak untuk static site (§3.2)', async () => {
  const dir = await scratchProject({
    'src/cdn.js': "import 'https://cdn.example.com/lib.js';\n",
    'src/npm.js': "import { zip } from 'fflate';\n",
    'src/ok.js': "import { x } from '../src/ok.js';\n",
  });
  try {
    const problems = await validateRelativeImports(dir);
    assert.equal(problems.length, 2, `dapat: ${JSON.stringify(problems)}`);
    assert.match(problems.join('\n'), /cdn\.example\.com/);
    assert.match(problems.join('\n'), /fflate/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('dynamic import relatif ikut divalidasi', async () => {
  const dir = await scratchProject({
    'src/a.js': "export async function load() { const m = await import('./worker/hilang.js'); return m; }\n",
  });
  try {
    const problems = await validateRelativeImports(dir);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /worker\/hilang\.js/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('node_modules dan dist tidak ikut disisir', async () => {
  const dir = await scratchProject({
    'src/ok.js': 'export const ok = 1;\n',
    'node_modules/pkg/index.js': "import 'https://cdn.example.com/x.js';\n",
    'dist/src/copy.js': "import 'react';\n",
  });
  try {
    assert.deepEqual(await validateRelativeImports(dir), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});