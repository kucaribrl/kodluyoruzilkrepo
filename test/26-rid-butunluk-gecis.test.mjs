// R2.1.1: Global rid bütünlüğü (ürün kartı kaydı) + eski renk GEÇİŞ HAZIRLIĞI raporu (salt okunur).
// Kayıt: kaydedilen ürünün renkleri başka ürünlerdeki rid'lerle çakışamaz; ilgisiz ürünler arasındaki eski çakışma kaydı engellemez;
// ürün kimliği mükerrerse kayıt güvenle yapılamaz. Rapor: renkGecisHazirlikDenetle(veri) → ADAY / ELLE_MUTABAKAT / ENGELLI; kimlik atamaz.
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
const ctx = await br.newContext(); const dis = [];
await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return route.continue(); dis.push(h); return route.abort(); });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));
await page.addScriptTag({ content: `
  const RB = {
    urun(id, renkler, ek = {}) { return { id, ad: 'Ürün ' + id, kod: 'RB-' + id, kat: 'Polo', marka: '', kaynak: 'uretim', cesit: 'Markalı', birim: 'seri', seri: 5,
      bedenler: [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }, { beden: 'XXL', adet: 1 }],
      pb: 'TL', alis: 100, satis: 150, karYuzde: 50, kritik: 10, stok: 0, renkler: JSON.parse(JSON.stringify(renkler)), ...ek }; },
    kur(urunler) {
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }];
      aktifLok = 'L-ana'; db.pin = null; db.personelMod = false; db.rol = 'patron'; db.transferler = []; db.isemirleri = []; db.satislar = []; db.bekleyenPortal = [];
      db.urunler = db.urunler.filter(u => !(u.id >= 9700 && u.id < 9800) && !(u.kod || '').startsWith('RB-'));
      urunler.forEach(u => db.urunler.push(u)); stokProjYukle(); save(); },
    durum() { return JSON.stringify(db.urunler.filter(u => (u.kod || '').startsWith('RB-'))); },
    kaydet(id, f) { formUrun(id); if (f) f(); $('toast').textContent = ''; kaydetUrun(id); return $('toast').textContent; },
  };` });
const ev = (fn, a) => page.evaluate(fn, a);
const RIDV = /^r_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

T('altyapı: canlı senkron kapalı', await ev(() => canliAcik === false));

// ---- Global rid bütünlüğü (gerçek formUrun / kaydetUrun) ----
const t1 = await ev(() => { RB.kur([RB.urun(9701, [{ ad: 'Siyah', barkod: '1', rid: 'r_ayni', loklar: { 'L-ana': 1 } }, { ad: 'Beyaz', barkod: '2', rid: 'r_ayni', loklar: { 'L-ana': 2 } }])]);
  const once = RB.durum(); const m = RB.kaydet(9701, () => { $('u-ad').value = 'Değişmemeli'; }); return { m, ayni: RB.durum() === once }; });
T('T1 aynı ürün içinde mükerrer rid → kayıt reddedilir', t1.ayni && /kimli/i.test(t1.m), t1);

const t2 = await ev(() => { RB.kur([RB.urun(9702, [{ ad: 'Siyah', barkod: '1', rid: 'r_ortak', loklar: { 'L-ana': 5, 'L-depo': 7 } }]), RB.urun(9703, [{ ad: 'Kırmızı', barkod: '3', rid: 'r_ortak', loklar: { 'L-ana': 1 } }])]);
  const once = RB.durum(); const m = RB.kaydet(9702, () => { $('u-ad').value = 'Değişmemeli'; fRenk[0].stok = 9; }); return { m, ayni: RB.durum() === once }; });
T('T2 farklı ürünlerde aynı rid → kaydedilen ürünün kaydı reddedilir (hiçbir şey değişmez); mesaj diğer ürünü anar', t2.ayni && /kimli/i.test(t2.m) && /Ürün 9703/.test(t2.m), t2);

const t3 = await ev(() => { RB.kur([RB.urun(9704, [{ ad: 'Siyah', barkod: '1', rid: 'r_tek', loklar: { 'L-ana': 1 } }]),
  RB.urun(9705, [{ ad: 'Gri', barkod: '5', rid: 'r_eski', loklar: {} }]), RB.urun(9706, [{ ad: 'Mavi', barkod: '6', rid: 'r_eski', loklar: {} }])]);
  const m = RB.kaydet(9704, () => { $('u-ad').value = 'Kaydedildi'; }); return { m, ad: urun(9704).ad, d5: renkObjs(urun(9705))[0].rid, d6: renkObjs(urun(9706))[0].rid }; });
