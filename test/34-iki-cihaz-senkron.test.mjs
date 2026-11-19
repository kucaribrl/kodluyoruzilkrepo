// Ders 50.1 — İKİ CİHAZLI SENKRON TEST ALTYAPISI (mevcut sistemin ölçümü; uygulama kodu DEĞİŞTİRİLMEZ).
//
// ORTAM: SAHTE, BELLEK İÇİ FIRESTORE. Bu GERÇEK Firebase DEĞİLDİR, Firebase EMÜLATÖRÜ DE DEĞİLDİR.
//   - İki ayrı tarayıcı bağlamı = iki cihaz (A, B). Aralarındaki "bulut", bu dosyadaki Node içi sahte belge deposudur.
//   - Sayfanın localhost dışındaki her isteği engellenir (Firebase SDK, kur servisi, CDN). Firestore/Auth sunucularına hiç gidilmez.
//   - Sonuçlar uygulamanın BİRLEŞTİRME MANTIĞINI (canliYaz/canliYazHemen → set, canliDomenUygula, _recMerge, _sbAl,
//     _kumulatifBirlestir) ölçer; gerçek Firestore'un ağ, kuyruk ve sıralama garantilerini KANITLAMAZ.
//
// DETERMİNİZM: Sahte depo yazımları (set) hemen saklar ama bulut bildirimini (onSnapshot) cihazlara KENDİLİĞİNDEN göndermez.
//   Teslimi test adımları yapar (teslim / yerles). Böylece "ağ gecikmesi", işlem sırası ve yazımların yolda çaprazlaşması
//   test tarafından açıkça kurulur. Uygulamanın kendi 300 ms'lik geri yayma zamanlayıcısı için yerles() durulana kadar bekler.
//
// SINIFLANDIRMA:
//   KONTROL  — sistemin bugün DOĞRU yaptığı akışlar. Yanlışsa FAIL (çıkış kodu 1).
//   GÖZLEM   — bilinen hata. Gerçekleşen değer bilinen hatanın İMZASIYLA birebir aynıysa "[BİLİNEN HATA GÖZLENDİ]" (çıkışı etkilemez);
//              beklenen doğru değer çıkarsa "[DÜZELDİ]" (bilgi: bu dosya ve test/OKU.md güncellenmeli; çıkışı etkilemez);
//              İKİSİ DE DEĞİLSE "FAIL [DEĞİŞEN/YENİ DAVRANIŞ]" (çıkış kodu 1) — yeni bir hata sessizce kabul edilmez.
//   Her senaryoda ayrıca: iki cihaz ve sahte bulut AYNI değerde buluşmalı, kayıt sayıları (satış/tahsilat) doğru olmalı → değilse FAIL.
//
// İşlemler gerçek uygulama fonksiyonlarıyla yapılır:
//   tahsilat = gerçek formOdeme + kaydetOdeme (Nakit, Nakit Kasa);
//   satış    = satış kaydının çekirdeği (gerçek applySatis + save) — kaydetSatis'in form/sepet katmanı ve sipTakip yazımı atlanır.
//   "Sekme gizlendi / kapandı" = gerçek canliYazHemen() (visibilitychange/pagehide'ın çağırdığı fonksiyon).
// Sentetik veri (9xxx kimlikleri). Sunucu rastgele port; sw.js → 404.
// İsteğe bağlı: IQ_TEST_KOK=<klasör> ile başka bir sürümün index.html'i ölçülebilir (yalnız test amaçlı; varsayılan depo kökü).
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';

const DEPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.env.IQ_TEST_KOK ? path.resolve(process.env.IQ_TEST_KOK) : DEPO;
const KEY = 'oztekstil_v2';
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

let ok = 0, fail = 0, gozlemBilinen = 0, gozlemDuzeldi = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 400) : '')); } };
const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const bekle = (ms) => new Promise(r => setTimeout(r, ms));
const disari = new Set();
console.log('ORTAM: SAHTE bellek içi Firestore (gerçek Firebase / emülatör DEĞİL) · kök: ' + (ROOT === DEPO ? 'depo' : ROOT));

