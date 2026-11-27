// Ders 50.3c-2 — DEFTER İZLEME DEPOSU (js/defter-depo.mjs) + KAYIPSIZ TABAN PAKETİ (js/defter-izleme.mjs tabanPaketle / tabanAc).
// Uygulama kodu (index.html, sw.js) DEĞİŞMEDİ; uygulama bu modülleri YÜKLEMİYOR. Depo yalnız AYRI "iqbasics-defter" IndexedDB'sini kullanır.
// ORTAM: B bölümü gerçek Chromium IndexedDB'si + test 34–36 ile aynı SAHTE bellek içi Firestore (gerçek Firebase / emülatör DEĞİL).
// Bölümler:
//   A  saf (Node): paket kayıpsız (alan alan aynı), karşılaştırma sonucu paketlemeden etkilenmez, özetle EŞLEŞTİRME YOK (tam imza saklanır),
//      bozuk / tanınmayan paket reddi, yetki ve senkron kanıtı girdileri, modül kaynak taraması
//   B  tarayıcı: normal kayıt ve geri okuma, bozuk paket, aynı imzalı olaylar, kota tahmini ve GERÇEK kota hatası, işlem iptali,
//      iki sekme (Web Locks ile / yokken), yetkisiz erişim, kurtarma kilidi, çevrimdışı / eksik senkron, yenileme ve açık uyarılar,
//      500 kontrol sınırı, 25 MB sınırı, depolamanın silinmesi, şema, ERP verisinin değişmezliği, gerçek paket boyutları
// Sentetik veri. Sunucu rastgele port, sw.js → 404. Hata → çıkış kodu 1.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { duzenekKur, islem, bekle, GERCEK_FIREBASE } from './yardimci/iki-cihaz-sahte-firestore.mjs';
import * as M from '../js/defter-izleme.mjs';
const { goruntu, karsilastir, tabanPaketle, tabanAc, izlemeYetkisi, senkronKaniti, PAKET_BICIM, PAKET_SURUM, MOTOR_SURUM } = M;

const DEPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.env.IQ_TEST_KOK ? path.resolve(process.env.IQ_TEST_KOK) : DEPO;
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 600) : '')); } };
const kopya = (x) => JSON.parse(JSON.stringify(x));
const siniflar = (rs) => JSON.stringify(rs.map(r => [r.tur, r.id, r.sinif, r.kayma, r.kalan, r.aciklanan, r.kanit]));
console.log('ORTAM: A saf Node; B gerçek Chromium IndexedDB + SAHTE bellek içi Firestore (gerçek Firebase / emülatör DEĞİL) · kök: ' + (ROOT === DEPO ? 'depo' : ROOT));

