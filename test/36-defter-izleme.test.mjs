// Ders 50.3c-1 — ORTAK DEFTER KAYMASI MOTORU (js/defter-izleme.mjs) — gerçek ERP işlem çeşitlerine karşı.
// Uygulama kodu DEĞİŞTİRİLMEZ; motor uygulamada YÜKLENMEZ. Ekran, otomatik kontrol, kalıcı kayıt YOK.
// ORTAM: B ve C bölümlerinde test 34/35 ile aynı SAHTE bellek içi Firestore (gerçek Firebase / emülatör DEĞİL).
// Bölümler:
//   A  saf motor (Node): saflık / yan etkisizlik, kimlik varsayımı yok (aynı kimlik, geç gelen, eski tarihli, sırasız),
//      belirsizlikte SINIFLANDIRILAMADI, maskelenen kayıp, başlangıç koşulları, geçici ↔ tekrarlayan ayrımı, performans
//   B  gerçek uygulama işlemleri (tarayıcı, tek cihaz): K1–K12 + kaymasız normal işlemler. Beklenen kayma motordan değil,
//      işlemin bilinen etkisinden (bağımsız) türetilir; motorun cari devri uygulamanın cariEkstre().devir değeriyle aynı olmalı.
//   C  iki cihaz: senkron sırasında geçici fark → BEKLEMEDE → kendiliğinden düzelir; gerçek etki kaybı → tekrarlayan şüphe
//   D  motor tarayıcıda da aynı sonucu verir ve HİÇBİR ŞEY yazmaz (db, localStorage, IndexedDB, save/bulut çağrısı yok)
//   E  (50.3c-1 son doğrulama) çek / taksit kaydı ya da etkisi senkronda kaybolunca kanıt benzerliğiyle "açıklanan" DENMEZ:
//      saf veride kayıt kaybı (A11) + iki cihazda çaprazlaşan gerçek yazım (E1–E3); B bölümüne satış düzenleme, iade, iade geri alma
// Sentetik veri (9xxx). Sunucu rastgele port, sw.js → 404. Hata → çıkış kodu 1.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { duzenekKur, islem, bekle, GERCEK_FIREBASE } from './yardimci/iki-cihaz-sahte-firestore.mjs';
import * as M from '../js/defter-izleme.mjs';
const { goruntu, karsilastir, tespit, cariDevir, kasaFarki, olcumAyni, tabanUygunMu, izlemeGuncelle, SINIF, UYARI_SINIFLARI, KALICILIK, ESIK, ALT_KUME_SINIRI } = M;

const DEPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.env.IQ_TEST_KOK ? path.resolve(process.env.IQ_TEST_KOK) : DEPO;
let ok = 0, fail = 0, yanlisAlarm = 0, kacan = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 600) : '')); } };
const kopya = (x) => JSON.parse(JSON.stringify(x));
const dondur = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(dondur); } return o; };
const bul = (rs, tur, id) => rs.find(r => r.tur === tur && String(r.id) === String(id));
const uyarilar = (rs) => rs.filter(r => UYARI_SINIFLARI.has(r.sinif));
console.log('ORTAM: A bölümü saf Node; B/C/D SAHTE bellek içi Firestore (gerçek Firebase / emülatör DEĞİL) · kök: ' + (ROOT === DEPO ? 'depo' : ROOT));

// ===================================================================== A. SAF MOTOR =====================================================================
const KAYNAK = fs.readFileSync(path.join(ROOT, 'js/defter-izleme.mjs'), 'utf8');
const kod = KAYNAK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const YASAK = ['localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'firebase', 'document', 'window', 'globalThis', 'self.', 'navigator',
  'Date.now', 'new Date', 'Math.random', 'performance', 'setTimeout', 'setInterval', 'import(', 'require(', 'process', 'caches', 'postMessage', 'save(', 'canliYaz'];
T('A1 [saflık] motor kaynağında depolama/ağ/DOM/Firebase/saat/rastgelelik/uygulama yazma çağrısı YOK', YASAK.every(y => !kod.includes(y)), YASAK.filter(y => kod.includes(y)));
T('A1 [saflık] motor hiçbir modül içe aktarmıyor (bağımsız, tek dosya)', !/^\s*import\s/m.test(kod));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
T('A1 [kapsam] index.html ve sw.js motoru YÜKLEMİYOR (bu aşamada uygulama davranışı değişmedi)', !/defter-izleme/.test(INDEX) && !/defter-izleme/.test(SW));
T('A1 [kapsam] eski test motoru kaldırıldı; test 35 ortak motoru kullanıyor (ikinci hesaplama YOK)', !fs.existsSync(path.join(ROOT, 'test/yardimci/defter-kaymasi.mjs'))
  && /from '\.\.\/js\/defter-izleme\.mjs'/.test(fs.readFileSync(path.join(ROOT, 'test/35-defter-kaymasi.test.mjs'), 'utf8')));

// Sentetik veri (uygulama şeması) ve uygulamanın etkisini taklit eden YALNIZ TEST yardımcıları (A bölümü)
const V = () => ({ kurUSD: 30, kurEUR: 33, _tomb: {},
  cariler: [{ id: 1, ad: 'M1', tip: 'musteri', bakiye: 500 }, { id: 2, ad: 'M2', tip: 'musteri', bakiye: 300 }, { id: 3, ad: 'T1', tip: 'tedarikci', bakiye: 1000 },
    { id: 4, ad: 'F1', tip: 'fason', bakiye: 0 }, { id: 5, ad: 'U1', tip: 'tedarikci', doviz: 'USD', bakiye: 0, bakiyeUSD: 100 }],
  hesaplar: [{ id: 10, ad: 'Kasa', bakiye: 1000 }],
  satislar: [{ id: 100, tip: 'satis', mid: 1, tarih: 1000, tutar: 200, odenen: 0, pb: 'TL', satisKur: 1 },
    { id: 101, tip: 'satis', mid: 2, tarih: 1001, tutar: 10, odenen: 0, pb: 'USD' }, // kur bilgisi olmayan eski dövizli satış
    { id: 102, tip: 'satis', mid: 1, tarih: 1002, tutar: 300, odenen: 300, pb: 'TL', satisKur: 1, odemeHesapId: 10 }, // eski biçim
    { id: 103, tip: 'satis', mid: 1, tarih: 1003, tutar: 300, odenen: 100, pb: 'TL', satisKur: 1, taksitler: [{ tutar: 100, odendi: true }, { tutar: 100 }, { tutar: 100 }] }],
  hareketler: [{ id: 200, cariId: 1, tip: 'tahsilat', tutar: 50, tur: 'Nakit', tarih: 1100, hesapId: 10, yon: 'in' },
    { id: 201, cariId: 1, tip: 'tahsilat', tutar: 100, tur: 'Taksit', tarih: 1101, hesapId: 10, yon: 'in' }],
  cekler: [{ id: 300, tip: 'alinan', cariId: 2, tutar: 80, durum: 'portfoyde', cariIsle: true }],
  isemirleri: [{ id: 400, duraklar: [{ fasonId: 4, borcFasonId: 4, borclanan: 60, ucret: 6, gelen: 10 }] }] });
const cr = (d, id) => d.cariler.find(c => c.id === id), hs = (d, id) => d.hesaplar.find(h => h.id === id);
function tahsil(d, { id, cari = 1, t, tarih = 5000, kayip = false }) { d.hareketler.push({ id, cariId: cari, tip: 'tahsilat', tutar: t, tur: 'Nakit', tarih, hesapId: 10, yon: 'in' });
  if (!kayip) { cr(d, cari).bakiye -= t; hs(d, 10).bakiye += t; } }

// A2 — saflık: dondurulmuş girdi üzerinde her dışa açık fonksiyon çalışır (katı kipte yazma girişimi hata verirdi), girdi değişmez
{ const d0 = V(), d1 = V(); tahsil(d1, { id: 900, t: 25 }); cr(d1, 2).bakiye += 7;
  const j0 = JSON.stringify(d0), j1 = JSON.stringify(d1); dondur(d0); dondur(d1);
  let hata = null, g0, g1, rs;
  try { g0 = goruntu(d0); g1 = goruntu(d1); rs = karsilastir(g0, g1); tespit(g0, d1); cariDevir(d1, 1); kasaFarki(d1, 10); olcumAyni(g0, g1);
    const st = dondur(izlemeGuncelle(null, { zaman: 1, satirlar: rs, senkron: { canli: false } })); izlemeGuncelle(st, dondur({ zaman: 2, satirlar: rs, senkron: { canli: false } }));
    tabanUygunMu(dondur({ kurtarma: 'tamam', admin: true, ardisikOlcumAyni: true })); } catch (e) { hata = String(e && e.message); }
  T('A2 [saflık] dondurulmuş (Object.freeze) girdi ile bütün fonksiyonlar hatasız: hiçbir girdiye yazmıyor', hata === null, hata);
  T('A2 [saflık] veri kontrolden önce ve sonra birebir aynı (JSON)', JSON.stringify(d0) === j0 && JSON.stringify(d1) === j1);
  T('A2 [saflık] aynı girdi → aynı sonuç (deterministik; saat/rastgelelik yok)', JSON.stringify(karsilastir(goruntu(V()), goruntu(kopya(d1)))) === JSON.stringify(rs));
  const g0j = JSON.parse(JSON.stringify(g0)), g1j = JSON.parse(JSON.stringify(g1));
  T('A3 [görüntü] görüntüler JSON\'a çevrilip geri alınınca karşılaştırma aynı (canlı veriye referans yok)', JSON.stringify(karsilastir(g0j, g1j)) === JSON.stringify(rs));
  T('A3 [görüntü] iki görüntü karşılaştırılır: kayıpsız tahsilat KAYMA_YOK, elle +7 ACIKLANAMAYAN (kalıcı depoya yazılmadı)',
    bul(rs, 'cari', 1).sinif === SINIF.KAYMA_YOK && bul(rs, 'kasa', 10).sinif === SINIF.KAYMA_YOK && bul(rs, 'cari', 2).sinif === SINIF.ACIKLANAMAYAN && bul(rs, 'cari', 2).kayma === 7, rs);
  T('A3 [USD] USD cari IZLENMIYOR (uyarı değil)', bul(rs, 'cari', 5).sinif === SINIF.IZLENMIYOR && !UYARI_SINIFLARI.has(SINIF.IZLENMIYOR));
  T('A3 [ölçüm] olcumAyni: aynı veri → true, farklı → false', olcumAyni(goruntu(V()), goruntu(V())) === true && olcumAyni(g0, g1) === false); }

