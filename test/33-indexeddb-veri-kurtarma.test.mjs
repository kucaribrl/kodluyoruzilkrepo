// R2.2b.4 (Ders 49) — P0 VERİ KURTARMA: localStorage ↔ IndexedDB açılış kurtarması. GERÇEK açılış akışı (sayfa yükleme / yeniden yükleme).
// Sözleşme (K1–K4 + kapsam kararları; üretim kodu ONAY BEKLİYOR → bu dosya RED):
//   - İçerik aynıysa hiçbir şey yapılmaz. IndexedDB, localStorage'ın İLERİ uzantısıysa (kayıt bazında _m/_tomb karşılaştırması) kurtarılır:
//     önce mevcut localStorage metni IndexedDB'de "yedek_ls_<zaman>" anahtarına yedeklenir (doğrulanır), sonra localStorage'a yazılır
//     (doğrulanır) ve sayfa normal load() yolundan yeniden açılır. Döngü yok. Yalnız zamana bakılmaz; demo (ornek) veri gerçek veri sayılmaz.
//   - Kopyalar farklı yönlerde ilerlemişse / kota dolu / yedek alınamıyor / iki depo da okunamıyorsa: OTOMATİK ÜZERİNE YAZMA YOK;
//     yeni veri IndexedDB "kurtarma_bekleyen" anahtarında korunur; uygulama KİLİTLİ (salt okunur): hiçbir kayıt (localStorage/IndexedDB/bulut)
//     yapılmaz, bulut başlamaz; kilit ekranı neden + "Güvence kopyasını indir" seçeneği sunar; kilit yeniden açılışta yeniden kurulur.
//   - Durum: window.kurtarmaDurumu = { durum: 'bekliyor' | 'tamam' | 'kilitli', neden } (salt okunur).
//   - Bir sekme kurtarma yaparken diğer sekmeler eski veriyi yazamaz (sekmeler arası bildirim → kilit).
//   - Karar 2: kilitte save() özel hata fırlatır (name 'KurtarmaKilidiHatasi', e.kurtarmaKilidi===true); fırlatmadan ÖNCE bellek kilit tabanına
//     döner; hiçbir yerel/bulut yazımı olmaz; çağıranın başarı mesajı / yazdırma / WhatsApp adımları çalışmaz; yakalanmayan hata sayfa hatası
//     üretmez, kilit nedeni gösterilir. Kilit dışında save() eskisi gibi (localStorage hatasında false; Ders 48 geri alması korunur).
//   - Karar 3: kilitte otoYedekGeri / yedekYukle doğrudan çalışmaz; kilit ekranındaki "Yedek dosyasından kurtar" (#kurtarma-dosya) yolu:
//     dosya doğrulanır, özet gösterilir, açık onay (#cYes) istenir; ÖNCE mevcut kopyalar korunur; geçersiz/iptal → kilit kalır, veri değişmez.
// Sentetik veri; localhost dışı istekler engellenir; Firebase yok (yalnız bellek içi sahte nesne). Sunucu rastgele port, sw.js → 404.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  const y = decodeURIComponent(req.url.split('?')[0]);
  if (y.includes('sw.js')) { res.writeHead(404); return res.end(); }
  if (y === '/hazirla') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>hazırlık</title><body>hazırlık</body>'); }
  const p = path.join(ROOT, y === '/' ? 'index.html' : y);
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': /\.m?js$/.test(p) ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));
const URL0 = `http://localhost:${srv.address().port}`;

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };
const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const disari = [], errs = [];
const KEY = 'oztekstil_v2';

// Şema tabanı: uygulamanın kendi seed() alanları (kur, kademe, ayarlar…). Bütün LİSTELER aşağıda sentetik kayıtlarla DEĞİŞTİRİLİR (demo kayıt kalmaz).
const SEED = await (async () => { const ctx = await br.newContext({ serviceWorkers: 'block' }); await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
  const p = await ctx.newPage(); await p.goto(URL0 + '/'); await p.waitForFunction(() => typeof seed === 'function'); const v = await p.evaluate(() => JSON.stringify(seed())); await ctx.close(); return JSON.parse(v); })();
// ---- Sentetik veri sürümleri (gerçek ERP şeması; ESKI → YENI ileri uzantı; DAL = farklı yönde ilerlemiş) ----
const T0 = 1790000000000, T1 = T0 + 3600000, T2 = T0 + 7200000;
const RID = 'r_d1111111-1111-4111-8111-111111111111';
function eski() {
  const taban = JSON.parse(JSON.stringify(SEED)); Object.keys(taban).forEach(k => { if (Array.isArray(taban[k])) taban[k] = []; });
  return { ...taban, ornek: false, firma: 'KURTARMA-ESKI', _t: T0, _tomb: {}, seq: { s: 2000, hr: 2000, cek: 2000 },
    lokasyonlar: [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }],
    urunler: [{ id: 9301, ad: 'Kurtarma Polo', kod: 'KP-1', birim: 'adet', pb: 'TL', alis: 60, satis: 100, kritik: 0, stok: 10, _m: T0,
      renkler: [{ ad: 'Siyah', rid: RID, hex: '#111', stok: 10, loklar: { 'L-ana': 10 } }] }],
    cariler: [{ id: 'c-33', ad: 'Kurtarma Müşteri', tip: 'musteri', bakiye: 0, _m: T0 }],
    hesaplar: [{ id: 'h-33', ad: 'Nakit Kasa', bakiye: 1000, lokId: 'L-ana', _m: T0 }],
    satislar: [{ id: 's-eski', tip: 'satis', lokId: 'L-ana', mid: 'c-33', mus: 'Kurtarma Müşteri', pb: 'TL', tarih: T0, tutar: 100, araToplam: 100, odenen: 0, odemeler: [], _m: T0,
      kalemler: [{ uid: 9301, urun: 'Kurtarma Polo', mik: 1, birim: 'adet', fiyat: 100, renkler: [{ ad: 'Siyah', rid: RID, mik: 1 }] }] }],
    cekler: [], hareketler: [], transferler: [], isemirleri: [], bekleyenPortal: [],
    /* uygulama şemasındaki diğer listeler (seed ile aynı alanlar) — sentetik verinin ekran hatası üretmemesi için */
    hammadde: [], ortakHarcama: [], portalFav: [], portalTaslak: [], duzenliGider: [], malSiparis: [], malKat: [], maliyetler: [], gunSonu: [], poslar: [] };
}
function yeni() { // ESKI'nin ileri uzantısı: kota dolu dönemde yapılan satış (stok, cari, kasa, çek, hareket)
  const d = eski(); d.firma = 'KURTARMA-YENI'; d._t = T1; d.seq = { s: 2001, hr: 2001, cek: 2001 };
  d.urunler[0].renkler[0].loklar['L-ana'] = 7; d.urunler[0].renkler[0].stok = 7; d.urunler[0].stok = 7; d.urunler[0]._m = T1;
  d.cariler[0].bakiye = 250; d.cariler[0]._m = T1; d.hesaplar[0].bakiye = 1030; d.hesaplar[0]._m = T1;
  d.satislar.push({ id: 's-2000', tip: 'satis', lokId: 'L-ana', mid: 'c-33', mus: 'Kurtarma Müşteri', pb: 'TL', tarih: T1, tutar: 300, araToplam: 300, odenen: 50, _m: T1,
    odemeler: [{ tur: 'Nakit', tutar: 30, pb: 'TL', hesapId: 'h-33', _hesapId: 'h-33', _tl: 30 }, { tur: 'Çek', tutar: 20, pb: 'TL', _cekId: 'cek-2000', _tl: 20 }],
    kalemler: [{ uid: 9301, urun: 'Kurtarma Polo', mik: 3, birim: 'adet', fiyat: 100, renkler: [{ ad: 'Siyah', rid: RID, mik: 3 }] }] });
  d.cekler.push({ id: 'cek-2000', tur: 'cek', tip: 'alinan', cariId: 'c-33', tutar: 20, durum: 'portfoyde', _m: T1 });
  d.hareketler.push({ id: 'hr-2000', tarih: T1, hesapId: 'h-33', yon: 'in', tutar: 30, tur: 'Satış Tahsilatı', _m: T1 });
  return d;
}
function dal() { // ESKI'den FARKLI yönde ilerlemiş localStorage: cari başka bir değişiklikle daha yeni (_m T2) — YENI ile çatışır
  const d = eski(); d.firma = 'KURTARMA-DAL'; d._t = T0 + 1000; d.cariler[0].bakiye = -40; d.cariler[0]._m = T2; return d;
}
const js = (o) => JSON.stringify(o);

