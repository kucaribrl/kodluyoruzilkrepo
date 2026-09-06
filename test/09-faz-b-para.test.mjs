// Faz B (Eylül inceleme raporu — para/çek/satış/üretim doğruluğu): Y7, Y8, Y15, Y17-Y22, Y25 + kasa transfer, kritik 0, open_ kaçış.
// Çalıştırma: `node test/09-faz-b-para.test.mjs`  (PLAYWRIGHT_CHROMIUM=/yol/chrome ile sistem Chromium'u)
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

// ---- Y7: bosBaslat sonrası hesap id çakışması yok ----
await ev(() => bosBaslat()); await evet();
T('Y7: temizlik sonrası hesap id, yeni hesap id ile çakışmaz', await ev(() => { const h0 = db.hesaplar[0].id; const n = nid('oh'); return h0 !== n && !db.hammadde.some(x => x.id === h0); }));

// ---- test verisi ----
await ev(() => {
  db.kurUSD = 40; db.kurEUR = 45;
  db.cariler.push({ id: 5001, tip: 'musteri', ad: 'Faz B Müşteri', bakiye: 0 });
  db.cariler.push({ id: 5002, tip: 'tedarikci', ad: 'Faz B Tedarikçi', bakiye: 0 });
  db.urunler.push({ id: 6001, ad: 'Renkli Polo', kod: 'RP1', kat: 'Polo', birim: 'adet', seri: 1, alis: 100, satis: 200, fiyat: 200, pb: 'TL', stok: 50, kritik: 5, renkler: [{ ad: 'Siyah', hex: '#000', stok: 30, barkod: 'b1' }, { ad: 'Beyaz', hex: '#fff', stok: 20, barkod: 'b2' }] });
  db.urunler.push({ id: 6002, ad: 'Dolar Ürün', kod: 'DU1', kat: 'X', birim: 'adet', seri: 1, alis: 10, satis: 20, fiyat: 800, pb: 'USD', stok: 100, kritik: 0, renkler: [{ ad: 'Gri', hex: '#999', stok: 100, barkod: 'b3' }] });
  db.hesaplar.push({ id: 7001, ad: 'Banka', tur: 'banka', bakiye: 0 });
  save();
});

// ---- Y19: renkli ürün renk seçilmeden satılmaz ----
await ev(() => { sMusId = 5001; sepet = [{ uid: 6001, urun: 'Renkli Polo', mik: 2, birim: 'adet', fiyat: 200 }]; sEdit = 0; window.__n = db.satislar.length; kaydetSatis(); });
await wait(150);
T('Y19: renksiz kalem reddedildi, satış oluşmadı', await ev(() => db.satislar.length === window.__n));
await ev(() => { formSatis(6001); });
await wait(300);
T('Y19: ürün detayından "Satışa Ekle" → sepete körlemesine girmez, renk paneli açılır', await ev(() => sepet.length === 0 && sUrunId === 6001 && !!document.getElementById('rq-0')));
await ev(() => closeM());

// ---- Y21: düzenlemede vade ve satış kuru geri kurulur ----
await ev(() => { db.satislar.push({ id: 8001, tip: 'satis', mid: 5001, mus: 'Faz B Müşteri', tarih: Date.now(), kalemler: [{ uid: 6002, urun: 'Dolar Ürün', mik: 1, birim: 'adet', fiyat: 800 }], araToplam: 800, iskonto: 0, vadeFarki: 7.5, kdv: 0, kdvTutar: 0, tasima: 0, tutar: 21.5, odenen: 0, kesik: 0, pb: 'USD', satisKur: 40, durum: 'tamam', teslimDurum: 'teslim', odemeler: [] }); save(); formSatis(0, 8001); });
await wait(300);
T('Y21: vade 90 gün ve satış kuru 40 geri geldi (bugünkü kur değil)', await ev(() => { db.kurUSD = 55; const h = satisHesap(); return sVade === 90 && sKurEski && sKurEski.kur === 40 && Math.abs(h.div - 40) < 0.001; }));
await ev(() => { db.kurUSD = 40; closeM(); });

