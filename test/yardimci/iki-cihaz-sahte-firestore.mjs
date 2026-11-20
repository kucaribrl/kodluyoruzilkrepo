// YALNIZ TEST YARDIMCISI — iki tarayıcı bağlamı (iki cihaz) + Node içi SAHTE, BELLEK İÇİ Firestore.
// Bu GERÇEK Firebase DEĞİLDİR, Firebase EMÜLATÖRÜ DE DEĞİLDİR. Sayfanın localhost dışındaki her isteği engellenir.
// Düzenek test/34-iki-cihaz-senkron.test.mjs ile aynıdır (34 kendi kopyasını taşır; bu modül 35 ve sonrası içindir).
// Deterministik: set() yazımı hemen saklanır; onSnapshot bildirimi yalnız teslim()/yerles() çağrılınca cihaza gider.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';

export const KEY = 'oztekstil_v2';
export const VERI_YOLU = (d) => 'isletme/iqbasics/veri/' + d;
export const GERCEK_FIREBASE = /firestore\.googleapis\.com|firebaseio\.com|identitytoolkit|securetoken|firebaseapp\.com/;
export const bekle = (ms) => new Promise(r => setTimeout(r, ms));

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

export async function duzenekKur(ROOT) {
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
  const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
  const disari = new Set();
  const SEED = await (async () => { const c = await br.newContext({ serviceWorkers: 'block' }); await c.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
    const p = await c.newPage(); await p.goto(URL0 + '/'); await p.waitForFunction(() => typeof seed === 'function'); const v = await p.evaluate(() => JSON.stringify(seed())); await c.close(); return JSON.parse(v); })();

  // Sentetik başlangıç: uygulamanın kendi seed() şeması; listeler sentetik kayıtlarla değiştirilir (9xxx kimlikleri)
  function veri() { const d = JSON.parse(JSON.stringify(SEED));
    for (const k of Object.keys(d)) if (Array.isArray(d[k])) d[k] = [];
    const T0 = 1790000000000;
    d.lokasyonlar = [{ id: 'L-ana', ad: 'Ana Mağaza', tip: 'magaza' }];
    d.urunler = [{ id: 9201, ad: 'Sentetik Ürün', kod: 'SNT35', kat: 'Test', birim: 'adet', seri: 1, satis: 100, alis: 50, pb: 'TL', stok: 1, loklar: { 'L-ana': 1 },
      renkler: [{ ad: 'Siyah', hex: '#111111', barkod: '8690000000017', rid: 'r_d3535353-3535-4353-8353-353535353535', stok: 1, loklar: { 'L-ana': 1 } }], _m: T0 }];
    d.cariler = [{ id: 9001, ad: 'Sentetik Müşteri A', tip: 'musteri', tel: '05000000001', bakiye: 500, _m: T0 },
      { id: 9002, ad: 'Sentetik Müşteri B', tip: 'musteri', tel: '05000000002', bakiye: 300, _m: T0 }];
    d.hesaplar = [{ id: 9101, ad: 'Nakit Kasa', tur: 'nakit', lokId: 'L-ana', bakiye: 1000, _m: T0 }];
    d.ornek = false; d.canliBulut = true; d.senkronOldu = true; d._tomb = {}; d.kurTarih = Date.now(); d.pin = '';
    d.seq = { s: 1000, hr: 1000, c: 9100, u: 9300, cek: 1000, oh: 9150 };
    return JSON.stringify(d); }

  function bulutKur() { return { belge: new Map(), surum: 0, cihazlar: [] }; }
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
  // Bekleyen en güncel belgeleri cihaza teslim eder; sira verilirse yalnız o domenleri o sırayla teslim eder
  async function teslim(B, C, sira) {
    if (C.cevrimdisi) return 0; let n = 0;
    const yollar = sira ? sira.map(VERI_YOLU).filter(y => C.abone.has(y)) : [...C.abone];
    for (const yol of yollar) { const b = B.belge.get(yol); if (!b || C.gordugu.get(yol) === b.v) continue;
      C.gordugu.set(yol, b.v); await C.page.evaluate(([y, j]) => window.__sahteTeslim(y, j), [yol, b.j]); n++; }
    return n;
  }
  async function yerles(B) { // durulana kadar teslim et; uygulamanın 300 ms geri yayma zamanlayıcısını bekle
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
  // Bulut domen belgelerinden birleşik veri görüntüsü (yalnız okuma)
  function bulutVeri(B) { const o = {}; for (const [y, b] of B.belge) if (y.startsWith('isletme/iqbasics/veri/')) Object.assign(o, JSON.parse(b.j)); return o; }
  const cihazVeri = async (C) => JSON.parse(await C.page.evaluate(() => JSON.stringify(db)));
  async function kapat() { await br.close(); srv.close(); }
  return { URL0, disari, bulutKur, cihazAc, teslim, yerles, cevrimdisi, cevrimici, bulutVeri, cihazVeri, kapat };
}

// ---- İşlemler: gerçek uygulama fonksiyonları ----
export const islem = {
  satis: (C) => C.page.evaluate(() => { const u = urun(9201), m = cari(9001);
    const s = { id: nid('s'), tip: 'satis', lokId: aktifLok, mid: m.id, mus: m.ad, tarih: Date.now(), kalemler: [{ uid: u.id, urun: u.ad, mik: 1, birim: 'adet', fiyat: 100, renkler: [{ ad: 'Siyah', mik: 1, rid: u.renkler[0].rid }] }],
      araToplam: 100, iskonto: 0, tutar: 100, odenen: 0, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [], durum: 'tamam', teslimDurum: 'teslim' };
    db.satislar.push(s); applySatis(s); save(); }),
  tahsilat: (C, cid, t) => C.page.evaluate(([cid, t]) => { formOdeme(cid); $('o-t').value = String(t); $('o-tur').value = 'Nakit'; $('o-hesap').value = '9101'; kaydetOdeme(cid); }, [cid, t]),
  elleBakiye: (C, cid, yeni) => C.page.evaluate(([cid, yeni]) => { formCari('musteri', cid); $('c-bak').value = String(yeni); kaydetCari('musteri', cid); }, [cid, yeni]),
  yeniCari: (C, ad, tel, acilis) => C.page.evaluate(([ad, tel, acilis]) => { formCari('musteri', 0); $('c-ad').value = ad; $('c-tel').value = tel; $('c-bak').value = String(acilis); kaydetCari('musteri', 0);
    return (db.cariler.find(c => c.ad === ad) || {}).id; }, [ad, tel, acilis]),
  yeniKasa: (C, ad, acilis) => C.page.evaluate(([ad, acilis]) => { formHesap(); $('he-ad').value = ad; $('he-tur').value = 'nakit'; if ($('he-bak')) $('he-bak').value = String(acilis); kaydetHesap();
    return (db.hesaplar.find(h => h.ad === ad) || {}).id; }, [ad, acilis]),
  cekEkle: (C, cid, t) => C.page.evaluate(([cid, t]) => { cekTab = 'alinan'; cekForm(0); ckCariId = cid; $('ck-tut').value = String(t); $('ck-vade').value = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if ($('ck-isle')) $('ck-isle').checked = true; const n0 = db.cekler.length; kaydetCek(); return db.cekler.length > n0 ? db.cekler[db.cekler.length - 1].id : null; }, [cid, t]),
  cekTahsil: (C, id) => C.page.evaluate((id) => { cekTahsil(id); }, id),
  kasaGelirGider: (C, yon, t) => C.page.evaluate(([yon, t]) => { formKasaHareket(9101); khTur(yon); $('kh-t').value = String(t); $('kh-a').value = yon === 'in' ? 'Sentetik gelir' : 'Sentetik gider'; kaydetKasaHareket(); }, [yon, t]),
  gizle: (C) => C.page.evaluate(() => { canliYazHemen(); }), // sekme gizlendi / kapandı
  ekstreDevir: (C, cid) => C.page.evaluate((cid) => cariEkstre(cid).devir, cid)
};
