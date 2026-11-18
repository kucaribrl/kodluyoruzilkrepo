// R2.1.2 — Eski renkler için rid geçişi SİMÜLASYONU (yalnız test/dry-run; GERÇEK VERİ GEÇİŞİ DEĞİLDİR).
//
// Bu modül:
//  - Yalnız çağıranın verdiği düz JavaScript nesneleriyle çalışır; uygulama verisine, Firebase'e, DOM'a, tarayıcı deposuna,
//    ağa veya dosya sistemine erişmez ve üretim koduna (index.html) bağlı değildir.
//  - Girdiyi asla değiştirmez; bütün sonuçlar derin kopyalar üzerinde üretilir.
//  - Rastgelelik ve gerçek zaman kullanmaz; kimlikler dışarıdan enjekte edilen sağlayıcıdan gelir (testte deterministik).
//    Gerçek geçişte güvenli rastgele UUID kullanılmalıdır; UUID v4 biçiminde olmayan kimlikler "test kimliği" olarak işaretlenir.
//  - Kanonik parmak izi, anahtar sırasından bağımsız tam metin karşılaştırmasıdır (özet/hash değildir, çakışma yoktur);
//    yine de istemci tarafı karşılaştırma, sunucu tarafı transaction / sürüm önkoşulu garantisi VERMEZ.
//  - Rollback simülasyonu yalnız bu dry-run'ın eklediği rid'leri geri alır; gerçek Firestore geri dönüşü için güvence değildir
//    (R2.2 sonrasında rid kullanan kayıtlar varsa rid silmek tehlikelidir).

const UUID4 = /^r_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const lc = (x) => String(x == null ? '' : x).trim().toLocaleLowerCase('tr-TR');
const kopya = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const renkMi = (r) => !!r && typeof r === 'object';

/** Kanonik metin: nesne anahtarları sıralı, dizi sırası korunur, undefined alanlar atlanır. Tam metin olduğu için çakışmaz. */
export function kanonik(x) {
  if (x === null || typeof x !== 'object') return x === undefined ? 'null' : JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(kanonik).join(',') + ']';
  return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + kanonik(x[k])).join(',') + '}';
}
const kaynakMetni = (veri) => kanonik({ urunler: veri.urunler || [], satislar: veri.satislar || [], transferler: veri.transferler || [], isemirleri: veri.isemirleri || [], bekleyenPortal: veri.bekleyenPortal || [] });
const siniflandirmaMetni = (s) => kanonik(((s && s.renkler) || []).map(x => ({ urunId: x.urunId, urunKod: x.urunKod, renk: x.renk, sinif: x.sinif, sorunlar: (x.sorunlar || []).map(y => y.kod), uyarilar: (x.uyarilar || []).map(y => y.kod) })));
const kararMetni = (k) => kanonik(k || []);
const kayitMetni = (veri) => kanonik({ satislar: veri.satislar || [], transferler: veri.transferler || [], isemirleri: veri.isemirleri || [], bekleyenPortal: veri.bekleyenPortal || [] });

/** Konum + içerik parmak izine dayalı renk referansları (ada dayanmaz). */
export function renkReferanslari(veri) {
  const out = [];
  (veri.urunler || []).forEach((u, ui) => {
    if (!u || typeof u !== 'object') return;
    (u.renkler || []).forEach((r, ri) => { if (renkMi(r)) out.push({ urunIdx: ui, renkIdx: ri, urunId: u.id === undefined ? null : u.id, renkAd: String(r.ad || ''), renkParmak: kanonik(r) }); });
  });
  return out;
}
const refAnahtar = (r) => r.urunIdx + ':' + r.renkIdx;
const refCoz = (veri, ref) => {
  const u = (veri.urunler || [])[ref.urunIdx]; const r = u && (u.renkler || [])[ref.renkIdx];
  if (!u || !renkMi(r)) return { hata: 'referans yok (ürün/renk sırası değişmiş)' };
  if ((u.id === undefined ? null : u.id) !== ref.urunId) return { hata: 'ürün kimliği / sırası değişmiş' };
  if (kanonik(r) !== ref.renkParmak) return { hata: 'renk içeriği değişmiş' };
  return { u, r };
};