// ---- Ortam: hazırlık sayfasında depoları kur → uygulamayı aç → kurtarma kararını bekle ----
const IDB_YARDIMCI = `
  window.__idb = { ac: () => new Promise((res, rej) => { const rq = indexedDB.open('iqbasics', 1); rq.onupgradeneeded = () => { try { rq.result.createObjectStore('kv'); } catch (e) {} }; rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); }),
    yaz: async (k, v) => { const d = await __idb.ac(); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); d.close(); },
    oku: async (k) => { const d = await __idb.ac(); const v = await new Promise(res => { const g = d.transaction('kv', 'readonly').objectStore('kv').get(k); g.onsuccess = () => res(g.result === undefined ? null : g.result); g.onerror = () => res(null); }); d.close(); return v; },
    anahtarlar: async () => { const d = await __idb.ac(); const v = await new Promise(res => { const g = d.transaction('kv', 'readonly').objectStore('kv').getAllKeys(); g.onsuccess = () => res(g.result); g.onerror = () => res([]); }); d.close(); return v; } };`;
const KOTA = `(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === '${KEY}') throw new DOMException('kota', 'QuotaExceededError'); return o.apply(this, arguments); }; })();`;
const YEDEK_HATA = `(() => { const o = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (v, k) { if (typeof k === 'string' && (k.startsWith('yedek_') || k.startsWith('kurtarma_'))) throw new DOMException('yedek yazılamadı', 'UnknownError'); return o.apply(this, arguments); }; })();`;
const YEDEK_BOZUK = `(() => { const o = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (v, k) { if (typeof k === 'string' && k.startsWith('yedek_ls_')) return o.call(this, String(v).slice(0, 10), k); return o.apply(this, arguments); }; })();`; /* yedek SESSİZCE bozuk yazılır */
const IDB_YOK = `(() => { const o = IDBFactory.prototype.open; IDBFactory.prototype.open = function () { if (location.pathname !== '/hazirla') throw new DOMException('IndexedDB kullanılamıyor', 'InvalidStateError'); return o.apply(this, arguments); }; })();`;
// Firebase YOK: yalnız bellek içi sahte nesne — bulutBaslat()'ın kilitte Firebase'i hiç başlatmadığını ölçmek için
const SAHTE_FB = `window.__bulut = []; window.firebase = { apps: [], initializeApp() { this.apps.push(1); }, firestore() { const doc = (y) => ({ set: (v) => { __bulut.push({ yol: y, veri: JSON.stringify(v) }); return Promise.resolve(); }, get: () => Promise.resolve({ exists: false }), onSnapshot: () => () => {}, collection: (c) => ({ doc: (d) => doc(y + '/' + c + '/' + d) }) });
  return { enablePersistence: () => Promise.resolve(), collection: (c) => ({ doc: (d) => doc(c + '/' + d), add: (v) => { __bulut.push(c); return Promise.resolve({ id: 'x' }); } }) }; },
  auth() { return { onAuthStateChanged() { return () => {}; }, currentUser: null }; }, storage() { return {}; } };`;

async function ac({ ls, idb, ekIdb = {}, init = [], bekle = true } = {}) {
  const ctx = await br.newContext({ serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return r.continue(); disari.push(h); return r.abort(); });
  await ctx.addInitScript(IDB_YARDIMCI);
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL0 + '/hazirla');
  await page.evaluate(async ([ls, idb, ekIdb, KEY]) => {
    localStorage.clear(); if (ls !== null && ls !== undefined) localStorage.setItem(KEY, ls);
    if (idb !== null && idb !== undefined) await __idb.yaz(KEY, idb); for (const k of Object.keys(ekIdb)) await __idb.yaz(k, ekIdb[k]);
  }, [ls, idb, ekIdb, KEY]);
  for (const s of init) await ctx.addInitScript(s);
  let gezinme = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) gezinme++; });
  await page.goto(URL0 + '/');
  const S = { ctx, page, gezinme: () => gezinme, ev: (f, a) => page.evaluate(f, a).catch(e => ({ HATA: String(e.message).slice(0, 200) })) };
  if (bekle) await kararBekle(S);
  return S;
}
async function kararBekle(S, ms = 8000) {
  const son = Date.now() + ms;
  while (Date.now() < son) {
    try { await S.page.waitForLoadState('load'); const d = await S.page.evaluate(() => window.kurtarmaDurumu && window.kurtarmaDurumu.durum); if (d && d !== 'bekliyor') { await S.page.waitForTimeout(300); return d; } } catch (e) {}
    await S.page.waitForTimeout(150);
  }
  return null;
}
const durum = (S) => S.ev(async (KEY) => { let ls = localStorage.getItem(KEY), lsj = null; try { lsj = JSON.parse(ls); } catch (e) {}
  const guv = async (f, v) => { try { return await f(); } catch (e) { return v; } };
  const idb = await guv(() => __idb.oku(KEY), null), kb = await guv(() => __idb.oku('kurtarma_bekleyen'), null), anah = await guv(() => __idb.anahtarlar(), []);
  const ozet = (d) => d && typeof d === 'object' ? { firma: d.firma, ornek: !!d.ornek, satis: (d.satislar || []).map(s => s.id).sort().join(','), stok: d.urunler && d.urunler[0] && d.urunler[0].renkler && d.urunler[0].renkler[0] ? d.urunler[0].renkler[0].loklar['L-ana'] : null,
    bakiye: d.cariler && d.cariler[0] ? d.cariler[0].bakiye : null, kasa: d.hesaplar && d.hesaplar[0] ? d.hesaplar[0].bakiye : null, cek: (d.cekler || []).length, hr: (d.hareketler || []).length } : d;
  const kd = window.kurtarmaDurumu || null;
  return { bellek: ozet(typeof db !== 'undefined' ? db : null), ls: lsj ? ozet(lsj) : (ls === null ? null : 'BOZUK:' + ls.slice(0, 20)), lsHam: ls, idb: idb ? (() => { try { return ozet(JSON.parse(idb)); } catch (e) { return 'BOZUK'; } })() : null, idbHam: idb,
    kurtarmaBekleyen: kb, anahtarlar: anah, yedekler: anah.filter(k => String(k).startsWith('yedek_ls_')), kd: kd ? { durum: kd.durum, neden: kd.neden } : null,
    ekran: (document.getElementById('kurtarma-ekran') || {}).innerText || '', toast: (document.getElementById('toast') || {}).textContent || '' }; }, KEY);