// ===================================================================== A. SAF: PAKET, YETKİ, SENKRON KANITI =====================================================================
const DEPO_KAYNAK = fs.readFileSync(path.join(ROOT, 'js/defter-depo.mjs'), 'utf8');
const dkod = DEPO_KAYNAK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const MOTOR_KAYNAK = fs.readFileSync(path.join(ROOT, 'js/defter-izleme.mjs'), 'utf8');
const mkod = MOTOR_KAYNAK.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const YASAK_DEPO = ['localStorage', 'sessionStorage', 'firebase', 'firestore', 'oztekstil', 'document', 'window', 'fetch(', 'XMLHttpRequest', 'save(', 'canliYaz', 'deleteDatabase', 'iq_'];
T('A1 [kapsam] depo kaynağında localStorage / Firebase / işletme verisi / DOM / ağ / veritabanı silme YOK', YASAK_DEPO.every(y => !dkod.includes(y)), YASAK_DEPO.filter(y => dkod.includes(y)));
T('A1 [kapsam] depo yalnız "iqbasics-defter" adını açar (kurtarma veritabanı "iqbasics" hiçbir yerde açılmaz)', (dkod.match(/'iqbasics[^']*'/g) || []).every(a => a.startsWith("'iqbasics-defter")) && (dkod.match(/\.open\(/g) || []).length === 1 && /IDB\.open\(DEPO_AD, DEPO_SURUM\)/.test(dkod), dkod.match(/'iqbasics[^']*'/g));
const YASAK_MOTOR = ['localStorage', 'indexedDB', 'fetch(', 'firebase', 'document', 'window', 'globalThis', 'Date.now', 'new Date', 'Math.random', 'crypto', 'CompressionStream', 'import('];
T('A1 [saflık] motor (paketleme dahil) hâlâ saf: depolama / saat / rastgelelik / şifreleme / sıkıştırma kullanmaz', YASAK_MOTOR.every(y => !mkod.includes(y)) && !/^\s*import\s/m.test(mkod), YASAK_MOTOR.filter(y => mkod.includes(y)));
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
// Ders 50.3c-3a: uygulama yalnız saf motoru (defter-izleme, tanılama) istek üzerine yükler — DEPO hâlâ uygulamada yok.
T('A1 [kapsam] index.html ve sw.js izleme DEPOSUNU yüklemiyor ve "iqbasics-defter" veritabanını hiç anmıyor (uygulama depoya bağlı değil)', !/defter-depo|iqbasics-defter/.test(INDEX + SW));

const V = () => ({ kurUSD: 30, kurEUR: 33, _tomb: { cekler: { 77: 1 } },
  cariler: [{ id: 1, ad: 'M1', tip: 'musteri', bakiye: 500 }, { id: '2', ad: 'M2', tip: 'musteri', bakiye: 300 }, { id: 3, ad: 'T1', tip: 'tedarikci', bakiye: 1000 }, { id: 4, ad: 'F1', tip: 'fason', bakiye: 0 }, { id: 5, ad: 'U1', tip: 'tedarikci', doviz: 'USD', bakiye: 0, bakiyeUSD: 100 }],
  hesaplar: [{ id: 10, ad: 'Kasa', bakiye: 1000 }],
  satislar: [{ id: 100, tip: 'satis', mid: 1, tarih: 1000, tutar: 200, odenen: 0, pb: 'TL', satisKur: 1 }, { id: 101, tip: 'satis', mid: '2', tarih: 1001, tutar: 10, odenen: 0, pb: 'USD' },
    { id: 102, tip: 'satis', mid: 1, tarih: 1002, tutar: 300, odenen: 300, pb: 'TL', satisKur: 1, odemeHesapId: 10 }, { id: 103, tip: 'satis', mid: 1, tarih: 1003, tutar: 300, odenen: 100, pb: 'TL', satisKur: 1, taksitler: [{ tutar: 100, odendi: true }, { tutar: 100 }] },
    { id: 104, tip: 'iade', mid: 1, tarih: 1004, tutar: 50, satisKur: 1, nakit: false }],
  hareketler: [{ id: 200, cariId: 1, tip: 'tahsilat', tutar: 50, tur: 'Nakit', tarih: 1100, hesapId: 10, yon: 'in' }, { id: 200, cariId: 1, tip: 'tahsilat', tutar: 50, tur: 'Nakit', tarih: 1100, hesapId: 10, yon: 'in' },
    { id: 'x-9', cariId: '2', tip: 'tahsilat', tutar: 120, kesik: 5, tur: 'Çek', tarih: 9, hesapId: null, yon: null }, { id: 202, cariId: 1, tutar: 40, tur: 'İade', tarih: 1200, hesapId: 10, yon: 'out' }],
  cekler: [{ id: 300, tip: 'alinan', cariId: '2', tutar: 120, durum: 'portfoyde', cariIsle: true, hesapId: 10 }, { id: 301, tip: 'alinan', cariId: 1, tutar: 80, durum: 'tahsil', cariIsle: true, kurTakip: true, kurFarki: 12 }],
  isemirleri: [{ id: 400, duraklar: [{ fasonId: 4, borcFasonId: 4, borclanan: 60 }] }] });
function buyuk(nC, nH, nS, nCek) { let x = 7; const rnd = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
  const d = { kurUSD: 30, kurEUR: 33, _tomb: {}, cariler: [], hesaplar: [], satislar: [], hareketler: [], cekler: [], isemirleri: [] };
  for (let i = 0; i < nC; i++) d.cariler.push({ id: 100000 + i * 100 + 17, ad: 'Sentetik Cari ' + i, tip: i % 10 ? 'musteri' : 'tedarikci', bakiye: Math.round(rnd() * 1e5) / 100 });
  for (let i = 0; i < 10; i++) d.hesaplar.push({ id: 5000 + i, ad: 'Kasa ' + i, bakiye: 1e6 });
  for (let i = 0; i < nS; i++) d.satislar.push({ id: 200000 + i * 100 + 17, tip: 'satis', mid: d.cariler[Math.floor(rnd() * nC)].id, tarih: 1790000000000 + i * 60000, tutar: Math.round(rnd() * 1e5) / 100, odenen: rnd() < .5 ? 100 : 0, pb: 'TL', satisKur: 1, taksitler: rnd() < .05 ? [{ tutar: 10, odendi: true }] : undefined });
  for (let i = 0; i < nH; i++) { const c = rnd() < .85; d.hareketler.push({ id: 300000 + i * 100 + 17, cariId: c ? d.cariler[Math.floor(rnd() * nC)].id : null, tip: c ? 'tahsilat' : undefined, tutar: Math.round(rnd() * 5e4) / 100, tur: 'Nakit', tarih: 1790000000000 + i * 30000, hesapId: 5000 + Math.floor(rnd() * 10), yon: rnd() < .6 ? 'in' : 'out' }); }
  for (let i = 0; i < nCek; i++) d.cekler.push({ id: 400000 + i * 100 + 17, tip: 'alinan', cariId: d.cariler[Math.floor(rnd() * nC)].id, tutar: 1000, durum: 'portfoyde', cariIsle: true, kurTakip: false });
  return d; }
const gidisDonus = (g) => tabanAc(kopya(tabanPaketle(g)));

// A2 — kayıpsız: tabanAc(tabanPaketle(g)) alan alan (ve alan sırasıyla) g ile aynı; karşılaştırma sonuçları değişmez
{ const veri = [['ana sentetik veri', V()], ['boş veri', {}], ['büyük 1.000 cari', buyuk(1000, 20000, 5000, 500)]];
  for (const [ad, d] of veri) { const g = goruntu(d), r = gidisDonus(g);
    T(`A2 [kayıpsız] ${ad}: paket → JSON → geri açma görüntüyle birebir aynı (${Object.keys(g.olay).length} olay)`, r.ok && JSON.stringify(r.goruntu) === JSON.stringify(g), r.ok ? 'fark' : r); }
  const g0 = goruntu(V()), mut = [
    ['kayıpsız tahsilat', d => { d.hareketler.push({ id: 900, cariId: 1, tip: 'tahsilat', tutar: 25, tur: 'Nakit', tarih: 5000, hesapId: 10, yon: 'in' }); d.cariler[0].bakiye -= 25; d.hesaplar[0].bakiye += 25; }],
    ['etkisi kayıp tahsilat (aynı kimlik 200)', d => d.hareketler.push({ id: 200, cariId: 1, tip: 'tahsilat', tutar: 40, tur: 'Nakit', tarih: 5000, hesapId: 10, yon: 'in' })],
    ['geç gelen eski tarihli kayıt', d => d.hareketler.push({ id: 5, cariId: 1, tip: 'tahsilat', tutar: 60, tur: 'Nakit', tarih: 10, hesapId: 10, yon: 'in' })],
    ['elle bakiye', d => { d.cariler[2].bakiye += 7; }],
    ['çek silme izli', d => { d.cekler = d.cekler.filter(c => c.id !== 300); d.cariler[1].bakiye += 120; d._tomb.cekler[300] = 1; }],
    ['çekle tahsilat hareketi kayboldu', d => { d.hareketler = d.hareketler.filter(h => h.id !== 'x-9'); }],
    ['taksit planı kaldırıldı', d => { d.satislar[3].taksitler = []; }],
    ['kur değişimi', d => { d.kurUSD = 32; }],
    ['eski biçim satış iptali', d => { d.satislar[2].iptal = true; d.hesaplar[0].bakiye -= 300; }],
    ['cari izsiz kayboldu', d => { d.cariler = d.cariler.filter(c => c.id !== 4); }]];
  const g0a = gidisDonus(g0).goruntu;
  for (const [ad, f] of mut) { const d1 = V(); f(d1); const g1 = goruntu(d1);
    T(`A2 [aynı sınıf] ${ad}: paketlenmiş tabanla karşılaştırma doğrudan karşılaştırmayla aynı`, siniflar(karsilastir(g0a, g1)) === siniflar(karsilastir(g0, g1)), karsilastir(g0a, g1).filter(r => r.sinif !== 'KAYMA_YOK')); }
  const b0 = buyuk(1000, 20000, 5000, 500), b1 = kopya(b0); for (let i = 0; i < 30; i++) { const c = b1.cariler[i * 11]; b1.hareketler.push({ id: 'y' + i, cariId: c.id, tip: 'tahsilat', tutar: 33, tur: 'Nakit', tarih: 1, hesapId: 5000, yon: 'in' }); if (i % 3) c.bakiye -= c.tip === 'musteri' ? 33 : -33; }
  const bg0 = goruntu(b0), bg1 = goruntu(b1), bd = karsilastir(bg0, bg1), bp = karsilastir(gidisDonus(bg0).goruntu, bg1);
  T(`A2 [aynı sınıf] büyük veri, 30 işlem (10 kayıplı): ${bd.filter(r => r.sinif !== 'KAYMA_YOK').length} sapma satırı paketlemeyle aynı`, siniflar(bd) === siniflar(bp) && bd.filter(r => r.sinif === 'OLASI_ETKI_KAYBI').length === 10); }

// A3 — özetle eşleştirme YOK: tam imzalar saklanır; aynı imzalı olaylar tekrar sayısıyla korunur
{ const g = goruntu(V()), p = tabanPaketle(g);
  T('A3 [imza] paket olayların TAM imzalarını taşır (özet/hash ile eşleştirme yok; çakışma imkânsız)', JSON.stringify(p.govde.olay.imza) === JSON.stringify(Object.keys(g.olay)) && !('ozet' in p.govde.olay));
  const imza = Object.keys(g.olay).find(k => k.startsWith('H|200|'));
  T('A3 [tekrar] aynı kimlik ve içerikli iki hareket (200) tek imza, tekrar sayısı 2 olarak paketlenir ve geri açılır', g.olay[imza].n === 2 && gidisDonus(g).goruntu.olay[imza].n === 2, g.olay[imza]);
  const d1 = V(); d1.hareketler.push({ id: '200', cariId: 1, tip: 'tahsilat', tutar: 50, tur: 'Nakit', tarih: 1100, hesapId: 10, yon: 'in' }); // metin kimlik, aynı imza
  const r = karsilastir(gidisDonus(g).goruntu, goruntu(d1)).find(x => x.tur === 'cari' && x.id === 1);
  T('A3 [tekrar] aynı imzalı 3. olay (kimlik "200" metin) etkisi kayıpken paketli tabanla da yeni sayılır → OLASI_ETKI_KAYBI', r.sinif === 'OLASI_ETKI_KAYBI' && r.kayma === 50, r);
  const sirasiz = V(); sirasiz.hareketler.reverse(); sirasiz.satislar.reverse();
  T('A3 [sırasız] kayıt sırası farklı aynı veri → paketli taban ile kayma yok', karsilastir(gidisDonus(g).goruntu, goruntu(sirasiz)).every(x => ['KAYMA_YOK', 'IZLENMIYOR'].includes(x.sinif))); }

// A4 — bozuk / tanınmayan paket
{ const p = tabanPaketle(goruntu(V())), boz = (f) => { const x = kopya(p); f(x); return tabanAc(x); };
  const durumlar = [['biçim adı farklı', x => { x.bicim = 'baska'; }, 'TANINMAYAN'], ['paket sürümü 99', x => { x.surum = 99; }, 'TANINMAYAN'], ['motor sürümü farklı', x => { x.motorSurum = 2; }, 'TANINMAYAN'],
    ['gövde yok', x => { delete x.govde; }, 'BOZUK'], ['olay sütunu kısaldı', x => { x.govde.olay.tur.pop(); }, 'BOZUK'], ['tekrar sayısı 0', x => { x.govde.olay.n[0] = 0; }, 'BOZUK'],
    ['aynı imza iki kez', x => { x.govde.olay.imza[1] = x.govde.olay.imza[0]; }, 'BOZUK'], ['tür sözlüğü dışı', x => { x.govde.olay.tur[0] = 99; }, 'BOZUK'], ['cari devri metin', x => { Object.values(x.govde.cari)[0].devir = '5'; }, 'BOZUK'],
    ['tanınmayan gövde alanı', x => { x.govde.fazla = 1; }, 'BOZUK'], ['silme izi listesi yok', x => { delete x.govde.tomb.cekler; }, 'BOZUK'], ['nesne değil', x => { Object.keys(x).forEach(k => delete x[k]); }, 'TANINMAYAN']];
  for (const [ad, f, bek] of durumlar) { const r = boz(f); T(`A4 [paket] ${ad} → ${bek} (görüntü verilmez)`, r.ok === false && r.hata === bek && !r.goruntu, r); }
  T('A4 [paket] boş girdi → BOZUK', tabanAc(null).hata === 'BOZUK' && tabanAc('x').hata === 'BOZUK');
  T('A4 [paket] biçim ve sürüm alanları', p.bicim === PAKET_BICIM && p.surum === PAKET_SURUM && p.motorSurum === MOTOR_SURUM); }

// A5 — yetki ve senkron kanıtı (test edilebilir girdiler; bilinmeyen = yok)
{ const iyi = { kurtarma: 'tamam', admin: true, personelMod: false, musteriMod: false, ornek: false };
  T('A5 [yetki] bütün koşullar → izin', izlemeYetkisi(iyi).izin === true);
  for (const [ad, deg] of [['kurtarma bekliyor', { kurtarma: 'bekliyor' }], ['kurtarma kilitli', { kurtarma: 'kilitli' }], ['yönetici değil', { admin: false }], ['personel modu', { personelMod: true }],
    ['müşteri modu', { musteriMod: true }], ['örnek veri', { ornek: true }], ['personel bilinmiyor', { personelMod: undefined }]])
    T(`A5 [yetki] ${ad} → izin YOK`, izlemeYetkisi({ ...iyi, ...deg }).izin === false);
  T('A5 [yetki] boş girdi → izin yok', izlemeYetkisi(undefined).izin === false);
  const dm = ['cari', 'kasa'], tam = { canli: true, cevrimici: true, yazimlarOnaylandi: true, bellekKalici: true, domenler: dm, sunucudan: { cari: true, kasa: true }, ucluEsit: { cari: true, kasa: true } };
  T('A5 [senkron] sunucudan okunmuş, üçlü eşit, yazımlar onaylı, çevrimiçi → uygun', senkronKaniti(tam).uygun === true);
  for (const [ad, deg] of [['çevrimdışı', { cevrimici: false }], ['bekleyen yazım onaylanmadı', { yazimlarOnaylandi: false }], ['kasa önbellekten (sunucudan değil)', { sunucudan: { cari: true, kasa: false } }],
    ['cari: sunucu ≠ gölge ≠ yerel', { ucluEsit: { cari: false, kasa: true } }], ['bellek ≠ kalıcı kayıt (eski sekme)', { bellekKalici: false }], ['bulut durumu bilinmiyor', { canli: undefined }], ['domen listesi yok', { domenler: [] }]])
    T(`A5 [senkron] ${ad} → uygun DEĞİL (neden bildirilir)`, senkronKaniti({ ...tam, ...deg }).uygun === false && senkronKaniti({ ...tam, ...deg }).nedenler.length > 0);
  T('A5 [senkron] bulut kapalı (bulutsuz) + bellek kalıcı → uygun, bulutsuz işaretli', senkronKaniti({ canli: false, bellekKalici: true }).uygun === true && senkronKaniti({ canli: false, bellekKalici: true }).bulutsuz === true); }

// ===================================================================== B. TARAYICI: GERÇEK CHROMIUM INDEXEDDB =====================================================================
const D = await duzenekKur(ROOT);
const HAZIRLA = async (page) => page.evaluate(async (buyukKaynak) => {
  const Dp = await import('/js/defter-depo.mjs'), Mt = await import('/js/defter-izleme.mjs');
  const z = 1800000000000, dm = ['stok', 'cari', 'kasa', 'satis', 'cek', 'uretim', 'ayar', 'yonetim'], hep = (v) => Object.fromEntries(dm.map(d => [d, v]));
  const ac = (ad) => new Promise((ok, no) => { const r = indexedDB.open(ad); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  window.__T = { D: Dp, M: Mt, acilma: 0, depolar: {}, buyuk: new Function('return ' + buyukKaynak)(),
    Y: { kurtarma: 'tamam', admin: true, personelMod: false, musteriMod: false, ornek: false },
    K: { kurtarma: 'tamam', ornek: false, musteriMod: false, admin: true, personelMod: false, canli: true, domenler: dm, domenAlindi: hep(true), bekleyenYazim: false, sonBirlesim: z - 120000, zaman: z, ardisikOlcumAyni: true },
    SK: { canli: true, cevrimici: true, yazimlarOnaylandi: true, bellekKalici: true, domenler: dm, sunucudan: hep(true), ucluEsit: hep(true) },
    yeni(ad, o = {}) { const or = {}; if (o.kilitsiz) or.locks = null; if (o.tahminsiz) or.storage = null; if (o.tahmin) or.storage = { estimate: async () => o.tahmin }; if (o.sinir) or.sinir = o.sinir;
      if (o.sayac) or.indexedDB = { open: (...a) => { window.__T.acilma++; return indexedDB.open(...a); } };
      return (this.depolar[ad] = Dp.depoOlustur(or)); },
    async dbler() { return ((await indexedDB.databases()) || []).map(x => x.name).sort(); },
    async ham(tablo, fn) { const v = await ac('iqbasics-defter'); try { return await new Promise((ok, no) => { const tx = v.transaction(tablo, 'readwrite'); let s; Promise.resolve(fn(tx.objectStore(tablo))).then(x => { s = x; }); tx.oncomplete = () => ok(s); tx.onerror = () => no(tx.error); }); } finally { v.close(); } },
    async erp() { const ls = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
      const v = await ac('iqbasics'); const kv = await new Promise((ok) => { const tx = v.transaction('kv', 'readonly'), s = tx.objectStore('kv'), k = s.getAllKeys(), d = s.getAll(); tx.oncomplete = () => ok(JSON.stringify([k.result, d.result])); }); v.close();
      return { ls, kv, db: JSON.stringify(db), say: { ...window.__say } }; },
  };
  if (!window.__say) { window.__say = { save: 0, canliYaz: 0, canliYazHemen: 0, idbYaz: 0 }; for (const f of Object.keys(window.__say)) { const o = window[f]; window[f] = function (...a) { window.__say[f]++; return o.apply(this, a); }; } }
}, buyuk.toString());
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const B = D.bulutKur(); const A = await D.cihazAc(B, 'A', 11); await D.yerles(B); await HAZIRLA(A.page);
let erp0 = await ev(A.page, () => __T.erp()), bulut0 = B.surum;
const erpAyni = async (etiket) => { const e = await ev(A.page, () => __T.erp());
  T(`${etiket} [değişmezlik] işletme verisi, localStorage, kurtarma IndexedDB'si ("iqbasics") aynı; save/bulut/IndexedDB-güvence çağrısı 0; sahte buluta yazım 0`,
    e.ls === erp0.ls && e.kv === erp0.kv && e.db === erp0.db && JSON.stringify(e.say) === JSON.stringify(erp0.say) && B.surum === bulut0, { ls: e.ls === erp0.ls, kv: e.kv === erp0.kv, db: e.db === erp0.db, say: [e.say, erp0.say], bulut: [bulut0, B.surum] }); };

// B1 — normal kayıt ve geri okuma
{ const r = await ev(A.page, async () => { const d = __T.yeni('a'), g = __T.M.goruntu(db);
    const k = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: __T.K, senkron: __T.SK, meta: { kurtarmaNesil: 0 } });
    const o = await d.aktifTabanOku(__T.Y), du = await d.durum(__T.Y), ls = await d.tabanlariListele(__T.Y), iki = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: __T.K, senkron: __T.SK });
    const adsiz = JSON.parse(JSON.stringify(g)); Object.values(adsiz.cari).forEach(c => { c.ad = ''; }); Object.values(adsiz.kasa).forEach(h => { h.ad = ''; });
    const kt = await d.kontrolEkle(__T.Y, { tabanId: k.tabanId, zaman: 5, satirlar: __T.M.karsilastir(o.goruntu, __T.M.goruntu(db)) }), kl = await d.kontrolleriOku(__T.Y, { tabanId: k.tabanId });
    return { k, okOk: o.ok, ayni: JSON.stringify(o.goruntu) === JSON.stringify(adsiz), adYok: Object.values(o.goruntu.cari).every(c => c.ad === ''), taban: o.taban, du, ls: ls.tabanlar.length, paketYok: !('paket' in ls.tabanlar[0]), iki: iki.hata,
      kt, kl: kl.kontroller.length, klSatir: kl.kontroller[0].satirlar.length, dbler: await __T.dbler() }; });
  T('B1 [kayıt] taban kaydedildi (sürüm 1, SHA-256 bütünlük özeti, gzip)', r.k.ok && r.k.surum === 1 && /^[0-9a-f]{64}$/.test(r.k.sha) && r.k.boyut > 0 && r.k.boyut < r.k.hamBayt, r.k);
  T('B1 [geri okuma] okunan görüntü kaydedilenle alan alan aynı (yalnız cari/kasa ADLARI saklanmaz)', r.okOk && r.ayni && r.adYok, r);
  T('B1 [durum] 1 taban, aktif sürüm 1, toplam bayt = paket boyutu; liste paketi taşımaz', r.du.tabanSayisi === 1 && r.du.aktif.surum === 1 && r.du.toplamBayt === r.k.boyut && r.ls === 1 && r.paketYok, r.du);
  T('B1 [tekrar] aktif taban varken ikinci "ilk taban" → ZATEN_VAR (yenileme ayrı ve onaylı)', r.iki === 'ZATEN_VAR', r.iki);
  T('B1 [kontrol] kontrol kaydı yazıldı ve okundu; yalnız kayma olmayan dışındaki satırlar saklandı (0)', r.kt.ok && r.kl === 1 && r.klSatir === 0, r);
  T('B1 [ayrı veritabanı] yalnız "iqbasics-defter" eklendi; "iqbasics" yerinde', r.dbler.includes('iqbasics-defter') && r.dbler.includes('iqbasics'), r.dbler);
  await erpAyni('B1'); }

