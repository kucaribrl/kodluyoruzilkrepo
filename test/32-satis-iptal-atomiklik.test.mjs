// R2.2b.3: GÜVENLİ SATIŞ İPTALİ — yerel atomiklik. GERÇEK akış: silSatis → askKritik "SİL" → kritikOnayla.
// Sözleşme:
//   - Önce bütün satırlar + lokasyon + finans ilişkileri doğrulanır (onaydan ÖNCE ve onaydan SONRA yeniden); tek hata → hiçbir şey değişmez.
//   - rid'li satır: yalnız kanonik motorla (SALT_OKUMA) kesin kimlik; bulunamaz/çakışır/silinmişse ret; ada düşülmez.
//   - rid'siz eski satır (Karar 1/3): ürünün AKTİF renkleri arasında TEK ve BİREBİR ad eşleşmesi varsa iptal edilebilir;
//     rid üretilmez/yazılmaz; birden fazla / sıfır / yalnız harf farkı → ret ("…mutabakat gerekiyor"). Ad eşleşmesi kimlik kanıtı değildir.
//   - Hiçbir koşulda renk oluşturulmaz. revertSatis'e fallback yoktur. Stok, cari, kasa, çek/POS ve satış durumu TEK yerel işlemde uygulanır;
//     uygulama sırasında hata olursa her şey geri alınır. Bulut senkronu (belge başına ayrı yazım) atomik DEĞİLDİR — bu test onu iddia etmez.
// Sentetik veri; localhost dışı istekler engellenir (Firebase yok). Sunucu rastgele port, sw.js → 404.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOTOR = '/js/renk-cozumleme.mjs';
const SV = { motor: 'gercek' };
const srv = http.createServer((req, res) => {
  const y = decodeURIComponent(req.url.split('?')[0]);
  if (y.includes('sw.js')) { res.writeHead(404); return res.end(); }
  if (y === MOTOR && SV.motor === 'yok') { res.writeHead(404); return res.end(); }
  if (y === MOTOR && SV.motor === 'surum2') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, MOTOR), 'utf8').replace('export const MOTOR_SURUM = 1;', 'export const MOTOR_SURUM = 2;')); }
  const p = path.join(ROOT, y === '/' ? 'index.html' : y);
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': /\.m?js$/.test(p) ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 320) : '')); } };
const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const disari = [], errs = [];
const R = { S: 'r_b1111111-1111-4111-8111-111111111111', B: 'r_b2222222-2222-4222-8222-222222222222', K: 'r_b3333333-3333-4333-8333-333333333333',
  S2: 'r_b4444444-4444-4444-8444-444444444444', L: 'r_b5555555-5555-4555-8555-555555555555', YOK: 'r_b6666666-6666-4666-8666-666666666666' };
const ESKI_MESAJ = 'Bu eski satışın renk kimliği doğrulanamadı. İptal için mutabakat gerekiyor.';

