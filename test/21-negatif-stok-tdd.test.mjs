// TDD: stok transferinde negatif stok engeli (S6, S8). RED aşamasında yazıldı (v171'de 8 FAIL);
// GREEN aşamasında trEkle / transferKaydet düzeltildi ve test normal CI kapsamına alındı.
//
// Sınanan iş kuralları:
//   Kural 1: Eksi stok engellenecek — uyarıda "Yine de" seçilse bile transfer oluşmamalı.
//   Kural 5: Aynı stok kimliğine (ürün + renk) sahip transfer satırları birleşecek; kontrol toplam üzerinden.
//
// Çalıştırma: node test/21-negatif-stok-tdd.test.mjs (CI'da diğer testlerle birlikte koşar).
//
// Testler yalnızca uygulamanın kendi fonksiyonlarını çağırır (transferForm, trUrunSec, trEkle,
// transferKaydet, onay düğmesi); yeni kuralı test içinde taklit etmez. localhost dışı istekler engellenir.
const { chromium } = await import('playwright');
const http = (await import('http')).default; const fs = (await import('fs')).default; const path = (await import('path')).default;
const { fileURLToPath } = await import('url');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  if (req.url.includes('sw.js')) { res.writeHead(404); return res.end(); }
  const p = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };

const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const ctx = await br.newContext();
await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; return (h === 'localhost' || h === '127.0.0.1') ? route.continue() : route.abort(); });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));

// Yardımcılar: yalnızca veri kurulumu ve uygulama fonksiyonlarını çağırma — iş kuralı içermez.
await page.addScriptTag({ content: `
  const TDD = {
    D: 'L-depo', M: 'L-ana',
    kur(urunler) {
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }];
      aktifLok = 'L-ana'; db.pin = null; db.transferler = [];
      db.urunler = db.urunler.filter(u => !(u.id >= 9200 && u.id < 9300));
      const now = Date.now();
      urunler.forEach(u => db.urunler.push({ kod: 'R' + u.id, kat: 'X', birim: 'adet', stok: 0, _m: now - 100000, ...u }));
      stokProjYukle(); save();
    },
    lok(id, L, renk) { const u = urun(id); if (!u) return null;
      if (renk) { const r = renkObjs(u).find(x => x.ad === renk); return r ? (+((r.loklar || {})[L]) || 0) : null; }
      return +((u.loklar || {})[L]) || 0; },
    formAc() { transferForm(); $('tr-from').value = TDD.D; $('tr-to').value = TDD.M; },
    ekle(ad, adetler) { $('tr-urun').value = ad; trUrunSec(); adetler.forEach((a, i) => { $('tra-' + i).value = a; }); trEkle(); },
    satirlar() { return trKalem.map(k => ({ uid: k.uid, renk: k.renk, adet: k.adet })); },
    // Kaydet; uyarı çıkarsa kullanıcı "Yine de" der (yeni kural: yine de oluşmamalı)
    kaydetVeYineDe() {
      const once = (db.transferler || []).length;
      transferKaydet();
      const uyari = $('cov').classList.contains('show'); const msg = uyari ? $('cMsg').textContent : '';
      if (uyari) $('cYes').onclick();
      const yeni = (db.transferler || []).slice(once);
      return { uyari, msg, yeniKayit: yeni.length, kalemler: yeni.length ? yeni[0].kalemler.map(k => ({ renk: k.renk, adet: k.adet })) : [] };
    },
  };
` });
const ev = (fn, a) => page.evaluate(fn, a);
T('altyapı: canlı senkron kapalı', await ev(() => canliAcik === false));