// A4 — kimliklerin sıralı ya da benzersiz olduğu VARSAYILMAZ
{ const s = (fn) => { const d0 = V(), d1 = V(); fn(d1); return karsilastir(goruntu(d0), goruntu(d1)); };
  let r = s(d => tahsil(d, { id: 200, t: 40 })); // mevcut kayıtla AYNI kimlik, etkisi işlenmiş
  T('A4 [aynı kimlik] var olan kimlikle (200) yeni tahsilat, etkisiyle → KAYMA_YOK (iki kayıt da sayılır, cariEkstre gibi)', bul(r, 'cari', 1).sinif === SINIF.KAYMA_YOK && bul(r, 'kasa', 10).sinif === SINIF.KAYMA_YOK, r);
  r = s(d => tahsil(d, { id: 200, t: 40, kayip: true }));
  T('A4 [aynı kimlik] aynı kimlikli yeni tahsilatın etkisi kayıp → yine de aday bulunur: OLASI_ETKI_KAYBI (+40, kanıt H200; kesin değil)',
    bul(r, 'cari', 1).sinif === SINIF.OLASI_ETKI_KAYBI && bul(r, 'cari', 1).kayma === 40 && bul(r, 'cari', 1).kanit.some(k => k.includes('H200')) && bul(r, 'cari', 1).kanit.some(k => k.includes('kesin değil'))
    && bul(r, 'kasa', 10).sinif === SINIF.OLASI_ETKI_KAYBI && bul(r, 'kasa', 10).kayma === -40, r);
  r = s(d => tahsil(d, { id: 5, t: 60, tarih: 10 }));
  T('A4 [geç gelen] eski kimlikli (5) ve eski tarihli (10) kayıt sonradan, etkisiyle gelir → KAYMA_YOK', bul(r, 'cari', 1).sinif === SINIF.KAYMA_YOK, r);
  r = s(d => tahsil(d, { id: 5, t: 60, tarih: 10, kayip: true }));
  T('A4 [geç gelen] eski kimlikli, eski tarihli kaydın etkisi kayıp → kimlik/tarih sınırına bakılmadan aday: OLASI_ETKI_KAYBI (H5)', bul(r, 'cari', 1).sinif === SINIF.OLASI_ETKI_KAYBI && bul(r, 'cari', 1).kanit.some(k => k.includes('H5')), r);
  r = s(d => { tahsil(d, { id: 'z-9', t: 15, tarih: 99999 }); tahsil(d, { id: 'a-1', t: 35, tarih: 3, kayip: true }); });
  T('A4 [sırasız kimlik] metin ve sırasız kimlikler: kayıplı olan (a-1, 35) aday olarak bulunur', bul(r, 'cari', 1).sinif === SINIF.OLASI_ETKI_KAYBI && bul(r, 'cari', 1).kayma === 35 && bul(r, 'cari', 1).kanit.some(k => k.includes('Ha-1')), r);
  { const d0 = V(), d1 = V(); d1.hareketler.push({ id: 777, cariId: 1, tip: 'tahsilat', tutar: 30, tur: 'Nakit', tarih: 6000, hesapId: 10, yon: 'in' }); cr(d1, 1).bakiye -= 100; hs(d1, 10).bakiye += 100; // iki cihaz 777'yi üretti (30 ve 70), birleşimde 70 ezildi
    r = karsilastir(goruntu(d0), goruntu(d1));
    T('A4 [kimlik çakışması] aynı kimlikli iki kayıttan biri ezildi (kalan 30, kayıp 70) → ACIKLANAMAYAN (−70 için eşleşme uydurulmaz)', bul(r, 'cari', 1).sinif === SINIF.ACIKLANAMAYAN && bul(r, 'cari', 1).kayma === -70 && bul(r, 'kasa', 10).sinif === SINIF.ACIKLANAMAYAN, r); }
  { const d0 = V(), d1 = V(); d1.cariler.push({ id: '2', ad: 'M2 kopya', tip: 'musteri', bakiye: 0 }); r = karsilastir(goruntu(d0), goruntu(d1));
    T('A4 [çift cari] aynı kimlikli iki cari (2 ve "2") → SINIFLANDIRILAMADI (hangisinin ölçüldüğü belirsiz)', bul(r, 'cari', 2).sinif === SINIF.SINIFLANDIRILAMADI, r); }
  { const d0 = V(), d1 = V(); cr(d1, 2).bakiye = 'abc'; r = karsilastir(goruntu(d0), goruntu(d1));
    T('A4 [geçersiz] sayısal olmayan bakiye → SINIFLANDIRILAMADI (sayı uydurulmaz)', bul(r, 'cari', 2).sinif === SINIF.SINIFLANDIRILAMADI && bul(r, 'cari', 2).kanit.length > 0, r); }
  { const d0 = V(), d1 = V(); d1.kurUSD = undefined; r = karsilastir(goruntu(d0), goruntu(d1));
    T('A4 [geçersiz] kur bilgisi olmayan dövizli satış + kur yok → SINIFLANDIRILAMADI', bul(r, 'cari', 2).sinif === SINIF.SINIFLANDIRILAMADI, r); }
  { const d0 = V(), d1 = V(); d1.cariler = d1.cariler.filter(c => c.id !== 2); r = karsilastir(goruntu(d0), goruntu(d1));
    const d2 = V(); d2.cariler = d2.cariler.filter(c => c.id !== 2); d2._tomb = { cariler: { 2: 1 } }; const r2 = karsilastir(goruntu(d0), goruntu(d2));
    T('A4 [kayıp kayıt] cari silme izi olmadan kayboldu → SINIFLANDIRILAMADI; silme izi varsa IZLENMIYOR', bul(r, 'cari', 2).sinif === SINIF.SINIFLANDIRILAMADI && bul(r2, 'cari', 2).sinif === SINIF.IZLENMIYOR, [r, r2]); } }

// A5 — çok aday: tam arama sınırlı; eşleşme yoksa SINIFLANDIRILAMADI (yanlış kesinlik yok)
{ const d0 = V(), d1 = V(), d2 = V();
  for (let i = 0; i < 20; i++) { tahsil(d1, { id: 1000 + i, t: 10 + i * 3 }); tahsil(d2, { id: 1000 + i, t: 10 + i * 3, kayip: i === 7 }); }
  cr(d1, 1).bakiye += 1000.77;
  const r1 = karsilastir(goruntu(d0), goruntu(d1)), r2 = karsilastir(goruntu(d0), goruntu(d2));
  T(`A5 [çok aday] ${20} aday (> ${ALT_KUME_SINIRI}), tekli/ikili eşleşme yok → SINIFLANDIRILAMADI (ACIKLANAMAYAN da OLASI da denmez)`, bul(r1, 'cari', 1).sinif === SINIF.SINIFLANDIRILAMADI && bul(r1, 'cari', 1).kanit.some(k => k.includes('sınıflandırılamadı')), bul(r1, 'cari', 1));
  T('A5 [çok aday] 20 aday arasında tekli eşleşme (31) → OLASI_ETKI_KAYBI, aday sayısıyla', bul(r2, 'cari', 1).sinif === SINIF.OLASI_ETKI_KAYBI && bul(r2, 'cari', 1).kanit.some(k => k.includes('aday olay sayısı 20')), bul(r2, 'cari', 1)); }

// A6 — maskeleme: bilinen kayıt dışı değişiklik (çek −200) ile aynı tutarda etki kaybı (+200) toplamda 0 kayma verir; motor yine görür
{ const d0 = V(), d1 = V(); d1.cekler.push({ id: 301, tip: 'alinan', cariId: 1, tutar: 200, durum: 'portfoyde', cariIsle: true, kurTakip: false }); cr(d1, 1).bakiye -= 200; tahsil(d1, { id: 950, t: 200, kayip: true });
  const r = karsilastir(goruntu(d0), goruntu(d1)), x = bul(r, 'cari', 1);
  T('A6 [maskeleme] toplam kayma 0 ama çek −200 + kalan +200 → OLASI_ETKI_KAYBI (KAYMA_YOK denmez)', x.kayma === 0 && x.bilesen.cek === -200 && x.kalan === 200 && x.sinif === SINIF.OLASI_ETKI_KAYBI, x); }

