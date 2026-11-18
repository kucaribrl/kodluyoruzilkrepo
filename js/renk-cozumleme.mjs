// R2.2a / R2.2b.1 — Saf renk çözümleme motoru. TEK DOĞRULUK KAYNAĞI: js/renk-cozumleme.mjs
// Node testleri (test/28, test/30) ve tarayıcı (index.html yükleyicisi → window.renkMotoru) AYNI dosyayı çalıştırır.
// test/yardimci/renk-cozumleme.mjs yalnız bu dosyayı yeniden dışa aktarır (ikinci implementasyon YOK).
// Uygulama motoru şimdilik YALNIZ YÜKLER; hiçbir satış/stok/transfer/üretim/portal/senkron/finans akışı çağırmaz.
// Motor sürümü (MOTOR_SURUM) değişirse index.html yükleyicisindeki beklenen sürüm de birlikte değişmelidir.
// Bir kaydın (satış kalemi, transfer, iş emri, portal siparişi...) hangi ürün rengine ait olduğunu
// GÜVENLİ biçimde çözer. Kural: belirsizlikte fail-closed; asla tahmin etmez, asla yazmaz.
//   - rid'li kayıt: yalnız birebir rid eşleşmesi; bulunamazsa ada DÜŞÜLMEZ.
//   - rid'siz (eski) kayıt: uid + birebir ad (Türkçe küçük harf, trim, NFC). 0 aday → BULUNAMADI,
//     >1 aday → BELIRSIZ, 1 aday → ADAY (kanıt değil). Stok işleminde ürün+renk anlık
//     görüntüsüne (snapshot) bağlı açık mutabakat onayı gerekir.
//   - stokYazmaYetkisi HER ZAMAN false: bu modül stok yazmaya izin vermez, yalnız durum bildirir.
// Saf fonksiyon: girdiyi değiştirmez, ağ/dosya/DOM/depo/zaman/rastgelelik kullanmaz,
// sonuçta kaynak nesnelere referans döndürmez.

export const DURUM = Object.freeze({
  UYGUN: 'UYGUN',
  ADAY: 'ADAY',
  MUTABAKAT_GEREKLI: 'MUTABAKAT_GEREKLI',
  MUTABAKATLI: 'MUTABAKATLI',
  BULUNAMADI: 'BULUNAMADI',
  BELIRSIZ: 'BELIRSIZ',
  SILINMIS: 'SILINMIS',
  GECERSIZ_REFERANS: 'GECERSIZ_REFERANS',
  GECERSIZ_VERI: 'GECERSIZ_VERI',
  KIMLIK_CAKISMASI: 'KIMLIK_CAKISMASI',
  URUN_BULUNAMADI: 'URUN_BULUNAMADI',
  URUN_BELIRSIZ: 'URUN_BELIRSIZ',
  ONAY_GECERSIZ: 'ONAY_GECERSIZ',
  ESKI_ONAY_GECERSIZ: 'ESKI_ONAY_GECERSIZ',
});

/* Motorun dış sözleşme sürümü. index.html yükleyicisi bu sayıyı birebir bekler; uyuşmazsa motor HAZIR sayılmaz
   (eski açık sekme + yeni motor karışımına karşı). */
export const MOTOR_SURUM = 1;

/* MUTABAKAT GÜVEN SINIRI: mutabakatOnayiOlustur yalnız İSTEMCİ TARAFINDA bir taslak nesne hazırlar.
   Bu nesne kullanıcının kimliğini, rolünü, PIN'ini ya da yetkisini KANITLAMAZ; tarayıcıda herkes üretebilir/değiştirebilir.
   Stok yazmaya gerçekten bağlanmadan önce aşağıdaki alanlar SUNUCU tarafında (ör. Firestore kuralları / sunucu işlevi)
   doğrulanmalıdır. Bu ders bu doğrulamayı EKLEMEZ; yalnız taslağını tanımlar. */
