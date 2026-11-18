// R2.2b: Satış iptali ve stok geri alma güvenliği — GERÇEK iptal yolu (silSatis → askKritik "SİL" → kritikOnayla → revertSatis).
// Kural (fail-closed):
//   - Önce bütün kalemler çözülür ve doğrulanır; tek bir sorun bütün iptali durdurur (stok, cari, kasa, çek, satış kaydı DEĞİŞMEZ).
//   - rid'li satır yalnız rid ile çözülür; rid bulunamazsa ada düşülmez. Bulunamayan renk OLUŞTURULMAZ, silinmiş renk CANLANDIRILMAZ.
//   - rid'siz (eski) satır, tek aday olsa bile, satışa + satıra + ürün anlık görüntüsüne bağlı açık mutabakat olmadan stok değiştirmez.
//   - Uygulama aşamasında hata olursa kısmi stok farkı kalmaz.
// İptal DIŞINDAKİ çağrılar (satış oluşturma, iade, transfer, üretim, portal, senkron) değişmez.
// Mutabakat arayüzü bir SÖZLEŞME ÖNERİSİDİR (Ders 46): satisIptalMutabakatOlustur(satisId, {kalem, renk, hedefRenkIdx, gerekce, kanit})
// ve silSatis(id, { mutabakatlar: [...] }).
// Sentetik veri; localhost dışı tüm istekler engellenir (Firebase yok). Sunucu rastgele portta, sw.js → 404.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  if (req.url.includes('sw.js')) { res.writeHead(404); return res.end(); }
  const p = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : /\.m?js$/.test(p) ? 'text/javascript' : 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 320) : '')); } };

const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const ctx = await br.newContext();
const disari = [];
await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return route.continue(); disari.push(h); return route.abort(); });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));

// Geçerli biçimde (r_ + UUID v4) sentetik rid'ler
const R = { S: 'r_11111111-1111-4111-8111-111111111111', B: 'r_22222222-2222-4222-8222-222222222222', L: 'r_33333333-3333-4333-8333-333333333333',
  M: 'r_44444444-4444-4444-8444-444444444444', E: 'r_55555555-5555-4555-8555-555555555555', SIL: 'r_66666666-6666-4666-8666-666666666666',
  YOK: 'r_77777777-7777-4777-8777-777777777777', YOK2: 'r_88888888-8888-4888-8888-888888888888' };