// A7 — çek kanıtı: silme izi var / yok
{ const d0 = V();
  const d1 = V(); d1.cekler = []; cr(d1, 2).bakiye += 80; d1._tomb = { cekler: { 300: 1 } };
  const d2 = V(); d2.cekler = [];
  const d3 = V(); d3.cekler = []; cr(d3, 2).bakiye += 80;
  const [r1, r2, r3] = [d1, d2, d3].map(d => bul(karsilastir(goruntu(d0), goruntu(d)), 'cari', 2));
  T('A7 [çek] silme izli çek silme (bakiye +80) → ACIKLANAN', r1.sinif === SINIF.ACIKLANAN && r1.kayma === 80 && r1.kanit.some(k => k.includes('silme izi var')), r1);
  T('A7 [çek] çek kaydı izsiz kayboldu, bakiye değişmedi → SINIFLANDIRILAMADI (kanıt eksik)', r2.sinif === SINIF.SINIFLANDIRILAMADI, r2);
  T('A7 [çek] çek izsiz kayboldu, bakiye +80 → tutar tutsa da SINIFLANDIRILAMADI (eksik kanıtla ACIKLANAN denmez)', r3.sinif === SINIF.SINIFLANDIRILAMADI && r3.kalan === 0, r3);
  const d4 = V(); d4.cekler.push({ id: 300, tip: 'alinan', cariId: 2, tutar: 50, durum: 'portfoyde', cariIsle: true }); cr(d4, 2).bakiye -= 50;
  const r4 = bul(karsilastir(goruntu(d0), goruntu(d4)), 'cari', 2);
  T('A7 [çek] aynı kimlikli iki çek → çek kanıtı belirsiz: SINIFLANDIRILAMADI', r4.sinif === SINIF.SINIFLANDIRILAMADI, r4); }

// A8 — başlangıç görüntüsü koşulları
{ const iyi = { kurtarma: 'tamam', ornek: false, musteriMod: false, admin: true, personelMod: false, canli: true, domenler: ['cari', 'kasa'], domenAlindi: { cari: true, kasa: true },
    bekleyenYazim: false, sonBirlesim: 1000, zaman: 1000 + 61000, ardisikOlcumAyni: true };
  T('A8 [taban] bütün koşullar sağlanınca taban alınabilir', tabanUygunMu(iyi).uygun === true, tabanUygunMu(iyi));
  const bozuk = { 'kurtarma kilidi': { kurtarma: 'bekliyor' }, 'örnek veri': { ornek: true }, 'müşteri modu': { musteriMod: true }, 'yönetici değil': { admin: false },
    'personel modu': { personelMod: true }, 'ilk senkron öncesi': { domenAlindi: { cari: true } }, 'gönderilmemiş değişiklik': { bekleyenYazim: true },
    'yeni birleşim': { zaman: 1000 + 5000 }, 'ölçüm oturmamış': { ardisikOlcumAyni: false } };
  for (const [ad, deg] of Object.entries(bozuk)) { const r = tabanUygunMu({ ...iyi, ...deg }); T(`A8 [taban] ${ad} → taban ALINMAZ (neden bildirilir)`, r.uygun === false && r.nedenler.length === 1, r); }
  T('A8 [taban] boş/eksik bilgi → taban alınmaz (varsayılan güvenli)', tabanUygunMu(undefined).uygun === false && tabanUygunMu({}).uygun === false); }

// A9 — geçici fark ile tekrarlanan şüpheli fark; yalnız zamanın geçmesi yetmez; "kesin kayıp" yok
{ const sat = (kayma, sinif = SINIF.OLASI_ETKI_KAYBI) => [{ tur: 'cari', id: 1, kayma, sinif }, { tur: 'cari', id: 2, kayma: 0, sinif: SINIF.KAYMA_YOK }];
  const DK = 60000, guncel = { cari: true, kasa: true, satis: true }, sakin = (z) => ({ canli: true, bekleyenYazim: false, sonBirlesim: z - 5 * DK, domenGuncel: guncel });
  let s1 = izlemeGuncelle(null, { zaman: 0, satirlar: sat(100), senkron: sakin(0) });
  T('A9 [izleme] ilk görülme → BEKLEMEDE', s1.kayitlar['cari#1'].kalicilik === KALICILIK.BEKLEMEDE && !s1.kayitlar['cari#2'], s1);
  let s2 = izlemeGuncelle(s1, { zaman: 3 * DK, satirlar: sat(100), senkron: sakin(3 * DK) });
  T('A9 [izleme] 2. görülme ama 10 dk dolmadı → BEKLEMEDE', s2.kayitlar['cari#1'].kalicilik === KALICILIK.BEKLEMEDE && s2.kayitlar['cari#1'].sayi === 2, s2);
  const sb = izlemeGuncelle(s1, { zaman: 11 * DK, satirlar: sat(100), senkron: { ...sakin(11 * DK), domenGuncel: { ...guncel, satis: false } } });
  T('A9 [izleme] 11 dk geçti ama bir domen güncel değil → BEKLEMEDE (yalnız zaman yetmez)', sb.kayitlar['cari#1'].kalicilik === KALICILIK.BEKLEMEDE && sb.kayitlar['cari#1'].bekleyenNedenler.some(n => n.includes('domen')), sb);
  const sy = izlemeGuncelle(s1, { zaman: 11 * DK, satirlar: sat(100), senkron: { ...sakin(11 * DK), bekleyenYazim: true } });
  T('A9 [izleme] 11 dk geçti ama gönderilmemiş yazım var → BEKLEMEDE', sy.kayitlar['cari#1'].kalicilik === KALICILIK.BEKLEMEDE, sy);
  const sz = izlemeGuncelle(s1, { zaman: 11 * DK, satirlar: sat(100), senkron: { ...sakin(11 * DK), sonBirlesim: 11 * DK - 1000 } });
  T('A9 [izleme] 11 dk geçti ama birleşim 1 sn önce oldu → BEKLEMEDE', sz.kayitlar['cari#1'].kalicilik === KALICILIK.BEKLEMEDE, sz);
  const sbos = izlemeGuncelle(s1, { zaman: 11 * DK, satirlar: sat(100), senkron: { canli: true, sonBirlesim: 0 } });
  T('A9 [izleme] senkron bilgisi yok → BEKLEMEDE (bilinmeyen durumda yükseltilmez)', sbos.kayitlar['cari#1'].kalicilik === KALICILIK.BEKLEMEDE, sbos);
  const s3 = izlemeGuncelle(s2, { zaman: 11 * DK, satirlar: sat(100), senkron: sakin(11 * DK) });
  T('A9 [izleme] ≥2 kontrol, ≥10 dk, bütün domenler güncel, senkron sakin → TEKRARLAYAN_SUPHE', s3.kayitlar['cari#1'].kalicilik === KALICILIK.TEKRARLAYAN_SUPHE && s3.kayitlar['cari#1'].sayi === 3, s3);
  const s4 = izlemeGuncelle(s3, { zaman: 12 * DK, satirlar: sat(130), senkron: sakin(12 * DK) });
  T('A9 [izleme] kayma değişti (100 → 130) → yeni gözlem: BEKLEMEDE, sayaç 1', s4.kayitlar['cari#1'].kalicilik === KALICILIK.BEKLEMEDE && s4.kayitlar['cari#1'].sayi === 1, s4);
  const s5 = izlemeGuncelle(s2, { zaman: 4 * DK, satirlar: sat(0, SINIF.KAYMA_YOK), senkron: sakin(4 * DK) });
  T('A9 [izleme] fark kayboldu → kapanan: KENDILIGINDEN_DUZELDI (geçici idi)', !s5.kayitlar['cari#1'] && s5.kapanan.length === 1 && s5.kapanan[0].sonuc === 'KENDILIGINDEN_DUZELDI', s5);
  const s6 = izlemeGuncelle(s2, { zaman: 4 * DK, satirlar: sat(100, SINIF.ACIKLANAN), senkron: sakin(4 * DK) });
  T('A9 [izleme] kanıt sonradan geldi → kapanan: SONRADAN_ACIKLANDI', s6.kapanan.length === 1 && s6.kapanan[0].sonuc === 'SONRADAN_ACIKLANDI', s6);
  T('A9 [izleme] hiçbir çıktıda "kesin" karar yok', ![s1, s2, s3, s4, s5, s6, sb, sy, sz].some(s => /KESIN|kesin kay/i.test(JSON.stringify(s))));
  T('A9 [izleme] önceki durum değiştirilmedi (saf)', s1.kayitlar['cari#1'].sayi === 1 && s2.kayitlar['cari#1'].kalicilik === KALICILIK.BEKLEMEDE); }

