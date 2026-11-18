// R2.1.2: Eski renkler için rid geçişi — SENTETİK veri üzerinde plan → dry-run → doğrulama → rollback simülasyonu.
// Bu bir gerçek veri geçişi DEĞİLDİR. Modül (test/yardimci/rid-gecis-simulasyon.mjs) yalnız çağıranın verdiği düz nesnelerle çalışır;
// db, Firebase, DOM, localStorage, ağ veya dosya sistemi kullanmaz. Sınıflandırma, uygulamanın gerçek renkGecisHazirlikDenetle
// fonksiyonundan (Ders 41) izole bir tarayıcı sayfasında alınır. Kimlik sağlayıcısı test için deterministiktir (gerçek geçişte kullanılamaz).
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
import * as S from './yardimci/rid-gecis-simulasyon.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  if (req.url.includes('sw.js')) { res.writeHead(404); return res.end(); }
  const p = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 320) : '')); } };
let sonHata = null; const dene = (f) => { try { return f(); } catch (e) { sonHata = e.message; return null; } };   // hata → null (kontrol FAIL olur, test çökmez)

const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const ctx = await br.newContext(); const dis = [];
await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return route.continue(); dis.push(h); return route.abort(); });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));
// Ders 41 gerçek sınıflandırması (yalnız verilen sentetik nesne üzerinde; db kullanılmaz)
const sinifla = (v) => page.evaluate((x) => renkGecisHazirlikDenetle(x), v);

// ---- Sentetik veri ----
const kopya = (x) => JSON.parse(JSON.stringify(x));
const VERI = () => ({
  urunler: [
    { id: 1, ad: 'Polo', kod: 'P1', _m: 100, renkler: [
      { ad: 'Siyah', barkod: '101', hex: '#111', foto: 'f1', loklar: { 'L-ana': 5, 'L-depo': 7 }, stok: 5, kirik: { S: 1 }, kirikLok: { 'L-depo': { S: 1 } }, defo: 2, ozel: 'x' },
      { ad: 'Beyaz', hex: '#fff', loklar: { 'L-ana': 2 }, stok: 2 },
      { ad: 'Gri', barkod: '103', rid: 'r_mevcut-1', loklar: { 'L-ana': 1 }, stok: 1 } ] },
    { id: 2, ad: 'Tişört', kod: 'P2', _m: 200, renkler: [{ ad: 'Lacivert', barkod: '201', loklar: { 'L-ana': 3 } }, { ad: 'lacivert', barkod: '202', loklar: { 'L-depo': 4 } }] },
    { id: 3, ad: 'Kazak', kod: 'P3', _m: 300, renkler: [{ ad: 'Bordo', barkod: '301', loklar: { 'L-ana': 6 }, stok: 6 }] },
  ],
  satislar: [{ id: 11, tip: 'satis', tarih: 1, teslimDurum: 'teslim', kalemler: [{ uid: 3, renkler: [{ ad: 'Bordo', mik: 1 }] }] }],
  transferler: [], isemirleri: [], bekleyenPortal: [],
});
const sayac = (on = 'r_TEST-') => { let n = 0; return () => on + String(++n).padStart(4, '0'); };
const ref = (veri, urunId, ad) => dene(() => S.renkReferanslari(veri).find(r => r.urunId === urunId && r.renkAd === ad));
const karar = (r, k = 'ONAY', ek = {}) => ({ ref: r, karar: k, gerekce: '', kanit: [], karariVeren: 'test-yonetici', zaman: 0, ...ek });
const planla = (veri, sinif, kararlar, ks = sayac()) => dene(() => S.gecisPlaniOlustur({ veri, siniflandirma: sinif, kararlar, kimlikSaglayici: ks }));
const durum = (p, ad) => p && p.renkler && p.renkler.find(x => x.renkAd === ad);