await page.addScriptTag({ content: `
  const R = ${JSON.stringify(R)};
  const IP = {
    A: 9501, B: 9502, E: 9503,
    kur() {
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }];
      aktifLok = 'L-ana'; db.pin = null;
      db.urunler = db.urunler.filter(u => ![IP.A, IP.B, IP.E].includes(u.id));
      const bed = [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }, { beden: 'XXL', adet: 1 }];
      db.urunler.push({ id: IP.A, ad: 'İptal Polo', kod: 'IP-A', birim: 'seri', seri: 5, bedenler: bed, pb: 'TL', alis: 100, satis: 150, kritik: 0, stok: 0,
        renkler: [
          { ad: 'Siyah', rid: R.S, hex: '#111', barkod: '9501001', stok: 0, loklar: { 'L-ana': 10, 'L-depo': 7 }, kirik: { S: 2, M: 1 } },
          { ad: 'Beyaz', rid: R.B, hex: '#fff', barkod: '9501002', stok: 0, loklar: { 'L-ana': 10, 'L-depo': 3 } },
          { ad: 'Lacivert', rid: R.L, hex: '#00f', barkod: '9501003', stok: 0, loklar: { 'L-ana': 10 } },
          { ad: 'Gri', hex: '#888', barkod: '9501004', stok: 0, loklar: { 'L-ana': 10 } },
          { ad: 'Silik', rid: R.SIL, hex: '#ccc', barkod: '9501005', stok: 0, loklar: { 'L-ana': 0 }, silindi: true },
        ] });
      db.urunler.push({ id: IP.B, ad: 'İptal Tişört', kod: 'IP-B', birim: 'adet', pb: 'TL', alis: 50, satis: 80, kritik: 0, stok: 0,
        renkler: [
          { ad: 'Mavi', rid: R.M, hex: '#09f', barkod: '9502001', stok: 0, loklar: { 'L-ana': 10 } },
          { ad: 'Kırmızı', hex: '#f00', barkod: '9502002', stok: 0, loklar: { 'L-ana': 10 } },
          { ad: 'kırmızı', hex: '#e00', barkod: '9502003', stok: 0, loklar: { 'L-ana': 10 } },
        ] });
      db.urunler.push({ id: IP.E, ad: 'İptal Ceket', kod: 'IP-E', birim: 'adet', pb: 'TL', alis: 200, satis: 300, kritik: 0, stok: 0,
        renkler: [{ ad: 'Siyah', rid: R.E, hex: '#111', barkod: '9503001', stok: 0, loklar: { 'L-ana': 10 } }] });
      db.cariler = (db.cariler || []).filter(c => c.id !== 'c-ip'); db.cariler.push({ id: 'c-ip', ad: 'İptal Müşteri', tip: 'musteri', bakiye: 0, lokId: 'L-ana' });
      db.hesaplar = [{ id: 'h-ip', ad: 'Nakit Kasa', tur: 'nakit', bakiye: 1000, lokId: 'L-ana' }];
      db.hareketler = []; db.cekler = []; db.satislar = []; db.transferler = []; db.isemirleri = []; db.bekleyenPortal = [];
      stokProjYukle(); save();
    },
    // Satışı GERÇEK applySatis ile oluşturur (satış anında stok/cari/kasa işlenir); sonra isteğe bağlı bozma uygulanır
    satis(id, kalemler, ek = {}) {
      const tutar = kalemler.reduce((a, k) => a + (+k.fiyat || 0) * (k.renkler ? k.renkler.reduce((b, r) => b + (+r.mik || 0), 0) : (+k.mik || 0)), 0);
      const s = { id, tip: 'satis', lokId: 'L-ana', mid: 'c-ip', mus: 'İptal Müşteri', pb: 'TL', tarih: 1700000000000, tutar, araToplam: tutar, iskonto: 0, kdv: 0, kdvTutar: 0,
        odenen: ek.odenen || 0, odemeler: ek.odenen ? [{ tur: 'Nakit', tutar: ek.odenen, pb: 'TL', hesapId: 'h-ip' }] : [],
        kalemler: kalemler.map(k => ({ birim: 'seri', urun: 'x', ...k, mik: k.renkler ? k.renkler.reduce((b, r) => b + (+r.mik || 0), 0) : k.mik })) };
      db.satislar.push(s); applySatis(s); save(); return s;
    },
    anlik() { return JSON.stringify({ u: db.urunler.filter(u => [IP.A, IP.B, IP.E].includes(u.id)), c: db.cariler.find(c => c.id === 'c-ip'),
      h: db.hesaplar, hr: db.hareketler, ck: db.cekler, s: db.satislar }); },
    depo() { return localStorage.getItem(KEY); },
    renk(uid, ad) { return (urun(uid).renkler || []).filter(r => r && r.ad === ad); },
    lok(uid, ad, L = 'L-ana') { const r = IP.renk(uid, ad); return r.length === 1 ? (+((r[0].loklar || {})[L]) || 0) : 'renk sayısı ' + r.length; },
    // GERÇEK iptal akışı: silSatis → kritik onay penceresi → "SİL" → kritikOnayla
    async iptal(id, secenek) {
      $('toast').textContent = ''; let hata = null, pencere = false;
      try { secenek === undefined ? silSatis(id) : silSatis(id, secenek); const t = $('kk-txt'); if (t) { pencere = true; t.value = 'SİL'; await kritikOnayla(); } }
      catch (e) { hata = String(e && e.message || e); }
      const s = db.satislar.find(x => x.id === id);
      return { toast: $('toast').textContent, hata, pencere, iptal: !!(s && s.iptal) };
    },
    onay(sid, kalem, renk, hedefRenkIdx, ek = {}) {
      if (typeof satisIptalMutabakatOlustur !== 'function') return null;
      try { return satisIptalMutabakatOlustur(sid, { kalem, renk, hedefRenkIdx, gerekce: 'Rafta sayıldı', kanit: ['sayım#7'], ...ek }); } catch (e) { return null; }
    },
  };
` });
const ev = (fn, a) => page.evaluate(fn, a);
const ret = (r) => !r.iptal && r.toast.length > 0 && !/iptal edildi/i.test(r.toast);   // reddedildi + kullanıcıya bildirildi

