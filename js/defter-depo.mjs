// Ders 50.3c-2 — DEFTER İZLEME DEPOSU (tarayıcı). Yalnız AYRI IndexedDB veritabanı "iqbasics-defter" kullanılır.
// YASAK: işletme verisi (db), kurtarma veritabanı "iqbasics", localStorage, Firebase. Bu modül onlara hiçbir yoldan erişmez.
// Uygulama (index.html) bu aşamada modülü YÜKLEMEZ; uygulama durumunu da kendisi OKUMAZ: yetki, taban koşulları ve senkron kanıtı
// çağırandan gelir. Her giriş noktası (okuma dahil) önce yetkiyi denetler; yetki yoksa veritabanı hiç AÇILMAZ.
// Bütün yazımlar tek okuma-yazma işleminde yapılır (yarım kayıt yok); hata ya da kota durumunda işlem geri alınır ve
// otomatik yeniden deneme YAPILMAZ. Sürüm alanıyla karşılaştır-ve-yaz; Web Locks varsa ayrıca özel kilit.
// Paket: js/defter-izleme.mjs tabanPaketle (kayıpsız, sütunlu) → JSON → gzip; bütünlük SHA-256 (yalnız bozulmayı yakalamak için).
import { tabanPaketle, tabanAc, tabanUygunMu, senkronKaniti, izlemeYetkisi, karsilastir, UYARI_SINIFLARI, SINIF } from './defter-izleme.mjs';

export const DEPO_AD = 'iqbasics-defter';
export const DEPO_SURUM = 1;
export const KILIT_AD = 'iqbasics-defter-yazim';
export const KANAL_AD = 'iqbasics-defter';
export const SINIR = Object.freeze({ toplamBayt: 25 * 1024 * 1024, taban: 3, kontrol: 500, kotaOrani: 0.5 });
export const HATA = Object.freeze({
  YETKI: 'YETKI', TABAN_KOSUL: 'TABAN_KOSUL', ONAY_YOK: 'ONAY_YOK', UYARI_ONAYI_YOK: 'UYARI_ONAYI_YOK', TABAN_YOK: 'TABAN_YOK',
  ZATEN_VAR: 'ZATEN_VAR', CAKISMA: 'CAKISMA', KILIT_MESGUL: 'KILIT_MESGUL', SINIR_TABAN: 'SINIR_TABAN', BOYUT: 'BOYUT',
  KOTA_TAHMIN: 'KOTA_TAHMIN', KOTA: 'KOTA', ISLEM_IPTAL: 'ISLEM_IPTAL', BOZUK: 'BOZUK', TANINMAYAN: 'TANINMAYAN',
  SEMA: 'SEMA', SEMA_YENI: 'SEMA_YENI', ACILAMADI: 'ACILAMADI', GECERSIZ: 'GECERSIZ',
});
const TABLOLAR = ['meta', 'tabanlar', 'kontroller'];
const red = (hata, ek) => ({ ok: false, hata, ...(ek || {}) });
const istek = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

