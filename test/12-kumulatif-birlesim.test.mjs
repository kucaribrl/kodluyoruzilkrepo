// K5: iki cihaz aynı cari/hesap/ürün stoğunu (biri çevrimdışıyken) değiştirince "son yazan kazanır" para/stok
// hareketini silmesin — taban + yerel fark + bulut fark üç yönlü birleşimi.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  if (req.url.includes('sw.js')) { res.writeHead(404); return res.end(); }
  const p = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));
const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const page = await br.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' — ' + JSON.stringify(x).slice(0, 240) : '')); } };
const ev = (fn, a) => page.evaluate(fn, a);

// 1) Rapordaki örnek: cari 100.000 → kasa PC +20.000 (veresiye), telefon −30.000 (tahsilat, çevrimdışı, daha yeni damga)
const c1 = await ev(() => {
  const now = Date.now();
  db.cariler.push({ id: 9001, tip: 'musteri', ad: 'Ortak Cari', bakiye: 100000, _m: now - 100000 });
  _sbGuncelle('cariler', db.cariler);                              // son senkron tabanı: 100.000
  const y = db.cariler.find(c => c.id === 9001); y.bakiye = 120000; y._m = now - 5000;   // yerel: veresiye satış
  const bulut = { id: 9001, tip: 'musteri', ad: 'Ortak Cari', bakiye: 70000, _m: now };  // bulut: tahsilat (daha yeni)
  canliDomenUygula('cari', { cariler: [bulut] });
  return { b: db.cariler.find(c => c.id === 9001).bakiye, taban: db._sb.cariler[9001].bakiye };
});
T('K5: 100.000 → +20.000 & −30.000 = 90.000 (LWW 70.000 demezdi)', c1.b === 90000 && c1.taban === 90000, c1);

// 2) Yalnız bulut bakiyeyi değiştirdi ama yerelin damgası daha yeni (telefon numarası düzenlendi) → bulutun deltası kaybolmaz
const c2 = await ev(() => {
  const now = Date.now();
  db.cariler.push({ id: 9002, tip: 'musteri', ad: 'Tel Cari', bakiye: 5000, tel: '', _m: now - 100000 });
  _sbGuncelle('cariler', db.cariler);
  const y = db.cariler.find(c => c.id === 9002); y.tel = '0532'; y._m = now;               // yerel: sadece telefon
  const bulut = { id: 9002, tip: 'musteri', ad: 'Tel Cari', bakiye: 3000, tel: '', _m: now - 1000 }; // bulut: 2.000 tahsilat
  canliDomenUygula('cari', { cariler: [bulut] });
  const r = db.cariler.find(c => c.id === 9002); return { b: r.bakiye, tel: r.tel };
});
T('K5: yerel yeni (tel) ama bulutun bakiye deltası korunur → 3.000, tel 0532', c2.b === 3000 && c2.tel === '0532', c2);

// 3) Kasa: iki cihaz da para girişi yaptı
const c3 = await ev(() => {
  const now = Date.now();
  db.hesaplar.push({ id: 9003, ad: 'Ortak Kasa', tur: 'nakit', bakiye: 1000, _m: now - 100000 });
  _sbGuncelle('hesaplar', db.hesaplar);
  const y = db.hesaplar.find(h => h.id === 9003); y.bakiye = 1500; y._m = now - 2000;
  canliDomenUygula('kasa', { hesaplar: [{ id: 9003, ad: 'Ortak Kasa', tur: 'nakit', bakiye: 1200, _m: now }], hareketler: [] });
  return db.hesaplar.find(h => h.id === 9003).bakiye;
});
T('K5: kasa 1.000 → +500 & +200 = 1.700', c3 === 1700, c3);

// 4) Ürün renk stoğu: iki cihaz aynı renkten sattı
const c4 = await ev(() => {
  const now = Date.now();
  db.urunler.push({ id: 9004, ad: 'Ortak Polo', kod: 'OP', kat: 'X', birim: 'adet', stok: 50, renkler: [{ ad: 'Siyah', stok: 30 }, { ad: 'Beyaz', stok: 20 }], _m: now - 100000 });
  _sbGuncelle('urunler', db.urunler);
  const y = db.urunler.find(u => u.id === 9004); y.renkler[0].stok = 28; y.stok = 48; y._m = now - 1000;   // yerel 2 sattı
  canliDomenUygula('stok', { urunler: [{ id: 9004, ad: 'Ortak Polo', kod: 'OP', kat: 'X', birim: 'adet', stok: 45, renkler: [{ ad: 'Siyah', stok: 25 }, { ad: 'Beyaz', stok: 20 }], _m: now }], hammadde: [], malSiparis: [], malKat: [] }); // bulut 5 sattı
  const r = db.urunler.find(u => u.id === 9004); return { s: r.renkler[0].stok, b: r.renkler[1].stok, tot: r.stok };
});
T('K5: Siyah 30 → −2 & −5 = 23, toplam 43', c4.s === 23 && c4.b === 20 && c4.tot === 43, c4);

// 5) Taban yoksa (yeni kayıt) eski davranış (LWW) — bozulma yok
const c5 = await ev(() => {
  const now = Date.now();
  db.cariler.push({ id: 9005, tip: 'musteri', ad: 'Yeni', bakiye: 10, _m: now - 5000 });
  canliDomenUygula('cari', { cariler: [{ id: 9005, tip: 'musteri', ad: 'Yeni', bakiye: 99, _m: now }] });
  return db.cariler.find(c => c.id === 9005).bakiye;
});
T('taban yoksa LWW: bulut (daha yeni) 99', c5 === 99, c5);

// 6) İki taraf aynı değeri yazdıysa birleşim yok (çift sayma olmasın)
const c6 = await ev(() => {
  const now = Date.now();
  db.cariler.push({ id: 9006, tip: 'musteri', ad: 'Aynı', bakiye: 100, _m: now - 100000 });
  _sbGuncelle('cariler', db.cariler);
  const y = db.cariler.find(c => c.id === 9006); y.bakiye = 150; y._m = now - 1000;
  canliDomenUygula('cari', { cariler: [{ id: 9006, tip: 'musteri', ad: 'Aynı', bakiye: 150, _m: now }] });
  return db.cariler.find(c => c.id === 9006).bakiye;
});
T('iki taraf aynı sonucu yazmışsa 150 kalır (çift sayılmaz)', c6 === 150, c6);
T('taban (db._sb) yerel kayıtta saklanır', await ev(() => { save(); const d = JSON.parse(localStorage.getItem(KEY)); return !!(d._sb && d._sb.cariler && d._sb.cariler[9001]); }));
T('taban bulut belgesine gitmez', await ev(() => !('_sb' in canliAl(db, 'cari'))));

console.log('pageErrors:', errs.length ? errs : 'none'); if (errs.length) fail++;
await br.close(); srv.close();
console.log(`\nSONUÇ: ${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