// ---- Sentetik veri: uygulamanın kendi seed() şeması; bütün listeler sentetik kayıtlarla değiştirilir ----
const SEED = await (async () => { const c = await br.newContext({ serviceWorkers: 'block' }); await c.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
  const p = await c.newPage(); await p.goto(URL0 + '/'); await p.waitForFunction(() => typeof seed === 'function'); const v = await p.evaluate(() => JSON.stringify(seed())); await c.close(); return JSON.parse(v); })();
const T0 = 1790000000000, RID = 'r_d3434343-3434-4343-8343-343434343434';
function veri() { const d = JSON.parse(JSON.stringify(SEED));
  for (const k of Object.keys(d)) if (Array.isArray(d[k])) d[k] = [];
  d.lokasyonlar = [{ id: 'L-ana', ad: 'Ana Mağaza', tip: 'magaza' }];
  d.urunler = [{ id: 9201, ad: 'Sentetik Ürün', kod: 'SNT34', kat: 'Test', birim: 'adet', seri: 1, satis: 100, alis: 50, pb: 'TL', stok: 1, loklar: { 'L-ana': 1 },
    renkler: [{ ad: 'Siyah', hex: '#111111', barkod: '8690000000017', rid: RID, stok: 1, loklar: { 'L-ana': 1 } }], _m: T0 }];
  d.cariler = [{ id: 9001, ad: 'Sentetik Müşteri A', tip: 'musteri', tel: '05000000001', bakiye: 500, _m: T0 },
    { id: 9002, ad: 'Sentetik Müşteri B', tip: 'musteri', tel: '05000000002', bakiye: 300, _m: T0 }];
  d.hesaplar = [{ id: 9101, ad: 'Nakit Kasa', tur: 'nakit', lokId: 'L-ana', bakiye: 1000, _m: T0 }];
  d.ornek = false; d.canliBulut = true; d.senkronOldu = true; d._tomb = {}; d.kurTarih = Date.now(); d.pin = '';
  d.seq = { s: 1000, hr: 1000, c: 9100, u: 9300, cek: 1000 };
  return JSON.stringify(d); }

// ---- SAHTE FIRESTORE (sayfa tarafı): set → Node deposu (çevrimdışıysa sayfa içi kuyruk); onSnapshot → yalnız test teslim edince ----
const SAHTE_FIRESTORE = `(() => {
  window.__dinle = {}; window.__cevrimdisi = false; window.__kuyruk = [];
  const sorgu = { where() { return this; }, orderBy() { return this; }, limit() { return this; }, onSnapshot() { return () => {}; }, get: async () => ({ forEach() {}, docs: [] }), add: async () => ({ id: 'sahte' }) };
  const ref = (yol) => ({
    collection: (c) => Object.assign(Object.create(sorgu), { doc: (d) => ref(yol + '/' + c + '/' + d) }),
    set: (v) => { const j = JSON.stringify(v); if (window.__cevrimdisi) return new Promise(res => { window.__kuyruk.push({ yol, j, res }); }); return window.sahteYaz(yol, j); },
    update: async () => {},
    get: async () => { const j = await window.sahteOku(yol); return { exists: j !== null, data: () => (j === null ? undefined : JSON.parse(j)), metadata: { fromCache: false } }; },
    onSnapshot: (cb) => { (window.__dinle[yol] = window.__dinle[yol] || []).push(cb); window.sahteAbone(yol); return () => {}; }
  });
  window.__sahteTeslim = (yol, j) => { (window.__dinle[yol] || []).forEach(cb => cb({ exists: true, data: () => JSON.parse(j), metadata: { fromCache: false, hasPendingWrites: false } })); };
  const FS = { enablePersistence: () => Promise.resolve(), collection: (c) => Object.assign(Object.create(sorgu), { doc: (d) => ref(c + '/' + d) }) };
  const kul = { uid: window.__sahteUid, email: 'sentetik@ornek.test' };
  window.firebase = { __SAHTE__: true, apps: [], initializeApp() { this.apps.push('sahte'); }, firestore: () => FS, storage: () => ({}),
    auth: () => ({ currentUser: kul, onAuthStateChanged: (cb) => { setTimeout(() => cb(kul), 0); return () => {}; }, signOut: async () => {} }) };
})();`;

