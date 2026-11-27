// Ders 50.3c-1 — DEFTER KAYMASI İZLEME MOTORU. TEK DOĞRULUK KAYNAĞI: js/defter-izleme.mjs
// Test 35 ve test 36 bu dosyayı doğrudan kullanır (testte ikinci bir hesaplama YOK).
// Uygulama (index.html) bu aşamada motoru YÜKLEMEZ ve ÇAĞIRMAZ; ekran, otomatik kontrol ve kalıcı kayıt YOK.
//
// SAF ve SALT OKUNUR: girdiyi değiştirmez; ağ, dosya, DOM, depolama (localStorage / IndexedDB), Firebase, saat ve rastgelelik
// KULLANMAZ. Zaman gerekiyorsa çağıran verir. Çıktılar düz, JSON'a çevrilebilir yeni nesnelerdir (girdiye referans tutmaz).
// Motor HİÇBİR ZAMAN bakiye düzeltmez, işlem silmez, "kesin kayıp" demez.
//
// ÖLÇÜLER (uygulamayla aynı tanım; test 35 her senaryoda cariEkstre().devir ile eşitliği denetler):
//   Cari devri  D(c) = bakiye − (satış/hareket kayıtlarından net)          — cariEkstre()
//   Kasa farkı  F(h) = bakiye − Σ hareket (hesapId = h; in +, out −)       — defterKontrolAc()
//   Kayma = son görüntü − başlangıç görüntüsü. Kayıt dışı değişiklik ya da etki kaybı yoksa kayma 0'dır.
//
// BİLİNEN KAYIT DIŞI DEĞİŞİKLİKLER (kanıt bileşenleri; her biri görüntüdeki bir durum fonksiyonu, kayma payı = son − başlangıç):
//   çek    (K2 elle çek, K3 çek düzeltme, K4 çek silme, K5 karşılıksız, K6 kur farkı):
//          Σ cariIsle çek (karşılıksız değilse) −tutar + Σ kurFarki + kayıtlı karşılık (+tutar: satışa bağlı çek ya da
//          kaydetOdeme'nin "Çek"/"Kredi Kartı" hareketi). Çek kaydı silme izi (_tomb) olmadan kaybolduysa kanıt EKSİK.
//          Karşılık hareketi yalnız aynı carideki AYNI tutarlı yeni (elle olmayan) çekle eşleşirse kabul edilir; eşsiz yeni karşılık,
//          karşılığı olmayan yeni tahsilat/satış çeki ya da kaybolan karşılık hareketi → kanıt EKSİK (kayıp, kanıt benzerliğiyle
//          "açıklanan" sayılmaz). Elle çek, Çek formunun yazdığı kurTakip alanından tanınır.
//   fason  (K7): iş emri duraklarındaki borclanan toplamı (borç hangi fasona yazıldıysa)
//   taksit (K9): satışın ödenmiş taksit toplamı AZALDI ama ödenen ve satış tutarı AYNI (plan kaldırıldı / yeniden kuruldu).
//          Ödenmiş taksit ile ödenen BİRLİKTE geri gittiyse (eski belge üzerine yazmış olabilir) ya da satış/plan bilgisi
//          kaybolduysa kanıt BELİRSİZ → SINIFLANDIRILAMADI (kayma 0 olsa bile).
//   nakit iade (iade akışı): kasaHareket ile cariye bağlı yazılan tipsiz "İade" / "İade iptali" hareketi cariEkstre'de
//          borç/alacak olarak görünür ama cari bakiyesi değişmez → bu hareketin ekstre etkisi kayma sayılmaz.
//   kur    (K10): kur bilgisi (satisKur) olmayan dövizli satışın ekstre tutarı güncel kura göre değişir
//   eski biçim (K12, yalnız kasa): ödeme listesi olmayan eski satışta odemeHesapId → iptal/düzenlemede kasa hareketsiz düşer
// KANITSIZ (doğru olarak "açıklanamayan" görünür): K1 cari formunda elle bakiye, K8 ürün kartından tedarikçiye borç.
// İZLENMEYEN: K11 USD cari (bakiye bakiyeUSD'de, hareketler TL'de) — ayrı bir döviz defteri gerekir.
//
// SINIFLAR (uyarı gerektirenler: OLASI_ETKI_KAYBI, ACIKLANAMAYAN, SINIFLANDIRILAMADI):
//   KAYMA_YOK, YENI_KAYIT (başlangıçta olmayan kayıt: açılış bakiyesi), ACIKLANAN (kayma bilinen kanıtlarla tam açıklanıyor),
//   OLASI_ETKI_KAYBI (açıklanamayan kalan, yeni kayıtlı olayların bir alt kümesine eşit — "olabilir", kesin değil),
//   ACIKLANAMAYAN (kalan hiçbir şeyle eşleşmiyor), SINIFLANDIRILAMADI (kanıt eksik / belirsiz: yanlış kesinlik üretilmez),
//   IZLENMIYOR (USD cari; silinmiş kayıt).
// Kimliklerin sıralı ya da benzersiz olduğu VARSAYILMAZ: "yeni olay" kimlik sınırıyla değil, olay imzalarının (kimlik + içerik)
// çoklu kümesiyle bulunur; aynı kimlikli cari/kasa/çek belirsizlik sayılır.

export const MOTOR_SURUM = 1;
export const ESIK = 0.005;
export const SINIF = Object.freeze({
  KAYMA_YOK: 'KAYMA_YOK', YENI_KAYIT: 'YENI_KAYIT', ACIKLANAN: 'ACIKLANAN', OLASI_ETKI_KAYBI: 'OLASI_ETKI_KAYBI',
  ACIKLANAMAYAN: 'ACIKLANAMAYAN', SINIFLANDIRILAMADI: 'SINIFLANDIRILAMADI', IZLENMIYOR: 'IZLENMIYOR',
});
const UYARI = Object.freeze([SINIF.OLASI_ETKI_KAYBI, SINIF.ACIKLANAMAYAN, SINIF.SINIFLANDIRILAMADI]);
export const UYARI_SINIFLARI = Object.freeze({ has: (s) => UYARI.includes(s), liste: UYARI });
export const KALICILIK = Object.freeze({ BEKLEMEDE: 'BEKLEMEDE', TEKRARLAYAN_SUPHE: 'TEKRARLAYAN_SUPHE' });
export const IZLEME_KURAL = Object.freeze({ enAzKontrol: 2, enAzSureMs: 10 * 60 * 1000, birlesimSakinMs: 60 * 1000 });
export const ALT_KUME_SINIRI = 14; // tam alt küme araması en çok 14 aday (2^14); fazlasında yalnız tekli ve ikili eşleşme

const r2 = (x) => Math.round(x * 100) / 100;
const kurus = (x) => Math.round(x * 100);
const sonlu = (x) => typeof x === 'number' && Number.isFinite(x);
const anahtar = (id) => (id === null || id === undefined ? null : String(id));
const liste = (x) => (Array.isArray(x) ? x : []);
const nesne = (x) => x !== null && typeof x === 'object';

function cariGiris(c) {
  return { id: c.id, ad: String(c.ad || ''), tip: c.tip, doviz: c.doviz === 'USD' ? 'USD' : 'TL', bakiye: c.bakiye || 0, net: 0, gecersiz: false, cift: false,
    E: { cek: 0, fason: 0, iade: 0 }, cekler: [], karsilik: [], fason: {}, taksitSatis: {}, kursuz: {}, kurBagimliTaksit: false, cekCift: false };
}

