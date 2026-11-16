import type { Song } from './types';

export interface TLine {
  words: string[];
  times: number[];
  start: number;
  end: number;
  seed: number;
}

export interface Timeline {
  lines: TLine[];
  duration: number;
}

/** Berapa lama rasi bertahan setelah kata terakhir, kalau baris berikutnya belum mulai. */
const HOLD_AFTER_LAST_WORD = 3;
/** Rasi lama mulai menghilang sedikit sebelum baris berikutnya muncul. */
const GAP_BEFORE_NEXT = 0.25;

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mengubah data lagu jadi timeline siap pakai: rapikan timing, hitung kapan tiap baris selesai. */
export function compile(song: Song): Timeline {
  let lastTime = 0;
  const lines: TLine[] = song.lines.map((line, li) => {
    const words = line.text.trim().split(/\s+/).filter(Boolean);
    const times = line.times.slice(0, words.length);
    if (line.times.length !== words.length) {
      console.warn(
        `[${song.id}] baris ${li + 1}: ${words.length} kata tapi ${line.times.length} timing. ` +
          'Timing yang kurang diisi otomatis (+0.4 dtk).',
      );
    }
    while (times.length < words.length) {
      times.push((times.at(-1) ?? lastTime + 1) + 0.4);
    }
    // Paksa urutan naik supaya kata tidak "mundur".
    for (let i = 1; i < times.length; i++) {
      if (times[i] < times[i - 1]) times[i] = times[i - 1];
    }
    lastTime = times.at(-1) ?? lastTime;
    return {
      words,
      times,
      start: times[0] ?? 0,
      end: line.end ?? 0,
      seed: hash(`${song.id}:${li}`),
    };
  });

  lines.forEach((line, i) => {
    if (song.lines[i].end !== undefined) return;
    const last = line.times.at(-1) ?? line.start;
    const next = lines[i + 1];
    const auto = last + HOLD_AFTER_LAST_WORD;
    line.end = next ? Math.max(last + 0.3, Math.min(auto, next.start - GAP_BEFORE_NEXT)) : auto;
  });

  const duration = (lines.at(-1)?.end ?? 0) + 1;
  return { lines, duration };
}

export interface LyricState {
  /** Indeks baris yang tampil, -1 kalau tidak ada. */
  line: number;
  /** Indeks kata terakhir yang sudah dinyanyikan di baris itu, -1 kalau belum ada. */
  word: number;
}

export function stateAt(tl: Timeline, now: number): LyricState {
  for (let li = 0; li < tl.lines.length; li++) {
    const line = tl.lines[li];
    if (now >= line.start && now < line.end) {
      let word = -1;
      for (let wi = 0; wi < line.times.length; wi++) {
        if (line.times[wi] <= now) word = wi;
        else break;
      }
      return { line: li, word };
    }
  }
  return { line: -1, word: -1 };
}
