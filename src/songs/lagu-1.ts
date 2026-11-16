import type { Song } from '../types';

/**
 * Lagu contoh. Lirik di bawah cuma placeholder buatan sendiri:
 * ganti `text` dengan lirik lagumu, lalu isi `times` dengan detik mulai tiap kata.
 *
 * Taruh file lagunya di public/audio/lagu-1.mp3.
 * Kalau file belum ada, aplikasi tetap jalan tanpa suara memakai jam virtual.
 */
export const lagu1: Song = {
  id: 'lagu-1',
  title: 'Eleven Eleven',
  artist: 'Conan Gray',
  audio: '/audio/lagu-1.mp3',
  accent: '#e0102a',
  accent2: '#8f0020',
  lines: [
    { text: "There's black cats broke glass cracks on the pavement", times: [4.95, 5.32, 5.72, 6.40, 6.83, 7.53, 8.14, 8.33, 8.51] },
    { text: "But I just can't accept that it's too late to save us", times: [9.23, 9.52, 9.82, 10.22, 10.53, 11.34, 11.55, 11.76, 12.39, 12.70, 13.00, 13.44] },
    { text: "There's wishbones and clovers and numbers from Heaven", times: [14.24, 14.63, 15.30, 15.61, 16.38, 16.75, 17.50, 17.87] },
    { text: "And if you'd ask me I'd deny that we ended", times: [18.72, 19.34, 19.67, 20.00, 20.27, 20.78, 21.18, 21.83, 22.32, 22.72] },
    { text: "As much as I know that it's time to forget it", times: [23.71, 23.95, 24.36, 24.53, 24.97, 25.46, 25.85, 26.16, 26.71, 27.08, 27.25] },
    { text: "I still wish for you at eleven-eleven", times: [28.15, 28.60, 29.00, 29.48, 29.68, 30.24, 30.69] },
    { text: "I still wish for you at eleven-eleven", times: [37.10, 37.52, 37.89, 38.36, 38.69, 39.21, 39.53] },
    { text: "I still wish for you", times: [46.30, 46.72, 47.14, 47.56, 47.93] },
  ],
};