T('T3 ilgisiz iki ürün arasındaki eski çakışma (r_eski) başka ürünün kaydını engellemez ve otomatik düzeltilmez', t3.ad === 'Kaydedildi' && t3.d5 === 'r_eski' && t3.d6 === 'r_eski', t3);

const t4 = await ev(() => { RB.kur([RB.urun(9707, [{ ad: 'Siyah', barkod: '1', loklar: { 'L-ana': 5, 'L-depo': 7 }, kirik: { S: 1 }, defo: 2 }])]);
  RB.kaydet(9707, () => { fRenk[0].ad = 'Antrasit'; fRenk[0].barkod = '9'; }); const r = renkObjs(urun(9707))[0]; return { rid: r.rid === undefined ? 'yok' : r.rid, l: r.loklar, k: r.kirik, d: r.defo }; });
T('T4 eski kimliksiz renk (ad + barkod değişse bile) otomatik rid almaz; loklar/kirik/defo korunur', t4.rid === 'yok' && t4.l['L-depo'] === 7 && t4.k.S === 1 && t4.d === 2, t4);

const t56 = await ev(() => { RB.kur([RB.urun(9708, [])]); formUrun(9708); renkEkle(); fRenk[0].ad = 'Siyah'; kaydetUrun(9708); const ilk = renkObjs(urun(9708))[0].rid;
  RB.kaydet(9708, () => { fRenk[0].ad = 'Lacivert'; }); const a = renkObjs(urun(9708))[0].rid; RB.kaydet(9708, () => { fRenk[0].barkod = '8690000000777'; }); const b = renkObjs(urun(9708))[0];
  return { ilk, a, b: b.rid, bk: b.barkod }; });
T('T5 kimlikli renk yeniden adlandırılınca rid korunur', RIDV.test(t56.ilk || '') && t56.a === t56.ilk, t56);
T('T6 barkod değişince rid korunur', t56.bk === '8690000000777' && t56.b === t56.ilk, t56);

const t7 = await ev(async () => { RB.kur([RB.urun(9709, [{ ad: 'Siyah', barkod: '1', rid: 'r_kaynak-1', loklar: { 'L-ana': 3 } }, { ad: 'Beyaz', barkod: '2', loklar: { 'L-ana': 1 } }])]);
  cogaltUrun(9709); await new Promise(r => setTimeout(r, 300)); $('u-kod').value = 'RB-KOPYA'; const n = db.urunler.length; kaydetUrun(0);
  const k = db.urunler.length > n ? db.urunler[db.urunler.length - 1] : null; return { rid: k ? renkObjs(k).map(r => r.rid) : null, kaynak: renkObjs(urun(9709)).map(r => r.rid || 'yok') }; });
T('T7 / T25 çoğaltma (gerçek cogaltUrun → kaydetUrun) kopyada iki renge de yeni, farklı, güvenli rid verir; kaynak değişmez', t7.rid && t7.rid.every(r => RIDV.test(r || '')) && t7.rid[0] !== t7.rid[1] && !t7.rid.includes('r_kaynak-1') && JSON.stringify(t7.kaynak) === JSON.stringify(['r_kaynak-1', 'yok']), t7);

const t8 = await ev(() => { RB.kur([RB.urun(9710, [{ ad: 'Siyah', barkod: '1', rid: 'r_benim', loklar: { 'L-ana': 2 } }]), RB.urun(9711, [{ ad: 'Gri', barkod: '5', rid: 'r_diger', loklar: {} }])]);
  formUrun(9710);                                                                   // kart açık
  const bulut = JSON.parse(JSON.stringify(urun(9711))); bulut.renkler.push({ ad: 'Mor', barkod: '7', rid: 'r_benim', loklar: {} }); bulut._m = Date.now() + 1000;
  canliDomenUygula('stok', { urunler: db.urunler.map(u => u.id === 9711 ? bulut : u) });   // başka cihaz 9711'e aynı rid'li renk ekledi
  const once = RB.durum(); $('u-ad').value = 'Değişmemeli'; $('toast').textContent = ''; kaydetUrun(9710); return { m: $('toast').textContent, ayni: RB.durum() === once }; });
T('T8 kart açıkken başka üründe oluşan çakışma kayıt anında GÜNCEL veriden tespit edilir → reddedilir', t8.ayni && /kimli/i.test(t8.m), t8);

