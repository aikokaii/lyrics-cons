import { bindFullscreenButton } from './fullscreen';
import type { Song } from './types';

const prefetched = new Set<string>();

/**
 * Mulai mengunduh audio lagu sebelum diklik (saat disorot mouse, disentuh, atau dipilih keyboard),
 * supaya lagunya siap diputar begitu pemutar terbuka. Dengan service worker (sw.js), file masuk
 * cache dan bisa diputar offline; tanpa itu, minimal masuk cache HTTP browser.
 */
function prefetchAudio(src: string | undefined): void {
  if (!src || prefetched.has(src)) return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return; // pengguna minta hemat kuota
  prefetched.add(src);
  fetch(src).catch(() => prefetched.delete(src));
}

export function mountMenu(root: HTMLElement, songs: Song[]): () => void {
  root.innerHTML = `
    <div class="menu">
      <button class="fs fs-corner" type="button"></button>
      <header class="menu-head">
        <svg class="logo" viewBox="-10 -10 20 20" aria-hidden="true">
          <path d="M0,-9 Q0,0 9,0 Q0,0 0,9 Q0,0 -9,0 Q0,0 0,-9 Z" />
        </svg>
        <h1>Konstelasi</h1>
        <p>Lirik yang tersambung jadi rasi bintang</p>
      </header>
      <ul class="songs"></ul>
      <footer class="menu-foot">Pilih lagu untuk memutar</footer>
    </div>`;

  const list = root.querySelector('.songs')!;
  songs.forEach((song, i) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#/song/${encodeURIComponent(song.id)}`;
    a.style.setProperty('--accent', song.accent);
    a.style.animationDelay = `${0.08 * i}s`;

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(i + 1).padStart(2, '0');
    const info = document.createElement('span');
    info.className = 'info';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = song.title;
    const artist = document.createElement('span');
    artist.className = 'artist';
    artist.textContent = song.artist;
    info.append(title, artist);
    const dot = document.createElement('span');
    dot.className = 'dot';

    a.append(num, info, dot);
    a.addEventListener('pointerenter', () => prefetchAudio(song.audio));
    a.addEventListener('pointerdown', () => prefetchAudio(song.audio));
    li.appendChild(a);
    list.appendChild(li);
  });

  // Enter langsung membuka lagu pertama.
  const first = list.querySelector<HTMLAnchorElement>('a');
  first?.focus({ preventScroll: true });
  // Prefetch lewat keyboard dipasang setelah fokus awal di atas, supaya membuka menu saja
  // tidak langsung mengunduh lagu pertama (boros kuota di HP).
  list.querySelectorAll('a').forEach((a, i) =>
    a.addEventListener('focus', () => prefetchAudio(songs[i].audio)),
  );

  const unbindFs = bindFullscreenButton(root.querySelector<HTMLButtonElement>('.fs')!);

  return () => unbindFs();
}