// Görüntü: verinin o anki ölçüm ve kanıt özeti. Her liste TEK geçişte taranır (cari × kayıt karmaşıklığı YOK).
export function goruntu(d) {
  d = nesne(d) ? d : {};
  const kurUSD = d.kurUSD, kurEUR = d.kurEUR;
  const div = (s) => s.satisKur || (s.pb === 'USD' ? kurUSD : s.pb === 'EUR' ? kurEUR : 1); // satisDiv() ile aynı
  const g = { motorSurum: MOTOR_SURUM, kur: { USD: +kurUSD || null, EUR: +kurEUR || null }, cari: {}, kasa: {}, olay: {},
    tomb: { cariler: [], hesaplar: [], cekler: [] }, cekKimlik: [] };
  const tomb = nesne(d._tomb) ? d._tomb : {};
  for (const L of ['cariler', 'hesaplar', 'cekler']) if (nesne(tomb[L])) g.tomb[L] = Object.keys(tomb[L]);
  const C = new Map(), H = new Map(); // anahtar String(id): 9001 ve '9001' aynı sayılır → çift kimlik (belirsiz)
  for (const c of liste(d.cariler)) { if (!nesne(c)) continue; const k = anahtar(c.id);
    if (C.has(k)) { C.get(k) && (C.get(k).cift = true); continue; } C.set(k, cariGiris(c)); }
  for (const h of liste(d.hesaplar)) { if (!nesne(h)) continue; const k = anahtar(h.id);
    if (H.has(k)) { H.get(k) && (H.get(k).cift = true); continue; }
    H.set(k, { id: h.id, ad: String(h.ad || ''), bakiye: +h.bakiye || 0, net: 0, gecersiz: h.bakiye != null && h.bakiye !== '' && !sonlu(+h.bakiye), cift: false, E: { eski: 0 }, eski: {} }); }
  const olay = new Map();
  const ekle = (imza, o) => { const v = olay.get(imza); if (v) v.n++; else olay.set(imza, { n: 1, ...o }); };
  const ekleNet = (c, borc, alacak) => { c.net += (borc || 0) - (alacak || 0); };
  const cekBagi = new Map(); // satışa bağlı çek kimliği → satışın carisi

  for (const s of liste(d.satislar)) {
    if (!nesne(s)) continue;
    const ck = anahtar(s.mid), c = C.get(ck), dv = div(s), dvSay = +dv;
    const tak = liste(s.taksitler).filter(t => t && t.odendi).reduce((a, t) => a + (+t.tutar || 0), 0);
    if (c && s.tip !== 'iade' && Array.isArray(s.taksitler)) { // ödenmiş taksit (iptal dahil: iptal/geri alma taksiti bakiyeyle birlikte taşır)
      c.taksitSatis[anahtar(s.id)] = { T: r2(tak), odenen: r2(+s.odenen || 0), tutar: r2(+s.tutar || 0), div: sonlu(dvSay) ? dvSay : null };
      if (tak > 0 && !s.satisKur && (s.pb === 'USD' || s.pb === 'EUR')) c.kurBagimliTaksit = true; }
    if (s.iptal) continue;
    for (const l of liste(s.odemeler)) if (nesne(l) && l._cekId != null) cekBagi.set(anahtar(l._cekId), ck);
    if (s.odemeCekId != null) cekBagi.set(anahtar(s.odemeCekId), ck);
    if (s.tip !== 'iade' && !liste(s.odemeler).length && s.odenen > 0 && !s.odemeCekId && s.odemeHesapId != null) {
      const h = H.get(anahtar(s.odemeHesapId)); if (h) { const t = s.odenen * dvSay; h.E.eski += t; h.eski[anahtar(s.id)] = r2(t); } }
    if (!c) continue;
    const sid = anahtar(s.id), z = s.tarih;
    if (!sonlu(dvSay) || dvSay <= 0) c.gecersiz = true;
    if (s.tip === 'iade') { if (!s.nakit) { const a = (+s.tutar || 0) * dvSay; ekleNet(c, 0, a); ekle(`S|${sid}|${ck}|${z}|iade|${kurus(a)}`, { c: ck, alacak: r2(a), tur: 'iade', anahtar: 'S' + sid + ':iade' }); } }
    else {
      const b = s.tutar * dvSay; ekleNet(c, b, 0); ekle(`S|${sid}|${ck}|${z}|satis|${kurus(b)}`, { c: ck, borc: r2(b), tur: 'satis', anahtar: 'S' + sid });
      const pesin = (+s.odenen || 0) - tak;
      if (pesin > 0) { const a = pesin * dvSay; ekleNet(c, 0, a); ekle(`S|${sid}|${ck}|${z}|odeme|${kurus(a)}`, { c: ck, alacak: r2(a), tur: 'satis-odeme', anahtar: 'S' + sid + ':odeme' }); }
      if (s.kesik > 0) { const a = s.kesik * dvSay; ekleNet(c, 0, a); ekle(`S|${sid}|${ck}|${z}|kesik|${kurus(a)}`, { c: ck, alacak: r2(a), tur: 'kesik', anahtar: 'S' + sid + ':kesik' }); }
    }
    if (!s.satisKur && (s.pb === 'USD' || s.pb === 'EUR')) { // K10: ekstre katkısı güncel kura bağlı
      const n = s.tip === 'iade' ? (s.nakit ? 0 : -(+s.tutar || 0)) : (+s.tutar || 0) - Math.max(0, (+s.odenen || 0) - tak) - (s.kesik > 0 ? +s.kesik : 0);
      c.kursuz[sid] = { n: r2(n), pb: s.pb, div: sonlu(dvSay) ? dvSay : null }; }
  }

  for (const h of liste(d.hareketler)) {
    if (!nesne(h)) continue;
    const ck = anahtar(h.cariId), c = h.cariId != null ? C.get(ck) : null, hid = anahtar(h.id), z = h.tarih, t = +h.tutar || 0;
    if (c) {
      const isMus = c.tip === 'musteri';
      if (h.tip === 'alim') { if (h.tutar > 0) { ekleNet(c, t, 0); ekle(`H|${hid}|${ck}|${z}|alim|${kurus(t)}`, { c: ck, borc: r2(t), tur: 'alim', anahtar: 'H' + hid }); } }
      else if (h.tip === 'alim-iptal') { if (h.tutar > 0) { ekleNet(c, 0, t); ekle(`H|${hid}|${ck}|${z}|alim-iptal|${kurus(t)}`, { c: ck, alacak: r2(t), tur: 'alim-iptal', anahtar: 'H' + hid }); } }
      else {
        const isTah = h.tip === 'tahsilat', tur = isTah ? 'tahsilat' : 'odeme';
        if (h.tutar > 0) { const al = isMus === isTah; ekleNet(c, al ? 0 : t, al ? t : 0);
          ekle(`H|${hid}|${ck}|${z}|${tur}|${kurus(t)}`, { c: ck, [al ? 'alacak' : 'borc']: r2(t), tur, anahtar: 'H' + hid }); }
        if (h.kesik > 0) { const k = +h.kesik; ekleNet(c, 0, k); ekle(`H|${hid}|${ck}|${z}|kesik|${kurus(k)}`, { c: ck, alacak: r2(k), tur: 'kesik', anahtar: 'H' + hid + ':kesik' }); }
        if ((h.tip === 'tahsilat' || h.tip === 'odeme') && (h.tur === 'Çek' || h.tur === 'Kredi Kartı') && h.hesapId == null && h.tutar > 0) { // kaydetOdeme çekinin kayıtlı karşılığı
          c.E.cek += t; c.karsilik.push({ imza: `${hid}|${z}|${h.tur}|${kurus(t)}`, tutar: r2(t) }); }
        if (!h.tip && (h.tur === 'İade' || h.tur === 'İade iptali') && h.tutar > 0) c.E.iade -= (isMus === isTah ? -t : t); // nakit iade: ekstre etkisi var, bakiye etkisi yok
      }
    }
    if (h.hesapId != null && h.yon) { const k = anahtar(h.hesapId), x = H.get(k);
      if (x) { const v = (h.yon === 'in' ? 1 : -1) * t; x.net += v; ekle(`K|${hid}|${k}|${z}|${h.yon}|${kurus(t)}`, { h: k, yon: h.yon, tutar: r2(t), tur: String(h.tur || h.tip || 'hareket'), anahtar: 'H' + hid }); } }
  }

  const cekSay = new Map();
  for (const ck of liste(d.cekler)) { if (!nesne(ck)) continue; const k = anahtar(ck.id); cekSay.set(k, (cekSay.get(k) || 0) + 1); }
  g.cekKimlik = [...cekSay.keys()];
  for (const ck of liste(d.cekler)) {
    if (!nesne(ck)) continue;
    const k = anahtar(ck.id), c = C.get(anahtar(ck.cariId)); if (!c) continue;
    const t = +ck.tutar || 0, bagli = cekBagi.get(k) === anahtar(ck.cariId);
    let e = 0; if (ck.cariIsle) { if (ck.durum !== 'karsiliksiz') e -= t; if (bagli) e += t; }
    if (ck.kurFarki) e += +ck.kurFarki || 0;
    c.E.cek += e; if (cekSay.get(k) > 1) c.cekCift = true;
    // elle: yalnız Çek formu (kaydetCek) kurTakip alanını yazar; tahsilat/ödeme (kaydetOdeme) ve satış çekleri yazmaz
    c.cekler.push({ id: k, tutar: r2(t), durum: String(ck.durum || ''), cariIsle: !!ck.cariIsle, kurFarki: r2(+ck.kurFarki || 0), bagli, elle: Object.prototype.hasOwnProperty.call(ck, 'kurTakip') });
  }

  for (const i of liste(d.isemirleri)) { if (!nesne(i)) continue;
    liste(i.duraklar).forEach((dk, x) => { if (!nesne(dk)) return; const b = +dk.borclanan || 0; if (!b) return;
      const c = C.get(anahtar(dk.borcFasonId != null ? dk.borcFasonId : dk.fasonId)); if (!c) return;
      c.E.fason += b; c.fason[`${anahtar(i.id)}/${x}`] = r2(b); }); }

  for (const [k, c] of C) {
    const bk = +c.bakiye || 0, devir = (c.bakiye || 0) - c.net;
    const ok = sonlu(devir) && sonlu(c.E.cek) && sonlu(c.E.fason) && sonlu(c.E.iade) && !c.gecersiz;
    g.cari[k] = { id: c.id, ad: c.ad, tip: c.tip, doviz: c.doviz, bakiye: sonlu(bk) ? r2(bk) : null, devir: ok ? r2(devir) : null, gecersiz: !ok, cift: c.cift,
      E: { cek: r2(c.E.cek), fason: r2(c.E.fason), iade: r2(c.E.iade) }, cekler: c.cekler, karsilik: c.karsilik, fason: c.fason, taksitSatis: c.taksitSatis,
      kursuz: c.kursuz, kurBagimliTaksit: c.kurBagimliTaksit, cekCift: c.cekCift };
  }
  for (const [k, h] of H) { const f = h.bakiye - h.net, ok = sonlu(f) && sonlu(h.E.eski) && !h.gecersiz;
    g.kasa[k] = { id: h.id, ad: h.ad, bakiye: r2(h.bakiye), fark: ok ? r2(f) : null, gecersiz: !ok, cift: h.cift, E: { eski: ok ? r2(h.E.eski) : 0 }, eski: h.eski }; }
  for (const [imza, o] of olay) g.olay[imza] = o;
  return g;
}