// A10 — performans: tek geçiş (cari × kayıt değil). 1.000 cari × 20.000 hareket + 5.000 satış + 500 çek + 200 iş emri
function buyuk(nC, nH, nS) { let x = 12345; const rnd = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
  const d = { kurUSD: 30, kurEUR: 33, _tomb: {}, cariler: [], hesaplar: [], satislar: [], hareketler: [], cekler: [], isemirleri: [] };
  for (let i = 0; i < nC; i++) d.cariler.push({ id: 10000 + i, ad: 'C' + i, tip: i % 10 === 0 ? 'tedarikci' : 'musteri', bakiye: Math.round(rnd() * 10000) });
  for (let i = 0; i < 20; i++) d.hesaplar.push({ id: 500 + i, ad: 'K' + i, bakiye: 100000 });
  for (let i = 0; i < nS; i++) d.satislar.push({ id: 'S' + (nS - i), tip: 'satis', mid: 10000 + Math.floor(rnd() * nC), tarih: Math.floor(rnd() * 1e9), tutar: 100 + Math.round(rnd() * 900), odenen: Math.round(rnd() * 100), pb: rnd() < 0.05 ? 'USD' : 'TL', satisKur: rnd() < 0.5 ? 1 : undefined, kesik: 0, taksitler: rnd() < 0.1 ? [{ tutar: 10, odendi: true }] : [] });
  for (let i = 0; i < nH; i++) d.hareketler.push({ id: Math.floor(rnd() * nH * 2), cariId: rnd() < 0.8 ? 10000 + Math.floor(rnd() * nC) : null, tip: rnd() < 0.5 ? 'tahsilat' : 'odeme', tutar: Math.round(rnd() * 500), tur: 'Nakit', tarih: Math.floor(rnd() * 1e9), hesapId: 500 + Math.floor(rnd() * 20), yon: rnd() < 0.5 ? 'in' : 'out' });
  for (let i = 0; i < 500; i++) d.cekler.push({ id: 70000 + i, tip: 'alinan', cariId: 10000 + Math.floor(rnd() * nC), tutar: 1000, durum: 'portfoyde', cariIsle: rnd() < 0.5 });
  for (let i = 0; i < 200; i++) d.isemirleri.push({ id: i, duraklar: [{ fasonId: 10000 + Math.floor(rnd() * nC), borclanan: 50 }] });
  return d; }
function olc(d0, d1) { const t0 = performance.now(); const g0 = goruntu(d0), g1 = goruntu(d1); const rs = karsilastir(g0, g1); return { ms: performance.now() - t0, rs }; }
{ const d0 = buyuk(1000, 20000, 5000), d1 = kopya(d0);
  for (let i = 0; i < 50; i++) { const c = d1.cariler[i * 7]; const kayip = i % 10 === 0; d1.hareketler.push({ id: 'yeni' + i, cariId: c.id, tip: 'tahsilat', tutar: 77, tur: 'Nakit', tarih: 5, hesapId: 500, yon: 'in' }); if (!kayip) c.bakiye -= c.tip === 'musteri' ? 77 : -77; }
  olc(d0, d1); // ısınma
  const m = [olc(d0, d1), olc(d0, d1), olc(d0, d1)].map(x => x.ms).sort((a, b) => a - b), ms = m[1];
  const d2 = buyuk(2000, 40000, 10000), ms2 = [olc(d2, d2), olc(d2, d2), olc(d2, d2)].map(x => x.ms).sort((a, b) => a - b)[1];
  const rs = olc(d0, d1).rs, kay = rs.filter(r => r.tur === 'cari' && r.sinif !== SINIF.KAYMA_YOK);
  console.log(`PERF 1.000 cari × 20.000 hareket + 5.000 satış (2 görüntü + karşılaştırma) ortanca ${ms.toFixed(1)} ms · 2× veri ${ms2.toFixed(1)} ms · oran ${(ms2 / ms).toFixed(2)}`);
  T(`A10 [performans] 1.000 cari × 20.000 hareket: 2 görüntü + karşılaştırma < 1500 ms (ölçülen ${ms.toFixed(0)} ms)`, ms < 1500, m);
  T(`A10 [performans] veri 2 katına çıkınca süre en çok ~4 kat (tek geçiş; cari × kayıt değil) — oran ${(ms2 / ms).toFixed(2)}`, ms2 / ms < 4, { ms, ms2 });
  T('A10 [performans] büyük veride 5 kayıp OLASI_ETKI_KAYBI, kayıpsız 45 işlem KAYMA_YOK (yanlış alarm 0)', kay.length === 5 && kay.every(r => r.sinif === SINIF.OLASI_ETKI_KAYBI), kay.map(r => [r.id, r.sinif, r.kayma])); }

// A11 — çek / taksit KAYDI kayboldu: kanıt benzerliğiyle "açıklanan" DENMEZ; ayırt edilemiyorsa SINIFLANDIRILAMADI
{ const d0 = V(), s103 = (d) => d.satislar.find(x => x.id === 103);
  const a = V(); { const x = s103(a); x.taksitler[1].odendi = true; x.odenen += 100; cr(a, 1).bakiye -= 100; hs(a, 10).bakiye += 100; } // taksit tahsili, "Taksit" hareketi KAYBOLDU
  const b = V(); { const x = s103(b); x.taksitler[0].odendi = false; x.odenen = 0; } // satış belgesi eski haliyle yazıldı: ödenmiş taksit ve ödenen geri gitti (bakiye + hareket duruyor)
  const c = V(); s103(c).taksitler = []; // meşru: plan kaldırıldı (ödenen aynı)
  const e = V(); e.satislar = e.satislar.filter(x => x.id !== 103); // taksitli satış kaydı kayboldu
  const f = V(); f.cekler.push({ id: 302, tur: 'cek', tip: 'alinan', cariId: 1, tutar: 120, durum: 'portfoyde', cariIsle: true, hesapId: 10 }); cr(f, 1).bakiye -= 120; // çekle tahsilat: hareket KAYBOLDU
  const g = V(); g.hareketler.push({ id: 960, cariId: 1, tip: 'tahsilat', tutar: 120, kesik: 0, tur: 'Çek', tarih: 7000, hesapId: null, yon: null }); cr(g, 1).bakiye -= 120; // çekle tahsilat: çek KAYBOLDU
  const h = V(); h.cekler.push({ id: 302, tur: 'cek', tip: 'alinan', cariId: 1, tutar: 120, durum: 'portfoyde', cariIsle: true, hesapId: 10 }); cr(h, 1).bakiye -= 120;
  h.hareketler.push({ id: 960, cariId: 1, tip: 'tahsilat', tutar: 120, kesik: 0, tur: 'Çek', tarih: 7000, hesapId: null, yon: null }); // çekle tahsilat, eksiksiz
  const k = V(); k.cekler.push({ id: 302, tur: 'cek', tip: 'alinan', cariId: 1, tutar: 120, durum: 'portfoyde', cariIsle: true, kurTakip: false }); cr(k, 1).bakiye -= 120; // elle çek (Çek formu)
  const d0b = V(); d0b.cekler.push({ id: 302, tur: 'cek', tip: 'alinan', cariId: 1, tutar: 120, durum: 'portfoyde', cariIsle: true, hesapId: 10 }); cr(d0b, 1).bakiye -= 120;
  d0b.hareketler.push({ id: 960, cariId: 1, tip: 'tahsilat', tutar: 120, kesik: 0, tur: 'Çek', tarih: 7000, hesapId: null, yon: null });
  const m = kopya(d0b); m.hareketler = m.hareketler.filter(x => x.id !== 960); // önceden var olan çekle tahsilatın hareketi sonradan kayboldu
  const r = (x, y = d0) => bul(karsilastir(goruntu(y), goruntu(x)), 'cari', 1), rk = (x) => bul(karsilastir(goruntu(d0), goruntu(x)), 'kasa', 10);
  const ra = r(a), rb = r(b), rc = r(c), re = r(e), rf = r(f), rg = r(g), rh = r(h), rkk = r(k), rm = r(m, d0b);
  T('A11 [taksit] "Taksit" hareketi kayboldu (ödenmiş taksit arttı, bakiye düştü) → ACIKLANAN DEĞİL, uyarı; kasa da uyarı', ra.sinif !== SINIF.ACIKLANAN && UYARI_SINIFLARI.has(ra.sinif) && UYARI_SINIFLARI.has(rk(a).sinif), [ra, rk(a)]);
  T('A11 [taksit] ödenmiş taksit ve ödenen birlikte geri gitti (kayma 0) → SINIFLANDIRILAMADI (KAYMA_YOK denmez)', rb.kayma === 0 && rb.sinif === SINIF.SINIFLANDIRILAMADI, rb);
  T('A11 [taksit] meşru plan kaldırma (ödenen aynı) → ACIKLANAN +100', rc.sinif === SINIF.ACIKLANAN && rc.kayma === 100, rc);
  T('A11 [taksit] ödenmiş taksitli satış kaydı kayboldu → SINIFLANDIRILAMADI', re.sinif === SINIF.SINIFLANDIRILAMADI, re);
  T('A11 [çek] çekle tahsilat: hareket kayboldu (çek ve bakiye duruyor) → elle çek sanılmaz: SINIFLANDIRILAMADI', rf.sinif === SINIF.SINIFLANDIRILAMADI && rf.kanit.some(x => x.includes('karşılığı')), rf);
  T('A11 [çek] çekle tahsilat: çek kaydı kayboldu (hareket ve bakiye duruyor) → SINIFLANDIRILAMADI', rg.sinif === SINIF.SINIFLANDIRILAMADI && rg.kanit.some(x => x.includes('eşleşen yeni çek yok')), rg);
  T('A11 [çek] çekle tahsilat eksiksiz (çek + hareket + bakiye) → KAYMA_YOK', rh.sinif === SINIF.KAYMA_YOK, rh);
  T('A11 [çek] elle çek (Çek formu, kurTakip alanı) → ACIKLANAN −120', rkk.sinif === SINIF.ACIKLANAN && rkk.kayma === -120, rkk);
  T('A11 [çek] önceden var olan çekle tahsilatın hareketi sonradan kayboldu → SINIFLANDIRILAMADI (ACIKLANAN değil)', rm.sinif === SINIF.SINIFLANDIRILAMADI && rm.kayma === -120, rm); }

