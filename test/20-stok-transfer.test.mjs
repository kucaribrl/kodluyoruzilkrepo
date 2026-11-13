// Stok transferi GÖZLEM testleri (ERP v171) — S1–S8.
// Amaç: MEVCUT davranışı ölçmek; yeni iş kurallarını uygulamak DEĞİL. Kaynak kod değiştirilmez.
//
// İki tür satır basılır:
//   PASS/FAIL  → test altyapısı ve bugün doğru olan temel akışlar (S1, S2). FAIL → process.exit(1).
//   GÖZLEM     → risk ve iş kuralı uyumu ölçümleri. CI'ı KIRMAZ ama açıkça etiketlenir:
//                [RİSK GÖZLENDİ] / [RİSK GÖZLENMEDİ] / [İŞ KURALINA UYGUN] / [İŞ KURALINA AYKIRI]
//                ve "koddan tahmin" ile "gözlenen" değer yan yana yazılır.
//
// İki cihaz senaryoları (S3, S4, S5) TEK tarayıcı sayfasında simüle edilir: aynı tabandan
// başlayan B cihazının durumu uygulamanın kendi fonksiyonlarıyla üretilir, sonra A cihazına
// canliDomenUygula('stok', …) ile "buluttan gelen belge" olarak uygulanır (test 12 yöntemi).
// Bu simülasyon gerçek Firestore yazma sırasını, onSnapshot zamanlamasını ve transaction
// davranışını KANITLAMAZ; yalnızca istemci tarafı birleşim mantığını gözlemler.
//
// Gerçek Firebase bağlantısı yoktur: localhost dışındaki tüm istekler engellenir ve sayılır.
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
const PORT = srv.address().port;

let ok = 0, fail = 0;
const gozlem = { riskVar: 0, riskYok: 0, kuralUygun: 0, kuralAykiri: 0, tahminTutmadi: 0 };
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };
// Risk gözlemi: CI'ı kırmaz. tahmin = koddan beklenen mevcut sonuç, gozlenen = ölçülen.
function G(kod, baslik, { baslangic, islemler, tahmin, gozlenen, risk, kural }) {
  const tahminTuttu = JSON.stringify(tahmin) === JSON.stringify(gozlenen);
  if (!tahminTuttu) gozlem.tahminTutmadi++;
  if (risk === true) gozlem.riskVar++; else if (risk === false) gozlem.riskYok++;
  if (kural === true) gozlem.kuralUygun++; else if (kural === false) gozlem.kuralAykiri++;
  const etiket = [risk === true ? '[RİSK GÖZLENDİ]' : risk === false ? '[RİSK GÖZLENMEDİ]' : '',
    kural === true ? '[İŞ KURALINA UYGUN]' : kural === false ? '[İŞ KURALINA AYKIRI]' : '',
    tahminTuttu ? '' : '[KODDAN TAHMİN TUTMADI]'].filter(Boolean).join(' ');
  console.log(`GÖZLEM ${kod} ${baslik} ${etiket}`);
  console.log(`   başlangıç : ${baslangic}`);
  console.log(`   işlemler  : ${islemler}`);
  console.log(`   tahmin    : ${JSON.stringify(tahmin)}  (koddan, mevcut davranış)`);
  console.log(`   gözlenen  : ${JSON.stringify(gozlenen)}`);
}

