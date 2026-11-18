// Ürün kartı kaydı lokasyon stoğunu korumalı (renk.loklar, kirik, defo ve diğer renk alanları).
// Hata (v172 öncesi): kaydetUrun renkleri formdaki alanlardan yeniden kuruyordu; renk.loklar düşüyor,
// save() → stokProjKaydet yalnız aktif lokasyonu geri yazıyordu → diğer lokasyonların stoğu siliniyordu.
// Testler uygulamanın kendi formUrun / kaydetUrun / renkEkle / cogaltUrun fonksiyonlarını çalıştırır.
// "GÖZLEM" satırları iş kuralı henüz belirlenmemiş davranışı (renk silme / yeniden adlandırma) raporlar, CI'ı kırmaz.
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

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' — ' + JSON.stringify(x).slice(0, 320) : '')); } };
const G = (n, x) => console.log('GÖZLEM ' + n + ' — ' + JSON.stringify(x));

const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const ctx = await br.newContext();
await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; return (h === 'localhost' || h === '127.0.0.1') ? route.continue() : route.abort(); });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));

await page.addScriptTag({ content: `
  const UK = {
    kur(renkler) {
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }, { id: 'L-2', ad: 'Mağaza 2', tip: 'magaza' }];
      aktifLok = 'L-ana'; db.pin = null;
      db.urunler = db.urunler.filter(u => !(u.id >= 9300 && u.id < 9400));
      db.urunler.push({ id: 9301, ad: 'Kart Polo', kod: 'KP-9301', kat: 'Polo', marka: '', kaynak: 'uretim', cesit: 'Markalı', birim: 'seri', seri: 5,
        bedenler: [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }, { beden: 'XXL', adet: 1 }],
        pb: 'TL', alis: 100, satis: 150, karYuzde: 50, kritik: 10, stok: 0, renkler: JSON.parse(JSON.stringify(renkler)) });
      stokProjYukle(); save();
    },
    u() { return urun(9301); },
    loklar() { return Object.fromEntries(renkObjs(urun(9301)).map(r => [r.ad, { ...(r.loklar || {}) }])); },
    ac() { formUrun(9301); },
    kaydet() { kaydetUrun(9301); },
  };
` });
const ev = (fn, a) => page.evaluate(fn, a);
const IKI = [{ ad: 'Siyah', hex: '#111', barkod: '8690000000011', stok: 0, loklar: { 'L-ana': 5, 'L-depo': 7 } }];

T('altyapı: canlı senkron kapalı, ürün kartı fonksiyonları var', await ev(() => canliAcik === false && ['formUrun', 'kaydetUrun', 'renkEkle', 'cogaltUrun'].every(f => typeof window[f] === 'function')));

// 1) Değişiklik yapmadan kaydet
const t1 = await ev((R) => { UK.kur(R); const once = UK.loklar(); UK.ac(); UK.kaydet(); return { once, sonra: UK.loklar() }; }, IKI);
console.log('   1 gözlenen:', JSON.stringify(t1));
T('1 değişiklik yapmadan kaydet: L-ana 5 ve L-depo 7 korunur', t1.sonra.Siyah['L-ana'] === 5 && t1.sonra.Siyah['L-depo'] === 7, t1);

// 2) Ad ve fiyat değişikliği
const t2 = await ev((R) => { UK.kur(R); UK.ac(); $('u-ad').value = 'Kart Polo Yeni'; $('u-satis').value = '175'; UK.kaydet(); return { ad: UK.u().ad, satis: UK.u().satis, l: UK.loklar() }; }, IKI);
T('2 ad + satış fiyatı değişir, bütün lokasyon stokları korunur', t2.ad === 'Kart Polo Yeni' && t2.satis === 175 && t2.l.Siyah['L-ana'] === 5 && t2.l.Siyah['L-depo'] === 7, t2);

// 3) Aktif lokasyon stoğu düzenlenir
const t3 = await ev((R) => { UK.kur(R); UK.ac(); fRenk[0].stok = 9; UK.kaydet(); return UK.loklar(); }, IKI);
T('3 aktif lokasyon (Mağaza) 5→9 düzenlenir, Depo 7 korunur', t3.Siyah['L-ana'] === 9 && t3.Siyah['L-depo'] === 7, t3);

// 4) Birden fazla renk ve lokasyon
const COK = [{ ad: 'Siyah', hex: '#111', barkod: '8690000000011', stok: 0, loklar: { 'L-ana': 5, 'L-depo': 7, 'L-2': 3 } },
             { ad: 'Beyaz', hex: '#fff', barkod: '8690000000028', stok: 0, loklar: { 'L-ana': 2, 'L-depo': 4 } }];