// B2 — bozuk / tanınmayan paket ve şema
{ const r = await ev(A.page, async () => { const d = __T.depolar.a, o = [];
    const id = (await d.durum(__T.Y)).aktif.tabanId, asil = await __T.ham('tabanlar', s => new Promise(ok => { s.get(id).onsuccess = (e) => ok(e.target.result); }));
    const koy = (k) => __T.ham('tabanlar', s => { s.put(k); }), oku = async () => (await d.aktifTabanOku(__T.Y));
    const gz = async (metin) => new Response(new Blob([new TextEncoder().encode(metin)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    const sha = async (metin) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(metin)))].map(b => b.toString(16).padStart(2, '0')).join('');
    const b = new Uint8Array(asil.paket.slice(0)); b[Math.floor(b.length / 2)] ^= 0xff; await koy({ ...asil, paket: b.buffer }); o.push(['bayt bozuldu', (await oku()).hata]);
    await koy({ ...asil, sha: '0'.repeat(64) }); o.push(['SHA-256 uyuşmuyor', (await oku()).hata]);
    const ac = JSON.parse(new TextDecoder().decode(new Uint8Array(await new Response(new Blob([asil.paket]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())));
    for (const [ad, f] of [['biçim tanınmıyor', x => { x.bicim = 'baska'; }], ['paket sürümü 99', x => { x.surum = 99; }], ['olay sütunu bozuk', x => { x.govde.olay.n[0] = -1; }]]) {
      const x = JSON.parse(JSON.stringify(ac)); f(x); const m = JSON.stringify(x); await koy({ ...asil, paket: await gz(m), sha: await sha(m) }); o.push([ad, (await oku()).hata]); }
    await koy({ ...asil, paket: 'metin' }); o.push(['paket alanı ikili değil', (await oku()).hata]);
    await koy(asil); o.push(['asıl kayıt geri konunca', (await oku()).ok]);
    await __T.ham('meta', s => { s.put({ k: 'sema', surum: 2 }); }); const d2 = __T.yeni('sema'); o.push(['şema kaydı sürüm 2', (await d2.durum(__T.Y)).hata]); d2.kapat();
    await __T.ham('meta', s => { s.put({ k: 'sema', surum: 1, olusturma: 0 }); }); o.push(['şema düzeltilince', (await __T.yeni('sema2').durum(__T.Y)).ok]); __T.depolar.sema2.kapat();
    return o; });
  const bek = { 'bayt bozuldu': 'BOZUK', 'SHA-256 uyuşmuyor': 'BOZUK', 'biçim tanınmıyor': 'TANINMAYAN', 'paket sürümü 99': 'TANINMAYAN', 'olay sütunu bozuk': 'BOZUK', 'paket alanı ikili değil': 'BOZUK', 'asıl kayıt geri konunca': true, 'şema kaydı sürüm 2': 'SEMA', 'şema düzeltilince': true };
  for (const [ad, sonuc] of r) T(`B2 [bozuk] ${ad} → ${bek[ad]}`, sonuc === bek[ad], r);
  await erpAyni('B2'); }

// B3 — aynı imzalı olaylar ve paketli tabanla sınıflandırma (gerçek uygulama işlemleri)
{ const r = await ev(A.page, async () => { const o = [];
    const v = { kurUSD: 30, cariler: [{ id: 1, ad: 'X', tip: 'musteri', bakiye: 100 }], hesaplar: [{ id: 10, ad: 'K', bakiye: 0 }], satislar: [],
      hareketler: [{ id: 5, cariId: 1, tip: 'tahsilat', tutar: 10, tur: 'Nakit', tarih: 1, hesapId: 10, yon: 'in' }, { id: '5', cariId: 1, tip: 'tahsilat', tutar: 10, tur: 'Nakit', tarih: 1, hesapId: 10, yon: 'in' }], cekler: [] };
    const d = __T.yeni('imza', { sinir: {} }); await indexedDB.databases();
    const g0 = __T.M.goruntu(v); const v1 = JSON.parse(JSON.stringify(v)); v1.hareketler.push({ id: 5, cariId: 1, tip: 'tahsilat', tutar: 10, tur: 'Nakit', tarih: 1, hesapId: 10, yon: 'in' });
    const p = __T.M.tabanAc(JSON.parse(JSON.stringify(__T.M.tabanPaketle(g0)))).goruntu, im = Object.keys(g0.olay)[0];
    o.push(p.olay[im].n, __T.M.karsilastir(p, __T.M.goruntu(v1)).find(x => x.tur === 'cari').sinif); d.kapat(); return o; });
  T('B3 [imza] tarayıcıda: kimliği 5 ve "5" olan aynı içerikli iki olay tek imza, tekrar 2; üçüncüsü yeni sayılır → OLASI_ETKI_KAYBI', r[0] === 2 && r[1] === 'OLASI_ETKI_KAYBI', r);
  const islemler = [['elle bakiye', (C) => islem.elleBakiye(C, 9001, 575)], ['elle çek', (C) => islem.cekEkle(C, 9002, 150)], ['satış + tahsilat + gider', async (C) => { await islem.satis(C); await islem.tahsilat(C, 9001, 40); await islem.kasaGelirGider(C, 'out', 30); }]];
  for (const [ad, f] of islemler) {
    const C = await D.cihazAc(D.bulutKur(), 'S', 33); await HAZIRLA(C.page);
    await ev(C.page, async () => { const d = __T.yeni('s'); window.__g0 = __T.M.goruntu(db); window.__k = await d.tabanKaydet(__T.Y, { goruntu: window.__g0, kosullar: __T.K, senkron: __T.SK }); });
    await f(C); await bekle(450);
    const x = await ev(C.page, async () => { const o = await __T.depolar.s.aktifTabanOku(__T.Y), g1 = __T.M.goruntu(db), a = __T.M.karsilastir(window.__g0, g1), b = __T.M.karsilastir(o.goruntu, g1);
      const s = (rs) => JSON.stringify(rs.map(r => [r.tur, r.id, r.sinif, r.kayma, r.kalan, r.aciklanan, r.kanit])); return { kayit: window.__k.ok, ayni: s(a) === s(b), sapma: a.filter(r => r.sinif !== 'KAYMA_YOK').map(r => r.tur + '#' + r.id + ':' + r.sinif) }; });
    T(`B3 [aynı sınıf] gerçek işlem "${ad}": depodan okunan tabanla sınıflandırma doğrudan tabanla aynı (${x.sapma.join(', ') || 'kayma yok'})`, x.kayit && x.ayni, x);
    await C.ctx.close(); } }

// B4 — işlem iptali: yarım kayıt yok, otomatik tekrar deneme yok
{ const C = await D.cihazAc(D.bulutKur(), 'I', 34); await HAZIRLA(C.page);
  const r = await ev(C.page, async () => { const d = __T.yeni('i'); await d.durum(__T.Y); /* veritabanı önce oluşur; iptal yalnız YAZIM işlemine uygulanır */ let ekle = 0; const asilAdd = IDBObjectStore.prototype.add, asilPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.add = function (...a) { if (this.name === 'tabanlar') ekle++; return asilAdd.apply(this, a); };
    IDBObjectStore.prototype.put = function (...a) { const q = asilPut.apply(this, a); if (this.name === 'meta' && window.__iptal) this.transaction.abort(); return q; };
    window.__iptal = true; const k = await d.tabanKaydet(__T.Y, { goruntu: __T.M.goruntu(db), kosullar: __T.K, senkron: __T.SK }); window.__iptal = false;
    IDBObjectStore.prototype.add = asilAdd; IDBObjectStore.prototype.put = asilPut;
    const du = await d.durum(__T.Y), sonra = await d.tabanKaydet(__T.Y, { goruntu: __T.M.goruntu(db), kosullar: __T.K, senkron: __T.SK });
    return { k, ekle, du, sonra: sonra.ok }; });
  T('B4 [iptal] işlem ortasında iptal → ISLEM_IPTAL; taban eklenmemiş, aktif taban yok, toplam bayt 0 (yarım kayıt yok)', r.k.hata === 'ISLEM_IPTAL' && r.du.tabanSayisi === 0 && r.du.aktif === null && r.du.toplamBayt === 0, r);
  T('B4 [iptal] otomatik yeniden deneme YOK (tek ekleme girişimi); sonraki elle deneme başarılı', r.ekle === 1 && r.sonra === true, r);
  await C.ctx.close(); }

// B5 — kota. Tahmin (navigator.storage.estimate) kesin garanti DEĞİL: Chromium'da kota sınırlanınca tahmin yine eski kotayı gösterebiliyor
//      (B5b'de ölçülür). Bu yüzden asıl koruma işlem içindeki sınır + kota hatasında GERİ ALMA'dır.
{ const C = await D.cihazAc(D.bulutKur(), 'Q', 35); await HAZIRLA(C.page); const cdp = await C.ctx.newCDPSession(C.page), origin = D.URL0;
  const r0 = await ev(C.page, async () => { const d = __T.yeni('q0', { tahmin: { usage: 900000, quota: 2000000 } }), g = __T.M.goruntu(__T.buyuk(1000, 20000, 5000, 500)); let ekle = 0; const asil = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...a) { if (this.name === 'tabanlar') ekle++; return asil.apply(this, a); };
    const k = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: __T.K, senkron: __T.SK }); IDBObjectStore.prototype.add = asil; const du = await d.durum(__T.Y); d.kapat(); return { k, du, ekle }; });
  T('B5a [kota tahmini] tahmine göre yazım sonrası kullanım kotanın %50\'sini aşacak → KOTA_TAHMIN; yazım HİÇ denenmez', r0.k.hata === 'KOTA_TAHMIN' && r0.ekle === 0 && r0.du.tabanSayisi === 0 && r0.du.toplamBayt === 0, r0);
  await C.ctx.close();
  const tazeSayfa = async (ad, no) => { const X = await D.cihazAc(D.bulutKur(), ad, no); await HAZIRLA(X.page); const cd = await X.ctx.newCDPSession(X.page);
    const u = await ev(X.page, async () => (await navigator.storage.estimate()).usage); await cd.send('Storage.overrideQuotaForOrigin', { origin, quotaSize: u + 60000 }); return { X, cd, sinir: u + 60000 }; };
  const q1 = await tazeSayfa('Q1', 42); // temiz sayfa: izleme veritabanı yok; kota = kullanım + 60 KB; gerçek tahmin
  const r1 = await ev(q1.X.page, async () => { const d = __T.yeni('q1'), g = __T.M.goruntu(__T.buyuk(1000, 20000, 5000, 500)); const k = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: __T.K, senkron: __T.SK });
    const du = await d.durum(__T.Y), o = await d.aktifTabanOku(__T.Y); d.kapat(); return { k, du, okundu: o.ok && !!o.goruntu, est: await navigator.storage.estimate() }; });
  const tam = r1.k.ok && r1.du.tabanSayisi === 1 && r1.du.toplamBayt === r1.k.boyut && r1.okundu, hic = !r1.k.ok && ['KOTA', 'KOTA_TAHMIN'].includes(r1.k.hata) && r1.du.tabanSayisi === 0 && r1.du.aktif === null && r1.du.toplamBayt === 0;
  console.log(`BULGU kota sınırı ${q1.sinir} bayt iken navigator.storage.estimate() kotası ${r1.est.quota} bayt bildirdi (${r1.est.quota > q1.sinir ? 'tahmin GÜNCEL DEĞİL — yanıltıcı' : 'güncel'}); 0,6 MB yazım: ${r1.k.ok ? 'KABUL EDİLDİ' : 'REDDEDİLDİ ' + r1.k.hata}`);
  T(`B5b [kota baskısı, gerçek tahmin] sonuç ATOMİK: ya tam ve okunabilir kayıt ya hiç kayıt — yarım kayıt yok (bu çalıştırmada: ${r1.k.ok ? 'tam kayıt' : 'hiç kayıt, ' + r1.k.hata})`, tam || hic, r1);
  await q1.X.ctx.close();
  const q2 = await tazeSayfa('Q2', 43); // temiz sayfa, tahmin kullanılmaz → yazım denenir, Chromium kotası reddeder
  const r2 = await ev(q2.X.page, async () => { const d = __T.yeni('q2', { tahminsiz: true }), g = __T.M.goruntu(__T.buyuk(1000, 20000, 5000, 500)); const k = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: __T.K, senkron: __T.SK }); const du = await d.durum(__T.Y); return { k, du }; });
  T('B5c [gerçek kota, tahmin yok] kota dolu → KOTA (QuotaExceededError); işlem geri alındı: taban 0, aktif yok, toplam 0', r2.k.hata === 'KOTA' && r2.du.tabanSayisi === 0 && r2.du.aktif === null && r2.du.toplamBayt === 0, r2);
  const C2 = q2.X;
  await q2.cd.send('Storage.overrideQuotaForOrigin', { origin });
  const r3 = await ev(C2.page, async () => { const d = __T.depolar.q2; const k = await d.tabanKaydet(__T.Y, { goruntu: __T.M.goruntu(db), kosullar: __T.K, senkron: __T.SK });
    const s0 = window.__say.save; formKasaHareket(9101); khTur('in'); $('kh-t').value = '10'; $('kh-a').value = 'kota sonrası'; kaydetKasaHareket();
    return { k: k.ok, save: window.__say.save - s0, kalici: JSON.parse(localStorage.getItem('oztekstil_v2')).hareketler.some(h => h.aciklama === 'kota sonrası') }; });
  T('B5d [kota sonrası] otomatik tekrar YOK; kota kalkınca tek elle deneme başarılı; ERP kaydı (save → localStorage) etkilenmeden çalışıyor', r3.k && r3.save === 1 && r3.kalici, r3);
  await C2.ctx.close(); }

