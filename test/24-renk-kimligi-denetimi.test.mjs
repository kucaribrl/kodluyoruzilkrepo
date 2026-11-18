// R2.0: Renk kimliği geçişi için SALT OKUNUR denetim — renkKimlikDenetle(veri) + yönetici rapor ekranı.
// Denetim fonksiyonu saf olmalı: girdiyi değiştirmez, kaydetmez, ağ/Firebase kullanmaz, aynı girdiye aynı raporu verir.
// Ekran yalnız yönetici (adminMi) için açılır, yalnız yüklü db'yi okur, hiçbir düzeltme/kaydet düğmesi içermez.
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

const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const ctx = await br.newContext();
const disIstek = [];
await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return route.continue(); disIstek.push(h); return route.abort(); });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));
const ev = (fn, a) => page.evaluate(fn, a);

// ---- Test verisi (saf fonksiyon için ayrı nesne; db'ye yazılmaz) ----
const VERI = {
  urunler: [
    { id: 1, ad: 'Polo', renkler: [{ ad: 'Siyah', barkod: '111' }, { ad: 'siyah', barkod: '112' }, { ad: 'Beyaz', barkod: '111' }, { ad: 'Kırmızı' }] },  // ad + barkod mükerrer, barkodsuz
    { id: 2, ad: 'Tişört', renkler: [{ ad: 'Lacivert', barkod: '201', rid: 'rX' }, { ad: 'Gri', barkod: '202', rid: 'rX' }, { ad: 'Yeşil', barkod: '203', rid: 'rY' }] }, // rid mükerrer
    { id: 3, ad: 'Sweat', renkler: [{ ad: 'Bordo', barkod: '301' }, { ad: 'Antrasit', barkod: '302' }] },
    { id: 4, ad: 'Renksiz Ürün', renkler: [] },
  ],
  satislar: [
    { id: 101, tip: 'satis', tarih: 1, mus: 'GİZLİ MÜŞTERİ', teslimDurum: 'teslim', kalemler: [{ uid: 3, renkler: [{ ad: 'Bordo', mik: 1 }] }] },              // tek aday
    { id: 102, tip: 'satis', tarih: 2, teslimDurum: 'teslim', kalemler: [{ uid: 3, renkler: [{ ad: 'Mor', mik: 1 }] }] },                                  // sıfır aday
    { id: 103, tip: 'satis', tarih: 3, teslimDurum: 'ayrildi', kalemler: [{ uid: 1, renkler: [{ ad: 'Siyah', mik: 2 }] }] },                                // belirsiz + açık
    { id: 104, tip: 'satis', tarih: 4, teslimDurum: 'teslim', kalemler: [{ uid: 2, renkler: [{ ad: 'Yeşil', rid: 'rYOK', mik: 1 }] }] },                    // rid var, bulunamıyor (ad eşleşse de düşülmez)
    { id: 105, tip: 'satis', tarih: 5, teslimDurum: 'ayrildi', eksikStok: true, eksik: [{ uid: 3, renk: 'Turuncu', adet: 1 }], kalemler: [{ uid: 3, renkler: [{ ad: 'Antrasit', mik: 1 }] }] }, // ön sipariş eşleşmeyen
    { id: 106, tip: 'satis', tarih: 6, teslimDurum: 'teslim', kalemler: [{ uid: 99, renkler: [{ ad: 'Siyah', mik: 1 }] }] },                               // ürün yok
    { id: 107, tip: 'iade', tarih: 7, kalemler: [{ uid: 3, renkler: [{ ad: 'bordo', mik: 1 }] }] },                                                       // yalnız harf farkı
  ],
  transferler: [
    { id: 'T1', durum: 'yolda', kalemler: [{ uid: 3, renk: 'Lila', adet: 2 }] },                       // eşleşmeyen + açık
    { id: 'T2', durum: 'teslim', kalemler: [{ uid: 3, renk: 'Antrasit', adet: 1 }] },
  ],
  isemirleri: [
    { id: 501, urunId: 1, durum: 'devam', renkDagilim: [{ ad: 'Siyah', adet: 10 }], duraklar: [{ ad: 'Kesim', gonderilenRenk: { Siyah: 10 }, renkGelen: {}, renkDefo: {} }] }, // belirsiz + açık
    { id: 502, urun: 'Kayıp', durum: 'devam', renkDagilim: [{ ad: 'Siyah', adet: 1 }] },               // ürün kimliği yok
  ],
  bekleyenPortal: [{ id: 'bp1', kalemler: [{ uid: 3, renkler: [{ ad: 'Pembe', mik: 1 }] }] }],        // portal eşleşmeyen
};

T('altyapı: canlı senkron kapalı', await ev(() => canliAcik === false));
T('altyapı: renkKimlikDenetle ve renkKimlikDenetimEkrani tanımlı', await ev(() => typeof renkKimlikDenetle === 'function' && typeof renkKimlikDenetimEkrani === 'function'));

