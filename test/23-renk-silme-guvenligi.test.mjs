// R1: Ürün kartında renk silme koruması + mükerrer renk adı kontrolü.
// Kural: herhangi bir lokasyonda tam seri / kırık / defo / negatif stok VEYA açık yükümlülük (yoldaki transfer,
// açık iş emri, rezerve/bekleyen/ön sipariş, tamamlanmamış depo emri, portal siparişi) olan renk silinemez.
// Kontrol hem ✕ düğmesinde hem kaydetUrun içinde yapılır; güncel ürün kaydına dayanır (eski form kopyasına değil).
// Testler gerçek formUrun / kaydetUrun / renkEkle / cogaltUrun ve ✕ düğmesini çalıştırır. localhost dışı istekler engellenir.
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
await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; return (h === 'localhost' || h === '127.0.0.1') ? route.continue() : route.abort(); });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));

await page.addScriptTag({ content: `
  const RS = {
    ID: 9401,
    kur(siyah, ek = {}) {
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }];
      aktifLok = 'L-ana'; db.pin = null;
      db.urunler = db.urunler.filter(u => u.id !== RS.ID && !(u.kod || '').startsWith('RS-'));
      db.transferler = []; db.isemirleri = []; db.satislar = []; db.bekleyenPortal = [];
      db.urunler.push({ id: RS.ID, ad: 'Renk Polo', kod: 'RS-9401', kat: 'Polo', marka: '', kaynak: 'uretim', cesit: 'Markalı', birim: 'seri', seri: 5,
        bedenler: [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }, { beden: 'XXL', adet: 1 }],
        pb: 'TL', alis: 100, satis: 150, karYuzde: 50, kritik: 10, stok: 0,
        renkler: [{ ad: 'Siyah', hex: '#111', barkod: '8690000000011', stok: 0, ...siyah },
                  { ad: 'Beyaz', hex: '#fff', barkod: '8690000000028', stok: 0, loklar: { 'L-ana': 2, 'L-depo': 4 } }] });
      Object.assign(db, ek.db || {});
      stokProjYukle(); save();
    },
    u() { return urun(RS.ID); },
    adlar() { return renkObjs(urun(RS.ID)).map(r => r.ad); },
    durum() { return JSON.stringify({ u: urun(RS.ID), t: db.transferler, i: db.isemirleri, s: db.satislar, p: db.bekleyenPortal }); },
    // ✕ düğmesine gerçekten tıklayarak Siyah'ı formdan silmeyi dene, sonra kaydet
    xIleSilKaydet() { formUrun(RS.ID); const i = fRenk.findIndex(r => r.ad === 'Siyah');
      const btn = document.querySelectorAll('#renk-box .del')[i]; $('toast').textContent = ''; btn.click();
      const formdaKaldi = fRenk.some(r => r.ad === 'Siyah'); const mesaj = $('toast').textContent;
      kaydetUrun(RS.ID); return { formdaKaldi, mesaj, adlar: RS.adlar() }; },
    // ✕ kontrolünü atlayarak (doğrudan splice) sil, sonra kaydet: kaydetUrun yeniden kontrol etmeli
    spliceIleSilKaydet() { formUrun(RS.ID); fRenk.splice(fRenk.findIndex(r => r.ad === 'Siyah'), 1); $('toast').textContent = '';
      kaydetUrun(RS.ID); return { mesaj: $('toast').textContent, adlar: RS.adlar() }; },
  };
` });
const ev = (fn, a) => page.evaluate(fn, a);
const siyahVar = r => r.adlar.includes('Siyah');

T('altyapı: canlı senkron kapalı, ürün kartı fonksiyonları var', await ev(() => canliAcik === false && ['formUrun', 'kaydetUrun', 'renkEkle', 'cogaltUrun'].every(f => typeof window[f] === 'function')));