// ===================================================================== B. GERÇEK UYGULAMA İŞLEMLERİ =====================================================================
const D = await duzenekKur(ROOT);
const HAZIRLIK = () => { // ortak sentetik ek kayıtlar (tabandan ÖNCE): tedarikçi, fason, USD tedarikçi, banka, iş emri
  const z = Date.now();
  db.cariler.push({ id: 9003, ad: 'Sentetik Tedarikçi T', tip: 'tedarikci', tel: '05000000013', bakiye: 1000, doviz: 'TL', _m: z },
    { id: 9004, ad: 'Sentetik Fason F', tip: 'fason', tel: '05000000014', bakiye: 0, doviz: 'TL', _m: z },
    { id: 9005, ad: 'Sentetik USD Tedarikçi', tip: 'tedarikci', tel: '05000000015', bakiye: 0, bakiyeUSD: 100, doviz: 'USD', _m: z });
  db.hesaplar.push({ id: 9102, ad: 'Sentetik Banka', tur: 'banka', lokId: 'L-ana', bakiye: 5000, _m: z });
  db.isemirleri.push({ id: 9401, urunId: 9201, urun: 'Sentetik Ürün', kod: 'SNT35', birim: 'adet', seriAdet: 1, hedef: 20, renkDagilim: [{ ad: 'Siyah', adet: 20 }], malzeme: [],
    duraklar: [{ ad: 'Dikim', fasonId: 9004, ucret: 10, gonderilen: 20, gelen: 10, defolu: 0, gonderilenRenk: { Siyah: 20 }, renkGelen: { Siyah: 10 }, renkDefo: {}, durum: 'devam', borclandi: false, borclanan: 0, baslama: z }],
    durum: 'devam', baslangic: z, gun: 10, _m: z });
  save(); };
// Sayfa içi yardımcılar (gerçek uygulama fonksiyonlarını çağırır)
const sayfa = {
  onayEvet: async (C) => { await C.page.waitForFunction(() => $('cov').classList.contains('show'), null, { timeout: 5000 }); await C.page.evaluate(() => $('cYes').click()); await bekle(80); },
  onayKapat: async (C) => { await bekle(450); await C.page.evaluate(() => { if ($('cov').classList.contains('show')) $('cNo').click(); }); },
  kritik: async (C) => { await C.page.waitForFunction(() => !!$('kk-txt'), null, { timeout: 5000 }); await C.page.evaluate(async () => { $('kk-txt').value = 'SİL'; await kritikOnayla(); }); await bekle(80); },
  tahsilat: async (C, cid, t, tur = 'Nakit', hesap = 9101) => { await C.page.evaluate(([cid, t, tur, hesap]) => { formOdeme(cid); $('o-t').value = String(t); $('o-tur').value = tur; $('o-hesap').value = String(hesap); kaydetOdeme(cid); }, [cid, t, tur, hesap]); await sayfa.onayKapat(C); },
  sonCek: (C) => C.page.evaluate(() => db.cekler[db.cekler.length - 1].id),
  satisTutar: (C, cid, tutar, ek = {}) => C.page.evaluate(([cid, tutar, ek]) => { const u = urun(9201), m = cari(cid);
    const s = { id: nid('s'), tip: 'satis', lokId: aktifLok, mid: m.id, mus: m.ad, tarih: Date.now(), kalemler: [{ uid: u.id, urun: u.ad, mik: 1, birim: 'adet', fiyat: tutar, renkler: [{ ad: 'Siyah', mik: 1, rid: u.renkler[0].rid }] }],
      araToplam: tutar, iskonto: 0, tutar, odenen: 0, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [], durum: 'tamam', teslimDurum: 'teslim', ...ek };
    if (ek.satisKur === null) delete s.satisKur; db.satislar.push(s); applySatis(s); save(); return s.id; }, [cid, tutar, ek]),
  planKur: (C, sid, n) => C.page.evaluate(([sid, n]) => { odemePlaniAc(sid); $('op-n').value = String(n); odemePlaniKaydet(sid); }, [sid, n]),
  taksitTahsil: (C, sid, idx) => C.page.evaluate(([sid, idx]) => { taksitOde(sid, idx); $('tk-hs').value = '9101'; taksitOdeKaydet(sid, idx); }, [sid, idx]),
  kur: (C, usd) => C.page.evaluate((usd) => { formKur(); $('k-usd').value = String(usd); kaydetKur(); }, usd),
};
const KARI = [9001, 9002, 9003, 9004, 9005], KASA = [9101, 9102];
const SONUC = {};
async function senaryo({ kod, ad, hazirla, adimlar, beklenen = {} }) {
  const B = D.bulutKur(); const A = await D.cihazAc(B, 'A', 11); const ctx = {};
  let hata = null;
  try { await A.page.evaluate(HAZIRLIK); if (hazirla) await hazirla(A, ctx); await bekle(100); } catch (e) { hata = 'hazırlık: ' + String(e.message).slice(0, 200); }
  const d0 = await D.cihazVeri(A), g0 = goruntu(d0);
  if (!hata) try { await adimlar(A, ctx); await bekle(150); } catch (e) { hata = 'adımlar: ' + String(e.message).slice(0, 200); }
  const d1 = await D.cihazVeri(A), rs = karsilastir(g0, goruntu(d1));
  T(`${kod} [altyapı] hazırlık ve işlem hatasız, sayfa hatası yok`, !hata && A.hatalar.length === 0, { hata, sayfa: A.hatalar.slice(0, 3) });
  const uyg = await A.page.evaluate(() => db.cariler.map(c => [c.id, Math.round(cariEkstre(c.id).devir * 100) / 100]));
  T(`${kod} [ölçüm] motorun cari devri = uygulamanın cariEkstre().devir (${uyg.length} cari)`, uyg.every(([id, dv]) => Math.abs(cariDevir(d1, id) - dv) < ESIK), uyg);
  for (const [tur, ids] of [['cari', KARI], ['kasa', KASA]]) for (const id of ids) {
    const x = bul(rs, tur, id), b = beklenen[`${tur}#${id}`] || (id === 9005 ? { kayma: 0, sinif: SINIF.IZLENMIYOR } : { kayma: 0, sinif: SINIF.KAYMA_YOK });
    const ka = typeof b.kayma === 'function' ? b.kayma(ctx) : b.kayma;
    if (x && UYARI_SINIFLARI.has(x.sinif) && !UYARI_SINIFLARI.has(b.sinif)) yanlisAlarm++;
    if (x && !UYARI_SINIFLARI.has(x.sinif) && UYARI_SINIFLARI.has(b.sinif)) kacan++;
    console.log(`RAPOR ${kod} ${tur}#${id} başlangıç=${x && x.baslangic} son=${x && x.son} beklenenKayma=${ka} ölçülenKayma=${x && x.kayma} açıklanan=${x && x.aciklanan} sınıf=${x && x.sinif} (beklenen ${b.sinif})${x && x.kanit.length ? ' kanıt=' + JSON.stringify(x.kanit) : ''}`);
    T(`${kod} [tespit] ${tur}#${id}: kayma = ${ka} ve sınıf = ${b.sinif}`, !!x && x.sinif === b.sinif && (b.sinif === SINIF.IZLENMIYOR || Math.abs(x.kayma - ka) < ESIK), x);
  }
  SONUC[kod] = rs; await A.ctx.close(); return rs;
}
const cariB = (id, kayma, sinif) => ({ [`cari#${id}`]: { kayma, sinif } }), kasaB = (id, kayma, sinif) => ({ [`kasa#${id}`]: { kayma, sinif } });
const { ACIKLANAN, ACIKLANAMAYAN, KAYMA_YOK, IZLENMIYOR } = SINIF;