function urunKimlikSorunlari(veri) {
  const n = [], say = new Map();
  (veri.urunler || []).forEach((u, i) => { if (!u || u.id === undefined || u.id === null || u.id === '') n.push('ürün kimliği yok (sıra ' + i + ')'); else say.set(String(u.id), (say.get(String(u.id)) || 0) + 1); });
  say.forEach((c, id) => { if (c > 1) n.push('ürün kimliği mükerrer: ' + id); });
  (veri.urunler || []).forEach((u, i) => (u && u.renkler || []).forEach((r, j) => { if (renkMi(r) && !lc(r.ad)) n.push('renk adı boş (ürün sıra ' + i + ', renk ' + j + ')'); }));
  return n;
}

/**
 * Geçiş planı. Girdi: { veri, siniflandirma (Ders 41 renkGecisHazirlikDenetle çıktısı), kararlar, kimlikSaglayici }.
 * karar: { ref: renkReferanslari öğesi, karar: 'ONAY'|'RED', gerekce, kanit: [], karariVeren, zaman }.
 */
export function gecisPlaniOlustur({ veri, siniflandirma, kararlar = [], kimlikSaglayici }) {
  const plan = { surum: 1, kaynakParmak: kaynakMetni(veri), siniflandirmaParmak: siniflandirmaMetni(siniflandirma), kararParmak: kararMetni(kararlar),
    atamalar: [], renkler: [], reddedildi: false, redNedenleri: [], testKimligiKullanildi: false };
  const red = (m) => { plan.reddedildi = true; if (!plan.redNedenleri.includes(m)) plan.redNedenleri.push(m); };
  urunKimlikSorunlari(veri).forEach(red);
  if (typeof kimlikSaglayici !== 'function') red('kimlik sağlayıcı verilmedi');
  // sınıflandırma (ürün kimliği + tam renk adı) → konum referansına bağlanır; birden fazla renk aynı anahtara düşerse BELİRSİZ
  const sinifMap = new Map();
  ((siniflandirma && siniflandirma.renkler) || []).forEach(x => { const k = String(x.urunId) + '|' + String(x.renk); sinifMap.set(k, (sinifMap.get(k) || []).concat([x])); });
  const refs = renkReferanslari(veri), adSay = new Map();
  refs.forEach(r => { const k = String(r.urunId) + '|' + r.renkAd; adSay.set(k, (adSay.get(k) || 0) + 1); });
  const kararMap = new Map();
  (kararlar || []).forEach((k, i) => {
    if (!k || !k.ref) return red('karar ' + i + ': referans yok');
    const c = refCoz(veri, k.ref); if (c.hata) return red('karar ' + i + ' geçersiz: ' + c.hata);
    if (kararMap.has(refAnahtar(k.ref))) return red('aynı renk için birden fazla karar (karar ' + i + ')');
    kararMap.set(refAnahtar(k.ref), k);
  });
  const mevcutRid = new Set(); (veri.urunler || []).forEach(u => (u && u.renkler || []).forEach(r => { if (renkMi(r) && r.rid) mevcutRid.add(r.rid); }));
  const planRid = new Set();
  refs.forEach(ref => {
    const c = refCoz(veri, ref), r = c.r, k = kararMap.get(refAnahtar(ref));
    const e = { ref, urunId: ref.urunId, renkAd: ref.renkAd, sinif: null, durum: '', neden: '', karar: k ? k.karar : null };
    plan.renkler.push(e);
    if (r.rid) { e.durum = 'ATLANDI'; e.neden = 'mevcut rid korunur'; return; }
    const anahtar = String(ref.urunId) + '|' + ref.renkAd, s = sinifMap.get(anahtar) || [];
    if (s.length !== 1 || adSay.get(anahtar) !== 1) {
      e.durum = 'BEKLIYOR'; e.neden = 'renk belirsiz: sınıflandırma bu renge tek başına bağlanamıyor (' + s.length + ' kayıt, ' + adSay.get(anahtar) + ' renk)';
      if (k && k.karar === 'ONAY') red('belirsiz renge onay verilmiş: ' + anahtar);
      return;
    }
    e.sinif = s[0].sinif;
    if (e.sinif === 'ENGELLI') { e.durum = 'ENGELLI'; e.neden = 'ENGELLI renk hiçbir koşulda geçişe alınmaz'; return; }
    if (!k) { e.durum = 'BEKLIYOR'; e.neden = 'açık onay kararı yok' + (e.sinif === 'ADAY' ? ' (ADAY otomatik onay değildir)' : ' (ELLE_MUTABAKAT için gerekçe + kanıtlı onay gerekir)'); return; }
    if (k.karar !== 'ONAY') { e.durum = 'ATLANDI'; e.neden = 'yönetici onaylamadı'; return; }
    if (e.sinif === 'ELLE_MUTABAKAT') {
      const g = String(k.gerekce || '').trim(), kn = Array.isArray(k.kanit) ? k.kanit.filter(x => String(x || '').trim()) : [];
      if (!g || !kn.length) { e.durum = 'BEKLIYOR'; e.neden = 'ELLE_MUTABAKAT için gerekçe ve eşleşme kanıtı zorunlu'; return; }
    } else if (e.sinif !== 'ADAY') { e.durum = 'BEKLIYOR'; e.neden = 'bilinmeyen sınıf: ' + e.sinif; return; }
    if (plan.reddedildi || typeof kimlikSaglayici !== 'function') { e.durum = 'BEKLIYOR'; e.neden = 'plan reddedildi'; return; }
    const rid = kimlikSaglayici();
    if (typeof rid !== 'string' || !/^r_[A-Za-z0-9_-]+$/.test(rid)) { red('geçersiz kimlik üretildi'); e.durum = 'BEKLIYOR'; e.neden = 'geçersiz kimlik'; return; }
    if (mevcutRid.has(rid)) { red('üretilen kimlik mevcut bir rid ile çakışıyor: ' + rid); e.durum = 'BEKLIYOR'; e.neden = 'kimlik çakışması'; return; }
    if (planRid.has(rid)) { red('plan içinde aynı rid iki kez üretildi: ' + rid); e.durum = 'BEKLIYOR'; e.neden = 'kimlik çakışması'; return; }
    planRid.add(rid); if (!UUID4.test(rid)) plan.testKimligiKullanildi = true;
    e.durum = 'UYGUN'; e.neden = e.sinif === 'ADAY' ? 'ADAY + açık onay' : 'ELLE_MUTABAKAT + gerekçe + kanıt'; e.rid = rid;
    plan.atamalar.push({ ref, rid, karar: { karariVeren: k.karariVeren || '', zaman: k.zaman == null ? null : k.zaman, gerekce: String(k.gerekce || ''), kanit: kopya(k.kanit || []) } });
  });
  if (plan.reddedildi) { plan.atamalar = []; plan.renkler.forEach(e => { if (e.durum === 'UYGUN') { e.durum = 'BEKLIYOR'; e.neden = 'plan reddedildi'; delete e.rid; } }); }
  return plan;
}