// ---- Node tarafı: sahte bulut + teslim denetimi ----
function bulutKur() { return { belge: new Map(), surum: 0, cihazlar: [] }; } // belge: yol → { j, v }
const VERI_YOLU = (d) => 'isletme/iqbasics/veri/' + d;
async function cihazAc(B, ad, cihazNo) {
  const ctx = await br.newContext({ serviceWorkers: 'block' });
  await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; if (h === 'localhost') return r.continue(); disari.add(h); return r.abort(); });
  const page = await ctx.newPage(); const hatalar = []; page.on('pageerror', e => hatalar.push(e.message));
  const C = { ad, page, ctx, hatalar, cevrimdisi: false, gordugu: new Map(), abone: new Set() };
  await page.exposeBinding('sahteYaz', async (_s, yol, j) => { B.surum++; B.belge.set(yol, { j, v: B.surum }); return true; });
  await page.exposeBinding('sahteOku', async (_s, yol) => (B.belge.has(yol) ? B.belge.get(yol).j : null));
  await page.exposeBinding('sahteAbone', async (_s, yol) => { C.abone.add(yol); });
  await page.goto(URL0 + '/hazirla');
  await page.evaluate(([KEY, v, n]) => { localStorage.clear(); localStorage.setItem(KEY, v); localStorage.setItem('iq_cihaz_no', String(n)); }, [KEY, veri(), cihazNo]);
  await ctx.addInitScript(`window.__sahteUid='sentetik-${ad}';`); await ctx.addInitScript(SAHTE_FIRESTORE);
  B.belge.set(`kullanicilar/sentetik-${ad}`, { j: JSON.stringify({ rol: 'admin', onay: true, ad: 'Sentetik ' + ad }), v: 0 });
  await page.goto(URL0 + '/');
  await page.waitForFunction(() => (!window.kurtarmaDurumu || window.kurtarmaDurumu.durum === 'tamam') && typeof canliAcik !== 'undefined' && canliAcik === true, null, { timeout: 20000 });
  B.cihazlar.push(C); return C;
}
async function teslim(B, C) { // bekleyen en güncel belgeleri cihaza teslim et (bir "ağ turu")
  if (C.cevrimdisi) return 0; let n = 0;
  for (const yol of C.abone) { const b = B.belge.get(yol); if (!b || C.gordugu.get(yol) === b.v) continue;
    C.gordugu.set(yol, b.v); await C.page.evaluate(([y, j]) => window.__sahteTeslim(y, j), [yol, b.j]); n++; }
  return n;
}
async function yerles(B) { // durulana kadar: teslim et → uygulamanın 300 ms geri yayma zamanlayıcısını bekle → yeni yazım yoksa dur
  for (let tur = 0; tur < 15; tur++) { const once = B.surum; let n = 0; for (const C of B.cihazlar) n += await teslim(B, C);
    await bekle(450); if (n === 0 && B.surum === once) return tur; }
  return -1;
}
async function cevrimdisi(C) { C.cevrimdisi = true; await C.page.evaluate(() => { window.__cevrimdisi = true; }); }
async function cevrimici(B, C) { // önce kuyruktaki (eski) yazımlar sunucuya sırayla ulaşır, sonra cihaz yeniden teslim almaya başlar
  const k = await C.page.evaluate(() => { const q = window.__kuyruk.map(x => ({ yol: x.yol, j: x.j })); window.__kuyruk.forEach(x => x.res(true)); window.__kuyruk = []; window.__cevrimdisi = false; return q; });
  for (const x of k) { B.surum++; B.belge.set(x.yol, { j: x.j, v: B.surum }); }
  C.cevrimdisi = false; return k.length;
}
// ---- İşlemler (gerçek uygulama fonksiyonları) ----
const satis = (C) => C.page.evaluate(() => { const u = urun(9201), m = cari(9001);
  const s = { id: nid('s'), tip: 'satis', lokId: aktifLok, mid: m.id, mus: m.ad, tarih: Date.now(), kalemler: [{ uid: u.id, urun: u.ad, mik: 1, birim: 'adet', fiyat: 100, renkler: [{ ad: 'Siyah', mik: 1, rid: u.renkler[0].rid }] }],
    araToplam: 100, iskonto: 0, tutar: 100, odenen: 0, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [], durum: 'tamam', teslimDurum: 'teslim' };
  db.satislar.push(s); applySatis(s); save(); });