const YENI_OZET = { firma: 'KURTARMA-YENI', ornek: false, satis: 's-2000,s-eski', stok: 7, bakiye: 250, kasa: 1030, cek: 1, hr: 1 };
const ESKI_OZET = { firma: 'KURTARMA-ESKI', ornek: false, satis: 's-eski', stok: 10, bakiye: 0, kasa: 1000, cek: 0, hr: 0 };
const esit = (a, b) => js(a) === js(b);
const dosyaSec = (S, f) => S.page.setInputFiles('#kurtarma-dosya', f, { timeout: 4000 }); /* kilit ekranındaki yedek dosyası seçici */
const kilitli = (d) => d && d.kd && d.kd.durum === 'kilitli' && /kurtarma/i.test(d.ekran) && /güvence kopyasını indir/i.test(d.ekran);

// ===== 1. localStorage boş + IndexedDB gerçek veri =====
let S = await ac({ ls: null, idb: js(yeni()) }); let d = await durum(S);
T('K1 localStorage boşken IndexedDB\'deki gerçek veri yüklenir (demo veri değil)', esit(d.bellek, YENI_OZET), d.bellek);
T('K2 kurtarılan veri localStorage\'a yazılır (bellek = localStorage = IndexedDB)', esit(d.ls, YENI_OZET) && esit(d.idb, YENI_OZET), { ls: d.ls, idb: d.idb });
T('K3 kurtarma tamamlandı durumu ve kullanıcı bildirimi', d.kd && d.kd.durum === 'tamam' && /kurtar|geri yüklendi/i.test(d.toast + d.ekran), { kd: d.kd, toast: d.toast });
const k4 = await S.ev(async (KEY) => { save(); await new Promise(r => setTimeout(r, 1300)); const i = JSON.parse(await __idb.oku(KEY)); return { firma: i.firma, ornek: !!i.ornek, satis: i.satislar.map(s => s.id).sort().join(',') }; }, KEY);
T('K4 ilk kayıt IndexedDB\'deki gerçek veriyi demo veriyle EZMEZ', k4.firma === 'KURTARMA-YENI' && !k4.ornek && k4.satis === 's-2000,s-eski', k4);
await S.ctx.close();

// ===== 2. IndexedDB daha yeni (ileri uzantı) =====
S = await ac({ ls: js(eski()), idb: js(yeni()) }); d = await durum(S);
T('K5 IndexedDB ileri uzantıysa kurtarılır (satış, stok 7, cari 250, kasa 1030, çek 1, hareket 1)', esit(d.bellek, YENI_OZET), d.bellek);
T('K6 kurtarmadan önce eski localStorage IndexedDB\'de "yedek_ls_*" anahtarına BİREBİR yedeklenir', d.yedekler.length === 1 && (await S.ev(async (k) => await __idb.oku(k), d.yedekler[0])) === js(eski()), d.yedekler);
T('K7 localStorage kurtarılan veriyle güncellenir; yedek localStorage kotası tüketmez (localStorage\'da yalnız ana anahtar büyüdü)', esit(d.ls, YENI_OZET) && (await S.ev(() => Object.keys(localStorage).filter(k => /^(yedek_ls_|kurtarma_)/.test(k)).length)) === 0, d.ls); /* iq_yedekler: uygulamanın mevcut otomatik yedeği, kurtarmayla ilgisiz */
T('K8 kurtarma normal load() yolundan geçer (sayaç düzeltilir: yeni hareket kimliği mevcutla çakışmaz)', (await S.ev(() => { const n = nid('hr'); return !db.hareketler.some(h => h.id === n) && !/hr-2000$/.test(String(n)); })) === true, null);
T('K9 kurtarılan kayıtların değişiklik damgaları (_m) ve sayaçları korunur', (await S.ev(() => [db.urunler[0]._m, db.cariler[0]._m, db.satislar.find(s => s.id === 's-2000')._m].join())) === [T1, T1, T1].join(), null);
T('K10 değişiklik tabanı kuruldu: sonraki kayıt kurtarılan kayıtlara yanlış damga vurmaz', (await S.ev(() => { const m = db.cariler[0]._m; save(); return db.cariler[0]._m === m; })) === true, null);
T('K11 yeniden yükleme döngüsü yok (en fazla bir kurtarma yeniden yüklemesi)', S.gezinme() <= 2, S.gezinme());
const k12 = await S.ev(async (KEY) => { location.reload(); }, KEY).catch(() => null); await kararBekle(S); d = await durum(S);
T('K12 kurtarma sonrası tekrar açılışta yeni kurtarma / yedek yapılmaz (idempotent)', d.kd && d.kd.durum === 'tamam' && d.yedekler.length === 1 && esit(d.bellek, YENI_OZET), d);
await S.ctx.close();

// ===== 3. localStorage daha yeni / eşit içerik =====
S = await ac({ ls: js(yeni()), idb: js(eski()) }); d = await durum(S);
T('K13 localStorage daha yeniyse IndexedDB YOK SAYILIR (yeni veri korunur, yedek yok)', esit(d.bellek, YENI_OZET) && d.yedekler.length === 0 && d.kd && d.kd.durum === 'tamam', d);
await S.ctx.close();
{ const y = yeni(); y._t = T1 + 999999; S = await ac({ ls: js(yeni()), idb: js(y) }); d = await durum(S); }
T('K14 içerik aynıysa (yalnız _t farklı) hiçbir şey yapılmaz: yedek yok, yeniden yükleme yok', esit(d.bellek, YENI_OZET) && d.yedekler.length === 0 && S.gezinme() <= 1 && d.kd && d.kd.durum === 'tamam', { d, g: S.gezinme() });
await S.ctx.close();
{ const y = eski(); y._t = T2 + 999999; S = await ac({ ls: js(yeni()), idb: js(y) }); d = await durum(S); }
T('K15 yalnız zaman damgası daha yeni olan ESKİ içerik kurtarılmaz (zamana tek başına güvenilmez)', esit(d.bellek, YENI_OZET) && esit(d.ls, YENI_OZET) && d.yedekler.length === 0, d);
await S.ctx.close();
{ const o = yeni(); o.ornek = true; o.firma = 'IQ Basics'; o._t = T2; S = await ac({ ls: js(eski()), idb: js(o) }); d = await durum(S); }
T('K16 demo (ornek) IndexedDB kopyası gerçek localStorage verisinin yerine geçmez', esit(d.bellek, ESKI_OZET) && d.yedekler.length === 0, d.bellek);
await S.ctx.close();

// ===== 4. Bozuk JSON =====
S = await ac({ ls: '{bozuk-json', idb: js(yeni()) }); d = await durum(S);
T('K17 localStorage bozukken IndexedDB\'den kurtarılır (demo veri yok)', esit(d.bellek, YENI_OZET) && esit(d.ls, YENI_OZET), d.bellek);
T('K18 bozuk localStorage metni IndexedDB yedeğine birebir alınır', d.yedekler.length === 1 && (await S.ev(async (k) => await __idb.oku(k), d.yedekler[0])) === '{bozuk-json', d.yedekler);
await S.ctx.close();
S = await ac({ ls: js(eski()), idb: '{bozuk' }); d = await durum(S);
T('K19 IndexedDB bozukken sağlam localStorage korunur; kilit yok', esit(d.bellek, ESKI_OZET) && esit(d.ls, ESKI_OZET) && d.kd && d.kd.durum === 'tamam', d);
T('K20 bozuk IndexedDB kullanıcıya bildirilir (güvence kopyası okunamadı)', /güvence|indexeddb|okunamad/i.test(d.toast + d.ekran), d.toast);
await S.ctx.close();