/** Stok/lokasyon özeti — toplam değil, ürün → renk → alan → lokasyon bazında birebir değerler. */
export function gecisStokOzeti(veri) {
  return (veri.urunler || []).map(u => ({ urunId: u && u.id, renkler: ((u && u.renkler) || []).map(r => renkMi(r)
    ? { ad: r.ad, stok: r.stok === undefined ? null : r.stok, loklar: kopya(r.loklar || {}), kirik: kopya(r.kirik || null), kirikLok: kopya(r.kirikLok || null), defo: r.defo === undefined ? null : r.defo }
    : { eskiBicim: r }) }));
}

/** Derin fark: rid dışındaki her alan ve sıra birebir korunmalı; rid yalnız planlanan, önceden kimliksiz renge, planlanan değerle eklenebilir. */
export function gecisFarkDogrula(once, sonra, plan) {
  const izin = new Map(); ((plan && plan.atamalar) || []).forEach(a => izin.set(refAnahtar(a.ref), a.rid));
  const izinsizFarklar = [], eklenenRid = [];
  const U0 = once.urunler || [], U1 = sonra.urunler || [];
  if (kanonik({ ...once, urunler: null }) !== kanonik({ ...sonra, urunler: null })) izinsizFarklar.push('ürün dışı kayıtlar (satış/transfer/iş emri/portal) değişmiş');
  if (U0.length !== U1.length) izinsizFarklar.push('ürün sayısı değişmiş');
  U0.forEach((u0, i) => {
    const u1 = U1[i]; if (!u1) return;
    if (kanonik({ ...u0, renkler: null }) !== kanonik({ ...u1, renkler: null })) izinsizFarklar.push('ürün ' + i + ': ürün metadata / kimlik / _m / sıra değişmiş');
    const R0 = u0.renkler || [], R1 = u1.renkler || [];
    if (R0.length !== R1.length) izinsizFarklar.push('ürün ' + i + ': renk sayısı değişmiş');
    R0.forEach((r0, j) => {
      const r1 = R1[j]; if (r1 === undefined) return;
      if (!renkMi(r0) || !renkMi(r1)) { if (kanonik(r0) !== kanonik(r1)) izinsizFarklar.push('ürün ' + i + ' renk ' + j + ': değişmiş'); return; }
      const k = i + ':' + j, beklenen = izin.get(k);
      if (r0.rid !== r1.rid) {
        if (r0.rid === undefined && beklenen !== undefined && r1.rid === beklenen) eklenenRid.push({ urunIdx: i, renkIdx: j, rid: r1.rid });
        else izinsizFarklar.push('ürün ' + i + ' renk ' + j + ': rid izinsiz değişmiş');
      }
      const alanlar = new Set([...Object.keys(r0), ...Object.keys(r1)]); alanlar.delete('rid');
      alanlar.forEach(a => { if (kanonik(r0[a]) !== kanonik(r1[a])) izinsizFarklar.push('ürün ' + i + ' renk ' + j + ': ' + a + ' değişmiş'); });
    });
  });
  return { izinsizFarklar, eklenenRid };
}

