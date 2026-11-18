// R2.2a: Saf renk çözümleme motoru — test/yardimci/renk-cozumleme.mjs (yalnız test; üretim koduna bağlı DEĞİL).
// renkCoz(veri, referans, secenekler) → { durum, neden, aciklama, uid, rid, kayitAdi, guncelAd, adaySayisi, stokYazmaYetkisi:false, ... }
// Tarayıcı gerektirmez; gerçek veri, Firebase, ağ veya dosya yazımı yoktur.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import * as M from '../js/renk-cozumleme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };
let sonHata = null; const dene = (f) => { try { return f(); } catch (e) { sonHata = e.message; return null; } };
const C = (v, r, s) => dene(() => M.renkCoz(v, r, s));
const D = (x) => x && x.durum;
const kopya = (x) => JSON.parse(JSON.stringify(x));
const STOK = { islem: 'STOK_DEGISTIRME' }, OKU = { islem: 'SALT_OKUMA' };

const VERI = () => ({ urunler: [
  { id: 1, ad: 'Polo', kod: 'P1', renkler: [{ ad: 'Siyah', rid: 'r_s1', barkod: '101', loklar: { 'L-ana': 5 } }, { ad: 'Beyaz', barkod: '102', loklar: { 'L-ana': 2 } }, { ad: 'Lacivert', barkod: '103' }] },
  { id: 2, ad: 'Tişört', kod: 'P2', renkler: [{ ad: 'Gri', rid: 'r_g2', barkod: '201' }, { ad: 'Kırmızı', barkod: '202' }, { ad: 'kırmızı', barkod: '203' }] },
  { id: 3, ad: 'Kazak', kod: 'P3', renkler: [{ ad: 'İndigo', barkod: '301' }, { ad: 'Işık Mavi', barkod: '302' }] },
] });

// ---- Kimlikli kayıt ----
const t1 = C(VERI(), { uid: 1, rid: 'r_s1', ad: 'Siyah' }, OKU);
T('T1 doğru uid + rid → UYGUN; stokYazmaYetkisi false', D(t1) === 'UYGUN' && t1.rid === 'r_s1' && t1.guncelAd === 'Siyah' && t1.stokYazmaYetkisi === false, t1);
const v2 = VERI(); v2.urunler[0].renkler[0].ad = 'Antrasit'; const t2 = C(v2, { uid: 1, rid: 'r_s1', ad: 'Siyah' }, STOK);
T('T2 renk adı değişse de rid eşleşir; kayıttaki ad (Siyah) korunur, güncel ad Antrasit', D(t2) === 'UYGUN' && t2.kayitAdi === 'Siyah' && t2.guncelAd === 'Antrasit', t2);
const t3 = C(VERI(), { uid: 1, rid: 'r_yok', ad: 'Beyaz' }, OKU);
T('T3 rid bulunamazsa ada düşülmez (Beyaz var ama BULUNAMADI)', D(t3) === 'BULUNAMADI' && t3.guncelAd == null, t3);
const t4 = C(VERI(), { uid: 1, rid: 'r_g2', ad: 'Gri' }, OKU);
T('T4 başka üründeki rid (r_g2, ürün 2) ürün 1\'e bağlanmaz', D(t4) === 'BULUNAMADI' && /başka ürün/i.test(t4.aciklama), t4);
const v5 = VERI(); v5.urunler[0].renkler[1].rid = 'r_s1'; const t5 = C(v5, { uid: 1, rid: 'r_s1' }, OKU);
T('T5 aynı üründe mükerrer rid → KIMLIK_CAKISMASI', D(t5) === 'KIMLIK_CAKISMASI', t5);
const v6 = VERI(); v6.urunler[1].renkler[1].rid = 'r_s1'; const t6 = C(v6, { uid: 1, rid: 'r_s1' }, OKU);
T('T6 farklı ürünlerde aynı rid → KIMLIK_CAKISMASI', D(t6) === 'KIMLIK_CAKISMASI', t6);
const v7 = VERI(); v7.urunler.push({ id: 1, ad: 'Kopya', renkler: [{ ad: 'Siyah' }] }); const t7 = C(v7, { uid: 1, rid: 'r_s1' }, OKU); const t7b = C(v7, { uid: 1, ad: 'Beyaz' }, OKU);
T('T7 mükerrer ürün ID → URUN_BELIRSIZ (kimlikli ve kimliksiz referansta)', D(t7) === 'URUN_BELIRSIZ' && D(t7b) === 'URUN_BELIRSIZ', { t7, t7b });
const v7c = VERI(); v7c.urunler.push({ id: '1', ad: 'Metin kimlik', renkler: [] }); const t7c = C(v7c, { uid: 1, ad: 'Beyaz' }, OKU);
T('T7b 1 ve "1" kimlikli iki ürün → URUN_BELIRSIZ (temkinli)', D(t7c) === 'URUN_BELIRSIZ', t7c);
const t8 = C(VERI(), { rid: 'r_s1' }, OKU), t8b = C(VERI(), { ad: 'Beyaz' }, OKU), v8 = VERI(); v8.urunler.push({ ad: 'Kimliksiz', renkler: [{ ad: 'Mor' }] }); const t8c = C(v8, { uid: undefined, ad: 'Mor' }, OKU);
T('T8 eksik ürün ID → GECERSIZ_REFERANS; kimliksiz ürün tahminle bulunmaz', D(t8) === 'GECERSIZ_REFERANS' && D(t8b) === 'GECERSIZ_REFERANS' && D(t8c) === 'GECERSIZ_REFERANS', { t8, t8b, t8c });

