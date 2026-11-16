import { Clock } from './clock';
import { Sky } from './constellation';
import { bindFullscreenButton, isFullscreen } from './fullscreen';
import type { Glow } from './glow';
import { watchPerf } from './perf';
import { compile, stateAt } from './timeline';
import type { Song } from './types';

function fmt(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Layar pemutar. Mengembalikan fungsi untuk membersihkan layar saat pindah halaman. */
export function mountPlayer(root: HTMLElement, song: Song, glow: Glow): () => void {
  root.innerHTML = `
    <div class="player paused">
      <a class="back" href="#/">← Menu</a>
      <div class="note" hidden></div>
      <div class="intro">
        <div class="intro-title"></div>
        <div class="intro-artist"></div>
        <div class="intro-hint">
          <span class="kbd-only">Tekan SPASI untuk mulai</span>
          <span class="touch-only">Ketuk layar untuk mulai</span>
        </div>
      </div>
      <svg class="sky" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="bar">
        <button class="play" aria-label="Play / pause">▶</button>
        <span class="time">0:00</span>
        <div class="progress"><div class="fill"></div></div>
        <span class="dur">0:00</span>
        <button class="fs" type="button"></button>
      </div>
    </div>`;

  const player = root.querySelector<HTMLElement>('.player')!;
  const note = root.querySelector<HTMLElement>('.note')!;
  const intro = root.querySelector<HTMLElement>('.intro')!;
  const playBtn = root.querySelector<HTMLButtonElement>('.play')!;
  const timeEl = root.querySelector<HTMLElement>('.time')!;
  const durEl = root.querySelector<HTMLElement>('.dur')!;
  const progress = root.querySelector<HTMLElement>('.progress')!;
  const fill = root.querySelector<HTMLElement>('.fill')!;
  const unbindFs = bindFullscreenButton(root.querySelector<HTMLButtonElement>('.fs')!);
  root.querySelector('.intro-title')!.textContent = song.title;
  root.querySelector('.intro-artist')!.textContent = song.artist;

  const tl = compile(song);
  const sky = new Sky(root.querySelector<SVGSVGElement>('.sky')!, tl);
  const clock = new Clock(song.audio, tl.duration, (reason) => {
    note.textContent = reason;
    note.hidden = false;
    glow.detach();
  });

  /** Web Audio harus dinyalakan dari aksi user, jadi dipanggil di handler klik/tombol. */
  const wireGlow = () => {
    if (clock.usingAudio && clock.audio) glow.attachAudio(clock.audio);
  };

  const toggle = () => {
    if (!clock.playing) {
      if (clock.now() >= clock.duration - 0.05) clock.seek(0);
      wireGlow();
    }
    clock.toggle();
  };

  const onKey = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (!e.repeat) toggle();
        break;
      case 'ArrowRight':
        clock.seek(clock.now() + 5);
        break;
      case 'ArrowLeft':
        clock.seek(clock.now() - 5);
        break;
      case 'Escape':
        // Di mode layar penuh, ESC dipakai browser untuk keluar fullscreen dulu.
        // isFullscreen() juga mengecek versi webkit (Safari).
        if (!isFullscreen()) location.hash = '#/';
        break;
    }
  };

  // Kontrol muncul saat mouse bergerak / layar disentuh, hilang sendiri saat lagu berjalan.
  let hideTimer = 0;
  const onMove = () => {
    player.classList.add('ui-on');
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => player.classList.remove('ui-on'), 2600);
  };

  // Ketuk / klik area kosong: play / pause.
  const onScreenDown = (e: PointerEvent) => {
    onMove();
    if (e.button !== 0) return;
    if ((e.target as Element).closest('.bar, .back, .note')) return;
    toggle();
  };

  playBtn.onclick = (e) => {
    (e.currentTarget as HTMLElement).blur();
    toggle();
  };
  progress.onclick = (e) => {
    const r = progress.getBoundingClientRect();
    clock.seek(((e.clientX - r.left) / r.width) * clock.duration);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('pointermove', onMove);
  player.addEventListener('pointerdown', onScreenDown);

  let raf = 0;
  // Teks hanya ditulis ulang kalau isinya berubah (lebih ringan daripada tiap frame).
  const setText = (el: HTMLElement, text: string) => {
    if (el.textContent !== text) el.textContent = text;
  };
  let wasPlaying: boolean | null = null;
  let lastFill = '';
  const loop = () => {
    clock.tick();
    const now = clock.now();
    const s = stateAt(tl, now);
    sky.update(s.line, s.word);

    const playing = clock.playing;
    if (playing !== wasPlaying) {
      wasPlaying = playing;
      glow.setPlaying(playing);
    }
    player.classList.toggle('paused', !playing);
    intro.classList.toggle('show', s.line === -1 && now < (tl.lines[0]?.start ?? 0));
    setText(playBtn, playing ? '❚❚' : '▶');
    setText(timeEl, fmt(now));
    setText(durEl, fmt(clock.duration));
    // scaleX tidak memicu hitung ulang layout, beda dengan mengubah width.
    // Ditulis hanya kalau berubah (saat pause nilainya tetap, jadi tidak ada hitung ulang style).
    const fillValue = `scaleX(${Math.min(1, now / clock.duration).toFixed(4)})`;
    if (fillValue !== lastFill) {
      lastFill = fillValue;
      fill.style.transform = fillValue;
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  watchPerf(true);

  return () => {
    cancelAnimationFrame(raf);
    watchPerf(false);
    window.clearTimeout(hideTimer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', onMove);
    unbindFs();
    sky.destroy();
    clock.destroy();
    glow.setPlaying(false);
    glow.detach();
  };
}
