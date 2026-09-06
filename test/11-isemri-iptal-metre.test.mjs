// Faz D-1: kumaş tüketiminde kg↔metre dönüşümü (gramaj × en) ve iş emri iptali (kumaş + malzeme geri, oto alım iptal).
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
const evet = async () => { await wait(150); await ev(() => document.getElementById('cYes').click()); await wait(250); };

// ---- kg → metre dönüşümü ----
const cv = await ev(() => ({
  metre: ieTukCevir(0.3, { birim: 'metre', gramaj: 200, en: 150 }),   // 0.3 kg → 0.3×100000/(200×150) = 1 m
  eksik: ieTukCevir(0.3, { birim: 'metre' }),
  kg: ieTukCevir(0.3, { birim: 'kg' }),
  top: ieTukCevir(0.3, { birim: 'top' }),
}));
T('kg→metre: 0,3 kg (200 gr/m² · en 150) = 1 metre', Math.abs(cv.metre.parca - 1) < 1e-9 && cv.metre.birim === 'metre' && /kg→metre/.test(cv.metre.not), cv.metre);
T('gramaj/en yoksa uyarı verir, kg değeri kalır', cv.eksik.parca === 0.3 && /⚠️/.test(cv.eksik.not));
T('kg kartında değişmez; top kartında uyarı', cv.kg.parca === 0.3 && !cv.kg.not && /⚠️/.test(cv.top.not));

// ---- iş emri iptali: kumaş (renkli, metre) + malzeme geri, oto alım iptal ----
await ev(() => {
  db.hammadde.push({ id: 7001, ad: 'Metrelik Süprem', kat: 'Kumaş', birim: 'metre', gramaj: 200, en: 150, stok: 80, renkler: [{ ad: 'Siyah', stok: 50 }, { ad: 'Beyaz', stok: 30 }] });
  db.hammadde.push({ id: 7002, ad: 'Etiket A', kat: 'Etiket', birim: 'adet', stok: 900, renkler: [] });
  // iş emri: 100 adet (Siyah 60, Beyaz 40), parça başına 1 m (0.3 kg çevrilmiş) → 60 m Siyah, 40 m Beyaz düşülmüş sayılır
  const k = db.hammadde.find(h => h.id === 7001); malStoklaRenk(k, 'Siyah', -60); malStoklaRenk(k, 'Beyaz', -40);
  const e = db.hammadde.find(h => h.id === 7002); e.stok -= 100;
  db.isemirleri.push({ id: 7101, urun: 'Test Polo', kod: 'TP1', birim: 'adet', seriAdet: 1, hedef: 100, renkDagilim: [{ ad: 'Siyah', adet: 60 }, { ad: 'Beyaz', adet: 40 }], duraklar: [{ ad: 'Kesim', gelen: 0, defolu: 0, durum: 'devam', borclandi: false, borclanan: 0 }], malzeme: [{ ad: 'Etiket A', hid: 7002, mik: 100, birim: 'adet', durum: 'var' }, { ad: 'Fermuar Z', hid: null, mik: 100, birim: 'adet', durum: 'alinacak', alimId: 7201 }], kumasId: 7001, kumasAd: 'Metrelik Süprem', kumasTukBirim: 0.3, kumasTukStokParca: 1, kumasTukStokBirim: 'metre', kumasTukToplam: 100, durum: 'devam', stoklandi: false, baslangic: Date.now() });
  db.malSiparis.push({ id: 7201, oto: true, ieId: 7101, ad: 'Fermuar Z', kat: 'Aksesuar', durum: 'bekliyor', satirlar: [{ renk: '', miktar: 100, gelen: 0 }], miktar: 100, birim: 'adet' });
  save();
});
const once = await ev(() => { const k = db.hammadde.find(h => h.id === 7001); return { s: k.renkler.find(r => r.ad === 'Siyah').stok, b: k.renkler.find(r => r.ad === 'Beyaz').stok, e: db.hammadde.find(h => h.id === 7002).stok }; });
T('kurulum: Siyah −10, Beyaz −10, etiket 800 (düşülmüş)', once.s === -10 && once.b === -10 && once.e === 800, once);
await ev(() => { uretimDetay(7101); });
await wait(250);
T('detayda "İş Emrini İptal Et" butonu var', await ev(() => document.getElementById('mB').innerHTML.includes('isEmriIptal(7101)')));
await ev(() => isEmriIptal(7101)); await evet();
const sonra = await ev(() => { const k = db.hammadde.find(h => h.id === 7001); return { s: k.renkler.find(r => r.ad === 'Siyah').stok, b: k.renkler.find(r => r.ad === 'Beyaz').stok, tot: k.stok, e: db.hammadde.find(h => h.id === 7002).stok, ie: !!db.isemirleri.find(x => x.id === 7101), oto: db.malSiparis.find(s => s.id === 7201).durum }; });
T('iptal: kumaş Siyah 50 / Beyaz 30 (metre) geri geldi, toplam 80', sonra.s === 50 && sonra.b === 30 && Math.abs(sonra.tot - 80) < 0.001, sonra);
T('iptal: etiket 900\'e döndü, iş emri silindi, oto alım siparişi iptal', sonra.e === 900 && !sonra.ie && sonra.oto === 'iptal', sonra);

// ---- üretim başlamışsa iptal engellenir ----
await ev(() => { db.isemirleri.push({ id: 7102, urun: 'Başlamış', kod: 'B1', birim: 'adet', hedef: 10, renkDagilim: [], duraklar: [{ ad: 'Kesim', gelen: 5, durum: 'devam' }], malzeme: [], durum: 'devam' }); save(); isEmriIptal(7102); });
await wait(200);
T('durak teslimi olan iş emri iptal edilemez (onay bile çıkmaz)', await ev(() => !!db.isemirleri.find(x => x.id === 7102) && !document.getElementById('cov').classList.contains('show')));

// ---- ekran turu ----
for (const s of ['uretim', 'envanter', 'stok', 'rapor']) { await ev(x => { try { go(x) } catch (e) { window.__goErr = x + ': ' + e.message } }, s); await wait(80); }
T('ekran turu hatasız', !(await ev(() => window.__goErr || '')));
console.log('pageErrors:', errs.length ? errs : 'none'); if (errs.length) fail++;
await br.close(); srv.close();
console.log(`\nSONUÇ: ${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