export const MUTABAKAT_GUVEN_SINIRI = Object.freeze({
  yetkiKaniti: false,
  kaynak: 'ISTEMCI_TASLAGI',
  aciklama: 'İstemcide üretilen mutabakat nesnesi tek başına yetki kanıtı değildir; sunucu doğrulaması olmadan stok yazımına dayanak yapılamaz.',
  sunucuDogrulamaAlanlari: Object.freeze([
    'onaylayanUid (Firebase Auth kimliği; istemcinin beyanı değil, sunucunun gördüğü kimlik)',
    'onaylayanRol (sunucudaki rol kaydından; mutabakat yetkisi olan rol)',
    'kayitKimligi (satış/transfer/iş emri kimliği + satır numarası; başka kayda taşınamaz)',
    'urunParmagi (yazım anındaki ürün verisiyle sunucuda yeniden hesaplanır)',
    'hedefIdx ve hedefRid (yazım anındaki renk listesiyle eşleşmeli)',
    'zaman (sunucu saati; istemci saati değil) ve tek kullanımlık onay kimliği (tekrar kullanım engeli)',
    'gerekce ve kanit (boş olamaz; denetim kaydına yazılır)',
  ]),
});

export const ISLEM = Object.freeze({ STOK_DEGISTIRME: 'STOK_DEGISTIRME', SALT_OKUMA: 'SALT_OKUMA' });
const ONAY_TURU = 'RENK_MUTABAKAT';
const RID_BICIM = /^r_[A-Za-z0-9-]{1,64}$/;

const sahip = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const nesneMi = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const ilkel = (x) => (x === null || ['string', 'number', 'boolean'].includes(typeof x) ? x : null);
const doluMetin = (x) => typeof x === 'string' && x.trim().length > 0;
const gecerliUid = (x) => (typeof x === 'number' && Number.isFinite(x)) || doluMetin(x);
const ridGecerli = (x) => typeof x === 'string' && RID_BICIM.test(x);
const silinmisMi = (r) => r.silindi === true;

/* Türkçe güvenli ad anahtarı: NFC + trim + Türkçe küçük harf (I→ı, İ→i). Benzerlik/yaklaşık eşleşme YOK. */
export function adAnahtari(ad) {
  if (typeof ad !== 'string') return null;
  return ad.normalize('NFC').trim().replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
}

/* Kanonik parmak izi: anahtarlar sıralı, dizi sırası korunur, metin birebir (özet/hash yok → çakışma yok).
   Döngü (gerçek ata zinciri) bulunursa hata fırlatır; çağıran GECERSIZ_VERI'ye çevirir. */
function kanonik(x, atalar = new Set()) {
  if (x === null) return 'null';
  const t = typeof x;
  if (t === 'string') return JSON.stringify(x);
  if (t === 'boolean') return x ? 'true' : 'false';
  if (t === 'undefined') return 'undef';
  if (t === 'number') return Number.isFinite(x) ? 'n:' + String(x) + (Object.is(x, -0) ? '-0' : '') : 'n:' + String(x);
  if (t === 'bigint') return 'b:' + String(x);
  if (t !== 'object') throw new Error('Parmak izi alınamayan değer türü: ' + t);
  if (atalar.has(x)) throw new Error('Döngüsel veri');
  atalar.add(x);
  let s;
  if (Array.isArray(x)) s = '[' + x.map((e) => kanonik(e, atalar)).join(',') + ']';
  else s = '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + kanonik(x[k], atalar)).join(',') + '}';
  atalar.delete(x);
  return s;
}

function sonuc(durum, neden, aciklama, ek = {}) {
  return {
    durum, neden, aciklama,
    islem: ek.islem ?? null,
    uid: ilkel(ek.uid ?? null),
    rid: typeof ek.rid === 'string' ? ek.rid : null,
    kayitAdi: typeof ek.kayitAdi === 'string' ? ek.kayitAdi : null,
    guncelAd: typeof ek.guncelAd === 'string' ? ek.guncelAd : null,
    renkIdx: Number.isInteger(ek.renkIdx) ? ek.renkIdx : null,
    adaySayisi: Number.isInteger(ek.adaySayisi) ? ek.adaySayisi : null,
    silinmis: ek.silinmis === true,
    gosterimIcin: ek.gosterimIcin === true,
    uyarilar: Array.isArray(ek.uyarilar) ? ek.uyarilar.map(String) : [],
    stokYazmaYetkisi: false,
  };
}

/* Ürünü yalnız birebir (===) kimlikle bulur. Metin/sayı karışıklığı (1 ve "1") tahmin edilmez;
   aynı kimliğin iki biçimi birlikte varsa temkinli davranılır (URUN_BELIRSIZ). */
