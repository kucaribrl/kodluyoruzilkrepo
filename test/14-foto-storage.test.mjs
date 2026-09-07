// Fotoğraf deposu: Cloudinary → Firebase Storage → cihaz önceliği; yükleme başarısızsa base64'e düşüş;
// cihazdaki base64 fotoğrafları toplu buluta taşıma (veride link kalır).
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
const wait = ms => page.waitForTimeout(ms);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// 1) Giriş yok → cihaz; base64 aynen kalır
T('bulut girişi yokken depo = cihaz', await ev(() => fotoDepoTur() === 'cihaz'));
T('cihaz modunda resimYukle base64 döndürür', await ev(png => new Promise(r => resimYukle(png, u => r(u === png))), PNG));

// 2) Sahte Firebase: giriş var + Storage çalışıyor
await ev(() => { window.__put = 0; window.firebase = { auth: () => ({ currentUser: { uid: 'u1' } }), storage: () => ({ ref: p => ({ putString: async () => { window.__put++; return { ref: { getDownloadURL: async () => 'https://storage.test/' + p.split('/').pop() } }; } }) }) }; });
T('girişli + Storage → depo = storage', await ev(() => fotoDepoTur() === 'storage'));
const u1 = await ev(png => new Promise(r => resimYukle(png, u => r(u))), PNG);
T('resimYukle Storage linki döndürür (isletme/iqbasics/foto/…)', /^https:\/\/storage\.test\/[a-z0-9]+\.png$/.test(u1), u1);
T('Cloudinary ayarlıysa öncelik Cloudinary', await ev(() => { db.cldName = 'x'; db.cldPreset = 'y'; const t = fotoDepoTur(); db.cldName = ''; db.cldPreset = ''; return t === 'cloudinary'; }));

// 3) Yükleme reddedilirse (izin yok) base64'e düşer, çökmez
await ev(() => { window.firebase.storage = () => ({ ref: () => ({ putString: async () => { const e = new Error('no'); e.code = 'storage/unauthorized'; throw e; } }) }); });
T('izin hatası → base64 fallback', await ev(png => new Promise(r => resimYukle(png, u => r(u === png))), PNG));

// 4) Toplu taşıma: her yerdeki base64 fotoğraf linke döner
await ev(() => { window.firebase.storage = () => ({ ref: p => ({ putString: async () => ({ ref: { getDownloadURL: async () => 'https://storage.test/' + p.split('/').pop() } }) }) }); });
await ev(png => {
  db.urunler.push({ id: 8801, ad: 'Fotolu', kod: 'F1', kat: 'X', birim: 'adet', stok: 1, renkler: [{ ad: 'Siyah', stok: 1, foto: png }], fotolar: [png, png] });
  db.hammadde.push({ id: 8802, ad: 'Kumaş F', kat: 'Kumaş', birim: 'kg', stok: 0, renkler: [], foto: png });
  db.malSiparis.push({ id: 8803, ad: 'Sip', kat: 'Kumaş', durum: 'geldi', satirlar: [], fisler: [png] });
  db.cekler.push({ id: 8804, tur: 'cek', tip: 'alinan', cariId: 0, cari: 'x', tutar: 1, vade: 1, durum: 'portfoyde', foto: png, fotoArka: png });
  db.firmaLogo = png; save();
}, PNG);
T('taşınacak fotoğraf sayısı 8', (await ev(() => _fotoTopla().length)) === 8, await ev(() => _fotoTopla().length));
await ev(() => fotolariBulutaTasi()); await wait(150); await ev(() => document.getElementById('cYes').click()); await wait(1200);
const sonuc = await ev(() => { const u = urun(8801); const h = db.hammadde.find(x => x.id === 8802); const s = db.malSiparis.find(x => x.id === 8803); const c = db.cekler.find(x => x.id === 8804); const L = [u.renkler[0].foto, ...u.fotolar, h.foto, s.fisler[0], c.foto, c.fotoArka, db.firmaLogo]; return { hepsiLink: L.every(x => /^https:\/\/storage\.test\//.test(x)), kalan: _fotoTopla().length, ov: document.getElementById('ov').classList.contains('show') }; });
T('taşıma: 8 fotoğrafın hepsi link oldu, cihazda base64 kalmadı, pencere kapandı', sonuc.hepsiLink && sonuc.kalan === 0 && !sonuc.ov, sonuc);
T('taşınan linkler guvenliSrc\'den geçer', await ev(() => guvenliSrc(db.firmaLogo) === db.firmaLogo));

console.log('pageErrors:', errs.length ? errs : 'none'); if (errs.length) fail++;
await br.close(); srv.close();
console.log(`\nSONUÇ: ${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