// ===== S6 — aynı stok kimliği iki satır, toplam stoktan fazla =====
const s6 = await ev(() => {
  TDD.kur([{ id: 9201, ad: 'TDD Polo S6', loklar: { 'L-depo': 10, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Polo S6', [8]); TDD.ekle('TDD Polo S6', [8]);
  const satirlar = TDD.satirlar();
  const k = TDD.kaydetVeYineDe();
  return { satirlar, ...k, D: TDD.lok(9201, TDD.D), M: TDD.lok(9201, TDD.M) };
});
console.log(`   S6 gözlenen: satırlar=${JSON.stringify(s6.satirlar)} uyarı=${s6.uyari} yeniKayıt=${s6.yeniKayit} D=${s6.D}`);
T('S6-1 [Kural 5] aynı ürün 8 + 8 → tek satır, 16 adet', s6.satirlar.length === 1 && s6.satirlar[0].adet === 16, s6.satirlar);
T('S6-2 [Kural 1+5] toplam 16 > 10 → transfer kaydı oluşmaz ("Yine de" seçilse bile)', s6.yeniKayit === 0, { yeniKayit: s6.yeniKayit, uyari: s6.uyari });
T('S6-3 [Kural 1] depo stoğu 10 kalır, eksiye düşmez', s6.D === 10, { D: s6.D });

// S6 renkli — aynı renk birleşir ve engellenir
const s6r = await ev(() => {
  TDD.kur([{ id: 9202, ad: 'TDD Renkli S6', renkler: [{ ad: 'Siyah', hex: '#000', stok: 0, loklar: { 'L-depo': 10 } }, { ad: 'Beyaz', hex: '#fff', stok: 0, loklar: { 'L-depo': 10 } }] }]);
  TDD.formAc(); TDD.ekle('TDD Renkli S6', [8, 0]); TDD.ekle('TDD Renkli S6', [8, 0]);
  const satirlar = TDD.satirlar(); const k = TDD.kaydetVeYineDe();
  return { satirlar, ...k, DS: TDD.lok(9202, TDD.D, 'Siyah') };
});
T('S6-4 [Kural 5] renkli: Siyah 8 + Siyah 8 → tek satır 16', s6r.satirlar.length === 1 && s6r.satirlar[0].adet === 16 && s6r.satirlar[0].renk === 'Siyah', s6r.satirlar);
T('S6-5 [Kural 1] renkli: kayıt oluşmaz, Siyah depoda 10 kalır', s6r.yeniKayit === 0 && s6r.DS === 10, { yeniKayit: s6r.yeniKayit, DS: s6r.DS });

// S6 — stok yeterliyse birleşik tek satırla kaydedilir
const s6y = await ev(() => {
  TDD.kur([{ id: 9203, ad: 'TDD Polo S6y', loklar: { 'L-depo': 20, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Polo S6y', [8]); TDD.ekle('TDD Polo S6y', [8]);
  const k = TDD.kaydetVeYineDe();
  return { ...k, D: TDD.lok(9203, TDD.D) };
});
T('S6-6 [Kural 5] stok yeterli (20): kayıt tek kalem 16 adet, D 20→4', s6y.yeniKayit === 1 && s6y.kalemler.length === 1 && s6y.kalemler[0].adet === 16 && s6y.D === 4, s6y);

// ===== S8 — tek satır, stoktan fazla =====
const s8 = await ev(() => {
  TDD.kur([{ id: 9204, ad: 'TDD Polo S8', loklar: { 'L-depo': 5, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Polo S8', [8]);
  const k = TDD.kaydetVeYineDe();
  return { ...k, D: TDD.lok(9204, TDD.D) };
});
console.log(`   S8 gözlenen: uyarı=${s8.uyari} ("${s8.msg.slice(0, 60)}…") yeniKayıt=${s8.yeniKayit} D=${s8.D}`);
T('S8-1 [Kural 1] 8 > 5 → "Yine de" seçilse bile transfer kaydı oluşmaz', s8.yeniKayit === 0, { yeniKayit: s8.yeniKayit, uyari: s8.uyari });
T('S8-2 [Kural 1] depo stoğu 5 kalır', s8.D === 5, { D: s8.D });

// ===== KONTROL — bugün de geçmeli; GREEN değişikliği bunları bozmamalı =====
const k1 = await ev(() => {
  TDD.kur([{ id: 9205, ad: 'TDD Polo K1', loklar: { 'L-depo': 10, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Polo K1', [10]);
  const k = TDD.kaydetVeYineDe(); return { ...k, D: TDD.lok(9205, TDD.D) };
});
T('KONTROL-1 stok tam yeterli (10/10): uyarısız oluşur, D 10→0', k1.yeniKayit === 1 && !k1.uyari && k1.D === 0, k1);
const k2 = await ev(() => {
  TDD.kur([{ id: 9206, ad: 'TDD Renkli K2', renkler: [{ ad: 'Siyah', hex: '#000', stok: 0, loklar: { 'L-depo': 10 } }, { ad: 'Beyaz', hex: '#fff', stok: 0, loklar: { 'L-depo': 10 } }] }]);
  TDD.formAc(); TDD.ekle('TDD Renkli K2', [8, 8]);
  const satirlar = TDD.satirlar(); const k = TDD.kaydetVeYineDe();
  return { satirlar, ...k, DS: TDD.lok(9206, TDD.D, 'Siyah'), DB: TDD.lok(9206, TDD.D, 'Beyaz') };
});
T('KONTROL-2 farklı renkler birleşmez (Siyah 8, Beyaz 8 → 2 satır), stok yeterli → oluşur', k2.satirlar.length === 2 && k2.yeniKayit === 1 && k2.DS === 2 && k2.DB === 2, k2);

// ===== Ders 31: ondalık seri miktarı, sınırlar, stok kimliği, kaynak değişimi, satır silme, geçersiz miktar =====
// Hassasiyet: miktar en fazla 3 ondalık (0.001 seri); 0, negatif, NaN, Infinity ve >3 ondalık geçersiz.
const d1 = await ev(() => {
  TDD.kur([{ id: 9210, ad: 'TDD Ondalik', loklar: { 'L-depo': 0.3, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Ondalik', [0.1]); TDD.ekle('TDD Ondalik', [0.2]);
  const satirlar = TDD.satirlar(); const k = TDD.kaydetVeYineDe();
  return { satirlar, ...k, D: TDD.lok(9210, TDD.D) };
});
console.log(`   D1 gözlenen: satırlar=${JSON.stringify(d1.satirlar)} yeniKayıt=${d1.yeniKayit} kalemler=${JSON.stringify(d1.kalemler)} D=${d1.D}`);
T('D1-1 [ondalık] 0.1 + 0.2 → tek satır, tam 0.3', d1.satirlar.length === 1 && d1.satirlar[0].adet === 0.3, d1.satirlar);
T('D1-2 [ondalık] stok 0.3 sınırında transfer oluşur, depo tam 0', d1.yeniKayit === 1 && d1.D === 0, { yeniKayit: d1.yeniKayit, D: d1.D });
T('D1-3 [ondalık] kaydedilen miktar doğrulanan miktarla aynı (0.3)', d1.kalemler.length === 1 && d1.kalemler[0].adet === 0.3, d1.kalemler);

const d2 = await ev(() => {
  TDD.kur([{ id: 9211, ad: 'TDD Ondalik2', loklar: { 'L-depo': 0.3, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Ondalik2', [0.31]);
  const k = TDD.kaydetVeYineDe(); return { ...k, D: TDD.lok(9211, TDD.D) };
});
T('D2 [ondalık] 0.31 > 0.3 → kayıt yok, depo 0.3 kalır', d2.yeniKayit === 0 && d2.D === 0.3, d2);

const d1b = await ev(() => {
  const dene = (id, stok) => { TDD.kur([{ id, ad: 'TDD Hassas' + id, loklar: { 'L-depo': stok, 'L-ana': 0 } }]); TDD.formAc(); TDD.ekle('TDD Hassas' + id, [0.3]); const k = TDD.kaydetVeYineDe(); return { yeniKayit: k.yeniKayit, D: TDD.lok(id, TDD.D) }; };
  return { gercekAcik: dene(9223, 0.2995), artik: dene(9224, 0.7 - 0.4)   /* = 0.29999999999999993 (kayan nokta artığı) */ };
});
T('D1-4 [hassasiyet] gerçek açık gizlenmez: stok 0.2995 iken 0.3 → kayıt yok, stok değişmez', d1b.gercekAcik.yeniKayit === 0 && d1b.gercekAcik.D === 0.2995, d1b.gercekAcik);
T('D1-5 [hassasiyet] kayan nokta artığı (stok ≈0.29999999999999993) iken 0.3 → oluşur, kalan tam 0', d1b.artik.yeniKayit === 1 && d1b.artik.D === 0, d1b.artik);

const d3 = await ev(() => {
  TDD.kur([{ id: 9212, ad: 'TDD Sinir', loklar: { 'L-depo': 10, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Sinir', [5]); TDD.ekle('TDD Sinir', [5]);
  const satirlar = TDD.satirlar(); const k = TDD.kaydetVeYineDe(); return { satirlar, ...k, D: TDD.lok(9212, TDD.D) };
});
T('D3 [sınır] 5 + 5 = 10 (stok 10): tek satır 10, uyarısız oluşur, D 0', d3.satirlar.length === 1 && d3.satirlar[0].adet === 10 && d3.yeniKayit === 1 && !d3.uyari && d3.D === 0, d3);

const d4 = await ev(() => {
  TDD.kur([{ id: 9213, ad: 'TDD Harf', renkler: [{ ad: 'Siyah', hex: '#000', stok: 0, loklar: { 'L-depo': 10 } }] }]);
  TDD.formAc();
  trSatirEkle(9213, 'TDD Harf', 'siyah', 3);              // küçük harfli satır (uygulama fonksiyonu)
  TDD.ekle('TDD Harf', [4]);                               // ekrandan 'Siyah' 4
  const satirlar = TDD.satirlar(); const k = TDD.kaydetVeYineDe();
  return { satirlar, ...k, DS: TDD.lok(9213, TDD.D, 'Siyah'), renkSayisi: renkObjs(urun(9213)).length };
});
T("D4 [kimlik] 'siyah' 3 + 'Siyah' 4 → tek satır 7, kayıt oluşur, Siyah 10→3, yeni renk açılmaz", d4.satirlar.length === 1 && d4.satirlar[0].adet === 7 && d4.yeniKayit === 1 && d4.DS === 3 && d4.renkSayisi === 1, d4);

const d5 = await ev(() => {
  const degis = (from, to) => { $('tr-from').value = from; $('tr-to').value = to; $('tr-from').dispatchEvent(new Event('change')); };
  // a) depo (5) yetersiz → mağaza (20) seçilince yeterli
  TDD.kur([{ id: 9214, ad: 'TDD Kaynak', loklar: { 'L-depo': 5, 'L-ana': 20 } }]);
  TDD.formAc(); TDD.ekle('TDD Kaynak', [8]);
  const listeOnce = $('tr-liste').innerHTML.includes('kaynakta 5');
  degis('L-ana', 'L-depo');
  const listeSonra = $('tr-liste').innerHTML.includes('kaynakta');
  const ka = TDD.kaydetVeYineDe();
  const a = { listeOnce, listeSonra, ...ka, ana: TDD.lok(9214, 'L-ana'), depo: TDD.lok(9214, 'L-depo') };
  // b) mağaza (20) yeterli → depo (5) seçilince yetersiz
  TDD.kur([{ id: 9215, ad: 'TDD Kaynak2', loklar: { 'L-depo': 5, 'L-ana': 20 } }]);
  transferForm(); $('tr-from').value = 'L-ana'; $('tr-to').value = 'L-depo'; TDD.ekle('TDD Kaynak2', [8]);
  degis('L-depo', 'L-ana');
  const listeKirmizi = $('tr-liste').innerHTML.includes('kaynakta 5');
  const kb = TDD.kaydetVeYineDe();
  return { a, b: { listeKirmizi, ...kb, ana: TDD.lok(9215, 'L-ana'), depo: TDD.lok(9215, 'L-depo') } };
});
T('D5-1 [kaynak] depo 5 yetersiz (listede işaretli) → mağaza seçilince işaret kalkar, kayıt oluşur, mağaza 20→12', d5.a.listeOnce && !d5.a.listeSonra && d5.a.yeniKayit === 1 && d5.a.ana === 12 && d5.a.depo === 5, d5.a);
T('D5-2 [kaynak] mağaza yeterli → depo (5) seçilince listede işaretli, kayıt yok, stoklar değişmez', d5.b.listeKirmizi && d5.b.yeniKayit === 0 && d5.b.ana === 20 && d5.b.depo === 5, d5.b);

const d6 = await ev(() => {
  TDD.kur([{ id: 9216, ad: 'TDD Fazla', loklar: { 'L-depo': 5, 'L-ana': 0 } }, { id: 9217, ad: 'TDD Gecerli', loklar: { 'L-depo': 10, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Fazla', [8]); TDD.ekle('TDD Gecerli', [4]);
  const k1 = TDD.kaydetVeYineDe();
  const sil = [...$('tr-liste').querySelectorAll('.kv')].find(r => r.textContent.includes('TDD Fazla')).querySelector('a');
  sil.click();                                             // ✕ ile fazla satırı sil (uygulamanın kendi düğmesi)
  const satirlar = TDD.satirlar(); const k2 = TDD.kaydetVeYineDe();
  return { k1, satirlar, k2, A: TDD.lok(9216, TDD.D), B: TDD.lok(9217, TDD.D) };
});
T('D6 [silme] fazla satır varken kayıt yok; ✕ ile silinince geçerli satır kaydedilir (A 5, B 10→6)', d6.k1.yeniKayit === 0 && d6.satirlar.length === 1 && d6.k2.yeniKayit === 1 && d6.k2.kalemler.length === 1 && d6.A === 5 && d6.B === 6, d6);

const d7 = await ev(() => {
  TDD.kur([{ id: 9218, ad: 'TDD Renk Yok', renkler: [{ ad: 'Siyah', hex: '#000', stok: 0, loklar: { 'L-depo': 10 } }] }]);
  TDD.formAc(); trSatirEkle(9218, 'TDD Renk Yok', 'Mor', 2);   // kayıtta olmayan renk
  const k = TDD.kaydetVeYineDe();
  return { ...k, renkler: renkObjs(urun(9218)).map(r => r.ad), DS: TDD.lok(9218, TDD.D, 'Siyah') };
});
T('D7 [renk] kayıtta olmayan renk (Mor) → kayıt yok, yeni renk açılmaz, Siyah 10 kalır', d7.yeniKayit === 0 && d7.renkler.length === 1 && d7.DS === 10, d7);

T("D8 [onay] yetersiz stokta kaydetme 'Yine de' penceresi açmaz (S6, S8, D2, D7)", !s6.uyari && !s8.uyari && !d2.uyari && !d7.uyari && await ev(() => _cYes === null), { s6: s6.uyari, s8: s8.uyari, d2: d2.uyari, d7: d7.uyari });

const g1 = await ev(() => {
  TDD.kur([{ id: 9219, ad: 'TDD Gecersiz', loklar: { 'L-depo': 10, 'L-ana': 0 } }]);
  const r = {};
  for (const v of ['0', '-3', '0.0001', '', 'abc']) { TDD.formAc(); TDD.ekle('TDD Gecersiz', [v]); r[v || 'boş'] = trKalem.length; }   // her değer ayrı formda
  return r;
});
T('G1 [geçersiz] ekranda 0, -3, 0.0001 (>3 ondalık), boş, metin → listeye satır eklenmez', Object.values(g1).every(n => n === 0), g1);

const g2 = await ev(() => {
  const r = {};
  for (const [ad, v] of [['Infinity', Infinity], ['-2', -2], ['0', 0], ['NaN', NaN], ['0.0005', 0.0005]]) {
    TDD.kur([{ id: 9220, ad: 'TDD Gecersiz2', loklar: { 'L-depo': 10, 'L-ana': 0 } }]);
    TDD.formAc(); trKalem = [{ uid: 9220, urun: 'TDD Gecersiz2', renk: '', adet: v }];   // ekranı atlayan bozuk liste
    const k = TDD.kaydetVeYineDe(); r[ad] = { yeniKayit: k.yeniKayit, D: TDD.lok(9220, TDD.D) };
  }
  return r;
});
T('G2 [geçersiz] kaydetmede Infinity, -2, 0, NaN, 0.0005 → kayıt yok, depo 10 kalır', Object.values(g2).every(x => x.yeniKayit === 0 && x.D === 10), g2);

const sr = await ev(() => {
  TDD.kur([{ id: 9221, ad: 'TDD Seri', birim: 'seri', seri: 5, loklar: { 'L-depo': 2.5, 'L-ana': 0 } }, { id: 9222, ad: 'TDD Seri2', birim: 'seri', seri: 5, loklar: { 'L-depo': 2.5, 'L-ana': 0 } }]);
  TDD.formAc(); TDD.ekle('TDD Seri', [1.25]); TDD.ekle('TDD Seri', [1.25]); const a = TDD.kaydetVeYineDe();
  TDD.formAc(); TDD.ekle('TDD Seri2', [2.75]); const b = TDD.kaydetVeYineDe();
  return { a: { ...a, D: TDD.lok(9221, TDD.D) }, b: { ...b, D: TDD.lok(9222, TDD.D) } };
});
T('SERİ-1 seri ürün 1.25 + 1.25 = 2.5 seri (stok 2.5) → oluşur, depo 0', sr.a.yeniKayit === 1 && sr.a.kalemler[0].adet === 2.5 && sr.a.D === 0, sr.a);
T('SERİ-2 seri ürün 2.75 > 2.5 seri → kayıt yok, depo 2.5', sr.b.yeniKayit === 0 && sr.b.D === 2.5, sr.b);

T('altyapı: sayfa hatası yok', errs.length === 0, errs);
await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL  (S6/S8 + ondalık/sınır/kimlik/kaynak/silme/geçersiz + KONTROL: hepsi PASS olmalı)`);
process.exit(fail ? 1 : 0);