// ---- Kimliksiz eski kayıt ----
const t9 = C(VERI(), { uid: 1, ad: 'Beyaz' }, OKU);
T('T9 eski kayıt, tek aday → ADAY (kesin kanıt değil), adaySayisi 1', D(t9) === 'ADAY' && t9.adaySayisi === 1 && /kanıt/i.test(t9.aciklama) && t9.stokYazmaYetkisi === false, t9);
const t10 = C(VERI(), { uid: 1, ad: 'Mor' }, OKU);
T('T10 eski kayıt, sıfır aday → BULUNAMADI', D(t10) === 'BULUNAMADI' && t10.adaySayisi === 0, t10);
const t11 = C(VERI(), { uid: 2, ad: 'Kırmızı' }, OKU);
T('T11 eski kayıt, çok aday (Kırmızı/kırmızı) → BELIRSIZ, ilki seçilmez', D(t11) === 'BELIRSIZ' && t11.adaySayisi === 2 && t11.guncelAd == null, t11);
const t12 = C(VERI(), { uid: 1, ad: 'Beyaz' }, STOK);
T('T12 eski kayıt, stok işlemi → MUTABAKAT_GEREKLI', D(t12) === 'MUTABAKAT_GEREKLI' && t12.stokYazmaYetkisi === false, t12);
T('T13 eski kayıt, salt okuma → gösterim adayı (güncel ad Beyaz)', D(t9) === 'ADAY' && t9.guncelAd === 'Beyaz' && t9.gosterimIcin === true, t9);