// Ortak "başarısız iptal" senaryosu: kur → satış (+bozma) → anlık → iptal → anlık
async function senaryo(kalemler, bozma, secenek, ek) {
  return ev(async ({ kalemler, bozma, secenek, ek }) => {
    IP.kur(); const s = IP.satis('s-ip', kalemler, ek || {});
    if (bozma) (new Function('IP', 'R', 's', bozma))(IP, R, s);
    save(); const once = IP.anlik(), depoOnce = IP.depo();
    const r = await IP.iptal('s-ip', secenek === null ? undefined : secenek);
    return { r, ayni: IP.anlik() === once, depoAyni: IP.depo() === depoOnce, once, sonra: IP.anlik() };
  }, { kalemler, bozma, secenek: secenek === undefined ? null : secenek, ek });
}
const ridSatir = (uid, ad, rid, mik, ek = {}) => ({ uid, fiyat: 100, renkler: [{ ad, rid, mik, ...ek }] });

// ---- Kimlikli satış ----
const t1 = await ev(async () => { IP.kur(); const once = IP.lok(IP.A, 'Siyah'); IP.satis('s-ip', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Siyah', rid: R.S, mik: 3 }] }]);
  const satista = IP.lok(IP.A, 'Siyah'); const r = await IP.iptal('s-ip'); return { once, satista, sonra: IP.lok(IP.A, 'Siyah'), r, bakiye: db.cariler.find(c => c.id === 'c-ip').bakiye }; });
T('T1 kimlikli satış güvenle iptal edilir (stok 10→7→10, bakiye 0)', t1.satista === 7 && t1.sonra === 10 && t1.r.iptal && t1.r.pencere && t1.bakiye === 0, t1);

const t2 = await ev(async () => { IP.kur(); IP.satis('s-ip', [{ uid: IP.E, fiyat: 300, birim: 'adet', renkler: [{ ad: 'Siyah', rid: R.E, mik: 2 }] }]);
  IP.renk(IP.E, 'Siyah')[0].ad = 'Lacivert'; save();
  const r = await IP.iptal('s-ip'); const s = db.satislar.find(x => x.id === 's-ip');
  return { r, lac: IP.lok(IP.E, 'Lacivert'), siyahSayi: IP.renk(IP.E, 'Siyah').length, renkSayi: urun(IP.E).renkler.length, tarihsel: s.kalemler[0].renkler[0].ad }; });
T('T2 renk adı değişmişse rid ile doğru renk bulunur (stok Lacivert\'e döner: 8→10)', t2.r.iptal && t2.lac === 10, t2);
T('T2b eski ad (Siyah) yeniden oluşturulmaz', t2.siyahSayi === 0 && t2.renkSayi === 1, t2);
T('T2c satışın tarihsel ad kopyası (Siyah) korunur', t2.tarihsel === 'Siyah', t2);

const t3 = await senaryo([ridSatir(9501, 'Beyaz', R.B, 2)], "s.kalemler[0].renkler[0].rid = R.YOK;");
T('T3 rid bulunamazsa ada düşülmez (Beyaz adı var ama iptal reddedilir, hiçbir şey değişmez)', ret(t3.r) && t3.ayni, t3.r);

const t4 = await senaryo([ridSatir(9501, 'Siyah', R.S, 1), ridSatir(9501, 'Mor', R.YOK2, 1)], "IP.renk(IP.A,'Mor').forEach(r=>{const u=urun(IP.A);u.renkler.splice(u.renkler.indexOf(r),1)});");
const t4renk = await ev(() => IP.renk(IP.A, 'Mor').length);
T('T4 renk bulunamazsa yeni renk oluşturulmaz (Mor açılmaz, iptal reddedilir)', ret(t4.r) && t4renk === 0 && t4.ayni, { r: t4.r, t4renk });

const t5 = await senaryo([{ uid: 9502, fiyat: 80, birim: 'adet', renkler: [{ ad: 'Kırmızı', mik: 2 }] }]);
const t5b = await ev(() => { IP.kur(); IP.satis('s-ip5', [{ uid: IP.B, fiyat: 80, birim: 'adet', renkler: [{ ad: 'Kırmızı', mik: 2 }] }]); return IP.onay('s-ip5', 0, 0, 1); });
T('T5 aynı adlı renkler (Kırmızı/kırmızı) yanlış eşleşmez: iptal reddedilir, belirsiz renge onay üretilmez', ret(t5.r) && t5.ayni && t5b === null, { r: t5.r, t5b });

// ---- Kimliksiz eski satış + mutabakat ----
const ESKI = [{ uid: 9501, fiyat: 150, renkler: [{ ad: 'Gri', mik: 2 }] }];
const t6 = await senaryo(ESKI);
T('T6 kimliksiz eski satış açık mutabakat ister (mesajda "mutabakat")', ret(t6.r) && /mutabakat/i.test(t6.r.toast), t6.r);
T('T7 onaysız eski satış iptal edilmez; stok/cari/kasa/kayıt aynı', !t6.r.iptal && t6.ayni && t6.depoAyni, t6.r);

const t8 = await ev(async () => { const sonuc = [];
  for (const kotu of [true, {}, [{}], [true], [{ tur: 'RENK_MUTABAKAT', gerekce: 'x', kanit: ['y'] }]]) {
    IP.kur(); IP.satis('s-ip', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Gri', mik: 2 }] }]); const once = IP.anlik();
    const r = await IP.iptal('s-ip', { mutabakatlar: kotu }); sonuc.push({ iptal: r.iptal, ayni: IP.anlik() === once, toast: r.toast }); }
  return sonuc; });
T('T8 geçersiz mutabakat (true, boş nesne, sahte onay) reddedilir', t8.every(x => !x.iptal && x.ayni && x.toast), t8);

const t9 = await ev(async () => { IP.kur();
  IP.satis('s-ip1', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Gri', mik: 1 }] }]); IP.satis('s-ip2', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Gri', mik: 1 }] }]);
  const o1 = IP.onay('s-ip1', 0, 0, 3); const once = IP.anlik();
  const r = await IP.iptal('s-ip2', { mutabakatlar: [o1] }); const ayni = IP.anlik() === once;
  const yanlisRenk = IP.onay('s-ip1', 0, 0, 1); /* Gri satırı için Beyaz hedefi */
  return { o1: !!o1, r, ayni, yanlisRenk }; });
