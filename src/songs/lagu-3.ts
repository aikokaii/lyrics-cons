import type { Song } from '../types';

/**
 * Ganti `title`, `artist`, dan `text` tiap baris dengan lirik lagumu.
 * Isi `times` tiap baris dengan detik mulai tiap kata (jumlahnya harus sama dengan jumlah kata).
 * Selama masih kosong, timing diisi otomatis +0.4 dtk per kata dan muncul peringatan di console.
 *
 * Taruh file lagunya di public/audio/lagu-3.mp3.
 * Kalau file belum ada, aplikasi tetap jalan tanpa suara memakai jam virtual.
 */
export const lagu3: Song = {
  id: 'lagu-3',
  title: 'The Shining',
  artist: 'The Neighbourhood',
  audio: '/audio/lagu-3.mp3',
  accent: '#77699d',
  accent2: '#447264',
  lines: [
    { text: "The way that you glow everybody knows yeah", times: [7.63, 7.87, 8.22, 8.5, 8.86, 11.35, 13.56, 14.96] },
    { text: "You've got a heart of gold Mine is always broken", times: [16.9, 17.2, 17.64, 17.92, 18.36, 18.9, 21.3, 22.32, 22.88, 23.96] },
    { text: "So I'll just paint it chrome", times: [26.88, 27.26, 27.47, 27.81, 28.29, 28.77] },
    { text: "Yeah I'll just paint it chrome So you're not alone", times: [36.7, 37.08, 37.29, 37.63, 38.11, 38.59, 41.02, 41.93, 42.67, 43.47] },
    { text: "I just wanna shine with you baby", times: [46.94, 47.1, 47.29, 47.52, 48, 48.20, 48.55] },
    { text: "I just wanna shine with you baby", times: [56.85, 57.01, 57.2, 57.43, 57.91, 58.11, 58.46] },
  ],
};