const A = VERI(); const SA = await sinifla(A);
T('altyapı: Ders 41 sınıflandırması (gerçek fonksiyon): Siyah/Bordo ADAY, Beyaz/Lacivert/lacivert ELLE, Gri listede yok',
  SA && ['Siyah', 'Bordo'].every(a => SA.renkler.find(x => x.renk === a).sinif === 'ADAY') && ['Beyaz', 'Lacivert', 'lacivert'].every(a => SA.renkler.find(x => x.renk === a).sinif === 'ELLE_MUTABAKAT') && !SA.renkler.some(x => x.renk === 'Gri'), SA && SA.ozet);

// ---- Plan: karar davranışları ----
const p1 = planla(A, SA, []);
T('T1 onaysız ADAY planlanmaz (Siyah BEKLIYOR, atama yok)', p1 && !p1.HATA && p1.atamalar.length === 0 && durum(p1, 'Siyah').durum === 'BEKLIYOR' && /onay/i.test(durum(p1, 'Siyah').neden), p1);
const kSiyah = karar(ref(A, 1, 'Siyah'));
const p2 = planla(A, SA, [kSiyah]);
T('T2 onaylı ADAY planlanır (Siyah UYGUN, rid r_TEST-0001); test kimliği gerçek geçiş için işaretlenir', p2 && !p2.HATA && !p2.reddedildi && p2.atamalar.length === 1 && p2.atamalar[0].rid === 'r_TEST-0001' && p2.atamalar[0].ref.renkAd === 'Siyah' && durum(p2, 'Siyah').durum === 'UYGUN' && p2.testKimligiKullanildi === true, p2);
const p3 = planla(A, SA, [karar(ref(A, 1, 'Beyaz'))]);
T('T3 gerekçesiz/kanıtsız ELLE_MUTABAKAT planlanmaz (Beyaz BEKLIYOR)', p3 && !p3.HATA && p3.atamalar.length === 0 && durum(p3, 'Beyaz').durum === 'BEKLIYOR' && /gerekçe|kanıt/i.test(durum(p3, 'Beyaz').neden), p3);
const p4 = planla(A, SA, [karar(ref(A, 1, 'Beyaz'), 'ONAY', { gerekce: 'Rafta sayıldı, tek beyaz', kanit: ['sayım#5'] })]);
const p4b = planla(A, SA, [karar(ref(A, 1, 'Beyaz'), 'ONAY', { gerekce: '   ', kanit: ['x'] })]);
T('T4 gerekçeli + kanıtlı ELLE_MUTABAKAT planlanır; boşluklu gerekçe yetmez', p4 && !p4.reddedildi && p4.atamalar.length === 1 && durum(p4, 'Beyaz').durum === 'UYGUN' && p4b && p4b.atamalar.length === 0, { p4, p4b });
const SAe = kopya(SA); SAe.renkler.find(x => x.renk === 'Bordo').sinif = 'ENGELLI';
const p5 = planla(A, SAe, [karar(ref(A, 3, 'Bordo'), 'ONAY', { gerekce: 'zorla', kanit: ['x'] })]);
T('T5 ENGELLI onaylı olsa bile planlanmaz', p5 && !p5.HATA && p5.atamalar.length === 0 && durum(p5, 'Bordo').durum === 'ENGELLI', p5);
T('T6 kimlikli renk (Gri) ATLANDI, rid korunur', p2 && durum(p2, 'Gri').durum === 'ATLANDI' && /mevcut/i.test(durum(p2, 'Gri').neden), p2 && durum(p2, 'Gri'));
const ayniId = () => 'r_TEST-AYNI';
const p7 = planla(A, SA, [kSiyah, karar(ref(A, 3, 'Bordo'))], ayniId);
T('T7 sağlayıcı aynı rid\'i iki kez verirse plan reddedilir', p7 && p7.reddedildi && p7.atamalar.length === 0 && p7.redNedenleri.some(n => /aynı rid|çakış/i.test(n)), p7);
const p8 = planla(A, SA, [kSiyah], () => 'r_mevcut-1');
T('T8 mevcut rid ile çakışan kimlik reddedilir', p8 && p8.reddedildi && p8.redNedenleri.some(n => /mevcut/i.test(n)), p8);
const A9a = VERI(); delete A9a.urunler[2].id; const A9b = VERI(); A9b.urunler[2].id = 1;
const p9a = planla(A9a, await sinifla(A9a), []), p9b = planla(A9b, await sinifla(A9b), []);
T('T9 ürün kimliği eksik veya mükerrerken plan reddedilir', p9a && p9a.reddedildi && p9a.redNedenleri.some(n => /kimliği yok|eksik/i.test(n)) && p9b && p9b.reddedildi && p9b.redNedenleri.some(n => /mükerrer/i.test(n)), { p9a: p9a && p9a.redNedenleri, p9b: p9b && p9b.redNedenleri });
const A10 = VERI(); A10.urunler[1].renkler[1].ad = 'Lacivert'; const S10 = await sinifla(A10);
const r10 = dene(() => S.renkReferanslari(A10).filter(r => r.urunId === 2));
const p10 = planla(A10, S10, [karar((r10 || [])[1], 'ONAY', { gerekce: 'ikinci lacivert', kanit: ['x'] })]);
T('T10 tam aynı adlı iki renk: sınıflandırma adla belirsiz → plan reddedilir, yanlış renge rid atanmaz', p10 && p10.reddedildi && p10.atamalar.length === 0 && p10.redNedenleri.some(n => /belirsiz/i.test(n)), p10);