function urunBul(urunler, uid) {
  const tam = [], gevsek = [];
  const anahtar = String(uid);
  for (const u of urunler) {
    if (!nesneMi(u) || !sahip(u, 'id') || !gecerliUid(u.id)) continue;
    if (u.id === uid) tam.push(u);
    if (String(u.id) === anahtar) gevsek.push(u);
  }
  if (tam.length === 0) return { durum: DURUM.URUN_BULUNAMADI };
  if (tam.length > 1 || gevsek.length > 1) return { durum: DURUM.URUN_BELIRSIZ, sayi: gevsek.length };
  return { urun: tam[0] };
}

/* Hedef ürünün renk listesi güvenilir mi? (dizi, her öğe nesne, ad metin, rid varsa doğru biçimde) */
function renkListesiHatasi(urun) {
  const r = urun.renkler;
  if (!Array.isArray(r)) return 'Ürünün renk listesi yok ya da dizi değil.';
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    if (!nesneMi(c)) return 'Renk listesinde eski biçimli / bozuk öğe var (sıra ' + i + ').';
    if (typeof c.ad !== 'string') return 'Renk adı metin değil (sıra ' + i + ').';
    if (sahip(c, 'rid') && c.rid !== undefined && !ridGecerli(c.rid)) return 'Renk kimliği (rid) bozuk biçimde (sıra ' + i + ').';
  }
  return null;
}

function islemCoz(secenekler) {
  if (secenekler === undefined) return { islem: ISLEM.STOK_DEGISTIRME, onay: undefined };
  if (!nesneMi(secenekler)) return null;
  const islem = secenekler.islem === undefined ? ISLEM.STOK_DEGISTIRME : secenekler.islem;
  if (islem !== ISLEM.STOK_DEGISTIRME && islem !== ISLEM.SALT_OKUMA) return null;
  return { islem, onay: secenekler.onay };
}

/* Global rid bütünlüğü (fail-closed). Çağrı başına tam tarama; kalıcı önbellek/indeks YOK (eskime riski yok).
   - rid taşıyamayan biçimler zararsızdır ve atlanır: boş ürün kaydı (null), renk listesi olmayan ürün,
     boş / metin (eski biçim ad) renk öğesi.
   - rid taşıyabilecek ama okunamayan her şey doğrulamayı İMKÂNSIZ kılar → hata: dizi/nesne olmayan ürün kaydı,
     dizi olmayan renk listesi, nesne/metin/boş dışındaki renk öğesi, bozuk tip/biçimde rid, mükerrer ürün kimliği. */
function globalRidTara(urunler, rid, hedefUrun) {
  let sayi = 0, buUrunde = -1, baskaUrunde = false;
  const kimlikler = new Set();
  for (let j = 0; j < urunler.length; j++) {
    const u = urunler[j];
    if (u === null || u === undefined) continue;
    if (!nesneMi(u)) return { hata: 'ürün listesinde okunamayan kayıt var (sıra ' + j + ').' };
    if (sahip(u, 'id') && gecerliUid(u.id)) {
      const k2 = String(u.id);
      if (kimlikler.has(k2)) return { hata: 'mükerrer ürün kimliği var (' + k2 + ').' };
      kimlikler.add(k2);
    }
    const r = u.renkler;
    if (r === undefined || r === null) continue;
    if (!Array.isArray(r)) return { hata: 'bir ürünün renk listesi dizi değil (ürün sıra ' + j + ').' };
    for (let i = 0; i < r.length; i++) {
      const c = r[i];
      if (c === null || c === undefined || typeof c === 'string') continue;
      if (!nesneMi(c)) return { hata: 'bir ürünün renk listesinde okunamayan öğe var (ürün sıra ' + j + ', renk sıra ' + i + ').' };
      if (!sahip(c, 'rid') || c.rid === undefined) continue;
      if (!ridGecerli(c.rid)) return { hata: 'bir renkte bozuk tip/biçimde rid var (ürün sıra ' + j + ', renk sıra ' + i + ').' };
      if (c.rid === rid) { sayi++; if (u === hedefUrun) buUrunde = i; else baskaUrunde = true; }
    }
  }
  return { sayi, buUrunde, baskaUrunde };
}