// ---- K1–K12 ----
await senaryo({ kod: 'K1', ad: 'cari formunda elle bakiye düzeltme (500 → 550)', adimlar: (A) => islem.elleBakiye(A, 9001, 550), beklenen: cariB(9001, 50, ACIKLANAMAYAN) });
await senaryo({ kod: 'K2', ad: 'elle çek ekleme, cariye işlenir (200)', adimlar: (A) => islem.cekEkle(A, 9002, 200), beklenen: cariB(9002, -200, ACIKLANAN) });
await senaryo({ kod: 'K3a', ad: 'portföydeki elle çekin tutarı 200 → 260', hazirla: async (A, c) => { c.id = await islem.cekEkle(A, 9002, 200); },
  adimlar: (A, c) => A.page.evaluate((id) => { cekForm(id); $('ck-tut').value = '260'; kaydetCek(id); }, c.id), beklenen: cariB(9002, -60, ACIKLANAN) });
await senaryo({ kod: 'K3b', ad: 'tahsilatla alınan çekin carisi B → A', hazirla: async (A, c) => { await sayfa.tahsilat(A, 9002, 200, 'Çek'); c.id = await sayfa.sonCek(A); },
  adimlar: (A, c) => A.page.evaluate((id) => { cekForm(id); ckCariId = 9001; kaydetCek(id); }, c.id), beklenen: { ...cariB(9002, 200, ACIKLANAN), ...cariB(9001, -200, ACIKLANAN) } });
await senaryo({ kod: 'K4a', ad: 'portföydeki elle çeki silme', hazirla: async (A, c) => { c.id = await islem.cekEkle(A, 9002, 200); },
  adimlar: async (A, c) => { await A.page.evaluate((id) => cekSil(id), c.id); await sayfa.kritik(A); }, beklenen: cariB(9002, 200, ACIKLANAN) });
await senaryo({ kod: 'K4b', ad: 'tahsilatla alınan çeki silme', hazirla: async (A, c) => { await sayfa.tahsilat(A, 9001, 150, 'Çek'); c.id = await sayfa.sonCek(A); },
  adimlar: async (A, c) => { await A.page.evaluate((id) => cekSil(id), c.id); await sayfa.kritik(A); }, beklenen: cariB(9001, 150, ACIKLANAN) });
await senaryo({ kod: 'K5a', ad: 'portföydeki çek karşılıksız', hazirla: async (A, c) => { c.id = await islem.cekEkle(A, 9002, 200); },
  adimlar: async (A, c) => { await A.page.evaluate((id) => cekKarsiliksiz(id), c.id); await sayfa.onayEvet(A); }, beklenen: cariB(9002, 200, ACIKLANAN) });
await senaryo({ kod: 'K5b', ad: 'tahsil edilmiş çek karşılıksız (kasa hareketi yazılır)', hazirla: async (A, c) => { c.id = await islem.cekEkle(A, 9002, 200); await islem.cekTahsil(A, c.id); },
  adimlar: async (A, c) => { await A.page.evaluate((id) => cekKarsiliksiz(id), c.id); await sayfa.onayEvet(A); }, beklenen: cariB(9002, 200, ACIKLANAN) });
await senaryo({ kod: 'K6', ad: 'kur takipli çek tahsilinde kur farkı (3240 TL, veriliş 32.40, tahsil 34.40)',
  hazirla: async (A, c) => { c.id = await A.page.evaluate(() => { cekTab = 'alinan'; cekForm(0); ckCariId = 9002; $('ck-tut').value = '3240'; $('ck-vade').value = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    $('ck-kur').checked = true; $('ck-kurpb').value = 'USD'; $('ck-kurv').value = '32.4'; $('ck-isle').checked = true; kaydetCek(); return db.cekler[db.cekler.length - 1].id; }); await sayfa.kur(A, 34.4); },
  adimlar: (A, c) => islem.cekTahsil(A, c.id), beklenen: cariB(9002, 200, ACIKLANAN) });
await senaryo({ kod: 'K7', ad: 'fason durak ücreti 10 → 12 (10 adet teslim): borç +120',
  adimlar: (A) => A.page.evaluate(() => { durakGuncelle(9401, 0); $('d-uc').value = '12'; durakKaydet(9401, 0); }), beklenen: cariB(9004, 120, ACIKLANAN) });
await senaryo({ kod: 'K8', ad: 'ürün kartından tedarikçiye borç (5 × 50 = 250), hareket yazılmaz',
  adimlar: async (A) => { await A.page.evaluate(() => { formUrun(9201); setKaynak('alim'); $('u-ted').value = '9003'; fRenk[0].stok = (+fRenk[0].stok || 0) + 5; kaydetUrun(9201); }); await sayfa.onayEvet(A); },
  beklenen: cariB(9003, 250, ACIKLANAMAYAN) });
await senaryo({ kod: 'K9', ad: 'ödenmiş taksiti olan planın kaldırılması (ödenmiş 100)', hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9001, 300); await sayfa.planKur(A, c.sid, 3); await sayfa.taksitTahsil(A, c.sid, 0); },
  adimlar: (A, c) => A.page.evaluate((sid) => { odemePlaniAc(sid); [...document.querySelectorAll('#ov button')].find(b => b.textContent.includes('Planı Kaldır')).click(); }, c.sid), beklenen: cariB(9001, 100, ACIKLANAN) });
await senaryo({ kod: 'K10', ad: 'kur 32.40 → 34.40, kur bilgisi olmayan eski 10 USD satış', hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9002, 324, { pb: 'USD', tutar: 10, araToplam: 10, satisKur: null }); },
  adimlar: (A) => sayfa.kur(A, 34.4), beklenen: cariB(9002, -20, ACIKLANAN) });
await senaryo({ kod: 'K11', ad: 'USD tedarikçiden 2 × 50 USD alım ve 500 TL ödeme', adimlar: async (A) => {
  await A.page.evaluate(() => { formAlim(9005); $('al-ad').value = 'Sentetik alım'; $('al-adet').value = '2'; $('al-fiyat').value = '50'; $('al-pb').value = 'USD'; kaydetAlim(9005); });
  await sayfa.tahsilat(A, 9005, 500); }, beklenen: {} });
await senaryo({ kod: 'K12', ad: 'eski biçimli (odemeHesapId) peşin 300 satışın iptali', hazirla: async (A, c) => { c.sid = await A.page.evaluate(() => { const u = urun(9201), m = cari(9001);
    const k = { uid: u.id, urun: u.ad, mik: 1, birim: 'adet', fiyat: 300, renkler: [{ ad: 'Siyah', mik: 1, rid: u.renkler[0].rid }] };
    const s = { id: nid('s'), tip: 'satis', lokId: aktifLok, mid: m.id, mus: m.ad, tarih: Date.now() - 400 * 86400000, kalemler: [k], araToplam: 300, iskonto: 0, tutar: 300, odenen: 300, kesik: 0, pb: 'TL', satisKur: 1, odemeHesapId: 9101, durum: 'tamam', teslimDurum: 'teslim' };
    db.satislar.push(s); stokUygula(k, -1, s.lokId); hesap(9101).bakiye += 300; save(); return s.id; }); },
  adimlar: async (A, c) => { await A.page.evaluate((sid) => silSatis(sid), c.sid); await sayfa.kritik(A); }, beklenen: kasaB(9101, -300, ACIKLANAN) });

// ---- Kaymasız normal işlemler (uyarı da "açıklanan" da OLMAMALI) ----
await senaryo({ kod: 'N1', ad: 'satış, tahsilat, gelir/gider, transfer, TL alım, TL tedarikçi ödemesi, kasa kaydı silme', adimlar: async (A) => {
  await islem.satis(A); await sayfa.tahsilat(A, 9001, 50); await islem.kasaGelirGider(A, 'in', 150); await islem.kasaGelirGider(A, 'out', 70);
  await A.page.evaluate(() => { formTransfer(9101); $('tr-from').value = '9101'; $('tr-to').value = '9102'; $('tr-t').value = '100'; $('tr-a').value = 'Sentetik transfer'; kaydetTransfer(); });
  await A.page.evaluate(() => { formAlim(9003); $('al-ad').value = 'Sentetik alım'; $('al-adet').value = '3'; $('al-fiyat').value = '40'; $('al-pb').value = 'TL'; kaydetAlim(9003); });
  await sayfa.tahsilat(A, 9003, 200);
  await A.page.evaluate(() => silHareket(db.hareketler.filter(h => h.hesapId === 9101 && h.yon === 'out' && h.aciklama === 'Sentetik gider').pop().id)); await sayfa.kritik(A); } });
await senaryo({ kod: 'N2', ad: 'satış iptali ve iptalin geri alınması', adimlar: async (A, c) => {
  c.sid = await sayfa.satisTutar(A, 9001, 250); await A.page.evaluate((sid) => silSatis(sid), c.sid); await sayfa.kritik(A);
  await A.page.evaluate((sid) => satisGeriAl(sid), c.sid); await sayfa.kritik(A); } });
await senaryo({ kod: 'N3', ad: 'taksit planı ve iki taksit tahsili', hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9001, 300); await sayfa.planKur(A, c.sid, 3); },
  adimlar: async (A, c) => { await sayfa.taksitTahsil(A, c.sid, 0); await sayfa.taksitTahsil(A, c.sid, 1); } });
await senaryo({ kod: 'N4', ad: 'çekle ve kredi kartıyla tahsilat, çekin tedarikçiye cirosu', adimlar: async (A) => {
  await sayfa.tahsilat(A, 9002, 120, 'Çek'); const id = await sayfa.sonCek(A); await sayfa.tahsilat(A, 9002, 80, 'Kredi Kartı');
  await A.page.evaluate((id) => { cekCiro(id); $('ci-cari').value = '9003'; cekCiroKaydet(id); }, id); } });