// ---- Dry-run zinciri ----
const derinDondur = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(derinDondur); Object.freeze(o); } return o; };
const Adon = derinDondur(VERI()); const SAdon = derinDondur(kopya(SA));
const kOnay = [karar(ref(Adon, 1, 'Siyah')), karar(ref(Adon, 3, 'Bordo')), karar(ref(Adon, 1, 'Beyaz'), 'ONAY', { gerekce: 'Rafta sayıldı', kanit: ['sayım#5'] })];
const plan = planla(Adon, SAdon, kOnay); const dr = dene(() => S.gecisDryRun({ veri: Adon, plan, siniflandirma: SAdon, kararlar: kOnay }));
T('T12 dry-run kaynak girdiyi değiştirmez (derin dondurulmuş girdi + derin karşılaştırma)', dr && !dr.HATA && !dr.reddedildi && JSON.stringify(Adon) === JSON.stringify(VERI()), dr && (dr.HATA || dr.durdurmaNedenleri));
const fark = dr && !dr.HATA ? dene(() => S.gecisFarkDogrula(Adon, dr.sonuc, plan)) : null;
const ridsiz = (v) => { const c = kopya(v); c.urunler.forEach(u => u.renkler.forEach(r => { if (r.rid && r.rid.startsWith('r_TEST-')) delete r.rid; })); return c; };
T('T13 dry-run yalnız onaylı renklere rid ekler: izinsiz fark yok, 3 rid eklendi, rid kaldırılınca girdiyle birebir aynı', fark && fark.izinsizFarklar.length === 0 && fark.eklenenRid.length === 3 && dr && dr.sonuc && JSON.stringify(ridsiz(dr.sonuc)) === JSON.stringify(VERI()), fark);
const bozuk = (f) => { if (!dr || !dr.sonuc) return null; const c = kopya(dr.sonuc); f(c); return dene(() => S.gecisFarkDogrula(Adon, c, plan)); };
const f14 = bozuk(c => { const l = c.urunler[0].renkler[0].loklar; l['L-ana'] = 7; l['L-depo'] = 5; });
T('T14 lokasyon stokları birebir: toplam aynı (12) ama lokasyonlar yer değiştirmişse fark yakalanır; stok özeti lokasyon bazında eşit', fark && fark.izinsizFarklar.length === 0 && f14 && f14.izinsizFarklar.some(x => /loklar/.test(x)) && dr && JSON.stringify(dene(() => S.gecisStokOzeti(Adon))) === JSON.stringify(dene(() => S.gecisStokOzeti(ridsiz(dr.sonuc)))) && dene(() => S.gecisStokOzeti(Adon)) !== null, f14);
const f15a = bozuk(c => { c.urunler[0].renkler[0].kirikLok['L-depo'].S = 2; }), f15b = bozuk(c => { c.urunler[0].renkler[0].defo = 3; }), f15c = bozuk(c => { c.urunler[0].renkler[0].kirik = { M: 1 }; });
T('T15 kirik, kirikLok ve defo değişimleri yakalanır', [f15a, f15b, f15c].every(f => f && f.izinsizFarklar.length > 0), [f15a, f15b, f15c].map(f => f && f.izinsizFarklar));
const f16 = ['ozel', 'foto', 'hex', 'barkod', 'ad'].map(k => bozuk(c => { c.urunler[0].renkler[0][k] = 'DEĞİŞTİ'; })), f16u = bozuk(c => { c.urunler[0]._m = 999; c.urunler[0].ad = 'X'; }),
  f16s = bozuk(c => { c.urunler.reverse(); }), f16r = bozuk(c => { c.urunler[0].renkler.reverse(); }), f16o = bozuk(c => { c.urunler[0].renkler[2].rid = 'r_degisti'; });