// ---- Mutabakat onayı ----
const onay = (v, ek = {}) => dene(() => M.mutabakatOnayiOlustur(v, { uid: 1, ad: 'Beyaz' }, { uid: 1, renkIdx: 1 }, 'Rafta sayıldı', ['sayım#7'], ek));
const v14 = VERI(); const t14 = C(v14, { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: true });
T('T14 boolean true onay değildir → ONAY_GECERSIZ', D(t14) === 'ONAY_GECERSIZ', t14);
const o15 = onay(VERI()); const t15 = C(VERI(), { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 && { ...o15, gerekce: '   ' } });
T('T15 boş gerekçe reddedilir', D(t15) === 'ONAY_GECERSIZ' && /gerekçe/i.test(t15.aciklama), t15);
const t16 = C(VERI(), { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 && { ...o15, kanit: [] } }), t16b = C(VERI(), { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 && { ...o15, kanit: ['  '] } });
T('T16 eksik/boş kanıt reddedilir', D(t16) === 'ONAY_GECERSIZ' && D(t16b) === 'ONAY_GECERSIZ' && /kanıt/i.test(t16.aciklama), { t16, t16b });
const t17 = C(VERI(), { uid: 1, ad: 'Lacivert' }, { ...STOK, onay: o15 });
const o17b = dene(() => M.mutabakatOnayiOlustur(VERI(), { uid: 1, ad: 'Beyaz' }, { uid: 1, renkIdx: 2 }, 'yanlış hedef', ['x']));
T('T17 başka renge ait onay (Beyaz onayı Lacivert için) ve yanlış hedefe bağlı onay reddedilir', D(t17) === 'ONAY_GECERSIZ' && (o17b === null || D(C(VERI(), { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o17b })) === 'ONAY_GECERSIZ'), { t17, o17b });
const v18 = VERI(); v18.urunler[0].renkler[1].barkod = '999'; const t18 = C(v18, { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 });
T('T18 eski snapshot onayı (hedef renk değişti) → ESKI_ONAY_GECERSIZ', D(t18) === 'ESKI_ONAY_GECERSIZ', t18);
const t19 = C(VERI(), { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 });
T('T19 geçerli mutabakat → MUTABAKATLI ama stokYazmaYetkisi false; atomiklik uyarısı', D(t19) === 'MUTABAKATLI' && t19.stokYazmaYetkisi === false && t19.guncelAd === 'Beyaz' && /atomik|sürüm/i.test(t19.aciklama), t19);
const v31 = VERI(); v31.urunler[0].renkler.reverse(); const t31 = C(v31, { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 });
T('T31 renk sırası değişince eski onay geçersiz (Beyaz aynı sırada kalsa bile)', D(t31) === 'ESKI_ONAY_GECERSIZ', t31);
const v32 = VERI(); v32.urunler[0].renkler[0].loklar['L-ana'] = 4; const t32 = C(v32, { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 });
T('T32 ilgili ürünün (başka renginin) stoku değişince onay geçersiz', D(t32) === 'ESKI_ONAY_GECERSIZ', t32);
const v33 = VERI(); v33.urunler[1].renkler[0].ad = 'Duman'; v33.urunler.push({ id: 9, ad: 'Yeni', renkler: [] }); const t33 = C(v33, { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 });
T('T33 ilgisiz ürün değişince gereksiz ret olmaz → MUTABAKATLI', D(t33) === 'MUTABAKATLI', t33);
const t33b = C(VERI(), { uid: 1, rid: 'r_s1' }, { ...STOK, onay: o15 });
T('T33b kimlikli kayıtta mutabakat gerekmez; onay olsa da kimlikle çözümlenir (UYGUN)', D(t33b) === 'UYGUN', t33b);