// ---- Stok engelleri ----
const t1 = await ev(() => { RS.kur({ loklar: { 'L-ana': 5 } }); return RS.xIleSilKaydet(); });
T('T1 aktif lokasyonda 5 seri stoklu Siyah ✕ ile silinemez (formda kalır, mesaj gösterilir, kayıtta durur)', t1.formdaKaldi && /stok/i.test(t1.mesaj) && siyahVar(t1), t1);
const t2 = await ev(() => { RS.kur({ loklar: { 'L-ana': 0, 'L-depo': 7 } }); return { x: RS.xIleSilKaydet(), s: (RS.kur({ loklar: { 'L-ana': 0, 'L-depo': 7 } }), RS.spliceIleSilKaydet()), l: renkObjs(RS.u())[0].loklar }; });
T('T2 Mağaza 0, Depo 7: silinemez (✕ ve kaydet), Depo 7 korunur', t2.x.formdaKaldi && siyahVar(t2.x) && siyahVar(t2.s) && t2.l['L-depo'] === 7, t2);
const t3 = await ev(() => { RS.kur({ loklar: { 'L-ana': 0 }, kirik: { S: 1 } }); return RS.spliceIleSilKaydet(); });
T('T3 kirik {S:1} olan renk silinemez', siyahVar(t3) && /kırık/i.test(t3.mesaj), t3);
const t4 = await ev(() => { RS.kur({ loklar: { 'L-ana': 0 }, defo: 2 }); return RS.spliceIleSilKaydet(); });
T('T4 defo 2 olan renk silinemez', siyahVar(t4) && /defo/i.test(t4.mesaj), t4);
const t5 = await ev(() => { RS.kur({ loklar: { 'L-ana': 0, 'L-depo': -3 } }); return RS.spliceIleSilKaydet(); });
T('T5 negatif stoklu (Depo −3) renk silinemez, mutabakat istenir', siyahVar(t5) && /mutabakat|negatif|eksi/i.test(t5.mesaj), t5);

// ---- Yükümlülük engelleri (stok sıfır) ----
const SIFIR = { loklar: { 'L-ana': 0, 'L-depo': 0 } };
const t6 = await ev((S) => { RS.kur(S, { db: { transferler: [{ id: 'Tt', fromLok: 'L-depo', toLok: 'L-ana', kalemler: [{ uid: RS.ID, urun: 'Renk Polo', renk: 'Siyah', adet: 1 }], tarih: Date.now(), durum: 'yolda' }] } }); return RS.spliceIleSilKaydet(); }, SIFIR);
T('T6 yoldaki transferi olan renk silinemez', siyahVar(t6) && /transfer/i.test(t6.mesaj), t6);
const t7 = await ev((S) => { RS.kur(S, { db: { isemirleri: [{ id: 501, urunId: RS.ID, urun: 'Renk Polo', durum: 'devam', renkDagilim: [{ ad: 'Siyah', adet: 10 }] }] } }); return RS.spliceIleSilKaydet(); }, SIFIR);
T('T7 açık iş emri olan renk silinemez', siyahVar(t7) && /iş emri/i.test(t7.mesaj), t7);
const satis = (ek) => ({ id: 7001, tip: 'satis', tarih: Date.now(), mid: 1, mus: 'X', kalemler: [{ uid: 9401, urun: 'Renk Polo', mik: 1, birim: 'seri', fiyat: 150, renkler: [{ ad: 'Siyah', mik: 1 }] }], ...ek });
const t8a = await ev(([S, s]) => { RS.kur(S, { db: { satislar: [s] } }); return RS.spliceIleSilKaydet(); }, [SIFIR, satis({ teslimDurum: 'ayrildi' })]);
const t8b = await ev(([S, s]) => { RS.kur(S, { db: { satislar: [s] } }); return RS.spliceIleSilKaydet(); }, [SIFIR, satis({ teslimDurum: 'ayrildi', eksikStok: true, eksik: [{ uid: 9401, renk: 'Siyah', adet: 1 }] })]);
T('T8 rezerve (ayrıldı) ve bekleyen/ön sipariş satışı olan renk silinemez', siyahVar(t8a) && siyahVar(t8b) && /sipariş|rezerv/i.test(t8a.mesaj), { t8a, t8b });
const t9a = await ev(([S, s]) => { RS.kur(S, { db: { satislar: [s] } }); return RS.spliceIleSilKaydet(); }, [SIFIR, satis({ teslimDurum: 'teslim', depo: 'bekliyor' })]);
const t9b = await ev((S) => { RS.kur(S, { db: { bekleyenPortal: [{ id: 'bp1', bulutId: 'x1', mus: 'Y', kalemler: [{ uid: RS.ID, urun: 'Renk Polo', mik: 1, birim: 'seri', fiyat: 150, renkler: [{ ad: 'Siyah', mik: 1 }] }] }] } }); return RS.spliceIleSilKaydet(); }, SIFIR);
T('T9 tamamlanmamış depo emri ve portal siparişi olan renk silinemez', siyahVar(t9a) && siyahVar(t9b) && /depo/i.test(t9a.mesaj) && /portal/i.test(t9b.mesaj), { t9a, t9b });