T('T9 başka satışa / başka renge ait mutabakat reddedilir', t9.o1 && !t9.r.iptal && t9.ayni && t9.yanlisRenk === null, t9);

const t10 = await ev(async () => { IP.kur(); IP.satis('s-ip', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Gri', mik: 2 }] }]);
  const o = IP.onay('s-ip', 0, 0, 3); IP.renk(IP.A, 'Gri')[0].barkod = '999'; save(); const once = IP.anlik();
  const r = await IP.iptal('s-ip', { mutabakatlar: [o] }); return { o: !!o, r, ayni: IP.anlik() === once }; });
T('T10 eski snapshot onayı (onaydan sonra ürün değişti) reddedilir', t10.o && !t10.r.iptal && t10.ayni, t10);

const t11 = await ev(async () => { IP.kur(); IP.satis('s-ip', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: '  gri ', mik: 2 }] }]);
  const o = IP.onay('s-ip', 0, 0, 3); const r = await IP.iptal('s-ip', { mutabakatlar: [o] }); const s = db.satislar.find(x => x.id === 's-ip');
  return { o: !!o, r, gri: IP.lok(IP.A, 'Gri'), griSayi: urun(IP.A).renkler.filter(x => /gri/i.test(x.ad)).length, tarihsel: s.kalemler[0].renkler[0].ad }; });
T('T11 geçerli mutabakatla doğru renk çözülür (Gri 10\'a döner, yeni renk yok)', t11.o && t11.r.iptal && t11.gri === 10 && t11.griSayi === 1, t11);
T('T30 başarılı eski kayıt iptalinde tarihsel ad ("  gri ") korunur', t11.r.iptal && t11.tarihsel === '  gri ', t11);

// ---- Çok satırlı bütünlük ----
const t12 = await senaryo([{ uid: 9501, fiyat: 150, renkler: [{ ad: 'Siyah', rid: R.S, mik: 5 }, { ad: 'Beyaz', rid: R.B, mik: 3 }, { ad: 'Lacivert', rid: R.L, mik: 2 }] }],
  "const u=urun(IP.A);u.renkler.splice(u.renkler.findIndex(r=>r.ad==='Lacivert'),1);", undefined, { odenen: 100 });