// B6 — iki sekme: Web Locks ile ve Web Locks yokken; yenilemede karşılaştır-ve-yaz; diğer sekmeye haber
for (const kilitsiz of [false, true]) {
  const C = await D.cihazAc(D.bulutKur(), kilitsiz ? 'L' : 'W', kilitsiz ? 37 : 36); await HAZIRLA(C.page);
  const P2 = await C.ctx.newPage(); await P2.goto(D.URL0 + '/hazirla'); await ev(P2, () => { window.db = { kurUSD: 30, cariler: [], hesaplar: [] }; }); await HAZIRLA(P2);
  const o = { kilitsiz };
  await Promise.all([C.page, P2].map(p => ev(p, (o) => { const d = __T.yeni('x', o); window.__haber = []; d.dinle(m => window.__haber.push(m)); }, o)));
  const kaydet = (p) => ev(p, async () => (await __T.depolar.x.tabanKaydet(__T.Y, { goruntu: __T.M.goruntu(db), kosullar: __T.K, senkron: __T.SK })).hata || 'ok');
  const [a, b] = await Promise.all([kaydet(C.page), kaydet(P2)]); await bekle(200);
  const du = await ev(C.page, async () => (await __T.depolar.x.durum(__T.Y)));
  const kaybeden = a === 'ok' ? P2 : C.page, haber = await ev(kaybeden, () => window.__haber);
  const ad = kilitsiz ? 'Web Locks YOK' : 'Web Locks ile';
  T(`B6 [iki sekme, ${ad}] aynı anda ilk taban: yalnız biri yazar (${a} / ${b}), tek taban`, [a, b].filter(x => x === 'ok').length === 1 && [a, b].every(x => ['ok', 'KILIT_MESGUL', 'ZATEN_VAR'].includes(x)) && du.tabanSayisi === 1 && du.aktif.surum === 1, { a, b, du });
  T(`B6 [iki sekme, ${ad}] kaybeden sekme "taban değişti" haberini aldı`, haber.some(m => m.tur === 'taban' && m.surum === 1), haber);
  const yen = (p) => ev(p, async () => (await __T.depolar.x.tabanYenile(__T.Y, { goruntu: __T.M.goruntu(db), kosullar: __T.K, senkron: __T.SK, beklenenSurum: 1, onay: true, uyariOnayi: true })).hata || 'ok');
  const [c, e] = await Promise.all([yen(C.page), yen(P2)]); const du2 = await ev(C.page, async () => (await __T.depolar.x.durum(__T.Y)));
  T(`B6 [iki sekme, ${ad}] aynı sürümden iki yenileme: yalnız biri (${c} / ${e}); sürüm 2, eski taban korunmuş (2 taban)`, [c, e].filter(x => x === 'ok').length === 1 && [c, e].every(x => ['ok', 'KILIT_MESGUL', 'CAKISMA'].includes(x)) && du2.aktif.surum === 2 && du2.tabanSayisi === 2, { c, e, du2 });
  if (kilitsiz) T('B6 [iki sekme, Web Locks YOK] koruma yalnız karşılaştır-ve-yaz ile sağlandı (kilit meşgul sonucu yok)', ![a, b, c, e].includes('KILIT_MESGUL'), [a, b, c, e]);
  await C.ctx.close(); }

