// Envanter — malzeme siparişi akışı: gramaj/en/foto/kartela+kod, tüm türlerde çeşit satırları,
// teslimde çoklu parti + fiş fotoğrafı + "siparişi kapat", iş emri önizleme/yazdır, tekrar sipariş, WA dönüşü.
// Çalıştırma: repo kökünde `npm i playwright` (bir kez) → `node test/07-envanter-siparis.test.mjs`
// Chromium yolu farklıysa: PLAYWRIGHT_CHROMIUM=/yol/chrome node test/...
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  if (req.url.includes('sw.js')) { res.writeHead(404); return res.end(); } // SW kaydolursa sayfa yenilenir — testte istemiyoruz
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
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' — ' + JSON.stringify(x).slice(0, 220) : '')); } };
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = ms => page.waitForTimeout(ms);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ---- 1) Kumaş siparişi: gramaj + en + foto + kartela/kod, satırlar partisiz ----
await ev(() => { go('envanter'); envView = 'siparis'; rEnvanter(); malSipForm(0); });
await wait(250);
T('form: gramaj / en / kartela / foto alanları var', await ev(() => !!document.getElementById('ms-gramaj') && !!document.getElementById('ms-en') && !!document.getElementById('ms-kartela') && !!document.getElementById('ms-foto-box')));
T('form: kumaş satırında kod kutusu var, parti kutusu YOK', await ev(() => { const h = document.getElementById('ms-satir-box').innerHTML; return h.includes('kartela renk kodu') && !h.includes('parti'); }));
await ev(png => {
  document.getElementById('ms-ad').value = 'Süprem 30/1';
  document.getElementById('ms-gramaj').value = '180';
  document.getElementById('ms-en').value = '185';
  document.getElementById('ms-kartela').value = 'Antep Kartela 2026';
  document.getElementById('ms-fiyat').value = '100';
  msFoto = png;
  msSatir = [{ renk: 'Siyah', kod: '4512', miktar: 200 }, { renk: 'Beyaz', kod: 'B-7', miktar: 100 }];
  kaydetMalSip(0);
}, PNG);
await wait(300);
const sip1 = await ev(() => db.malSiparis[db.malSiparis.length - 1]);
T('sipariş: gramaj/en/kartela/foto/kod kaydedildi', sip1 && sip1.gramaj === 180 && sip1.en === 185 && sip1.kartela === 'Antep Kartela 2026' && !!sip1.foto && sip1.satirlar[0].kod === '4512' && !sip1.satirlar[0].parti, sip1 && { g: sip1.gramaj, k: sip1.kartela, s0: sip1.satirlar && sip1.satirlar[0] });
const hkart = await ev(() => db.hammadde.find(h => h.ad === 'Süprem 30/1'));
T('malzeme kartı: gramaj/foto/kartela/renk kodu yansıdı', hkart && hkart.gramaj === 180 && !!hkart.foto && hkart.kartela === 'Antep Kartela 2026' && hkart.renkler.find(r => r.ad === 'Siyah').kod === '4512', hkart && { g: hkart.gramaj, k: hkart.kartela });