export function cariDevir(d, id) { const c = goruntu(d).cari[anahtar(id)]; return c ? c.devir : null; }
export function kasaFarki(d, id) { const h = goruntu(d).kasa[anahtar(id)]; return h ? h.fark : null; }

// Kalan tutara (kuruş) eşit bir aday alt kümesi: önce tekli, sonra ikili, sonra (≤14 adayda) tam arama.
function altKume(aday, hedef) {
  const n = aday.length, h = kurus(hedef);
  if (!sonlu(h) || aday.some(a => !sonlu(a.tutar))) return { bulunan: null, tam: false };
  for (const a of aday) if (kurus(a.tutar) === h) return { bulunan: [a], tam: true };
  const gorulen = new Map();
  for (const a of aday) { const k = kurus(a.tutar); if (gorulen.has(h - k)) return { bulunan: [gorulen.get(h - k), a], tam: true }; if (!gorulen.has(k)) gorulen.set(k, a); }
  if (n > ALT_KUME_SINIRI) return { bulunan: null, tam: false };
  for (let m = 1; m < (1 << n); m++) { let t = 0; for (let i = 0; i < n; i++) if (m & (1 << i)) t += kurus(aday[i].tutar);
    if (t === h) { const s = []; for (let i = 0; i < n; i++) if (m & (1 << i)) s.push(aday[i]); return { bulunan: s, tam: true }; } }
  return { bulunan: null, tam: true };
}

function cekKaniti(c0, c1, tombCek, cekVar) {
  const once = new Map(c0.cekler.map(x => [x.id, x])), simdi = new Map(c1.cekler.map(x => [x.id, x])), kanit = []; let eksik = false;
  for (const [id, x] of simdi) { const o = once.get(id);
    if (!o) kanit.push(`çek #${id} eklendi (${x.tutar}${x.cariIsle ? ', cariye işlendi' : ''}${x.bagli ? ', satışa bağlı' : ''})`);
    else if (o.tutar !== x.tutar || o.durum !== x.durum || o.cariIsle !== x.cariIsle || o.kurFarki !== x.kurFarki || o.bagli !== x.bagli)
      kanit.push(`çek #${id} değişti (tutar ${o.tutar}→${x.tutar}, durum ${o.durum}→${x.durum}${x.kurFarki !== o.kurFarki ? ', kur farkı ' + x.kurFarki : ''})`); }
  // kaydetOdeme karşılık hareketleri: yeni olan aynı tutarlı yeni çekle eşleşmeli; kaybolan karşılık kabul edilmez
  const say = (ls) => ls.reduce((m, x) => m.set(x.imza, (m.get(x.imza) || 0) + 1), new Map()), k0 = say(c0.karsilik), k1 = say(c1.karsilik);
  const yeniCek = [...simdi].filter(([id, x]) => !once.has(id) && x.cariIsle && !x.bagli && !x.elle).map(([id, x]) => ({ id, t: kurus(x.tutar) }));
  for (const x of c1.karsilik) { const n0 = k0.get(x.imza) || 0; if (n0 > 0) { k0.set(x.imza, n0 - 1); continue; }
    const i = yeniCek.findIndex(y => y.t === kurus(x.tutar)); if (i >= 0) yeniCek.splice(i, 1);
    else { kanit.push(`çekle/kartla tahsilat-ödeme hareketi (${x.tutar}) var ama eşleşen yeni çek yok — çek etkisi belirsiz`); eksik = true; } }
  for (const y of yeniCek) { kanit.push(`çek #${y.id} tahsilat/ödeme ya da satış çeki ama kayıtlı karşılığı (hareket/satış) yok — kayıt kaybolmuş olabilir`); eksik = true; }
  for (const x of c0.karsilik) { const n1 = k1.get(x.imza) || 0; if (n1 > 0) { k1.set(x.imza, n1 - 1); continue; }
    kanit.push(`çekle/kartla tahsilat-ödeme hareketi (${x.tutar}) artık yok — kayıt kaybolmuş olabilir`); eksik = true; }
  for (const [id, o] of once) if (!simdi.has(id)) {
    if (cekVar.has(id)) kanit.push(`çek #${id} başka cariye taşındı (${o.tutar})`);
    else if (tombCek.has(id)) kanit.push(`çek #${id} silindi (silme izi var, ${o.tutar})`);
    else { kanit.push(`çek #${id} bu caride artık yok (silme izi YOK — başka cariye taşınmış ya da kaybolmuş olabilir)`); eksik = true; } }
  return { kanit, eksik };
}
function haritaFarki(a, b, ad) { const k = []; for (const x of new Set([...Object.keys(a), ...Object.keys(b)])) if ((a[x] || 0) !== (b[x] || 0)) k.push(`${ad} ${x}: ${a[x] || 0} → ${b[x] || 0}`); return k; }