// B7 — yetkisiz erişim, kurtarma kilidi: hiçbir giriş noktası veritabanını AÇMAZ
{ const C = await D.cihazAc(D.bulutKur(), 'Y', 38); await HAZIRLA(C.page);
  const r = await ev(C.page, async () => { const d = __T.yeni('y', { sayac: true }), g = __T.M.goruntu(db), o = [];
    const kotu = { 'kurtarma bekliyor': { kurtarma: 'bekliyor' }, 'kurtarma kilitli': { kurtarma: 'kilitli' }, 'yönetici değil': { admin: false }, 'personel modu': { personelMod: true }, 'müşteri modu': { musteriMod: true }, 'örnek veri': { ornek: true } };
    const cagri = { tabanKaydet: (y) => d.tabanKaydet(y, { goruntu: g, kosullar: __T.K, senkron: __T.SK }), aktifTabanOku: (y) => d.aktifTabanOku(y), tabanYenile: (y) => d.tabanYenile(y, { goruntu: g, kosullar: __T.K, senkron: __T.SK, beklenenSurum: 1, onay: true, uyariOnayi: true }),
      emekliTabanSil: (y) => d.emekliTabanSil(y, { tabanId: 1, onay: true }), kontrolEkle: (y) => d.kontrolEkle(y, { tabanId: 1, satirlar: [] }), kontrolleriOku: (y) => d.kontrolleriOku(y, {}), tabanlariListele: (y) => d.tabanlariListele(y), durum: (y) => d.durum(y) };
    for (const [ad, deg] of [...Object.entries(kotu), ['yetki bilgisi yok', null]]) for (const [f, c] of Object.entries(cagri)) { const x = await c(deg === null ? undefined : { ...__T.Y, ...deg }); o.push([ad, f, x.hata]); }
    return { o, acilma: __T.acilma, dbler: await __T.dbler() }; });
  T(`B7 [yetki] 7 yetkisiz durum × 8 giriş noktası (${r.o.length} çağrı): hepsi YETKI`, r.o.length === 56 && r.o.every(x => x[2] === 'YETKI'), r.o.filter(x => x[2] !== 'YETKI'));
  T('B7 [yetki] yetkisiz çağrılarda veritabanı HİÇ açılmadı ve "iqbasics-defter" oluşmadı (okuma da yok)', r.acilma === 0 && !r.dbler.includes('iqbasics-defter'), r);
  await C.ctx.close(); }