T('T16 renk metadata (ozel/foto/hex/barkod/ad), ürün metadata/_m, ürün ve renk sırası, mevcut rid değişimi yakalanır', [...f16, f16u, f16s, f16r, f16o].every(f => f && f.izinsizFarklar.length > 0), [...f16, f16u, f16s, f16r, f16o].map(f => f && f.izinsizFarklar.length));
const planB = planla(VERI(), kopya(SA), kopya(kOnay)); const drB = dene(() => S.gecisDryRun({ veri: VERI(), plan: planB, siniflandirma: kopya(SA), kararlar: kopya(kOnay) }));
T('T17 aynı girdi + aynı kimlik sağlayıcı → aynı plan ve aynı dry-run sonucu', plan && planB && JSON.stringify(plan) === JSON.stringify(planB) && JSON.stringify(drB) === JSON.stringify(dr), null);
const tekrar = dr && dene(() => S.gecisDryRun({ veri: dr.sonuc, plan, siniflandirma: SAdon, kararlar: kOnay }));
const S18 = dr ? await sinifla(dr.sonuc) : null; const p18 = dr ? planla(dr.sonuc, S18, []) : null;
T('T18 ikinci uygulama kimlikleri yeniden atamaz: aynı plan sonuç üzerinde reddedilir; yeni planda atanmış renkler ATLANDI', tekrar && tekrar.reddedildi && p18 && p18.atamalar.length === 0 && ['Siyah', 'Bordo', 'Beyaz'].every(a => durum(p18, a).durum === 'ATLANDI'), { tekrar: tekrar && tekrar.durdurmaNedenleri, p18: p18 && p18.renkler });

