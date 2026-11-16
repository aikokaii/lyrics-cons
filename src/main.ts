import './style.css';
import { toggleFullscreen, showIphoneHint } from './fullscreen';
import { Glow } from './glow';
import { mountMenu } from './menu';
import { mountPlayer } from './player';
import { songs } from './songs';

const app = document.querySelector<HTMLDivElement>('#app')!;
const glow = new Glow(document.querySelector<HTMLElement>('.rim')!);

let cleanup: () => void = () => {};

function route(): void {
  cleanup();
  const match = location.hash.match(/^#\/song\/(.+)$/);
  const song = match ? songs.find((s) => s.id === decodeURIComponent(match[1])) : undefined;

  if (song) {
    glow.setColors(song.accent, song.accent2 ?? song.accent);
    glow.setVisible(true);
    cleanup = mountPlayer(app, song, glow);
  } else {
    // Menu tanpa lampu; lampu menyala saat lagu dibuka.
    glow.setVisible(false);
    cleanup = mountMenu(app, songs);
  }
}

window.addEventListener('hashchange', route);
route();

// Service worker: cache aplikasi & audio supaya terbuka seketika dan bisa offline (public/sw.js).
// Hanya di build produksi; saat `npm run dev` file selalu diambil baru.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn('Service worker gagal didaftarkan.', err));
  });
}

// Tombol F: layar penuh (berlaku di menu maupun pemutar).
window.addEventListener('keydown', async (e) => {
  if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if ((await toggleFullscreen()) === 'unsupported') showIphoneHint();
});