const tahsilat = (C, cid, t) => C.page.evaluate(([cid, t]) => { formOdeme(cid); $('o-t').value = String(t); $('o-tur').value = 'Nakit'; $('o-hesap').value = '9101'; kaydetOdeme(cid); }, [cid, t]);
const gizle = (C) => C.page.evaluate(() => { canliYazHemen(); }); // sekme gizlendi / kapandı
const yerel = (C) => C.page.evaluate(() => ({ stok: (urun(9201).renkler[0].loklar || {})['L-ana'], cariA: cari(9001).bakiye, cariB: cari(9002).bakiye, kasa: hesap(9101).bakiye,
  satis: db.satislar.filter(s => !s.iptal && s.tip === 'satis').length, tahsilat: db.hareketler.filter(h => h.tip === 'tahsilat').length }));
function bulutDeger(B) { const o = (d) => { const b = B.belge.get(VERI_YOLU(d)); return b ? JSON.parse(b.j) : {}; };
  const st = o('stok'), ca = o('cari'), ka = o('kasa'), sa = o('satis'); const u = (st.urunler || []).find(x => x.id === 9201), c = (id) => ((ca.cariler || []).find(x => x.id === id) || {}).bakiye;
  return { stok: u ? (u.renkler[0].loklar || {})['L-ana'] : null, cariA: c(9001), cariB: c(9002), kasa: ((ka.hesaplar || []).find(x => x.id === 9101) || {}).bakiye,
    satis: (sa.satislar || []).filter(s => !s.iptal && s.tip === 'satis').length, tahsilat: (ka.hareketler || []).filter(h => h.tip === 'tahsilat').length }; }

const ALAN = ['stok', 'cariA', 'cariB', 'kasa']; // kümülatif sayaçlar (değeri karşılaştırılan)
const fark = (gercek, beklenen) => Object.fromEntries(ALAN.filter(k => gercek[k] !== beklenen[k]).map(k => [k, { beklenen: beklenen[k], gerceklesen: gercek[k], fark: +(gercek[k] - beklenen[k]).toFixed(3) }]));
const esit = (a, b) => ALAN.every(k => a[k] === b[k]);
const BASLANGIC = { stok: 1, cariA: 500, cariB: 300, kasa: 1000 };

async function senaryo({ kod, ad, tur, beklenen, bilinenHata, kayit, adimlar }) {
  const B = bulutKur(); const A = await cihazAc(B, 'A', 11); const Bc = await cihazAc(B, 'B', 22);
  let ek = {};
  const t0 = await yerles(B); const ilk = { A: await yerel(A), B: await yerel(Bc) };
  T(`${kod} [altyapı] iki cihaz aynı sentetik başlangıçta buluşur`, t0 >= 0 && esit(ilk.A, BASLANGIC) && esit(ilk.B, BASLANGIC), ilk);
  try { ek = (await adimlar(B, A, Bc)) || {}; } catch (e) { ek = { HATA: String(e.message).slice(0, 200) }; }
  const tur2 = await yerles(B);
  const g = { A: await yerel(A), B: await yerel(Bc), bulut: bulutDeger(B) };
  T(`${kod} [altyapı] senkron durulur (sonsuz yazım döngüsü yok), adımlar hatasız`, tur2 >= 0 && !ek.HATA, { tur2, ...ek });
  T(`${kod} [altyapı] iki cihaz ve sahte bulut AYNI sonuçta buluşur`, esit(g.A, g.B) && esit(g.A, g.bulut), g);
  T(`${kod} [kayıt] satış/tahsilat KAYITLARI kaybolmaz (satış ${kayit.satis}, tahsilat ${kayit.tahsilat})`,
    [g.A, g.B, g.bulut].every(x => x.satis === kayit.satis && x.tahsilat === kayit.tahsilat), { A: [g.A.satis, g.A.tahsilat], B: [g.B.satis, g.B.tahsilat], bulut: [g.bulut.satis, g.bulut.tahsilat] });
  const sonuc = { stok: g.A.stok, cariA: g.A.cariA, cariB: g.A.cariB, kasa: g.A.kasa }; const f = fark(sonuc, beklenen);
  if (tur === 'KONTROL') T(`${kod} KONTROL ${ad} → beklenen ${JSON.stringify(beklenen)}`, Object.keys(f).length === 0, { gerceklesen: sonuc, fark: f });
  else {
    const bilinen = esit(sonuc, { ...beklenen, ...bilinenHata }), dogru = Object.keys(f).length === 0;
    if (dogru) { gozlemDuzeldi++; console.log(`GÖZLEM ${kod} ${ad} — [DÜZELDİ] beklenen doğru sonuç çıktı ${JSON.stringify(sonuc)} (bu dosyayı ve test/OKU.md'yi güncelle)`); }
    else if (bilinen) { gozlemBilinen++; console.log(`GÖZLEM ${kod} ${ad} — [BİLİNEN HATA GÖZLENDİ] beklenen ${JSON.stringify(beklenen)} · gerçekleşen ${JSON.stringify(sonuc)} · fark ${JSON.stringify(f)}`); }
    else T(`${kod} GÖZLEM ${ad} [DEĞİŞEN/YENİ DAVRANIŞ] — ne doğru sonuç ne bilinen hata imzası`, false, { beklenen, bilinenHata, gerceklesen: sonuc, fark: f });
  }
  T(`${kod} [altyapı] sayfa hatası yok`, A.hatalar.length === 0 && Bc.hatalar.length === 0, [...A.hatalar, ...Bc.hatalar].slice(0, 3));
  await A.ctx.close(); await Bc.ctx.close();
}