// ===== 5. Farklı yönlerde ilerlemiş kopyalar (belirsiz) =====
S = await ac({ ls: js(dal()), idb: js(yeni()) }); d = await durum(S);
T('K21 iki kopya farklı yönlerde ilerlemişse otomatik üzerine yazma YOK (localStorage aynen kalır)', d.lsHam === js(dal()), d.ls);
T('K22 IndexedDB ana kaydı korunur ve yeni veri "kurtarma_bekleyen" anahtarında saklanır', d.idbHam === js(yeni()) && d.kurtarmaBekleyen === js(yeni()), { idb: d.idb, kb: !!d.kurtarmaBekleyen });
T('K23 belirsiz durumda uygulama KİLİTLİ; kilit ekranı nedeni (belirsiz/çatışma) gösterir', kilitli(d) && /belirsiz|çatış|farklı/i.test(d.ekran + (d.kd && d.kd.neden || '')), { kd: d.kd, ekran: d.ekran });
// kilitli modda veri değiştiren işlemler
const kil = await S.ev(async (KEY) => { const once = JSON.stringify(db), lsOnce = localStorage.getItem(KEY), idbOnce = await __idb.oku(KEY); const sonuc = {};
  try { $('toast').textContent = ''; silSatis('s-eski'); const t = $('kk-txt'); if (t) { t.value = 'SİL'; await kritikOnayla(); } } catch (e) { sonuc.iptalHata = e.message; }
  sonuc.iptalToast = $('toast').textContent;
  try { kasaHareket('h-33', 'in', 50, 'Test', 'kilit', null, 'L-ana'); save(); } catch (e) { sonuc.kasaHata = e.message; }
  try { formSatis(); sMusId = 'c-33'; sUrunId = 9301; urnBilgi(); const el = $('rq-0'); if (el) el.value = '2'; sepEkle(); $('toast').textContent = ''; kaydetSatis(); } catch (e) { sonuc.satisHata = e.message; }
  sonuc.satisToast = $('toast').textContent;
  try { transferStokUygula([{ uid: 9301, renk: 'Siyah', adet: 1 }], 'L-ana', -1); save(); } catch (e) { sonuc.transferHata = e.message; }
  await new Promise(r => setTimeout(r, 1300));
  sonuc.bellekAyni = JSON.stringify(db) === once; sonuc.lsAyni = localStorage.getItem(KEY) === lsOnce; sonuc.idbAyni = (await __idb.oku(KEY)) === idbOnce; sonuc.save = (() => { try { save(); return 'dondu'; } catch (e) { return e && e.kurtarmaKilidi ? e.name : 'baska:' + (e && e.name); } })(); return sonuc; }, KEY);
T('K24 kilitte satış iptali yapılamaz; kullanıcıya kurtarma/salt okunur nedeni gösterilir', kil && !/iptal edildi ✓/.test(kil.iptalToast || '') && /kurtarma|salt okunur/i.test(kil.iptalToast || ''), kil);
T('K25 kilitte yeni satış oluşturulamaz (eski/demo veriyle işlem yok); neden gösterilir', kil && !/kaydedildi ✓/.test(kil.satisToast || '') && /kurtarma|salt okunur/i.test(kil.satisToast || ''), kil);
T('K26 kilitte satış / iptal / tahsilat / transfer sonrası bellek DEĞİŞMEZ', kil && kil.bellekAyni === true, kil);
/* Karar 2 ile güncellendi: kilitte save() false yerine KurtarmaKilidiHatasi fırlatır */
T('K27 kilitte localStorage ve IndexedDB\'ye hiçbir şey yazılmaz; save() KurtarmaKilidiHatasi ile durur', kil && kil.lsAyni === true && kil.idbAyni === true && kil.save === 'KurtarmaKilidiHatasi', kil);
await S.ctx.close();
// kilit yeniden açılışta yeniden kurulur
S = await ac({ ls: js(dal()), idb: js(yeni()), ekIdb: { kurtarma_bekleyen: js(yeni()) } }); d = await durum(S);
T('K28 kilit yeniden açılışta güvenle yeniden kurulur (kendiliğinden kalkmaz)', kilitli(d) && d.lsHam === js(dal()), d.kd);
await S.ctx.close();

// ===== 6. Kota dolu =====
S = await ac({ ls: js(eski()), idb: js(yeni()), init: [KOTA] }); d = await durum(S);
T('K29 kota doluyken (localStorage yazılamıyor) otomatik kurtarma yapılmaz; IndexedDB yeni veri korunur', d.idbHam === js(yeni()) && d.kurtarmaBekleyen === js(yeni()), { idb: d.idb });
T('K30 kota dolu → uygulama kilitli; neden (kota / depolama) gösterilir', kilitli(d) && /kota|depolama|yer/i.test(d.ekran + (d.kd && d.kd.neden || '')), { kd: d.kd, ekran: d.ekran });
const k31 = await S.ev(async (KEY) => { const once = await __idb.oku(KEY); kasaHareket('h-33', 'in', 5, 'Test', 'k', null, 'L-ana'); try { save(); } catch (e) {} await new Promise(r => setTimeout(r, 1300)); return (await __idb.oku(KEY)) === once; }, KEY);
T('K31 kota dolu kilitte kullanıcı işlemi IndexedDB\'deki yeni veriyi ezmez', k31 === true, k31);
await S.ctx.close();

// ===== 7. Yedek alınamıyor =====
S = await ac({ ls: js(eski()), idb: js(yeni()), init: [YEDEK_HATA] }); d = await durum(S);
T('K32 yedek yazılamıyorsa otomatik kurtarma YAPILMAZ: localStorage aynen eski', d.lsHam === js(eski()), d.ls);
T('K33 yedek yazılamıyorsa IndexedDB yeni veri korunur ve uygulama kilitlenir', d.idbHam === js(yeni()) && kilitli(d), { kd: d.kd, idb: d.idb });
await S.ctx.close();

// ===== 8. İki depo da kullanılamıyor / yeni cihaz =====
S = await ac({ ls: '{bozuk', idb: null, init: [IDB_YOK] }); d = await durum(S);
T('K34 localStorage bozuk ve IndexedDB kullanılamıyorsa demo veriyle devam edilmez; kilit + "veri okunamadı"', kilitli(d) && /okunamad|bozuk/i.test(d.ekran + (d.kd && d.kd.neden || '')), { kd: d.kd, ekran: d.ekran });
const k35 = await S.ev(async (KEY) => { try { save(); } catch (e) {} await new Promise(r => setTimeout(r, 300)); return localStorage.getItem(KEY); }, KEY);
T('K35 bozuk localStorage metni demo veriyle ezilmez', k35 === '{bozuk', k35);
await S.ctx.close();
S = await ac({ ls: null, idb: null }); d = await durum(S);
T('K36 iki depo da boşsa (yeni cihaz) demo veriyle normal açılır; kilit yok', d.bellek && d.bellek.ornek === true && d.kd && d.kd.durum === 'tamam' && !kilitli(d), d);
await S.ctx.close();