// ---- Önkoşul: snapshot A (plan) / B (yazma öncesi) ----
const onk = (veriB, ek = {}) => dene(() => S.gecisOnKosulKontrol({ plan, veri: veriB, siniflandirma: ek.sinif || SAdon, kararlar: ek.kararlar || kOnay }));
const B19 = VERI(); B19.urunler[2]._m = 301; const o19 = onk(B19);
const d19 = dene(() => S.gecisDryRun({ veri: B19, plan, siniflandirma: SAdon, kararlar: kOnay }));
T('T19 başlangıç ve güncel snapshot farklıysa (ürün _m) önkoşul ve dry-run reddedilir', o19 && o19.gecerli === false && o19.nedenler.some(n => /sürüm|_m/i.test(n)) && d19 && d19.reddedildi, { o19, d19: d19 && d19.durdurmaNedenleri });
const anahtarTers = (x) => Array.isArray(x) ? x.map(anahtarTers) : (x && typeof x === 'object') ? Object.fromEntries(Object.keys(x).reverse().map(k => [k, anahtarTers(x[k])])) : x;
const o20 = onk(anahtarTers(VERI()), { sinif: anahtarTers(kopya(SA)), kararlar: anahtarTers(kopya(kOnay)) });
T('T20 yalnız nesne anahtar sırası farklıysa reddedilmez (kanonik parmak izi)', o20 && o20.gecerli === true, o20);
const B11 = VERI(); B11.urunler[0].renkler.reverse(); const o11 = onk(B11);
T('T11 renk sırası değişince plan geçersiz olur (yanlış renge atanmaz)', o11 && o11.gecerli === false && o11.nedenler.some(n => /sıra/i.test(n)), o11);
const B21 = VERI(); B21.urunler[0].renkler[0].barkod = '999'; const o21 = onk(B21); const B21b = VERI(); B21b.urunler[2].renkler[0].ad = 'Bordo Koyu'; const o21b = onk(B21b);
T('T21 renk adı veya barkodu değişince reddedilir', o21 && !o21.gecerli && o21.nedenler.some(n => /ad|barkod/i.test(n)) && o21b && !o21b.gecerli, { o21, o21b });
const B22 = VERI(); B22.urunler[0].renkler[0].loklar = { 'L-ana': 7, 'L-depo': 5 }; const o22 = onk(B22);
T('T22 stok/lokasyon değişince (toplam aynı olsa da) reddedilir', o22 && !o22.gecerli && o22.nedenler.some(n => /stok|lokasyon/i.test(n)), o22);
const B23 = VERI(); B23.satislar.push({ id: 12, tip: 'satis', tarih: 2, teslimDurum: 'ayrildi', kalemler: [{ uid: 1, renkler: [{ ad: 'Siyah', mik: 1 }] }] }); const o23 = onk(B23, { sinif: await sinifla(B23) });
T('T23 açık yükümlülük / geçmiş kayıt durumu değişince reddedilir', o23 && !o23.gecerli && o23.nedenler.some(n => /geçmiş|yükümlülük/i.test(n)), o23);
const k24 = kopya(kOnay); k24[2].gerekce = 'değişti'; const o24 = onk(VERI(), { kararlar: k24 }); const S24 = kopya(SA); S24.renkler[0].sinif = 'ENGELLI'; const o24b = onk(VERI(), { sinif: S24 });
T('T24 yönetici kararı veya sınıflandırma değişince reddedilir', o24 && !o24.gecerli && o24.nedenler.some(n => /karar/i.test(n)) && o24b && !o24b.gecerli && o24b.nedenler.some(n => /sınıflandırma/i.test(n)), { o24, o24b });

// ---- Yedek ve rollback ----
const yedek = dene(() => S.gecisYedekAl(Adon));
T('yedek: bütün ürün/renk/stok alanları birebir (bellekte, sentetik)', yedek && !yedek.HATA && JSON.stringify(yedek.veri) === JSON.stringify(VERI()) && yedek.veri !== Adon, yedek && yedek.HATA);
const gd = dr && dene(() => S.gecisGeriDonusSimuleEt({ veri: dr.sonuc, plan, dryRun: dr }));
T('T25 rollback başlangıç snapshot\'ını birebir geri verir', gd && gd.basarili && JSON.stringify(gd.veri) === JSON.stringify(VERI()), gd && (gd.HATA || gd.nedenler));
T('T26 rollback önceden var olan rid\'i (Gri r_mevcut-1) silmez', gd && gd.veri && gd.veri.urunler[0].renkler[2].rid === 'r_mevcut-1', gd && gd.veri && gd.veri.urunler[0].renkler[2]);
const araya = dr ? kopya(dr.sonuc) : { urunler: [{ renkler: [{}, {}, {}] }, {}, { renkler: [{ loklar: {} }] }] }; araya.urunler[2].renkler[0].loklar['L-ana'] = 5; const gd27 = dene(() => S.gecisGeriDonusSimuleEt({ veri: araya, plan, dryRun: dr }));
const araya2 = dr ? kopya(dr.sonuc) : { urunler: [{ renkler: [{}] }] }; araya2.urunler[0].renkler[0].rid = 'r_baska'; const gd27b = dene(() => S.gecisGeriDonusSimuleEt({ veri: araya2, plan, dryRun: dr }));
T('T27 araya başka değişiklik girdiyse (stok ya da atanan rid değişmiş) rollback körlemesine yapılmaz, reddedilir', gd27 && gd27.basarili === false && gd27b && gd27b.basarili === false, { gd27: gd27 && gd27.nedenler, gd27b: gd27b && gd27b.nedenler });
const gd28 = gd && gd.veri ? dene(() => S.gecisGeriDonusSimuleEt({ veri: gd.veri, plan, dryRun: dr })) : null;
T('T28 ikinci rollback güvenli: zaten geri alınmış veri değişmeden döner', gd28 && gd28.basarili && gd28.zatenGeriAlinmis === true && JSON.stringify(gd28.veri) === JSON.stringify(VERI()), gd28);

