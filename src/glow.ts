import { isLite } from './perf';

/**
 * Glow tepi layar ala Lumn, dengan gelombang yang mengalir di sepanjang tepi.
 *
 * Cara kerja singkat:
 * - Pita cahaya digambar di <canvas> beresolusi rendah, lalu diperbesar CSS sehingga
 *   hasilnya lembut seperti pendaran, dan ringan untuk HP.
 * - Ketebalan pita di setiap titik tepi = gabungan 3 gelombang sinus yang bergerak
 *   ke arah berbeda, jadi cahayanya terlihat "bergelombang" dan mengalir.
 * - Warna mengalir memutari layar (gradien dua warna yang berputar pelan).
 * - Denyut: hanya dari bass lagu (Web Audio) kalau ada audio. Tanpa audio, lampu cuma bernapas pelan.
 *   Saat denyut, pita menebal dan gelombangnya bergerak lebih cepat.
 *
 * Optimasi:
 * - Tiap lapisan digambar sebagai 4 bentuk utuh (satu per sisi layar), bukan ratusan garis.
 * - Maksimal 60 fps saat lagu diputar, 30 fps saat pause.
 * - Mode lite (HP / perangkat lambat): resolusi lebih rendah, lapisan lebih sedikit, 30 fps.
 * - Saat lampu mati (menu), canvas berhenti digambar.
 * - prefers-reduced-motion: gelombang & denyut dimatikan, canvas hanya digambar ulang saat
 *   ukuran layar atau warna berubah.
 * - Resize di-debounce, jadi canvas tidak dibuat ulang puluhan kali saat jendela di-drag.
 */

type RGB = [number, number, number];

const DEFAULT_C1: RGB = [123, 92, 255];
const DEFAULT_C2: RGB = [79, 107, 255];

/** Lapisan pendaran: [ketebalan relatif, opacity]. Dari yang paling lebar & redup ke inti yang terang. */
const LAYERS_FULL: [number, number][] = [
  [3.2, 0.13],
  [2.3, 0.18],
  [1.6, 0.24],
  [1.05, 0.32],
  [0.6, 0.5],
  [0.28, 1],
];
const LAYERS_LITE: [number, number][] = [
  [3.0, 0.2],
  [1.7, 0.32],
  [0.9, 0.5],
  [0.35, 1],
];

/** Arah "ke dalam layar" untuk sisi atas, kanan, bawah, kiri. */
const NORMALS: [number, number][] = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
];

const scratch = document.createElement('canvas').getContext('2d')!;
const supportsCanvasFilter = 'filter' in scratch;