await senaryo({ kod: 'N5', ad: 'tedarikçiye verilen çekle ödeme ve çekin bankadan ödenmesi', adimlar: async (A) => {
  await sayfa.tahsilat(A, 9003, 300, 'Çek'); const id = await sayfa.sonCek(A); await islem.cekTahsil(A, id); } });
await senaryo({ kod: 'N6', ad: 'kur değişimi (kur bilgili satışlar etkilenmez)', hazirla: async (A) => { await sayfa.satisTutar(A, 9002, 324, { pb: 'USD', tutar: 10, araToplam: 10, satisKur: 32.4 }); },
  adimlar: (A) => sayfa.kur(A, 34.4) });
await senaryo({ kod: 'N7', ad: 'satış düzenleme: fiyat 250 → 300 ve 100 TL nakit ödeme eklenir (kaydetSatis düzenleme yolu)', hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9001, 250); },
  adimlar: async (A, c) => { const r = await A.page.evaluate((sid) => { formSatis(0, sid); sepet[0].fiyat = 300; sOdemeler = [{ tur: 'Nakit', tutar: 100, pb: 'TL', hesapId: 9101, vade: 0, foto: '' }]; kaydetSatis();
    const s = db.satislar.find(x => x.id === sid); return { tutar: s.tutar, odenen: s.odenen, odemeler: (s.odemeler || []).length }; }, c.sid);
    if (!(r.tutar === 300 && r.odenen === 100 && r.odemeler === 1)) throw new Error('düzenleme uygulanmadı ' + JSON.stringify(r)); } });
const iadeAl1 = (A, sid, nakit) => A.page.evaluate(([sid, nakit]) => { iadeAl(sid); if (nakit) $('iade-nakit').checked = true; iadeSel = { 0: { Siyah: 1 } }; iadeCiz(); if (nakit) $('iade-hs').value = '9101';
  const n0 = db.satislar.length; iadeKaydet(); const r = db.satislar[db.satislar.length - 1]; if (db.satislar.length !== n0 + 1 || r.tip !== 'iade') throw new Error('iade kaydedilmedi'); return r.id; }, [sid, nakit]);
await senaryo({ kod: 'N8', ad: 'iade (cariye alacak) ve iadenin geri alınması', hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9001, 250); },
  adimlar: async (A, c) => { const iid = await iadeAl1(A, c.sid, false); await A.page.evaluate((id) => iadeSil(id), iid); await sayfa.kritik(A);
    if (!(await A.page.evaluate((id) => db.satislar.find(x => x.id === id).iptal, iid))) throw new Error('iade geri alınmadı'); } });
await senaryo({ kod: 'N9', ad: 'iade (cariye alacak), geri alınmadan', hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9001, 250); }, adimlar: async (A, c) => { await iadeAl1(A, c.sid, false); } });
await senaryo({ kod: 'I1', ad: 'NAKİT iade 250 (kasadan ödenir; ekstrede borç görünür, bakiye değişmez)', hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9001, 250); },
  adimlar: async (A, c) => { await iadeAl1(A, c.sid, true); }, beklenen: cariB(9001, -250, ACIKLANAN) });
await senaryo({ kod: 'I2', ad: 'NAKİT iade 250 ve geri alınması (iki kasa hareketi de ekstrede borç)', hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9001, 250); },
  adimlar: async (A, c) => { const iid = await iadeAl1(A, c.sid, true); await A.page.evaluate((id) => iadeSil(id), iid); await sayfa.kritik(A); }, beklenen: cariB(9001, -500, ACIKLANAN) });

// ===================================================================== C. İKİ CİHAZ: GEÇİCİ ↔ TEKRARLAYAN =====================================================================
const domenGuncel = (B, C) => Object.fromEntries([...C.abone].filter(y => y.startsWith('isletme/iqbasics/veri/')).map(y => [y.split('/').pop(), C.gordugu.get(y) === (B.belge.get(y) || {}).v]));
{ const B = D.bulutKur(); const A = await D.cihazAc(B, 'A', 11); const Bc = await D.cihazAc(B, 'B', 22);
  await D.yerles(B); const g0 = goruntu(await D.cihazVeri(Bc)); const Z = 1800000000000, DK = 60000;
  await islem.tahsilat(A, 9001, 100); await islem.gizle(A);
  await D.teslim(B, Bc, ['cari']); await bekle(450); // B yalnız cari belgesini aldı (bakiye düştü, hareket kasa belgesinde, henüz gelmedi)
  const r1 = karsilastir(g0, goruntu(await D.cihazVeri(Bc))), x1 = bul(r1, 'cari', 9001), gun1 = domenGuncel(B, Bc);
  T('C1 [geçici] cari belgesi kasa belgesinden önce geldi → motor bir fark görür (−100)', UYARI_SINIFLARI.has(x1.sinif) && x1.kayma === -100, x1);
  T('C1 [geçici] kasa domeni güncel değil (test düzeneğinden: görülen sürüm < buluttaki)', gun1.kasa === false && gun1.cari === true, gun1);
  const s1 = izlemeGuncelle(null, { zaman: Z, satirlar: r1, senkron: { canli: true, bekleyenYazim: false, sonBirlesim: Z - 1000, domenGuncel: gun1 } });
  const s2 = izlemeGuncelle(s1, { zaman: Z + 11 * DK, satirlar: r1, senkron: { canli: true, bekleyenYazim: false, sonBirlesim: Z - 1000, domenGuncel: gun1 } });
  T('C1 [geçici] ilk kontrol BEKLEMEDE; 11 dk sonra (kasa hâlâ gelmemiş) yine BEKLEMEDE — zaman tek başına yetmez', s1.kayitlar['cari#9001'].kalicilik === KALICILIK.BEKLEMEDE && s2.kayitlar['cari#9001'].kalicilik === KALICILIK.BEKLEMEDE && s2.kayitlar['cari#9001'].sayi === 2, s2);
  await D.yerles(B);
  const r2 = karsilastir(g0, goruntu(await D.cihazVeri(Bc))), s3 = izlemeGuncelle(s2, { zaman: Z + 12 * DK, satirlar: r2, senkron: { canli: true, bekleyenYazim: false, sonBirlesim: Z + 11 * DK, domenGuncel: domenGuncel(B, Bc) } });
  T('C1 [geçici] bütün belgeler gelince fark kaybolur → KAYMA_YOK, izleme: KENDILIGINDEN_DUZELDI', bul(r2, 'cari', 9001).sinif === KAYMA_YOK && uyarilar(r2).length === 0 && s3.kapanan.some(k => k.id === 9001 && k.sonuc === 'KENDILIGINDEN_DUZELDI'), { r2: uyarilar(r2), s3 });
  T('C [altyapı] sayfa hatası yok', A.hatalar.length === 0 && Bc.hatalar.length === 0, [...A.hatalar, ...Bc.hatalar].slice(0, 3));
  await A.ctx.close(); await Bc.ctx.close(); }
{ const B = D.bulutKur(); const A = await D.cihazAc(B, 'A', 11); const Bc = await D.cihazAc(B, 'B', 22);
  await D.yerles(B); const g0 = goruntu(await D.cihazVeri(Bc)); const Z = 1800000000000, DK = 60000;
  await islem.tahsilat(A, 9001, 100); await islem.tahsilat(Bc, 9001, 100); await islem.gizle(A); await D.teslim(B, Bc); await islem.gizle(Bc); await D.yerles(B); // test 34 S2: eşit tahsilatlarda biri kaybolur
  const rB = karsilastir(g0, goruntu(await D.cihazVeri(Bc))), x = bul(rB, 'cari', 9001), gun = domenGuncel(B, Bc);
  T('C2 [kalıcı] eşzamanlı eşit tahsilat kaybı (bilinen hata) → OLASI_ETKI_KAYBI +100; bütün domenler güncel', x.sinif === SINIF.OLASI_ETKI_KAYBI && x.kayma === 100 && Object.values(gun).every(Boolean), { x, gun });
  const sk = (z) => ({ canli: true, bekleyenYazim: false, sonBirlesim: z - 2 * DK, domenGuncel: gun });
  const s1 = izlemeGuncelle(null, { zaman: Z, satirlar: rB, senkron: sk(Z) }), s2 = izlemeGuncelle(s1, { zaman: Z + 11 * DK, satirlar: rB, senkron: sk(Z + 11 * DK) });
  T('C2 [kalıcı] ilk kontrol BEKLEMEDE; 2. kontrol (11 dk, domenler güncel, senkron sakin) → TEKRARLAYAN_SUPHE (kesin kayıp DEĞİL)', s1.kayitlar['cari#9001'].kalicilik === KALICILIK.BEKLEMEDE
    && s2.kayitlar['cari#9001'].kalicilik === KALICILIK.TEKRARLAYAN_SUPHE && !/KESIN/.test(JSON.stringify(s2)), s2);
  T('C [altyapı] sayfa hatası yok (C2)', A.hatalar.length === 0 && Bc.hatalar.length === 0, [...A.hatalar, ...Bc.hatalar].slice(0, 3));
  await A.ctx.close(); await Bc.ctx.close(); }