// ---- İzolasyon ----
const kaynak = fs.readFileSync(path.join(ROOT, 'test/yardimci/rid-gecis-simulasyon.mjs'), 'utf8');
const yasakKelimeler = ['firebase', 'firestore', 'localStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest', 'document.', 'window.', 'import fs', "from 'fs'", "from 'node:fs'", 'process.', 'Math.random', 'Date.now', 'crypto', 'db.'];
const kodSatirlari = kaynak.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const tuzak = {}; const ad = ['fetch', 'localStorage', 'document', 'window', 'indexedDB', 'firebase', 'db', 'XMLHttpRequest'];
ad.forEach(k => { tuzak[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { configurable: true, get() { throw new Error('YASAK erişim: ' + k); } }); });
let izole;
try { const v = VERI(); const p = S.gecisPlaniOlustur({ veri: v, siniflandirma: kopya(SA), kararlar: [karar(S.renkReferanslari(v)[0])], kimlikSaglayici: sayac() });
  const d = S.gecisDryRun({ veri: v, plan: p, siniflandirma: kopya(SA), kararlar: [karar(S.renkReferanslari(v)[0])] }); const g = S.gecisGeriDonusSimuleEt({ veri: d.sonuc, plan: p, dryRun: d }); izole = { ok: g.basarili }; }
catch (e) { izole = { HATA: e.message }; }
finally { ad.forEach(k => { delete globalThis[k]; if (tuzak[k]) Object.defineProperty(globalThis, k, tuzak[k]); }); }
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
T('T29 zincir db/Firebase/ağ/DOM/depo erişimi olmadan çalışır (erişim tuzakları); kaynakta yasak kullanım yok; üretim koduna bağlı değil',
  izole && izole.ok === true && !yasakKelimeler.some(k => kodSatirlari.includes(k)) && !indexHtml.includes('rid-gecis-simulasyon'), { izole, yasak: yasakKelimeler.filter(k => kodSatirlari.includes(k)) });

// ---- Ders 39–41 ve ürün kartı ----
const t30 = await page.evaluate(() => { const v = { urunler: [{ id: 1, ad: 'X', kod: 'K', renkler: [{ ad: 'Siyah', barkod: '1' }] }] };
  return { f: ['renkKimlikDenetle', 'renkGecisHazirlikDenetle', 'renkKimlikDenetimEkrani', 'renkGecisHazirlikEkrani', 'kaydetUrun', 'formUrun', 'cogaltUrun', 'yeniRid'].every(n => typeof window[n] === 'function'),
    den: renkKimlikDenetle(v).ozet.kimliksiz === 1, gec: renkGecisHazirlikDenetle(v).ozet.ADAY === 1, rid: /^r_[0-9a-f]{8}-/.test(yeniRid() || ''), senk: canliAcik === false }; });
T('T30 Ders 39–41 fonksiyonları ve ürün kartı fonksiyonları yerinde ve çalışıyor (tam regresyon test 22–26 ile)', t30.f && t30.den && t30.gec && t30.rid && t30.senk, t30);

T('altyapı: dış istek tamamlanmadı (Firebase dahil)', !dis.some(h => /firestore|firebaseio|identitytoolkit|securetoken/.test(h)), dis);
T('altyapı: sayfa hatası yok', errs.length === 0, errs);
await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