// ---- İzin verilen silme ----
const t10 = await ev(([S, s]) => { RS.kur(S, { db: {
    transferler: [{ id: 'Ti', fromLok: 'L-depo', toLok: 'L-ana', kalemler: [{ uid: RS.ID, renk: 'Siyah', adet: 1 }], durum: 'iptal', iptal: true }, { id: 'Tt', fromLok: 'L-depo', toLok: 'L-ana', kalemler: [{ uid: RS.ID, renk: 'Siyah', adet: 1 }], durum: 'teslim' }],
    isemirleri: [{ id: 502, urunId: RS.ID, durum: 'tamam', renkDagilim: [{ ad: 'Siyah', adet: 1 }] }, { id: 503, urunId: RS.ID, durum: 'iptal', iptal: true, renkDagilim: [{ ad: 'Siyah', adet: 1 }] }],
    satislar: [s] } });
  const r = RS.xIleSilKaydet(); return { ...r, beyaz: renkObjs(RS.u()).find(x => x.ad === 'Beyaz').loklar }; }, [SIFIR, satis({ teslimDurum: 'teslim', depo: 'hazir' })]);
T('T10 sıfır stoklu, kırıksız, açık yükümlülüksüz Siyah silinir (iptal/teslim/tamam kayıtlar engellemez); Beyaz korunur', !t10.formdaKaldi && !siyahVar(t10) && t10.beyaz['L-depo'] === 4, t10);

// ---- Mükerrer ad ----
const t11 = await ev(() => { RS.kur({ loklar: { 'L-ana': 1 } }); const once = RS.durum(); formUrun(RS.ID); fRenk[1].ad = 'siyah'; $('toast').textContent = ''; kaydetUrun(RS.ID);
  const a = { mesaj: $('toast').textContent, ayni: RS.durum() === once };
  RS.kur({ loklar: { 'L-ana': 1 } }); formUrun(RS.ID); fRenk[0].ad = 'İndigo'; fRenk[1].ad = 'indigo'; $('toast').textContent = ''; kaydetUrun(RS.ID);
  return { a, b: { mesaj: $('toast').textContent, adlar: RS.adlar() } }; });
T('T11 Siyah/siyah ve İndigo/indigo aynı üründe kaydedilemez (kayıt değişmez, mesaj gösterilir)', t11.a.ayni && /aynı renk/i.test(t11.a.mesaj) && t11.b.adlar.join() === 'Siyah,Beyaz' && /aynı renk/i.test(t11.b.mesaj), t11);

// ---- Reddedilen silmede hiçbir şey değişmez ----
const t12 = await ev(() => { RS.kur({ loklar: { 'L-ana': 5, 'L-depo': 7 }, kirik: { S: 1 }, defo: 2 }, { db: { transferler: [{ id: 'Tt', fromLok: 'L-depo', toLok: 'L-ana', kalemler: [{ uid: RS.ID, renk: 'Siyah', adet: 1 }], durum: 'yolda' }] } });
  const once = RS.durum(); formUrun(RS.ID); $('u-ad').value = 'Adı Değişmeyecek'; fRenk[1].stok = 9; fRenk.splice(0, 1); kaydetUrun(RS.ID); return { ayni: RS.durum() === once, ad: RS.u().ad }; });
T('T12 silme reddedilince ürün (ad, renkler, loklar, kirik, defo, diğer renk stoğu) ve ilgili kayıtlar hiç değişmez', t12.ayni && t12.ad === 'Renk Polo', t12);