function ridIleCoz(veri, urun, ref, islem, onayVar) {
  const rid = ref.rid;
  const temel = { islem, uid: ref.uid, rid: typeof rid === 'string' ? rid : null, kayitAdi: typeof ref.ad === 'string' ? ref.ad : null };
  if (!ridGecerli(rid)) return sonuc(DURUM.GECERSIZ_REFERANS, 'RID_BICIMI_GECERSIZ', 'Kayıttaki renk kimliği (rid) geçersiz tipte ya da biçimde; eski kayıt gibi ada düşülmez.', temel);
  const tarama = globalRidTara(veri.urunler, rid, urun);
  if (tarama.hata) return sonuc(DURUM.GECERSIZ_VERI, 'GLOBAL_BUTUNLUK_DOGRULANAMADI', 'Renk kimliğinin (rid) tüm veride benzersiz olduğu doğrulanamadı: ' + tarama.hata + ' Kesin eşleşme verilmedi.', temel);
  const { sayi, buUrunde, baskaUrunde } = tarama;
  if (sayi > 1) return sonuc(DURUM.KIMLIK_CAKISMASI, 'RID_MUKERRER', 'Aynı renk kimliği (rid) veride ' + sayi + ' kez geçiyor; hangisi olduğu kesin değil, işlem durduruldu.', { ...temel, adaySayisi: sayi });
  if (buUrunde < 0) {
    const ac = baskaUrunde
      ? 'Renk kimliği (rid) başka ürüne ait; bu ürüne bağlanmaz ve ada düşülmez.'
      : 'Renk kimliği (rid) bu üründe bulunamadı; ada düşülmez.';
    return sonuc(DURUM.BULUNAMADI, baskaUrunde ? 'RID_BASKA_URUNDE' : 'RID_YOK', ac, { ...temel, adaySayisi: 0 });
  }
  const c = urun.renkler[buUrunde];
  const uyarilar = [];
  if (onayVar) uyarilar.push('Kimlikli kayıtta mutabakat onayı gerekmez; verilen onay yok sayıldı.');
  if (typeof ref.ad === 'string' && adAnahtari(ref.ad) !== adAnahtari(c.ad)) uyarilar.push('Renk adı kayıttan sonra değişmiş (kayıt: ' + ref.ad + ', güncel: ' + c.ad + ').');
  const ortak = { ...temel, guncelAd: c.ad, renkIdx: buUrunde, adaySayisi: 1, uyarilar };
  if (silinmisMi(c)) {
    if (islem === ISLEM.STOK_DEGISTIRME) return sonuc(DURUM.SILINMIS, 'RENK_SILINMIS', 'Renk silinmiş; stok işlemi için canlandırılmaz.', { ...ortak, silinmis: true });
    return sonuc(DURUM.UYGUN, 'RID_ESLESTI_SILINMIS', 'Renk kimlikle bulundu ama silinmiş; yalnız gösterim için işaretli.', { ...ortak, silinmis: true, gosterimIcin: true });
  }
  return sonuc(DURUM.UYGUN, 'RID_ESLESTI', 'Renk kimliği (rid) birebir eşleşti.', ortak);
}

function onayHatasi(onay, ref) {
  if (!nesneMi(onay)) return 'Onay geçerli bir mutabakat kaydı değil (ör. yalnız "true" yeterli değildir).';
  if (onay.tur !== ONAY_TURU) return 'Onay türü tanınmadı.';
  if (onay.yetkiKaniti !== false || onay.guvenSiniri !== MUTABAKAT_GUVEN_SINIRI.kaynak) return 'İstemci tarafı onay yetki kanıtı olduğunu iddia edemez (güven sınırı ihlali).';
  if (!doluMetin(onay.gerekce)) return 'Onayda gerekçe yok ya da boş.';
  if (!Array.isArray(onay.kanit) || onay.kanit.length === 0 || !onay.kanit.every(doluMetin)) return 'Onayda kanıt yok ya da boş kanıt var.';
  if (typeof onay.urunParmagi !== 'string' || !Number.isInteger(onay.hedefIdx) || typeof onay.referansAd !== 'string') return 'Onay eksik alanlı (anlık görüntü/hedef bilgisi yok).';
  if (onay.uid !== ref.uid || onay.referansAd !== adAnahtari(ref.ad)) return 'Onay başka bir kayda / başka bir renge ait.';
  return null;
}

