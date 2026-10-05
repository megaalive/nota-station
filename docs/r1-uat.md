# UAT R1 — Tracker yang bisa dimainkan

Checklist ini menerjemahkan Exit criteria R1 di PLAN menjadi bukti yang dapat dicatat.
Jangan tandai PASS sebelum langkah benar-benar dijalankan pada build live yang sama.

## Identitas build

- main SHA:
- gh-pages deploy commit:
- build.json SHA:
- browser:
- tanggal:

## Skenario exit R1

- [ ] Buka halaman baru / first-run.
- [ ] Pilih template Pop 4/4.
- [ ] Bunyi pertama terdengar dalam **≤60 detik** (T1).
- [ ] Buat/aktifkan Pattern.
- [ ] Isi kick/snare/melodi minimal 16 row.
- [ ] Play.
- [ ] Ubah tempo saat playback; transport tetap bermain.
- [ ] Loop 100× tanpa drift progresif.
- [ ] Stop lalu Play dari awal.
- [ ] Edit note lalu Undo; state kembali benar.
- [ ] Export JSON debug.
- [ ] Reload halaman.
- [ ] Import JSON debug.
- [ ] Row, tempo, note, dan hasil bunyi sama secara semantik setelah import.

## Lagu uji stabilitas

Gunakan build Pages yang sama dengan UAT:

- URL: `https://megaalive.github.io/nota-station/?demo=stability`
- Judul: **Malam Kota — Stability Loop**
- Tempo/key: **116 BPM · A minor**
- Panjang: **4 bar / 64 row**, loop sekitar **8,28 detik**
- Beban: **8 channel aktif · 151 note**
- Jalur audio: scheduler R1 yang sama, tetapi 8 instrument `demo.*` memakai timbre synth UAT yang terpisah

Prosedur uji 2 menit:
1. Buka URL demo.
2. Klik **Aktifkan audio** atau langsung **Play**.
3. Pastikan **Loop Pattern** tetap aktif.
4. Dengarkan minimal 2 menit tanpa mengubah tempo.
5. Catat bila terdengar crackle, gap, note hilang, tempo tersendat, atau loop boundary terasa putus.
6. Setelah 2 menit, Stop lalu Play lagi dan pastikan mulai dari awal dengan normal.

Catatan: fixture UAT sengaja memakai voice synth ringan agar setiap channel dapat dibedakan
secara pendengaran tanpa memperluas instrument/sample system R1. Project normal tetap memakai
`factory.basic`; kualitas instrument final tetap pekerjaan R2.

**Mix v3:** perkusi telah diturunkan dan bass/lead/harmony diperkuat serta diperpanjang.
Tujuan re-test berikutnya adalah memastikan bagian tonal jelas terdengar, bukan hanya perkusi.

## Performa

Target R1:
- [ ] 8 channel aktif.
- [ ] 32 voice sintetis.
- [ ] 0 underrun selama 2 menit.
- [ ] first interactive tidak menunggu factory pack.
- [ ] app tanpa sample tetap di bawah budget 1,5 MiB transferred.

Catat mesin/browser referensi dan cara ukur; jangan memakai angka CI sebagai pengganti uji audio real-time manusia.

## Bukti otomatis

Bukti ini membantu closure teknis tetapi **tidak menggantikan UAT manual** di bawah.

- Full gate final: GitHub Actions run **37246931905**, runtime/test head `803e90f`.
- Unit: **50/50 PASS**; check PASS; build **151.1 KiB**.
- Browser desktop: Chromium + Firefox **142/142 PASS**.
- T1 mesin: **572 ms Chromium** dan **918 ms Firefox** dari load sampai playback siap
  pada skenario first-run Pop 4/4 (budget mesin ≤3 detik).
- Loop 100×: PASS pada unit scheduler deterministik, tanpa drift progresif.
- 32 voice aktif: PASS pada R1-S10 di Chromium + Firefox.
- App runtime tanpa sample pack: **154.657 byte (~151 KiB)**, di bawah budget 1,5 MiB.
- Uji otomatis exit membuktikan 16 note, playback, tempo live, Stop, edit note + Undo,
  JSON export/reload/import, dan playback ulang.

## Hasil

**Implementasi otomatis: PASS. Manual UAT: BELUM DIJALANKAN.**

Yang tetap wajib dilakukan pada build Pages yang sama:
- T1 manual ≤60 detik dan uji tugas UX 5 peserta sesuai §8.20.
- Uji audio real-time 2 menit pada mesin referensi dengan target 0 underrun.
- Konfirmasi hasil bunyi secara manusia setelah export/reload/import.

