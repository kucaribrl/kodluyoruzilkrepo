/* IQ Basics — Service Worker (çevrimdışı çalışma + kurulabilir PWA) */
const CACHE = 'iqbasics-v21';

/* Uygulama kabuğu: internet olmasa da açılması gereken dosyalar */
const SHELL = [
  './',
  './index.html',
  './qrcode.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-touch-icon.png',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // tek tek ekle: biri düşse bile kurulum bozulmasın
      Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // sipariş yazma vb. → dokunma

  const url = new URL(req.url);

  // Firestore/Firebase API çağrıları → HER ZAMAN ağdan (asla önbellek)
  if (/firestore\.googleapis\.com|firebaseio\.com|identitytoolkit\.googleapis\.com|googleapis\.com\/(identitytoolkit|securetoken)/.test(url.href)) {
    return; // varsayılan ağ davranışı
  }

  // Sayfa açılışı (navigation) → HER ZAMAN taze HTML (HTTP önbelleğini de atla),
  // sadece internet yoksa önbellekteki index.html'e düş (offline).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req.url, { cache: 'no-store' }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Diğer statik dosyalar (ikon, CDN scriptleri) → önce önbellek, yoksa ağdan çek + sakla
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200 && (url.origin === location.origin || /gstatic\.com/.test(url.host))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => hit))
  );
});