function adIleCoz(urun, ref, islem, onay) {
  const temel = { islem, uid: ref.uid, kayitAdi: typeof ref.ad === 'string' ? ref.ad : null };
  if (!doluMetin(ref.ad)) return sonuc(DURUM.GECERSIZ_REFERANS, 'AD_YOK', 'Kayıtta ne renk kimliği ne de renk adı var; barkod/koddan tahmin yapılmaz.', temel);
  const anahtar = adAnahtari(ref.ad);
  const aktif = [], silinen = [];
  urun.renkler.forEach((c, i) => { if (adAnahtari(c.ad) === anahtar) (silinmisMi(c) ? silinen : aktif).push(i); });
  if (aktif.length === 0 && silinen.length > 0) return sonuc(DURUM.SILINMIS, 'AD_SILINMIS_RENKTE', 'Bu adla yalnız silinmiş renk var; silinmiş renk canlandırılmaz.', { ...temel, adaySayisi: 0, silinmis: true });
  if (aktif.length === 0) return sonuc(DURUM.BULUNAMADI, 'AD_ADAY_YOK', 'Bu üründe bu adla renk yok; benzer ad, barkod veya koddan eşleşme yapılmaz.', { ...temel, adaySayisi: 0 });
  if (aktif.length > 1) return sonuc(DURUM.BELIRSIZ, 'AD_COK_ADAY', 'Bu adla ' + aktif.length + ' renk var; ilki seçilmez, elle karar gerekir.', { ...temel, adaySayisi: aktif.length });
  const idx = aktif[0]; const c = urun.renkler[idx];
  if (silinen.length > 0) return sonuc(DURUM.BELIRSIZ, 'AD_YENIDEN_ACILMIS', 'Aynı adla silinmiş bir eş var; renk sonradan yeniden açılmış olabilir, kesin sayılmaz.', { ...temel, adaySayisi: 1 + silinen.length });
  if (typeof ref.tarih === 'number' && typeof c.olusma === 'number' && c.olusma > ref.tarih) return sonuc(DURUM.BELIRSIZ, 'RENK_KAYITTAN_SONRA', 'Renk, kayıttan SONRA oluşturulmuş; aynı adlı başka bir renk olabilir, kesin sayılmaz.', { ...temel, adaySayisi: 1 });
  const uyarilar = [];
  if (ref.ad !== c.ad) uyarilar.push('Kayıttaki ad ile güncel ad arasında harf büyüklüğü / boşluk farkı var.');
  const ortak = { ...temel, guncelAd: c.ad, renkIdx: idx, adaySayisi: 1, uyarilar };
  if (islem === ISLEM.SALT_OKUMA) return sonuc(DURUM.ADAY, 'AD_TEK_ADAY', 'Tek aday bulundu ama bu kesin kanıt değildir; yalnız gösterim içindir.', { ...ortak, gosterimIcin: true });
  if (onay === undefined) return sonuc(DURUM.MUTABAKAT_GEREKLI, 'MUTABAKAT_YOK', 'Eski (kimliksiz) kayıtta stok işlemi için açık mutabakat onayı gerekir; tek aday kanıt değildir.', ortak);
  const hata = onayHatasi(onay, ref);
  if (hata) return sonuc(DURUM.ONAY_GECERSIZ, 'ONAY_GECERSIZ', hata, ortak);
  let parmak;
  try { parmak = kanonik(urun); } catch (e) { return sonuc(DURUM.GECERSIZ_VERI, 'PARMAK_IZI_ALINAMADI', 'Ürün verisinin anlık görüntüsü alınamadı (döngüsel/bozuk veri): ' + e.message, ortak); }
  if (parmak !== onay.urunParmagi) return sonuc(DURUM.ESKI_ONAY_GECERSIZ, 'ONAY_ESKIMIS', 'Onay verildikten sonra ürün/renk verisi değişmiş; onay eskidi, yeniden mutabakat gerekir.', ortak);
  if (onay.hedefIdx !== idx) return sonuc(DURUM.ONAY_GECERSIZ, 'ONAY_HEDEF_FARKLI', 'Onaydaki hedef renk bu adayla aynı değil.', ortak);
  ortak.uyarilar.push('Mutabakat istemci tarafında üretildi; kullanıcı kimliği veya yetkisi kanıtı DEĞİLDİR (sunucu doğrulaması gerekir).');
  return sonuc(DURUM.MUTABAKATLI, 'MUTABAKAT_GECERLI', 'Mutabakat onayı geçerli; ancak bu durum stok yazma yetkisi vermez. Gerçek yazım, aynı anda onay ile verinin sürüm kontrolünü yapan atomik bir işlemde yeniden doğrulanmalıdır.', ortak);
}

