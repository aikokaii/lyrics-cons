export interface LyricLine {
  /** Satu baris lirik. Kata dipisah spasi; tiap kata jadi satu bintang. */
  text: string;
  /** Detik saat tiap kata mulai dinyanyikan. Jumlahnya harus sama dengan jumlah kata. */
  times: number[];
  /** Opsional: detik saat rasi baris ini menghilang. Kalau kosong, dihitung otomatis. */
  end?: number;
}

export interface Song {
  /** Dipakai di URL (#/song/<id>) dan sebagai seed posisi bintang. */
  id: string;
  title: string;
  artist: string;
  /** Path file audio di folder public/, mis. "/audio/lagu-1.mp3". Boleh kosong. */
  audio?: string;
  /** Warna glow utama (garis tepi). */
  accent: string;
  /** Warna glow kedua (pendaran ke dalam). */
  accent2?: string;
  lines: LyricLine[];
}