// ortam: test için değiştirilebilir tarayıcı yetenekleri (indexedDB, locks, storage, BroadcastChannel, simdi) ve yalnız DAHA SIKI sınırlar (sinir).
// Varsayılan: tarayıcının kendisi ve SINIR.
export function depoOlustur(ortam = {}) {
  const g = globalThis, nav = g.navigator || {};
  const IDB = 'indexedDB' in ortam ? ortam.indexedDB : g.indexedDB;
  const KILIT = 'locks' in ortam ? ortam.locks : nav.locks;
  const DEPOLAMA = 'storage' in ortam ? ortam.storage : nav.storage;
  const Kanal = 'BroadcastChannel' in ortam ? ortam.BroadcastChannel : g.BroadcastChannel;
  const simdi = ortam.simdi || (() => Date.now());
  const S = Object.freeze(Object.fromEntries(Object.entries(SINIR).map(([k, v]) => [k, ortam.sinir && +ortam.sinir[k] > 0 ? Math.min(v, +ortam.sinir[k]) : v]))); // test yalnız DAHA SIKI sınır verebilir
  let baglanti = null, kanal = null, dinleyici = null;
  if (typeof Kanal === 'function') { try { kanal = new Kanal(KANAL_AD); kanal.onmessage = (e) => { if (dinleyici) try { dinleyici(e.data); } catch (x) { /* dinleyici hatası depoyu etkilemez */ } }; } catch (e) { kanal = null; } }

  const yetkiYok = (y) => { const z = izlemeYetkisi(y); return z.izin ? null : red(HATA.YETKI, { nedenler: z.nedenler }); };

  async function ac() {
    if (baglanti) return baglanti;
    if (!IDB || typeof IDB.open !== 'function') return red(HATA.ACILAMADI, { neden: 'IndexedDB yok' });
    const sonuc = await new Promise((cozum) => {
      let r; try { r = IDB.open(DEPO_AD, DEPO_SURUM); } catch (e) { return cozum(red(HATA.ACILAMADI, { neden: String(e && e.name) })); }
      r.onupgradeneeded = (e) => { const v = r.result; if (e.oldVersion < 1) {
        const m = v.createObjectStore('meta', { keyPath: 'k' }); v.createObjectStore('tabanlar', { keyPath: 'id', autoIncrement: true });
        v.createObjectStore('kontroller', { keyPath: 'id', autoIncrement: true }).createIndex('tabanId', 'tabanId');
        m.put({ k: 'sema', surum: DEPO_SURUM, olusturma: simdi() }); m.put({ k: 'boyut', toplam: 0 }); } };
      r.onblocked = () => cozum(red(HATA.ACILAMADI, { neden: 'başka sekme eski sürümle açık (engellendi)' }));
      r.onerror = () => cozum(red(r.error && r.error.name === 'VersionError' ? HATA.SEMA_YENI : HATA.ACILAMADI, { neden: String(r.error && r.error.name) }));
      r.onsuccess = () => cozum({ ok: true, db: r.result });
    });
    if (!sonuc.ok) return sonuc;
    const v = sonuc.db;
    if (!TABLOLAR.every(t => v.objectStoreNames.contains(t))) { v.close(); return red(HATA.SEMA, { neden: 'tablolar eksik' }); }
    let sema; try { sema = await istek(v.transaction('meta', 'readonly').objectStore('meta').get('sema')); } catch (e) { v.close(); return red(HATA.SEMA, { neden: 'şema okunamadı' }); }
    if (!sema || sema.surum !== DEPO_SURUM) { v.close(); return red(HATA.SEMA, { neden: 'şema kaydı eksik ya da sürüm farklı' }); }
    v.onversionchange = () => { try { v.close(); } catch (e) { /* zaten kapalı */ } baglanti = null; }; // başka sekme silmek/yükseltmek isterse yol ver
    v.onclose = () => { baglanti = null; };
    baglanti = v; return v;
  }
  const dbAl = async () => { const v = await ac(); return v && v.ok === false ? { hata: v } : { db: v }; };

  // Tek okuma-yazma işlemi. adim(tx, iptal) içinde iptal(KOD) çağrılırsa işlem geri alınır ve o kod döner. Hata → geri alma, tekrar deneme YOK.
  async function yazIslemi(tablolar, adim) {
    const { db, hata } = await dbAl(); if (hata) return hata;
    let tx; try { tx = db.transaction(tablolar, 'readwrite'); } catch (e) { return red(HATA.ACILAMADI, { neden: String(e && e.name) }); }
    let kod = null, deger;
    const bitti = new Promise((ok) => { tx.oncomplete = () => ok('tamam'); tx.onabort = () => ok('iptal'); tx.onerror = (e) => { e.preventDefault && e.preventDefault(); }; });
    try { deger = await adim(tx, (k) => { kod = k; try { tx.abort(); } catch (e) { /* zaten bitti */ } }); } catch (e) { if (!kod) { kod = e && e.name === 'QuotaExceededError' ? HATA.KOTA : HATA.ISLEM_IPTAL; try { tx.abort(); } catch (x) { /* zaten bitti */ } } }
    const s = await bitti;
    if (s === 'tamam' && !kod) return { ok: true, ...deger };
    const ad = tx.error && tx.error.name;
    return red(kod || (ad === 'QuotaExceededError' ? HATA.KOTA : HATA.ISLEM_IPTAL), { neden: ad || kod || 'işlem geri alındı' });
  }
  const kilitle = (fn) => (KILIT && typeof KILIT.request === 'function')
    ? KILIT.request(KILIT_AD, { ifAvailable: true }, (l) => (l ? fn() : red(HATA.KILIT_MESGUL, { neden: 'başka sekmede taban işlemi sürüyor' })))
    : fn();
  async function kotaUygunMu(bayt) { // TAHMİN: kesin garanti değildir; asıl koruma işlem içindeki 25 MB sınırı ve kota hatasında geri alma
    if (!DEPOLAMA || typeof DEPOLAMA.estimate !== 'function') return { uygun: true, tahmin: false };
    let e; try { e = await DEPOLAMA.estimate(); } catch (x) { return { uygun: true, tahmin: false }; }
    if (!e || !(e.quota > 0)) return { uygun: true, tahmin: false };
    return { uygun: ((e.usage || 0) + bayt) / e.quota <= S.kotaOrani, tahmin: true, kullanim: e.usage || 0, kota: e.quota };
  }
  const yay = (m) => { try { if (kanal) kanal.postMessage(m); } catch (e) { /* yayın olmasa da veri doğru */ } };

  // Gizlilik: cari/kasa ADLARI depoya yazılmaz (karşılaştırma adları güncel veriden alır; kayma/sınıf adlardan etkilenmez).
  const adsiz = (gr) => ({ ...gr, cari: Object.fromEntries(Object.entries(gr.cari).map(([k, c]) => [k, { ...c, ad: '' }])), kasa: Object.fromEntries(Object.entries(gr.kasa).map(([k, h]) => [k, { ...h, ad: '' }])) });
  async function paketle(goruntu) {
    const bayt = new TextEncoder().encode(JSON.stringify(tabanPaketle(adsiz(goruntu))));
    const sha = [...new Uint8Array(await g.crypto.subtle.digest('SHA-256', bayt))].map(b => b.toString(16).padStart(2, '0')).join('');
    const gz = await new Response(new Blob([bayt]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    return { gz, sha, hamBayt: bayt.length, boyut: gz.byteLength };
  }
  async function paketAc(kayit) {
    if (!kayit || !(kayit.paket instanceof ArrayBuffer) || typeof kayit.sha !== 'string') return red(HATA.BOZUK, { neden: 'paket alanları eksik' });
    let bayt; try { bayt = new Uint8Array(await new Response(new Blob([kayit.paket]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }
    catch (e) { return red(HATA.BOZUK, { neden: 'sıkıştırma açılamadı' }); }
    const sha = [...new Uint8Array(await g.crypto.subtle.digest('SHA-256', bayt))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (sha !== kayit.sha) return red(HATA.BOZUK, { neden: 'bütünlük özeti (SHA-256) uyuşmuyor' });
    let p; try { p = JSON.parse(new TextDecoder().decode(bayt)); } catch (e) { return red(HATA.BOZUK, { neden: 'JSON okunamadı' }); }
    const r = tabanAc(p); return r.ok ? r : red(r.hata, { neden: r.neden });
  }
  const ozetle = (k) => { const { paket, ...o } = k; return o; };
  const kosulDenetle = (kosullar, senkron) => { const a = tabanUygunMu(kosullar), b = senkronKaniti(senkron);
    return a.uygun && b.uygun ? null : red(HATA.TABAN_KOSUL, { nedenler: [...a.nedenler, ...b.nedenler] }); };
  const uyariOzet = (r) => ({ tur: r.tur, id: r.id, sinif: r.sinif, kayma: r.kayma, kalan: r.kalan, kanit: (r.kanit || []).slice(0, 6) });
  const tabanKaydi = (p, { zaman, kosullar, senkron, meta, oncekiTabanId, devralinanUyarilar }) => ({ zaman, durum: 'aktif', paket: p.gz, sha: p.sha, boyut: p.boyut, hamBayt: p.hamBayt,
    kosullar, bulutsuz: senkron.canli === false, meta: meta || {}, oncekiTabanId: oncekiTabanId || null, devralinanUyarilar: devralinanUyarilar || [] });

  // İlk taban: aktif taban yoksa. Varsa ZATEN_VAR (yenileme ayrı ve onaylı).
  async function tabanKaydet(y, { goruntu, kosullar, senkron, meta } = {}) {
    const ry = yetkiYok(y); if (ry) return ry; const rk = kosulDenetle(kosullar, senkron); if (rk) return rk;
    if (!goruntu || typeof goruntu !== 'object' || !goruntu.olay) return red(HATA.GECERSIZ, { neden: 'görüntü yok' });
    const p = await paketle(goruntu), zaman = simdi();
    if (p.boyut > S.toplamBayt) return red(HATA.BOYUT, { boyut: p.boyut });
    return kilitle(async () => {
      const kt = await kotaUygunMu(p.boyut); if (!kt.uygun) return red(HATA.KOTA_TAHMIN, { ...kt, boyut: p.boyut });
      const r = await yazIslemi(['meta', 'tabanlar'], async (tx, iptal) => {
        const m = tx.objectStore('meta'), t = tx.objectStore('tabanlar');
        const [aktif, bo, sayi] = await Promise.all([istek(m.get('aktif')), istek(m.get('boyut')), istek(t.count())]);
        if (aktif) return iptal(HATA.ZATEN_VAR);
        if (sayi >= S.taban) return iptal(HATA.SINIR_TABAN);
        if ((bo ? bo.toplam : 0) + p.boyut > S.toplamBayt) return iptal(HATA.BOYUT);
        const id = await istek(t.add(tabanKaydi(p, { zaman, kosullar, senkron, meta })));
        await istek(m.put({ k: 'aktif', tabanId: id, surum: 1, zaman }));
        await istek(m.put({ k: 'boyut', toplam: (bo ? bo.toplam : 0) + p.boyut }));
        return { tabanId: id, surum: 1, boyut: p.boyut, hamBayt: p.hamBayt, sha: p.sha, kotaTahmini: kt.tahmin };
      });
      if (r.ok) yay({ tur: 'taban', tabanId: r.tabanId, surum: r.surum });
      return r;
    });
  }

  async function aktifOku() {
    const { db, hata } = await dbAl(); if (hata) return hata;
    const tx = db.transaction(['meta', 'tabanlar'], 'readonly');
    const aktif = await istek(tx.objectStore('meta').get('aktif'));
    if (!aktif) return { ok: true, aktif: null, kayit: null };
    const kayit = await istek(tx.objectStore('tabanlar').get(aktif.tabanId));
    if (!kayit) return red(HATA.BOZUK, { neden: 'aktif taban kaydı yok' });
    return { ok: true, aktif, kayit };
  }
  async function aktifTabanOku(y) {
    const ry = yetkiYok(y); if (ry) return ry;
    const a = await aktifOku(); if (!a.ok || !a.kayit) return a.ok ? { ok: true, taban: null } : a;
    const r = await paketAc(a.kayit); if (!r.ok) return { ...r, tabanId: a.aktif.tabanId };
    return { ok: true, taban: { ...ozetle(a.kayit), surum: a.aktif.surum }, goruntu: r.goruntu };
  }

  // Yenileme: eski taban SİLİNMEZ (emekli); eski tabana göre açık uyarılar hesaplanır, gösterildiği onaylanmadan yenilenmez ve
  // yeni tabana "devralınan uyarılar" olarak kalıcı yazılır. Hiçbir uyarı "çözüldü" sayılmaz.
  async function tabanYenile(y, { goruntu, kosullar, senkron, beklenenSurum, onay, uyariOnayi, meta } = {}) {
    const ry = yetkiYok(y); if (ry) return ry;
    if (onay !== true) return red(HATA.ONAY_YOK, { neden: 'yönetici onayı yok' });
    const rk = kosulDenetle(kosullar, senkron); if (rk) return rk;
    if (!goruntu || typeof goruntu !== 'object' || !goruntu.olay) return red(HATA.GECERSIZ, { neden: 'görüntü yok' });
    return kilitle(async () => {
      const a = await aktifOku(); if (!a.ok) return a; if (!a.kayit) return red(HATA.TABAN_YOK);
      if (a.aktif.surum !== beklenenSurum) return red(HATA.CAKISMA, { surum: a.aktif.surum });
      const eski = await paketAc(a.kayit); if (!eski.ok) return { ...eski, neden: 'eski taban açılamadı: ' + eski.neden };
      const acik = karsilastir(eski.goruntu, goruntu).filter(r => UYARI_SINIFLARI.has(r.sinif)).map(uyariOzet);
      if (acik.length && uyariOnayi !== true) return red(HATA.UYARI_ONAYI_YOK, { acikUyarilar: acik });
      const p = await paketle(goruntu), zaman = simdi();
      const kt = await kotaUygunMu(p.boyut); if (!kt.uygun) return red(HATA.KOTA_TAHMIN, { ...kt, boyut: p.boyut });
      const devr = [...(a.kayit.devralinanUyarilar || []), ...acik.map(u => ({ ...u, eskiTabanId: a.aktif.tabanId, yenilemeZaman: zaman }))];
      const r = await yazIslemi(['meta', 'tabanlar'], async (tx, iptal) => {
        const m = tx.objectStore('meta'), t = tx.objectStore('tabanlar');
        const [ak, bo, sayi, ek] = await Promise.all([istek(m.get('aktif')), istek(m.get('boyut')), istek(t.count()), istek(t.get(a.aktif.tabanId))]);
        if (!ak || ak.surum !== beklenenSurum || ak.tabanId !== a.aktif.tabanId || !ek) return iptal(HATA.CAKISMA);
        if (sayi >= S.taban) return iptal(HATA.SINIR_TABAN);
        if ((bo ? bo.toplam : 0) + p.boyut > S.toplamBayt) return iptal(HATA.BOYUT);
        await istek(t.put({ ...ek, durum: 'emekli', emekliZaman: zaman }));
        const id = await istek(t.add(tabanKaydi(p, { zaman, kosullar, senkron, meta, oncekiTabanId: a.aktif.tabanId, devralinanUyarilar: devr })));
        await istek(m.put({ k: 'aktif', tabanId: id, surum: ak.surum + 1, zaman }));
        await istek(m.put({ k: 'boyut', toplam: (bo ? bo.toplam : 0) + p.boyut }));
        return { tabanId: id, surum: ak.surum + 1, eskiTabanId: a.aktif.tabanId, devralinanUyarilar: devr, boyut: p.boyut };
      });
      if (r.ok) yay({ tur: 'taban', tabanId: r.tabanId, surum: r.surum });
      return r;
    });
  }

  // Emekli tabanı silme: yalnız onayla, aktif taban silinemez.
  async function emekliTabanSil(y, { tabanId, onay } = {}) {
    const ry = yetkiYok(y); if (ry) return ry; if (onay !== true) return red(HATA.ONAY_YOK);
    return kilitle(() => yazIslemi(['meta', 'tabanlar', 'kontroller'], async (tx, iptal) => {
      const m = tx.objectStore('meta'), t = tx.objectStore('tabanlar');
      const [ak, bo, k] = await Promise.all([istek(m.get('aktif')), istek(m.get('boyut')), istek(t.get(tabanId))]);
      if (!k) return iptal(HATA.TABAN_YOK); if (k.durum !== 'emekli' || (ak && ak.tabanId === tabanId)) return iptal(HATA.GECERSIZ);
      await istek(t.delete(tabanId)); await istek(m.put({ k: 'boyut', toplam: Math.max(0, (bo ? bo.toplam : 0) - (k.boyut || 0)) }));
      return { silinen: tabanId };
    }));
  }

  // Kontrol kaydı (yalnız ekleme; en çok 500, en eskisi aynı işlemde silinir). Yalnız aktif tabana yazılır.
  async function kontrolEkle(y, { tabanId, zaman, satirlar, izleme } = {}) {
    const ry = yetkiYok(y); if (ry) return ry;
    if (!Array.isArray(satirlar)) return red(HATA.GECERSIZ, { neden: 'satırlar yok' });
    const kayit = { tabanId, zaman: zaman == null ? simdi() : zaman, satirlar: satirlar.filter(s => s.sinif !== SINIF.KAYMA_YOK).map(uyariOzet), izleme: izleme || null };
    const boyut = new TextEncoder().encode(JSON.stringify(kayit)).length; kayit.boyut = boyut;
    const kt = await kotaUygunMu(boyut); if (!kt.uygun) return red(HATA.KOTA_TAHMIN, { ...kt, boyut });
    return yazIslemi(['meta', 'kontroller'], async (tx, iptal) => {
      const m = tx.objectStore('meta'), k = tx.objectStore('kontroller');
      const [ak, bo, sayi] = await Promise.all([istek(m.get('aktif')), istek(m.get('boyut')), istek(k.count())]);
      if (!ak) return iptal(HATA.TABAN_YOK); if (ak.tabanId !== tabanId) return iptal(HATA.CAKISMA);
      let toplam = (bo ? bo.toplam : 0), silinen = 0;
      if (sayi >= S.kontrol) { const c = await istek(k.openCursor()); if (c) { toplam -= c.value.boyut || 0; silinen = c.value.id; await istek(c.delete()); } }
      if (toplam + boyut > S.toplamBayt) return iptal(HATA.BOYUT);
      const id = await istek(k.add(kayit)); await istek(m.put({ k: 'boyut', toplam: toplam + boyut }));
      return { kontrolId: id, silinenEnEski: silinen || null };
    });
  }
  async function kontrolleriOku(y, { tabanId } = {}) {
    const ry = yetkiYok(y); if (ry) return ry;
    const { db, hata } = await dbAl(); if (hata) return hata;
    const s = db.transaction('kontroller', 'readonly').objectStore('kontroller');
    return { ok: true, kontroller: await istek(tabanId == null ? s.getAll() : s.index('tabanId').getAll(tabanId)) };
  }
  async function tabanlariListele(y) {
    const ry = yetkiYok(y); if (ry) return ry;
    const { db, hata } = await dbAl(); if (hata) return hata;
    return { ok: true, tabanlar: (await istek(db.transaction('tabanlar', 'readonly').objectStore('tabanlar').getAll())).map(ozetle) };
  }
  async function durum(y) {
    const ry = yetkiYok(y); if (ry) return ry;
    const { db, hata } = await dbAl(); if (hata) return hata;
    const tx = db.transaction(TABLOLAR, 'readonly'), m = tx.objectStore('meta');
    const [aktif, boyut, tabanSayisi, kontrolSayisi] = await Promise.all([istek(m.get('aktif')), istek(m.get('boyut')), istek(tx.objectStore('tabanlar').count()), istek(tx.objectStore('kontroller').count())]);
    return { ok: true, aktif: aktif || null, toplamBayt: boyut ? boyut.toplam : 0, tabanSayisi, kontrolSayisi, sinir: S };
  }
  function kapat() { try { if (baglanti) baglanti.close(); } catch (e) { /* zaten kapalı */ } baglanti = null; try { if (kanal) kanal.close(); } catch (e) { /* zaten kapalı */ } kanal = null; }
  const dinle = (fn) => { dinleyici = typeof fn === 'function' ? fn : null; };

  return Object.freeze({ tabanKaydet, aktifTabanOku, tabanYenile, emekliTabanSil, kontrolEkle, kontrolleriOku, tabanlariListele, durum, dinle, kapat });
}
