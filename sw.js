/* IQ Basics — Service Worker (çevrimdışı çalışma + kurulabilir PWA) */
const CACHE = 'iqbasics-v175';

/* Uygulama kabuğu: internet olmasa da açılması gereken dosyalar */
const SHELL = [
  './',
  './index.html',
  './qrcode.js',
  './manifest.webmanifest',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-touch-icon.png',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js'
];

/* KRİTİK dosyalar: önbelleğe alınamazsa kurulum BAŞARISIZ olur (yeni sürüm hazır sayılmaz, eski sürüm çalışmaya devam eder).
   Renk motoru index.html ile aynı sürümde olmalı; HTTP önbelleği atlanır (eski motor yeni önbelleğe girmesin). */
const KRITIK = ['./js/renk-cozumleme.mjs'];
/* İSTEĞE BAĞLI dosyalar: HTTP önbelleği atlanır (eski sürüm karışmasın) ama önbelleğe alınamazsa kurulum BOZULMAZ —
   yalnız o özellik çevrimdışı kullanılamaz. Defter izleme motoru (Defter Kontrolü → Tanılama) yalnız elle açılır. */
const ISTEGE_BAGLI = ['./js/defter-izleme.mjs'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all([
        // tek tek ekle: biri düşse bile kurulum bozulmasın
        ...SHELL.map((u) => c.add(u).catch(() => null)),
        // kritik: hata yutulmaz
        ...KRITIK.map((u) => c.add(new Request(u, { cache: 'reload' }))),
        // isteğe bağlı: hata yutulur
        ...ISTEGE_BAGLI.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null))
      ])
    )
  );
});

/* Yeni sürüm hazır olunca sayfa kullanıcıya sorar; onaylayınca bu mesajla devreye alınır
   (satış ortasında kendiliğinden yenileme olmasın) */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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
        // yalnız başarılı ve gerçekten ana sayfa olan yanıtı sakla (404/başka yol kabuğu bozmasın)
        if (res.ok && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Diğer statik dosyalar (ikon, CDN scriptleri) → önce önbellek, yoksa ağdan çek + sakla
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.status === 200 && (url.origin === location.origin || /gstatic\.com/.test(url.host) || /jsdelivr\.net/.test(url.host))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => Response.error()))
  );
});