const R = await ev((V) => { if (typeof renkKimlikDenetle !== 'function') return null; return renkKimlikDenetle(V); }, VERI);
const B = (kat, f = () => true) => (R && R.bulgular || []).filter(b => b.kategori === kat && f(b));
const has = (kat, f) => B(kat, f).length > 0;

T('1 kimliksiz renk sayılır (rid yok: ürün 1 → 4, ürün 3 → 2; ürün 2 kimlikli)', R && R.ozet.kimliksiz === 6 && has('kimliksiz', b => b.urunId === 1 && b.renk === 'Siyah'), R && R.ozet);
T('2 aynı üründe Siyah/siyah mükerrer ad', has('mukerrer-ad', b => b.urunId === 1), B('mukerrer-ad'));
T('3 aynı üründe aynı barkod (111) iki renkte', has('mukerrer-barkod', b => b.urunId === 1 && /111/.test(b.gerekce)), B('mukerrer-barkod'));
T('4 aynı rid (rX) iki renkte → kritik', has('mukerrer-rid', b => /rX/.test(b.gerekce) && b.onem === 'kritik'), B('mukerrer-rid'));
T('5 barkodsuz renk (Kırmızı)', has('barkodsuz', b => b.urunId === 1 && b.renk === 'Kırmızı'), B('barkodsuz'));
T('6 eski satışta tek aday (101 Bordo) → bilgi, kesin kanıt değil', has('tek-aday', b => b.kayit === 'satis#101' && b.onem === 'bilgi' && /kanıt/i.test(b.gerekce)), B('tek-aday'));
T('7 eski satışta sıfır aday (102 Mor) → eşleşmeyen, inceleme', has('eslesmeyen', b => b.kayit === 'satis#102' && b.renk === 'Mor'), B('eslesmeyen'));
T('8 eski satışta birden fazla aday (103 Siyah, ürün 1) → belirsiz, açık işlem kritik', has('belirsiz', b => b.kayit === 'satis#103' && b.acik && b.onem === 'kritik'), B('belirsiz'));
T('9 eski transferde eşleşmeyen renk (T1 Lila, yolda) → eşleşmeyen + açık', has('eslesmeyen', b => b.kayit === 'transfer#T1' && b.acik), B('eslesmeyen'));
T('10 eski iş emrinde belirsiz renk (501 Siyah, renkDagilim ve durak) + ürün kimliği olmayan iş emri (502) eşleştirilmez', has('belirsiz', b => b.kayit === 'isemri#501' && b.acik) && has('urun-kimligi-yok', b => b.kayit === 'isemri#502'), { b: B('belirsiz'), u: B('urun-kimligi-yok') });
T('11 portal (bp1 Pembe) ve ön sipariş (105 eksik Turuncu) eşleşmeyenleri raporlanır', has('eslesmeyen', b => b.kayit === 'portal#bp1') && has('eslesmeyen', b => b.kayit === 'satis#105' && /ön sipariş/i.test(b.tur)), B('eslesmeyen'));
T('12 rid var ama bulunamıyor (104 rYOK) → kimlik-bulunamadi, ada (Yeşil) düşülmez', has('kimlik-bulunamadi', b => b.kayit === 'satis#104' && b.onem === 'kritik') && !has('tek-aday', b => b.kayit === 'satis#104'), { k: B('kimlik-bulunamadi'), t: B('tek-aday', b => b.kayit === 'satis#104') });
T('12b ürünü olmayan kayıt (106 uid 99) → urun-yok, renk eşleştirilmez', has('urun-yok', b => b.kayit === 'satis#106'), B('urun-yok'));
T('12c yalnız büyük/küçük harf farkıyla eşleşen (107 bordo) → harf-farki', has('harf-farki', b => b.kayit === 'iade#107'), B('harf-farki'));
T('L açık işlemler ayrıca listelenir (103, T1, 501, 105, bp1)', R && ['satis#103', 'transfer#T1', 'isemri#501', 'satis#105', 'portal#bp1'].every(k => R.acikIslemler.some(a => a.kayit === k)), R && R.acikIslemler);
T('gizlilik: müşteri adı rapora girmez', R && !JSON.stringify(R).includes('GİZLİ MÜŞTERİ'), null);

const saf = await ev((V) => { if (typeof renkKimlikDenetle !== 'function') return null;
  const once = JSON.stringify(V); const a = renkKimlikDenetle(V); const b = renkKimlikDenetle(V); return { ayni: JSON.stringify(V) === once, belirleyici: JSON.stringify(a) === JSON.stringify(b) }; }, VERI);
T('13 girdi nesnesi değişmez (derin karşılaştırma)', saf && saf.ayni, saf);
T('14 aynı girdi aynı raporu üretir', saf && saf.belirleyici, saf);