// ---- Eşleşme güvenliği ----
const t20 = C(VERI(), { uid: 3, ad: 'Indigo' }, OKU), t20b = C(VERI(), { uid: 3, ad: 'İNDİGO' }, OKU), t20c = C(VERI(), { uid: 3, ad: 'IŞIK MAVİ' }, OKU), t20d = C(VERI(), { uid: 3, ad: 'Isik Mavi' }, OKU);
T('T20 Türkçe harf: Indigo ≠ İndigo (BULUNAMADI); İNDİGO = İndigo (ADAY); IŞIK MAVİ = Işık Mavi; Isik ≠ Işık', D(t20) === 'BULUNAMADI' && D(t20b) === 'ADAY' && D(t20c) === 'ADAY' && D(t20d) === 'BULUNAMADI', { t20: D(t20), t20b: D(t20b), t20c: D(t20c), t20d: D(t20d) });
const t20e = C(VERI(), { uid: 1, ad: '  beyaz  ' }, OKU);
T('T20b baştaki/sondaki boşluk ve harf büyüklüğü güvenle eşleşir; harf farkı uyarılır', D(t20e) === 'ADAY' && t20e.uyarilar.some(u => /harf/i.test(u)), t20e);
const t21 = C(VERI(), { uid: 1, ad: '102' }, OKU), t21b = C(VERI(), { uid: 1, barkod: '102' }, OKU);
T('T21 barkoddan otomatik eşleşme yapılmaz', D(t21) === 'BULUNAMADI' && D(t21b) === 'GECERSIZ_REFERANS', { t21, t21b });
const t22 = C(VERI(), { uid: 1, ad: 'Beyazz' }, OKU), t22b = C(VERI(), { uid: 1, ad: 'Bey' }, OKU);
T('T22 benzer addan otomatik eşleşme yapılmaz', D(t22) === 'BULUNAMADI' && D(t22b) === 'BULUNAMADI', { t22, t22b });
const t23 = C(VERI(), { uid: 1, rid: '', ad: 'Beyaz' }, OKU), t23b = C(VERI(), { uid: 1, ad: 'Beyaz' }, OKU);
T('T23 boş rid ("") eksik rid\'den ayrılır: boş → GECERSIZ_REFERANS, eksik → ADAY', D(t23) === 'GECERSIZ_REFERANS' && D(t23b) === 'ADAY', { t23, t23b });
const t24 = [5, null, {}, ['r_s1'], true, 'r_ boşluklu'].map(rid => D(C(VERI(), { uid: 1, rid, ad: 'Siyah' }, OKU)));
T('T24 yanlış tipte/biçimde rid reddedilir, eski kayıt gibi davranılmaz', t24.every(d => d === 'GECERSIZ_REFERANS'), t24);
const v25 = VERI(); v25.urunler[0].renkler = 'Siyah,Beyaz'; const v25b = VERI(); v25b.urunler[0].renkler.push('#ff0000'); const v25c = VERI(); delete v25c.urunler[0].renkler;
T('T25 bozuk renk listesi (metin / eski biçim öğe / eksik) → GECERSIZ_VERI', [C(v25, { uid: 1, ad: 'Beyaz' }, OKU), C(v25b, { uid: 1, ad: 'Beyaz' }, OKU), C(v25c, { uid: 1, ad: 'Beyaz' }, OKU)].every(x => D(x) === 'GECERSIZ_VERI'), sonHata);
const v26 = VERI(); v26.urunler[0].renkler[1].silindi = true; const t26 = C(v26, { uid: 1, ad: 'Beyaz' }, OKU); const v26b = VERI(); v26b.urunler[0].renkler[0].silindi = true; const t26b = C(v26b, { uid: 1, rid: 'r_s1' }, STOK), t26c = C(v26b, { uid: 1, rid: 'r_s1' }, OKU);
T('T26 silinmiş renk canlandırılmaz: adla aday olmaz (SILINMIS); kimlikle stok işleminde SILINMIS, okumada işaretli', D(t26) === 'SILINMIS' && D(t26b) === 'SILINMIS' && D(t26c) === 'UYGUN' && t26c.silinmis === true, { t26, t26b, t26c });
const v27 = VERI(); v27.urunler[0].renkler[1].silindi = true; v27.urunler[0].renkler.push({ ad: 'Beyaz', barkod: '777' }); const t27 = C(v27, { uid: 1, ad: 'Beyaz' }, OKU);
const v27b = VERI(); v27b.urunler[0].renkler[1].olusma = 200; const t27b = C(v27b, { uid: 1, ad: 'Beyaz', tarih: 100 }, OKU);
T('T27 aynı adla yeniden açılmış renk kesin sayılmaz: silinmiş eşi varsa / kayıttan sonra oluşturulmuşsa BELIRSIZ', D(t27) === 'BELIRSIZ' && D(t27b) === 'BELIRSIZ', { t27, t27b });
const t34 = C(VERI(), { uid: '1', rid: 'r_s1' }, OKU), t34b = C(VERI(), { uid: '1', ad: 'Beyaz' }, OKU);
T('T34 string/number kimlik karışıklığı: "1" ile ürün 1 eşleşmez (URUN_BULUNAMADI)', D(t34) === 'URUN_BULUNAMADI' && D(t34b) === 'URUN_BULUNAMADI', { t34, t34b });
const t35 = C(VERI(), { uid: 'P1', ad: 'Beyaz' }, OKU), t35b = C(VERI(), { kod: 'P1', ad: 'Beyaz' }, OKU);
T('T35 ürün kodundan tahmin yapılmaz', D(t35) === 'URUN_BULUNAMADI' && D(t35b) === 'GECERSIZ_REFERANS', { t35, t35b });