// İki görüntüyü karşılaştırır. Dönüş: her cari/kasa için { tur, id, ad, baslangic, son, kayma, aciklanan, kalan, bilesen, sinif, kanit }
export function karsilastir(g0, g1) {
  const sonuc = [], yeni = new Map(); // cari/kasa → bu arada eklenen olaylar (imza çoklu kümesi farkı)
  for (const [imza, o] of Object.entries(g1.olay)) { const fazla = o.n - ((g0.olay[imza] || {}).n || 0); if (fazla <= 0) continue;
    const k = o.c != null ? 'c' + o.c : 'h' + o.h; if (!yeni.has(k)) yeni.set(k, []); for (let i = 0; i < fazla; i++) yeni.get(k).push(o); }
  const tombCek = new Set(g1.tomb.cekler), cekVar = new Set(g1.cekKimlik), kurDegisti = g0.kur.USD !== g1.kur.USD || g0.kur.EUR !== g1.kur.EUR;
  const satir = (tur, x, b0, b1) => ({ tur, id: x.id, ad: x.ad, baslangic: b0, son: b1, kayma: 0, aciklanan: 0, kalan: 0, bilesen: {}, sinif: SINIF.KAYMA_YOK, kanit: [] });
  const kalanSinifla = (s, kalan, aday, eksik) => {
    const r = altKume(aday, Math.abs(kalan));
    if (eksik) { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('kanıt eksik ya da belirsiz: sınıflandırılamadı (elle inceleme gerekir)'); return; }
    if (r.bulunan) { s.sinif = SINIF.OLASI_ETKI_KAYBI; s.kanit.push(...r.bulunan.map(e => `${e.tur} ${e.anahtar} ${e.tutar}`), `aday olay sayısı ${aday.length} (eşleşme kesin değil; aynı tutarlı başka olay da olabilir)`); }
    else if (!r.tam) { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push(`aday olay sayısı ${aday.length} > ${ALT_KUME_SINIRI}: yalnız tekli ve ikili eşleşme arandı, bulunamadı — sınıflandırılamadı`); }
    else { s.sinif = SINIF.ACIKLANAMAYAN; s.kanit.push(s.tur === 'cari' ? 'kayıtlı olaylarla açıklanamıyor (ör. elle düzeltme ya da kayıt dışı değişiklik)' : 'kasa hareketleriyle açıklanamıyor'); }
  };

  for (const [k, c1] of Object.entries(g1.cari)) {
    const c0 = g0.cari[k], s = satir('cari', c1, c0 ? c0.devir : null, c1.devir); sonuc.push(s);
    if (c1.doviz === 'USD' || (c0 && c0.doviz === 'USD')) { s.sinif = SINIF.IZLENMIYOR; s.kanit.push('USD cari: bakiye bakiyeUSD alanında, hareketler TL — bu aşamada izlenmiyor (ayrı döviz defteri gerekir)'); continue; }
    if (!c0) { s.sinif = SINIF.YENI_KAYIT; s.kanit.push('açılış bakiyesi ' + c1.bakiye); continue; }
    if (c0.cift || c1.cift) { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('aynı kimlikli birden fazla cari kaydı — hangi kaydın ölçüldüğü belirsiz'); continue; }
    if (c0.gecersiz || c1.gecersiz) { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('sayısal olmayan bakiye/tutar ya da geçersiz kur — ölçülemedi'); continue; }
    s.kayma = r2(c1.devir - c0.devir);
    const b = s.bilesen = { cek: r2(c1.E.cek - c0.E.cek), fason: r2(c1.E.fason - c0.E.fason), taksit: 0, iade: r2(c1.E.iade - c0.E.iade), kur: 0 };
    let eksik = false, belirsiz = false; const kurKanit = [], takKanit = [];
    for (const [sid, x] of Object.entries(c1.kursuz)) { const o = c0.kursuz[sid]; if (!o || o.n !== x.n || o.pb !== x.pb) continue;
      if (o.div === null || x.div === null) { s.sinif = SINIF.SINIFLANDIRILAMADI; continue; }
      const p = -x.n * (x.div - o.div); if (Math.abs(p) >= ESIK) { b.kur += p; kurKanit.push(`kur bilgisi olmayan ${x.pb} satış #${sid} (${x.n} ${x.pb}): kur ${o.div} → ${x.div}`); } }
    b.kur = r2(b.kur);
    if (s.sinif === SINIF.SINIFLANDIRILAMADI) { s.kanit.push('kur bilgisi olmayan dövizli satış var ama kur geçersiz — ölçülemedi'); continue; }
    for (const [sid, o] of Object.entries(c0.taksitSatis)) { const x = c1.taksitSatis[sid];
      if (!x) { if (o.T > 0) { belirsiz = true; takKanit.push(`satış #${sid}: ödenmiş taksitli satış ya da plan bilgisi artık yok`); } continue; }
      const dT = r2(x.T - o.T); if (dT > -ESIK) continue; // artış: taksit tahsili (bakiye + hareketle birlikte yazılır) — kanıt sayılmaz
      if (Math.abs(x.odenen - o.odenen) < ESIK && Math.abs(x.tutar - o.tutar) < ESIK && x.div !== null) { b.taksit += -dT * x.div; takKanit.push(`satış #${sid}: ödenmiş taksit ${o.T} → ${x.T}, ödenen ${x.odenen} aynı (plan kaldırıldı/yeniden kuruldu)`); }
      else { belirsiz = true; takKanit.push(`satış #${sid}: ödenmiş taksit ${o.T} → ${x.T} ve ödenen ${o.odenen} → ${x.odenen} birlikte geri gitti — eski belge üzerine yazmış olabilir`); } }
    b.taksit = r2(b.taksit);
    s.aciklanan = r2(b.cek + b.fason + b.taksit + b.iade + b.kur); s.kalan = r2(s.kayma - s.aciklanan);
    const ck = cekKaniti(c0, c1, tombCek, cekVar);
    if (Math.abs(b.cek) >= ESIK || ck.kanit.length) { s.kanit.push(...ck.kanit); if (ck.eksik && Math.abs(b.cek) >= ESIK) eksik = true; }
    if (Math.abs(b.fason) >= ESIK) s.kanit.push('fason durak borcu (K7): ' + haritaFarki(c0.fason, c1.fason, 'iş emri/durak').join('; '));
    if (takKanit.length) s.kanit.push(...takKanit.map(x => 'taksit (K9): ' + x));
    if (Math.abs(b.iade) >= ESIK) s.kanit.push(`nakit iade / iade geri alma: kasa hareketi ekstrede ${-b.iade} etkili, cari bakiyesi değişmez (uygulama ekstresi böyle gösteriyor)`);
    if (kurKanit.length) s.kanit.push(...kurKanit.map(x => x + ' (K10)'));
    if ((c0.cekCift || c1.cekCift) && Math.abs(b.cek) >= ESIK) { eksik = true; s.kanit.push('aynı kimlikli birden fazla çek — çek kanıtı belirsiz'); }
    if (kurDegisti && (c0.kurBagimliTaksit || c1.kurBagimliTaksit)) { eksik = true; s.kanit.push('kur bilgisi olmayan dövizli satışta ödenmiş taksit + kur değişimi — taksit kanıtı kura bağlı, belirsiz'); }
    if (belirsiz) { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('kayıt değişikliği güvenilir biçimde ayırt edilemiyor — kayma ' + s.kayma + ' olsa da sınıflandırılamadı (elle inceleme gerekir)'); continue; }
    const tumBilesen = Math.abs(b.cek) + Math.abs(b.fason) + Math.abs(b.taksit) + Math.abs(b.iade) + Math.abs(b.kur);
    if (Math.abs(s.kayma) < ESIK && tumBilesen < ESIK) { s.kanit = []; continue; }
    if (Math.abs(s.kalan) < ESIK) { if (eksik) { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('kayma tutar olarak açıklanıyor ama kanıt eksik — sınıflandırılamadı'); } else s.sinif = SINIF.ACIKLANAN; continue; }
    // D arttı (bakiye kayıtlardan yüksek) → bir alacak olayının (tahsilat / kesik / iade) etkisi düşmüş olabilir; azaldıysa borç olayının (satış / alım)
    const aday = (yeni.get('c' + k) || []).filter(e => (s.kalan > 0 ? e.alacak : e.borc) > 0).map(e => ({ ...e, tutar: s.kalan > 0 ? e.alacak : e.borc }));
    if (s.aciklanan) s.kanit.unshift(`bilinen kayıt dışı değişiklik ${s.aciklanan}; açıklanamayan kalan ${s.kalan}`);
    kalanSinifla(s, s.kalan, aday, eksik);
  }
  for (const [k, c0] of Object.entries(g0.cari)) if (!(k in g1.cari)) { const s = satir('cari', c0, c0.devir, null); sonuc.push(s);
    if (new Set(g1.tomb.cariler).has(k)) { s.sinif = SINIF.IZLENMIYOR; s.kanit.push('cari silinmiş (silme izi var)'); }
    else { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('cari kaydı artık yok ve silme izi YOK'); } }

  for (const [k, h1] of Object.entries(g1.kasa)) {
    const h0 = g0.kasa[k], s = satir('kasa', h1, h0 ? h0.fark : null, h1.fark); sonuc.push(s);
    if (!h0) { s.sinif = SINIF.YENI_KAYIT; s.kanit.push('açılış bakiyesi ' + h1.bakiye); continue; }
    if (h0.cift || h1.cift) { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('aynı kimlikli birden fazla kasa/hesap kaydı'); continue; }
    if (h0.gecersiz || h1.gecersiz) { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('sayısal olmayan bakiye/tutar — ölçülemedi'); continue; }
    s.kayma = r2(h1.fark - h0.fark); s.bilesen = { eski: r2(h1.E.eski - h0.E.eski) };
    s.aciklanan = s.bilesen.eski; s.kalan = r2(s.kayma - s.aciklanan);
    if (Math.abs(s.kayma) < ESIK && Math.abs(s.aciklanan) < ESIK) continue;
    if (Math.abs(s.aciklanan) >= ESIK) s.kanit.push('eski biçimli satış ödemesi (K12, odemeHesapId; kasa hareketsiz düşer): ' + haritaFarki(h0.eski, h1.eski, 'satış').join('; '));
    if (Math.abs(s.kalan) < ESIK) { s.sinif = SINIF.ACIKLANAN; continue; }
    // F azaldı → bir giriş (in) etkisi düşmüş olabilir; arttı → bir çıkış (out) etkisi
    const aday = (yeni.get('h' + k) || []).filter(e => e.yon === (s.kalan < 0 ? 'in' : 'out'));
    if (s.aciklanan) s.kanit.unshift(`bilinen kayıt dışı değişiklik ${s.aciklanan}; açıklanamayan kalan ${s.kalan}`);
    kalanSinifla(s, s.kalan, aday, false);
  }
  for (const [k, h0] of Object.entries(g0.kasa)) if (!(k in g1.kasa)) { const s = satir('kasa', h0, h0.fark, null); sonuc.push(s);
    if (new Set(g1.tomb.hesaplar).has(k)) { s.sinif = SINIF.IZLENMIYOR; s.kanit.push('hesap silinmiş (silme izi var)'); }
    else { s.sinif = SINIF.SINIFLANDIRILAMADI; s.kanit.push('hesap kaydı artık yok ve silme izi YOK'); } }
  return sonuc;
}