// ---- Saf fonksiyon db / kayıt / ağ kullanmaz ----
const yan = await ev((V) => { if (typeof renkKimlikDenetle !== 'function') return null;
  let saveN = 0, canliN = 0; const s0 = window.save, c0 = window.canliYazHemen; const dbOnce = JSON.stringify(db); const ls0 = localStorage.getItem(KEY);
  window.save = function () { saveN++; return s0.apply(this, arguments); }; window.canliYazHemen = function () { canliN++; return c0.apply(this, arguments); };
  try { renkKimlikDenetle(V); renkKimlikDenetle({ urunler: db.urunler, satislar: db.satislar, transferler: db.transferler, isemirleri: db.isemirleri, bekleyenPortal: db.bekleyenPortal }); }
  finally { window.save = s0; window.canliYazHemen = c0; }
  return { saveN, canliN, dbAyni: JSON.stringify(db) === dbOnce, lsAyni: localStorage.getItem(KEY) === ls0 }; }, VERI);
T('13b denetim save/canliYazHemen çağırmaz, db ve localStorage değişmez', yan && yan.saveN === 0 && yan.canliN === 0 && yan.dbAyni && yan.lsAyni, yan);

// ---- Yönetici erişimi ----
const yetki = await ev(() => { if (typeof renkKimlikDenetimEkrani !== 'function') return null;
  const pm = db.personelMod; db.personelMod = true; closeM(); $('toast').textContent = '';
  renkKimlikDenetimEkrani(); const acildi = $('ov').classList.contains('show') && /Renk Kimliği/.test($('ov').textContent);
  rAyarlar && (() => { try { go('ayarlar'); } catch (e) {} })(); const satirVar = /Renk Kimliği Denetimi/.test(document.getElementById('app').textContent);
  db.personelMod = pm; return { acildi, mesaj: $('toast').textContent, satirVar, admin: adminMi() }; });
T('15 yönetici olmayan (personel modu) raporu açamaz; Ayarlar\'da satır görünmez', yetki && !yetki.acildi && /yönetici/i.test(yetki.mesaj) && !yetki.satirVar, yetki);

// ---- Gerçek ekran: yönetici açar, salt okunur ----
const ekran = await ev(() => { if (typeof renkKimlikDenetimEkrani !== 'function') return null;
  db.personelMod = false; db.rol = 'patron';
  db.urunler = db.urunler.filter(u => u.id !== 9501); db.urunler.push({ id: 9501, ad: 'Denetim Polo', kod: 'DN-1', kat: 'X', birim: 'adet', stok: 0, renkler: [{ ad: 'Siyah', barkod: '9' }, { ad: 'SİYAH', barkod: '9' }] });
  let saveN = 0; const s0 = window.save; window.save = function () { saveN++; return s0.apply(this, arguments); };
  const dbOnce = JSON.stringify(db);
  try { go('ayarlar'); } catch (e) {}
  const satir = [...document.querySelectorAll('#app .row')].find(r => /Renk Kimliği Denetimi/.test(r.textContent));
  if (satir) satir.click(); else renkKimlikDenetimEkrani();
  const ov = $('ov'); const metin = ov.textContent;
  const dugmeler = [...ov.querySelectorAll('button')].map(b => b.textContent.trim());
  const yasak = dugmeler.filter(t => /rid ata|eşleştir|sil|kaydet|düzelt/i.test(t));
  const filtre = [...ov.querySelectorAll('[data-rkd-filtre]')]; if (filtre[1]) filtre[1].click();
  const sonra = JSON.stringify(db) === dbOnce; window.save = s0;
  return { satirVar: !!satir, acik: ov.classList.contains('show'), baslik: /Renk Kimliği Denetimi/.test(metin), anlik: /anlık/i.test(metin), mukerrer: /Denetim Polo/.test(metin), filtreSayi: filtre.length, yasak, dbAyni: sonra, saveN }; });
T('16 yönetici Ayarlar → Renk Kimliği Denetimi satırından raporu açar (başlık, anlık görüntü notu, Denetim Polo bulgusu)', ekran && ekran.satirVar && ekran.acik && ekran.baslik && ekran.anlik && ekran.mukerrer, ekran);
T('16b ekranda düzeltme/kaydet/sil/eşleştir düğmesi yok; filtre çalışır; db değişmez, save çağrılmaz', ekran && ekran.yasak.length === 0 && ekran.filtreSayi > 1 && ekran.dbAyni && ekran.saveN === 0, ekran);

T('altyapı: dış istek tamamlanmadı (Firebase dahil)', !disIstek.some(h => /firestore|firebaseio|identitytoolkit|securetoken/.test(h)), disIstek);
T('altyapı: sayfa hatası yok', errs.length === 0, errs);
await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