// ---- Saflık ve dayanıklılık ----
const derinDondur = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(derinDondur); Object.freeze(o); } return o; };
const vd = derinDondur(VERI()); const r28 = [C(vd, { uid: 1, ad: 'Beyaz' }, OKU), C(vd, { uid: 1, rid: 'r_s1' }, STOK), C(vd, { uid: 2, ad: 'Kırmızı' }, STOK)];
T('T28 kaynak veri değişmez (derin dondurulmuş girdiyle çalışır, sonra birebir aynı)', r28.every(x => x && x.durum) && JSON.stringify(vd) === JSON.stringify(VERI()), r28.map(D));
const ref29 = VERI(); const r29 = C(ref29, { uid: 1, rid: 'r_s1' }, OKU); const kaynakNesneler = new Set(); (function topla(o) { if (o && typeof o === 'object') { kaynakNesneler.add(o); Object.values(o).forEach(topla); } })(ref29);
let paylasim = false; (function bak(o) { if (o && typeof o === 'object') { if (kaynakNesneler.has(o)) paylasim = true; Object.values(o).forEach(bak); } })(r29);
if (r29) r29.guncelAd = 'DEĞİŞTİ';
T('T29 sonuç kaynak nesnelere referans paylaşmaz; sonucu değiştirmek kaynağı etkilemez', r29 && !paylasim && ref29.urunler[0].renkler[0].ad === 'Siyah', { paylasim });
const r30 = [1, 2, 3].map(() => JSON.stringify([C(VERI(), { uid: 1, ad: 'Beyaz' }, STOK), C(VERI(), { uid: 2, ad: 'Kırmızı' }, OKU), C(VERI(), { uid: 1, rid: 'r_s1' }, OKU)]));
T('T30 aynı girdi aynı sonucu üretir', r30[0] === r30[1] && r30[1] === r30[2] && (r30[0].match(/"durum"/g) || []).length === 3, null);
const v36 = VERI(); v36.urunler[0].kendisi = v36.urunler[0]; const t36 = C(v36, { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 }); const t36b = C(v36, { uid: 1, ad: 'Beyaz' }, OKU);
const v36c = VERI(); v36c.urunler[0].renkler[1].dongu = v36c.urunler[0].renkler; const t36c = C(v36c, { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: o15 });
T('T36 döngüsel veri güvenli: stok/onay yolunda GECERSIZ_VERI (istisna fırlamaz), okuma yolu çökmez', D(t36) === 'GECERSIZ_VERI' && D(t36c) === 'GECERSIZ_VERI' && t36b && t36b.durum, { t36, t36b: D(t36b), t36c: D(t36c) });
const bos = [null, undefined, 5, 'x', {}, { urunler: null }, { urunler: 'x' }].map(v => D(C(v, { uid: 1, ad: 'Beyaz' }, OKU)));
const bosRef = [null, undefined, 5, 'x', []].map(r => D(C(VERI(), r, OKU)));
T('T-ek null/undefined/bozuk veri → GECERSIZ_VERI; bozuk referans → GECERSIZ_REFERANS (istisna yok)', bos.every(d => d === 'GECERSIZ_VERI') && bosRef.every(d => d === 'GECERSIZ_REFERANS'), { bos, bosRef });
const bilinmeyenIslem = C(VERI(), { uid: 1, ad: 'Beyaz' }, { islem: 'SIL' }), varsayilan = C(VERI(), { uid: 1, ad: 'Beyaz' });
T('T-ek bilinmeyen işlem → GECERSIZ_REFERANS; işlem verilmezse en katı yol (STOK_DEGISTIRME)', D(bilinmeyenIslem) === 'GECERSIZ_REFERANS' && D(varsayilan) === 'MUTABAKAT_GEREKLI', { b: D(bilinmeyenIslem), v: D(varsayilan) });
const buyuk = { urunler: Array.from({ length: 20000 }, (_, i) => ({ id: i + 1, ad: 'U' + i, renkler: [{ ad: 'Siyah', rid: 'r_b' + i }, { ad: 'Beyaz' }, { ad: 'Gri' }] })) };
const t0 = process.hrtime.bigint(); const rb = C(buyuk, { uid: 19999, rid: 'r_b19998' }, OKU), rb2 = C(buyuk, { uid: 15000, ad: 'Beyaz' }, OKU); const sure = Number(process.hrtime.bigint() - t0) / 1e6;
T('T-ek çok büyük girdi (20.000 ürün / 60.000 renk) doğru ve makul sürede (<3 sn)', D(rb) === 'UYGUN' && D(rb2) === 'ADAY' && sure < 3000, { sure, d1: D(rb), d2: D(rb2) });
const tumDurumlar = ['UYGUN', 'ADAY', 'MUTABAKAT_GEREKLI', 'BULUNAMADI', 'BELIRSIZ', 'GECERSIZ_REFERANS', 'KIMLIK_CAKISMASI', 'URUN_BELIRSIZ', 'ESKI_ONAY_GECERSIZ'];
const ornek = [t1, t9, t12, t10, t11, t8, t5, t7, t18, t19, t14, t26, t34, bilinmeyenIslem].filter(Boolean);
T('T-ek sözleşme: zorunlu durumlar tanımlı; her sonuçta durum/neden/aciklama/uid/rid/kayitAdi/guncelAd/adaySayisi/stokYazmaYetkisi=false', tumDurumlar.every(d => M.DURUM && M.DURUM[d] === d) && ornek.length === 14 && ornek.every(x => ['durum', 'neden', 'aciklama', 'uid', 'rid', 'kayitAdi', 'guncelAd', 'adaySayisi', 'stokYazmaYetkisi'].every(k => k in x) && x.stokYazmaYetkisi === false && typeof x.aciklama === 'string' && x.aciklama.length > 5), ornek.map(D));

