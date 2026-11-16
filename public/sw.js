/**
 * Service worker Konstelasi: aplikasi terbuka seketika dan tetap jalan tanpa internet.
 * Hanya didaftarkan di build produksi (lihat main.ts), jadi `npm run dev` tidak terpengaruh.
 *
 * Strategi per jenis file:
 * - Halaman (index.html): jaringan dulu, cache kalau offline. Jadi versi baru langsung terpakai.
 * - /assets/* (JS & CSS ber-hash): cache dulu. Nama file berubah tiap build, jadi tidak pernah basi.
 *   Yang sudah tidak dipakai index.html terbaru dibuang otomatis.
 * - /audio/*: cache dulu, termasuk menjawab permintaan Range (potongan) dari elemen <audio>.
 *   Di belakang layar dicek dengan HEAD; kalau file di server berganti, cache diperbarui.
 * - Lainnya (ikon, manifest): pakai cache, sambil memperbarui dari jaringan.
 */

const SHELL = 'konstelasi-shell-v1';
const ASSETS = 'konstelasi-assets';
const AUDIO = 'konstelasi-audio';

// Mengikuti `base` Vite: semua path dihitung dari lokasi sw.js.
const BASE = new URL(self.registration.scope).pathname;
const at = (path) => new URL(path, self.registration.scope).href;

const SHELL_FILES = ['', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png'].map(at);

/** URL JS/CSS ber-hash yang dirujuk index.html. */
function assetUrls(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = new URL(m[1], self.registration.scope);
    if (url.origin === location.origin && url.pathname.startsWith(`${BASE}assets/`)) urls.add(url.href);
  }
  return [...urls];
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll(SHELL_FILES);
      // Simpan juga JS/CSS halaman saat ini, supaya kunjungan berikutnya langsung bisa offline.
      const page = await shell.match(at(''));
      if (page) await (await caches.open(ASSETS)).addAll(assetUrls(await page.text()));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL, ASSETS, AUDIO];
      for (const name of await caches.keys()) {
        if (name.startsWith('konstelasi-') && !keep.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  const path = url.pathname.slice(BASE.length);

  if (req.mode === 'navigate') {
    if (path === '' || path === 'index.html') event.respondWith(page(event));
  } else if (path.startsWith('assets/')) {
    event.respondWith(cacheFirst(req, ASSETS));
  } else if (path.startsWith('audio/')) {
    event.respondWith(audio(event, url.origin + url.pathname));
  } else if (SHELL_FILES.includes(url.href)) {
    event.respondWith(staleWhileRevalidate(event, SHELL));
  }
});

// ───────────── Halaman & aset ─────────────

async function page(event) {
  const shell = await caches.open(SHELL);
  try {
    const res = await fetch(event.request);
    if (res.ok) {
      const forCache = res.clone();
      const forPrune = res.clone();
      event.waitUntil(
        (async () => {
          await shell.put(at(''), forCache);
          await pruneAssets(assetUrls(await forPrune.text()));
        })(),
      );
    }
    return res;
  } catch {
    return (await shell.match(at(''))) ?? Response.error();
  }
}

/** Buang JS/CSS build lama yang tidak dirujuk index.html terbaru. */
async function pruneAssets(current) {
  if (current.length === 0) return; // jaga-jaga kalau HTML-nya aneh: jangan hapus apa pun
  const keep = new Set(current);
  const cache = await caches.open(ASSETS);
  for (const req of await cache.keys()) {
    if (!keep.has(req.url)) await cache.delete(req);
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(event, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(event.request);
  const update = fetch(event.request)
    .then(async (res) => {
      if (res.ok) await cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return (await update) ?? Response.error();
}

// ───────────── Audio ─────────────

/** Unduhan file utuh yang sedang berjalan, supaya satu file tidak diunduh dua kali bersamaan. */
const inflight = new Map();
/** File yang sudah dicek ke server selama service worker ini hidup. */
const checked = new Set();

function downloadAudio(key) {
  let job = inflight.get(key);
  if (!job) {
    job = (async () => {
      const res = await fetch(key);
      if (!res.ok || res.status !== 200) throw new Error(`Audio gagal diunduh (${res.status})`);
      await (await caches.open(AUDIO)).put(key, res);
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  return job;
}

async function audio(event, key) {
  const cache = await caches.open(AUDIO);
  let cached = await cache.match(key);

  if (!cached) {
    const pending = inflight.get(key);
    const wantsRange = event.request.headers.has('range');
    if (pending || !wantsRange) {
      // Sedang diunduh (mis. prefetch dari menu) atau permintaan biasa: tunggu file utuhnya.
      try {
        await (pending ?? downloadAudio(key));
        cached = await cache.match(key);
      } catch {
        // gagal: jatuh ke jaringan di bawah
      }
    } else {
      // <audio> minta potongan dan belum ada di cache: teruskan ke jaringan supaya bisa langsung
      // diputar, sambil mengunduh file utuh untuk cache di belakang layar.
      event.waitUntil(downloadAudio(key).catch(() => {}));
    }
    if (!cached) return fetch(event.request);
  } else {
    event.waitUntil(revalidateAudio(key, cached));
  }

  return slice(event.request, cached);
}

/** Cek murah (HEAD) apakah file di server sudah diganti; kalau iya, unduh ulang. */
async function revalidateAudio(key, cached) {
  if (checked.has(key) || inflight.has(key)) return;
  checked.add(key);
  try {
    const head = await fetch(key, { method: 'HEAD', cache: 'no-cache' });
    if (!head.ok) return;
    const changed = ['etag', 'last-modified', 'content-length'].some((h) => {
      const a = head.headers.get(h);
      const b = cached.headers.get(h);
      return a && b && a !== b;
    });
    if (changed) await downloadAudio(key);
  } catch {
    // offline: pakai yang ada di cache
  }
}

/**
 * Jawab permintaan dari cache. Elemen <audio> (terutama Safari) meminta file per potongan
 * dengan header Range dan butuh jawaban 206, jadi potongannya dibuat dari file di cache.
 */
async function slice(request, cached) {
  const blob = await cached.blob();
  const size = blob.size;
  const type = cached.headers.get('content-type') || 'audio/mpeg';
  const range = request.headers.get('range');
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };

  if (!range) {
    return new Response(blob, { status: 200, headers: { ...base, 'Content-Length': String(size) } });
  }

  const m = /^bytes=(\d*)-(\d*)/.exec(range);
  let start = 0;
  let end = size - 1;
  if (m && m[1] === '' && m[2] !== '') {
    start = Math.max(0, size - Number(m[2])); // "bytes=-500" = 500 byte terakhir
  } else if (m && m[1] !== '') {
    start = Number(m[1]);
    if (m[2] !== '') end = Math.min(Number(m[2]), size - 1);
  }
  if (!m || start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }

  return new Response(blob.slice(start, end + 1, type), {
    status: 206,
    headers: {
      ...base,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
    },
  });
}