// ===== Senaryolar (mevcut sistem: buluta yazım yalnız "sekme gizlenince" canliYazHemen() ile) =====
await senaryo({ kod: 'S1', ad: 'aynı üründen eşzamanlı iki satış (stok 1; ikisi de diğerini görmeden satar)', tur: 'GÖZLEM',
  beklenen: { stok: -1, cariA: 700, cariB: 300, kasa: 1000 }, bilinenHata: { stok: 0, cariA: 600 }, kayit: { satis: 2, tahsilat: 0 },
  adimlar: async (B, A, Bc) => { await satis(A); await satis(Bc); await gizle(A); await teslim(B, Bc); await gizle(Bc); } });
await senaryo({ kod: 'S2', ad: 'aynı müşteriye eşzamanlı EŞİT iki tahsilat (100 + 100)', tur: 'GÖZLEM',
  beklenen: { stok: 1, cariA: 300, cariB: 300, kasa: 1200 }, bilinenHata: { cariA: 400, kasa: 1100 }, kayit: { satis: 0, tahsilat: 2 },
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await tahsilat(Bc, 9001, 100); await gizle(A); await teslim(B, Bc); await gizle(Bc); } });
await senaryo({ kod: 'Z1a', ad: 'yakın zamanlı FARKLI iki tahsilat (100 + 50), yazımlar ARALIKLI (B, A\'nın yazımını aldıktan sonra yazar)', tur: 'KONTROL',
  beklenen: { stok: 1, cariA: 350, cariB: 300, kasa: 1150 }, kayit: { satis: 0, tahsilat: 2 },
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await tahsilat(Bc, 9001, 50); await gizle(A); await teslim(B, Bc); await bekle(450); await gizle(Bc); } });
await senaryo({ kod: 'Z1b', ad: 'yakın zamanlı FARKLI iki tahsilat (100 + 50), yazımlar YOLDA ÇAPRAZLAŞIR (ikisi de yazar, sonra teslim)', tur: 'GÖZLEM',
  beklenen: { stok: 1, cariA: 350, cariB: 300, kasa: 1150 }, bilinenHata: { cariA: 450, kasa: 1050 }, kayit: { satis: 0, tahsilat: 2 },
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await tahsilat(Bc, 9001, 50); await gizle(A); await gizle(Bc); } });
await senaryo({ kod: 'Z3a', ad: '2 sn arayla EŞİT tahsilatlar; A\'nın değişikliği B işlem yapmadan buluta GİTMEMİŞ (bugünkü davranış: yazım sekme gizlenince)', tur: 'GÖZLEM',
  beklenen: { stok: 1, cariA: 300, cariB: 300, kasa: 1200 }, bilinenHata: { cariA: 400, kasa: 1100 }, kayit: { satis: 0, tahsilat: 2 },
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await bekle(2000); await tahsilat(Bc, 9001, 100); await gizle(A); await teslim(B, Bc); await bekle(450); await gizle(Bc); } });
await senaryo({ kod: 'Z3b', ad: '2 sn arayla EŞİT tahsilatlar; A\'nın değişikliği B işlem yapmadan ÖNCE B\'ye ulaşmış', tur: 'KONTROL',
  beklenen: { stok: 1, cariA: 300, cariB: 300, kasa: 1200 }, kayit: { satis: 0, tahsilat: 2 },
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await gizle(A); await teslim(B, Bc); await bekle(2000); await tahsilat(Bc, 9001, 100); await gizle(Bc); } });
await senaryo({ kod: 'Z4a', ad: '2 sn arayla aynı üründen satış; A\'nın satışı B satmadan buluta GİTMEMİŞ', tur: 'GÖZLEM',
  beklenen: { stok: -1, cariA: 700, cariB: 300, kasa: 1000 }, bilinenHata: { stok: 0, cariA: 600 }, kayit: { satis: 2, tahsilat: 0 },
  adimlar: async (B, A, Bc) => { await satis(A); await bekle(2000); await satis(Bc); await gizle(A); await teslim(B, Bc); await bekle(450); await gizle(Bc); } });