// ===================================================================== E. SENKRONDA ÇEK / TAKSİT ETKİSİ KAYBI (iki cihaz, çaprazlaşan yazım) =====================================================================
// Kural: gerçek kayıp varsa ACIKLANAN olamaz. Sonuç doğru bakiyeyle karşılaştırılır (bağımsız): kayıp → uyarı; kayıp yoksa → ACIKLANAN / KAYMA_YOK.
async function capraz({ kod, ad, hazirla, aIslem, bIslem, cid, dogru, kayipsizSinif }) {
  const B = D.bulutKur(); const A = await D.cihazAc(B, 'A', 11); const Bc = await D.cihazAc(B, 'B', 22); const ctx = {};
  let hata = null; try { if (hazirla) await hazirla(A, ctx); await islem.gizle(A); } catch (e) { hata = String(e.message).slice(0, 200); }
  await D.yerles(B); const g0 = goruntu(await D.cihazVeri(Bc));
  try { await aIslem(A, ctx); await bIslem(Bc, ctx); await islem.gizle(A); await islem.gizle(Bc); } catch (e) { hata = String(e.message).slice(0, 200); } // yazımlar yolda çaprazlaşır
  await D.yerles(B);
  const dB = await D.cihazVeri(Bc), x = bul(karsilastir(g0, goruntu(dB)), 'cari', cid), bak = (dB.cariler.find(c => c.id === cid) || {}).bakiye, kayip = Math.abs(bak - dogru) >= ESIK;
  console.log(`RAPOR ${kod} cari#${cid} bakiye=${bak} doğru=${dogru} kayıp=${kayip ? 'EVET ' + r2(bak - dogru) : 'yok'} kayma=${x && x.kayma} sınıf=${x && x.sinif} kanıt=${JSON.stringify(x && x.kanit)}`);
  T(`${kod} [altyapı] işlemler hatasız, sayfa hatası yok`, !hata && A.hatalar.length === 0 && Bc.hatalar.length === 0, { hata, h: [...A.hatalar, ...Bc.hatalar].slice(0, 3) });
  T(`${kod} [kayıp] ${ad}: ${kayip ? 'gerçek kayıp VAR → ACIKLANAN değil, uyarı' : 'kayıp yok → ' + kayipsizSinif}`, !!x && (kayip ? (x.sinif !== ACIKLANAN && UYARI_SINIFLARI.has(x.sinif)) : x.sinif === kayipsizSinif), x);
  if (kayip) kayipGoruldu.push(kod);
  await A.ctx.close(); await Bc.ctx.close();
}
const r2 = (v) => Math.round(v * 100) / 100, kayipGoruldu = [];
await capraz({ kod: 'E1', ad: 'A elle çek ekler (−200), B aynı cariden 50 tahsil eder', cid: 9002, dogru: 50, kayipsizSinif: ACIKLANAN,
  aIslem: (A) => islem.cekEkle(A, 9002, 200), bIslem: (Bc) => islem.tahsilat(Bc, 9002, 50) });
await capraz({ kod: 'E2', ad: 'A çekle 200 tahsil eder, B aynı cariden 50 nakit tahsil eder', cid: 9002, dogru: 50, kayipsizSinif: KAYMA_YOK,
  aIslem: (A) => sayfa.tahsilat(A, 9002, 200, 'Çek'), bIslem: (Bc) => islem.tahsilat(Bc, 9002, 50) });
await capraz({ kod: 'E3', ad: 'A taksit (100) tahsil eder, B aynı cariden 50 nakit tahsil eder', cid: 9001, dogru: 500 + 300 - 100 - 50, kayipsizSinif: KAYMA_YOK,
  hazirla: async (A, c) => { c.sid = await sayfa.satisTutar(A, 9001, 300); await sayfa.planKur(A, c.sid, 3); },
  aIslem: (A, c) => sayfa.taksitTahsil(A, c.sid, 0), bIslem: (Bc) => islem.tahsilat(Bc, 9001, 50) });
T('E [kapsam] çaprazlaşan yazımda en az bir gerçek kayıp oluştu ve hiçbiri ACIKLANAN sayılmadı', kayipGoruldu.length > 0, kayipGoruldu);

// ===================================================================== D. TARAYICIDA ÇALIŞMA: HİÇBİR ŞEY YAZILMAZ =====================================================================
{ const B = D.bulutKur(); const A = await D.cihazAc(B, 'A', 11);
  await A.page.evaluate(HAZIRLIK); const g0n = goruntu(await D.cihazVeri(A)); await islem.elleBakiye(A, 9001, 560); await bekle(150);
  const s = await A.page.evaluate(async (g0) => {
    const lsOku = () => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
    const idbAd = async () => JSON.stringify(((await indexedDB.databases()) || []).map(x => x.name + ':' + x.version).sort());
    const say = { save: 0, canliYazHemen: 0, canliYaz: 0, firestore: 0 }; const es = { save, canliYazHemen, canliYaz };
    save = () => { say.save++; return true; }; canliYazHemen = () => { say.canliYazHemen++; }; canliYaz = () => { say.canliYaz++; };
    const fsEski = firebase.firestore; firebase.firestore = (...a) => { say.firestore++; return fsEski.apply(firebase, a); };
    const ls0 = lsOku(), idb0 = await idbAd(), db0 = JSON.stringify(db);
    const Mt = await import('/js/defter-izleme.mjs'); const t0 = performance.now();
    const rs = Mt.karsilastir(g0, Mt.goruntu(db)); const ms = performance.now() - t0;
    await new Promise(r => setTimeout(r, 400));
    const sonuc = { rs, ms, say, ayniDb: JSON.stringify(db) === db0, ayniLs: lsOku() === ls0, ayniIdb: (await idbAd()) === idb0 };
    save = es.save; canliYazHemen = es.canliYazHemen; canliYaz = es.canliYaz; firebase.firestore = fsEski; return sonuc; }, g0n);
  const nodeRs = karsilastir(g0n, goruntu(await D.cihazVeri(A)));
  T('D1 [tarayıcı] tarayıcıda yüklenen motor Node ile birebir aynı sonucu verir (aynı dosya)', JSON.stringify(s.rs) === JSON.stringify(nodeRs) && bul(s.rs, 'cari', 9001).sinif === ACIKLANAMAYAN, { tarayici: uyarilar(s.rs), node: uyarilar(nodeRs) });
  T('D1 [salt okunur] kontrol sırasında db, localStorage ve IndexedDB veritabanı listesi DEĞİŞMEDİ', s.ayniDb && s.ayniLs && s.ayniIdb, s);
  T('D1 [salt okunur] save / canliYaz / canliYazHemen / Firestore HİÇ çağrılmadı', Object.values(s.say).every(n => n === 0), s.say);
  console.log(`PERF tarayıcı (Chromium) küçük veri: ${s.ms.toFixed(2)} ms`);
  T('D [altyapı] sayfa hatası yok', A.hatalar.length === 0, A.hatalar.slice(0, 3));
  await A.ctx.close(); }

// ===================================================================== ÖZET =====================================================================
const uyariVar = (k) => uyarilar(SONUC[k] || []);
for (const k of ['K2', 'K3a', 'K3b', 'K4a', 'K4b', 'K5a', 'K5b', 'K6', 'K7', 'K9', 'K10', 'K12', 'I1', 'I2'])
  T(`ÖZET ${k}: bilinen kayıt dışı değişiklik ACIKLANAN, uyarı yok`, uyariVar(k).length === 0 && (SONUC[k] || []).some(r => r.sinif === ACIKLANAN), uyariVar(k));
for (const k of ['K1', 'K8']) T(`ÖZET ${k}: kanıtsız değişiklik ACIKLANAMAYAN (tek uyarı, "kayıp" denmez)`, uyariVar(k).length === 1 && uyariVar(k)[0].sinif === ACIKLANAMAYAN, uyariVar(k));
T('ÖZET K11: USD cari IZLENMIYOR, hiçbir uyarı yok', uyariVar('K11').length === 0 && bul(SONUC.K11 || [], 'cari', 9005).sinif === IZLENMIYOR);
for (const k of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9']) T(`ÖZET ${k}: normal işlemler → bütün cari ve kasalar KAYMA_YOK (USD hariç)`, (SONUC[k] || []).length > 0 && (SONUC[k] || []).every(r => r.sinif === KAYMA_YOK || (r.id === 9005 && r.sinif === IZLENMIYOR)), (SONUC[k] || []).filter(r => r.sinif !== KAYMA_YOK));
T('ÖZET yanlış alarm = 0 ve kaçırılan beklenen uyarı = 0 (B bölümü)', yanlisAlarm === 0 && kacan === 0, { yanlisAlarm, kacan });
T('ORTAM sahte Firestore; gerçek Firebase/Auth sunucularına istek denemesi bile yok', ![...D.disari].some(h => GERCEK_FIREBASE.test(h)), [...D.disari]);
await D.kapat();
console.log(`\nYANLIŞ ALARM: ${yanlisAlarm} · KAÇIRILAN: ${kacan}`);
console.log(`${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