// ===== 9. Kurtarma sırasında sayfa kapanması =====
const oncekiYedek = js({ not: 'önceki kurtarma denemesinden kalan yedek' });
S = await ac({ ls: js(eski()), idb: js(yeni()), ekIdb: { yedek_ls_1790000000001: oncekiYedek } }); d = await durum(S);
T('K37 önceki denemede yedek alınıp sayfa kapanmışsa: kurtarma yeniden ve doğru tamamlanır', esit(d.bellek, YENI_OZET) && esit(d.ls, YENI_OZET), d.bellek);
T('K38 önceki yedek EZİLMEZ (yeni yedek ayrı anahtarda)', d.yedekler.length === 2 && (await S.ev(async () => await __idb.oku('yedek_ls_1790000000001'))) === oncekiYedek, d.yedekler);
await S.ctx.close();
S = await ac({ ls: js(yeni()), idb: js(yeni()), ekIdb: { yedek_ls_1790000000002: js(eski()) } }); d = await durum(S);
T('K39 localStorage yazıldıktan sonra kapanmışsa: veriler korunur, yeniden kurtarma/yedek yapılmaz', esit(d.bellek, YENI_OZET) && d.yedekler.length === 1 && d.kd && d.kd.durum === 'tamam', d);
await S.ctx.close();

// ===== 10. İki sekme =====
{ const ctx = await br.newContext({ serviceWorkers: 'block' }); await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; if (h === 'localhost') return r.continue(); disari.push(h); return r.abort(); });
  await ctx.addInitScript(IDB_YARDIMCI);
  const a = await ctx.newPage(); a.on('pageerror', e => errs.push(e.message)); await a.goto(URL0 + '/hazirla');
  await a.evaluate(async ([e, KEY]) => { localStorage.clear(); localStorage.setItem(KEY, e); await __idb.yaz(KEY, e); }, [js(eski()), KEY]);
  await a.goto(URL0 + '/'); await a.waitForFunction(() => typeof db !== 'undefined'); await a.waitForTimeout(800);
  await a.evaluate(async ([y, KEY]) => { await __idb.yaz(KEY, y); }, [js(yeni()), KEY]); /* sekme A açıkken IndexedDB'de daha yeni veri oluşmuş */
  const b = await ctx.newPage(); b.on('pageerror', e => errs.push(e.message)); await b.goto(URL0 + '/'); await kararBekle({ page: b });
  const bD = await b.evaluate((KEY) => { const d = JSON.parse(localStorage.getItem(KEY)); return { firma: db.firma, ls: d.firma }; }, KEY).catch(e => ({ HATA: e.message }));
  T('K40 ikinci sekme kurtarmayı yapar (B: bellek ve localStorage YENİ)', bD.firma === 'KURTARMA-YENI' && bD.ls === 'KURTARMA-YENI', bD);
  const aD = await a.evaluate(async (KEY) => { await new Promise(r => setTimeout(r, 500)); $('toast').textContent = ''; kasaHareket('h-33', 'in', 9, 'Test', 'eski sekme', null, 'L-ana'); const s = (() => { try { save(); return 'dondu'; } catch (e) { return e && e.kurtarmaKilidi ? e.name : 'baska:' + (e && e.name); } })(); await new Promise(r => setTimeout(r, 1300));
    const ls = JSON.parse(localStorage.getItem(KEY)), i = JSON.parse(await __idb.oku(KEY)); return { save: s, ls: ls.firma, idb: i.firma, kd: window.kurtarmaDurumu && window.kurtarmaDurumu.durum, mesaj: ((document.getElementById('kurtarma-ekran') || {}).innerText || '') + $('toast').textContent }; }, KEY).catch(e => ({ HATA: e.message }));
  T('K41 kurtarma sırasında/sonrasında ESKİ sekme kayıt denerse kurtarılan veri ezilmez (localStorage ve IndexedDB YENİ kalır)', aD.ls === 'KURTARMA-YENI' && aD.idb === 'KURTARMA-YENI' && aD.save === 'KurtarmaKilidiHatasi', aD);
  T('K42 eski sekme kilitlenir ve "başka sekmede kurtarıldı — yenileyin" bildirilir', aD.kd === 'kilitli' && /sekme|yenile/i.test(aD.mesaj || ''), aD);
  await ctx.close(); }

// ===== 11. Kurtarma tamamlanmadan bulut =====
S = await ac({ ls: js(dal()), idb: js(yeni()), init: [SAHTE_FB] }); d = await durum(S);
const bul = await S.ev(() => ({ baslat: bulutBaslat(), fb: _fb === null, yazim: (window.__bulut || []).length, apps: firebase.apps.length }));
T('K43 kilit/kurtarma çözümsüzken bulut başlatılmaz (bulutBaslat false, Firebase kurulmaz, yazım 0)', bul.baslat === false && bul.fb === true && bul.yazim === 0 && bul.apps === 0, bul);
const bul2 = await S.ev(async () => { try { canliYazHemen(['satis', 'stok']); } catch (e) {} try { await otoSenkron(); } catch (e) {} return (window.__bulut || []).length; });
T('K44 kilitte canliYazHemen / otoSenkron buluta HİÇBİR şey göndermez', bul2 === 0, bul2);
await S.ctx.close();
S = await ac({ ls: js(eski()), idb: js(yeni()), init: [SAHTE_FB] }); d = await durum(S);
T('K45 başarılı kurtarmadan sonra bulut kapısı açılır (bulutBaslat yeniden kullanılabilir)', d.kd && d.kd.durum === 'tamam' && (await S.ev(() => bulutBaslat())) === true, d.kd);
await S.ctx.close();

// ===== 12. Güvence kopyasını indirme =====
S = await ac({ ls: js(dal()), idb: js(yeni()) }); d = await durum(S);
let indirme = null, uyari = '', indirOnce = null; const disariIndirOnce = disari.length;
try {
  indirOnce = await S.ev(async (KEY) => ({ ls: localStorage.getItem(KEY), idb: await __idb.oku(KEY), kb: await __idb.oku('kurtarma_bekleyen') }), KEY);
  const dugme = S.page.getByText(/güvence kopyasını indir/i).first(); await dugme.click({ timeout: 3000 });
  uyari = await S.page.evaluate(() => (document.getElementById('cMsg') || {}).textContent || '');
  const [dl] = await Promise.all([S.page.waitForEvent('download', { timeout: 5000 }), S.page.click('#cYes')]);
  const yol = await dl.path(); indirme = { ad: dl.suggestedFilename(), icerik: fs.readFileSync(yol, 'utf8') };
} catch (e) { indirme = { HATA: String(e.message).slice(0, 150) }; }
T('K46 indirmeden önce dosyanın hassas müşteri ve finans bilgisi içerdiği bildirilir', /hassas/i.test(uyari) && /müşteri|finans|cari/i.test(uyari), uyari);
T('K47 indirilen dosya adı tarih ve saat içerir (iqbasics-guvence-YYYY-AA-GG_SS-DD*.json)', indirme && /^iqbasics-guvence-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}.*\.json$/.test(indirme.ad || ''), indirme && indirme.ad);
T('K48 dosya gerçek IndexedDB güvence kopyasından oluşturulur (içerik birebir)', indirme && indirme.icerik === js(yeni()), indirme && (indirme.HATA || (indirme.icerik || '').slice(0, 60)));
const indirSonra = await S.ev(async (KEY) => ({ ls: localStorage.getItem(KEY), idb: await __idb.oku(KEY), kb: await __idb.oku('kurtarma_bekleyen') }), KEY);
T('K49 indirme verileri değiştirmez ve dışarıya istek göndermez', indirme && !indirme.HATA && indirOnce && esit(indirOnce, indirSonra) && disari.length === disariIndirOnce, { degisti: !esit(indirOnce, indirSonra), yeniIstek: disari.length - disariIndirOnce });
await S.ctx.close();

