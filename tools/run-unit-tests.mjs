// Runner unit test.
//
// Kenapa tidak `node --test tests/unit` atau glob? Karena keduanya rapuh lintas
// environment: Node 20 tidak bisa ekspansi glob di --test (Node 22+ bisa), dan
// npm di Windows menjalankan script lewat cmd.exe yang juga tidak ekspansi glob.
// Runner iniisoryat daftar file secara eksplisit lalu meneruskannya ke `node --test`,
// jadi perilakunya sama di Linux CI dan Windows lokal.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIR = join(ROOT, 'tests', 'unit');

const files = (await readdir(TEST_DIR))
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => join('tests', 'unit', name));

if (files.length === 0) {
  console.error(`Tidak ada file .test.js di ${TEST_DIR}`);
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], { cwd: ROOT, stdio: 'inherit' });
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});