// Deploy manual ke GitHub Pages.
//
// Alurnya: build dist/ secara lokal, lalu commit isinya ke branch `gh-pages`.
// Pages dikonfigurasi mode "legacy" dengan source branch gh-pages, jadi situs
// menyajikan persis isi dist/ ini — tanpa GitHub Actions sama sekali.
//
// Dipakai karena tes browser di runner GitHub jauh lebih lambat dari lokal tanpa
// penyebab yang diketahui, dan deploy tidak boleh tertahan olehnya.

import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH = 'gh-pages';

function git(args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('exit', (code) =>
      code === 0 ? resolvePromise(out.trim()) : reject(new Error(`git ${args.join(' ')} gagal:\n${err}`)),
    );
  });
}

async function main() {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const sha = (await git(['rev-parse', 'HEAD'], ROOT)).slice(0, 7);
  // URL remote diambil dari repo ini, bukan ditulis manual, supaya tidak diam-diam
  // deploy ke repo yang salah kalau repo-nya di-rename.
  const remoteUrl = await git(['remote', 'get-url', 'origin'], ROOT);

  console.log(`Build dist/ lalu deploy ke branch ${BRANCH} (commit ${sha}, v${pkg.version})`);

  // Repo sementara supaya worktree utama tidak perlu di-stash dan tidak pernah
  // berubah isi. Isinya hanya dist/, jadi branch gh-pages berisi file statis saja.
  const staging = await mkdtemp(join(tmpdir(), 'notastation-deploy-'));
  try {
    await git(['init', '--quiet', '--initial-branch', BRANCH], staging);
    await git(['config', 'user.name', 'notastation-deploy'], staging);
    await git(['config', 'user.email', 'deploy@notastation.local'], staging);
    await cp(join(ROOT, 'dist'), staging, { recursive: true });
    // .nojekyll supaya folder/berawalan kapital tidak diabaikan Jekyll.
    await writeFile(join(staging, '.nojekyll'), '', 'utf8');

    await git(['add', '-A'], staging);
    await git(['commit', '--quiet', '-m', `Deploy ${sha} (v${pkg.version})`], staging);
    await git(['remote', 'add', 'origin', remoteUrl], staging);
    // Branch gh-pages adalah artefak hasil build, jadi menimpanya dengan --force
    // memang wajar -- tidak ada history yang perlu dijaga di sana.
    await git(['push', '--force', 'origin', BRANCH], staging);
    console.log('  ter-push ke origin/' + BRANCH);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }

  console.log('\nSelesai. Tunggu sekitar satu menit lalu buka https://megaalive.github.io/nota-station/');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});