// ---- Y20: düzenlerken "+ yeni müşteri" satışı kopyalamaz ----
await ev(() => { formSatis(0, 8001); });
await wait(200);
await ev(() => { _saleStash = { sEdit: sEdit, sVade, sFoto: '', sDepo: false, sKurEski, sepet: sepet, sOdemeler, sPB, sDurum, sCekFoto: '', isk: 0, kdv: 0, tasima: 0, sevk: '', kesik: 0, ekstra: [] }; saleRestore(5001); });
await wait(250);
T('Y20: restore sonrası hâlâ düzenleme modunda (sEdit korunur)', await ev(() => sEdit === 8001 && document.getElementById('mT').textContent.includes('Düzenle')));
await ev(() => closeM());

// ---- Y15: satıştan doğan çek silinemez ----
await ev(() => { db.cekler.push({ id: 9001, tur: 'cek', tip: 'alinan', cariId: 5001, cari: 'Faz B Müşteri', tutar: 1000, vade: Date.now() + 1e8, banka: '—', durum: 'portfoyde', cariIsle: true }); db.satislar.push({ id: 8002, tip: 'satis', mid: 5001, mus: 'Faz B Müşteri', tarih: Date.now(), kalemler: [], tutar: 1000, odenen: 1000, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [{ tur: 'Çek', tutar: 1000, pb: 'TL', _cekId: 9001 }] }); save(); cekSil(9001); });
await wait(200);
T('Y15: satışa bağlı çek silinmedi (onay bile çıkmadı)', await ev(() => db.cekler.some(c => c.id === 9001) && !document.getElementById('cov').classList.contains('show')));

// ---- Y22: taksiti ödenmiş satış iptali → müşteri alacağı ----
await ev(() => { db.cariler.find(c => c.id === 5001).bakiye = 20000; db.satislar.push({ id: 8003, tip: 'satis', mid: 5001, mus: 'Faz B Müşteri', tarih: Date.now(), kalemler: [], tutar: 30000, odenen: 10000, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [], taksitler: [{ tutar: 10000, vade: 1, odendi: true }, { tutar: 10000, vade: 2 }, { tutar: 10000, vade: 3 }] }); save(); silSatis(8003); });
await evet();
T('Y22: iptal sonrası bakiye −10.000 (ödenen taksit alacak oldu)', await ev(() => Math.abs(db.cariler.find(c => c.id === 5001).bakiye - (-10000)) < 1 && !db.satislar.some(s => s.id === 8003)), await ev(() => db.cariler.find(c => c.id === 5001).bakiye));

// ---- Y17: üretim rengi üründe yoksa ayrı satır + doğru prefill ----
await ev(() => { db.isemirleri.push({ id: 9101, urun: 'Renkli Polo', kod: 'RP1', urunId: 6001, hedef: 100, birim: 'adet', durum: 'devam', duraklar: [{ ad: 'Dikim', gelen: 100, renkGelen: { siyah: 60, 'Lacivert Melanj': 40 } }], malzeme: [] }); save(); isEmriTamamlaGoster(9101); });
await wait(250);
T('Y17: "siyah" harf farkına rağmen Siyah=60, Lacivert Melanj ayrı satır=40', await ev(() => { const inp = [...document.querySelectorAll('#mB .syrow input')]; const m = {}; inp.forEach(i => m[i.getAttribute('data-ad')] = +i.value); return m['Siyah'] === 60 && m['Lacivert Melanj'] === 40 && !(m['Beyaz'] > 0); }), await ev(() => [...document.querySelectorAll('#mB .syrow input')].map(i => i.getAttribute('data-ad') + '=' + i.value)));
await ev(() => closeM());