const t12x = await ev(() => ({ siyah: IP.lok(IP.A, 'Siyah'), beyaz: IP.lok(IP.A, 'Beyaz'), lac: IP.renk(IP.A, 'Lacivert').length }));
T('T12 üç renkten biri (Lacivert) bulunamazsa hiçbir stok değişmez (Siyah 5, Beyaz 7 kalır)', ret(t12.r) && t12x.siyah === 5 && t12x.beyaz === 7 && t12.ayni, { r: t12.r, t12x });
T('T12b Lacivert oluşturulmaz', t12x.lac === 0, t12x);
T('T24 hata durumunda satış kaydı korunur (silinmez, iptal işaretlenmez)', !t12.r.iptal && JSON.parse(t12.sonra).s.length === 1 && JSON.stringify(JSON.parse(t12.sonra).s) === JSON.stringify(JSON.parse(t12.once).s), t12.r);
const t25 = JSON.parse(t12.once), t25b = JSON.parse(t12.sonra);
T('T25 hata durumunda kasa/cari/çek değişmez (ödemeli satış)', JSON.stringify([t25.c, t25.h, t25.hr, t25.ck]) === JSON.stringify([t25b.c, t25b.h, t25b.hr, t25b.ck]) && t25.h[0].bakiye === 1100, { c: t25b.c, h: t25b.h });

const t13 = await senaryo([ridSatir(9501, 'Siyah', R.S, 2), { uid: 9502, fiyat: 80, birim: 'adet', renkler: [{ ad: 'Mavi', rid: R.M, mik: 2 }] }], "s.kalemler[1].renkler[0].rid = R.YOK;");
T('T13 iki üründen biri hatalıysa (B\'nin rid\'i yanlış) ikisi de değişmez', ret(t13.r) && t13.ayni && t13.depoAyni, t13.r);