const t9 = await ev(() => { RB.kur([RB.urun(9712, [{ ad: 'Siyah', barkod: '1', rid: 'r_cak', loklar: { 'L-ana': 4, 'L-depo': 6 }, kirik: { S: 1 } }, { ad: 'Beyaz', barkod: '2', rid: 'r_b', loklar: { 'L-ana': 2 } }]), RB.urun(9713, [{ ad: 'Gri', barkod: '5', rid: 'r_cak', loklar: {} }])]);
  const once = RB.durum(); RB.kaydet(9712, () => { $('u-ad').value = 'X'; fRenk[1].stok = 9; renkEkle(); fRenk[2].ad = 'Yeni'; }); return { ayni: RB.durum() === once }; });
T('T9 reddedilen kayıtta ürün, renkler, loklar, kirik ve diğer ürün hiç değişmez (yeni renk de eklenmez)', t9.ayni, t9);

const tId = await ev(() => { RB.kur([RB.urun(9714, [{ ad: 'Siyah', barkod: '1', rid: 'r_x1', loklar: { 'L-ana': 1 } }]), RB.urun(9714, [{ ad: 'Beyaz', barkod: '2', rid: 'r_x2', loklar: { 'L-ana': 1 } }], { kod: 'RB-9714b' })]);
  const once = RB.durum(); const m = RB.kaydet(9714, () => { $('u-ad').value = 'Değişmemeli'; }); return { m, ayni: RB.durum() === once }; });
T('E ürün kimliği (id) mükerrerse kayıt güvenle yapılamaz → reddedilir, mesaj', tId.ayni && /ürün kimliği/i.test(tId.m), tId);

// T22 yeni kimlik yalnız güvenli rastgele kaynak
const t22 = await ev(() => { const mr = Math.random, dn = Date.now; Math.random = () => { throw new Error('Math.random kullanılmamalı'); }; Date.now = () => 0;
  let l = [], hata = null; try { for (let i = 0; i < 200; i++) l.push(yeniRid()); } catch (e) { hata = e.message; } finally { Math.random = mr; Date.now = dn; }
  return { hata, gecerli: l.every(r => /^r_[0-9a-f]{8}-[0-9a-f]{4}-4/.test(r || '')), tekil: new Set(l).size === l.length && l.length === 200 }; });
T('T22 yeniRid Math.random ve Date.now olmadan da 200 geçerli, tekil kimlik üretir (yalnız crypto)', !t22.hata && t22.gecerli && t22.tekil, t22);