// Kısayol: başlangıç görüntüsü ile verinin şimdiki hali
export function tespit(g0, d) { return karsilastir(g0, goruntu(d)); }

// İki ardışık görüntünün ölçümleri aynı mı (başlangıç görüntüsü "oturmuş" değerlerle alınmalı)
export function olcumAyni(a, b) {
  const ka = Object.keys(a.cari), kb = Object.keys(b.cari), ha = Object.keys(a.kasa), hb = Object.keys(b.kasa);
  if (ka.length !== kb.length || ha.length !== hb.length) return false;
  return ka.every(k => b.cari[k] && b.cari[k].devir === a.cari[k].devir) && ha.every(k => b.kasa[k] && b.kasa[k].fark === a.kasa[k].fark);
}

// Başlangıç görüntüsü alınabilir mi? Bütün koşullar çağırandan gelir (motor uygulama durumunu kendisi OKUMAZ).
export function tabanUygunMu(k) {
  k = nesne(k) ? k : {}; const n = [];
  if (k.kurtarma !== 'tamam') n.push('veri kurtarma kararı "tamam" değil');
  if (k.ornek) n.push('örnek veri');
  if (k.musteriMod) n.push('müşteri (portal) modu');
  if (k.admin !== true) n.push('yönetici değil');
  if (k.personelMod) n.push('personel modu');
  if (k.canli) { const dm = nesne(k.domenAlindi) ? k.domenAlindi : {}, ls = liste(k.domenler);
    if (!ls.length || ls.some(x => dm[x] !== true)) n.push('her domenden bulut bildirimi alınmadı'); }
  if (k.bekleyenYazim) n.push('buluta gönderilmemiş yerel değişiklik var');
  if (k.sonBirlesim != null && !(sonlu(k.zaman) && k.zaman - k.sonBirlesim >= IZLEME_KURAL.birlesimSakinMs)) n.push('son bulut birleşimi çok yeni');
  if (k.ardisikOlcumAyni !== true) n.push('iki ardışık ölçüm aynı değil (değerler oturmamış)');
  return { uygun: n.length === 0, nedenler: n };
}