const t4 = await ev((R) => { UK.kur(R); UK.ac(); UK.kaydet(); return UK.loklar(); }, COK);
T('4 iki renk × üç lokasyon değişmeden korunur', JSON.stringify(t4) === JSON.stringify({ Siyah: { 'L-ana': 5, 'L-depo': 7, 'L-2': 3 }, Beyaz: { 'L-ana': 2, 'L-depo': 4 } }), t4);

// 5) kirik ve diğer renk alanları (defo) korunur
const t5 = await ev((R) => { UK.kur(R); UK.ac(); UK.kaydet(); const r = renkObjs(UK.u())[0]; return { kirik: r.kirik, defo: r.defo, barkod: r.barkod, l: r.loklar }; },
  [{ ad: 'Siyah', hex: '#111', barkod: '8690000000011', stok: 0, loklar: { 'L-ana': 5, 'L-depo': 7 }, kirik: { S: 1, L: 2 }, defo: 3 }]);
T('5 kirik {S:1,L:2}, defo 3 ve barkod korunur', JSON.stringify(t5.kirik) === JSON.stringify({ S: 1, L: 2 }) && t5.defo === 3 && t5.barkod === '8690000000011' && t5.l['L-depo'] === 7, t5);

// 6) Yeni renk eklemek eski renkleri değiştirmez
const t6 = await ev((R) => { UK.kur(R); UK.ac(); renkEkle(); const i = fRenk.length - 1; fRenk[i].ad = 'Kırmızı'; fRenk[i].stok = 3; UK.kaydet(); return UK.loklar(); }, COK);
T('6 yeni renk (Kırmızı 3): eski renkler aynen, yeni renk yalnız aktif lokasyonda 3', t6.Siyah['L-depo'] === 7 && t6.Siyah['L-2'] === 3 && t6.Beyaz['L-depo'] === 4 && JSON.stringify(t6['Kırmızı']) === JSON.stringify({ 'L-ana': 3 }), t6);

// 8) Kaydetme sonrası toplam ve aktif lokasyon aynası
const t8 = await ev((R) => { UK.kur(R); UK.ac(); fRenk[1].stok = 6; UK.kaydet(); const u = UK.u();
  return { uStok: u.stok, top: stokTop(u), ayna: renkObjs(u).map(r => [r.stok, (r.loklar || {})['L-ana']]) }; }, COK);
T('8 u.stok = renklerin aktif stok toplamı (5+6) ve her renk.stok = loklar[aktif]', t8.uStok === 11 && t8.top === 11 && t8.ayna.every(([s, l]) => s === l), t8);

// 9) Çoğaltma kaynağın lokasyon stoğunu kopyaya taşımaz (koruma yalnız mevcut ürün düzenlenirken)
const t9 = await ev(async (R) => { UK.kur(R); cogaltUrun(9301); await new Promise(r => setTimeout(r, 300));
  $('u-kod').value = 'KP-KOPYA'; const once = db.urunler.length; kaydetUrun(0);
  const kopya = db.urunler.length > once ? db.urunler[db.urunler.length - 1] : null;
  const sonuc = kopya ? Object.fromEntries(renkObjs(kopya).map(r => [r.ad, { ...(r.loklar || {}) }])) : null;
  if (kopya) db.urunler = db.urunler.filter(x => x !== kopya);
  return { olustu: !!kopya, kopya: sonuc, kaynak: UK.loklar() }; }, COK);
T('9 çoğaltılan ürün kaynağın Depo/Mağaza 2 stoğunu almaz; kaynak korunur', t9.olustu && !t9.kopya.Siyah['L-depo'] && !t9.kopya.Siyah['L-2'] && !t9.kopya.Beyaz['L-depo'] && t9.kaynak.Siyah['L-depo'] === 7, t9);

// 7) Renk yeniden adlandırma / silme — iş kuralı belirlenmedi: yalnız gözlem
const t7a = await ev((R) => { UK.kur(R); UK.ac(); fRenk[0].ad = 'Lacivert'; UK.kaydet(); return UK.loklar(); }, COK);
G('7a renk yeniden adlandırma (Siyah → Lacivert): lokasyon stokları', t7a);
const t7b = await ev((R) => { UK.kur(R); UK.ac(); fRenk.splice(0, 1); UK.kaydet(); return UK.loklar(); }, COK);
G('7b Depo/Mağaza 2 stoğu olan rengi (Siyah) ✕ ile silme: kalan renkler', t7b);
const t7c = await ev((R) => { UK.kur(R); UK.ac(); fRenk.splice(0, 1); renkEkle(); const i = fRenk.length - 1; fRenk[i].ad = 'Siyah'; fRenk[i].stok = 5; UK.kaydet(); return UK.loklar(); }, COK);
G('7c Siyah silinip aynı adla yeniden eklenirse', t7c);

T('altyapı: sayfa hatası yok', errs.length === 0, errs);
await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
