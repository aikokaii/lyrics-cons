import type { Timeline } from './timeline';

const NS = 'http://www.w3.org/2000/svg';

/** Bintang 4 sudut dengan sisi melengkung ke dalam (seperti ikon "sparkle"). */
const STAR_PATH = 'M0,-7 Q0,0 7,0 Q0,0 0,7 Q0,0 -7,0 Q0,0 0,-7 Z';

/** Harus sama dengan font di style.css, dipakai untuk mengukur lebar kata besar. */
const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', system-ui, sans-serif`;

interface Point {
  x: number;
  y: number;
}

interface Area {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sebar posisi bintang secara acak tapi rapi di dalam `area` (satuan piksel layar):
 * - tidak saling tumpuk (jarak antar bintang dijaga),
 * - garis antar kata berurutan tidak terlalu pendek / terlalu panjang,
 * - sedikit condong kiri → kanan, tapi tetap boleh melompat dan bersilangan.
 * Semua ambang jarak menyesuaikan luas area, jadi tetap rapi di HP maupun desktop.
 * Seed tetap, jadi bentuk rasi tiap baris selalu sama untuk ukuran layar yang sama.
 */
export function layout(count: number, seed: number, area: Area): Point[] {
  const rnd = mulberry32(seed);
  const pts: Point[] = [];
  const { x0, x1, y0, y1 } = area;
  const w = x1 - x0;
  const h = y1 - y0;
  const ideal = Math.sqrt((w * h) / Math.max(1, count)); // jarak ideal antar bintang
  const spreadCap = ideal;
  const minSeg = ideal * 0.65;
  const maxSeg = Math.max(w, h) * 0.6;

  for (let i = 0; i < count; i++) {
    let best: Point = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    let bestScore = -Infinity;
    const targetX = count === 1 ? (x0 + x1) / 2 : x0 + (w * i) / (count - 1);

    for (let k = 0; k < 90; k++) {
      const p = { x: x0 + rnd() * w, y: y0 + rnd() * h };
      let minD = Infinity;
      for (const q of pts) minD = Math.min(minD, Math.hypot(p.x - q.x, p.y - q.y));
      // Sedikit noise supaya bentuknya tidak selalu zig-zag kiri → kanan.
      let score = Math.min(minD, spreadCap) + rnd() * ideal * 0.5;

      const prev = pts[i - 1];
      if (prev) {
        const d = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (d > maxSeg) score -= d - maxSeg;
        if (d < minSeg) score -= (minSeg - d) * 2;
      }
      score -= Math.abs(p.x - targetX) * 0.02;

      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    pts.push(best);
  }
  return pts;
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

const measureCtx = document.createElement('canvas').getContext('2d');

interface Built {
  index: number;
  group: SVGGElement;
  words: SVGGElement[];
  edges: SVGPathElement[];
}

/**
 * Menggambar satu rasi (satu baris lirik) dan memperbaruinya sesuai kata yang sedang dinyanyikan.
 * 1 satuan SVG = 1 piksel layar, jadi ukuran teks tetap terbaca di layar kecil.
 * Saat ukuran layar berubah (rotasi HP, resize jendela), posisi bintang dihitung ulang.
 */
export class Sky {
  private current: Built | null = null;
  private W = 0;
  private H = 0;
  private bigPx = 60;
  /** Kata aktif yang terakhir ditulis ke DOM (-2 = belum ada), supaya class tidak di-toggle tiap frame. */
  private shownWord = -2;
  private ro: ResizeObserver;

  constructor(
    private svg: SVGSVGElement,
    private readonly tl: Timeline,
  ) {
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.measure();
    this.ro = new ResizeObserver(() => {
      if (this.measure()) this.relayout();
    });
    this.ro.observe(svg);
  }

  destroy(): void {
    this.ro.disconnect();
  }

  update(lineIndex: number, wordIndex: number): void {
    if (lineIndex !== (this.current?.index ?? -1)) {
      this.leave();
      if (lineIndex >= 0) this.current = this.build(lineIndex);
      this.shownWord = -2;
    }
    const cur = this.current;
    // Dipanggil tiap frame, tapi kata hanya berganti beberapa kali per detik.
    if (!cur || wordIndex === this.shownWord) return;
    this.shownWord = wordIndex;

    cur.words.forEach((w, i) => {
      w.classList.toggle('seen', i <= wordIndex);
      w.classList.toggle('active', i === wordIndex);
    });
    // Garis ke-i menghubungkan kata i → i+1, muncul saat kata i+1 dinyanyikan.
    cur.edges.forEach((e, i) => e.classList.toggle('on', i + 1 <= wordIndex));
  }

  /** Baca ukuran layar, set viewBox & ukuran font. Return true kalau ukurannya berubah. */
  private measure(): boolean {
    // clientWidth/Height = ukuran asli tanpa efek animasi "melayang" (transform).
    const W = Math.max(1, Math.round(this.svg.clientWidth || window.innerWidth));
    const H = Math.max(1, Math.round(this.svg.clientHeight || window.innerHeight));
    if (W === this.W && H === this.H) return false;
    this.W = W;
    this.H = H;

    const m = Math.min(W, H);
    this.bigPx = clamp(m * 0.085, 38, 92);
    const smallPx = clamp(m * 0.017, 11, 17);

    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const s = this.svg.style;
    s.setProperty('--big', `${this.bigPx.toFixed(1)}px`);
    s.setProperty('--small', `${smallPx.toFixed(1)}px`);
    // Label selalu digambar seukuran kata besar lalu diperkecil dengan scale (lihat .label di style.css).
    s.setProperty('--shrink', (smallPx / this.bigPx).toFixed(4));
    s.setProperty('--cx', `${W / 2}px`);
    s.setProperty('--cy', `${H / 2}px`);
    return true;
  }

  /** Area tempat bintang boleh muncul; sisanya dipakai label besar dan kontrol bawah. */
  private area(): Area {
    const { W, H, bigPx } = this;
    const portrait = H > W;
    const padX = Math.max(36, W * (portrait ? 0.12 : 0.15));
    const labelRoom = 18 + bigPx * 1.35; // ruang untuk kata besar di bawah bintang
    const y0 = H * (portrait ? 0.2 : 0.22);
    const y1 = Math.max(y0 + 80, Math.min(H * (portrait ? 0.66 : 0.64), H - 96 - labelRoom));
    return { x0: padX, x1: W - padX, y0, y1 };
  }

  private relayout(): void {
    if (this.current) this.place(this.current);
  }

  /** Hitung posisi bintang, garis, dan geser label besar supaya tidak keluar layar. */
  private place(b: Built): void {
    const line = this.tl.lines[b.index];
    const pts = layout(line.words.length, line.seed, this.area());
    const pad = Math.max(16, this.W * 0.04);

    if (measureCtx) measureCtx.font = `600 ${this.bigPx}px ${FONT_STACK}`;

    b.words.forEach((g, i) => {
      const { x, y } = pts[i];
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);

      const width = (measureCtx?.measureText(line.words[i]).width ?? line.words[i].length * this.bigPx * 0.55) * 1.04;
      const left = x - width / 2;
      const right = x + width / 2;
      let dx = 0;
      if (width > this.W - pad * 2) dx = this.W / 2 - x; // kata sangat panjang: taruh di tengah
      else if (left < pad) dx = pad - left;
      else if (right > this.W - pad) dx = this.W - pad - right;
      g.style.setProperty('--dx', `${dx.toFixed(1)}px`);
    });

    b.edges.forEach((path, i) => {
      const a = pts[i];
      const c = pts[i + 1];
      path.setAttribute('d', `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${c.x.toFixed(1)},${c.y.toFixed(1)}`);
    });
  }

  private leave(): void {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    cur.group.classList.add('leaving');
    window.setTimeout(() => cur.group.remove(), 1000);
  }

  private build(index: number): Built {
    const line = this.tl.lines[index];

    const group = el('g', { class: 'line' });
    const drift = el('g', { class: 'drift' });
    const edgeLayer = el('g', { class: 'edges' });
    const nodeLayer = el('g', { class: 'nodes' });

    const edges: SVGPathElement[] = [];
    for (let i = 0; i < line.words.length - 1; i++) {
      const path = el('path', { class: 'edge', pathLength: 1 });
      edgeLayer.appendChild(path);
      edges.push(path);
    }

    const words: SVGGElement[] = line.words.map((word) => {
      const g = el('g', { class: 'word' });
      g.appendChild(el('circle', { class: 'halo', r: 22 }));
      g.appendChild(el('path', { class: 'star', d: STAR_PATH }));
      const label = el('text', { class: 'label' });
      label.textContent = word;
      g.appendChild(label);
      nodeLayer.appendChild(g);
      return g;
    });

    drift.append(edgeLayer, nodeLayer);
    group.appendChild(drift);
    this.svg.appendChild(group);

    const built = { index, group, words, edges };
    this.place(built);
    return built;
  }
}