// Geçici fark ile tekrarlanan şüpheli farkı ayırır. Saf: önceki durumu DEĞİŞTİRMEZ, yeni durum döndürür.
// kontrol = { zaman, satirlar (karsilastir çıktısı), senkron: { canli, bekleyenYazim, sonBirlesim, domenGuncel: { domenAdı: true/false } } }
//   domenGuncel: çağıranın bildirdiği "bu domenin son bulut bildirimi sunucudan geldi ve bekleyen yazım yok" bilgisi.
// Kural: TEKRARLAYAN_SUPHE için aynı sınıf ve aynı kayma ≥2 kontrolde, ilk görülmeden bu yana ≥10 dk, şu an (bulut açıksa) BÜTÜN
// domenler güncel, bekleyen yazım yok ve son birleşim ≥60 sn önce. Yalnız zamanın geçmesi YETMEZ; senkron bilgisi yoksa yükseltilmez.
// TEKRARLAYAN_SUPHE de yalnız "elle incelenmeli" demektir; hiçbir durum "kesin kayıp" değildir.
export function izlemeGuncelle(onceki, kontrol) {
  const o = nesne(onceki) && nesne(onceki.kayitlar) ? onceki.kayitlar : {}, kayitlar = {}, kapanan = [];
  const z = kontrol.zaman, sk = nesne(kontrol.senkron) ? kontrol.senkron : {}, dg = nesne(sk.domenGuncel) ? sk.domenGuncel : {};
  const istikrarsiz = !!sk.bekleyenYazim || (sk.sonBirlesim != null && !(z - sk.sonBirlesim >= IZLEME_KURAL.birlesimSakinMs));
  const simdi = new Map(liste(kontrol.satirlar).filter(s => UYARI_SINIFLARI.has(s.sinif)).map(s => [s.tur + '#' + s.id, s]));
  for (const [k, s] of simdi) {
    const p = o[k], ayni = p && p.sinif === s.sinif && Math.abs(p.kayma - s.kayma) < ESIK;
    const r = ayni ? { ...p, sayi: p.sayi + 1, son: z } : { tur: s.tur, id: s.id, sinif: s.sinif, kayma: s.kayma, ilk: z, son: z, sayi: 1, kalicilik: KALICILIK.BEKLEMEDE };
    if (r.kalicilik !== KALICILIK.TEKRARLAYAN_SUPHE) {
      const eksik = [];
      if (r.sayi < IZLEME_KURAL.enAzKontrol) eksik.push('en az 2 kontrolde görülmedi');
      if (!(z - r.ilk >= IZLEME_KURAL.enAzSureMs)) eksik.push('ilk görülmeden bu yana 10 dk geçmedi');
      if (sk.canli !== false) { const ad = Object.keys(dg); if (!ad.length || ad.some(x => dg[x] !== true)) eksik.push('bütün domenler güncel değil (bulut bildirimi eksik ya da bekleyen yazım var)'); }
      if (istikrarsiz) eksik.push('senkron sürüyor (bekleyen yazım ya da yeni birleşim)');
      r.bekleyenNedenler = eksik;
      if (!eksik.length) r.kalicilik = KALICILIK.TEKRARLAYAN_SUPHE;
    }
    kayitlar[k] = r;
  }
  for (const [k, p] of Object.entries(o)) if (!simdi.has(k)) {
    const s = liste(kontrol.satirlar).find(x => x.tur + '#' + x.id === k);
    kapanan.push({ ...p, kapanis: z, sonuc: s && s.sinif === SINIF.ACIKLANAN ? 'SONRADAN_ACIKLANDI' : 'KENDILIGINDEN_DUZELDI', simdikiSinif: s ? s.sinif : null });
  }
  return { kayitlar, kapanan };
}

// ===================================================================== Ders 50.3c-2: PAKETLEME, YETKİ, SENKRON KANITI (saf) =====================================================================
// Başlangıç görüntüsü KAYIPSIZ paketlenir: olaylar sütunlu biçime çevrilir (tabanAc(tabanPaketle(g)) === g, alan alan).
// Özet (hash) ile EŞLEŞTİRME YAPILMAZ: olay kimliği/imzası olduğu gibi saklanır → çakışma ile bir olayın "eski" sanılması imkânsız.
// Sıkıştırma (gzip) ve bütünlük özeti (SHA-256, yalnız bozulmayı yakalamak için) depo katmanında (js/defter-depo.mjs) yapılır.
export const PAKET_BICIM = 'iqbasics-defter-taban';
export const PAKET_SURUM = 1;
const OLAY_ALAN = ['c', 'borc', 'alacak', 'h', 'yon', 'tutar']; // + n, tur, anahtar (her olayda); alan sırası goruntu() ile aynı

export function tabanPaketle(g) {
  const e = Object.entries(g.olay), tur = [], turNo = new Map();
  const k = { imza: [], n: [], tur: [], anahtar: [] }; for (const a of OLAY_ALAN) k[a] = [];
  for (const [imza, o] of e) { k.imza.push(imza); k.n.push(o.n); k.anahtar.push(o.anahtar);
    if (!turNo.has(o.tur)) { turNo.set(o.tur, tur.length); tur.push(o.tur); } k.tur.push(turNo.get(o.tur));
    for (const a of OLAY_ALAN) k[a].push(a in o ? o[a] : null); }
  const { olay, ...govde } = g;
  return { bicim: PAKET_BICIM, surum: PAKET_SURUM, motorSurum: MOTOR_SURUM, govde: { ...govde, olay: { sayi: e.length, turSozluk: tur, ...k } } };
}

// Paketi doğrular ve görüntüye geri açar. Tanınmayan biçim/sürüm → TANINMAYAN; yapı bozuk → BOZUK (görüntü verilmez).
export function tabanAc(p) {
  const red = (hata, neden) => ({ ok: false, hata, neden });
  if (!nesne(p)) return red('BOZUK', 'paket nesne değil');
  if (p.bicim !== PAKET_BICIM) return red('TANINMAYAN', 'paket biçimi tanınmıyor');
  if (p.surum !== PAKET_SURUM) return red('TANINMAYAN', 'paket sürümü ' + p.surum + ' (beklenen ' + PAKET_SURUM + ')');
  if (p.motorSurum !== MOTOR_SURUM) return red('TANINMAYAN', 'motor sürümü ' + p.motorSurum + ' (beklenen ' + MOTOR_SURUM + ')');
  const g = p.govde, bilinen = ['motorSurum', 'kur', 'cari', 'kasa', 'olay', 'tomb', 'cekKimlik'];
  if (nesne(g) && Object.keys(g).some(x => !bilinen.includes(x))) return red('BOZUK', 'gövdede tanınmayan alan');
  if (!nesne(g) || !nesne(g.cari) || !nesne(g.kasa) || !nesne(g.olay) || !nesne(g.tomb) || !Array.isArray(g.cekKimlik) || !nesne(g.kur)) return red('BOZUK', 'gövde alanları eksik');
  if (g.motorSurum !== MOTOR_SURUM) return red('BOZUK', 'gövde motor sürümü uyuşmuyor');
  for (const L of ['cariler', 'hesaplar', 'cekler']) if (!Array.isArray(g.tomb[L])) return red('BOZUK', 'silme izi listesi eksik: ' + L);
  for (const c of Object.values(g.cari)) if (!nesne(c) || !nesne(c.E) || !Array.isArray(c.cekler) || !Array.isArray(c.karsilik) || !nesne(c.taksitSatis) || !nesne(c.kursuz) || !nesne(c.fason)
    || !(c.devir === null || sonlu(c.devir)) || !['cek', 'fason', 'iade'].every(a => sonlu(c.E[a]))) return red('BOZUK', 'cari kaydı bozuk');
  for (const h of Object.values(g.kasa)) if (!nesne(h) || !nesne(h.E) || !sonlu(h.E.eski) || !(h.fark === null || sonlu(h.fark)) || !nesne(h.eski)) return red('BOZUK', 'kasa kaydı bozuk');
  const k = g.olay, n = k.sayi, alanlar = ['imza', 'n', 'tur', 'anahtar', ...OLAY_ALAN];
  if (!Number.isInteger(n) || n < 0 || !Array.isArray(k.turSozluk) || alanlar.some(a => !Array.isArray(k[a]) || k[a].length !== n)) return red('BOZUK', 'olay sütunları eksik ya da boyları farklı');
  const olay = {};
  for (let i = 0; i < n; i++) {
    const imza = k.imza[i], t = k.turSozluk[k.tur[i]];
    if (typeof imza !== 'string' || imza in olay || !Number.isInteger(k.n[i]) || k.n[i] < 1 || typeof t !== 'string') return red('BOZUK', 'olay ' + i + ' bozuk (imza / tekrar sayısı / tür)');
    const o = { n: k.n[i] }; for (const a of OLAY_ALAN) if (k[a][i] !== null) o[a] = k[a][i]; o.tur = t; o.anahtar = k.anahtar[i]; olay[imza] = o;
  }
  return { ok: true, goruntu: { motorSurum: g.motorSurum, kur: g.kur, cari: g.cari, kasa: g.kasa, olay, tomb: g.tomb, cekKimlik: g.cekKimlik } }; // goruntu() alan sırası
}