/** Terima warna CSS apa pun (#hex, rgb(), nama warna) → [r, g, b]. */
function parseColor(color: string, fallback: RGB): RGB {
  scratch.fillStyle = '#000';
  scratch.fillStyle = color;
  const v = String(scratch.fillStyle);
  if (v.startsWith('#') && v.length === 7) {
    return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
  }
  const m = v.match(/[\d.]+/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : fallback;
}

const rgb = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

function canvas2d(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  return [c, c.getContext('2d')!];
}

export class Glow {
  private root: HTMLElement;
  private core: HTMLElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  /** Satu lapisan digambar opaque di sini dulu (supaya sudut yang tumpang-tindih tidak belang). */
  private layer: HTMLCanvasElement;
  private lg: CanvasRenderingContext2D;
  /** Semua lapisan dikumpulkan di sini, lalu ditempel ke layar sekali dengan sedikit blur. */
  private acc: HTMLCanvasElement;
  private ag: CanvasRenderingContext2D;

  // Ukuran canvas (resolusi rendah) dan titik-titik di sepanjang tepi layar.
  private W = 0;
  private H = 0;
  private scale = 3;
  private minSide = 800;
  private px = new Float32Array(0);
  private py = new Float32Array(0);
  private ps = new Float32Array(0);
  private thick = new Float32Array(0);
  /** Indeks titik awal tiap sisi (4 sisi + penutup). */
  private sideStart: number[] = [];

  // Warna sekarang (bergerak halus menuju target saat ganti lagu).
  private c1: RGB = [...DEFAULT_C1];
  private c2: RGB = [...DEFAULT_C2];
  private t1: RGB = [...DEFAULT_C1];
  private t2: RGB = [...DEFAULT_C2];

  // Fase tiap gelombang (diakumulasi supaya kecepatannya bisa berubah tanpa loncat).
  private ph1 = 0;
  private ph2 = 0;
  private ph3 = 0;
  private spin = 0;

  private pulse = 0;
  private bassAvg = 0;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data = new Uint8Array(0);
  private attached = new WeakMap<HTMLAudioElement, { src: MediaElementAudioSourceNode; analyser: AnalyserNode }>();
  private current: { src: MediaElementAudioSourceNode; analyser: AnalyserNode } | null = null;
  private last = performance.now();
  private lastDraw = 0;
  private liteApplied = false;
  /** Lagu sedang diputar. Saat pause, lampu cukup digambar 30 fps. */
  private playing = false;
  /** Pengguna minta gerakan dikurangi: gelombang diam, canvas hanya digambar ulang kalau ada perubahan. */
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private dirty = true;
  private resizeTimer = 0;

  // Awalnya mati (lihat class "off" di index.html), dinyalakan saat lagu dibuka.
  private visible = false;
  private hiddenSince = -Infinity;

  constructor(root: HTMLElement) {
    this.root = root;
    this.core = root.querySelector('.rim-core')!;
    this.canvas = root.querySelector('.rim-wave')!;
    this.g = this.canvas.getContext('2d')!;
    [this.layer, this.lg] = canvas2d();
    [this.acc, this.ag] = canvas2d();

    this.resize();
    // Saat jendela di-drag, resize terpanggil puluhan kali per detik; cukup hitung ulang setelah
    // ukurannya berhenti berubah. Sementara itu canvas lama hanya ikut tertarik oleh CSS.
    const onResize = () => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.resize(), 150);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    this.reducedMotion.addEventListener('change', () => (this.dirty = true));
    requestAnimationFrame(this.frame);
  }

  /** Ganti warna lampu. Menerima format warna CSS apa pun. Transisinya halus (~1 detik). */
  setColors(c1: string, c2: string = c1): void {
    // Juga dipasang di <html> supaya elemen lain (progress bar, tombol TAP) ikut warnanya.
    const s = document.documentElement.style;
    s.setProperty('--c1', c1);
    s.setProperty('--c2', c2);
    this.t1 = parseColor(c1, DEFAULT_C1);
    this.t2 = parseColor(c2, this.t1);
    // Kalau lampu sedang mati, langsung pakai warna baru (tanpa transisi dari warna lama).
    if (!this.visible) {
      this.c1 = [...this.t1];
      this.c2 = [...this.t2];
    }
  }

  /** Nyalakan / matikan lampu dengan fade. Saat mati, canvas berhenti digambar (hemat baterai). */
  setVisible(on: boolean): void {
    if (on === this.visible) return;
    this.visible = on;
    this.dirty = true;
    this.hiddenSince = performance.now();
    this.root.classList.toggle('off', !on);
  }

  /** Denyut manual (saat ini tidak dipakai; denyut hanya dari bass lagu). */
  kick(amount = 1): void {
    this.pulse = Math.max(this.pulse, amount);
  }

  /** Dipanggil pemutar saat status play / pause berubah. */
  setPlaying(on: boolean): void {
    this.playing = on;
  }

  /** Sambungkan ke elemen audio. Harus dipanggil dari aksi user (klik / tombol / ketukan). */
  attachAudio(audio: HTMLAudioElement): void {
    try {
      this.audioCtx ??= new AudioContext();
      void this.audioCtx.resume();
      // createMediaElementSource hanya boleh sekali per elemen, jadi node-nya disimpan.
      let nodes = this.attached.get(audio);
      if (!nodes) {
        const src = this.audioCtx.createMediaElementSource(audio);
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.55;
        nodes = { src, analyser };
        this.attached.set(audio, nodes);
      }
      if (this.current && this.current !== nodes) this.disconnect(this.current);
      // Menyambung pasangan yang sudah tersambung tidak berefek, jadi aman dipanggil berulang.
      nodes.src.connect(nodes.analyser);
      nodes.analyser.connect(this.audioCtx.destination);
      this.current = nodes;
      this.analyser = nodes.analyser;
      if (this.data.length !== nodes.analyser.frequencyBinCount) {
        this.data = new Uint8Array(nodes.analyser.frequencyBinCount);
      }
    } catch (err) {
      console.warn('Glow: analyser audio tidak tersedia.', err);
      this.analyser = null;
    }
  }

  /**
   * Lepas dari audio. Node Web Audio diputus supaya bisa dibuang oleh garbage collector;
   * tanpa ini, setiap kali lagu dibuka ada node baru yang menumpuk di AudioContext.
   */
  detach(): void {
    if (this.current) this.disconnect(this.current);
    this.current = null;
    this.analyser = null;
  }

  private disconnect(nodes: { src: MediaElementAudioSourceNode; analyser: AnalyserNode }): void {
    try {
      nodes.src.disconnect();
      nodes.analyser.disconnect();
    } catch {
      // sudah terputus
    }
  }

  /** Hitung ulang ukuran canvas & titik-titik tepi saat layar berubah ukuran. */
  private resize(): void {
    const lite = isLite();
    this.liteApplied = lite;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Makin besar scale = canvas makin kecil = makin ringan (dan makin lembut).
    this.scale = lite ? 5 : w * h > 1_500_000 ? 4 : 3;
    this.W = Math.ceil(w / this.scale);
    this.H = Math.ceil(h / this.scale);
    this.minSide = Math.min(w, h);
    for (const c of [this.canvas, this.layer, this.acc]) {
      c.width = this.W;
      c.height = this.H;
    }

    // Sampel titik di keliling layar, termasuk tepat di keempat sudut.
    const { W, H } = this;
    const perimeter = 2 * (W + H);
    const step = Math.max(2, perimeter / (lite ? 140 : 220));
    const sides: [number, number, number, number][] = [
      [0, 0, W, 0],
      [W, 0, W, H],
      [W, H, 0, H],
      [0, H, 0, 0],
    ];
    const xs: number[] = [];
    const ys: number[] = [];
    const ss: number[] = [];
    this.sideStart = [];
    let walked = 0;
    for (const [x0, y0, x1, y1] of sides) {
      this.sideStart.push(xs.length);
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(len / step));
      for (let i = 0; i < n; i++) {
        const f = i / n;
        xs.push(x0 + (x1 - x0) * f);
        ys.push(y0 + (y1 - y0) * f);
        ss.push((walked + len * f) / perimeter);
      }
      walked += len;
    }
    // Titik penutup = titik awal lagi (supaya sisi terakhir tersambung ke sisi pertama).
    this.sideStart.push(xs.length);
    xs.push(xs[0]);
    ys.push(ys[0]);
    ss.push(1);
    this.px = Float32Array.from(xs);
    this.py = Float32Array.from(ys);
    this.ps = Float32Array.from(ss);
    this.thick = new Float32Array(xs.length);
    this.dirty = true;
  }

  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    // Lampu mati & fade-out sudah selesai: tidak perlu menghitung apa pun.
    if (!this.visible && now - this.hiddenSince > 1000) return;

    const lite = isLite();
    if (lite !== this.liteApplied) this.resize(); // baru saja pindah ke mode lite

    const still = this.reducedMotion.matches;

    if (this.analyser && !still) {
      this.analyser.getByteFrequencyData(this.data);
      // Bin 1..5 ≈ 40–230 Hz pada fftSize 1024 (bass & kick drum).
      let sum = 0;
      for (let i = 1; i <= 5; i++) sum += this.data[i];
      const bass = sum / (5 * 255);
      const rise = Math.max(0, bass - this.bassAvg);
      this.bassAvg += (bass - this.bassAvg) * Math.min(1, dt * 4);
      this.pulse = Math.max(this.pulse, Math.min(1, rise * 5 + bass * 0.35));
    }
    this.pulse *= Math.pow(0.9, dt * 60);

    const breathe = 0.18 + 0.08 * Math.sin((now / 1000) * 1.1);
    const p = still ? 0.2 : Math.max(breathe, this.pulse);

    // Warna bergerak halus ke target.
    const k = 1 - Math.pow(0.03, dt);
    let colorGap = 0;
    for (let i = 0; i < 3; i++) {
      this.c1[i] += (this.t1[i] - this.c1[i]) * k;
      this.c2[i] += (this.t2[i] - this.c2[i]) * k;
      colorGap = Math.max(colorGap, Math.abs(this.t1[i] - this.c1[i]), Math.abs(this.t2[i] - this.c2[i]));
    }

    // Kecepatan gelombang (putaran per detik). Bertambah sedikit saat ada denyut bass.
    if (!still) {
      this.ph1 += dt * (0.09 + 0.3 * p);
      this.ph2 -= dt * (0.065 + 0.2 * p);
      this.ph3 += dt * (0.22 + 0.45 * p);
      this.spin += dt * (0.18 + 0.25 * p);
    }

    // Batas fps: 60 saat lagu diputar (layar 120/144 Hz tidak perlu digambar lebih sering),
    // 30 di mode lite atau saat pause. Gerak gelombang tetap halus karena fasenya dihitung tiap frame.
    // lastDraw maju per interval (bukan = now), jadi di 144 Hz rata-ratanya tetap pas 60 fps.
    const interval = lite || still || !this.playing ? 1000 / 30 : 1000 / 60;
    const elapsed = now - this.lastDraw;
    if (elapsed < interval - 2) return; // toleransi 2 ms untuk jitter timestamp frame
    this.lastDraw = elapsed > interval * 2 ? now : this.lastDraw + interval;

    // Gerakan dikurangi: gambar ulang hanya saat ukuran / warna berubah, bukan terus-menerus.
    if (still && !this.dirty && colorGap < 0.5) return;
    this.dirty = false;

    this.core.style.opacity = (0.5 + 0.5 * p).toFixed(3);
    this.draw(p, lite);
  };

  private draw(p: number, lite: boolean): void {
    const { g, lg, ag, W, H, px, py, ps, thick, sideStart } = this;
    const TAU = Math.PI * 2;

    // Ketebalan dasar ≈ 1,1% sisi terpendek layar (dalam piksel canvas).
    const base = (this.minSide * 0.011) / this.scale;
    const amp = 0.5 + 0.3 * p;
    const grow = 1 + 0.9 * p;
    for (let i = 0; i < ps.length; i++) {
      const s = ps[i];
      // Angka 7, 5, 13 = jumlah gelombang di sepanjang keliling layar (makin besar makin rapat).
      const wave =
        0.55 * Math.sin(TAU * (7 * s - this.ph1)) +
        0.3 * Math.sin(TAU * (5 * s + this.ph2) + 1.3) +
        0.15 * Math.sin(TAU * (13 * s - this.ph3) + 0.7);
      thick[i] = base * grow * Math.max(0.15, 1 + amp * wave);
    }

    // Gradien dua warna yang berputar mengelilingi layar.
    let paint: CanvasGradient | string;
    if (typeof lg.createConicGradient === 'function') {
      const grad = lg.createConicGradient(this.spin, W / 2, H / 2);
      const a = rgb(this.c1);
      const b = rgb(this.c2);
      grad.addColorStop(0, a);
      grad.addColorStop(0.25, b);
      grad.addColorStop(0.5, a);
      grad.addColorStop(0.75, b);
      grad.addColorStop(1, a);
      paint = grad;
    } else {
      paint = rgb(this.c1);
    }
    lg.fillStyle = paint;

    ag.clearRect(0, 0, W, H);
    for (const [mul, alpha] of lite ? LAYERS_LITE : LAYERS_FULL) {
      lg.clearRect(0, 0, W, H);
      // Satu lapisan = 4 bentuk (satu per sisi): dari tepi layar ke dalam sejauh ketebalan gelombang.
      for (let side = 0; side < 4; side++) {
        const [nx, ny] = NORMALS[side];
        const a = sideStart[side];
        const b = sideStart[side + 1]; // titik sudut berikutnya
        lg.beginPath();
        lg.moveTo(px[a] - nx * 2, py[a] - ny * 2);
        lg.lineTo(px[b] - nx * 2, py[b] - ny * 2);
        for (let i = b; i >= a; i--) {
          const t = thick[i] * mul;
          lg.lineTo(px[i] + nx * t, py[i] + ny * t);
        }
        lg.closePath();
        lg.fill();
      }
      ag.globalAlpha = Math.min(1, alpha * (0.75 + 0.45 * p));
      ag.drawImage(this.layer, 0, 0);
    }
    ag.globalAlpha = 1;

    // Tempel ke layar dengan sedikit blur (di resolusi rendah ini blur-nya murah).
    g.clearRect(0, 0, W, H);
    if (supportsCanvasFilter) g.filter = 'blur(1px)';
    g.drawImage(this.acc, 0, 0);
    if (supportsCanvasFilter) g.filter = 'none';
  }
}
