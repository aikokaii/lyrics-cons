# Konstelasi

Lirik yang tersambung jadi rasi bintang, terinspirasi gaya tampilan Verci, dengan glow tepi layar ala Lumn.
Dibuat dengan Vite + TypeScript tanpa library lain.

## Menjalankan

Butuh Node.js 20.19+ atau 22.12+.

```bash
npm install
npm run dev
```

Buka alamat yang muncul di terminal (biasanya http://localhost:5173).

## Memasukkan lagumu

1. Taruh file lagu di `public/audio/lagu-1.mp3`.
2. Buka `src/songs/lagu-1.ts`, lalu ganti `title`, `artist`, dan `text` tiap baris dengan lirik lagumu.
3. Isi `times` tiap baris dengan detik saat setiap kata mulai dinyanyikan.

Format satu baris:

```ts
{ text: 'kata kata dalam satu baris', times: [12.4, 12.8, 13.1, 13.5, 13.9] },
```

- Satu kata = satu bintang. Jumlah angka di `times` harus sama dengan jumlah kata.
- `end` (opsional) mengatur kapan rasi baris itu menghilang. Kalau tidak diisi, rasi bertahan
  sampai baris berikutnya (maksimal 3 detik setelah kata terakhir).
- Kalau file audio tidak ada, aplikasi tetap jalan tanpa suara memakai jam virtual.

## Menambah lagu ke menu

Salin `src/songs/lagu-1.ts` jadi file baru, ubah `id`, `audio`, warna, dan liriknya,
lalu daftarkan di `src/songs/index.ts`.

## Kontrol

| Desktop | HP / tablet | Fungsi |
|---|---|---|
| SPASI | Ketuk layar | Play / pause |
| ← / → | Ketuk progress bar | Mundur / maju |
| ESC | **← Menu** | Kembali ke menu |
| F | Tombol layar penuh | Layar penuh |

## Responsive

Rasi bintang dihitung ulang mengikuti ukuran layar (portrait, landscape, resize jendela, rotasi HP),
bukan sekadar diperkecil. Ukuran huruf menyesuaikan sisi terpendek layar, dan kata besar digeser
otomatis supaya tidak terpotong di tepi layar.

Untuk mencoba di HP: jalankan `npm run dev -- --host`, lalu buka alamat **Network** yang muncul
di terminal dari HP yang tersambung ke Wi-Fi yang sama.

## Struktur

```
src/
  main.ts           routing menu ↔ pemutar
  menu.ts           layar daftar lagu
  player.ts         layar pemutar, loop animasi, kontrol
  constellation.ts  posisi bintang dan gambar SVG rasi
  timeline.ts       mengubah data lagu jadi timeline (baris/kata aktif)
  clock.ts          sumber waktu: <audio> atau jam virtual
  glow.ts           glow tepi layar, berdenyut mengikuti bass
  perf.ts           deteksi mode lite (HP / perangkat lambat)
  fullscreen.ts     layar penuh & petunjuk iPhone
  songs/            data lagu
  style.css
public/
  sw.js             service worker (cache & offline)
```

## Layar penuh

- Desktop, Android, iPad: tombol layar penuh (pojok kanan atas di menu, di bar bawah saat lagu
  diputar) atau tombol **F**.
- iPhone: Safari belum mendukung layar penuh untuk halaman web. Caranya: **Share → Add to Home
  Screen**, lalu buka dari ikon di layar utama. Web tampil tanpa bar browser (diatur di
  `public/manifest.webmanifest`).

## Offline & cache (service worker)

Build produksi (`npm run build`) memasang service worker (`public/sw.js`). Setelah dibuka sekali,
aplikasi terbuka seketika dan tetap jalan tanpa internet, termasuk lagu yang pernah diputar
(atau disorot di menu, karena audionya mulai diunduh saat itu).

- `npm run dev` tidak memakai service worker, jadi perubahan selalu langsung terlihat.
- JS/CSS dan `index.html` otomatis memakai versi terbaru setelah deploy.
- Kalau file audio diganti dengan nama yang sama, versi lama masih diputar sekali lagi; service worker
  mengecek server di belakang layar, dan saat dibuka berikutnya file baru yang dipakai.
  Agar langsung berganti, beri nama file baru (mis. `lagu-1-v2.mp3`) dan ubah `audio` di file lagunya.

## Gerakan dikurangi

Kalau pengaturan **Reduce motion** di OS menyala, bintang dan kata tidak lagi membesar atau memantul
(hanya fade), dan glow tepi diam tanpa gelombang.

## Warna lampu per lagu

Setiap lagu punya warna lampunya sendiri. Atur di file lagu:

```ts
accent: '#ff5c8a',   // warna utama
accent2: '#ffb35c',  // warna kedua (lampu mengalir di antara dua warna ini)
```

Bisa pakai format warna CSS apa pun (`#hex`, `rgb()`, nama warna). Saat pindah lagu, warnanya
berganti dengan transisi halus. Kalau `accent2` tidak diisi, lampu memakai satu warna saja.

## Atur tampilan

- Bentuk gelombang lampu: fungsi `draw()` di `src/glow.ts` (ketebalan, jumlah gelombang, kecepatan).
- Ukuran kata aktif dan kata kecil: `bigPx` dan `smallPx` di fungsi `measure()` pada `constellation.ts`
  (label selalu digambar seukuran kata besar lalu diperkecil dengan `scale`, jadi jangan mengubah
  `font-size` di `.label`).
- Sebaran bintang: konstanta `AREA` dan fungsi `layout()` di `constellation.ts`.
