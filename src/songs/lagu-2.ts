import type { Song } from '../types';

/**
 * Isi `times` tiap baris dengan detik mulai tiap kata (jumlahnya harus sama dengan jumlah kata).
 * Selama masih kosong, timing diisi otomatis +0.4 dtk per kata dan muncul peringatan di console.
 *
 * Taruh file lagunya di public/audio/lagu-2.mp3.
 * Kalau file belum ada, aplikasi tetap jalan tanpa suara memakai jam virtual.
 */
export const lagu2: Song = {
  id: 'lagu-2',
  title: 'About You',
  artist: 'The 1975',
  audio: '/audio/lagu-2.mp3',
  // Warna sunrise: oranye keemasan di tepi, pendaran merah muda ke dalam.
  accent: '#8e8e8e',
  accent2: '#3d3d3d', 
  lines: [
    { text: "Do you think I have forgotten about you?", times: [5.66, 6.02, 6.30, 6.96, 7.30, 8.26, 10.57, 12.0] },
    { text: "There was something 'bout you that now I can't remember", times: [15.7, 16.0, 16.32, 16.96, 17.53, 18.14, 18.51, 19.0, 19.43, 19.78] },
    { text: "It's the same damn thing that made my heart surrender", times: [20.7, 20.94, 21.17, 21.98, 22.58, 23.20, 23.47, 24.18, 24.45, 24.61] },
    { text: "And I miss you on a train I miss you in the morning", times: [25.78, 26.03, 26.41, 26.65, 26.95, 27.32, 27.49, 28.23, 28.57, 29.16, 29.51, 29.78, 30.12] },
    { text: "I never know what to think about", times: [30.84, 31.92, 32.60, 32.92, 33.15, 33.56, 33.88] },
    { text: "I think about you! About YOU!!", times: [34.64, 34.98, 35.45, 37.0, 40.85, 41.95] },
    { text: "Do you think I have forgotten about you?", times: [45.56, 45.74, 46.22, 46.88, 47.22, 48.18, 50.49, 51.92] },
    { text: "About you?! About you??!", times: [55.50, 56.99, 60.51, 61.87] },
    { text: "Do you think I have forgotten about YOU???!!", times: [65.41, 65.61, 66.09, 66.75, 67.09, 68.05, 70.36, 71.79] },
  ],
};