// ---- 2) Teslim: aynı renkten 2 farklı parti + fiş foto + siparişi kapat ----
await ev(id => malSipTeslim(id), sip1.id);
await wait(250);
T('teslim: parti girişi, ＋ parti, #kod ve kapat kutusu var', await ev(() => { const w = document.getElementById('mt-wrap').innerHTML; return w.includes('parti no') && w.includes('＋ parti') && w.includes('#4512') && !!document.getElementById('mt-kapat'); }));
await ev(({ id, png }) => {
  mtSatir[0].rows = [{ parti: 'P1', mik: 120 }, { parti: 'P2', mik: 50 }];
  mtSatir[1].rows = [{ parti: '', mik: 0 }];
  mtFisler = [png];
  document.getElementById('mt-kapat').checked = true;
  kaydetMalSipTeslim(id);
}, { id: sip1.id, png: PNG });
await wait(300);
const s1son = await ev(id => db.malSiparis.find(x => x.id === id), sip1.id);
T('teslim: sipariş KAPANDI (kısmi/eksik kalmadı), gelen 170, fiş kaydedildi', s1son && s1son.durum === 'geldi' && Math.abs(s1son.gelenMiktar - 170) < 0.01 && s1son.fisler && s1son.fisler.length === 1, s1son && { d: s1son.durum, g: s1son.gelenMiktar });
const siyah = await ev(() => { const h = db.hammadde.find(x => x.ad === 'Süprem 30/1'); return h && h.renkler.find(r => r.ad === 'Siyah'); });
T('stok: Siyah 170 = P1 120 + P2 50 (iki parti)', siyah && Math.abs(siyah.stok - 170) < 0.01 && siyah.partiler && siyah.partiler.length === 2 && siyah.partiler.some(p => p.kod === 'P1' && Math.abs(p.mik - 120) < 0.01) && siyah.partiler.some(p => p.kod === 'P2' && Math.abs(p.mik - 50) < 0.01), siyah);
T('yolda kalmadı (kapatıldı)', (await ev(() => malGelecek(db.hammadde.find(x => x.ad === 'Süprem 30/1')))) === 0);

// ---- 3) Detay + iş emri önizleme/yazdır + tekrar sipariş ----
await ev(id => malSipDetay(id), sip1.id);
await wait(200);
const det = await ev(() => document.getElementById('mB').innerHTML);
T('detay: fişler, gramaj, #kod, kartela görünüyor; "eksik" yok, fark var', det.includes('📎 Fişler') && det.includes('180 gr/m²') && det.includes('#4512') && det.includes('Antep Kartela 2026') && !det.includes('eksik') && det.includes('fark'));
T('detay (gelmiş): Tekrar Sipariş + fiş ekle var, WhatsApp butonu yok', det.includes('malSipTekrar') && det.includes('malSipFisEkle') && !det.includes('malSipGonder('));
await ev(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
await ev(id => malSipPdf(id), sip1.id);
await wait(900);
const onz = await ev(() => ({ html: document.getElementById('mB').innerHTML, img: !!document.querySelector('#mB img[src^="data:image/png"]') }));
T('iş emri: ekranda önizleme resmi + paylaş/yazdır/indir/yazı butonları', onz.img && onz.html.includes('malSipResimPaylas') && onz.html.includes('malSipYazdir') && onz.html.includes('malSipResimIndir') && onz.html.includes('malSipGonder'), onz.html.slice(0, 100));
await ev(id => malSipYazdir(id), sip1.id);
await wait(500);
const pdf = await ev(() => ({ n: window.__printed, html: document.getElementById('printarea').innerHTML }));
T('yazdır: print çağrıldı, A4 içerik tam (başlık+gramaj+kartela kodu+toplam)', pdf.n === 1 && pdf.html.includes('MALZEME SİPARİŞİ') && pdf.html.includes('180 gr/m²') && pdf.html.includes('Kartela Kodu') && pdf.html.includes('TOPLAM'), pdf.n);
await ev(id => malSipTekrar(id), sip1.id);
await wait(250);
const tekrar = await ev(() => ({ ad: (document.getElementById('ms-ad') || {}).value, sat: msSatir, g: (document.getElementById('ms-gramaj') || {}).value, k: (document.getElementById('ms-kartela') || {}).value }));
T('tekrar sipariş: ad/miktar/kod/gramaj/kartela geri geldi', tekrar.ad === 'Süprem 30/1' && tekrar.sat.length === 2 && tekrar.sat[0].miktar === 200 && tekrar.sat[0].kod === '4512' && tekrar.g == '180' && tekrar.k === 'Antep Kartela 2026', tekrar);
await ev(() => closeM());

// ---- 4) Bekleyen sipariş detayı: sade butonlar ----
await ev(() => { malSipForm(0); document.getElementById('ms-ad').value = 'Ribana'; msSatir = [{ renk: 'Lacivert', miktar: 50 }]; kaydetMalSip(0); });
await wait(200);
const sipW = await ev(() => db.malSiparis[db.malSiparis.length - 1]);
await ev(id => malSipDetay(id), sipW.id);
await wait(200);
const detB = await ev(() => document.getElementById('mB').innerHTML);
T('bekleyen detay: Teslim + İş Emri + Düzenle + İptal var; WhatsApp ve Fiş ekle YOK', detB.includes('malSipTeslim') && detB.includes('malSipPdf') && detB.includes('malSipForm') && detB.includes('malSipIptal') && !detB.includes('malSipGonder(') && !detB.includes('malSipFisEkle'));
// WhatsApp yazı yolu (önizlemeden): link açılır, modal kapanır, ekran yerinde kalır
await ev(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return { ok: 1 }; }; });
await ev(id => malSipGonder(id), sipW.id);
await wait(600);
const waSon = await ev(() => ({ opened: window.__opened.length, modalAcik: document.getElementById('ov').classList.contains('show'), ekran: document.getElementById('app').innerHTML.includes('Bekleyenler') }));
T('WA: link açıldı, modal kapandı, sipariş ekranı yerinde (beyaz ekran yok)', waSon.opened === 1 && !waSon.modalAcik && waSon.ekran, waSon);