// B8 — çevrimdışı / eksik senkron / taban koşulları: taban ALINMAZ, veritabanı açılmaz
{ const C = await D.cihazAc(D.bulutKur(), 'O', 39); await HAZIRLA(C.page);
  const r = await ev(C.page, async () => { const d = __T.yeni('o', { sayac: true }), g = __T.M.goruntu(db), o = [];
    const sk = { 'çevrimdışı': { cevrimici: false }, 'yazımlar onaylanmadı': { yazimlarOnaylandi: false }, 'kasa önbellekten': { sunucudan: { ...__T.SK.sunucudan, kasa: false } }, 'satış: sunucu ≠ gölge ≠ yerel': { ucluEsit: { ...__T.SK.ucluEsit, satis: false } },
      'eski sekme belleği': { bellekKalici: false }, 'bulut durumu bilinmiyor': { canli: undefined } };
    const ko = { 'ilk senkron öncesi': { domenAlindi: { cari: true } }, 'gönderilmemiş değişiklik': { bekleyenYazim: true }, 'yeni birleşim': { zaman: __T.K.sonBirlesim + 5000 }, 'ölçüm oturmamış': { ardisikOlcumAyni: false }, 'kurtarma kilidi (koşul)': { kurtarma: 'kilitli' } };
    for (const [ad, x] of Object.entries(sk)) { const k = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: __T.K, senkron: { ...__T.SK, ...x } }); o.push([ad, k.hata, (k.nedenler || []).length]); }
    for (const [ad, x] of Object.entries(ko)) { const k = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: { ...__T.K, ...x }, senkron: __T.SK }); o.push([ad, k.hata, (k.nedenler || []).length]); }
    const bulutsuz = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: { ...__T.K, canli: false }, senkron: { canli: false, bellekKalici: true } }), ls = await d.tabanlariListele(__T.Y);
    return { o, acilmaOnce: o.length, bulutsuz: bulutsuz.ok, bayrak: ls.tabanlar[0] && ls.tabanlar[0].bulutsuz }; });
  T(`B8 [senkron] ${r.o.length} uygunsuz durumun hepsi TABAN_KOSUL (neden bildirilir), taban yazılmadı`, r.o.every(x => x[1] === 'TABAN_KOSUL' && x[2] > 0), r.o);
  T('B8 [senkron] bulut hiç kullanılmıyorsa (bulutsuz) taban alınır ve "bulutsuz" işaretlenir', r.bulutsuz === true && r.bayrak === true, r);
  await C.ctx.close(); }

