/**
 * Mode hemat ("lite") untuk perangkat yang lebih lemah.
 *
 * - Otomatis aktif di HP/tablet (layar sentuh).
 * - Di desktop, aktif sendiri kalau frame rate di layar pemutar terdeteksi turun (rata-rata < ~45 fps).
 *
 * Saat aktif: class "lite" dipasang di <html> (dipakai style.css untuk mematikan efek berat),
 * dan lampu tepi digambar 30 fps dengan detail lebih rendah.
 */

const root = document.documentElement;
let lite = matchMedia('(hover: none) and (pointer: coarse)').matches;
root.classList.toggle('lite', lite);

export function isLite(): boolean {
  return lite;
}

/** Frame di awal (layar baru dibuka, glow & SVG baru dibuat) wajar patah-patah; jangan dihitung. */
const WARMUP_MS = 1000;

let watching = false;
let raf = 0;
let warmUntil = 0;
let last = 0;
let sum = 0;
let count = 0;

/**
 * Nyalakan / matikan pemantauan frame rate. Dipanggil oleh pemutar, karena hanya di sana ada
 * beban berat (glow + rasi bintang); di menu tidak ada yang perlu diukur.
 * Hanya bisa naik ke lite, tidak turun lagi, supaya tampilan tidak bolak-balik berubah.
 */
export function watchPerf(on: boolean): void {
  if (lite || on === watching) return;
  watching = on;
  cancelAnimationFrame(raf);
  if (!on) return;
  last = performance.now();
  warmUntil = last + WARMUP_MS;
  sum = 0;
  count = 0;
  raf = requestAnimationFrame(watch);
}

function watch(now: number): void {
  const dt = now - last;
  last = now;
  // Abaikan masa pemanasan dan jeda panjang (tab di-background, alert, dsb.).
  if (now >= warmUntil && dt < 250) {
    sum += dt;
    count++;
  }
  if (count >= 90) {
    if (sum / count > 22) {
      lite = true;
      watching = false;
      root.classList.add('lite');
      return; // tidak perlu dipantau lagi
    }
    sum = 0;
    count = 0;
  }
  raf = requestAnimationFrame(watch);
}