/** Ana çözümleyici. Hiçbir zaman istisna fırlatmaz; her durumda sonuç nesnesi döner. */
export function renkCoz(veri, referans, secenekler) {
  try {
    if (!nesneMi(veri) || !Array.isArray(veri.urunler)) return sonuc(DURUM.GECERSIZ_VERI, 'VERI_BOZUK', 'Veri yok ya da ürün listesi bozuk.');
    if (!nesneMi(referans)) return sonuc(DURUM.GECERSIZ_REFERANS, 'REFERANS_BOZUK', 'Çözülecek kayıt (referans) geçerli bir nesne değil.');
    const sec = islemCoz(secenekler);
    if (!sec) return sonuc(DURUM.GECERSIZ_REFERANS, 'ISLEM_BILINMIYOR', 'İşlem türü tanınmadı (yalnız STOK_DEGISTIRME veya SALT_OKUMA).', { uid: referans.uid });
    const islem = sec.islem;
    const temel = { islem, uid: referans.uid, rid: referans.rid, kayitAdi: referans.ad };
    if (!sahip(referans, 'uid') || !gecerliUid(referans.uid)) return sonuc(DURUM.GECERSIZ_REFERANS, 'URUN_KIMLIGI_YOK', 'Kayıtta ürün kimliği yok ya da geçersiz; ürün koduna/ada göre tahmin yapılmaz.', temel);
    const ub = urunBul(veri.urunler, referans.uid);
    if (ub.durum === DURUM.URUN_BULUNAMADI) return sonuc(DURUM.URUN_BULUNAMADI, 'URUN_YOK', 'Bu kimlikle (birebir, tip dahil) ürün bulunamadı.', temel);
    if (ub.durum === DURUM.URUN_BELIRSIZ) return sonuc(DURUM.URUN_BELIRSIZ, 'URUN_MUKERRER', 'Aynı ürün kimliği birden fazla üründe var; hangisi olduğu kesin değil.', temel);
    const listeHata = renkListesiHatasi(ub.urun);
    if (listeHata) return sonuc(DURUM.GECERSIZ_VERI, 'RENK_LISTESI_BOZUK', listeHata, temel);
    if (sahip(referans, 'rid')) return ridIleCoz(veri, ub.urun, referans, islem, sec.onay !== undefined);
    return adIleCoz(ub.urun, referans, islem, sec.onay);
  } catch (e) {
    return sonuc(DURUM.GECERSIZ_VERI, 'BEKLENMEYEN_HATA', 'Veri okunurken beklenmeyen hata; işlem durduruldu: ' + (e && e.message));
  }
}

/** Ürünün kanonik parmak izi (anlık görüntü). Ürün tekil bulunamazsa ya da veri döngüselse null. */
export function urunParmagi(veri, uid) {
  try {
    if (!nesneMi(veri) || !Array.isArray(veri.urunler) || !gecerliUid(uid)) return null;
    const ub = urunBul(veri.urunler, uid);
    return ub.urun ? kanonik(ub.urun) : null;
  } catch (e) {
    return null;
  }
}

/** Eski kayıt için açık mutabakat onayı üretir: hedef ürün+renk anlık görüntüsüne bağlıdır.
    Hedef, kaydın adıyla tek aktif aday değilse ya da gerekçe/kanıt boşsa null döner (fail-closed). */
export function mutabakatOnayiOlustur(veri, referans, hedef, gerekce, kanit, ek = {}) {
  if (!nesneMi(referans) || !nesneMi(hedef) || sahip(referans, 'rid')) return null;
  if (hedef.uid !== referans.uid || !Number.isInteger(hedef.renkIdx)) return null;
  if (!doluMetin(gerekce) || !Array.isArray(kanit) || kanit.length === 0 || !kanit.every(doluMetin)) return null;
  const r = renkCoz(veri, referans, { islem: ISLEM.SALT_OKUMA });
  if (r.durum !== DURUM.ADAY || r.renkIdx !== hedef.renkIdx) return null;
  const parmak = urunParmagi(veri, referans.uid);
  if (parmak === null) return null;
  const onay = {
    tur: ONAY_TURU,
    yetkiKaniti: false,
    guvenSiniri: MUTABAKAT_GUVEN_SINIRI.kaynak,
    uid: referans.uid,
    referansAd: adAnahtari(referans.ad),
    hedefIdx: hedef.renkIdx,
    hedefAd: r.guncelAd,
    urunParmagi: parmak,
    gerekce: gerekce.trim(),
    kanit: kanit.map((k) => k.trim()),
  };
  if (nesneMi(ek)) {
    if (doluMetin(ek.onaylayan)) onay.onaylayan = ek.onaylayan;
    if (typeof ek.zaman === 'number' || doluMetin(ek.zaman)) onay.zaman = ek.zaman;
  }
  return Object.freeze(onay);
}
