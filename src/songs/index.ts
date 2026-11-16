import type { Song } from '../types';
import { lagu1 } from './lagu-1';

/**
 * Daftar lagu di menu. Untuk menambah lagu:
 * 1. Salin lagu-1.ts jadi file baru (mis. lagu-2.ts) dan ganti id, judul, audio, lirik.
 * 2. Import di sini dan tambahkan ke array.
 */
export const songs: Song[] = [lagu1];