// ---- 5) Aksesuar: çeşit satırları (renk/boy), kod/kartela yok, teslimde parti yok ----
await ev(() => { malSipForm(0); document.getElementById('ms-kat').value = 'Aksesuar'; msKatDegis(); });
await wait(150);
const aks = await ev(() => ({ html: document.getElementById('ms-satir-wrap').innerHTML, birim: document.getElementById('ms-birim').value, kartela: document.getElementById('ms-kartela-wrap').style.display }));
T('aksesuar: çeşit satırları açık, birim adet, kod/kartela gizli', aks.html.includes('Çeşitler ve miktarları') && aks.html.includes('Çeşit ekle') && !aks.html.includes('kartela renk kodu') && aks.birim === 'adet' && aks.kartela === 'none', aks);
await ev(() => { document.getElementById('ms-ad').value = 'Metal Fermuar'; msSatir = [{ renk: 'Siyah 18cm', miktar: 500 }, { renk: 'Siyah 50cm', miktar: 200 }]; kaydetMalSip(0); });
await wait(250);
const sipA = await ev(() => db.malSiparis[db.malSiparis.length - 1]);
T('aksesuar: boy kırılımlı sipariş oluştu', sipA && sipA.kat === 'Aksesuar' && sipA.satirlar.length === 2 && sipA.satirlar[0].renk === 'Siyah 18cm', sipA && sipA.satirlar);
await ev(id => malSipTeslim(id), sipA.id);
await wait(200);
T('aksesuar teslim: parti kutusu yok', !(await ev(() => document.getElementById('mt-wrap').innerHTML.includes('parti'))));
await ev(id => kaydetMalSipTeslim(id), sipA.id);
await wait(250);
const hAks = await ev(() => db.hammadde.find(h => h.ad === 'Metal Fermuar'));
T('aksesuar stok: çeşitlere göre girdi (Siyah 18cm = 500)', hAks && hAks.renkler.length === 2 && hAks.renkler.find(r => r.ad === 'Siyah 18cm').stok === 500, hAks && hAks.renkler);

// ---- 6) Etiket ipucu ----
await ev(() => { malSipForm(0); document.getElementById('ms-kat').value = 'Etiket'; msKatDegis(); });
await wait(150);
T('etiket: marka + beden ipucu', await ev(() => document.getElementById('ms-satir-wrap').innerHTML.includes('marka + beden')));
await ev(() => closeM());

// ---- 7) Ekran turu ----
for (const s of ['ozet', 'stok', 'satis', 'cari', 'kasa', 'envanter', 'uretim', 'rapor', 'ayar', 'portal']) {
  await ev(x => { try { go(x); } catch (e) { window.__goErr = x + ': ' + e.message; } }, s);
  await wait(100);
}
T('ekran turu hatasız', !(await ev(() => window.__goErr || '')));
console.log('pageErrors:', errs.length ? errs : 'none');
if (errs.length) fail++;

await br.close(); srv.close();
console.log(`\nSONUÇ: ${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
