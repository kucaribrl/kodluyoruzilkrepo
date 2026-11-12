// Gün sonu kanal kanal sayım (₺, $, €, POS slip, havale, çek) + portal adet fiyatı + portal tükenmiş geri dönüş + kaydırarak geri.
// Çalıştırma: `node test/18-gunsonu-portal-geri.test.mjs`  (PLAYWRIGHT_CHROMIUM=/yol/chrome ile sistem Chromium'u)
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
const page = await br.newPage({ hasTouch: true });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };
const ev = (fn, a) => page.evaluate(fn, a);
const wait = ms => page.waitForTimeout(ms);
const evet = async () => { await wait(150); await ev(() => document.getElementById('cYes').click()); await wait(250); };

await ev(() => bosBaslat()); await evet();
await ev(() => {
  db.kurUSD = 40; db.kurEUR = 50;
  db.cariler.push({ id: 5801, tip: 'musteri', ad: 'GS Müşteri', bakiye: 0 });
  db.hesaplar.push({ id: 7801, ad: 'Nakit Kasa', tur: 'nakit', bakiye: 0 });
  const s = (id, odemeler) => ({ id, tip: 'satis', lokId: aktifLok, mid: 5801, mus: 'GS Müşteri', tarih: Date.now(), kalemler: [], tutar: odemeler.reduce((a, l) => a + l.tutar * pbKur(l.pb), 0), odenen: 0, kesik: 0, pb: 'TL', satisKur: 1, durum: 'tamam', teslimDurum: 'teslim', odemeler });
  [s(9801, [{ tur: 'Nakit', tutar: 1000, pb: 'TL' }, { tur: 'Nakit', tutar: 50, pb: 'USD' }]), s(9802, [{ tur: 'Kredi Kartı', tutar: 2000, pb: 'TL' }, { tur: 'Havale', tutar: 500, pb: 'TL' }]), s(9803, [{ tur: 'Çek', tutar: 3000, pb: 'TL', vade: Date.now() + 9e8 }, { tur: 'Nakit', tutar: 20, pb: 'EUR' }])]
    .forEach(x => { x.odenen = x.tutar; db.satislar.push(x); applySatis(x); });
  const kh = db.hesaplar.find(x => /nakit|kasa/i.test(x.ad)); kasaHareket(kh.id, 'out', 100, 'Gider', 'çay'); save();
});
await ev(() => gunSonuAc()); await wait(250);
const kn = await ev(() => window._gsKn);
T('GS1: kanal kanal beklenen: nakit ₺ 900 (1000−100 gider), $50, €20, POS 2000, havale 500, çek 3000', kn.nakitTL === 900 && kn.nakitUSD === 50 && kn.nakitEUR === 20 && kn.pos === 2000 && kn.havale === 500 && kn.cek === 3000, kn);
T('GS2: sayım ekranında 6 giriş kutusu (₺, $, €, POS slip, havale, çek)', await ev(() => ['nakitTL', 'nakitUSD', 'nakitEUR', 'pos', 'havale', 'cek'].every(k => !!$('gs-' + k)) && /slip/.test($('mB').textContent)));
await ev(() => { $('gs-nakitTL').value = 900; $('gs-nakitUSD').value = 48; $('gs-pos').value = 2000; gsFark(); });
const fk = await ev(() => ({ usd: $('gsf-nakitUSD').textContent, top: $('gs-fark').textContent }));
T('GS3: dolar 2$ eksik → satırda "$2 eksik", toplam ₺80 eksik', /\$2 eksik/.test(fk.usd) && /80 eksik/.test(fk.top), fk);
await ev(() => gunSonuKaydet()); await wait(200);
const rec = await ev(() => db.gunSonu[db.gunSonu.length - 1]);
T('GS4: kayıt: sayım + beklenen kanal kanal, fark −80', rec && rec.sayim.nakitUSD === 48 && rec.sayim.pos === 2000 && rec.beklenen.havale === 500 && rec.fark === -80 && rec.sayim.havale == null, rec);
await ev(() => gunSonuAc()); await wait(200);
T('GS5: tekrar açınca girilen sayım dolu gelir', await ev(() => $('gs-nakitUSD').value === '48' && $('gs-pos').value === '2000'));
await ev(() => closeM());