// B9 — taban yenileme: onay, karşılaştır-ve-yaz, açık uyarı onayı, eski taban korunur, uyarılar devralınır (çözüldü sayılmaz), sınırlar
{ await islem.elleBakiye(A, 9001, 550); await bekle(1500); /* uygulamanın güvence kopyası yazımı 800 ms gecikmeli */ erp0 = await ev(A.page, () => __T.erp()); bulut0 = B.surum; // ERP değişikliği BİLEREK (açıklanamayan kayma üretmek için); depo işlemleri bundan sonra ölçülür
  const r = await ev(A.page, async () => { const d = __T.depolar.a, g = __T.M.goruntu(db), o = {}, Y = __T.Y, K = __T.K, SK = __T.SK;
    const yen = (x) => d.tabanYenile(Y, { goruntu: g, kosullar: K, senkron: SK, ...x });
    o.onaysiz = (await yen({ beklenenSurum: 1 })).hata; o.eskiSurum = (await yen({ beklenenSurum: 0, onay: true })).hata;
    o.kosulsuz = (await d.tabanYenile(Y, { goruntu: g, kosullar: K, senkron: { ...SK, cevrimici: false }, beklenenSurum: 1, onay: true, uyariOnayi: true })).hata;
    const u = await yen({ beklenenSurum: 1, onay: true }); o.uyariOnaysiz = u.hata; o.acik = u.acikUyarilar;
    o.du0 = await d.durum(Y);
    const y1 = await yen({ beklenenSurum: 1, onay: true, uyariOnayi: true }); o.y1 = { ok: y1.ok, surum: y1.surum, devr: y1.devralinanUyarilar };
    const ls1 = (await d.tabanlariListele(Y)).tabanlar; o.ls1 = ls1.map(t => [t.id, t.durum, t.oncekiTabanId, (t.devralinanUyarilar || []).length]);
    const y2 = await yen({ beklenenSurum: 2, onay: true }); o.y2 = { ok: y2.ok, surum: y2.surum, devr: (y2.devralinanUyarilar || []).map(x => x.tur + '#' + x.id + ':' + x.sinif) };
    o.y3 = (await yen({ beklenenSurum: 3, onay: true })).hata;
    const ls = (await d.tabanlariListele(Y)).tabanlar, aktifId = (await d.durum(Y)).aktif.tabanId, emekli = ls.filter(t => t.durum === 'emekli').map(t => t.id);
    o.aktifSil = (await d.emekliTabanSil(Y, { tabanId: aktifId, onay: true })).hata; o.onaysizSil = (await d.emekliTabanSil(Y, { tabanId: emekli[0] })).hata;
    o.sil = (await d.emekliTabanSil(Y, { tabanId: emekli[0], onay: true })).ok; o.y4 = (await yen({ beklenenSurum: 3, onay: true })).surum;
    o.eskiKontrol = (await d.kontrolEkle(Y, { tabanId: emekli[1], satirlar: [] })).hata;
    o.son = await d.durum(Y); o.sonAktif = (await d.aktifTabanOku(Y)).taban; return o; });
  T('B9 [yenileme] onaysız → ONAY_YOK; eski sürüm beklentisi → CAKISMA; senkron uygunsuz → TABAN_KOSUL', r.onaysiz === 'ONAY_YOK' && r.eskiSurum === 'CAKISMA' && r.kosulsuz === 'TABAN_KOSUL', r);
  T('B9 [yenileme] açıklanamayan fark (cari#9001 +50) varken uyarı onayı olmadan → UYARI_ONAYI_YOK, açık uyarı listesiyle; hiçbir şey yazılmadı', r.uyariOnaysiz === 'UYARI_ONAYI_YOK' && r.acik.some(x => x.id === 9001 && x.sinif === 'ACIKLANAMAYAN' && x.kayma === 50) && r.du0.tabanSayisi === 1 && r.du0.aktif.surum === 1, r);
  T('B9 [yenileme] uyarı onayıyla yenilendi: sürüm 2, eski taban SİLİNMEDİ (emekli), uyarı yeni tabana devralındı', r.y1.ok && r.y1.surum === 2 && r.ls1.length === 2 && r.ls1[0][1] === 'emekli' && r.ls1[1][1] === 'aktif' && r.ls1[1][2] === r.ls1[0][0] && r.ls1[1][3] === 1, r.ls1);
  T('B9 [yenileme] yeni farksız yenilemede de eski uyarı DEVRALINMAYA devam eder (çözüldü sayılmaz)', r.y2.ok && r.y2.surum === 3 && r.y2.devr.includes('cari#9001:ACIKLANAMAYAN'), r.y2);
  T('B9 [yenileme] 3 taban sınırında → SINIR_TABAN (eski taban otomatik silinmez)', r.y3 === 'SINIR_TABAN', r.y3);
  T('B9 [yenileme] aktif taban silinemez (GECERSIZ), onaysız silme (ONAY_YOK); onaylı emekli silme sonrası yenileme sürüm 4', r.aktifSil === 'GECERSIZ' && r.onaysizSil === 'ONAY_YOK' && r.sil === true && r.y4 === 4, r);
  T('B9 [yenileme] emekli tabana kontrol yazılamaz → CAKISMA; son durum 3 taban, uyarı hâlâ devralınmış', r.eskiKontrol === 'CAKISMA' && r.son.tabanSayisi === 3 && (r.sonAktif.devralinanUyarilar || []).some(x => x.id === 9001), r.son);
  await erpAyni('B9'); }

