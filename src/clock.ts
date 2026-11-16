/**
 * Sumber waktu lagu. Kalau file audio ada, waktunya diambil dari <audio>.
 * Kalau tidak ada / gagal dimuat, pindah ke jam virtual (performance.now)
 * supaya visual tetap bisa dicoba tanpa suara.
 */
export class Clock {
  readonly audio: HTMLAudioElement | null = null;
  private mode: 'audio' | 'virtual' = 'virtual';
  private offset = 0;
  private startedAt = 0;
  private wantPlay = false;
  private destroyed = false;

  constructor(
    src: string | undefined,
    private readonly fallbackDuration: number,
    private onFallback: (reason: string) => void,
  ) {
    if (src) {
      const a = new Audio();
      a.preload = 'auto';
      a.src = src;
      a.addEventListener('error', () =>
        this.toVirtual(`File audio tidak ditemukan (${src}). Berjalan tanpa suara.`),
      );
      a.addEventListener('ended', () => {
        this.wantPlay = false;
      });
      this.audio = a;
      this.mode = 'audio';
    } else {
      queueMicrotask(() => onFallback('Lagu ini belum punya file audio. Berjalan tanpa suara.'));
    }
  }

  get usingAudio(): boolean {
    return this.mode === 'audio';
  }

  get playing(): boolean {
    return this.mode === 'audio' ? !this.audio!.paused : this.wantPlay;
  }

  get duration(): number {
    const d = this.audio?.duration;
    if (this.mode === 'audio' && d !== undefined && Number.isFinite(d)) return d;
    return this.fallbackDuration;
  }

  now(): number {
    if (this.mode === 'audio') return this.audio!.currentTime;
    return this.wantPlay ? this.offset + (performance.now() - this.startedAt) / 1000 : this.offset;
  }

  play(): void {
    if (this.mode === 'audio') {
      this.wantPlay = true;
      this.audio!.play().catch(() => {
        if (this.mode === 'audio') this.toVirtual('Audio tidak bisa diputar. Berjalan tanpa suara.');
      });
      return;
    }
    if (this.wantPlay) return;
    this.startedAt = performance.now();
    this.wantPlay = true;
  }

  pause(): void {
    if (this.mode === 'audio') {
      this.wantPlay = false;
      this.audio!.pause();
      return;
    }
    if (!this.wantPlay) return;
    this.offset = this.now();
    this.wantPlay = false;
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number): void {
    const clamped = Math.max(0, Math.min(t, this.duration));
    if (this.mode === 'audio') {
      this.audio!.currentTime = clamped;
    } else {
      this.offset = clamped;
      this.startedAt = performance.now();
    }
  }

  /** Dipanggil tiap frame: hentikan jam virtual di akhir lagu. */
  tick(): void {
    if (this.mode === 'virtual' && this.wantPlay && this.now() >= this.duration) {
      this.offset = this.duration;
      this.wantPlay = false;
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  private toVirtual(reason: string): void {
    if (this.mode === 'virtual' || this.destroyed) return;
    const t = this.audio?.currentTime ?? 0;
    const wasPlaying = this.wantPlay;
    this.mode = 'virtual';
    this.audio?.pause();
    this.offset = t;
    this.startedAt = performance.now();
    this.wantPlay = wasPlaying;
    this.onFallback(reason);
  }
}
