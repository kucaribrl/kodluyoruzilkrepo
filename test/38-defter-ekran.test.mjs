// Ders 50.3c-3a — DEFTER KONTROLÜ EKRANI: "Defter İzleme — Tanılama" bölümü (gerçek uygulama ekranı).
// Tanılama SALT OKUNUR: yalnız cihazdaki db'yi js/defter-izleme.mjs tanilama() ile inceler; Firebase okuma/yazma YOK, izleme deposu
// (iqbasics-defter) AÇILMAZ, localStorage / IndexedDB güvence kopyası DEĞİŞMEZ, otomatik çalışmaz.
// ORTAM: bulutlu senaryolarda test 34–37 ile aynı SAHTE bellek içi Firestore (gerçek Firebase / emülatör DEĞİL); bulutsuz ve çevrimdışı
// senaryolarda kendi yerel sunucusu (Firebase betikleri engellenir). Çevrimdışı senaryoda GERÇEK sw.js kullanılır (yalnız o bölümde).
// Kapsam (güvenlik inceleme raporu R1–R10): R1 salt okunurluk + düğmeler, R2 yetki matrisi (bulut mağaza + varsayılan patron açığı dahil),
// R3 ekran açıkken kurtarma kilidi, R4 gösterim (nakit iade, K8, USD), R5 tanılama uyarıları, R6 XSS, R7 büyük veri, R8 motor yükleme hatası,
// R9 eski ekran değişmedi, R10 sürüm/önbellek ve çevrimdışı açılış; ayrıca arka plan senkron etkisinin tanılamadan ayrılması.
// Sentetik veri. Sunucular rastgele port. Hata → çıkış kodu 1.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { duzenekKur, islem, bekle, GERCEK_FIREBASE } from './yardimci/iki-cihaz-sahte-firestore.mjs';
import { tanilama } from '../js/defter-izleme.mjs';

const DEPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.env.IQ_TEST_KOK ? path.resolve(process.env.IQ_TEST_KOK) : DEPO;
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 600) : '')); } };
console.log('ORTAM: SAHTE bellek içi Firestore + yerel sunucu (gerçek Firebase / emülatör DEĞİL) · kök: ' + (ROOT === DEPO ? 'depo' : ROOT));
const UYARI_METNI = 'Bu kontrol yalnız mevcut cihazdaki kayıtları inceler. Kayıp tespiti veya bulut verisinin doğrulandığı anlamına gelmez.';
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const no = (x) => String(x || '').match(/(\d+)'?$/)?.[1];
const APP = (INDEX.match(/APP_SURUM = '([^']*)'/) || [])[1], CACHE = (SW.match(/CACHE = '([^']*)'/) || [])[1];
T('R10 [sürüm] APP_SURUM ve CACHE aynı numara (175)', no(APP) === '175' && CACHE === 'iqbasics-v175', { APP, CACHE });
T('R10 [önbellek] motor sw.js İSTEĞE BAĞLI listede (kritik değil, hata yutulur, HTTP önbelleği atlanır); kritik liste yalnız renk motoru',
  /const ISTEGE_BAGLI = \['\.\/js\/defter-izleme\.mjs'\];/.test(SW) && /ISTEGE_BAGLI\.map\(\(u\) => c\.add\(new Request\(u, \{ cache: 'reload' \}\)\)\.catch\(\(\) => null\)\)/.test(SW) && /const KRITIK = \['\.\/js\/renk-cozumleme\.mjs'\];/.test(SW));
T('R1 [kaynak] tanılama kodunda Firebase / depo / localStorage yazımı / save çağrısı YOK',
  (() => { const b = INDEX.slice(INDEX.indexOf('/* ===== 🧮 Defter İzleme — Tanılama'), INDEX.indexOf('function _defterTanilamaHtml')); return b.length > 500 && !/firestore|firebase\.|canliRef|canliYaz|save\(|localStorage|indexedDB|iqbasics-defter|defter-depo|setTimeout|setInterval/.test(b.replace(/\/\*[\s\S]*?\*\//g, '')); })());

// Saf tanılama (Node): dondurulmuş girdiyle çalışır, girdiyi değiştirmez, deterministik
{ const dondur = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(dondur); } return o; };
  const v = () => ({ kurUSD: 30, kurEUR: 33, cariler: [{ id: 1, ad: 'a', tip: 'musteri', bakiye: 5 }, { id: 1, ad: 'b', tip: 'tedarikci', bakiye: 'x' }, { id: 3, ad: 'u', tip: 'tedarikci', doviz: 'USD', bakiyeUSD: 5 }],
    hesaplar: [{ id: 2, bakiye: 1 }], satislar: [{ id: 3, mid: 9, tutar: 5, tarih: 1, pb: 'USD' }], hareketler: [{ id: 4, cariId: 1, tip: 'tahsilat', tutar: 2, hesapId: 7, yon: 'in' }, { id: 5, cariId: 1, tur: 'İade', tutar: 4, hesapId: 2, yon: 'out' }],
    cekler: [{ id: 6, cariId: 1, tutar: 1, cariIsle: true }] });
  const d = v(), j = JSON.stringify(d); dondur(d); let r, hata = null; try { r = tanilama(d, dondur({ domenBoyut: { satis: 960000 } })); } catch (e) { hata = String(e.message); }
  T('SAF [tanılama] dondurulmuş girdiyle hatasız (girdiye yazma yok), girdi aynı, aynı girdi → aynı sonuç', hata === null && JSON.stringify(d) === j && JSON.stringify(tanilama(v(), { domenBoyut: { satis: 960000 } })) === JSON.stringify(r), hata);
  T('SAF [tanılama] her bulgu "incelenmeli" düzeyinde; USD cari izlenmiyor olarak işaretli', r.uyarilar.length > 0 && r.uyarilar.every(u => u.seviye === 'incelenmeli') && r.sayac.usdIzlenmiyor === 1 && r.olcum.cari.find(c => c.id === 3).izlenmiyor === true, r.sayac); }

// Sayfa içi gözlem: ERP anlık görüntüsü + bütün yazma/okuma/bulut çağrı sayaçları (geçişli sarmalayıcılar; uygulama davranışı değişmez)
const GOZLEM = () => { if (window.__g) return; const say = { save: 0, canliYaz: 0, canliYazHemen: 0, idbYaz: 0, cariEkstre: 0, sahteYaz: 0, sahteOku: 0, sahteAbone: 0, idbAc: {}, toast: [] };
  for (const f of ['save', 'canliYaz', 'canliYazHemen', 'idbYaz', 'cariEkstre']) { const o = window[f]; if (typeof o === 'function') window[f] = function (...a) { say[f]++; return o.apply(this, a); }; }
  for (const f of ['sahteYaz', 'sahteOku', 'sahteAbone']) { const o = window[f]; if (typeof o === 'function') window[f] = function (...a) { say[f]++; return o.apply(this, a); }; }
  const ao = indexedDB.open.bind(indexedDB); indexedDB.open = (ad, ...r) => { say.idbAc[ad] = (say.idbAc[ad] || 0) + 1; return ao(ad, ...r); };
  const to = window.toast; window.toast = function (m, ...r) { say.toast.push(String(m)); return to.call(this, m, ...r); };
  const ac = (ad) => new Promise((ok) => { const r = ao(ad); /* testin kendi okuması sayılmaz */ r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
  window.__g = { say, async anlik() { const ls = JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])); let kv = 'yok';
      const dbs = ((await indexedDB.databases()) || []).map(x => x.name).sort();
      if (dbs.includes('iqbasics')) { const v = await ac('iqbasics'); kv = await new Promise(ok => { const tx = v.transaction('kv', 'readonly'), s = tx.objectStore('kv'), k = s.getAllKeys(), d = s.getAll(); tx.oncomplete = () => ok(JSON.stringify([k.result, d.result])); }); v.close(); }
      return { ls, kv, db: JSON.stringify(db), dbs, say: JSON.parse(JSON.stringify(say)) }; } }; };
const gozlemKur = (p) => p.evaluate(GOZLEM);
const anlik = (p) => p.evaluate(() => window.__g.anlik());
const sayFark = (a, b) => { const o = {}; for (const k of Object.keys(b.say)) { if (k === 'idbAc' || k === 'toast') continue; if (b.say[k] !== a.say[k]) o[k] = b.say[k] - a.say[k]; }
  for (const k of new Set([...Object.keys(a.say.idbAc), ...Object.keys(b.say.idbAc)])) if ((b.say.idbAc[k] || 0) !== (a.say.idbAc[k] || 0)) o['idbAc:' + k] = (b.say.idbAc[k] || 0) - (a.say.idbAc[k] || 0); return o; };
const calistir = (p) => p.evaluate(async () => { await defterTanilamaCalistir(); const el = document.getElementById('dk-izleme-sonuc'); return el ? el.textContent : null; }); // textContent: CSS büyük harf dönüşümünden bağımsız
const ekran = (p) => p.evaluate(() => { const ov = document.getElementById('ov'); return { acik: ov.classList.contains('show'), metin: ov.textContent, html: ov.innerHTML }; });
const motorIstek = (p) => { const s = { n: 0 }; p.on('request', r => { if (/\/js\/defter-izleme\.mjs/.test(r.url())) s.n++; }); return s; };
const D = await duzenekKur(ROOT);

// ===================================================================== R1 / R9 / arka plan ayrımı (bulutlu yönetici) =====================================================================
{ const B = D.bulutKur(); const A = await D.cihazAc(B, 'A', 11); const Bc = await D.cihazAc(B, 'B', 22); await D.yerles(B);
  const mi = motorIstek(A.page); await gozlemKur(A.page);
  // Arka plan etkisi (kontrol): başka cihazın işlemi teslim edilince sayaçlar DEĞİŞİR → sayaçlar gerçekten ölçüyor
  const k0 = await anlik(A.page); await islem.tahsilat(Bc, 9002, 25); await islem.gizle(Bc); await D.yerles(B); await bekle(1200); const k1 = await anlik(A.page);
  T('ARKA PLAN [kontrol] başka cihazın tahsilatı teslim edilince ERP verisi ve sayaçlar değişir (gözlem düzeneği çalışıyor)', k1.db !== k0.db && Object.keys(sayFark(k0, k1)).length > 0, sayFark(k0, k1));
  // Sessiz dönem: hiçbir şey yapılmadan aynı süre — arka planda değişim yok
  const s0 = await anlik(A.page); await bekle(1500); const s1 = await anlik(A.page);
  T('ARKA PLAN [sessiz] işlem yokken 1,5 sn içinde hiçbir sayaç ve veri değişmez (taban çizgi)', JSON.stringify(sayFark(s0, s1)) === '{}' && s0.db === s1.db && s0.ls === s1.ls && s0.kv === s1.kv, sayFark(s0, s1));
  // Ekran açılır → eski bölüm aynen + yeni bölüm; motor henüz YÜKLENMEZ (yalnız düğmeyle)
  const a0 = await anlik(A.page);
  await A.page.evaluate(() => defterKontrolAc()); await bekle(150); const e = await ekran(A.page);
  const eski = await A.page.evaluate(() => { const hs = db.hesaplar.map(h => { const net = (db.hareketler || []).filter(x => x.hesapId === h.id && x.yon).reduce((a, x) => a + (x.yon === 'in' ? 1 : -1) * (+x.tutar || 0), 0); return [h.ad, TL(+h.bakiye || 0), TL(net)]; });
    const cs = db.cariler.filter(c => c.tip === 'musteri').map(c => [c.ad, cariEkstre(c.id).devir]).filter(x => Math.abs(x[1]) > 0.5); return { hs, cs }; });
  T('R9 [eski ekran] "Hesaplar (kasa/banka)" ve "Devri en yüksek 10 cari" bölümleri ve değerleri aynen duruyor', e.acik && e.metin.includes('Defter Tutarlılık Kontrolü') && e.metin.includes('Hesaplar (kasa/banka)') && e.metin.includes('Devri en yüksek 10 cari')
    && eski.hs.every(([ad, b, n]) => e.metin.includes(ad) && e.metin.includes(b) && e.metin.includes('defter ' + n)), { eski, metin: e.metin.slice(0, 500) });
  T('R1 [ekran] yeni bölüm "Defter İzleme — Tanılama" ve zorunlu açıklama metni görünür', e.metin.includes('Defter İzleme — Tanılama') && e.metin.includes(UYARI_METNI), e.metin.slice(-400));
  const dug = await A.page.evaluate(() => [...document.querySelectorAll('#dk-izleme button')].map(b => [b.textContent.trim(), b.getAttribute('onclick')]));
  T('R1 [düğmeler] yeni bölümde YALNIZ "Tanılamayı çalıştır" düğmesi var (düzelt / sil / kaydet / taban / otomatik yok)', dug.length === 1 && dug[0][1] === 'defterTanilamaCalistir()' && !/sil|kaydet|duzelt|düzelt|taban|save|yaz/i.test(JSON.stringify(dug)), dug);
  T('R1 [otomatik değil] ekran açılınca motor YÜKLENMEDİ ve tanılama çalışmadı', mi.n === 0 && !(await A.page.evaluate(() => document.getElementById('dk-izleme-sonuc').textContent.trim())), mi.n);
  const t1 = await calistir(A.page); const a1 = await anlik(A.page);
  T('R1 [çalıştı] düğmeyle tanılama çalıştı (motor 1 kez yüklendi), sonuç gösterildi', mi.n === 1 && /Uyarı yok|incelenmeli/.test(t1) && t1.includes('Bilinen uygulama kısıtları'), { mi: mi.n, t1: (t1 || '').slice(0, 300) });
  const f = sayFark(a0, a1); delete f.cariEkstre; // eski ekran cariEkstre ile devir hesaplar (okuma)
  T('R1 [salt okunur] ekran + tanılama: db, localStorage, "iqbasics" güvence kopyası AYNI; save / canliYaz / canliYazHemen / idbYaz 0; sahte Firestore okuma/yazma/abone 0; hiçbir IndexedDB açılmadı; "iqbasics-defter" yok',
    a0.db === a1.db && a0.ls === a1.ls && a0.kv === a1.kv && JSON.stringify(f) === '{}' && !a1.dbs.includes('iqbasics-defter'), { f, dbs: a1.dbs });
  const t2 = await calistir(A.page); const a2 = await anlik(A.page);
  T('R1 [tekrar] ikinci çalıştırma aynı sonucu verir, motor yeniden indirilmez, yine hiçbir şey değişmez', t2 === t1 && mi.n === 1 && a2.db === a1.db && a2.ls === a1.ls && a2.kv === a1.kv && a2.say.sahteYaz === a1.say.sahteYaz && a2.say.save === a1.say.save);
  T('R1 [altyapı] sayfa hatası yok', A.hatalar.length === 0 && Bc.hatalar.length === 0, [...A.hatalar, ...Bc.hatalar].slice(0, 3));
  await A.ctx.close(); await Bc.ctx.close(); }

// ===================================================================== R2 / R3 yetki matrisi ve kurtarma kilidi =====================================================================
{ const B = D.bulutKur(); const A = await D.cihazAc(B, 'Y', 12); await D.yerles(B); const mi = motorIstek(A.page); await gozlemKur(A.page);
  const durum = (kur) => A.page.evaluate((kur) => { window.__geri = { rol: bulutKul && bulutKul.rol, kul: bulutKul, dbRol: db.rol, pm: db.personelMod, mm: bulutMusteriMod, ornek: db.ornek };
    if ('bulutRol' in kur) { if (kur.bulutRol === null) bulutKul = null; else bulutKul = { ...(window.__geri.kul || {}), rol: kur.bulutRol }; }
    if ('dbRol' in kur) db.rol = kur.dbRol; if ('personelMod' in kur) db.personelMod = kur.personelMod; if ('musteriMod' in kur) bulutMusteriMod = kur.musteriMod; if ('ornek' in kur) db.ornek = kur.ornek; }, kur);
  const geri = () => A.page.evaluate(() => { const g = window.__geri; bulutKul = g.kul; db.rol = g.dbRol; db.personelMod = g.pm; bulutMusteriMod = g.mm; db.ornek = g.ornek; });
  const dene = async (kur) => { await A.page.evaluate(() => { closeM(); window.__g.say.toast = []; }); await durum(kur);
    const a = await anlik(A.page), n0 = mi.n; await A.page.evaluate(() => defterKontrolAc()); await bekle(80); const e = await ekran(A.page);
    const sonuc = await A.page.evaluate(async () => { const el = document.getElementById('dk-izleme-sonuc'); await defterTanilamaCalistir(); return { el: !!el, yetki: _defterYetki(), toast: window.__g.say.toast.slice() }; });
    const b = await anlik(A.page); await geri(); return { izin: sonuc.yetki.izin, nedenler: sonuc.yetki.nedenler, ekranAcildi: e.acik && e.metin.includes('Defter Tutarlılık'), motor: mi.n - n0, toast: sonuc.toast, fark: sayFark(a, b), ayni: a.db === b.db && a.ls === b.ls && a.kv === b.kv }; };
  const MATRIS = [
    ['bulut admin', { bulutRol: 'admin' }, true], ['bulut ortak (cihaz patron)', { bulutRol: 'ortak' }, true],
    ['AÇIK: bulut MAĞAZA + cihazda varsayılan patron', { bulutRol: 'magaza', dbRol: 'patron' }, false], ['bulut depocu + cihaz patron', { bulutRol: 'depocu', dbRol: 'patron' }, false],
    ['bulut fason takip + cihaz patron', { bulutRol: 'fasontakip', dbRol: 'patron' }, false], ['bulut fason', { bulutRol: 'fason', dbRol: 'patron' }, false],
    ['bulut müşteri', { bulutRol: 'musteri', dbRol: 'patron' }, false], ['bulut rolü bilinmiyor (?)', { bulutRol: '?', dbRol: 'patron' }, false],
    ['bulut profili yüklenmemiş (bulut açık)', { bulutRol: null, dbRol: 'patron' }, false], ['yerel yönetici değil (bulut ortak, cihaz mağaza)', { bulutRol: 'ortak', dbRol: 'magaza' }, false],
    ['personel modu', { dbRol: 'magaza', personelMod: true }, false], ['müşteri (portal) modu', { musteriMod: true }, false], ['örnek veri', { ornek: true }, false]];
  for (const [ad, kur, bek] of MATRIS) { const r = await dene(kur);
    if (bek) T(`R2 [yetki] ${ad} → İZİN: ekran açılır, tanılama çalışır, veri değişmez`, r.izin && r.ekranAcildi && r.ayni && !r.fark.save && !r.fark.sahteYaz && !r.fark.sahteOku, r);
    else T(`R2 [yetki] ${ad} → RED: ekran açılmaz, hesaplama yok (cariEkstre 0), motor yüklenmez, "Yetkiniz yok"; veri değişmez`, !r.izin && !r.ekranAcildi && !r.fark.cariEkstre && r.motor === 0 && r.toast.some(t => t.includes('Yetkiniz yok')) && r.ayni && JSON.stringify(r.fark) === '{}', r); }
  // R3: ekran yetkiliyken açık; başka sekmede kurtarma → bu sekme kilitlenir (gerçek _kKilitle) → düğme hiçbir şey hesaplamaz
  const C = await D.cihazAc(D.bulutKur(), 'K', 13); const mk = motorIstek(C.page); await gozlemKur(C.page);
  await C.page.evaluate(() => defterKontrolAc()); const once = await anlik(C.page);
  const r3 = await C.page.evaluate(async () => { _kKilitle('sekme'); window.__g.say.toast = []; await defterTanilamaCalistir(); return { durum: kurtarmaDurumu.durum, sonuc: document.getElementById('dk-izleme-sonuc') ? document.getElementById('dk-izleme-sonuc').textContent : '', toast: window.__g.say.toast, yetki: _defterYetki() }; });
  const sonra = await anlik(C.page);
  T('R3 [kurtarma kilidi] ekran açıkken kurtarma kilitlendi → tanılama REDDEDİLDİ (sonuç boş, motor yüklenmedi, "kurtarma" nedeni)', r3.durum === 'kilitli' && !r3.yetki.izin && r3.yetki.nedenler.some(n => n.includes('kurtarma')) && !r3.sonuc.trim() && mk.n === 0 && r3.toast.some(t => t.includes('Yetkiniz yok')), r3);
  T('R3 [kurtarma kilidi] veri değişmedi; tanılama kaynaklı yazım yok', once.db === sonra.db && once.ls === sonra.ls && once.kv === sonra.kv && sonra.say.save === once.say.save && sonra.say.sahteYaz === once.say.sahteYaz, sayFark(once, sonra));
  T('R2/R3 [altyapı] sayfa hatası yok', A.hatalar.length === 0 && C.hatalar.length === 0, [...A.hatalar, ...C.hatalar].slice(0, 3));
  await A.ctx.close(); await C.ctx.close(); }

// ===================================================================== R4 / R5 / R6 gösterim, uyarılar, XSS =====================================================================
{ const A = await D.cihazAc(D.bulutKur(), 'X', 14); await gozlemKur(A.page);
  await A.page.evaluate(() => { const XSS = '<img src=x onerror="window.__xss=1">'; window.__xss = 0;
    db.cariler.push({ id: 9003, ad: 'Ted ' + XSS, tip: 'tedarikci', bakiye: 750, doviz: 'TL' }, { id: 9005, ad: 'USD ' + XSS, tip: 'tedarikci', doviz: 'USD', bakiye: 0, bakiyeUSD: 40 },
      { id: 9001, ad: 'Kopya ' + XSS, tip: 'musteri', bakiye: 0 }, { id: 9006, ad: 'Sayısız', tip: 'musteri', bakiye: 'abc' });
    db.cekler.push({ id: 7001, tur: 'cek', tip: 'alinan', cariId: 9002, tutar: 120, durum: 'portfoyde', cariIsle: true, hesapId: 9101 });
    db.hareketler.push({ id: 7101, cariId: 9002, tip: 'tahsilat', tutar: 55, tur: 'Taksit', tarih: 1, hesapId: 9101, yon: 'in' }, { id: 7102, cariId: 8888, tip: 'tahsilat', tutar: 5, tur: 'Nakit', tarih: 1, hesapId: 9101, yon: 'in' },
      { id: 7103, cariId: 9002, tutar: 80, tur: 'İade', tarih: 1, hesapId: 9101, yon: 'out', aciklama: XSS });
    db.satislar.push({ id: 7201, tip: 'satis', mid: 9002, tarih: 1, tutar: 300, odenen: 300, pb: 'TL', satisKur: 1, odemeHesapId: 9101, kalemler: [] }, { id: 7202, tip: 'satis', mid: 9002, tarih: 1, tutar: 10, odenen: 0, pb: 'USD', kalemler: [] },
      { id: 7203, tip: 'satis', mid: 9999, tarih: 1, tutar: 10, odenen: 0, pb: 'TL', satisKur: 1, kalemler: [] }, { id: 7204, tip: 'satis', mid: 9002, tarih: 1, tutar: 50, odenen: 0, pb: 'TL', satisKur: 1, kalemler: [{ urun: 'x'.repeat(960000) }] }); });
  const a0 = await anlik(A.page); await A.page.evaluate(() => defterKontrolAc()); const t = await calistir(A.page); const a1 = await anlik(A.page);
  const html = await A.page.evaluate(() => document.getElementById('dk-izleme-sonuc').innerHTML);
  const bek = [['tekrarlanan kimlik', /cariler: aynı kimlik \(9001\)/], ['sayısal olmayan tutar', /"bakiye" alanı sayı değil/], ['var olmayan cariye bağlı hareket', /hareket #7102: carisi \(8888\) yok/], ['var olmayan cariye bağlı satış', /satış #7203: carisi \(9999\) yok/],
    ['eşleşmeyen tahsilat çeki', /çek #7001 \(120\) tahsilat\/ödeme ya da satış çeki ama eşleşen çekli hareket yok/], ['taksit uyuşmazlığı', /"Taksit" tahsilatları 55/], ['eski ödeme alanı', /1 satış eski ödeme alanıyla/], ['kur bilgisi eksik dövizli satış', /1 dövizli satışta kur bilgisi/],
    ['bulut belge boyutu', /satis bulut belgesi \d+ KB \(sınır 1 MB/], ['uyarılar "İncelenmeli"', /İncelenmeli/], ['USD cari izlenmiyor', /İzlenmeyen \(USD\) cariler[\s\S]*İZLENMİYOR/],
    ['nakit iade bilinen kısıt', /Nakit iade ekstre gösterimi \(bilinen uygulama kısıtı\)[\s\S]*Bu cihazda: 1 cari, 1 hareket/], ['K8 kesin neden iddiası yok', /Ürün kartından tedarikçi borcu \(bilinen uygulama kısıtı\)[\s\S]*kesin neden bu kontrolle belirlenemez/],
    ['tedarikçi devri listesi', /Devri en yüksek 10 tedarikçi \/ fason[\s\S]*Ted <img/]];
  for (const [ad, re] of bek) T(`R5/R4 [uyarı] ${ad}`, re.test(t), (t || '').slice(0, 1500));
  T('R4 [dil] "kayıp" iddiası yok (yalnız "olabilir" ve "incelenmeli")', !/kesin kayıp|kayıp tespit edildi|kayıp var|KAYIP/.test(t) && /olabilir/.test(t), t.slice(0, 300));
  T('R6 [XSS] cari adı / açıklamadaki HTML çalışmadı (window.__xss = 0), metin olarak kaçışlı basıldı', (await A.page.evaluate(() => window.__xss)) === 0 && html.includes('&lt;img') && !/<img[^>]*onerror/i.test(html), html.slice(0, 300));
  T('R5 [salt okunur] uyarılı veride de tanılama hiçbir şeyi değiştirmedi; Firebase ve depo çağrısı yok', a0.db === a1.db && a0.ls === a1.ls && a0.kv === a1.kv && a1.say.save === a0.say.save && a1.say.sahteYaz === a0.say.sahteYaz && a1.say.sahteOku === a0.say.sahteOku && !a1.dbs.includes('iqbasics-defter'), sayFark(a0, a1));
  T('R5 [altyapı] sayfa hatası yok', A.hatalar.length === 0, A.hatalar.slice(0, 3));
  await A.ctx.close(); }

// ===================================================================== R8 motor yükleme hatası / sürüm uyuşmazlığı =====================================================================
for (const [ad, yanit, bek] of [['motor dosyası yok (404)', { status: 404, body: 'yok' }, /kullanılamıyor/], ['motor sürümü uyuşmuyor', { status: 200, contentType: 'text/javascript', body: 'export const MOTOR_SURUM = 2; export function tanilama(){ return null; }' }, /sürüm uyuşmazlığı/]]) {
  const A = await D.cihazAc(D.bulutKur(), 'M', 15); await A.ctx.route('**/js/defter-izleme.mjs', r => r.fulfill(yanit)); await gozlemKur(A.page);
  const a0 = await anlik(A.page); await A.page.evaluate(() => defterKontrolAc()); const t = await calistir(A.page); const e = await ekran(A.page); const a1 = await anlik(A.page);
  T(`R8 [${ad}] yalnız tanılama "kullanılamıyor" der; eski Defter Kontrolü ekranı çalışır; sayfa hatası yok`, bek.test(t) && /kullanılamıyor/.test(t) && e.metin.includes('Hesaplar (kasa/banka)') && e.metin.includes('Devri en yüksek 10 cari') && A.hatalar.length === 0, { t, h: A.hatalar });
  T(`R8 [${ad}] veri değişmedi`, a0.db === a1.db && a0.ls === a1.ls && a0.kv === a1.kv && a1.say.save === a0.say.save);
  await A.ctx.close(); }

// ===================================================================== R7 büyük veri performansı =====================================================================
{ const A = await D.cihazAc(D.bulutKur(), 'P', 16); await gozlemKur(A.page);
  const r = await A.page.evaluate(async () => { let x = 7; const rnd = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 1000; i++) db.cariler.push({ id: 100000 + i, ad: 'Büyük Cari ' + i, tip: i % 10 ? 'musteri' : 'tedarikci', bakiye: Math.round(rnd() * 1e5) / 100 });
    for (let i = 0; i < 5000; i++) db.satislar.push({ id: 200000 + i, tip: 'satis', mid: 100000 + Math.floor(rnd() * 1000), tarih: i, tutar: 100, odenen: 0, pb: 'TL', satisKur: 1, kalemler: [] });
    for (let i = 0; i < 20000; i++) db.hareketler.push({ id: 300000 + i, cariId: 100000 + Math.floor(rnd() * 1000), tip: 'tahsilat', tutar: 10, tur: 'Nakit', tarih: i, hesapId: 9101, yon: 'in' });
    const s0 = JSON.stringify(db); defterKontrolAc(); const t0 = performance.now(); await defterTanilamaCalistir(); const ms = performance.now() - t0;
    return { ms, ayni: JSON.stringify(db) === s0, ok: /incelenmeli|Uyarı yok/.test(document.getElementById('dk-izleme-sonuc').textContent) }; });
  console.log(`PERF tanılama 1.000 cari × 20.000 hareket + 5.000 satış (motor yükleme + hesap + ekran): ${r.ms.toFixed(0)} ms`);
  T(`R7 [performans] büyük veride tanılama 3 sn altında tamamlandı (${r.ms.toFixed(0)} ms), veri değişmedi`, r.ok && r.ms < 3000 && r.ayni, r);
  await A.ctx.close(); }
T('ORTAM sahte Firestore; gerçek Firebase/Auth sunucularına istek denemesi bile yok', ![...D.disari].some(h => GERCEK_FIREBASE.test(h)), [...D.disari]);
await D.kapat();

// ===================================================================== R2 bulutsuz / R10 çevrimdışı (GERÇEK sw.js) =====================================================================
const srv = http.createServer((req, res) => { const y = decodeURIComponent(req.url.split('?')[0]); const p = path.join(ROOT, y === '/' ? 'index.html' : y);
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': /\.m?js$/.test(p) ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : p.endsWith('.webmanifest') ? 'application/manifest+json' : 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); }
  catch { res.writeHead(404); res.end(); } }).listen(0);
await new Promise(r => srv.once('listening', r)); const U = `http://localhost:${srv.address().port}`;
const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
{ const ctx = await br.newContext(); await ctx.route('**/*', r => new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort());
  const page = await ctx.newPage(); const hatalar = []; page.on('pageerror', e => hatalar.push(e.message));
  await page.goto(U + '/'); await page.waitForFunction(() => typeof db !== 'undefined' && window.kurtarmaDurumu && kurtarmaDurumu.durum === 'tamam');
  await page.evaluate(() => { db.ornek = false; db.canliBulut = false; db.rol = 'patron'; db.personelMod = false; save(); });
  await page.reload(); await page.waitForFunction(() => window.kurtarmaDurumu && kurtarmaDurumu.durum === 'tamam' && typeof defterKontrolAc === 'function');
  const y1 = await page.evaluate(() => ({ y: _defterYetki(), bulut: _defterBulutKullaniliyor(), fb: typeof window.firebase }));
  T('R2 [bulutsuz] tek cihaz, bulut hiç kullanılmıyor, yerel patron → İZİN (bulut rolü aranmaz)', y1.y.izin && !y1.bulut && y1.fb === 'undefined', y1);
  const y2 = await page.evaluate(() => { const r = db.rol; db.rol = 'magaza'; const y = _defterYetki(); db.rol = r; return y; });
  T('R2 [bulutsuz] tek cihaz, yerel rol mağaza → RED ("yönetici değil")', !y2.izin && y2.nedenler.includes('yönetici değil'), y2);
  const y3 = await page.evaluate(() => { db.senkronOldu = true; const y = _defterYetki(); delete db.senkronOldu; return y; });
  T('R2 [bulutsuz] cihaz daha önce bulutla eşitlenmiş ama oturum yok → bulut rolü doğrulanamaz → RED', !y3.izin && y3.nedenler.some(n => n.includes('bulut rolü')), y3);
  // R10: gerçek service worker motoru önbelleğe alır; çevrimdışı yeniden açılışta tanılama çalışır
  await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  const onb = await page.evaluate(async (c) => { const k = await caches.open(c); const r = await k.match('./js/defter-izleme.mjs'); return { var: !!r, tanilama: r ? /export function tanilama\(/.test(await r.text()) : false }; }, CACHE);
  T('R10 [önbellek] gerçek service worker motoru önbelleğe aldı (' + CACHE + ')', onb.var && onb.tanilama, onb);
  await ctx.setOffline(true); await page.reload(); await page.waitForFunction(() => window.kurtarmaDurumu && kurtarmaDurumu.durum === 'tamam' && typeof defterKontrolAc === 'function', null, { timeout: 15000 });
  await gozlemKur(page); const a0 = await anlik(page);
  const t = await page.evaluate(async () => { defterKontrolAc(); await defterTanilamaCalistir(); return { cevrimici: navigator.onLine, t: document.getElementById('dk-izleme-sonuc').textContent }; }); const a1 = await anlik(page); const f10 = sayFark(a0, a1); delete f10.cariEkstre; // eski ekran devirleri cariEkstre ile OKUR
  T('R10 [çevrimdışı] internet yokken uygulama açıldı, Defter Kontrolü + tanılama önbellekten çalıştı', !t.cevrimici && /incelenmeli|Uyarı yok/.test(t.t) && t.t.includes('Bilinen uygulama kısıtları'), t);
  T('R10 [çevrimdışı] veri değişmedi; save / IndexedDB açma yok', a0.db === a1.db && a0.ls === a1.ls && a0.kv === a1.kv && JSON.stringify(f10) === '{}', f10);
  T('R10 [altyapı] sayfa hatası yok', hatalar.length === 0, hatalar.slice(0, 3));
  await ctx.close(); }
await br.close(); srv.close();
console.log(`${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