// ---- Eski _orj: kart açıkken başka cihazdan güncelleme ----
const t13 = await ev(() => { RS.kur({ loklar: { 'L-ana': 5, 'L-depo': 7 } }); _sbGuncelle('urunler', db.urunler);
  formUrun(RS.ID);                                                       // kart açık
  const bulut = JSON.parse(JSON.stringify(RS.u())); const s = bulut.renkler[0]; s.loklar = { 'L-ana': 3, 'L-depo': 9 }; s.stok = 3; bulut._m = Date.now() + 1000;
  canliDomenUygula('stok', { urunler: db.urunler.map(u => u.id === RS.ID ? bulut : u) });   // başka cihazın değişikliği gelir (ürün nesnesi değişir)
  const nesneDegisti = renkObjs(RS.u())[0] !== fRenk[0]._orj;
  kaydetUrun(RS.ID);                                                     // kullanıcı stoğa dokunmadan kaydeder
  return { nesneDegisti, l: { ...renkObjs(RS.u())[0].loklar }, stok: renkObjs(RS.u())[0].stok }; });
T('T13 kart açıkken gelen güncel stok (Mağaza 3, Depo 9) eski form/_orj değerleriyle (5, 7) ezilmez', t13.l['L-ana'] === 3 && t13.l['L-depo'] === 9 && t13.stok === 3, t13);

const t13b = await ev(() => { RS.kur({ loklar: { 'L-ana': 5 } }); _sbGuncelle('urunler', db.urunler);
  formUrun(RS.ID);                                                       // kart açık
  const bulut = JSON.parse(JSON.stringify(RS.u())); bulut.renkler.push({ ad: 'Yeşil', hex: '#0a0', barkod: '8690000000035', stok: 0, loklar: { 'L-depo': 4 } }); bulut._m = Date.now() + 1000;
  canliDomenUygula('stok', { urunler: db.urunler.map(u => u.id === RS.ID ? bulut : u) });   // başka cihaz Yeşil ekledi
  kaydetUrun(RS.ID); const y = renkObjs(RS.u()).find(r => r.ad === 'Yeşil'); return { adlar: RS.adlar(), yesil: y ? y.loklar : null }; });
T('T13b kart açıkken başka cihazda eklenen renk (Yeşil, Depo 4) kaydetmede silinmez', t13b.adlar.includes('Yeşil') && t13b.yesil && t13b.yesil['L-depo'] === 4, t13b);

// ---- kaydetUrun kendi kontrolünü yapar (✕ atlanmış olsa bile) ----
const t14 = await ev(() => { RS.kur({ loklar: { 'L-ana': 0, 'L-depo': 7 } }); return RS.spliceIleSilKaydet(); });
T('T14 ✕ atlanıp renk doğrudan formdan çıkarılsa da kaydetUrun reddeder', siyahVar(t14) && /stok/i.test(t14.mesaj), t14);

// ---- Yeni renk ve çoğaltma bozulmaz ----
const t15 = await ev(async () => { RS.kur({ loklar: { 'L-ana': 5, 'L-depo': 7 } });
  formUrun(RS.ID); renkEkle(); const i = fRenk.length - 1; fRenk[i].ad = 'Kırmızı'; fRenk[i].stok = 3; kaydetUrun(RS.ID);
  const yeni = Object.fromEntries(renkObjs(RS.u()).map(r => [r.ad, { ...(r.loklar || {}) }]));
  cogaltUrun(RS.ID); await new Promise(r => setTimeout(r, 300)); $('u-kod').value = 'RS-KOPYA'; const n = db.urunler.length; kaydetUrun(0);
  const kopya = db.urunler.length > n ? db.urunler[db.urunler.length - 1] : null;
  return { yeni, kopya: kopya ? Object.fromEntries(renkObjs(kopya).map(r => [r.ad, { ...(r.loklar || {}) }])) : null }; });
T('T15 yeni renk eklenir (Kırmızı yalnız Mağaza 3), eski renkler korunur; çoğaltma kaynağın Depo stoğunu almaz', JSON.stringify(t15.yeni.Kırmızı) === JSON.stringify({ 'L-ana': 3 }) && t15.yeni.Siyah['L-depo'] === 7 && t15.kopya && !t15.kopya.Siyah['L-depo'], t15);

T('altyapı: sayfa hatası yok', errs.length === 0, errs);
await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