// ===== 13. Kurtarma sonrası normal işlemler =====
S = await ac({ ls: js(eski()), idb: js(yeni()) }); d = await durum(S);
const nor = await S.ev(async (KEY) => { $('toast').textContent = ''; formSatis(); sMusId = 'c-33'; sUrunId = 9301; urnBilgi(); const el = $('rq-0'); if (el) el.value = '2'; sepEkle(); kaydetSatis(); const t = $('toast').textContent;
  await new Promise(r => setTimeout(r, 1300)); const ls = JSON.parse(localStorage.getItem(KEY)), i = JSON.parse(await __idb.oku(KEY));
  return { t, n: db.satislar.length, lsN: ls.satislar.length, idbN: i.satislar.length, stok: db.urunler[0].renkler[0].loklar['L-ana'] }; }, KEY);
T('K50 kurtarma sonrası normal satış yeniden yapılabilir ve localStorage + IndexedDB\'ye kaydedilir', nor && /kaydedildi/i.test(nor.t || '') && nor.n === 3 && nor.lsN === 3 && nor.idbN === 3 && nor.stok === 5, nor);
T('K51 kurtarma sonrası kilit ekranı yok', !(await S.ev(() => !!document.getElementById('kurtarma-ekran') && document.getElementById('kurtarma-ekran').offsetParent !== null)), null);
await S.ctx.close();

// ===== 14. Bütünlük ayrıntıları (ileri kurtarma) =====
S = await ac({ ls: js(eski()), idb: js(yeni()) });
const bt = await S.ev(() => { const s = db.satislar.find(x => x.id === 's-2000'); return { odeme: s && s.odemeler.map(l => [l._hesapId || null, l._cekId || null]), cek: db.cekler.map(c => c.id), hr: db.hareketler.map(h => h.id), renkStok: db.urunler[0].renkler[0].stok, urunStok: db.urunler[0].stok, aktif: aktifLok, tomb: JSON.stringify(db._tomb || {}) }; });
T('K52 satışın ödeme bağları (kasa + çek) kurtarılan kayıtlarla tutarlı', bt && js(bt.odeme) === js([['h-33', null], [null, 'cek-2000']]) && js(bt.cek) === js(['cek-2000']) && js(bt.hr) === js(['hr-2000']), bt);
T('K53 stok yansıması (aktif lokasyon .stok) kurtarılan lokasyon stoğuyla aynı (load() normalleştirmesi)', bt && bt.aktif === 'L-ana' && bt.renkStok === 7 && bt.urunStok === 7, bt);
T('K54 kurtarma mezar taşı / silme izi üretmez', bt && bt.tomb === '{}', bt && bt.tomb);
await S.ctx.close();

// ===== 16. Kilitte özel hata ve merkezi bellek geri alma (Karar 2) =====
S = await ac({ ls: js(dal()), idb: js(yeni()) });
const h58 = await S.ev(async (KEY) => { const r = {}; const once = JSON.stringify(db), lsOnce = localStorage.getItem(KEY), idbOnce = await __idb.oku(KEY);
  db.cariler[0].bakiye = 999999; db.satislar.push({ id: 's-hayalet' });
  try { save(); r.atti = false; } catch (e) { r.ad = e && e.name; r.isaret = !!(e && e.kurtarmaKilidi); r.atti = true; }
  await new Promise(x => setTimeout(x, 1200)); r.bellekGeri = JSON.stringify(db) === once; r.lsAyni = localStorage.getItem(KEY) === lsOnce; r.idbAyni = (await __idb.oku(KEY)) === idbOnce; return r; }, KEY);
T('K58 kilitte save() ayırt edilebilir özel hata fırlatır (KurtarmaKilidiHatasi, kurtarmaKilidi işareti)', h58 && h58.atti === true && h58.ad === 'KurtarmaKilidiHatasi' && h58.isaret === true, h58);
T('K59 save() çağrısından ÖNCE değiştirilmiş bellek merkezi olarak geri alınır; localStorage / IndexedDB yazılmaz', h58 && h58.bellekGeri === true && h58.lsAyni === true && h58.idbAyni === true, h58);
const h60 = await S.ev(async (KEY) => { const once = JSON.stringify(db), lsOnce = localStorage.getItem(KEY), idbOnce = await __idb.oku(KEY); db.satisTaslak = { sepet: [1] }; let hata = null;
  try { satisTaslakSil(); } catch (e) { hata = e.name; } await new Promise(x => setTimeout(x, 1200));
  return { hata, bellek: JSON.stringify(db) === once, ls: localStorage.getItem(KEY) === lsOnce, idb: (await __idb.oku(KEY)) === idbOnce }; }, KEY);
T('K60 hatayı kendi catch\'inde YUTAN çağrı noktası (satisTaslakSil) da başarı sayılmaz: bellek geri, depolar aynı', h60 && h60.bellek === true && h60.ls === true && h60.idb === true, h60);
const h61 = await S.ev(async () => { const say = { yaz: 0, wa: 0, takip: 0 }; const o1 = window.yaziciyaGonder, o2 = window.waAc, o3 = window.sipTakipBaslat;
  window.yaziciyaGonder = function () { say.yaz++; }; window.waAc = function () { say.wa++; }; window.sipTakipBaslat = function () { say.takip++; };
  $('toast').textContent = ''; let hata = null;
  try { db.otoYazdir = true; formSatis(); sMusId = 'c-33'; sUrunId = 9301; urnBilgi(); const el = $('rq-0'); if (el) el.value = '2'; sepEkle(); kaydetSatis(); } catch (e) { hata = e.name; }
  await new Promise(x => setTimeout(x, 900)); const t = $('toast').textContent; window.yaziciyaGonder = o1; window.waAc = o2; window.sipTakipBaslat = o3; return { hata, t, say, n: db.satislar.length }; });
T('K61 kilitte kaydetSatis hatayla durur: "kaydedildi ✓" yok, yazdırma / WhatsApp / sipariş takibi çağrılmaz, satış eklenmez', h61 && h61.hata === 'KurtarmaKilidiHatasi' && !/kaydedildi ✓/.test(h61.t || '') && h61.say.yaz === 0 && h61.say.wa === 0 && h61.say.takip === 0 && h61.n === 1, h61);
const hataOnce62 = errs.length;
const h62 = await S.ev(async () => { $('toast').textContent = ''; setTimeout(() => { db.cariler[0].bakiye = 5; save(); }, 0); await new Promise(x => setTimeout(x, 500));
  return { mesaj: $('toast').textContent + ((document.getElementById('kurtarma-ekran') || {}).innerText || ''), bakiye: db.cariler[0].bakiye }; });