// ===== Portal: fiyat ADET başı + tükenmiş üründe geri dönüş =====
await ev(() => {
  db.urunler.push({ id: 6801, ad: 'Seri Gömlek', kod: 'SG1', kat: 'Gömlek', birim: 'seri', seri: 4, bedenler: [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }], alis: 50, satis: 100, pb: 'TL', stok: 0, kritik: 0, renkler: [{ ad: 'Mavi', hex: '#36c', stok: 0 }] });
  save(); portalOnizle(); portalMusAd = 'Test'; portalView = 'tesekkur'; portalCiz(); portalUrunAc(6801);
});
await wait(250);
const pt = await ev(() => document.getElementById('pov').textContent);
T('PT1: portal ürün detayında fiyat ADET başı (₺100/adet · 4\'lü seri ₺400)', /₺100\s*\/adet/.test(pt) && /4'li seri ₺400/.test(pt), pt.slice(0, 300));
T('PT2: katalog fiyat yardımcısı adet başı', await ev(() => portalAdetFiyat(urun(6801)) === 100 && /₺100/.test(portalFiyatHtml(urun(6801), true)) && /adet/.test(portalFiyatHtml(urun(6801), true))));
T('PT3: tükenmiş üründe alttaki çubukta "‹ Katalog" geri düğmesi var', await ev(() => [...document.querySelectorAll('#pov button')].some(b => /Katalog/.test(b.textContent) && /portalView='katalog'/.test(b.getAttribute('onclick') || ''))));
// ===== Kaydırarak geri =====
const kaydir = () => ev(() => { const T0 = (x) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 });
  document.dispatchEvent(new TouchEvent('touchstart', { touches: [T0(10)], changedTouches: [T0(10)] }));
  document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [T0(200)] })); });
await kaydir(); await wait(150);
T('KG1: portalda ürün sayfasında soldan sağa kaydırma → kataloğa döner', await ev(() => portalView === 'katalog'));
await ev(() => { portalKapat(); go('stok'); urunDetay(db.urunler[0].id); }); await wait(200);
await kaydir(); await wait(150);
T('KG2: açık pencere kaydırınca kapanır', await ev(() => !$('ov').classList.contains('show') && cur === 'stok'));
await kaydir(); await wait(150);
T('KG3: pencere yokken kaydırınca Panel\'e döner', await ev(() => cur === 'panel'));
await ev(() => { const T0 = (x) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 400 }); go('stok');
  document.dispatchEvent(new TouchEvent('touchstart', { touches: [T0(200)], changedTouches: [T0(200)] }));
  document.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [T0(380)] })); }); await wait(150);
T('KG4: ekranın ortasından kaydırma geri GİTMEZ (sadece sol kenardan)', await ev(() => cur === 'stok'));

// ===== Sadeleştirme: tek Maliyet kutusu, örnek veri sıfırlama yok =====
await ev(() => { db.rol = 'patron'; go('panel'); }); await wait(150);
const pn = await ev(() => $('app').textContent);
T('SD1: Panel\'de tek "Maliyet" kutusu ("Maliyet Listesi" kutusu yok)', /Maliyet/.test(pn) && !/Maliyet Listesi/.test(pn), pn.slice(0, 200));
await ev(() => maliyetListesi()); await wait(150);
T('SD2: Maliyet ekranında iki sekme (Ürün Maliyetleri · Yeni Model Hesabı) ve sekme geçişi', await ev(() => { const a = /Ürün Maliyetleri/.test($('mB').textContent) && /Yeni Model Hesabı/.test($('mB').textContent); maliyetAc(); return a && /Yeni Maliyet Hesabı/.test($('mB').textContent); }));
await ev(() => { closeM(); go('ayarlar'); }); await wait(150);
T('SD3: Ayarlar\'da "Örnek verilere sıfırla" yok', await ev(() => !/Örnek verilere sıfırla/.test($('app').textContent) && typeof sifirla === 'undefined'));

T('sayfa hatası yok', errs.length === 0, errs);
console.log(`\n${ok} geçti, ${fail} kaldı`);
await br.close(); srv.close();
process.exit(fail ? 1 : 0);