// ---- Geçiş hazırlığı raporu (saf) ----
const V = {
  urunler: [
    { id: 1, ad: 'Polo', kod: 'P1', renkler: [{ ad: 'Siyah', barkod: '101' }, { ad: 'Beyaz' }, { ad: 'Gri', barkod: '103', rid: 'r_k1' }] },
    { id: 2, ad: 'Tişört', kod: 'P2', renkler: [{ ad: 'Lacivert', barkod: '201' }, { ad: 'lacivert', barkod: '202' }] },
    { id: 3, ad: 'Sweat A', kod: 'P3', renkler: [{ ad: 'Bordo', barkod: '301' }] },
    { id: 3, ad: 'Sweat B', kod: 'P3B', renkler: [{ ad: 'Mor', barkod: '302' }] },
    { ad: 'Kimliksiz Ürün', kod: 'P4', renkler: [{ ad: 'Yeşil', barkod: '401' }] },
    { id: 5, ad: 'Kazak', kod: 'P5', renkler: [{ ad: 'Kahve', barkod: '101' }] },
    { id: 6, ad: 'Ceket', kod: 'P6', renkler: [{ ad: 'Haki', barkod: '601' }] },
    { id: 7, ad: 'Yelek', kod: 'P7', renkler: [{ ad: 'Antrasit', barkod: '701' }] },
    { id: 8, ad: 'Polar', kod: 'P8', renkler: [{ ad: 'Turuncu', barkod: '801' }] },
  ],
  satislar: [
    { id: 11, tip: 'satis', tarih: 1, teslimDurum: 'teslim', kalemler: [{ uid: 8, renkler: [{ ad: 'Turuncu', mik: 1 }] }] },
    { id: 12, tip: 'satis', tarih: 2, mus: 'GİZLİ MÜŞTERİ', teslimDurum: 'ayrildi', kalemler: [{ uid: 1, renkler: [{ ad: 'Siyah', mik: 1 }] }] },
  ],
  transferler: [{ id: 'T1', durum: 'teslim', kalemler: [{ uid: 6, renk: 'Kum', adet: 1 }] }],
  isemirleri: [{ id: 21, kod: 'P7', urun: 'Yelek', durum: 'devam', renkDagilim: [{ ad: 'Antrasit', adet: 5 }] }],
  bekleyenPortal: [],
};
const G = await ev((v) => typeof renkGecisHazirlikDenetle === 'function' ? renkGecisHazirlikDenetle(v) : null, V);
const R = (u, ad) => (G && G.renkler || []).find(x => String(x.urunKod) === u && x.renk === ad);
const kod = (x, k) => x && [...x.sorunlar, ...x.uyarilar].some(s => s.kod === k);
T('rapor: renkGecisHazirlikDenetle tanımlı; özet ADAY 3 / ELLE 5 / ENGELLI 3, kimlikli renk listeye girmez', G && G.ozet.ADAY === 3 && G.ozet.ELLE_MUTABAKAT === 5 && G.ozet.ENGELLI === 3 && !R('P1', 'Gri'), G && G.ozet);
T('T10 barkodsuz renk (Beyaz) → ELLE_MUTABAKAT', R('P1', 'Beyaz') && R('P1', 'Beyaz').sinif === 'ELLE_MUTABAKAT' && kod(R('P1', 'Beyaz'), 'barkodsuz'), R('P1', 'Beyaz'));
T('T11 mükerrer isimli renkler (Lacivert/lacivert) → ELLE_MUTABAKAT', ['Lacivert', 'lacivert'].every(a => R('P2', a) && R('P2', a).sinif === 'ELLE_MUTABAKAT' && kod(R('P2', a), 'mukerrer-ad')), [R('P2', 'Lacivert'), R('P2', 'lacivert')]);
T('T12 mükerrer ürün kimliği (id 3) → ENGELLI ve ürün sorunu olarak raporlanır', ['P3', 'P3B'].every(k => { const x = (G && G.renkler || []).find(r => r.urunKod === k); return x && x.sinif === 'ENGELLI' && kod(x, 'urun-kimligi-mukerrer'); }) && (G && G.urunSorunlari || []).some(s => s.kod === 'urun-kimligi-mukerrer'), G && G.urunSorunlari);
T('T13 eksik ürün kimliği → ENGELLI ve ürün sorunu', R('P4', 'Yeşil') && R('P4', 'Yeşil').sinif === 'ENGELLI' && kod(R('P4', 'Yeşil'), 'urun-kimligi-yok') && (G && G.urunSorunlari || []).some(s => s.kod === 'urun-kimligi-yok'), R('P4', 'Yeşil'));
T('T14 yalnız adla tek aday eski satış (Turuncu) → ADAY ama "kesin kanıt değil" uyarısıyla', R('P8', 'Turuncu') && R('P8', 'Turuncu').sinif === 'ADAY' && R('P8', 'Turuncu').uyarilar.some(u => u.kod === 'gecmis-yalniz-ad' && /kanıt/i.test(u.metin)), R('P8', 'Turuncu'));
T('T15 üründe eşleşmeyen transfer geçmişi (Kum) → Haki ELLE_MUTABAKAT', R('P6', 'Haki') && R('P6', 'Haki').sinif === 'ELLE_MUTABAKAT' && kod(R('P6', 'Haki'), 'eslesmeyen-gecmis'), R('P6', 'Haki'));
T('T16 ürün kimliği olmayan iş emri (kod P7) güvenli eşleşmiş sayılmaz → Antrasit ELLE_MUTABAKAT', R('P7', 'Antrasit') && R('P7', 'Antrasit').sinif === 'ELLE_MUTABAKAT' && kod(R('P7', 'Antrasit'), 'kimliksiz-is-emri'), R('P7', 'Antrasit'));
T('T23 farklı ürünlerde aynı barkod (101: Polo Siyah, Kazak Kahve) hata sayılmaz, uyarı olarak görünür; Kahve ADAY', R('P5', 'Kahve') && R('P5', 'Kahve').sinif === 'ADAY' && R('P5', 'Kahve').uyarilar.some(u => u.kod === 'barkod-baska-urunde') && R('P1', 'Siyah') && R('P1', 'Siyah').uyarilar.some(u => u.kod === 'barkod-baska-urunde'), [R('P5', 'Kahve'), R('P1', 'Siyah')]);
T('T24 açık yükümlülük (Siyah, rezerve satış) raporda görünür', R('P1', 'Siyah') && R('P1', 'Siyah').acikYukumluluk.length > 0 && R('P1', 'Siyah').uyarilar.some(u => u.kod === 'acik-yukumluluk'), R('P1', 'Siyah'));
T('gizlilik: müşteri adı rapora girmez', G && !JSON.stringify(G).includes('GİZLİ MÜŞTERİ'));
const saf = await ev((v) => { if (typeof renkGecisHazirlikDenetle !== 'function') return null; const once = JSON.stringify(v); let s = 0; const s0 = window.save; window.save = function () { s++; return s0.apply(this, arguments); };
  try { const a = renkGecisHazirlikDenetle(v), b = renkGecisHazirlikDenetle(v); return { ayni: JSON.stringify(v) === once, bel: JSON.stringify(a) === JSON.stringify(b), s }; } finally { window.save = s0; } }, V);