/** Önkoşul: plan anındaki snapshot (A) ile yazma öncesi snapshot (B) aynı mı? Değilse nedenleriyle reddet. */
export function gecisOnKosulKontrol({ plan, veri, siniflandirma, kararlar }) {
  const nedenler = [];
  if (!plan || plan.reddedildi) nedenler.push('plan yok veya reddedilmiş');
  if (plan && siniflandirmaMetni(siniflandirma) !== plan.siniflandirmaParmak) nedenler.push('sınıflandırma değişmiş');
  if (plan && kararMetni(kararlar) !== plan.kararParmak) nedenler.push('yönetici kararı değişmiş');
  if (plan && kaynakMetni(veri) !== plan.kaynakParmak) {
    const A = JSON.parse(plan.kaynakParmak);
    if (kayitMetni(A) !== kayitMetni(veri)) nedenler.push('geçmiş kayıtlar / açık yükümlülükler değişmiş');
    const U0 = A.urunler || [], U1 = veri.urunler || [];
    if (U0.length !== U1.length || U0.some((u, i) => !U1[i] || kanonik(u.id) !== kanonik(U1[i].id) || (u.renkler || []).length !== ((U1[i].renkler) || []).length)) nedenler.push('ürün / renk sayısı veya sırası değişmiş');
    U0.forEach((u0, i) => { const u1 = U1[i]; if (!u1) return;
      if (kanonik(u0._m) !== kanonik(u1._m)) nedenler.push('ürün sürüm damgası (_m) değişmiş: ' + (u0.id));
      if (kanonik({ ...u0, renkler: null, _m: null }) !== kanonik({ ...u1, renkler: null, _m: null })) nedenler.push('ürün metadata değişmiş: ' + u0.id);
      (u0.renkler || []).forEach((r0, j) => { const r1 = (u1.renkler || [])[j]; if (!renkMi(r0) || !renkMi(r1)) return;
        if (lc(r0.ad) !== lc(r1.ad) || r0.ad !== r1.ad) nedenler.push('renk sırası veya adı değişmiş: ürün ' + u0.id + ' renk ' + j);
        if (kanonik(r0.barkod) !== kanonik(r1.barkod)) nedenler.push('renk barkodu değişmiş: ürün ' + u0.id + ' renk ' + j);
        if (['stok', 'loklar', 'kirik', 'kirikLok', 'defo'].some(a => kanonik(r0[a]) !== kanonik(r1[a]))) nedenler.push('stok / lokasyon / kırık / defo değişmiş: ürün ' + u0.id + ' renk ' + j);
        if (kanonik(r0.rid) !== kanonik(r1.rid)) nedenler.push('rid değişmiş: ürün ' + u0.id + ' renk ' + j); }); });
    if (!nedenler.length) nedenler.push('kaynak veri değişmiş');
  }
  return { gecerli: nedenler.length === 0, nedenler: [...new Set(nedenler)] };
}

