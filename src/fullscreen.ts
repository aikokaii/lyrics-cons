/**
 * Fullscreen untuk desktop & HP.
 * - Desktop, Android, iPad: Fullscreen API biasa.
 * - iPhone: Safari belum mendukung fullscreen untuk halaman web (hanya untuk video),
 *   jadi caranya lewat "Add to Home Screen". Setelah dibuka dari ikon di layar utama,
 *   web tampil tanpa bar browser (diatur di public/manifest.webmanifest).
 */

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const doc = document as FsDocument;
const root = document.documentElement as FsElement;

/** Browser mendukung Fullscreen API untuk halaman (bukan hanya video). */
export function fullscreenSupported(): boolean {
  return Boolean(
    (document.fullscreenEnabled && root.requestFullscreen) ||
      (doc.webkitFullscreenEnabled && root.webkitRequestFullscreen),
  );
}

/** Sudah dibuka sebagai aplikasi dari layar utama (tanpa bar browser). */
export function isStandaloneApp(): boolean {
  return (
    matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isFullscreen(): boolean {
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

export async function toggleFullscreen(): Promise<'on' | 'off' | 'unsupported'> {
  try {
    if (isFullscreen()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
      return 'off';
    }
    if (!fullscreenSupported()) return 'unsupported';
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else await root.webkitRequestFullscreen?.();
    return 'on';
  } catch {
    return 'unsupported';
  }
}

export function onFullscreenChange(cb: () => void): () => void {
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
  return () => {
    document.removeEventListener('fullscreenchange', cb);
    document.removeEventListener('webkitfullscreenchange', cb);
  };
}

const ICON_ENTER =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
const ICON_EXIT =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';

/**
 * Pasang perilaku fullscreen ke sebuah tombol: ganti ikon sesuai status, sembunyikan
 * kalau sudah jadi aplikasi layar utama, dan tampilkan petunjuk di iPhone.
 * Mengembalikan fungsi pembersih.
 */
export function bindFullscreenButton(btn: HTMLButtonElement): () => void {
  if (isStandaloneApp()) {
    btn.hidden = true;
    return () => {};
  }
  const sync = () => {
    const on = isFullscreen();
    btn.innerHTML = on ? ICON_EXIT : ICON_ENTER;
    btn.title = on ? 'Keluar layar penuh (F)' : 'Layar penuh (F)';
    btn.setAttribute('aria-label', btn.title);
  };
  btn.onclick = async (e) => {
    (e.currentTarget as HTMLElement).blur();
    if ((await toggleFullscreen()) === 'unsupported') showIphoneHint();
  };
  sync();
  return onFullscreenChange(sync);
}

let hintTimer = 0;

/** Petunjuk untuk iPhone (atau browser lain yang tidak mendukung fullscreen). */
export function showIphoneHint(): void {
  let toast = document.querySelector<HTMLElement>('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  const isIOS = /iPhone|iPod/.test(navigator.userAgent);
  toast.innerHTML = isIOS
    ? 'Safari di iPhone belum mendukung layar penuh untuk web.<br>' +
      'Ketuk <b>Share</b> → <b>Add to Home Screen</b>, lalu buka dari ikon di layar utama. ' +
      'Web akan tampil tanpa bar browser.'
    : 'Browser ini belum mendukung mode layar penuh.';
  toast.classList.add('show');
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => toast!.classList.remove('show'), 7000);
  toast.onclick = () => toast!.classList.remove('show');
}