T('T17 rapor girdiyi değiştirmez (derin karşılaştırma)', saf && saf.ayni, saf);
T('T18 aynı girdi aynı raporu üretir; save çağrılmaz', saf && saf.bel && saf.s === 0, saf);

// ---- Ekran ve erişim ----
const yetki = await ev(() => { if (typeof renkGecisHazirlikEkrani !== 'function') return null; db.personelMod = true; closeM(); $('toast').textContent = ''; renkGecisHazirlikEkrani();
  const acildi = $('ov').classList.contains('show') && /Renk Geçiş Hazırlığı/.test($('ov').textContent); try { go('ayarlar'); } catch (e) {}
  const satir = /Renk Geçiş Hazırlığı/.test(document.getElementById('app').textContent); db.personelMod = false; return { acildi, m: $('toast').textContent, satir }; });
T('T19 yönetici olmayan raporu açamaz (doğrudan çağrı dahil), Ayarlar\'da satır görünmez', yetki && !yetki.acildi && /yönetici/i.test(yetki.m) && !yetki.satir, yetki);
const ekran = await ev(() => { if (typeof renkGecisHazirlikEkrani !== 'function') return null; db.personelMod = false; db.rol = 'patron';
  RB.kur([RB.urun(9715, [{ ad: 'Siyah', barkod: '1' }, { ad: 'Beyaz' }])]); const once = JSON.stringify(db); let s = 0; const s0 = window.save; window.save = function () { s++; return s0.apply(this, arguments); };
  try { go('ayarlar'); } catch (e) {} const satir = [...document.querySelectorAll('#app .row')].find(r => /Renk Geçiş Hazırlığı/.test(r.textContent)); if (satir) satir.click();
  const ov = $('ov'), metin = ov.textContent, dug = [...ov.querySelectorAll('button')].map(b => b.textContent.trim());
  const yasak = dug.filter(t => /rid ata|kimlik ata|eşleştir|sil|kaydet|düzelt/i.test(t)); const f = [...ov.querySelectorAll('[data-rgh-filtre]')]; if (f[1]) f[1].click();
  window.save = s0; return { satir: !!satir, baslik: /Renk Geçiş Hazırlığı/.test(metin), aciklama: /kimlik atamaz/i.test(metin) && /değiştirmez/i.test(metin), sayilar: /ADAY/.test(metin) && /ELLE/.test(metin) && /ENGELL/.test(metin), urun: /Ürün 9715/.test(metin), yasak, filtre: f.length, dbAyni: JSON.stringify(db) === once, s }; });
T('T20 yönetici ekranı açar: başlık, "kimlik atamaz / değiştirmez" açıklaması, sınıf sayıları, ürün satırı; veri değiştiren düğme yok; filtre çalışır; db değişmez', ekran && ekran.satir && ekran.baslik && ekran.aciklama && ekran.sayilar && ekran.urun && ekran.yasak.length === 0 && ekran.filtre > 1 && ekran.dbAyni && ekran.s === 0, ekran);

// T21 eski denetim ekranı ve R1 korumaları
const t21 = await ev(() => { db.personelMod = false; db.rol = 'patron'; closeM(); renkKimlikDenetimEkrani(); const den = /Renk Kimliği Denetimi/.test($('ov').textContent); closeM();
  RB.kur([RB.urun(9716, [{ ad: 'Siyah', barkod: '1', rid: 'r_s', loklar: { 'L-depo': 7 } }, { ad: 'Beyaz', barkod: '2', rid: 'r_b', loklar: {} }])]);
  const m1 = RB.kaydet(9716, () => { fRenk.splice(0, 1); }); const m2 = RB.kaydet(9716, () => { fRenk[1].ad = 'siyah'; });
  return { den, m1, m2, siyah: renkObjs(urun(9716)).some(r => r.ad === 'Siyah') }; });
T('T21 eski Renk Kimliği Denetimi açılır; R1 stoklu renk silme engeli ve mükerrer ad engeli çalışır', t21.den && /silinemez/i.test(t21.m1) && /aynı renk/i.test(t21.m2) && t21.siyah, t21);

T('altyapı: dış istek tamamlanmadı (Firebase dahil)', !dis.some(h => /firestore|firebaseio|identitytoolkit|securetoken/.test(h)), dis);
T('altyapı: sayfa hatası yok', errs.length === 0, errs);
await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