// İzleme verisine her erişimde (okuma VE yazma) aranan yetki. Bütün bilgiler çağırandan gelir.
export function izlemeYetkisi(y) {
  y = nesne(y) ? y : {}; const n = [];
  if (y.kurtarma !== 'tamam') n.push('veri kurtarma kararı "tamam" değil');
  if (y.admin !== true) n.push('yönetici değil');
  if (y.personelMod !== false) n.push('personel modu (ya da bilinmiyor)');
  if (y.musteriMod !== false) n.push('müşteri (portal) modu (ya da bilinmiyor)');
  if (y.ornek !== false) n.push('örnek veri (ya da bilinmiyor)');
  return { izin: n.length === 0, nedenler: n };
}

// Senkron güncelliğinin KANITI (bildirim almak güncellik değildir). Bulut açıksa her domen için: sunucudan okundu (önbellek değil)
// ve sunucu = son uygulanan gölge = yerel veri; bekleyen yazımlar sunucuca onaylandı; cihaz çevrimiçi. Her durumda bellek = kalıcı kayıt.
export function senkronKaniti(s) {
  s = nesne(s) ? s : {}; const n = [];
  if (s.bellekKalici !== true) n.push('bu sekmenin belleği kalıcı kayıtla aynı değil (ya da bilinmiyor)');
  if (s.canli === false) return { uygun: n.length === 0, bulutsuz: true, nedenler: n };
  if (s.canli !== true) { n.push('bulut durumu bilinmiyor'); return { uygun: false, bulutsuz: false, nedenler: n }; }
  if (s.cevrimici !== true) n.push('çevrimdışı ya da bağlantı bilinmiyor');
  if (s.yazimlarOnaylandi !== true) n.push('bekleyen bulut yazımları onaylanmadı');
  const ls = liste(s.domenler), su = nesne(s.sunucudan) ? s.sunucudan : {}, ue = nesne(s.ucluEsit) ? s.ucluEsit : {};
  if (!ls.length) n.push('domen listesi yok');
  for (const d of ls) { if (su[d] !== true) n.push(d + ': sunucudan okunamadı (önbellek ya da hata)'); else if (ue[d] !== true) n.push(d + ': sunucu, gölge ve yerel veri aynı değil'); }
  return { uygun: n.length === 0, bulutsuz: false, nedenler: n };
}