const KIRIK = (ad, rid, beden, ek = {}) => ({ uid: 9501, fiyat: 30, birim: 'adet', kirik: true, renkler: [{ ad, rid, mik: Object.values(beden).reduce((a, b) => a + (+b || 0), 0), beden, ...ek }] });
const t14 = await ev(async (K) => { IP.kur(); const once = JSON.stringify({ l: IP.lok(IP.A, 'Siyah'), k: IP.renk(IP.A, 'Siyah')[0].kirik });
  IP.satis('s-ip', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Siyah', rid: R.S, mik: 2 }] }, K]);
  const satista = JSON.stringify({ l: IP.lok(IP.A, 'Siyah'), k: IP.renk(IP.A, 'Siyah')[0].kirik });
  const r = await IP.iptal('s-ip'); return { r, once, satista, sonra: JSON.stringify({ l: IP.lok(IP.A, 'Siyah'), k: IP.renk(IP.A, 'Siyah')[0].kirik }) }; }, KIRIK('Siyah', R.S, { S: 1, L: 1 }));
T('T14 tam ve kırık seri birlikte doğrulanır ve birlikte geri alınır', t14.r.iptal && t14.satista !== t14.once && t14.sonra === t14.once, t14);
T('T31 kırık beden dağılımı korunur (seri bozma birebir geri: {S:2,M:1})', t14.r.iptal && JSON.parse(t14.sonra).k && JSON.stringify(JSON.parse(t14.sonra).k) === JSON.stringify({ S: 2, M: 1 }), t14.sonra);
T('T32 tam seri ve kırık seri birbirine karışmaz (seri sayısı 10, kırık ayrı)', t14.r.iptal && JSON.parse(t14.sonra).l === 10, t14.sonra);

const t15 = await senaryo([ridSatir(9501, 'Siyah', R.S, 2), KIRIK('Gri', undefined, { S: 1 })]);
const t15b = await senaryo([ridSatir(9501, 'Siyah', R.S, 2), KIRIK('Turuncu', R.YOK, { S: 1 })], "const u=urun(IP.A);u.renkler.splice(u.renkler.findIndex(r=>r.ad==='Turuncu'),1);");
const t15x = await ev(() => IP.renk(IP.A, 'Turuncu').length);
T('T15 kırık seri belirsizse (kimliksiz / bulunamayan) tam seri de değişmez; kırıkta renk açılmaz', ret(t15.r) && t15.ayni && ret(t15b.r) && t15b.ayni && t15x === 0, { t15: t15.r, t15b: t15b.r, t15x });

const t16 = await senaryo([KIRIK('Siyah', R.S, { S: 1, M: 1 })], "s.kalemler[0].renkler[0].beden.M = 'x';");
const t16b = await senaryo([KIRIK('Siyah', R.S, { S: 1, M: 1 })], "s.kalemler[0].renkler[0].beden.ZZ = 1;");
T('T16 bir bedende hata (geçersiz adet / üründe olmayan beden) varsa diğer bedenler de değişmez', ret(t16.r) && t16.ayni && ret(t16b.r) && t16b.ayni, { t16: t16.r, t16b: t16b.r });

const t17 = [];
for (const m of ["'abc'", 'NaN', 'null', '1.5']) { const x = await senaryo([ridSatir(9501, 'Siyah', R.S, 2)], 's.kalemler[0].renkler[0].mik = ' + m + ';'); t17.push(ret(x.r) && x.ayni); }
T('T17 geçersiz miktar (metin, NaN, boş, seri üründe kesirli) reddedilir', t17.every(Boolean), t17);
const t18 = [];
for (const m of [-2, 0]) { const x = await senaryo([ridSatir(9501, 'Siyah', R.S, 2)], 's.kalemler[0].renkler[0].mik = ' + m + ';'); t18.push(ret(x.r) && x.ayni); }
T('T18 negatif veya sıfır miktar reddedilir', t18.every(Boolean), t18);

const t19 = await senaryo([ridSatir(9501, 'Siyah', R.S, 2)], "s.lokId = 'L-yok';");
T('T19 geçersiz lokasyon reddedilir (L-yok\'a stok yazılmaz)', ret(t19.r) && t19.ayni && !JSON.parse(t19.sonra).u.some(u => JSON.stringify([u.loklar || null, (u.renkler || []).map(r => r && typeof r === 'object' ? r.loklar || null : null)]).includes('L-yok')), t19.r); /* Ders 48: satışın tarihsel lokId alanı değil, ürün/renk lokasyon stoklarında hayalet L-yok anahtarı aranır */

const t20 = await senaryo([ridSatir(9501, 'Siyah', R.S, 2), { uid: 9599, fiyat: 10, birim: 'adet', mik: 1 }]);
T('T20 eksik (bulunamayan) ürün reddedilir; diğer satır da değişmez', ret(t20.r) && t20.ayni, t20.r);

const t21 = await senaryo([ridSatir(9501, 'Siyah', R.S, 2)], "db.urunler.push(JSON.parse(JSON.stringify(urun(IP.A))));");
T('T21 mükerrer ürün kimliği reddedilir', ret(t21.r) && t21.ayni, t21.r);

const t22 = await senaryo([ridSatir(9501, 'Siyah', R.S, 2)], "urun(IP.B).renkler[1].rid = R.S;");
T('T22 mükerrer rid (başka üründe aynı rid) reddedilir', ret(t22.r) && t22.ayni, t22.r);

const t23 = await senaryo([ridSatir(9501, 'Siyah', R.S, 1)], "s.kalemler[0].renkler[0] = { ad: 'Silik', rid: R.SIL, mik: 1 };");
T('T23 silinmiş renk otomatik canlandırılmaz (silindi kalır, stok eklenmez)', ret(t23.r) && t23.ayni && JSON.parse(t23.sonra).u[0].renkler.find(r => r.ad === 'Silik').silindi === true, t23.r);

// ---- Uygulama aşamasında hata (hata enjeksiyonu: B ürününün stok hücresine yazım hata fırlatır) ----
const t26 = await ev(async () => { IP.kur(); const ilk = IP.anlik();
  IP.satis('s-ip', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Siyah', rid: R.S, mik: 2 }] }, { uid: IP.B, fiyat: 80, birim: 'adet', renkler: [{ ad: 'Mavi', rid: R.M, mik: 2 }] }]);
  const once = IP.anlik(); const lk = IP.renk(IP.B, 'Mavi')[0].loklar; let v = lk['L-ana'], tetik = 0;
  Object.defineProperty(lk, 'L-ana', { configurable: true, enumerable: true, get() { return v; }, set(x) { tetik++; throw new Error('enjekte yazım hatası'); } });
  const r = await IP.iptal('s-ip'); delete lk['L-ana']; lk['L-ana'] = v; const sonra = IP.anlik();
  const basarili = r.iptal && IP.lok(IP.A, 'Siyah') === 10 && IP.lok(IP.B, 'Mavi') === 10;
  return { r, tetik, geriAlindi: !r.iptal && sonra === once, basarili, sonra }; });
T('T26 uygulama aşamasında hata olursa kısmi stok kalmaz (ya tamamen geri, ya tamamen başarılı)', (t26.geriAlindi && t26.r.toast.length > 0) || t26.basarili, t26);
T('T26b hata kullanıcıya bildirilir ve satış kaydı korunur', t26.basarili || (!t26.r.iptal && /iptal/i.test(t26.r.toast) && !/edildi/i.test(t26.r.toast)), t26.r);

// ---- Başarılı iptal ----
const t27 = await ev(async () => { IP.kur(); const ilk = IP.anlik();
  IP.satis('s-ip', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Siyah', rid: R.S, mik: 4 }, { ad: 'Beyaz', rid: R.B, mik: 1 }] }, { uid: IP.B, fiyat: 80, birim: 'adet', renkler: [{ ad: 'Mavi', rid: R.M, mik: 3 }] }], { odenen: 200 });
  const r = await IP.iptal('s-ip'); const s = db.satislar.find(x => x.id === 's-ip'); const I = JSON.parse(ilk);
  return { r, siyah: IP.lok(IP.A, 'Siyah'), beyaz: IP.lok(IP.A, 'Beyaz'), mavi: IP.lok(IP.B, 'Mavi'), depo: IP.lok(IP.A, 'Siyah', 'L-depo'), bdepo: IP.lok(IP.A, 'Beyaz', 'L-depo'),
    s: { iptal: s.iptal, t: typeof s.iptalTarih, n: db.satislar.length }, bakiye: db.cariler.find(c => c.id === 'c-ip').bakiye, kasa: db.hesaplar[0].bakiye,
    iptalHareket: db.hareketler.filter(h => h.tur === 'Satış İptali').length, renkSayi: [urun(IP.A).renkler.length, urun(IP.B).renkler.length] }; });
T('T27 başarılı iptalde stok doğru miktarda geri eklenir (Siyah/Beyaz/Mavi 10)', t27.r.iptal && t27.siyah === 10 && t27.beyaz === 10 && t27.mavi === 10 && JSON.stringify(t27.renkSayi) === '[5,3]', t27);
T('T28 başarılı iptalde satış durumu doğru (iptal:true, tarih, kayıt silinmez; bakiye 0, kasa 1000, iptal hareketi)', t27.s.iptal === true && t27.s.t === 'number' && t27.s.n === 1 && t27.bakiye === 0 && t27.kasa === 1000 && t27.iptalHareket === 1, t27);
T('T33 başka lokasyonun stoğu değişmez (Depo: Siyah 7, Beyaz 3)', t27.depo === 7 && t27.bdepo === 3, t27);

const t29 = await ev(async () => { IP.kur(); IP.satis('s-ip', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Siyah', rid: R.S, mik: 3 }] }]);
  const r1 = await IP.iptal('s-ip'); const ara = IP.anlik(); const r2 = await IP.iptal('s-ip'); return { r1, r2, ayni: IP.anlik() === ara, siyah: IP.lok(IP.A, 'Siyah') }; });
T('T29 ikinci iptal aynı stoğu tekrar eklemez', t29.r1.iptal && t29.ayni && t29.siyah === 10 && /zaten/i.test(t29.r2.toast), t29);

// ---- İptal dışındaki davranışlar ----
const t34 = await ev(() => { IP.kur(); const s = IP.satis('s-yeni', [{ uid: IP.A, fiyat: 150, renkler: [{ ad: 'Siyah', mik: 3 }] }, { uid: IP.B, fiyat: 80, birim: 'adet', renkler: [{ ad: 'Mavi', mik: 1 }] }], { odenen: 50 });
  return { siyah: IP.lok(IP.A, 'Siyah'), mavi: IP.lok(IP.B, 'Mavi'), bakiye: db.cariler.find(c => c.id === 'c-ip').bakiye, kasa: db.hesaplar[0].bakiye, iptal: !!s.iptal }; });
T('T34 satış oluşturma (applySatis) davranışı değişmez: stok düşer, bakiye ve kasa işlenir', t34.siyah === 7 && t34.mavi === 9 && t34.bakiye === 480 && t34.kasa === 1050 && !t34.iptal, t34);

const t40 = await ev(() => { IP.kur();
  stokUygula({ uid: IP.A, mik: 2, renkler: [{ ad: 'Siyah', mik: 2 }] }, 1);            /* iade yolu (lokId yok → aktif) */
  stokUygula({ uid: IP.A, mik: 1, renkler: [{ ad: 'Beyaz', mik: 1 }] }, -1, 'L-depo');
  stokUygula({ uid: IP.B, mik: 1, renkler: [{ ad: 'Yeşil', mik: 1 }] }, -1, 'L-ana');   /* bilinen risk: satışta eksik renk hâlâ açılır (R2.2c kapsamı) */
  return { siyah: IP.lok(IP.A, 'Siyah'), bdepo: IP.lok(IP.A, 'Beyaz', 'L-depo'), yesil: IP.renk(IP.B, 'Yeşil').length }; });
T('T40 iptal dışındaki stok çağrıları etkilenmez (iade +, depo −, satışta eksik renk davranışı aynı)', t40.siyah === 12 && t40.bdepo === 2 && t40.yesil === 1, t40);

// Kaynak gövdeleri Ders 45 başlangıcıyla birebir aynı olmalı (davranış testi + değişmezlik)
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const govde = (ad) => { const i = html.indexOf('function ' + ad + '('); return i < 0 ? '' : html.slice(i, html.indexOf('\nfunction ', i + 10)); };
const iz = (ad) => createHash('sha256').update(govde(ad)).digest('hex').slice(0, 16);
const TABAN = {
  applySatis: '37274ab71919979c',
  kaydetSatis: 'f9403cd00e9ff0cd',
  sepEkle: '207dd5bf1b029ab3',
  defoUygula: '08930395b2c8a7f8',
  transferStokUygula: '06fd6711ac3da230',
  _isEmriStoklaCommit: '14863def812dc9af',
  lokStokRenk: 'fd2ae5ad65c2edc8',
  portalOnay: '615ba0d5faeba870',
  canliDomenUygula: '28cfaa0ea2260cea',
  _recMerge: '7fb79bbce540700e',
  _sbAl: 'db73110a61d221b3',
  _kumulatifBirlestir: 'b844992000bd5e8e',
};
const fark = (liste) => liste.filter(f => !TABAN[f] || iz(f) !== TABAN[f] || govde(f).length < 40);
const f34 = fark(['applySatis', 'defoUygula']); /* Ders 47 (kullanıcı onayı): sepEkle + kaydetSatis yeni satış rid'i için değişebilir; davranışları test 31'de doğrulanır */
T('T34b satış stok uygulama / iade fonksiyonları değişmedi (applySatis, defoUygula)', f34.length === 0, f34);
const t35 = await ev(() => typeof transferStokUygula === 'function' && typeof _isEmriStoklaCommit === 'function' && typeof lokStokRenk === 'function');
const f35 = fark(['transferStokUygula', '_isEmriStoklaCommit', 'lokStokRenk']);
T('T35 transfer ve üretim fonksiyonları yerinde ve değişmedi', t35 && f35.length === 0, f35);
const t36 = await ev(() => typeof portalOnay === 'function' && typeof canliDomenUygula === 'function' && typeof _recMerge === 'function');
const f36 = fark(['portalOnay', 'canliDomenUygula', '_recMerge', '_sbAl', '_kumulatifBirlestir']);
T('T36 portal ve senkron fonksiyonları yerinde ve değişmedi', t36 && f36.length === 0, f36);

T('T37 gerçek veri / Firebase erişimi yok (localhost dışı her istek engellendi; Firebase SDK yüklenmedi)', await ev(() => typeof firebase === 'undefined') && disari.every(h => !/^(localhost|127\.0\.0\.1)$/.test(h)), [...new Set(disari)]);
const hepsi = [t3, t4, t5, t6, t12, t13, t15, t15b, t16, t16b, t19, t20, t21, t22, t23];
T('T38 kaynak veri (bellek + kalıcı depo) hata durumlarında değişmez', hepsi.every(x => x.ayni && x.depoAyni), hepsi.map(x => [x.ayni, x.depoAyni]));
T('T39 test 01–28 dosyaları yerinde (tam regresyon ayrıca çalıştırılır)', Array.from({ length: 28 }, (_, i) => String(i + 1).padStart(2, '0')).every(n => fs.readdirSync(path.join(ROOT, 'test')).some(f => f.startsWith(n + '-') && f.endsWith('.test.mjs'))), null);
T('T-ek sayfa hatası yok', errs.length === 0, errs);

await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
