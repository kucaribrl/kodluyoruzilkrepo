// 🏬 Tek mağaza görünümü: açılışta mağaza seçimi, sadece seçili mağaza verisi, mağaza-mağaza satırlar gizli, cihaza özel seçim.
// Çalıştırma: `node test/17-tek-magaza.test.mjs`  (PLAYWRIGHT_CHROMIUM=/yol/chrome ile sistem Chromium'u)
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
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };
const ev = (fn, a) => page.evaluate(fn, a);
const wait = ms => page.waitForTimeout(ms);
const evet = async () => { await wait(150); await ev(() => document.getElementById('cYes').click()); await wait(250); };

await ev(() => bosBaslat()); await evet();
await ev(() => {
  db.lokasyonlar = [{ id: ANA_LOK, ad: 'Güngören', tip: 'magaza' }, { id: 'L-mer', ad: 'Merter', tip: 'magaza' }];
  db.cariler.push({ id: 5501, tip: 'musteri', ad: 'Güngören Müşteri', bakiye: 100, lokId: ANA_LOK });
  db.cariler.push({ id: 5502, tip: 'musteri', ad: 'Merter Müşteri', bakiye: 200, lokId: 'L-mer' });
  const s = (id, mid, mus, lokId) => ({ id, tip: 'satis', lokId, mid, mus, tarih: Date.now(), kalemler: [], tutar: 100, odenen: 0, kesik: 0, pb: 'TL', satisKur: 1, durum: 'tamam', teslimDurum: 'teslim', odemeler: [] });
  db.satislar.push(s(9601, 5501, 'Güngören Müşteri', ANA_LOK), s(9602, 5502, 'Merter Müşteri', 'L-mer'));
  try { localStorage.removeItem('iq_lokHepsi'); sessionStorage.removeItem('iq_lokSecildi'); } catch (e) {}
  save(); go('panel');
});
// 1) açılış sorusu
await ev(() => lokAcilisSor()); await wait(200);
const soru = await ev(() => ({ acik: $('ov').classList.contains('show'), baslik: $('mT').textContent, n: document.querySelectorAll('#mB button').length }));
T('TM1: açılışta "Bugün hangi mağaza / depodasın?" sorusu, 2 seçenek', soru.acik && /hangi mağaza/.test(soru.baslik) && soru.n === 2, soru);
await ev(() => lokAcilisSec('L-mer')); await wait(200);
T('TM2: Merter seçildi, bu cihaza kaydedildi', await ev(() => aktifLok === 'L-mer' && localStorage.getItem('iq_aktifLok') === 'L-mer'));
await ev(() => lokAcilisSor()); await wait(150);
T('TM3: aynı oturumda tekrar sormaz', await ev(() => !$('ov').classList.contains('show')));
// 2) sadece seçili mağaza
await ev(() => go('satis')); await wait(150);
const sat = await ev(() => $('app').textContent);
T('TM4: satış listesinde sadece Merter satışı', /Merter Müşteri/.test(sat) && !/Güngören Müşteri/.test(sat), sat.slice(0, 200));
await ev(() => go('cari')); await wait(150);
const car = await ev(() => $('app').textContent);
T('TM5: cari listesinde sadece Merter müşterisi, "Mağaza Mağaza Alacak" satırları yok', /Merter Müşteri/.test(car) && !/Güngören Müşteri/.test(car) && !/Mağaza Mağaza/.test(car), car.slice(0, 200));
await ev(() => go('panel')); await wait(150);
T('TM6: panelde mağaza mağaza ciro satırları yok', await ev(() => !/mağaza mağaza ciro/.test($('app').textContent)));
// 3) Ayarlar → Tüm mağazaları göster
await ev(() => go('ayarlar')); await wait(150);
T('TM7: Ayarlar\'da "Tüm mağazaları göster" (kapalı)', await ev(() => /Tüm mağazaları göster/.test($('app').textContent) && /sadece Merter/.test($('app').textContent)));
await ev(() => { lokHepsiToggle(); go('cari'); }); await wait(150);
const car2 = await ev(() => $('app').textContent);
T('TM8: açınca karşılaştırma satırları ve tüm müşteriler geri gelir', /Mağaza Mağaza/.test(car2) && /Güngören Müşteri/.test(car2), car2.slice(0, 200));
await ev(() => { lokHepsiToggle(); });
// 4) seçim cihaza özel: buluttan gelen başka cihazın seçimi bunu değiştirmez; yeniden açılışta korunur
await ev(() => { db.aktifLok = ANA_LOK; canliDomenUygula('ayar', { aktifLok: ANA_LOK }); });
T('TM9: başka cihazın mağaza seçimi bu cihazı değiştirmez', await ev(() => aktifLok === 'L-mer'));
await ev(() => { db.aktifLok = ANA_LOK; save(); });
await page.reload(); await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app')); await wait(400);
T('TM10: uygulama yeniden açılınca bu cihazın seçimi (Merter) kalır', await ev(() => aktifLok === 'L-mer'));
T('TM11: yeniden açılışta GERÇEK veri yüklenir (örnek veriye düşmez — ID_SIRA açılış hatası)', await ev(() => !db.ornek && db.cariler.some(c => c.ad === 'Merter Müşteri') && db.lokasyonlar.length === 2));

T('sayfa hatası yok', errs.length === 0, errs);
console.log(`\n${ok} geçti, ${fail} kaldı`);
await br.close(); srv.close();
process.exit(fail ? 1 : 0);