// ---- İzolasyon ----
const kaynak = fs.readFileSync(path.join(ROOT, 'js/renk-cozumleme.mjs'), 'utf8');
const kod = kaynak.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const yasak = ['firebase', 'firestore', 'localStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest', 'document.', 'window.', "from 'fs'", "from 'node:fs'", 'process.', 'Math.random', 'Date.now', 'crypto', 'require(', 'import(', 'db.'];
const tuzakAd = ['fetch', 'localStorage', 'document', 'window', 'indexedDB', 'firebase', 'db', 'XMLHttpRequest', 'crypto']; const eski = {};
tuzakAd.forEach(k => { eski[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { configurable: true, get() { throw new Error('YASAK erişim: ' + k); } }); });
let izole; const eskiRandom = Math.random, eskiNow = Date.now; Math.random = () => { throw new Error('Math.random'); }; Date.now = () => { throw new Error('Date.now'); };
try { const o = M.mutabakatOnayiOlustur(VERI(), { uid: 1, ad: 'Beyaz' }, { uid: 1, renkIdx: 1 }, 'g', ['k']); izole = [M.renkCoz(VERI(), { uid: 1, ad: 'Beyaz' }, { islem: 'STOK_DEGISTIRME', onay: o }).durum, M.renkCoz(VERI(), { uid: 1, rid: 'r_s1' }, OKU).durum]; }
catch (e) { izole = 'HATA: ' + e.message; }
finally { Math.random = eskiRandom; Date.now = eskiNow; tuzakAd.forEach(k => { delete globalThis[k]; if (eski[k]) Object.defineProperty(globalThis, k, eski[k]); }); }
T('T37 ağ/dosya/DOM/depo/zaman/rastgelelik erişimi yok (erişim tuzaklarıyla gerçek çağrı + kaynak taraması)', Array.isArray(izole) && izole[0] === 'MUTABAKATLI' && izole[1] === 'UYGUN' && !yasak.some(k => kod.includes(k)), { izole, yasak: yasak.filter(k => kod.includes(k)) });
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// T39 (Ders 46 sözleşmesi; Ders 47'de kullanıcı onayıyla daraltılarak güncellendi): index.html motoru yükler ve hazır durumunu bildirir.
//   - İkinci implementasyon index.html'e kopyalanamaz; tek kaynak js/renk-cozumleme.mjs.
//   - YALNIZ yeni satış rid doğrulaması (sepEkle / kaydetSatis → _satisRidDogrula / _satisRidHatasi) motoru SALT_OKUMA ile kullanabilir.
//   - Ders 48 (Karar 2/3): iptale özgü doğrulama yardımcısı _satisIptalHazirla da yalnız _satisRidDogrula üzerinden (SALT_OKUMA) kullanabilir;
//     silSatis motoru doğrudan çağırmaz.
//   - iptal/stok/transfer/üretim/portal/senkron/finans fonksiyonları motoru ne doğrudan ne dolaylı ÇAĞIRAMAZ.
//   Kaynak sözleşmesi + gerçek tarayıcıda yükleme ve sayaçlı (casus) motorla "iş akışı çağırmıyor" kanıtı.
const t39Yukleyici = (indexHtml.match(/<script>(\s*\/\* R2\.2b\.1[\s\S]*?)<\/script>/) || [])[1] || '';
const t39Disi = indexHtml.replace(t39Yukleyici, '');
const t39IsFn = ['stokUygula', 'kirikStokUygula', 'defoUygula', 'applySatis', 'revertSatis', 'silSatis', 'satisGeriAl', 'transferStokUygula', '_isEmriStoklaCommit', 'portalOnay', 'canliDomenUygula', '_recMerge', '_sbAl', '_kumulatifBirlestir', 'kasaHareket'];
const t39Govde = (ad) => { const i = indexHtml.indexOf('function ' + ad + '('); return i < 0 ? '' : indexHtml.slice(i, indexHtml.indexOf('\nfunction ', i + 10)); };
const t39Dogrula = t39Govde('_satisRidDogrula'), t39Hatasi = t39Govde('_satisRidHatasi'), t39Sep = t39Govde('sepEkle'), t39Kay = t39Govde('kaydetSatis'), t39Iptal = t39Govde('_satisIptalHazirla');
const t39Kalan = [t39Dogrula, t39Hatasi, t39Sep, t39Kay, t39Iptal].reduce((h, g) => g ? h.replace(g, '') : h, t39Disi);
const t39Kaynak = {
  yukleyiciVar: /import\('\.\/js\/renk-cozumleme\.mjs'\)/.test(t39Yukleyici),
  yalnizYukleyicide: (indexHtml.match(/renk-cozumleme/g) || []).length === 1 && !/renk-cozumleme/.test(t39Disi),
  ikinciImplYok: !/function renkCoz\b|RENK_MUTABAKAT|KIMLIK_CAKISMASI|ESKI_ONAY_GECERSIZ|globalRidTara|function kanonik\b|function adAnahtari\b/.test(indexHtml),
  motorYalnizRidDogrulamada: t39Dogrula.length > 40 && (indexHtml.match(/renkCoz\(/g) || []).length === 1 && /renkCoz\(db,\{uid,rid\},\{islem:'SALT_OKUMA'\}\)/.test(t39Dogrula) &&
    !/renkMotoru/.test(t39Disi.replace(t39Dogrula, '')) && !/stokYazmaYetkisi|loklar|\.stok\s*=|save\(|push\(/.test(t39Dogrula) && !/mutabakatOnayiOlustur\(|urunParmagi\(/.test(indexHtml),
  ridYoluYalnizSatista: /_satisRidDogrula\(/.test(t39Sep) && /_satisRidHatasi\(/.test(t39Kay) && /_satisRidDogrula\(/.test(t39Hatasi) &&
    !/_satisRid(Dogrula|Hatasi)/.test(t39Kalan) && ![t39Sep, t39Kay].some(g => /renkMotoru|renkCoz|mutabakat/i.test(g)) &&
    (!t39Iptal || (/_satisRidDogrula\(/.test(t39Iptal) && !/renkMotoru|renkCoz\(/.test(t39Iptal))) && !/renkMotoru|renkCoz|_satisRid/.test(t39Govde('silSatis')),
  isFnTemiz: t39IsFn.every(f => t39Govde(f).length > 40 && !/renkMotoru|renkCoz|renk-cozumleme|mutabakat|_satisRid/i.test(t39Govde(f))),
};
let t39Tarayici = null;
try {
  const { chromium } = await import('playwright'); const http = await import('http');
  const motorYolu = path.join(ROOT, 'js/renk-cozumleme.mjs');
  const casus = fs.readFileSync(motorYolu, 'utf8').replace(/export function renkCoz\(/, 'globalThis.__t39 = 0;\nexport function renkCoz(...a) { globalThis.__t39++; return _t39Ic(...a); }\nfunction _t39Ic(');
  let casusMu = false;
  const srv = http.createServer((req, res) => { const y = decodeURIComponent(req.url.split('?')[0]);
    if (y.includes('sw.js')) { res.writeHead(404); return res.end(); }
    if (y === '/js/renk-cozumleme.mjs' && casusMu) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(casus); }
    const p = path.join(ROOT, y === '/' ? 'index.html' : y);
    try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': /\.m?js$/.test(p) ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end(); }
  }).listen(0); await new Promise(r => srv.once('listening', r));
  const br = await chromium.launch(); const ctx = await br.newContext({ serviceWorkers: 'block' });
  await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; return (h === 'localhost' || h === '127.0.0.1') ? r.continue() : r.abort(); });
  const ac = async () => { const pg = await ctx.newPage(); await pg.goto(`http://localhost:${srv.address().port}/`);
    await pg.waitForFunction(() => typeof db !== 'undefined' && window.renkMotoru && (window.renkMotoru.hazir || window.renkMotoru.hata), null, { timeout: 15000 }); return pg; };
  const p1 = await ac(); const gercek = await p1.evaluate(() => ({ hazir: window.renkMotoru.hazir, hata: window.renkMotoru.hata, sonuc: window.renkMotoru.motor && window.renkMotoru.motor.renkCoz({ urunler: [{ id: 1, renkler: [{ ad: 'A', rid: 'r_11111111-1111-4111-8111-111111111111' }] }] }, { uid: 1, rid: 'r_11111111-1111-4111-8111-111111111111' }, { islem: 'SALT_OKUMA' }).durum }));
  casusMu = true; const p2 = await ac();
  const sayac = await p2.evaluate(async () => { const once = globalThis.__t39;
    db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }]; aktifLok = 'L-ana'; db.pin = null;
    db.urunler = [{ id: 8001, ad: 'T39', birim: 'adet', pb: 'TL', stok: 0, renkler: [{ ad: 'Siyah', rid: 'r_11111111-1111-4111-8111-111111111111', stok: 0, loklar: { 'L-ana': 5 } }] }];
    db.cariler = [{ id: 'c39', ad: 'M', tip: 'musteri', bakiye: 0 }]; db.hesaplar = []; db.satislar = []; db.cekler = []; db.hareketler = []; stokProjYukle();
    const s = { id: 's39', tip: 'satis', lokId: 'L-ana', mid: 'c39', mus: 'M', pb: 'TL', tarih: 1, tutar: 10, odenen: 0, odemeler: [], kalemler: [{ uid: 8001, mik: 2, fiyat: 5, renkler: [{ ad: 'Siyah', mik: 2 }] }] };
    db.satislar.push(s); applySatis(s); silSatis('s39'); const t = $('kk-txt'); if (t) { t.value = 'SİL'; await kritikOnayla(); }
    transferStokUygula([{ uid: 8001, renk: 'Siyah', adet: 1 }], 'L-ana', 1); stokUygula({ uid: 8001, mik: 1, renkler: [{ ad: 'Siyah', mik: 1 }] }, -1, 'L-ana');
    return { once, sonra: globalThis.__t39, hazir: window.renkMotoru.hazir, iptal: !!s.iptal, stok: urun(8001).renkler[0].loklar['L-ana'] }; });
  await br.close(); srv.close();
  t39Tarayici = { gercek, sayac };
} catch (e) { t39Tarayici = { HATA: String(e && e.message || e).slice(0, 200) }; }
const t39Ok = t39Tarayici && t39Tarayici.gercek && t39Tarayici.gercek.hazir === true && t39Tarayici.gercek.hata === null && t39Tarayici.gercek.sonuc === 'UYGUN' &&
  t39Tarayici.sayac && t39Tarayici.sayac.hazir === true && t39Tarayici.sayac.once === 0 && t39Tarayici.sayac.sonra === 0 && t39Tarayici.sayac.iptal === true && t39Tarayici.sayac.stok === 5;
T('T39 index.html motoru yükler (tarayıcıda hazır), ikinci kopya içermez; motoru yalnız yeni satış rid doğrulaması (SALT_OKUMA) kullanır; iptal/stok/transfer/üretim/portal/senkron/finans çağırmaz (casus sayaç 0)',
  Object.values(t39Kaynak).every(Boolean) && t39Ok, { t39Kaynak, t39Tarayici });
const govde = (ad) => { const i = indexHtml.indexOf('function ' + ad + '('); return i < 0 ? '' : indexHtml.slice(i, indexHtml.indexOf('\nfunction ', i + 10)); };
const stokFn = ['stokUygula', 'kirikStokUygula', 'transferStokUygula', '_isEmriStoklaCommit', 'portalOnay'];
T('T40 üretim stok fonksiyonları yerinde ve çözümleme modülüne bağlanmamış (otomatik renk açma davranışı henüz değişmedi)', stokFn.every(f => govde(f).length > 50 && !/renkCoz|renk-cozumleme|mutabakat/.test(govde(f))) && /u\.renkler\.push\(ro\)/.test(govde('stokUygula')), stokFn.map(f => govde(f).length));
T('T38 önceki testlerin yerinde olduğu (tam regresyon ayrıca 01–28 çalıştırmasıyla)', ['20', '21', '22', '23', '24', '25', '26', '27'].every(n => fs.readdirSync(path.join(ROOT, 'test')).some(f => f.startsWith(n + '-'))), null);

console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