await senaryo({ kod: 'Z4b', ad: '2 sn arayla aynı üründen satış; A\'nın satışı B satmadan ÖNCE B\'ye ulaşmış', tur: 'KONTROL',
  beklenen: { stok: -1, cariA: 700, cariB: 300, kasa: 1000 }, kayit: { satis: 2, tahsilat: 0 },
  adimlar: async (B, A, Bc) => { await satis(A); await gizle(A); await teslim(B, Bc); await bekle(2000); await satis(Bc); await gizle(Bc); } });
await senaryo({ kod: 'S3/S4', ad: 'B çevrimdışı: A cari A\'dan 100 tahsil edip yazar; B cari B\'den 50 tahsil eder (yazımı kuyrukta); B bağlanınca ESKİ belge sonradan gelir', tur: 'GÖZLEM',
  beklenen: { stok: 1, cariA: 400, cariB: 250, kasa: 1150 }, bilinenHata: { cariA: 500, kasa: 1050 }, kayit: { satis: 0, tahsilat: 2 },
  adimlar: async (B, A, Bc) => { await cevrimdisi(Bc); await tahsilat(A, 9001, 100); await gizle(A); await yerles(B); await tahsilat(Bc, 9002, 50); await gizle(Bc);
    const k = await cevrimici(B, Bc); return { kuyruktanGelen: k }; } });
await senaryo({ kod: 'S5', ad: 'aynı belgenin yeniden teslimi (iki kez, gölge sıfırlanarak) çift sayılmaz', tur: 'KONTROL',
  beklenen: { stok: 1, cariA: 400, cariB: 300, kasa: 1100 }, kayit: { satis: 0, tahsilat: 1 },
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await gizle(A); await yerles(B);
    for (let i = 0; i < 2; i++) { const c = B.belge.get(VERI_YOLU('cari')).j, k = B.belge.get(VERI_YOLU('kasa')).j;
      await Bc.page.evaluate(([c, k, yc, yk]) => { _canliGolge = {}; window.__sahteTeslim(yc, c); window.__sahteTeslim(yk, k); }, [c, k, VERI_YOLU('cari'), VERI_YOLU('kasa')]); await bekle(450); } } });

// ===== Ortam ayrımı: gerçek Firebase'e hiç gidilmedi =====
const GERCEK_FIREBASE = /firestore\.googleapis\.com|firebaseio\.com|identitytoolkit|securetoken|firebaseapp\.com/;
T('ORTAM sahte Firestore kullanıldı; gerçek Firebase/Auth sunucularına istek denemesi bile yok (localhost dışı her şey engellendi)', ![...disari].some(h => GERCEK_FIREBASE.test(h)), [...disari]);
await br.close(); srv.close();
console.log(`\nGÖZLEM: ${gozlemBilinen} bilinen hata gözlendi, ${gozlemDuzeldi} düzelmiş (çıkışı etkilemez)`);
console.log(`${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