/** Dry-run: önkoşulu doğrular, derin kopya üzerinde rid ekler, fark ve stok bütünlüğünü raporlar. Girdiyi değiştirmez. */
export function gecisDryRun({ veri, plan, siniflandirma, kararlar }) {
  const ok = gecisOnKosulKontrol({ plan, veri, siniflandirma, kararlar });
  const baslangicOzet = { urun: (veri.urunler || []).length, renk: renkReferanslari(veri).length, kimlikli: renkReferanslari(veri).filter(r => JSON.parse(r.renkParmak).rid).length, kaynakParmakUzunluk: kaynakMetni(veri).length };
  const grup = (d) => ((plan && plan.renkler) || []).filter(e => e.durum === d).map(e => ({ urunId: e.urunId, renkAd: e.renkAd, neden: e.neden }));
  const cikti = { reddedildi: false, durdurmaNedenleri: [], baslangicOzet, atananlar: [], atlananlar: grup('ATLANDI'), bekleyenler: grup('BEKLIYOR'), engelliler: grup('ENGELLI'),
    sonuc: null, fark: null, stokBirebir: false, denetimIzi: [], riskler: [], sonParmak: null, testKimligiKullanildi: !!(plan && plan.testKimligiKullanildi) };
  if (!ok.gecerli) { cikti.reddedildi = true; cikti.durdurmaNedenleri = ok.nedenler; return cikti; }
  const sonuc = kopya(veri);
  for (const a of plan.atamalar) {
    const c = refCoz(sonuc, a.ref);
    if (c.hata || c.r.rid) { cikti.reddedildi = true; cikti.durdurmaNedenleri.push('atama yapılamadı: ' + (c.hata || 'renkte zaten rid var')); return { ...cikti, sonuc: null }; }
    c.r.rid = a.rid;
    cikti.atananlar.push({ urunId: a.ref.urunId, renkAd: a.ref.renkAd, rid: a.rid });
    cikti.denetimIzi.push({ urunId: a.ref.urunId, renkAd: a.ref.renkAd, rid: a.rid, karariVeren: a.karar.karariVeren, zaman: a.karar.zaman, gerekce: a.karar.gerekce, kanit: a.karar.kanit });
  }
  const fark = gecisFarkDogrula(veri, sonuc, plan);
  cikti.fark = fark; cikti.stokBirebir = kanonik(gecisStokOzeti(veri)) === kanonik(gecisStokOzeti(sonuc));
  if (fark.izinsizFarklar.length || !cikti.stokBirebir || fark.eklenenRid.length !== plan.atamalar.length) { cikti.reddedildi = true; cikti.durdurmaNedenleri.push('bütünlük doğrulaması başarısız'); return { ...cikti, sonuc: null }; }
  cikti.sonuc = sonuc; cikti.sonParmak = kaynakMetni(sonuc);
  if (cikti.testKimligiKullanildi) cikti.riskler.push('Test kimliği kullanıldı (UUID v4 değil) — bu sonuç gerçek geçişte KULLANILAMAZ');
  if (cikti.bekleyenler.length) cikti.riskler.push(cikti.bekleyenler.length + ' renk karar/mutabakat bekliyor');
  cikti.riskler.push('İstemci tarafı önkoşul, sunucu transaction / sürüm garantisi değildir');
  return cikti;
}

/** Bellekte sentetik yedek (derin kopya + parmak izi). */
export function gecisYedekAl(veri) { return { veri: kopya(veri), parmak: kaynakMetni(veri) }; }

/** Rollback simülasyonu: yalnız bu dry-run'ın eklediği rid'leri kaldırır; araya değişiklik girdiyse reddeder; ikinci kez güvenli. */
export function gecisGeriDonusSimuleEt({ veri, plan, dryRun }) {
  if (!dryRun || dryRun.reddedildi || !dryRun.sonParmak) return { basarili: false, veri: null, nedenler: ['geçerli dry-run sonucu yok'] };
  const simdi = kaynakMetni(veri);
  if (simdi === plan.kaynakParmak) return { basarili: true, zatenGeriAlinmis: true, veri: kopya(veri), nedenler: [] };
  if (simdi !== dryRun.sonParmak) return { basarili: false, veri: null, nedenler: ['dry-run sonrasında veri değişmiş — körlemesine geri dönüş yapılmaz'] };
  const geri = kopya(veri);
  for (const a of plan.atamalar) {
    const u = geri.urunler[a.ref.urunIdx], r = u && u.renkler[a.ref.renkIdx];
    if (!renkMi(r) || r.rid !== a.rid) return { basarili: false, veri: null, nedenler: ['beklenen rid bulunamadı'] };
    delete r.rid;
  }
  if (kaynakMetni(geri) !== plan.kaynakParmak) return { basarili: false, veri: null, nedenler: ['geri dönüş başlangıç snapshot\'ını vermedi'] };
  return { basarili: true, zatenGeriAlinmis: false, veri: geri, nedenler: [] };
}