// ---- Y18: renkli malzemede renksiz düşüm '—' rengine ----
const y18 = await ev(() => { const h = { id: 1, ad: 'Düğme', renkler: [{ ad: 'Siyah', stok: 100 }], stok: 100 }; malStokUygula(h, { mik: 30, renk: '' }, +1); malStokUygula(h, { mik: 10, renk: '' }, -1); return h; });
T('Y18: h.stok = renk toplamı korunur ("—" satırı 20, toplam 120)', y18.stok === 120 && y18.renkler.some(r => r.ad === '—' && r.stok === 20), y18);

// ---- Y25: stok raporu dövizli ürünü kura çevirir ----
await ev(() => { db.kurUSD = 40; go('rapor'); });
await wait(200);
const rap = await ev(() => { try { const R = (typeof rapVeri === 'function') ? rapVeri() : {}; const h = rapStok(R); const bek = db.urunler.reduce((a, u) => a + (+u.stok || 0) * urunAlisTL(u) * (u.birim === 'seri' ? (+u.seri || 1) : 1), 0); return { h, bek, tl: TL(bek) }; } catch (e) { return { h: 'ERR ' + e.message }; } });
T('Y25: stok maliyet değeri dövizli ürünü kura çevirerek toplar (Dolar Ürün 100×$10×40 dahil)', rap.bek >= 40000 && typeof rap.h === 'string' && rap.h.includes(rap.tl), { bek: rap.bek, tl: rap.tl });

// ---- Y8: ayar alan bazlı birleştirme ----
const y8 = await ev(() => { db.kurUSD = 41; save(); const m1 = (db._ayarM || {}).kurUSD || 0; canliDomenUygula('ayar', { kurUSD: 99, _ayarM: { kurUSD: m1 - 5000 } }); const a = db.kurUSD; canliDomenUygula('ayar', { kurUSD: 77, _ayarM: { kurUSD: m1 + 5000 } }); const b = db.kurUSD; return { m1, a, b }; });
T('Y8: bayat bulut değeri yereli EZMEZ (41 kalır), yeni değer alınır (77)', y8.m1 > 0 && y8.a === 41 && y8.b === 77, y8);
await ev(() => { db.kurUSD = 40; save(); });

// ---- kasa transfer çift sayım ----
await ev(() => { const h0 = db.hesaplar[0].id; kasaHareket(h0, 'in', 5000, 'Gelir', 'test'); kasaHareket(h0, 'out', 3000, 'Transfer', '→ Banka'); kasaHareket(7001, 'in', 3000, 'Transfer', '← Kasa'); save(); go('kasa'); });
await wait(250);
T('kasa: "Bugün Giren" transfer içermez (₺5.000)', await ev(() => { const h = document.getElementById('app').innerHTML; return h.includes('5.000') && !h.includes('8.000'); }));

// ---- kritik 0 & open_ çift kaçış ----
await ev(() => { const u = urun(6002); u.kritik = 0; save(); formUrun(6002); });
await wait(250);
T('kritik 0 formda 0 görünür (10 olmaz)', await ev(() => (document.getElementById('u-kritik') || {}).value === '0'));
await ev(() => { closeM(); open_('A &amp; B &#39;c&#39;', 'x'); });
T('open_: başlıkta çift kaçış yok', await ev(() => document.getElementById('mT').textContent === "A & B 'c'"));
await ev(() => closeM());

// ---- ekran turu ----
for (const s of ['ozet', 'stok', 'satis', 'cari', 'kasa', 'cek', 'envanter', 'uretim', 'rapor', 'ayar']) { await ev(x => { try { go(x) } catch (e) { window.__goErr = x + ': ' + e.message } }, s); await wait(80); }
T('ekran turu hatasız', !(await ev(() => window.__goErr || '')));
console.log('pageErrors:', errs.length ? errs : 'none'); if (errs.length) fail++;
await br.close(); srv.close();
console.log(`\nSONUÇ: ${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