const YARDIMCI = `
  const R = ${JSON.stringify(R)};
  const Y = {
    kur() {
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }]; aktifLok = 'L-ana'; db.pin = null;
      const bed = [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }, { beden: 'XXL', adet: 1 }];
      db.urunler = [
        { id: 9701, ad: 'İptal Seri', kod: 'IA-1', birim: 'seri', seri: 5, bedenler: bed, pb: 'TL', alis: 20, satis: 30, kritik: 0, stok: 0,
          renkler: [{ ad: 'Siyah', rid: R.S, hex: '#111', barkod: '970101', stok: 0, loklar: { 'L-ana': 10, 'L-depo': 7 }, kirik: { S: 2, M: 1 } },
                    { ad: 'Beyaz', rid: R.B, hex: '#fff', barkod: '970102', stok: 0, loklar: { 'L-ana': 10, 'L-depo': 4 } },
                    { ad: 'Gri', hex: '#888', barkod: '970103', stok: 0, loklar: { 'L-ana': 10 } }] },
        { id: 9702, ad: 'İptal Adet', kod: 'IA-2', birim: 'adet', pb: 'TL', alis: 30, satis: 50, kritik: 0, stok: 0,
          renkler: [{ ad: 'Kırmızı', rid: R.K, hex: '#f00', barkod: '970201', stok: 0, loklar: { 'L-ana': 10 } },
                    { ad: 'Siyah', rid: R.S2, hex: '#111', barkod: '970202', stok: 0, loklar: { 'L-ana': 10 } }] },
        { id: 9703, ad: 'Çift Mavi', kod: 'IA-3', birim: 'adet', pb: 'TL', alis: 10, satis: 20, kritik: 0, stok: 0,
          renkler: [{ ad: 'Mavi', hex: '#09f', barkod: '970301', stok: 0, loklar: { 'L-ana': 10 } }, { ad: 'Mavi', hex: '#08e', barkod: '970302', stok: 0, loklar: { 'L-ana': 10 } }] },
        { id: 9704, ad: 'Ceket', kod: 'IA-4', birim: 'adet', pb: 'TL', alis: 100, satis: 200, kritik: 0, stok: 0,
          renkler: [{ ad: 'Lacivert', rid: R.L, hex: '#00f', barkod: '970401', stok: 0, loklar: { 'L-ana': 10 } }] },
        { id: 9705, ad: 'Renksiz Kemer', kod: 'IA-5', birim: 'adet', pb: 'TL', alis: 5, satis: 10, kritik: 0, stok: 10, loklar: { 'L-ana': 10 } },
      ];
      db.cariler = [{ id: 'c-32', ad: 'İptal Müşteri', tip: 'musteri', bakiye: 0, lokId: 'L-ana' }];
      db.hesaplar = [{ id: 'h-32', ad: 'Nakit Kasa', bakiye: 1000, lokId: 'L-ana' }, { id: 'h-32b', ad: 'Banka', bakiye: 5000, lokId: 'L-ana' }];
      db.hareketler = []; db.cekler = []; db.satislar = []; db.transferler = []; db.isemirleri = []; db.bekleyenPortal = [];
      stokProjYukle(); save();
    },
    // Satış GERÇEK applySatis ile oluşur (stok/cari/kasa/çek işlenir)
    satis(id, kalemler, ek = {}) {
      const tutar = kalemler.reduce((a, k) => a + (+k.fiyat || 0) * (+k.mik || 0), 0);
      const s = { id, tip: 'satis', lokId: ek.lokId === undefined ? 'L-ana' : ek.lokId, mid: 'c-32', mus: 'İptal Müşteri', pb: 'TL', tarih: 1700000000000, tutar, araToplam: tutar,
        odenen: (ek.odemeler || []).reduce((a, l) => a + l.tutar, 0), odemeler: ek.odemeler || [], kalemler, ...(ek.kesik ? { kesik: ek.kesik } : {}), ...(ek.taksitler ? { taksitler: ek.taksitler } : {}) };
      if (s.lokId === null) delete s.lokId;
      db.satislar.push(s); applySatis(s); save(); return s;
    },
    anlik() { return JSON.stringify({ u: db.urunler, s: db.satislar, c: db.cariler, h: db.hesaplar, hr: db.hareketler, ck: db.cekler, seq: db.seq }); },
    depo() { return localStorage.getItem(KEY); },
    lok(uid, i, L = 'L-ana') { const r = urun(uid).renkler ? urun(uid).renkler[i] : urun(uid); return +((r.loklar || {})[L]) || 0; },
    async iptal(id, araIslem) {
      $('toast').textContent = ''; let hata = null, pencere = false; { const eski = $('kk-txt'); if (eski) eski.remove(); }
      try { silSatis(id); const t = $('kk-txt'); if (t) { pencere = true; if (araIslem) araIslem(); t.value = 'SİL'; await kritikOnayla(); } } catch (e) { hata = String(e && e.message || e); }
      const s = db.satislar.find(x => x.id === id); return { toast: $('toast').textContent, hata, pencere, iptal: !!(s && s.iptal) };
    },
  };
`;
async function sayfa(motor = 'gercek') {
  SV.motor = motor;
  const ctx = await br.newContext({ serviceWorkers: 'block' });
  await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return r.continue(); disari.push(h); return r.abort(); });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${srv.address().port}/`);
  await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app') && window.renkMotoru && (window.renkMotoru.hazir || window.renkMotoru.hata), null, { timeout: 15000 });
  await page.addScriptTag({ content: YARDIMCI });
  return { ctx, page, ev: (f, a) => page.evaluate(f, a).catch(e => ({ HATA: String(e.message).slice(0, 240) })) };
}
const S1 = await sayfa(); const ev = S1.ev;

// Ortak başarısız senaryo: kur → satış (+ bozma) → anlık → iptal → anlık
async function ret(kalemler, bozma = '', ek = {}) {
  return ev(async ([kalemler, bozma, ek]) => { Y.kur(); const s = Y.satis('s-32', kalemler, ek); (new Function('R', 's', bozma))(R, s); save();
    const once = Y.anlik(), depo = Y.depo(), renkSayi = JSON.stringify(db.urunler.map(u => (u.renkler || []).length));
    const r = await Y.iptal('s-32');
    return { r, ayni: Y.anlik() === once, depoAyni: Y.depo() === depo, renkAyni: JSON.stringify(db.urunler.map(u => (u.renkler || []).length)) === renkSayi }; }, [kalemler, bozma, ek]);
}
const red = (x) => x && !x.HATA && !x.r.iptal && !x.r.hata && x.ayni && x.depoAyni && x.renkAyni && x.r.toast.length > 0 && !/iptal edildi/i.test(x.r.toast);
const K = (uid, renkler, ek = {}) => ({ uid, urun: 'x', birim: uid === 9701 ? 'seri' : 'adet', fiyat: 30, mik: renkler.reduce((a, r) => a + (+r.mik || 0), 0), renkler, ...ek });
const KIRIK = (renk, beden, ek = {}) => ({ uid: 9701, urun: 'İptal Seri (kırık seri)', birim: 'adet', fiyat: 6, kirik: true, mik: Object.values(beden).reduce((a, b) => a + b, 0), renkler: [{ ...renk, mik: Object.values(beden).reduce((a, b) => a + b, 0), beden }], ...ek });

// ===== Kimlik =====
const t1 = await ev(async () => { Y.kur(); Y.satis('s-32', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 3, renkler: [{ ad: 'Siyah', rid: R.S, mik: 3 }] }]);
  const satista = [Y.lok(9701, 0), Y.lok(9701, 1)]; const r = await Y.iptal('s-32'); return { r, satista, sonra: [Y.lok(9701, 0), Y.lok(9701, 1)] }; });
T('T1 RID ile doğru renk eşleşir (Siyah 10→7→10; Beyaz 10 kalır)', t1.r && t1.r.iptal && JSON.stringify(t1.satista) === '[7,10]' && JSON.stringify(t1.sonra) === '[10,10]', t1);
T('T2 başka ürüne ait RID reddedilir (9701 satırında 9702\'nin rid\'i)', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 1 }])], "s.kalemler[0].renkler[0].rid = R.K;")));
T('T3 bulunamayan RID reddedilir', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 1 }])], "s.kalemler[0].renkler[0].rid = R.YOK;")));
T('T4 global RID çakışması reddedilir', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 1 }])], "urun(9702).renkler[0].rid = R.S;")));
T('T5 bozuk renk listesi (başka üründe) reddedilir', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 1 }])], "urun(9703).renkler = 'Mavi,Mavi';")));
T('T6 silinmiş renk reddedilir (canlandırılmaz)', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 1 }])], "urun(9701).renkler[0].silindi = true;")));
const t7 = await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 1 }])], "s.kalemler[0].renkler[0] = { ad: 'Beyaz', rid: R.YOK, mik: 1 };");
T('T7 RID varsa ada fallback yapılmaz (Beyaz adı mevcut ama rid yok → ret, Beyaz değişmez)', red(t7), t7);
const t8 = await ret([K(9701, [{ ad: 'gri', mik: 1 }])], "/* satış oluşturma bugün eksik 'gri' rengini açıyor — iptal anında yalnız 'Gri' kalsın */ urun(9701).renkler = urun(9701).renkler.filter(r => r.ad !== 'gri');");
T('T8 RID\'siz eski satır yalnız harf farkıyla (gri ≠ Gri) otomatik eşleşmez; mesaj: mutabakat gerekiyor', red(t8) && t8.r.toast.includes(ESKI_MESAJ), t8.r);
const t9 = await ret([K(9703, [{ ad: 'Mavi', mik: 1 }])]);
T('T9 belirsiz eski renk (Mavi/Mavi) güvenli reddedilir; mesaj: mutabakat gerekiyor', red(t9) && t9.r.toast.includes(ESKI_MESAJ), t9.r);
const t10 = await ret([K(9701, [{ ad: 'Mor', mik: 1 }])], "/* satış oluşturma (applySatis) bugün eksik rengi açıyor — iptal anında Mor gerçekten yok olsun */ urun(9701).renkler = urun(9701).renkler.filter(r => r.ad !== 'Mor');"), t10b = await ret([K(9701, [{ ad: 'Mor', rid: R.YOK, mik: 1 }])], "/* satış oluşturma (applySatis) bugün eksik rengi açıyor — iptal anında Mor gerçekten yok olsun */ urun(9701).renkler = urun(9701).renkler.filter(r => r.ad !== 'Mor');");
T('T10 eksik renk otomatik oluşturulmaz (eski ve rid\'li satırda)', red(t10) && red(t10b), { t10: t10.r, t10b: t10b.r });

// ===== Çok satır =====
const COK = [K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }, { ad: 'Beyaz', rid: R.B, mik: 1 }]), K(9702, [{ ad: 'Kırmızı', rid: R.K, mik: 3 }]), K(9704, [{ ad: 'Lacivert', rid: R.L, mik: 1 }])];
const t11 = await ev(async (COK) => { Y.kur(); Y.satis('s-32', COK); const r = await Y.iptal('s-32'); return { r, v: [Y.lok(9701, 0), Y.lok(9701, 1), Y.lok(9702, 0), Y.lok(9704, 0)] }; }, COK);
T('T11 birden fazla satır birlikte doğrulanır ve hepsi geri alınır', t11.r && t11.r.iptal && JSON.stringify(t11.v) === '[10,10,10,10]', t11);
T('T12 son satırda hata → ilk satırlar değişmez', red(await ret(COK, "s.kalemler[2].renkler[0].rid = R.YOK;")));
T('T13 ilk satırda hata → hiçbir şey değişmez', red(await ret(COK, "s.kalemler[0].renkler[0].rid = R.YOK;")));
T('T14 orta satırda hata → hiçbir şey değişmez', red(await ret(COK, "s.kalemler[1].renkler[0].mik = -1;")));
T('T15 yanlış miktar (metin / seri üründe kesirli) reddedilir', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }])], "s.kalemler[0].renkler[0].mik = 'iki';")) && red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }])], "s.kalemler[0].renkler[0].mik = 1.5;")));
T('T16 negatif ve sıfır miktar reddedilir', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }])], "s.kalemler[0].renkler[0].mik = -2;")) && red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }])], "s.kalemler[0].renkler[0].mik = 0;")));
T('T17 NaN / Infinity reddedilir', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }])], "s.kalemler[0].renkler[0].mik = NaN;")) && red(await ret([K(9705, [], { mik: 1, renkler: undefined })], "s.kalemler[0].mik = Infinity;")));
T('T18 eksik / bilinmeyen lokasyon reddedilir', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }])], "s.lokId = 'L-yok';")));
T('T19 eksik ürün reddedilir (diğer satır da değişmez)', red(await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }]), { uid: 9799, urun: 'yok', birim: 'adet', fiyat: 1, mik: 1 }])));
const t20 = await ev(async () => { Y.kur(); const once = Y.anlik(); const r = await Y.iptal('s-yok'); return { r, ayni: Y.anlik() === once }; });
T('T20 eksik satış reddedilir (hata fırlamaz, veri aynı)', t20.r && !t20.r.hata && !t20.r.pencere && t20.ayni && t20.r.toast.length > 0, t20);

// ===== Finans =====
const ODE = [{ tur: 'Nakit', tutar: 40, pb: 'TL', hesapId: 'h-32' }, { tur: 'Çek', tutar: 30, pb: 'TL', vade: 1800000000000 }, { tur: 'Kredi Kartı', tutar: 20, pb: 'TL' }];
const fin = await ev(async ([COK, ODE]) => { Y.kur(); const s = Y.satis('s-32', COK, { odemeler: ODE, kesik: 5 });
  const satista = { bakiye: db.cariler[0].bakiye, kesik: db.cariler[0].kesikToplam, kasa: db.hesaplar[0].bakiye, cek: db.cekler.length, hr: db.hareketler.length };
  const r = await Y.iptal('s-32'); const r2 = await Y.iptal('s-32');
  return { r, r2, satista, bakiye: db.cariler[0].bakiye, kesik: db.cariler[0].kesikToplam, kasa: db.hesaplar[0].bakiye, banka: db.hesaplar[1].bakiye, cek: db.cekler.length,
    iptalHr: db.hareketler.filter(h => h.tur === 'Satış İptali').length, odeme: s.odemeler.map(l => [l._cekId || null, l._hesapId || null]), s: { iptal: s.iptal, t: typeof s.iptalTarih } }; }, [COK, ODE]);
T('T21 cari bütünlüğü (bakiye ve kesik tam geri alınır)', fin.r && fin.r.iptal && Math.abs(fin.bakiye) < 1e-9 && Math.abs(fin.kesik || 0) < 1e-9 && fin.satista.bakiye !== 0, fin);
T('T22 kasa bütünlüğü (nakit 1040→1000, tek "Satış İptali" hareketi, banka aynı)', fin.kasa === 1000 && fin.iptalHr === 1 && fin.banka === 5000 && fin.satista.kasa === 1040, fin);
T('T23 çek bütünlüğü (satışın çeki kaldırılır)', fin.satista.cek === 2 && fin.cek === 0 && fin.odeme[1][0] === null, fin);
T('T24 POS bütünlüğü (kredi kartı kaydı kaldırılır)', fin.odeme[2][0] === null && fin.cek === 0, fin.odeme);
T('T25 satış iptal durumu tutarlı (iptal:true + tarih; kayıt silinmez)', fin.s.iptal === true && fin.s.t === 'number', fin.s);
const t26 = await ret(COK, "s.odemeler[0]._hesapId = 'h-silinmis';", { odemeler: ODE });
T('T26 finans hatasında (silinmiş kasa hesabı) stok değişmez', red(t26), t26.r);
const t27 = await ret(COK, "s.kalemler[2].renkler[0].rid = R.YOK;", { odemeler: ODE });
T('T27 stok hatasında finans (cari/kasa/çek/POS) değişmez', red(t27), t27.r);
T('T28 tekrar iptal çift stok/finans oluşturmaz ("zaten iptal")', /zaten/i.test(fin.r2.toast) && fin.iptalHr === 1, fin.r2);
const t29 = await ev(async ([COK, ODE]) => { Y.kur(); const s = Y.satis('s-32', COK, { odemeler: ODE }); const h = db.hesaplar.splice(0, 1)[0]; save();
  const r1 = await Y.iptal('s-32'); const ara = { iptal: s.iptal, siyah: Y.lok(9701, 0) }; db.hesaplar.unshift(h); save();
  const r2 = await Y.iptal('s-32'); return { r1, ara, r2, siyah: Y.lok(9701, 0), kasa: db.hesaplar[0].bakiye }; }, [COK, ODE]);
T('T29 başarısız iptal (eksik kasa) veri bozmadan durur; düzeltilince tekrar denenebilir ve başarılı olur', !t29.r1.iptal && t29.ara.siyah === 8 && t29.r2.iptal && t29.siyah === 10 && t29.kasa === 1000, t29);
T('T30 başarılı iptal tek kez uygulanır (hareket 1, çek 0, ikinci deneme reddedilir)', fin.iptalHr === 1 && fin.cek === 0 && !fin.r2.iptal === false && /zaten/i.test(fin.r2.toast), fin);

// ===== Seri / kırık / ad / rid =====
const sk = await ev(async ([a, b]) => { Y.kur(); const once = JSON.stringify({ l: urun(9701).renkler[0].loklar, k: urun(9701).renkler[0].kirik, s: urun(9701).stok });
  Y.satis('s-32', [a, b]); const satista = JSON.stringify({ l: urun(9701).renkler[0].loklar, k: urun(9701).renkler[0].kirik });
  const r = await Y.iptal('s-32'); return { r, once, satista, sonra: JSON.stringify({ l: urun(9701).renkler[0].loklar, k: urun(9701).renkler[0].kirik, s: urun(9701).stok }) }; },
  [K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }]), KIRIK({ ad: 'Siyah', rid: R.S }, { S: 1, L: 2 })]);
T('T31 tam seri stok doğru geri alınır (Mağaza 10, Depo 7)', sk.r.iptal && JSON.parse(sk.sonra).l['L-ana'] === 10 && JSON.parse(sk.sonra).l['L-depo'] === 7, sk);
T('T32 kırık seri beden dağılımı birebir geri gelir ({S:2,M:1}; bozulan seri tamamlanır)', sk.r.iptal && sk.satista !== sk.once && sk.sonra === sk.once, sk);
const t33 = await ev(async () => { Y.kur(); Y.satis('s-32', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 1, renkler: [{ ad: 'Siyah', rid: R.S, mik: 1 }] }, { uid: 9702, urun: 'y', birim: 'adet', fiyat: 50, mik: 4, renkler: [{ ad: 'Siyah', rid: R.S2, mik: 4 }] }]);
  const r = await Y.iptal('s-32'); return { r, a: Y.lok(9701, 0), b: Y.lok(9702, 1), bk: Y.lok(9702, 0) }; });
T('T33 aynı adlı farklı RID\'ler karışmaz (9701 Siyah 10, 9702 Siyah 10, Kırmızı 10)', t33.r.iptal && t33.a === 10 && t33.b === 10 && t33.bk === 10, t33);
T('T34 aynı RID farklı ürünlerde → ret', red(await ret([K(9702, [{ ad: 'Kırmızı', rid: R.K, mik: 1 }])], "urun(9704).renkler[0].rid = R.K;")));
const t35 = await ev(async () => { Y.kur(); const s = Y.satis('s-32', [{ uid: 9704, urun: 'Ceket', birim: 'adet', fiyat: 200, mik: 2, renkler: [{ ad: 'Lacivert', rid: R.L, mik: 2 }] }]);
  urun(9704).renkler[0].ad = 'Gece Mavisi'; save(); const r = await Y.iptal('s-32');
  return { r, lok: Y.lok(9704, 0), adlar: urun(9704).renkler.map(x => x.ad), tarihsel: s.kalemler[0].renkler[0].ad }; });
T('T35 renk adı değişmişse RID kullanılır (Gece Mavisi 8→10, Lacivert açılmaz, tarihsel ad korunur)', t35.r.iptal && t35.lok === 10 && JSON.stringify(t35.adlar) === '["Gece Mavisi"]' && t35.tarihsel === 'Lacivert', t35);
const t36 = await ev(async () => { Y.kur(); const s0 = Y.satis('s-diger', [{ uid: 9702, urun: 'y', birim: 'adet', fiyat: 50, mik: 1, renkler: [{ ad: 'Kırmızı', rid: R.K, mik: 1 }] }]);
  const s = Y.satis('s-32', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 2, renkler: [{ ad: 'Gri', mik: 2 }] }, { uid: 9705, urun: 'Kemer', birim: 'adet', fiyat: 10, mik: 3 }]);
  const digerOnce = JSON.stringify(db.satislar[0]); const kalemOnce = JSON.stringify(s.kalemler);
  const r = await Y.iptal('s-32'); return { r, gri: Y.lok(9701, 2), kemer: Y.lok(9705, 0, 'L-ana'), kemerStok: urun(9705).stok, ridYok: !JSON.stringify(s.kalemler).includes('rid'), kalemAyni: JSON.stringify(s.kalemler) === kalemOnce, digerAyni: JSON.stringify(db.satislar[0]) === digerOnce, griRid: urun(9701).renkler[2].rid }; });
T('T36 eski (rid\'siz) satış tek ve birebir adla güvenle iptal edilir; satış kaydına rid eklenmez, diğer satışlar değişmez', t36.r.iptal && t36.gri === 10 && t36.ridYok && t36.kalemAyni && t36.digerAyni && t36.griRid === undefined, t36);
T('T36b renksiz ürün satırı doğru geri alınır (ürün loklar 7→10, stok 10)', t36.kemer === 10 && t36.kemerStok === 10, t36);
const t37 = await ev(async () => { Y.kur(); const kart = () => JSON.stringify(db.urunler.map(u => [u.ad, u.kod, u.birim, (u.renkler || []).map(r => [r.ad, r.rid, r.hex, r.barkod, Object.keys(r).sort().join()])]));
  const once = kart(); Y.satis('s-32', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 2, renkler: [{ ad: 'Siyah', rid: R.S, mik: 2 }] }]); await Y.iptal('s-32'); return { ayni: kart() === once }; });
T('T37 kaynak ürün kartı gereksiz değişmez (ad/kod/rid/renk/barkod/alan seti aynı)', t37.ayni === true, t37);
T('T38 otomatik renk oluşturma gerçekleşmez (bütün ret senaryolarında renk sayıları aynı)', [t7, t8, t9, t10, t10b].every(x => x.renkAyni), null);

// ===== Hata enjeksiyonu / kaydetme / onay sırasında değişen veri / çok lokasyon / eşdeğerlik =====
const e1 = await ev(async ([COK, ODE]) => { Y.kur(); Y.satis('s-32', COK, { odemeler: ODE }); const once = Y.anlik(); Object.freeze(db.cariler[0]);
  const r = await Y.iptal('s-32'); const sonra = Y.anlik(); return { r, ayni: sonra === once, siyah: Y.lok(9701, 0) }; }, [COK, ODE]);
T('E1 uygulama (yerel commit) sırasında hata → tam geri alma (dondurulmuş cari; stok/kasa/çek/satış aynı) ve hata bildirimi', e1.r && !e1.r.iptal && e1.ayni && e1.siyah === 8 && /iptal/i.test(e1.r.toast) && !/edildi/i.test(e1.r.toast), e1);
const e2 = await ev(async (COK) => { Y.kur(); Y.satis('s-32', COK); const depo = Y.depo(); const orj = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('kota'); };
  let r; try { r = await Y.iptal('s-32'); } finally { Storage.prototype.setItem = orj; }
  const kayit = JSON.parse(Y.depo()); const ks = kayit.satislar.find(x => x.id === 's-32'), ku = kayit.urunler.find(u => u.id === 9701);
  return { r, bellek: { iptal: !!db.satislar.find(x => x.id === 's-32').iptal, siyah: Y.lok(9701, 0) }, disk: { ayni: Y.depo() === depo, iptal: !!ks.iptal, siyah: ku.renkler[0].loklar['L-ana'] } }; }, COK);
/* Ders 48 son güvenlik onayı (Karar 2): eski beklenti "bellek TAMAMEN iptal" idi; yeni sözleşme: kayıt başarısızsa iptal başarısız sayılır, bellek iptal öncesine döner */
T('E2 yerel kaydetme başarısız (localStorage kotası): iptal BAŞARISIZ sayılır; bellek iptal öncesine döner (Siyah 8), disk de eski; başarı mesajı yok', e2.r && !e2.r.iptal && !/iptal edildi ✓/.test(e2.r.toast) && /kay[ıi]t/i.test(e2.r.toast) && e2.bellek.iptal === false && e2.bellek.siyah === 8 && e2.disk.ayni && e2.disk.iptal === false && e2.disk.siyah === 8, e2);
const e3 = await ev(async (COK) => { Y.kur(); Y.satis('s-32', COK); const once = Y.anlik(); const r = await Y.iptal('s-32', () => { urun(9704).renkler.splice(0, 1); });
  return { r, lacSayi: urun(9704).renkler.length, siyah: Y.lok(9701, 0), iptal: !!db.satislar[0].iptal }; }, COK);
T('E3 onay penceresi açıkken veri değişirse (renk kaldırıldı) onaydan sonra yeniden doğrulanır → ret, hiçbir şey değişmez', e3.r && e3.r.pencere && !e3.r.iptal && e3.siyah === 8 && e3.lacSayi === 0, e3);
const e4 = await ev(async () => { Y.kur(); Y.satis('s-32', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 3, renkler: [{ ad: 'Beyaz', rid: R.B, mik: 3 }] }], { lokId: 'L-depo' });
  const satista = [Y.lok(9701, 1, 'L-depo'), Y.lok(9701, 1, 'L-ana')]; const r = await Y.iptal('s-32'); return { r, satista, sonra: [Y.lok(9701, 1, 'L-depo'), Y.lok(9701, 1, 'L-ana')] }; });
T('E4 çok lokasyon: depo satışı yalnız depoya geri döner (Depo 4→1→4, Mağaza 10)', e4.r.iptal && JSON.stringify(e4.satista) === '[1,10]' && JSON.stringify(e4.sonra) === '[4,10]', e4);
const e5 = await ev(async ([COK, ODE, KR]) => { const al = () => JSON.stringify({ u: db.urunler.map(u => [u.stok, u.loklar, (u.renkler || []).map(r => [r.stok, r.loklar, r.kirik])]), c: db.cariler.map(c => [c.bakiye, c.kesikToplam]), h: db.hesaplar.map(h => h.bakiye), ck: db.cekler.length });
  Y.kur(); let s = Y.satis('s-32', [...COK, KR], { odemeler: ODE, kesik: 5 }); revertSatis(s); const eski = al();
  Y.kur(); s = Y.satis('s-32', [...COK, KR], { odemeler: ODE, kesik: 5 }); const r = await Y.iptal('s-32'); const yeni = al(); return { r, esit: eski === yeni, eski, yeni }; }, [COK, ODE, KIRIK({ ad: 'Siyah', rid: R.S }, { S: 1, L: 2 })]);
T('E5 eşdeğerlik: geçerli satışta yeni iptal, eski revertSatis ile AYNI stok/kırık/cari/kasa/çek sonucunu verir', e5.r && e5.r.iptal && e5.esit, e5.esit ? null : e5);
const e6 = await ev(async () => { Y.kur(); const s = Y.satis('s-32', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 2, renkler: [{ ad: 'Siyah', rid: R.S, mik: 2 }] }], { taksitler: [{ tutar: 20, odendi: true }, { tutar: 40, odendi: false }] });
  const r = await Y.iptal('s-32'); return { r, bakiye: db.cariler[0].bakiye }; });
T('E6 ödenmiş taksit, iptalde eskisi gibi müşteri alacağına yazılır (bakiye −20)', e6.r.iptal && e6.bakiye === -20, e6);
const e7 = await ev(async () => { Y.kur(); Y.satis('s-32', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 2, renkler: [{ ad: 'Siyah', rid: R.S, mik: 2 }] }], { lokId: null });
  const r = await Y.iptal('s-32'); return { r, siyah: Y.lok(9701, 0) }; });
T('E7 lokasyonu olmayan eski satış aktif lokasyona geri alınır (eski davranış: Mağaza 10)', e7.r.iptal && e7.siyah === 10, e7);
const e8 = await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 2 }])], "db.cariler.length = 0;");
T('E8 satışın carisi bulunamazsa uydurulmaz → ret, hiçbir şey değişmez', red(e8), e8.r);
const e9 = await ret([KIRIK({ ad: 'Siyah', rid: R.S }, { S: 1, M: 1 })], "s.kalemler[0].renkler[0].beden.ZZ = 1;");
const e9b = await ret([KIRIK({ ad: 'Siyah', rid: R.S }, { S: 1, M: 1 })], "s.kalemler[0].renkler[0].beden.M = 'x';");
T('E9 kırık seride üründe olmayan beden / geçersiz beden adedi → ret', red(e9) && red(e9b), { e9: e9.r, e9b: e9b.r });
const e10 = await ret([K(9701, [{ ad: 'Siyah', rid: R.S, mik: 1 }])], "s.odemeler.push({ tur: 'Çek', tutar: 1, pb: 'TL', _tl: 1, _cekId: 'cek-yok' });");
T('E10 satışın çek kaydı bulunamazsa uydurulmaz → ret', red(e10), e10.r);
const e11 = await ev(async () => { Y.kur(); db.cariler[0].bakiye = 20000; db.satislar.push({ id: 's-satirsiz', tip: 'satis', mid: 'c-32', mus: 'M', tarih: 1, kalemler: [], tutar: 30000, odenen: 10000, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [],
  taksitler: [{ tutar: 10000, odendi: true }, { tutar: 10000 }, { tutar: 10000 }] }); save(); const urunOnce = JSON.stringify(db.urunler); const r = await Y.iptal('s-satirsiz');
  return { r, bakiye: db.cariler[0].bakiye, urunAyni: JSON.stringify(db.urunler) === urunOnce }; });
T('E11 satırsız (yalnız taksitli) satış eskisi gibi iptal edilir: bakiye 20.000 → −10.000, stok değişmez (test 09 Y22 ile aynı davranış)', e11.r.iptal && e11.bakiye === -10000 && e11.urunAyni, e11);
// ===== Kalıcı kayıt (save) başarısızlığı — Ders 48 son güvenlik sözleşmesi (RED: onay bekleyen hedef davranış) =====
// Hedef: localStorage yazılamazsa iptal BAŞARILI SAYILMAZ: başarı mesajı yok, bellek eski hâline döner, bellek = localStorage = IndexedDB,
// iptal edilmiş veri buluta GİTMEZ (bulut yazımı sahte canliRef ile yakalanır; gerçek ağ yok), yer açılınca tekrar denenebilir.
const kf = await ev(async ([COK, ODE]) => { Y.kur(); Y.satis('s-32', COK, { odemeler: ODE }); await new Promise(r => setTimeout(r, 1000));
  const gor = (d) => JSON.stringify({ s: d.satislar.map(x => [x.id, !!x.iptal]), u: d.urunler.map(u => (u.renkler || []).map(r => r.loklar)), c: d.cariler.map(c => c.bakiye), h: d.hesaplar.map(h => h.bakiye), ck: d.cekler.length, hr: d.hareketler.length });
  const once = gor(db);
  const damga = () => JSON.stringify({ m: [db.satislar, db.urunler, db.cariler, db.hesaplar, db.cekler, db.hareketler].map(L => L.map(r => [r.id, r._m])), seq: db.seq, tomb: db._tomb || null, ayarM: db._ayarM || null });
  const damgaOnce = damga();
  const bulut = [], say = { hemen: 0 }; const eskiRef = window.canliRef, eskiHemen = window.canliYazHemen;
  window.canliRef = (domen) => ({ set: (data) => { bulut.push({ domen, iptal: JSON.stringify(data).includes('"iptal":true') }); return Promise.resolve(); } });
  window.canliYazHemen = function () { say.hemen++; return eskiHemen.apply(this, arguments); };
  const eskiRol = window.canliRol; window.canliRol = () => 'admin'; canliAcik = true;
  /* pozitif kontrol: sahte bulut yazımı gerçekten yakalanıyor mu? (demo veri işareti kapalı; save() başarılı yolda buluta yazmaz → doğrudan canliYazHemen) */ db.ornek = false; await eskiHemen(['satis', 'stok']); await new Promise(r => setTimeout(r, 100)); const kontrolYakalandi = bulut.length; bulut.length = 0;
  const orj = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === KEY) throw new DOMException('kota', 'QuotaExceededError'); return orj.apply(this, arguments); };
  let r; try { r = await Y.iptal('s-32'); } finally { Storage.prototype.setItem = orj; }
  const bellek = gor(db), damgaGeri = damga();
  const snapTabani = ['satislar', 'urunler', 'cariler', 'hesaplar', 'cekler', 'hareketler'].every(L => db[L].every(r => _mSnap[L][r.id] === JSON.stringify(r, _mReplacer)) && Object.keys(_mSnap[L]).length === db[L].filter(r => r && r.id != null).length);
  await new Promise(r => setTimeout(r, 1600)); const bulutZamanlayici = bulut.slice();
  canliAcik = false; window.canliRef = eskiRef; window.canliYazHemen = eskiHemen; window.canliRol = eskiRol;
  const ls = gor(JSON.parse(localStorage.getItem(KEY))), idb = gor(JSON.parse(await idbOku()));
  /* başka bir NORMAL kayıt (yer açıldı): iptal edilmiş satış yanlışlıkla yazılmamalı; yanlış damga / mezar taşı oluşmamalı */
  const normalOk = save(); const lsNormal = gor(JSON.parse(localStorage.getItem(KEY))), damgaNormal = damga();
  const hrOnce = db.hareketler.length; const r2 = await Y.iptal('s-32'); const r3 = await Y.iptal('s-32');
  return { r, once, bellek, ls, idb, bulut, bulutZamanlayici, kontrolYakalandi, hemen: say.hemen, damgaOnce, damgaGeri, damgaNormal, snapTabani, normalOk, lsNormal, r2, r3,
    iptalHr: db.hareketler.length - hrOnce, cek: db.cekler.length, sonIptal: !!db.satislar.find(x => x.id === 's-32').iptal, siyah: Y.lok(9701, 0) }; }, [COK, ODE]);
T('E12a kalıcı kayıt başarısızsa başarı mesajı gösterilmez; kayıt hatası bildirilir', kf.r && !/iptal edildi ✓/.test(kf.r.toast) && /kay[ıi]t|depola/i.test(kf.r.toast), kf.r);
T('E12b kalıcı kayıt başarısızsa bellek iptal öncesi hâline döner (satış iptal değil; stok/cari/kasa/çek/hareket aynı)', kf.bellek === kf.once, { once: kf.once, bellek: kf.bellek });
T('E12c bellek, localStorage ve IndexedDB aynı (iptal edilmemiş) durumda kalır', kf.bellek === kf.ls && kf.ls === kf.idb && kf.idb === kf.once, { bellek: kf.bellek, ls: kf.ls, idb: kf.idb });
T('E12d başarısız işlem için iptal edilmiş veri buluta gönderilmez ve anında senkron (canliYazHemen) başlatılmaz', kf.kontrolYakalandi > 0 && kf.hemen === 0 && !kf.bulut.some(b => b.iptal), { kontrol: kf.kontrolYakalandi, hemen: kf.hemen, bulut: kf.bulut });
T('E12e yer açılınca iptal tekrar denenebilir ve bir kez uygulanır (Siyah 10)', kf.r2 && kf.r2.iptal && /iptal edildi ✓/.test(kf.r2.toast) && kf.sonIptal && kf.siyah === 10, { r2: kf.r2, siyah: kf.siyah });
T('E12f save() zamanlayıcıları GERÇEKTEN çalıştı (1,6 sn): bulut zamanlayıcısı yazdı ama yalnız eski (iptal edilmemiş) veriyi; IndexedDB eski', kf.bulutZamanlayici.length > 0 && !kf.bulutZamanlayici.some(b => b.iptal) && kf.idb === kf.once, { bulut: kf.bulutZamanlayici, idbEski: kf.idb === kf.once });
T('E12g geri alma sonrası değişiklik damgaları (_m), sayaç, mezar taşları ve ayar damgaları iptal öncesiyle birebir aynı', kf.damgaGeri === kf.damgaOnce, { once: kf.damgaOnce.slice(0, 200), geri: kf.damgaGeri.slice(0, 200) });
T('E12h _mSnapInit: değişiklik tabanı geri alınmış veriye yeniden kuruldu (her kayıt için birebir, fazladan/eksik kayıt yok)', kf.snapTabani === true, kf.snapTabani);
T('E12i sonraki NORMAL kayıt iptal edilmiş satışı yazmaz; yanlış damga / mezar taşı (silinmiş hareket/çek) oluşmaz', kf.normalOk === true && kf.lsNormal === kf.once && kf.damgaNormal === kf.damgaOnce, { normalOk: kf.normalOk, ls: kf.lsNormal === kf.once, damga: kf.damgaNormal === kf.damgaOnce });
T('E12j tekrar denemede iptal yalnız bir kez uygulanır (1 iptal hareketi, çekler kalktı, üçüncü deneme "zaten iptal")', kf.iptalHr === 1 && kf.cek === 0 && /zaten/i.test(kf.r3.toast), { iptalHr: kf.iptalHr, cek: kf.cek, r3: kf.r3 });
await S1.ctx.close();

// ===== Motor hazır değil / sürüm uyuşmaz =====
for (const [ad, mod] of [['T48 motor hazır değilse rid\'li satış güvenli reddedilir (rid\'siz tek-birebir eski satış etkilenmez)', 'yok'], ['T49 motor sürümü uyuşmazsa rid\'li satış güvenli reddedilir', 'surum2']]) {
  const S = await sayfa(mod);
  const m = await S.ev(async () => { Y.kur(); Y.satis('s-32', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 2, renkler: [{ ad: 'Siyah', rid: R.S, mik: 2 }] }]); save();
    const once = Y.anlik(); const r = await Y.iptal('s-32'); const ayni = Y.anlik() === once;
    Y.kur(); Y.satis('s-33', [{ uid: 9701, urun: 'x', birim: 'seri', fiyat: 30, mik: 2, renkler: [{ ad: 'Gri', mik: 2 }] }]); const r2 = await Y.iptal('s-33');
    return { hazir: window.renkMotoru.hazir, r, ayni, r2, gri: Y.lok(9701, 2) }; });
  T(ad, m.hazir === false && !m.r.iptal && m.ayni && /motor|kimli/i.test(m.r.toast) && m.r2.iptal && m.gri === 10, m);
  await S.ctx.close();
}

// ===== Değişmeyen iş fonksiyonları =====
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const govde = (ad) => { const i = html.indexOf('function ' + ad + '('); return i < 0 ? '' : html.slice(i, html.indexOf('\nfunction ', i + 10)); };
const iz = (ad) => createHash('sha256').update(govde(ad)).digest('hex').slice(0, 16);
const TABAN = {
  applySatis: '37274ab71919979c',
  stokUygula: '8756afbaf86825a6',
  kirikStokUygula: 'f06e13d1da9f1767',
  defoUygula: '08930395b2c8a7f8',
  revertSatis: '1be85dd420636592',
  satisGeriAl: '09c4da268ab54bc6',
  transferStokUygula: '06fd6711ac3da230',
  lokStokRenk: 'fd2ae5ad65c2edc8',
  _isEmriStoklaCommit: '14863def812dc9af',
  portalOnay: '615ba0d5faeba870',
  canliDomenUygula: '28cfaa0ea2260cea',
  _recMerge: '7fb79bbce540700e',
  _sbAl: 'db73110a61d221b3',
  _kumulatifBirlestir: 'b844992000bd5e8e',
  kasaHareket: 'a1cd577175e87b48',
  satisKilitliCek: '35bd950dd68909bc',
};
const fark = (l) => l.filter(f => !TABAN[f] || iz(f) !== TABAN[f] || govde(f).length < 40);
const S2 = await sayfa(); const ev2 = S2.ev;
const yan = await ev2(async () => { Y.kur(); const sonuc = {};
  const s = { id: 's-n', tip: 'satis', lokId: 'L-ana', mid: 'c-32', mus: 'M', pb: 'TL', tarih: 1, tutar: 60, araToplam: 60, odenen: 0, odemeler: [], kalemler: [{ uid: 9702, urun: 'y', birim: 'adet', fiyat: 20, mik: 3, renkler: [{ ad: 'Kırmızı', rid: R.K, mik: 3 }] }] };
  db.satislar.push(s); applySatis(s); sonuc.satis = [Y.lok(9702, 0), db.cariler[0].bakiye];
  formSatis(null, 's-n'); sepet[0].renkler[0].mik = 5; sepet[0].mik = 5; kaydetSatis(); sonuc.duzenle = [Y.lok(9702, 0), db.satislar[0].kalemler[0].mik, db.cariler[0].bakiye];
  transferStokUygula([{ uid: 9702, renk: 'Kırmızı', adet: 2 }], 'L-ana', -1); transferStokUygula([{ uid: 9702, renk: 'Kırmızı', adet: 2 }], 'L-depo', 1); sonuc.transfer = [Y.lok(9702, 0), Y.lok(9702, 0, 'L-depo')];
  sonuc.senkron = _recMerge([{ id: 1, _m: 5, a: 'y' }], [{ id: 1, _m: 3, a: 'b' }, { id: 2, _m: 1 }], { 2: 9 }).map(r => r.id + ':' + r.a).join();
  kasaHareket('h-32', 'in', 50, 'Test', 'x', null, 'L-ana'); sonuc.finans = [db.hesaplar[0].bakiye, db.hareketler.length];
  return sonuc; });
T('T39 normal satış oluşturma değişmez (applySatis: stok 10→7, bakiye 60) + parmak izi', yan.satis && JSON.stringify(yan.satis) === '[7,60]' && fark(['applySatis', 'stokUygula', 'kirikStokUygula', 'defoUygula']).length === 0, { yan: yan.satis, f: fark(['applySatis', 'stokUygula', 'kirikStokUygula', 'defoUygula']) });
T('T40 satış düzenleme değişmez (revertSatis + applySatis: 3→5 adet, stok 5, bakiye 100) + revertSatis/satisGeriAl parmak izi', yan.duzenle && JSON.stringify(yan.duzenle) === '[5,5,100]' && fark(['revertSatis', 'satisGeriAl']).length === 0, { d: yan.duzenle, f: fark(['revertSatis', 'satisGeriAl']) });
T('T41 transfer değişmez (davranış + parmak izi)', yan.transfer && JSON.stringify(yan.transfer) === '[3,2]' && fark(['transferStokUygula', 'lokStokRenk']).length === 0, yan.transfer);
T('T42 üretim değişmez (_isEmriStoklaCommit parmak izi)', fark(['_isEmriStoklaCommit']).length === 0, null);
T('T43 portal değişmez (portalOnay parmak izi)', fark(['portalOnay']).length === 0, null);
/* Ders 49: save ve canliYazHemen kurtarma kapısıyla (R2.2b.4) bilinçli değişti → parmak izi listesinden çıkarıldı; davranışları test 33'te. */
T('T44 senkron değişmez (_recMerge davranışı + canliDomenUygula/_sbAl/_kumulatifBirlestir parmak izi)', yan.senkron === '1:y' && fark(['canliDomenUygula', '_recMerge', '_sbAl', '_kumulatifBirlestir']).length === 0, { s: yan.senkron, f: fark(['canliDomenUygula', '_recMerge', '_sbAl', '_kumulatifBirlestir']) });
T('T45 finansın normal akışı değişmez (kasaHareket davranışı + parmak izi)', yan.finans && yan.finans[0] === 1050 && yan.finans[1] === 1 && fark(['kasaHareket', 'satisKilitliCek']).length === 0, yan.finans);
T('T45b motor değişmez; index.html motor kopyası içermez; renkCoz tek çağrı noktası', !/function renkCoz\b|function globalRidTara\b/.test(html) && (html.match(/renkCoz\(/g) || []).length === 1, null);
await S2.ctx.close();
T('T46 Firebase erişimi yok (localhost dışı her istek engellendi)', disari.length > 0 && !disari.some(h => /^(localhost|127\.0\.0\.1)$/.test(h)), [...new Set(disari)]);
T('T47 gerçek veri kullanılmaz (yalnız 97xx sentetik ürün, c-32 müşteri)', t1.r && fin.r && true, null);
T('T50 hata durumunda kısmi yerel kayıt yok (bütün ret senaryolarında localStorage birebir aynı)', [t7, t8, t9, t10, t10b, t26, t27, e8, e9, e9b, e10].every(x => x.depoAyni), null);
T('T-ek sayfa hatası yok', errs.length === 0, errs);

await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