const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const ctx = await br.newContext();
const disIstek = [];
await ctx.route('**/*', route => {
  const u = new URL(route.request().url());
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.continue();
  disIstek.push(u.hostname); return route.abort(); // Firebase / CDN dahil hiçbir dış bağlantıya izin yok
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
const disTamamlanan = []; // engellenmeden tamamlanan dış istek (olmamalı)
page.on('requestfinished', r => { const h = new URL(r.url()).hostname; if (h !== 'localhost' && h !== '127.0.0.1') disTamamlanan.push(h); });
await page.goto(`http://localhost:${PORT}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));

// Sayfaya test yardımcıları (uygulama koduna dokunmaz; yalnızca uygulamanın kendi fonksiyonlarını çağırır)
await page.addScriptTag({ content: `
  const TX = {
    D: 'L-depo', M: 'L-ana',
    bekle: ms => new Promise(r => setTimeout(r, ms)),
    kopya: o => JSON.parse(JSON.stringify(o)),
    kur(urunler) {
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }];
      aktifLok = 'L-ana'; db.pin = null; db.transferler = [];
      db.urunler = db.urunler.filter(u => !(u.id >= 9100 && u.id < 9200));
      const now = Date.now();
      urunler.forEach(u => db.urunler.push({ kod: 'T' + u.id, kat: 'X', birim: 'adet', stok: 0, _m: now - 100000, ...u }));
      stokProjYukle(); save();
    },
    lok(id, L, renk) { const u = urun(id); if (!u) return null;
      if (renk) { const r = renkObjs(u).find(x => x.ad === renk); return r ? (+((r.loklar || {})[L]) || 0) : null; }
      return +((u.loklar || {})[L]) || 0; },
    durum(id) { const u = urun(id); return u ? { D: TX.lok(id, TX.D), M: TX.lok(id, TX.M) } : 'ÜRÜN YOK'; },
    ekle(ad, adetler) { $('tr-urun').value = ad; trUrunSec(); adetler.forEach((a, i) => { $('tra-' + i).value = a; }); trEkle(); },
    async olustur(satirlar, { onayla = true } = {}) {
      transferForm(); $('tr-from').value = TX.D; $('tr-to').value = TX.M;
      satirlar.forEach(s => TX.ekle(s.ad, s.adetler));
      const once = db.transferler.length;
      transferKaydet();
      const uyari = $('cov').classList.contains('show'); const msg = uyari ? $('cMsg').textContent : '';
      if (uyari && onayla) $('cYes').onclick();
      const t = db.transferler.length > once ? db.transferler[db.transferler.length - 1] : null;
      return { uyari, msg, id: t && t.id, olustu: !!t };
    },
    async kritikSil() { const i = $('kk-txt'); if (!i) return false; i.value = 'SİL'; await kritikOnayla(); return true; },
    async iptal(id) { transferIptal(id); return await TX.kritikSil(); },
    t(id) { return (db.transferler || []).find(x => x.id === id) || null; },
    tOzet(id) { const t = TX.t(id); return t ? { durum: t.durum, iptal: !!t.iptal } : null; },
    stokBelgesi() { return TX.kopya({ urunler: db.urunler, transferler: db.transferler }); },
    // İki cihaz: aynı tabandan B'nin sonucu üretilir, A'ya "bulut belgesi" olarak uygulanır.
    async ikiCihaz(bIslem, aIslem) {
      _sbGuncelle('urunler', db.urunler);               // son senkron tabanı (iki cihaz için ortak)
      const taban = TX.stokBelgesi();
      await bIslem();                                    // B cihazı
      const bBelge = TX.stokBelgesi();
      db.urunler = TX.kopya(taban.urunler); db.transferler = TX.kopya(taban.transferler); stokProjYukle();
      await TX.bekle(5);
      await aIslem();                                    // A cihazı (B'den habersiz)
      const aOnce = TX.stokBelgesi();
      canliDomenUygula('stok', bBelge);                  // B'nin belgesi A'ya ulaşır
      return { aOnce, bBelge };
    },
  };
` });

const ev = (fn, a) => page.evaluate(fn, a);

// ---- Altyapı kontrolleri ----
T('altyapı: canlı senkron kapalı (canliAcik=false)', await ev(() => canliAcik === false));
T('altyapı: transfer fonksiyonları mevcut', await ev(() => ['transferForm', 'transferKaydet', 'transferTeslim', 'transferIptal', 'canliDomenUygula', '_sbGuncelle', 'silUrun'].every(f => typeof window[f] === 'function')));

// ================= S1 =================
const s1 = await ev(async () => {
  TX.kur([{ id: 9101, ad: 'Polo S1', loklar: { 'L-depo': 100, 'L-ana': 20 } }]);
  const o = await TX.olustur([{ ad: 'Polo S1', adetler: [30] }]);
  const yolda = { ...TX.durum(9101), t: TX.tOzet(o.id), gorunenStok: urun(9101).stok };
  transferTeslim(o.id);
  const teslim = { ...TX.durum(9101), t: TX.tOzet(o.id), gorunenStok: urun(9101).stok };
  return { o, yolda, teslim };
});
T('S1 oluşturma: D 100→70, M 20 (uyarı yok)', s1.o.olustu && !s1.o.uyari && s1.yolda.D === 70 && s1.yolda.M === 20 && s1.yolda.t.durum === 'yolda', s1);
T('S1 teslim: D 70, M 20→50, durum teslim', s1.teslim.D === 70 && s1.teslim.M === 50 && s1.teslim.t.durum === 'teslim', s1);
T('S1 .stok aktif lokasyonu (Mağaza) yansıtır: 20 → 50', s1.yolda.gorunenStok === 20 && s1.teslim.gorunenStok === 50, s1);
G('S1', 'yolda stok görünürlüğü', { baslangic: 'D=100, M=20', islemler: 'oluştur 30 (yolda)', tahmin: { D: 70, M: 20, toplamGorunen: 90 }, gozlenen: { D: s1.yolda.D, M: s1.yolda.M, toplamGorunen: s1.yolda.D + s1.yolda.M }, kural: false });
console.log('   not       : Yoldaki 30 adet hiçbir lokasyonda görünmüyor; kural 6 (yolda stok raporu) bugün desteklenmiyor.');

const s1r = await ev(async () => {
  TX.kur([{ id: 9102, ad: 'Renkli S1', renkler: [{ ad: 'Siyah', hex: '#000', stok: 0, loklar: { 'L-depo': 60, 'L-ana': 10 } }, { ad: 'Beyaz', hex: '#fff', stok: 0, loklar: { 'L-depo': 40, 'L-ana': 5 } }] }]);
  const o = await TX.olustur([{ ad: 'Renkli S1', adetler: [25, 0] }]);
  const yolda = { DS: TX.lok(9102, TX.D, 'Siyah'), MS: TX.lok(9102, TX.M, 'Siyah'), DB: TX.lok(9102, TX.D, 'Beyaz') };
  transferTeslim(o.id);
  return { o, yolda, teslim: { DS: TX.lok(9102, TX.D, 'Siyah'), MS: TX.lok(9102, TX.M, 'Siyah'), DB: TX.lok(9102, TX.D, 'Beyaz'), gorunen: urun(9102).stok } };
});
T('S1 renkli: Siyah D 60→35, teslimde M 10→35; Beyaz değişmez; .stok = 35+5', s1r.yolda.DS === 35 && s1r.yolda.MS === 10 && s1r.teslim.MS === 35 && s1r.teslim.DB === 40 && s1r.teslim.gorunen === 40, s1r);

// ================= S2 =================
const s2 = await ev(async () => {
  TX.kur([{ id: 9103, ad: 'Polo S2', loklar: { 'L-depo': 100, 'L-ana': 20 } }]);
  const o = await TX.olustur([{ ad: 'Polo S2', adetler: [30] }]);
  const onaylandi = await TX.iptal(o.id);
  const iptal = { ...TX.durum(9103), t: TX.tOzet(o.id), kayitVar: !!TX.t(o.id) };
  transferTeslim(o.id);
  const teslimDenemesi = { ...TX.durum(9103), t: TX.tOzet(o.id) };
  return { onaylandi, iptal, teslimDenemesi };
});
T('S2 yoldayken iptal: D 70→100, M 20', s2.onaylandi && s2.iptal.D === 100 && s2.iptal.M === 20, s2);
T('S2 iptal kaydı silinmez: iptal:true, durum iptal', s2.iptal.kayitVar && s2.iptal.t.iptal && s2.iptal.t.durum === 'iptal', s2);
T('S2 iptal edilen transfer teslim alınamaz (stok değişmez)', s2.teslimDenemesi.D === 100 && s2.teslimDenemesi.M === 20 && s2.teslimDenemesi.t.durum === 'iptal', s2);

const s2b = await ev(async () => {
  TX.kur([{ id: 9104, ad: 'Polo S2b', loklar: { 'L-depo': 100, 'L-ana': 20 } }]);
  const o = await TX.olustur([{ ad: 'Polo S2b', adetler: [30] }]);
  transferTeslim(o.id);
  const onaylandi = await TX.iptal(o.id);
  return { onaylandi, ...TX.durum(9104), t: TX.tOzet(o.id) };
});
G('S2b', 'teslim SONRASI iptal', { baslangic: 'D=100, M=20; transfer 30 teslim edildi (D=70, M=50)', islemler: 'iptal (SİL)', tahmin: { iptalCalisti: true, D: 100, M: 20 }, gozlenen: { iptalCalisti: s2b.onaylandi && !!(s2b.t && s2b.t.iptal), D: s2b.D, M: s2b.M }, kural: !(s2b.t && s2b.t.iptal) });
console.log('   not       : Kural 2 (teslim sonrası iptal yok; iade ayrı transfer) — mevcut kod teslim sonrası iptale izin veriyorsa AYKIRI.');

// ================= S3 =================
const s3a = await ev(async () => {
  TX.kur([{ id: 9105, ad: 'Polo S3a', loklar: { 'L-depo': 100, 'L-ana': 20 } }]);
  const o = await TX.olustur([{ ad: 'Polo S3a', adetler: [30] }]);
  await TX.ikiCihaz(async () => { transferTeslim(o.id); }, async () => { transferTeslim(o.id); });
  return { ...TX.durum(9105), t: TX.tOzet(o.id) };
});
G('S3a', 'iki cihazda çift teslim (başka hareket yok)', { baslangic: 'ortak taban D=70, M=20, transfer yolda (30)', islemler: 'B teslim → A teslim (B\'den habersiz) → B belgesi A\'ya ulaşır', tahmin: { D: 70, M: 50 }, gozlenen: { D: s3a.D, M: s3a.M }, risk: s3a.M !== 50, kural: s3a.M === 50 });

const s3b = await ev(async () => {
  TX.kur([{ id: 9106, ad: 'Polo S3b', loklar: { 'L-depo': 100, 'L-ana': 20 } }]);
  const o = await TX.olustur([{ ad: 'Polo S3b', adetler: [30] }]);
  await TX.ikiCihaz(async () => {
    const u = urun(9106); u.loklar['L-ana'] -= 5; stokProjYukle(); save();   // B: mağazada 5 satış (doğrudan loklar −5 ile simüle)
    transferTeslim(o.id);
  }, async () => { transferTeslim(o.id); });
  return { ...TX.durum(9106), t: TX.tOzet(o.id) };
});
G('S3b', 'iki cihazda çift teslim + B\'de 5 satış', { baslangic: 'ortak taban D=70, M=20, transfer yolda (30)', islemler: 'B: satış −5, teslim (M=45) → A: teslim (M=50) → birleşim', tahmin: { D: 70, M: 75 }, gozlenen: { D: s3b.D, M: s3b.M }, risk: s3b.M !== 45, kural: s3b.M === 45 });
console.log('   not       : İş açısından doğru sonuç M=45 (20 + 30 − 5). Satış loklar üzerinden doğrudan simüle edildi, satış ekranı kullanılmadı.');

// ================= S4 =================
const s4 = await ev(async () => {
  TX.kur([{ id: 9107, ad: 'Polo S4', loklar: { 'L-depo': 100, 'L-ana': 20 } }]);
  const o = await TX.olustur([{ ad: 'Polo S4', adetler: [30] }]);
  await TX.ikiCihaz(async () => { await TX.iptal(o.id); }, async () => { transferTeslim(o.id); });
  return { ...TX.durum(9107), t: TX.tOzet(o.id) };
});
G('S4', 'A teslim + B iptal çakışması', { baslangic: 'ortak taban D=70, M=20, transfer yolda (30); toplam 90 + 30 yolda', islemler: 'B iptal (D=100) → A teslim (M=50, daha yeni damga) → birleşim', tahmin: { D: 100, M: 50, toplam: 150, transfer: 'teslim' }, gozlenen: { D: s4.D, M: s4.M, toplam: s4.D + s4.M, transfer: s4.t && s4.t.durum }, risk: (s4.D + s4.M) !== 120, kural: (s4.D + s4.M) === 120 });
console.log('   not       : İş açısından doğru: yalnızca biri geçerli (D=70,M=50 teslim veya D=100,M=20 iptal); toplam 120. Kural 3 sunucuda ilk kesinleşeni ister — simülasyon sunucu sırasını kanıtlamaz.');

// ================= S5 =================
const s5 = await ev(async () => {
  TX.kur([{ id: 9108, ad: 'Polo S5', loklar: { 'L-depo': 100, 'L-ana': 20 } }]);
  const o = await TX.olustur([{ ad: 'Polo S5', adetler: [30] }]);
  _sbGuncelle('urunler', db.urunler);
  const eskiNesne = TX.t(o.id);
  transferIptal(o.id);                                   // A: iptal onay penceresi AÇIK
  const pencereAcik = !!$('kk-txt');
  // Pencere açıkken B'nin teslimi buluttan gelir
  const bulut = TX.stokBelgesi(); const ileri = Date.now() + 1000;
  bulut.urunler.find(u => u.id === 9108).loklar['L-ana'] = 50; bulut.urunler.find(u => u.id === 9108)._m = ileri;
  const bt = bulut.transferler.find(t => t.id === o.id); bt.durum = 'teslim'; bt.teslimTarih = ileri; bt._m = ileri;
  canliDomenUygula('stok', bulut);
  const senkSonrasi = { ...TX.durum(9108), t: TX.tOzet(o.id), ayniNesne: TX.t(o.id) === eskiNesne, pencereHalaAcik: !!$('kk-txt') };
  const onaylandi = await TX.kritikSil();                // A: "SİL" ile onaylar
  return { pencereAcik, senkSonrasi, onaylandi, son: { ...TX.durum(9108), t: TX.tOzet(o.id), eskiNesneIptal: !!eskiNesne.iptal } };
});
G('S5', 'onay penceresi açıkken uzaktan teslim', {
  baslangic: 'D=70, M=20, transfer yolda (30); A iptal penceresini açtı',
  islemler: `buluttan B teslimi gelir (M=50, durum teslim) → A "SİL" ile onaylar (pencere açık kaldı mı: ${s5.senkSonrasi.pencereHalaAcik})`,
  tahmin: { D: 100, M: 50, kayittakiDurum: 'teslim', iptalKaydiKayboldu: true },
  gozlenen: { D: s5.son.D, M: s5.son.M, kayittakiDurum: s5.son.t && s5.son.t.durum, iptalKaydiKayboldu: s5.son.eskiNesneIptal && !(s5.son.t && s5.son.t.iptal) },
  risk: (s5.son.D + s5.son.M) !== 120, kural: (s5.son.D + s5.son.M) === 120,
});
console.log(`   ek        : senkron kaydı yeni nesneyle değiştirdi mi: ${!s5.senkSonrasi.ayniNesne}; onay çalıştı: ${s5.onaylandi}`);

// ================= S6 =================
const s6 = await ev(async () => {
  TX.kur([{ id: 9109, ad: 'Polo S6', loklar: { 'L-depo': 10, 'L-ana': 0 } }]);
  const o = await TX.olustur([{ ad: 'Polo S6', adetler: [8] }, { ad: 'Polo S6', adetler: [8] }]);
  const t = TX.t(o.id);
  return { o, satir: t ? t.kalemler.length : 0, ...TX.durum(9109) };
});
G('S6', 'aynı ürün iki satır (8 + 8, kaynakta 10)', { baslangic: 'D=10', islemler: '8 ekle, 8 ekle, oluştur', tahmin: { uyari: false, satir: 2, D: -6 }, gozlenen: { uyari: s6.o.uyari, satir: s6.satir, D: s6.D }, risk: s6.D < 0 && !s6.o.uyari, kural: s6.satir === 1 && s6.D >= 0 });
console.log('   not       : Kural 1 (eksi stok engel) ve 5 (aynı stok kimliği birleşir) açısından değerlendirildi.');

// ================= S7 =================
const s7 = await ev(async () => {
  TX.kur([{ id: 9110, ad: 'Polo S7', loklar: { 'L-depo': 100, 'L-ana': 20 } }]);
  const o = await TX.olustur([{ ad: 'Polo S7', adetler: [30] }]);
  silUrun(9110);
  const silmeOnayiIstendi = !!$('kk-txt'); const pasifTeklifi = $('cov').classList.contains('show');
  const silindi = silmeOnayiIstendi ? await TX.kritikSil() : false;
  const urunVar = !!urun(9110);
  transferTeslim(o.id);
  return { silmeOnayiIstendi, pasifTeklifi, silindi, urunVar, t: TX.tOzet(o.id), stok: TX.durum(9110) };
});
G('S7', 'açık transferli ürünün silinmesi ve teslimi', { baslangic: 'D=100, M=20; transfer 30 yolda (D=70)', islemler: 'ürünü sil (SİL) → transferi teslim al', tahmin: { urunSilindi: true, transferDurumu: 'teslim', urun: 'ÜRÜN YOK' }, gozlenen: { urunSilindi: !s7.urunVar, transferDurumu: s7.t && s7.t.durum, urun: s7.stok }, risk: !s7.urunVar && s7.t && s7.t.durum === 'teslim', kural: s7.urunVar });
console.log('   not       : Kural 4 (açık transferli ürün silinmez). Silinirse yoldaki 30 adet kayıtlardan düşer.');

// ================= S8 =================
const s8 = await ev(async () => {
  TX.kur([{ id: 9111, ad: 'Polo S8', loklar: { 'L-depo': 5, 'L-ana': 0 } }]);
  const o = await TX.olustur([{ ad: 'Polo S8', adetler: [8] }]);
  return { o, ...TX.durum(9111) };
});
G('S8', 'yetersiz stokla oluşturma (kaynak 5, transfer 8)', { baslangic: 'D=5', islemler: 'oluştur 8 → uyarıda "Yine de"', tahmin: { uyari: true, olustu: true, D: -3 }, gozlenen: { uyari: s8.o.uyari, olustu: s8.o.olustu, D: s8.D }, risk: s8.D < 0, kural: !s8.o.olustu || s8.D >= 0 });
console.log('   not       : Kural 1 (eksi stok engellenecek) — bugün yalnızca uyarı var.');

// ---- Genel ----
T('altyapı: sayfa hatası yok', errs.length === 0, errs);
T('altyapı: hiçbir dış istek tamamlanmadı (Firebase dahil; localhost dışı engellendi)', disTamamlanan.length === 0 && !disIstek.some(h => /firestore|firebaseio|identitytoolkit|securetoken/.test(h)), { disTamamlanan, disIstek });
console.log(`   engellenen dış istek: ${disIstek.length} (${[...new Set(disIstek)].join(', ') || '—'})`);
T('altyapı: senkron sonunda da kapalı (canliAcik=false)', await ev(() => canliAcik === false));

console.log(`\nGÖZLEM ÖZETİ: risk gözlendi ${gozlem.riskVar}, risk gözlenmedi ${gozlem.riskYok}, iş kuralına aykırı ${gozlem.kuralAykiri}, uygun ${gozlem.kuralUygun}, koddan tahmin tutmadı ${gozlem.tahminTutmadi}`);
console.log('(Gözlemler CI\'ı kırmaz; yalnızca PASS/FAIL satırları çıkış kodunu belirler.)');
await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