// B10 — 500 kontrol sınırı (en eskisi aynı işlemde silinir) ve 25 MB toplam sınırı (test yalnız daha sıkı sınır verebilir)
{ const r = await ev(A.page, async () => { const d = __T.depolar.a, id = (await d.durum(__T.Y)).aktif.tabanId; let son;
    for (let i = 0; i < 505; i++) son = await d.kontrolEkle(__T.Y, { tabanId: id, zaman: i, satirlar: [{ tur: 'cari', id: 1, sinif: 'ACIKLANAMAYAN', kayma: i, kalan: i, kanit: [] }] });
    const kl = (await d.kontrolleriOku(__T.Y, { tabanId: id })).kontroller, du = await d.durum(__T.Y);
    const s = __T.yeni('sinir', { sinir: { toplamBayt: du.toplamBayt + 50 } }), b = await s.kontrolEkle(__T.Y, { tabanId: id, satirlar: [{ tur: 'cari', id: 1, sinif: 'ACIKLANAMAYAN', kayma: 1, kalan: 1, kanit: ['x'.repeat(500)] }] });
    const gevsek = __T.yeni('gevsek', { sinir: { toplamBayt: 1e12, taban: 99, kontrol: 1e6 } }), gd = (await gevsek.durum(__T.Y)).sinir;
    const du2 = await d.durum(__T.Y); s.kapat(); gevsek.kapat();
    return { son: son.ok, sayi: kl.length, enEski: Math.min(...kl.map(k => k.zaman)), duSayi: du.kontrolSayisi, b: b.hata, ayniToplam: du2.toplamBayt === du.toplamBayt, gd }; });
  T('B10 [sınır] 505 kontrol yazıldı; saklanan en çok 500, en eski 5 kayıt silindi', r.son && r.sayi === 500 && r.duSayi === 500 && r.enEski === 5, r);
  T('B10 [sınır] toplam izleme boyutu sınırı aşılacaksa → BOYUT, işlem geri alındı (toplam değişmedi)', r.b === 'BOYUT' && r.ayniToplam, r);
  T('B10 [sınır] sınırlar dışarıdan GEVŞETİLEMEZ (25 MB / 3 taban / 500 kontrol kalır)', r.gd.toplamBayt === 25 * 1024 * 1024 && r.gd.taban === 3 && r.gd.kontrol === 500 && r.gd.kotaOrani === 0.5, r.gd);
  await erpAyni('B10'); }

// B11 — depolamanın silinmesi: açık bağlantı yol verir; sonra "taban yok"; kurtarma veritabanı yerinde
{ const r = await ev(A.page, async () => { const d = __T.depolar.a; await d.durum(__T.Y);
    const sil = await new Promise(ok => { const q = indexedDB.deleteDatabase('iqbasics-defter'); q.onsuccess = () => ok('silindi'); q.onblocked = () => ok('ENGELLENDİ'); q.onerror = () => ok('hata'); });
    const o = await d.aktifTabanOku(__T.Y), du = await d.durum(__T.Y); return { sil, taban: o.taban, ok: o.ok, du, dbler: await __T.dbler() }; });
  T('B11 [silme] tarayıcı izleme veritabanını silince açık bağlantı yol verdi (engellenmedi)', r.sil === 'silindi', r.sil);
  T('B11 [silme] sonra "taban yok" (çökme yok), boş şema yeniden kuruldu; "iqbasics" yerinde', r.ok && r.taban === null && r.du.tabanSayisi === 0 && r.dbler.includes('iqbasics'), r);
  await erpAyni('B11'); }

// B12 — şema: daha yeni sürümle oluşturulmuş veritabanı → SEMA_YENI (hiçbir şey yazılmaz)
{ const C = await D.cihazAc(D.bulutKur(), 'V', 40); await HAZIRLA(C.page);
  const r = await ev(C.page, async () => { await new Promise(ok => { const q = indexedDB.open('iqbasics-defter', 5); q.onupgradeneeded = () => q.result.createObjectStore('baska'); q.onsuccess = () => { q.result.close(); ok(); }; });
    const d = __T.yeni('v'); return [(await d.durum(__T.Y)).hata, (await d.tabanKaydet(__T.Y, { goruntu: __T.M.goruntu(db), kosullar: __T.K, senkron: __T.SK })).hata]; });
  T('B12 [şema] daha yeni sürümlü izleme veritabanı → SEMA_YENI (okuma ve yazma yapılmaz)', r[0] === 'SEMA_YENI' && r[1] === 'SEMA_YENI', r);
  await C.ctx.close(); }

// B13 — gerçek paket boyutları (tarayıcıda, gzip + SHA-256)
{ const C = await D.cihazAc(D.bulutKur(), 'Z', 41); await HAZIRLA(C.page);
  for (const [nC, nH, nS, nCek] of [[1000, 20000, 5000, 500], [5000, 100000, 30000, 3000], [10000, 200000, 60000, 5000]]) {
    const r = await ev(C.page, async ([nC, nH, nS, nCek]) => { await new Promise(ok => { const q = indexedDB.deleteDatabase('iqbasics-defter'); q.onsuccess = q.onerror = q.onblocked = () => ok(); });
      const v = __T.buyuk(nC, nH, nS, nCek), erp = JSON.stringify(v).length, g = __T.M.goruntu(v), ham = JSON.stringify(g).length, t0 = performance.now();
      const d = __T.yeni('z'), k = await d.tabanKaydet(__T.Y, { goruntu: g, kosullar: __T.K, senkron: __T.SK }), t1 = performance.now(), o = await d.aktifTabanOku(__T.Y), t2 = performance.now(); d.kapat();
      return { erp, ham, k, yaz: t1 - t0, oku: t2 - t1, okOk: o.ok }; }, [nC, nH, nS, nCek]);
    const mb = (x) => (x / 1048576).toFixed(2) + ' MB';
    console.log(`BOYUT ${nC} cari × ${nH} hareket + ${nS} satış + ${nCek} çek: ERP verisi ${mb(r.erp)} · görüntü ${mb(r.ham)} · paket (gzip) ${mb(r.k.boyut || 0)} · kaydet ${r.yaz.toFixed(0)} ms · oku ${r.oku.toFixed(0)} ms`);
    T(`B13 [boyut] ${nC} cari: paket kaydedilip okundu ve 25 MB sınırının altında (${mb(r.k.boyut || 0)})`, r.k.ok && r.okOk && r.k.boyut < 25 * 1024 * 1024, r.k); }
  await C.ctx.close(); }

T('B [altyapı] sayfa hatası yok (ana cihaz)', A.hatalar.length === 0, A.hatalar.slice(0, 3));
T('ORTAM sahte Firestore; gerçek Firebase/Auth sunucularına istek denemesi bile yok', ![...D.disari].some(h => GERCEK_FIREBASE.test(h)), [...D.disari]);
await D.kapat();
console.log(`${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