T('K62 yakalanmayan kilit hatası sayfa hatası üretmez; bellek geri alınır ve kilit nedeni gösterilir', h62 && errs.length === hataOnce62 && h62.bakiye === -40 && /kurtarma|salt okunur/i.test(h62.mesaj || ''), { h62, yeniHata: errs.slice(hataOnce62) });
// Karar 3: normal yedek yükleme fonksiyonları kilitte doğrudan çalışmaz
const h63 = await S.ev(async ([KEY, e]) => { const lsOnce = localStorage.getItem(KEY), idbOnce = await __idb.oku(KEY);
  localStorage.setItem('iq_yedekler', JSON.stringify([{ t: 1, etiket: 'test', veri: e }]));
  try { otoYedekGeri(0); const y = $('cYes'); if (y && document.getElementById('cov') && getComputedStyle(document.getElementById('cov')).display !== 'none') y.click(); } catch (x) {}
  try { const inp = { files: [new File([e], 'yedek.json', { type: 'application/json' })], value: 'x' }; yedekYukle(inp); await new Promise(x => setTimeout(x, 300)); const y = $('cYes'); if (y && getComputedStyle(document.getElementById('cov')).display !== 'none') y.click(); } catch (x) {}
  await new Promise(x => setTimeout(x, 1200)); localStorage.removeItem('iq_yedekler');
  return { ls: localStorage.getItem(KEY) === lsOnce, idb: (await __idb.oku(KEY)) === idbOnce, kd: window.kurtarmaDurumu && window.kurtarmaDurumu.durum }; }, [KEY, js(eski())]);
T('K63 kilitte otoYedekGeri / yedekYukle doğrudan çalışmaz (localStorage ve IndexedDB aynı, kilit sürer)', h63 && h63.ls === true && h63.idb === true && h63.kd === 'kilitli', h63);
// Karar 3: kilit ekranından kontrollü yedek geri yükleme
const kopya64 = await S.ev(async (KEY) => ({ ls: localStorage.getItem(KEY), idb: await __idb.oku(KEY) }), KEY);
let h64 = null; try { await dosyaSec(S, { name: 'bozuk.json', mimeType: 'application/json', buffer: Buffer.from('{bozuk') }); await S.page.waitForTimeout(500);
  h64 = await S.ev(async (KEY) => ({ ls: localStorage.getItem(KEY), idb: await __idb.oku(KEY), kd: window.kurtarmaDurumu.durum, mesaj: $('toast').textContent + ((document.getElementById('kurtarma-ekran') || {}).innerText || '') }), KEY); } catch (e) { h64 = { HATA: String(e.message).slice(0, 120) }; }
T('K64 geçersiz yedek dosyası reddedilir; kilit kalkmaz, veriler değişmez, neden bildirilir', h64 && h64.kd === 'kilitli' && h64.ls === kopya64.ls && h64.idb === kopya64.idb && /geçersiz|bozuk|okunamad/i.test(h64.mesaj || ''), h64);
let h65 = null; try { await dosyaSec(S, { name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(js(yeni())) }); await S.page.waitForTimeout(500);
  h65 = await S.ev(async () => ({ ozet: (document.getElementById('cMsg') || {}).textContent || '', anah: await __idb.anahtarlar() })); await S.page.click('#cNo'); await S.page.waitForTimeout(500);
  h65.sonra = await S.ev(async (KEY) => ({ ls: localStorage.getItem(KEY), kd: window.kurtarmaDurumu.durum }), KEY); } catch (e) { h65 = { HATA: String(e.message).slice(0, 120) }; }
T('K65 geçerli yedek için önce özet (kayıt sayıları / tarih) gösterilir ve açık onay istenir; vazgeçilirse hiçbir şey değişmez', h65 && /satış|ürün|cari/i.test(h65.ozet || '') && h65.sonra && h65.sonra.ls === kopya64.ls && h65.sonra.kd === 'kilitli', h65);
let h66 = null; try { await dosyaSec(S, { name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(js(yeni())) }); await S.page.waitForTimeout(500);
  await Promise.all([S.page.waitForNavigation({ timeout: 10000 }), S.page.click('#cYes')]); await kararBekle(S); h66 = await durum(S); h66.korunan = await S.ev(async () => ({ kb: await __idb.oku('kurtarma_bekleyen'), arsiv: await Promise.all((await __idb.anahtarlar()).filter(k => String(k).startsWith('kurtarma_arsiv_')).map(k => __idb.oku(k))), yedekler: await Promise.all((await __idb.anahtarlar()).filter(k => String(k).startsWith('yedek_ls_')).map(k => __idb.oku(k))) })); } catch (e) { h66 = { HATA: String(e.message).slice(0, 120) }; }
T('K66 onaylanan yedek geri yüklemeden ÖNCE mevcut kopyalar korunur (localStorage yedeği + korumalı IndexedDB kopyası arşivde) ve kurtarma tamamlanınca bekleyen kilit anahtarı kalkar', h66 && h66.kd && h66.kd.durum === 'tamam' && esit(h66.bellek, YENI_OZET) && h66.korunan && h66.korunan.yedekler.includes(js(dal())) && h66.korunan.arsiv.includes(js(yeni())) && h66.korunan.kb === null, h66 && (h66.HATA || h66.kd));
await S.ctx.close();
// başarısız geri yükleme kilidi kaldırmaz (yedek alınamıyor ortamında)
S = await ac({ ls: js(dal()), idb: js(yeni()), init: [YEDEK_HATA] });
let h67 = null; try { await dosyaSec(S, { name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(js(yeni())) }); await S.page.waitForTimeout(500);
  await S.page.click('#cYes'); await S.page.waitForTimeout(1200); h67 = await S.ev(async (KEY) => ({ ls: localStorage.getItem(KEY), kd: window.kurtarmaDurumu.durum }), KEY); } catch (e) { h67 = { HATA: String(e.message).slice(0, 120) }; }
T('K67 mevcut kopyalar korunamazsa (yedek yazılamıyor) geri yükleme yapılmaz ve kilit kalkmaz', h67 && h67.kd === 'kilitli' && h67.ls === js(dal()), h67);
await S.ctx.close();

// ===== 17. İki sekmenin AYNI ANDA kayıt denemesi =====
{ const ctx = await br.newContext({ serviceWorkers: 'block' }); await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; if (h === 'localhost') return r.continue(); disari.push(h); return r.abort(); });
  await ctx.addInitScript(IDB_YARDIMCI);
  const a = await ctx.newPage(); a.on('pageerror', e => errs.push(e.message)); await a.goto(URL0 + '/hazirla');
  await a.evaluate(async ([e, KEY]) => { localStorage.clear(); localStorage.setItem(KEY, e); await __idb.yaz(KEY, e); }, [js(eski()), KEY]);
  await a.goto(URL0 + '/'); await a.waitForFunction(() => typeof db !== 'undefined'); await a.waitForTimeout(800);
  await a.evaluate(async ([y, KEY]) => { await __idb.yaz(KEY, y); window.__dongu = setInterval(() => { try { save(); } catch (e) {} }, 40); /* eski sekme, ESKİ belleğini sürekli yazmaya çalışır (yarış) */ }, [js(yeni()), KEY]);
  const b = await ctx.newPage(); b.on('pageerror', e => errs.push(e.message)); await b.goto(URL0 + '/'); await kararBekle({ page: b });
  await a.waitForTimeout(1500); await a.evaluate(() => clearInterval(window.__dongu)).catch(() => {}); await a.waitForTimeout(1300);
  const son = await b.evaluate(async (KEY) => ({ ls: JSON.parse(localStorage.getItem(KEY)).firma, idb: JSON.parse(await __idb.oku(KEY)).firma, bellek: db.firma }), KEY).catch(e => ({ HATA: e.message }));
  T('K68 eski sekme kurtarma sırasında ESKİ belleğini SÜREKLİ yazmaya çalışsa da kurtarılan veri ezilmez (localStorage, IndexedDB, B belleği YENİ)', son.ls === 'KURTARMA-YENI' && son.idb === 'KURTARMA-YENI' && son.bellek === 'KURTARMA-YENI', son);
  await ctx.close(); }
{ const ctx = await br.newContext({ serviceWorkers: 'block' }); await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; if (h === 'localhost') return r.continue(); disari.push(h); return r.abort(); });
  await ctx.addInitScript(IDB_YARDIMCI);
  const a = await ctx.newPage(); a.on('pageerror', e => errs.push(e.message)); await a.goto(URL0 + '/hazirla');
  await a.evaluate(async ([e, KEY]) => { localStorage.clear(); localStorage.setItem(KEY, e); await __idb.yaz(KEY, e); }, [js(eski()), KEY]);
  await a.goto(URL0 + '/'); await a.waitForFunction(() => typeof db !== 'undefined'); await a.waitForTimeout(800);
  await a.evaluate(async ([y, KEY]) => { await __idb.yaz(KEY, y); clearTimeout(_idbYazT); db.cariler[0].bakiye = 77; db.cariler[0]._m = Date.now(); localStorage.setItem(KEY, JSON.stringify(db)); }, [js(yeni()), KEY]); /* A, eski veri üzerinde GERÇEK değişiklik yaptı */
  const lsA = await a.evaluate((KEY) => localStorage.getItem(KEY), KEY);
  const b = await ctx.newPage(); b.on('pageerror', e => errs.push(e.message)); await b.goto(URL0 + '/'); await kararBekle({ page: b });
  const son = await b.evaluate(async (KEY) => ({ kd: window.kurtarmaDurumu.durum, ls: localStorage.getItem(KEY), kb: await __idb.oku('kurtarma_bekleyen') }), KEY).catch(e => ({ HATA: e.message }));
  T('K68b eski sekmede GERÇEK değişiklik yapılmışsa (çatışma) otomatik seçim yok: B kilitli, A\'nın değişikliği localStorage\'da, yeni veri korumalı kopyada', son.kd === 'kilitli' && son.ls === lsA && son.kb === js(yeni()), { kd: son.kd, lsAyni: son.ls === lsA, kb: !!son.kb });
  await ctx.close(); }