// ===================================================================== Ders 50.3c-3a: TANILAMA (saf, tabansız) =====================================================================
// Yalnız VERİLEN verinin kendi içindeki tutarlılığını inceler. Başlangıç görüntüsü, bulut ya da depo KULLANMAZ; kayıp tespiti DEĞİLDİR.
// Her bulgu "incelenmeli" düzeyindedir (kesin neden ya da kayıp iddiası yok). ek.domenBoyut: { domen: bayt } (çağıran ölçer).
export const TANILAMA_SINIR = Object.freeze({ belgeUyari: 900000, belgeSinir: 950000, tutarEsik: 0.01 });
export function tanilama(d, ek) {
  d = nesne(d) ? d : {}; ek = nesne(ek) ? ek : {};
  const g = goruntu(d), uyarilar = [], ekle = (kod, konu, mesaj) => uyarilar.push({ kod, seviye: 'incelenmeli', konu, mesaj });
  const kim = (x) => (x === null || x === undefined ? '—' : String(x));
  // Ölçümler: cari devri ve kasa farkı (USD cariler İZLENMİYOR)
  const cari = Object.values(g.cari).map(c => ({ id: c.id, ad: c.ad, tip: c.tip, doviz: c.doviz, devir: c.devir, izlenmiyor: c.doviz === 'USD', gecersiz: c.gecersiz }));
  const kasa = Object.values(g.kasa).map(h => ({ id: h.id, ad: h.ad, fark: h.fark, gecersiz: h.gecersiz }));
  // Tekrarlanan kimlikler
  for (const L of ['cariler', 'hesaplar', 'cekler', 'satislar', 'hareketler']) { const say = new Map();
    for (const r of liste(d[L])) if (nesne(r)) { const k = kim(r.id); say.set(k, (say.get(k) || 0) + 1); }
    for (const [k, n] of say) if (n > 1) ekle('TEKRAR_KIMLIK', L + '#' + k, `${L}: aynı kimlik (${k}) ${n} kayıtta`); }
  // Sayısal olmayan tutarlar
  const sayiDegil = (v) => v !== undefined && v !== null && v !== '' && !sonlu(+v);
  const alanlar = { cariler: ['bakiye', 'bakiyeUSD'], hesaplar: ['bakiye'], satislar: ['tutar', 'odenen', 'kesik', 'satisKur'], hareketler: ['tutar', 'kesik'], cekler: ['tutar', 'kurFarki'] };
  for (const [L, as] of Object.entries(alanlar)) for (const r of liste(d[L])) if (nesne(r)) for (const a of as) if (sayiDegil(r[a])) ekle('SAYI_DEGIL', L + '#' + kim(r.id), `${L} #${kim(r.id)}: "${a}" alanı sayı değil`);
  for (const k of ['kurUSD', 'kurEUR']) if (!(sonlu(+d[k]) && +d[k] > 0)) ekle('KUR_GECERSIZ', 'ayar#' + k, `${k} geçersiz ya da yok`);
  // Var olmayan kayıtlara bağlılık
  const varMi = (L) => new Set(liste(d[L]).filter(nesne).map(r => kim(r.id)));
  const C = varMi('cariler'), H = varMi('hesaplar'), K = varMi('cekler');
  for (const s of liste(d.satislar)) { if (!nesne(s) || s.iptal) continue;
    if (s.mid != null && !C.has(kim(s.mid))) ekle('BAGLI_KAYIT_YOK', 'satislar#' + kim(s.id), `satış #${kim(s.id)}: carisi (${kim(s.mid)}) yok`);
    if (s.odemeHesapId != null && !liste(s.odemeler).length && !H.has(kim(s.odemeHesapId))) ekle('BAGLI_KAYIT_YOK', 'satislar#' + kim(s.id), `satış #${kim(s.id)}: eski ödeme hesabı (${kim(s.odemeHesapId)}) yok`);
    for (const l of liste(s.odemeler)) if (nesne(l)) { if (l._hesapId != null && !H.has(kim(l._hesapId))) ekle('BAGLI_KAYIT_YOK', 'satislar#' + kim(s.id), `satış #${kim(s.id)}: ödeme hesabı (${kim(l._hesapId)}) yok`);
      if (l._cekId != null && !K.has(kim(l._cekId))) ekle('BAGLI_KAYIT_YOK', 'satislar#' + kim(s.id), `satış #${kim(s.id)}: ödeme çeki (${kim(l._cekId)}) yok`); } }
  for (const h of liste(d.hareketler)) { if (!nesne(h)) continue;
    if (h.cariId != null && !C.has(kim(h.cariId))) ekle('BAGLI_KAYIT_YOK', 'hareketler#' + kim(h.id), `hareket #${kim(h.id)}: carisi (${kim(h.cariId)}) yok`);
    if (h.hesapId != null && h.yon && !H.has(kim(h.hesapId))) ekle('BAGLI_KAYIT_YOK', 'hareketler#' + kim(h.id), `hareket #${kim(h.id)}: hesabı (${kim(h.hesapId)}) yok`); }
  for (const c of liste(d.cekler)) if (nesne(c) && c.cariId != null && !C.has(kim(c.cariId))) ekle('BAGLI_KAYIT_YOK', 'cekler#' + kim(c.id), `çek #${kim(c.id)}: carisi (${kim(c.cariId)}) yok`);
  for (const i of liste(d.isemirleri)) if (nesne(i)) liste(i.duraklar).forEach((dk, x) => { if (nesne(dk) && (+dk.borclanan || 0) && dk.borcFasonId != null && !C.has(kim(dk.borcFasonId))) ekle('BAGLI_KAYIT_YOK', 'isemirleri#' + kim(i.id), `iş emri #${kim(i.id)} durak ${x + 1}: borç yazılan fason (${kim(dk.borcFasonId)}) yok`); });
  // Eşleşmeyen çek ↔ çekli/kartlı tahsilat-ödeme hareketi (aynı cari, aynı tutar; elle çek ve satış çeki hariç)
  for (const [k, c] of Object.entries(g.cari)) { if (c.doviz === 'USD') continue;
    const cekler = c.cekler.filter(x => x.cariIsle && !x.bagli && !x.elle), kars = c.karsilik.map(x => kurus(x.tutar));
    for (const x of cekler) { const i = kars.indexOf(kurus(x.tutar)); if (i >= 0) kars.splice(i, 1);
      else ekle('CEK_KARSILIKSIZ', 'cari#' + k, `çek #${x.id} (${x.tutar}) tahsilat/ödeme ya da satış çeki ama eşleşen çekli hareket yok (kayıt kaybolmuş ya da çek başka cariye taşınmış olabilir)`); }
    for (const t of kars) ekle('HAREKET_CEKSIZ', 'cari#' + k, `çekli/kartlı hareket (${r2(t / 100)}) var ama eşleşen çek yok (çek silinmiş, taşınmış ya da kaybolmuş olabilir)`); }
  // Taksit toplamı: cari başına "Taksit" hareketleri ↔ satışlardaki ödenmiş taksit
  const takH = new Map(), takS = new Map();
  for (const h of liste(d.hareketler)) if (nesne(h) && h.tip === 'tahsilat' && h.tur === 'Taksit' && h.cariId != null) takH.set(kim(h.cariId), (takH.get(kim(h.cariId)) || 0) + (+h.tutar || 0));
  for (const [k, c] of Object.entries(g.cari)) for (const x of Object.values(c.taksitSatis)) if (x.T > 0 && x.div !== null) takS.set(k, (takS.get(k) || 0) + x.T * x.div);
  for (const k of new Set([...takH.keys(), ...takS.keys()])) { const a = r2(takH.get(k) || 0), b = r2(takS.get(k) || 0);
    if (Math.abs(a - b) >= TANILAMA_SINIR.tutarEsik) ekle('TAKSIT_UYUMSUZ', 'cari#' + k, `"Taksit" tahsilatları ${a} · satışlardaki ödenmiş taksit ${b} (taksit planı kaldırılmış ya da kayıt kaybolmuş olabilir)`); }
  // Eski ödeme alanı (odemeHesapId / odemeCekId) ve kur bilgisi eksik dövizli satışlar
  const eski = [], kursuz = [];
  for (const s of liste(d.satislar)) { if (!nesne(s) || s.iptal) continue;
    if (s.tip !== 'iade' && !liste(s.odemeler).length && s.odenen > 0 && (s.odemeHesapId != null || s.odemeCekId != null)) eski.push(kim(s.id));
    if (!s.satisKur && (s.pb === 'USD' || s.pb === 'EUR')) kursuz.push(kim(s.id)); }
  if (eski.length) ekle('ESKI_ODEME_ALANI', 'satislar', `${eski.length} satış eski ödeme alanıyla (odemeHesapId / odemeCekId): iptal ya da düzenlemede kasa hareketi yazılmadan düşer`);
  if (kursuz.length) ekle('KUR_EKSIK_DOVIZ', 'satislar', `${kursuz.length} dövizli satışta kur bilgisi (satisKur) yok: ekstre tutarı güncel kura göre değişir`);
  // Bulut belge boyutu (domen belgesi en çok 1 MB)
  const boyut = nesne(ek.domenBoyut) ? ek.domenBoyut : {};
  for (const [dm, b] of Object.entries(boyut)) if (+b >= TANILAMA_SINIR.belgeUyari) ekle('BELGE_BOYUTU', 'domen#' + dm, `${dm} bulut belgesi ${Math.round(+b / 1024)} KB (sınır 1 MB${+b >= TANILAMA_SINIR.belgeSinir ? ' — SINIRDA, yazım başarısız olabilir' : ' — yaklaşıyor'})`);
  // Bilinen uygulama kısıtları (DÜZELTİLMEDİ): nakit iade ekstre gösterimi, ürün kartından tedarikçi borcu
  const iade = new Map();
  for (const h of liste(d.hareketler)) if (nesne(h) && !h.tip && (h.tur === 'İade' || h.tur === 'İade iptali') && h.cariId != null && h.tutar > 0) { const k = kim(h.cariId), o = iade.get(k) || { sayi: 0, tutar: 0 }; o.sayi++; o.tutar = r2(o.tutar + (+h.tutar || 0)); iade.set(k, o); }
  const tedarikci = cari.filter(c => (c.tip === 'tedarikci' || c.tip === 'fason') && !c.izlenmiyor && c.devir !== null && Math.abs(c.devir) >= 1).length;
  const kisitlar = [
    { kod: 'NAKIT_IADE', baslik: 'Nakit iade ekstre gösterimi (bilinen uygulama kısıtı)', cariSayisi: iade.size, hareketSayisi: [...iade.values()].reduce((a, o) => a + o.sayi, 0), tutar: r2([...iade.values()].reduce((a, o) => a + o.tutar, 0)),
      mesaj: 'Nakit iade ve iadenin geri alınması kasa hareketi olarak cari ekstresinde BORÇ görünüyor; cari bakiyesi değişmiyor. Devir bu yüzden farklı görünebilir.' },
    { kod: 'K8', baslik: 'Ürün kartından tedarikçi borcu (bilinen uygulama kısıtı)', tedarikciDevirli: tedarikci,
      mesaj: 'Ürün kartından tedarikçiye yazılan borç hareket kaydı oluşturmaz. Tedarikçi/fason devri bu yüzden ya da elle bakiye düzeltmesi yüzünden farklı olabilir; kesin neden bu kontrolle belirlenemez.' }];
  const usd = cari.filter(c => c.izlenmiyor).length;
  return { motorSurum: MOTOR_SURUM, olcum: { cari, kasa }, uyarilar, kisitlar,
    sayac: { cari: cari.length, kasa: kasa.length, usdIzlenmiyor: usd, eskiOdemeAlani: eski.length, kurEksikDoviz: kursuz.length, uyari: uyarilar.length } };
}