// ===== 18. Kurtarma sonrasında yanlış bulut yazımı yok =====
S = await ac({ ls: js(eski()), idb: js(yeni()), init: [SAHTE_FB] });
const h69 = await S.ev(async () => { if (!bulutBaslat()) return { baslat: false }; window.canliRol = () => 'admin'; canliAcik = true; db.ornek = false; _canliGolge = {}; window.__bulut.length = 0;
  await canliYazHemen(['satis', 'stok', 'cari', 'kasa', 'cek']); canliAcik = false; const yazim = window.__bulut.map(b => b.veri).join('|');
  return { baslat: true, n: window.__bulut.length, yeniSatis: yazim.includes('s-2000'), eskiStok: /"loklar":\{"L-ana":10\}/.test(yazim), yeniStok: /"loklar":\{"L-ana":7\}/.test(yazim) }; });
T('K69 kurtarma sonrası buluta yalnız KURTARILAN (yeni) veri gider; eski stok/satış gönderilmez', h69 && h69.baslat && h69.n > 0 && h69.yeniSatis && h69.yeniStok && !h69.eskiStok, h69);
await S.ctx.close();

// ===== 19. Bildirim ULAŞMADAN yazma yarışı (kalıcı nesil kontrolü) ve zamanlayıcı =====
S = await ac({ ls: js(eski()), idb: js(eski()) });
const h70 = await S.ev(async (KEY) => { const r = {};
  if (window._kurtarma && _kurtarma.kanal) _kurtarma.kanal.onmessage = null; /* bildirim gecikti / ulaşmadı */
  window.addEventListener('storage', e => e.stopImmediatePropagation(), true);
  db.cariler[0].bakiye = 1; db.cariler[0]._m = Date.now(); idbYaz(); /* zamanlayıcı KURULDU (henüz yazmadı) */
  const lsOnce = localStorage.getItem(KEY), idbOnce = await __idb.oku(KEY);
  localStorage.setItem('iq_nesil', String((+localStorage.getItem('iq_nesil') || 0) + 1)); /* başka sekme kurtarmaya başladı (nesil arttı) */
  try { save(); r.save = 'dondu'; } catch (e) { r.save = e && e.kurtarmaKilidi ? e.name : 'baska'; }
  await new Promise(x => setTimeout(x, 1300));
  r.ls = localStorage.getItem(KEY) === lsOnce; r.idb = (await __idb.oku(KEY)) === idbOnce; r.kd = window.kurtarmaDurumu && window.kurtarmaDurumu.durum; return r; }, KEY);
T('K70 bildirim ulaşmasa da başka sekme nesli artırdıysa eski sekmenin save() çağrısı reddedilir (kalıcı nesil kontrolü) ve sekme kilitlenir', h70 && h70.save === 'KurtarmaKilidiHatasi' && h70.ls === true && h70.kd === 'kilitli', h70);
await S.ctx.close();
S = await ac({ ls: js(eski()), idb: js(eski()) });
const h71 = await S.ev(async (KEY) => { if (window._kurtarma && _kurtarma.kanal) _kurtarma.kanal.onmessage = null; window.addEventListener('storage', e => e.stopImmediatePropagation(), true);
  db.cariler[0].bakiye = 2; db.cariler[0]._m = Date.now(); const idbOnce = await __idb.oku(KEY); idbYaz(); /* zamanlayıcı kuruldu; save() ÇAĞRILMIYOR */
  localStorage.setItem('iq_nesil', String((+localStorage.getItem('iq_nesil') || 0) + 1)); await new Promise(x => setTimeout(x, 1400));
  return { idb: (await __idb.oku(KEY)) === idbOnce }; }, KEY);
T('K71 önceden kurulmuş IndexedDB zamanlayıcısı ÇALIŞTIĞI ANDA nesil değişmişse yazmaz (IndexedDB aynı)', h71 && h71.idb === true, h71);
await S.ctx.close();
S = await ac({ ls: js(eski()), idb: js(yeni()), init: [YEDEK_BOZUK] }); d = await durum(S);
T('K72 yedek yazıldı görünüp geri okunduğunda bozuksa (doğrulama başarısız) kurtarma BAŞLAMAZ: localStorage eski, uygulama kilitli', d.lsHam === js(eski()) && kilitli(d), { kd: d.kd, ls: d.ls });
await S.ctx.close();

// ===== 15. Kaynak sözleşmesi (yalnız ek kanıt) + Ders 48 + genel =====
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const idbSatir = html.indexOf('let _idb='), kurtarmaSatir = html.indexOf('IndexedDB güvence kopyasından kurtar');
T('K55 (ek kanıt) _idb tanımı açılış kurtarmasından ÖNCE (TDZ yok)', idbSatir > 0 && kurtarmaSatir > 0 && idbSatir < kurtarmaSatir, { idbSatir, kurtarmaSatir });
const r32 = spawnSync(process.execPath, [path.join(ROOT, 'test', '32-satis-iptal-atomiklik.test.mjs')], { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
T('K56 Ders 48 satış iptali güvenliği korunur (test 32 yeşil)', r32.status === 0 && /0 FAIL/.test((r32.stdout || '').trim().split('\n').pop()), (r32.stdout || '').trim().split('\n').pop());
T('K57 Firebase / gerçek veri yok (localhost dışı istekler engellendi; yalnız sentetik 93xx veri)', disari.every(h => !/^(localhost|127\.0\.0\.1)$/.test(h)), [...new Set(disari)]);
T('K-ek sayfa hatası yok', errs.length === 0, errs.slice(0, 5));

await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
