// R2.2b.1: Renk çözümleme motorunun TEK KAYNAĞA (js/renk-cozumleme.mjs) taşınması + PWA çevrimdışı güvenliği + global rid bütünlüğü.
// - Node ve tarayıcı AYNI dosyayı çalıştırır; test/yardimci/renk-cozumleme.mjs yalnız yeniden dışa aktarır (ikinci implementasyon yok).
// - index.html motoru yalnız YÜKLER ve hazır durumunu bildirir (window.renkMotoru); hiçbir iş akışı motoru çağırmaz.
// - sw.js motoru KRİTİK önbellek girdisi olarak alır: motor önbelleğe alınamazsa yeni sürüm kurulmaz.
// Gerçek tarayıcı + gerçek Service Worker, sentetik yerel sunucuda (rastgele port). localhost dışı her istek engellenir; Firebase yok.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createHash } from 'crypto';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOTOR = 'js/renk-cozumleme.mjs';
let ok = 0, fail = 0, davranis = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 320) : '')); } };
const dene = async (f) => { try { return await f(); } catch (e) { return { HATA: String(e && e.message || e).slice(0, 200) }; } };
const oku = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; } };
const gitHead = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
const headBasta = gitHead();

// ---- Yerel sunucu: doğru MIME; isteğe göre motor yok / farklı sürüm / farklı sw.js ----
const SV = { motorYok: false, motorSahte: null, swIcerik: null, sayac: {} };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const yol = decodeURIComponent(req.url.split('?')[0]); SV.sayac[yol] = (SV.sayac[yol] || 0) + 1;
  if (yol === '/' + MOTOR && SV.motorYok) { res.writeHead(404); return res.end(); }
  if (yol === '/' + MOTOR && SV.motorSahte) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(SV.motorSahte); }
  if (yol === '/sw.js' && SV.swIcerik) { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); return res.end(SV.swIcerik); }
  const p = path.join(ROOT, yol === '/' ? 'index.html' : yol);
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));
const URL0 = `http://localhost:${srv.address().port}/`;
const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const disari = [];
async function baglam(sw) {
  const ctx = await br.newContext({ serviceWorkers: sw ? 'allow' : 'block' });
  await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return route.continue(); disari.push(h); return route.abort(); });
  return ctx;
}
const korumali = (pg) => { const e = pg.evaluate.bind(pg); pg.evaluate = (f, a) => e(f, a).catch(err => ({ HATA: String(err && err.message || err).slice(0, 200) })); return pg; };
const hazirBekle = (page) => page.waitForFunction(() => window.renkMotoru && (window.renkMotoru.hazir || window.renkMotoru.hata), null, { timeout: 15000 }).catch(() => null);
const durum = (page) => page.evaluate(() => { const r = window.renkMotoru; return r ? { hazir: r.hazir, hata: r.hata, motor: !!r.motor, surum: r.motor && r.motor.MOTOR_SURUM, globalRenkCoz: typeof window.renkCoz, db: typeof db } : null; });

// ---- Ortak sentetik veri ----
const R = { S: 'r_11111111-1111-4111-8111-111111111111', B: 'r_22222222-2222-4222-8222-222222222222', G: 'r_33333333-3333-4333-8333-333333333333' };
const VERI = () => ({ urunler: [
  { id: 1, ad: 'Polo', renkler: [{ ad: 'Siyah', rid: R.S, loklar: { 'L-ana': 5 } }, { ad: 'Beyaz', loklar: { 'L-ana': 2 } }, { ad: 'Lacivert' }] },
  { id: 2, ad: 'Tişört', renkler: [{ ad: 'Gri', rid: R.G }, { ad: 'Kırmızı' }, { ad: 'kırmızı' }] },
  { id: 3, ad: 'Renksiz ürün' },
  { id: 4, ad: 'Eski biçim', renkler: ['Siyah', 'Beyaz'] },
] });
const STOK = { islem: 'STOK_DEGISTIRME' }, OKU = { islem: 'SALT_OKUMA' };

// ====== 1. Tek doğruluk kaynağı ======
const motorKaynak = oku(MOTOR), yardimci = oku('test/yardimci/renk-cozumleme.mjs'), t28 = oku('test/28-renk-cozumleme.test.mjs'), html = oku('index.html'), sw = oku('sw.js');
T('T1 kanonik motor dosyası mevcut (js/renk-cozumleme.mjs) ve renkCoz tanımı orada', !!motorKaynak && /export function renkCoz\(/.test(motorKaynak), !!motorKaynak);
const importlar = (s) => [...(s || '').matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map(m => m[1]);
T('T2 test 28 kanonik motoru doğrudan kullanıyor; kaynak taraması da kanonik dosyada', importlar(t28).includes('../js/renk-cozumleme.mjs') && /readFileSync\(path\.join\(ROOT, 'js\/renk-cozumleme\.mjs'\)/.test(t28 || ''), importlar(t28));
const yardimciKod = (yardimci || '').split('\n').filter(l => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l));
T('T3 eski yardımcı modül yalnız yeniden dışa aktarır (ikinci implementasyon yok)', yardimciKod.length > 0 && yardimciKod.every(l => /^export \* from '\.\.\/\.\.\/js\/renk-cozumleme\.mjs';$/.test(l.trim())), yardimciKod);
const M = await dene(() => import(pathToFileURL(path.join(ROOT, MOTOR)).href));
const MY = await dene(() => import(pathToFileURL(path.join(ROOT, 'test/yardimci/renk-cozumleme.mjs')).href));
T('T4 Node import başarılı; yardımcı yol aynı fonksiyon nesnelerini verir', M && typeof M.renkCoz === 'function' && M.MOTOR_SURUM === 1 && MY && MY.renkCoz === M.renkCoz && MY.DURUM === M.DURUM, { M: M && M.HATA, MY: MY && MY.HATA });
const C = (v, r, s) => { try { return M.renkCoz(v, r, s); } catch (e) { return { HATA: e.message }; } };
const D = (x) => x && x.durum;

// ====== 2. Global rid bütünlüğü (Node) ======
const v21 = VERI(); v21.urunler[1].renkler[1].rid = R.S;
T('T21 farklı ürünlerde aynı rid → KIMLIK_CAKISMASI (ilk bulunan renge bağlanmaz)', D(C(v21, { uid: 1, rid: R.S }, OKU)) === 'KIMLIK_CAKISMASI' && D(C(v21, { uid: 2, rid: R.S }, STOK)) === 'KIMLIK_CAKISMASI', [D(C(v21, { uid: 1, rid: R.S }, OKU))]);
const bozuklar = [
  ['renkler metin', v => { v.urunler[1].renkler = 'Gri,Kırmızı'; }],
  ['renkler nesne (dizi değil)', v => { v.urunler[1].renkler = { 0: { ad: 'Gri', rid: R.S } }; }],
  ['öğe dizi', v => { v.urunler[1].renkler.push([{ rid: R.S }]); }],
  ['öğe sayı', v => { v.urunler[1].renkler.push(5); }],
  ['rid tipi bozuk', v => { v.urunler[1].renkler[1].rid = 12345; }],
  ['rid biçimi bozuk', v => { v.urunler[1].renkler[1].rid = 'r_ bozuk'; }],
  ['rid boş', v => { v.urunler[1].renkler[1].rid = ''; }],
  ['ürün kaydı dizi', v => { v.urunler.push([{ id: 9, renkler: [{ rid: R.S }] }]); }],
];
const t22 = bozuklar.map(([ad, f]) => { const v = VERI(); f(v); return [ad, D(C(v, { uid: 1, rid: R.S }, OKU)), D(C(v, { uid: 1, rid: R.S }, STOK))]; });
T('T22 başka ürünün bozuk renk listesi / bozuk rid\'i global benzersizliği doğrulanamaz kılar → GECERSIZ_VERI (sessiz atlama yok)', t22.every(x => x[1] === 'GECERSIZ_VERI' && x[2] === 'GECERSIZ_VERI'), t22);
const vZararsiz = VERI(); vZararsiz.urunler.push(null);
const t22b = [D(C(VERI(), { uid: 1, rid: R.S }, OKU)), D(C(vZararsiz, { uid: 1, rid: R.S }, OKU))];
T('T22b rid taşıyamayan biçimler (renksiz ürün, eski metin renk öğeleri, boş kayıt) gereksiz ret üretmez → UYGUN', t22b.every(d => d === 'UYGUN'), t22b);
const v23 = VERI(); v23.urunler[0].renkler[2].rid = R.S;
T('T23 aynı ürün içinde mükerrer rid → KIMLIK_CAKISMASI', D(C(v23, { uid: 1, rid: R.S }, OKU)) === 'KIMLIK_CAKISMASI', D(C(v23, { uid: 1, rid: R.S }, OKU)));
const v24 = VERI(); v24.urunler.push({ id: 1, ad: 'Kopya', renkler: [] }); const v24b = VERI(); v24b.urunler.push({ id: 2, ad: 'Kopya', renkler: [] });
T('T24 mükerrer ürün ID reddedilir (hedef ürün → URUN_BELIRSIZ; rid\'in sahibi olan başka ürün belirsizse → GECERSIZ_VERI/URUN_BELIRSIZ)', D(C(v24, { uid: 1, rid: R.S }, OKU)) === 'URUN_BELIRSIZ' && ['URUN_BELIRSIZ', 'GECERSIZ_VERI'].includes(D(C(v24b, { uid: 1, rid: R.S }, OKU))), [D(C(v24, { uid: 1, rid: R.S }, OKU)), D(C(v24b, { uid: 1, rid: R.S }, OKU))]);
const t25 = [5, null, {}, [], true, '', 'r_', 'r_ab cd', 'R_11111111-1111-4111-8111-111111111111', ' ' + R.S].map(rid => D(C(VERI(), { uid: 1, rid, ad: 'Siyah' }, OKU)));
T('T25 geçersiz rid türü / biçimi güvenli reddedilir (ada düşülmez)', t25.every(d => d === 'GECERSIZ_REFERANS'), t25);
const t26 = C(VERI(), { uid: 1, ad: 'Siyah' }, OKU), t26b = C(VERI(), { uid: 1, ad: 'Siyah' }, STOK);
T('T26 eski kimliksiz kayıt otomatik kimlikli kayda yükseltilmez (rid önerilmez, ADAY / MUTABAKAT_GEREKLI)', D(t26) === 'ADAY' && t26.rid === null && D(t26b) === 'MUTABAKAT_GEREKLI' && t26b.rid === null, { t26, t26b });
const dondur = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(dondur); Object.freeze(o); } return o; };
const vd = dondur(VERI()); const r27 = [C(vd, { uid: 1, rid: R.S }, STOK), C(vd, { uid: 1, ad: 'Beyaz' }, OKU), C(vd, { uid: 2, ad: 'Kırmızı' }, STOK)];
T('T27 kaynak veri değişmez (derin dondurulmuş girdi; sonra birebir aynı)', r27.every(x => x && x.durum && !x.HATA) && JSON.stringify(vd) === JSON.stringify(VERI()), r27.map(D));
const r28 = [1, 2, 3].map(() => JSON.stringify([C(VERI(), { uid: 1, rid: R.S }, OKU), C(v21, { uid: 1, rid: R.S }, OKU), C(VERI(), { uid: 1, ad: 'Beyaz' }, STOK)]));
T('T28 aynı girdi aynı sonucu verir', r28[0] === r28[1] && r28[1] === r28[2] && (r28[0].match(/"durum"/g) || []).length === 3, null);
davranis += 8;

// T7 yan etkisizlik: ağ/depo/DOM/zaman/rastgelelik tuzakları altında gerçek çağrılar
const tuzak = ['fetch', 'localStorage', 'document', 'window', 'indexedDB', 'firebase', 'db', 'XMLHttpRequest', 'navigator']; const eski = {};
tuzak.forEach(k => { eski[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { configurable: true, get() { throw new Error('YASAK ' + k); } }); });
const eR = Math.random, eN = Date.now; Math.random = () => { throw new Error('Math.random'); }; Date.now = () => { throw new Error('Date.now'); };
let t7; try { const o = M.mutabakatOnayiOlustur(VERI(), { uid: 1, ad: 'Beyaz' }, { uid: 1, renkIdx: 1 }, 'g', ['k']); t7 = [D(M.renkCoz(VERI(), { uid: 1, ad: 'Beyaz' }, { islem: 'STOK_DEGISTIRME', onay: o })), D(M.renkCoz(v21, { uid: 1, rid: R.S }, OKU)), D(M.renkCoz(VERI(), { uid: 1, rid: R.S }, OKU))]; }
catch (e) { t7 = 'HATA ' + e.message; } finally { Math.random = eR; Date.now = eN; tuzak.forEach(k => { delete globalThis[k]; if (eski[k]) Object.defineProperty(globalThis, k, eski[k]); }); }
T('T7 motor yan etkisiz: ağ/depo/DOM/zaman/rastgelelik tuzaklarına dokunmadan çalışır', Array.isArray(t7) && t7.join() === 'MUTABAKATLI,KIMLIK_CAKISMASI,UYGUN', t7);

// Mutabakat güven sınırı
const onay0 = await dene(() => M.mutabakatOnayiOlustur(VERI(), { uid: 1, ad: 'Beyaz' }, { uid: 1, renkIdx: 1 }, 'Rafta sayıldı', ['sayım#7'])); const onay = onay0 && !onay0.HATA ? onay0 : null;
const r41 = C(VERI(), { uid: 1, ad: 'Beyaz' }, { ...STOK, onay });
const r41b = onay && C(VERI(), { uid: 1, ad: 'Beyaz' }, { ...STOK, onay: { ...onay, yetkiKaniti: true } });
const G = M && M.MUTABAKAT_GUVEN_SINIRI;
T('T41 mutabakat istemci taslağıdır: yetkiKaniti false, güven sınırı belgeli, sonuç uyarısı var, "yetki kanıtıyım" diyen onay reddedilir',
  onay && onay.yetkiKaniti === false && onay.guvenSiniri === 'ISTEMCI_TASLAGI' && G && G.yetkiKaniti === false &&
  Array.isArray(G.sunucuDogrulamaAlanlari) && G.sunucuDogrulamaAlanlari.length >= 4 &&
  D(r41) === 'MUTABAKATLI' && r41.stokYazmaYetkisi === false && (r41.uyarilar || []).some(u => /yetki/i.test(u)) && D(r41b) === 'ONAY_GECERSIZ', { onay, r41, r41b: D(r41b) });

// ====== 3. Tarayıcı: motoru import etme ve uygulamadan yükleme (SW kapalı) ======
const ornekler = [[VERI(), { uid: 1, rid: R.S }, OKU], [VERI(), { uid: 1, ad: 'Beyaz' }, STOK], [v21, { uid: 1, rid: R.S }, OKU], [VERI(), { uid: 2, ad: 'Kırmızı' }, OKU],
  [VERI(), { uid: '1', ad: 'Beyaz' }, OKU], [VERI(), { uid: 1, rid: 5 }, OKU], [null, {}, OKU], ...bozuklar.slice(0, 3).map(([, f]) => { const v = VERI(); f(v); return [v, { uid: 1, rid: R.S }, STOK]; })];
const nodeSonuc = JSON.stringify(ornekler.map(([v, r, s]) => C(v, r, s)));
let ctx = await baglam(false); let page = korumali(await ctx.newPage()); const errs = []; page.on('pageerror', e => errs.push(e.message));
const ilkSayac = { ...SV.sayac };
await page.goto(URL0); await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));
await hazirBekle(page);
const t5 = await dene(() => page.evaluate(async ([yol, ornek]) => { const m = await import('./' + yol); return { tip: typeof m.renkCoz, sonuc: JSON.stringify(ornek.map(([v, r, s]) => m.renkCoz(v, r, s))) }; }, [MOTOR, ornekler]));
T('T5 tarayıcıda ES modül olarak import başarılı', t5 && t5.tip === 'function', t5);
T('T6 Node ve tarayıcı aynı girdilerde birebir aynı sonucu üretir (' + ornekler.length + ' örnek)', t5 && t5.sonuc === nodeSonuc, t5 && t5.sonuc && t5.sonuc.slice(0, 120));
const d8 = await durum(page); const fb1 = await page.evaluate(() => typeof firebase);
T('T8 uygulama motoru yükleyebiliyor (index.html → window.renkMotoru.motor)', d8 && d8.motor && d8.surum === 1 && d8.db === 'object', d8);
T('T9 hazır durumu doğru bildiriliyor (hazir:true, hata:null)', d8 && d8.hazir === true && d8.hata === null, d8);
const t12 = await page.evaluate(() => { const r = window.renkMotoru; const f = r && r.motor && r.motor.renkCoz;
  try { window.renkMotoru = { hazir: true, motor: { sahte: 1 } }; } catch (e) {} try { r.motor.renkCoz = () => 0; } catch (e) {} try { r.hazir = false; r.motor = null; } catch (e) {}
  return { degisti: window.renkMotoru !== r, motorDegisti: !r.motor || r.motor.renkCoz !== f, hazir: r.hazir }; });
const yukleyici = ((html || '').match(/<script>(\s*\/\* R2\.2b\.1[\s\S]*?)<\/script>/) || [])[1];
if (yukleyici) await page.evaluate((k) => { (0, eval)(k); }, yukleyici); await page.waitForTimeout(400);
const motorIstek = (SV.sayac['/' + MOTOR] || 0) - (ilkSayac['/' + MOTOR] || 0);
const d12 = await durum(page);
T('T12 motor iki kez yüklenmiyor (yükleyici yeniden çalışsa da tek istek; window.renkMotoru, hazır durumu ve motor dışarıdan değiştirilemez)', !!yukleyici && motorIstek === 1 && !t12.degisti && !t12.motorDegisti && t12.hazir === true && d12 && d12.hazir === true,
  { motorIstek, t12, yukleyici: !!yukleyici });
// T40: motor hazır olsa da hiçbir şey stok yazma yetkisi vermez
const t40 = await page.evaluate(() => { const m = window.renkMotoru && window.renkMotoru.motor; if (!m) return null; const v = { urunler: [{ id: 1, renkler: [{ ad: 'A', rid: 'r_11111111-1111-4111-8111-111111111111' }, { ad: 'B' }] }] };
  const o = m.mutabakatOnayiOlustur(v, { uid: 1, ad: 'B' }, { uid: 1, renkIdx: 1 }, 'g', ['k']);
  return [m.renkCoz(v, { uid: 1, rid: 'r_11111111-1111-4111-8111-111111111111' }, { islem: 'STOK_DEGISTIRME' }), m.renkCoz(v, { uid: 1, ad: 'B' }, { islem: 'STOK_DEGISTIRME', onay: o })].map(x => [x.durum, x.stokYazmaYetkisi]); });
T('T40 motorun hazır olması stok yazma yetkisi vermez (UYGUN ve MUTABAKATLI dahil stokYazmaYetkisi=false)', Array.isArray(t40) && t40[0][0] === 'UYGUN' && t40[1][0] === 'MUTABAKATLI' && t40.every(x => x[1] === false), t40);
davranis += 6;

// ====== 4. İş akışları motoru çağırmıyor + davranış değişmedi (sayaçlı casus motorla) ======
const gercekMotor = motorKaynak || '';
SV.motorSahte = gercekMotor.replace(/export function renkCoz\(/, 'globalThis.__renkCozSayac = 0;\nexport function renkCoz(...a) { globalThis.__renkCozSayac++; return _renkCozIc(...a); }\nfunction _renkCozIc(');
const ctx2 = await baglam(false); const p2 = korumali(await ctx2.newPage()); p2.on('pageerror', e => errs.push(e.message));
await p2.goto(URL0); await p2.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app')); await hazirBekle(p2);
const akis = await dene(() => p2.evaluate(async () => {
  const sonuc = {}; const casus0 = globalThis.__renkCozSayac;
  db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }]; aktifLok = 'L-ana'; db.pin = null;
  db.urunler = [{ id: 7001, ad: 'Akış Polo', kod: 'AK-1', birim: 'adet', pb: 'TL', alis: 10, satis: 20, kritik: 0, stok: 0,
    renkler: [{ ad: 'Siyah', rid: 'r_11111111-1111-4111-8111-111111111111', hex: '#111', stok: 0, loklar: { 'L-ana': 10, 'L-depo': 5 } }] }];
  db.cariler = [{ id: 'c-ak', ad: 'Akış Müşteri', tip: 'musteri', bakiye: 0, lokId: 'L-ana' }]; db.hesaplar = [{ id: 'h-ak', ad: 'Nakit Kasa', bakiye: 100, lokId: 'L-ana' }];
  db.hareketler = []; db.cekler = []; db.satislar = []; db.transferler = []; db.isemirleri = []; db.bekleyenPortal = []; stokProjYukle(); save();
  const lok = (L) => +urun(7001).renkler[0].loklar[L];
  const s = { id: 's-ak', tip: 'satis', lokId: 'L-ana', mid: 'c-ak', mus: 'Akış Müşteri', pb: 'TL', tarih: 1700000000000, tutar: 60, araToplam: 60, odenen: 20, odemeler: [{ tur: 'Nakit', tutar: 20, pb: 'TL', hesapId: 'h-ak' }],
    kalemler: [{ uid: 7001, urun: 'Akış Polo', mik: 3, birim: 'adet', fiyat: 20, renkler: [{ ad: 'Siyah', mik: 3 }] }] };
  db.satislar.push(s); applySatis(s); sonuc.satis = [lok('L-ana'), db.cariler[0].bakiye, db.hesaplar[0].bakiye];
  silSatis('s-ak'); const t = $('kk-txt'); if (t) { t.value = 'SİL'; await kritikOnayla(); } sonuc.iptal = [lok('L-ana'), db.cariler[0].bakiye, db.hesaplar[0].bakiye, !!s.iptal];
  transferStokUygula([{ uid: 7001, renk: 'Siyah', adet: 2 }], 'L-depo', -1); transferStokUygula([{ uid: 7001, renk: 'Siyah', adet: 2 }], 'L-ana', 1); sonuc.transfer = [lok('L-ana'), lok('L-depo')];
  const m = _recMerge([{ id: 1, _m: 5, a: 'yerel' }, { id: 2, _m: 1 }], [{ id: 1, _m: 3, a: 'bulut' }, { id: 3, _m: 2 }], { 2: 9 }); sonuc.senkron = m.map(r => r.id + ':' + (r.a || '')).sort().join(',');
  kasaHareket('h-ak', 'in', 50, 'Test', 'akış', null, 'L-ana'); sonuc.finans = [db.hesaplar[0].bakiye, db.hareketler.length];
  stokUygula({ uid: 7001, mik: 1, renkler: [{ ad: 'Yeşil', mik: 1 }] }, -1, 'L-ana'); sonuc.otoRenk = urun(7001).renkler.map(r => r.ad).join(',');
  sonuc.casus = [casus0, globalThis.__renkCozSayac]; return sonuc; }));
T('T14 satış iptali davranışı değişmedi (stok 7→10, bakiye 40→0, kasa 120→100, iptal:true)', akis.iptal && JSON.stringify(akis.iptal) === JSON.stringify([10, 0, 100, true]), akis);
T('T15 satış oluşturma davranışı değişmedi (stok 10→7, bakiye 40, kasa 120)', akis.satis && JSON.stringify(akis.satis) === JSON.stringify([7, 40, 120]), akis.satis);
T('T16 transfer davranışı değişmedi (Depo 5→3, Mağaza 10→12)', akis.transfer && JSON.stringify(akis.transfer) === JSON.stringify([12, 3]), akis.transfer);
T('T19 senkron birleşim davranışı değişmedi (_recMerge: LWW + tomb)', akis.senkron === '1:yerel,3:', akis.senkron);
T('T20 finans davranışı değişmedi (kasaHareket bakiye + hareket)', akis.finans && akis.finans[0] === 150 && akis.finans[1] >= 1, akis.finans);
T('T42 iptal dışı satış stok yolunda otomatik renk açma davranışı DEĞİŞMEDİ (bilinen risk, R2.2c kapsamı)', akis.otoRenk === 'Siyah,Yeşil', akis.otoRenk);
T('T43 iş akışları motoru ÇAĞIRMIYOR (casus motor yüklendi, çağrı sayısı 0)', akis.casus && akis.casus[0] === 0 && akis.casus[1] === 0, akis.casus);
SV.motorSahte = null; await ctx2.close(); davranis += 7;

const TABAN = {
  stokUygula: '8756afbaf86825a6',
  kirikStokUygula: 'f06e13d1da9f1767',
  defoUygula: '08930395b2c8a7f8',
  applySatis: '37274ab71919979c',
  revertSatis: '1be85dd420636592',
  silSatis: '4c4422b31b4d1a9f',
  satisGeriAl: '09c4da268ab54bc6',
  kaydetSatis: 'f9403cd00e9ff0cd',
  sepEkle: '207dd5bf1b029ab3',
  _isEmriStoklaCommit: '14863def812dc9af',
  lokStokRenk: 'fd2ae5ad65c2edc8',
  transferStokUygula: '06fd6711ac3da230',
  portalOnay: '615ba0d5faeba870',
  canliDomenUygula: '28cfaa0ea2260cea',
  _recMerge: '7fb79bbce540700e',
  _sbAl: 'db73110a61d221b3',
  _kumulatifBirlestir: 'b844992000bd5e8e',
  kasaHareket: 'a1cd577175e87b48',
};
const govde = (ad) => { const i = (html || '').indexOf('function ' + ad + '('); return i < 0 ? '' : html.slice(i, html.indexOf('\nfunction ', i + 10)); };
const iz = (ad) => createHash('sha256').update(govde(ad)).digest('hex').slice(0, 16);
const farkli = (l) => l.filter(f => !TABAN[f] || iz(f) !== TABAN[f]);
const isFn = ['stokUygula', 'kirikStokUygula', 'defoUygula', 'applySatis', 'revertSatis', 'satisGeriAl']; /* Ders 47 (kullanıcı onayı): sepEkle + kaydetSatis yalnız yeni satış rid'i için değişebilir → davranışları test 31'de. Ders 48 (Karar 2/3): silSatis güvenli iptal için değişebilir → davranışı test 32'de */
T('T13 index.html stok/iptal fonksiyonları değişmedi (Ders 46 başlangıç parmak izi; sepEkle/kaydetSatis test 31\'de davranışla)', farkli(isFn).length === 0, farkli(isFn));
T('T17 üretim davranışı değişmedi (_isEmriStoklaCommit ve ilgili fonksiyonlar)', farkli(['_isEmriStoklaCommit', 'lokStokRenk', 'transferStokUygula']).length === 0 && (await page.evaluate(() => typeof _isEmriStoklaCommit === 'function')) === true, farkli(['_isEmriStoklaCommit']));
T('T18 portal davranışı değişmedi (portalOnay)', farkli(['portalOnay']).length === 0 && (await page.evaluate(() => typeof portalOnay === 'function')) === true, farkli(['portalOnay']));
T('T19b senkron/finans fonksiyonları değişmedi (canliDomenUygula, _recMerge, _sbAl, _kumulatifBirlestir, kasaHareket)', farkli(['canliDomenUygula', '_recMerge', '_sbAl', '_kumulatifBirlestir', 'kasaHareket']).length === 0, farkli(['canliDomenUygula', '_recMerge', '_sbAl', '_kumulatifBirlestir', 'kasaHareket']));
await ctx.close();

// ====== 5. Motor eksik / sürüm uyuşmaz → sessiz alternatif yok ======
SV.motorYok = true; ctx = await baglam(false); page = korumali(await ctx.newPage()); page.on('pageerror', e => errs.push(e.message));
await page.goto(URL0); await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app')); await hazirBekle(page);
const d10 = await durum(page);
T('T10 motor eksikse hazir:false, hata görünür; uygulama yine de açılır', d10 && d10.hazir === false && typeof d10.hata === 'string' && d10.hata.length > 5 && d10.db === 'object', d10);
const t11 = await page.evaluate(() => ({ motor: window.renkMotoru.motor, glob: Object.getOwnPropertyNames(window).filter(k => /^(renkCoz|mutabakatOnayiOlustur|urunParmagi|adAnahtari)$/.test(k)) }));
T('T11 sessiz fallback yok (motor null; global yedek renkCoz / ikinci implementasyon yok)', t11.motor === null && Array.isArray(t11.glob) && t11.glob.length === 0, t11);
T('T32 motor eksikse alternatif yol kullanılmaz (index.html\'de motor iş mantığı kopyası yok)', !/function renkCoz\b|function kanonik\b|RENK_MUTABAKAT|ESKI_ONAY_GECERSIZ|KIMLIK_CAKISMASI/.test(html || '') && d10 && d10.motor === false, null);
await ctx.close(); SV.motorYok = false;
SV.motorSahte = (motorKaynak || '').replace(/export const MOTOR_SURUM = 1;/, 'export const MOTOR_SURUM = 2;');
ctx = await baglam(false); page = korumali(await ctx.newPage()); await page.goto(URL0); await page.waitForFunction(() => typeof db !== 'undefined'); await hazirBekle(page);
const d10b = await durum(page);
T('T10b motor sürümü uyuşmazsa (eski sekme / yeni motor) hazır sayılmaz, hata sürümü belirtir', SV.motorSahte !== motorKaynak && d10b && d10b.hazir === false && /sürüm/i.test(d10b.hata || '') && d10b.motor === false, d10b);
await ctx.close(); SV.motorSahte = null; davranis += 4;

// ====== 6. PWA / Service Worker (gerçek tarayıcı, gerçek sw.js) ======
const CACHE = ((sw || '').match(/const CACHE = '([^']+)'/) || [])[1];
const APP = ((html || '').match(/const APP_SURUM = '([^']+)'/) || [])[1];
ctx = await baglam(true); page = korumali(await ctx.newPage()); page.on('pageerror', e => errs.push(e.message));
await page.goto(URL0);
const t29 = await dene(async () => { await page.evaluate(() => navigator.serviceWorker.ready.then(() => true)); await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.waitForFunction(() => typeof db !== 'undefined'); await hazirBekle(page); return await durum(page); });
const fb2 = await page.evaluate(() => typeof firebase).catch(() => 'hata');
T('T29 çevrimiçi PWA kurulumu: SW kontrol ediyor, uygulama + motor birlikte yüklendi', t29 && t29.hazir === true && t29.db === 'object', t29);
const t31 = await dene(() => page.evaluate(async (c) => { const k = await caches.open(c); const r = await k.match('./js/renk-cozumleme.mjs'); const t = r ? await r.text() : ''; return { var: !!r, renkCoz: /export function renkCoz\(/.test(t), anahtarlar: (await caches.keys()) }; }, CACHE));
T('T31 motor SW önbelleğinde (' + CACHE + ') gerçekten mevcut', t31 && t31.var && t31.renkCoz, t31);
await ctx.setOffline(true);
const t30 = await dene(async () => { await page.reload(); await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'), null, { timeout: 15000 }); await hazirBekle(page); return await durum(page); });
T('T30 daha önce kurulmuş PWA çevrimdışı açılır; motor önbellekten yüklenir (hazir:true)', t30 && t30.hazir === true && t30.db === 'object', t30);
await ctx.setOffline(false); await ctx.close(); davranis += 3;

// D: motor önbelleğe alınamazsa yeni SW kurulmaz
SV.motorYok = true; ctx = await baglam(true); page = korumali(await ctx.newPage()); const swOnce = SV.sayac['/sw.js'] || 0, mOnce = SV.sayac['/' + MOTOR] || 0; await page.goto(URL0);
await page.waitForFunction(() => typeof db !== 'undefined').catch(() => null); await page.waitForTimeout(4000);
const tD = await dene(() => page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration();
  return { kayit: !!reg, active: !!(reg && reg.active), waiting: !!(reg && reg.waiting), installing: !!(reg && reg.installing), kontrol: !!navigator.serviceWorker.controller }; }));
const tD2 = tD && tD.kontrol; if (tD) { tD.swIstek = (SV.sayac['/sw.js'] || 0) - swOnce; tD.motorIstek = (SV.sayac['/' + MOTOR] || 0) - mOnce; }
T('T44 motor önbelleğe alınamazsa yeni Service Worker hazır kabul edilmez (sw.js ve motor istendi; kurulum başarısız: etkin/bekleyen/kurulan çalışan yok, sayfa kontrol edilmiyor)', tD && tD.swIstek >= 1 && tD.motorIstek >= 1 && tD.active === false && !tD.waiting && !tD.installing && tD2 === false, tD);
await ctx.close(); SV.motorYok = false;

// F: hiç kurulmamış PWA çevrimdışı ilk ziyarette açılmaz (iddia edilmez)
ctx = await baglam(true); page = korumali(await ctx.newPage()); await ctx.setOffline(true);
const tF = await dene(async () => { await page.goto(URL0, { timeout: 8000 }); return await page.evaluate(() => typeof db); });
T('T45 çevrimdışı İLK ziyarette uygulama açılmaz (kurulmamış PWA için çevrimdışı iddiası yok)', tF && tF.HATA, tF);
await ctx.close();

// G: güncelleme akışı korunur: yeni SW kendiliğinden devralmaz; SKIP_WAITING → controllerchange; eski önbellek silinir
SV.swIcerik = (sw || '').replace(/const CACHE = '[^']+'/, "const CACHE = 'iqbasics-test-eski'");
ctx = await baglam(true); page = korumali(await ctx.newPage()); await page.goto(URL0);
const tG = await dene(async () => {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true)); await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  SV.swIcerik = null; // sunucu artık gerçek sw.js veriyor
  const a = await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update();
    for (let i = 0; i < 100 && !reg.waiting; i++) await new Promise(r => setTimeout(r, 100));
    const bekliyor = !!reg.waiting, eskiKontrol = navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL;
    const degisti = new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', () => r(true), { once: true }));
    reg.waiting && reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    const cc = await Promise.race([degisti, new Promise(r => setTimeout(() => r(false), 10000))]);
    let keys = await caches.keys(); for (let i = 0; i < 50 && keys.includes('iqbasics-test-eski'); i++) { await new Promise(r => setTimeout(r, 100)); keys = await caches.keys(); }
    return { bekliyor, cc, keys }; });
  return a; });
T('T33 SW güncelleme davranışı korunur (yeni sürüm bekler, SKIP_WAITING ile devralır, eski önbellek silinir)', tG && tG.bekliyor === true && tG.cc === true && tG.keys.includes(CACHE) && !tG.keys.includes('iqbasics-test-eski'), tG);
await ctx.close(); SV.swIcerik = null; davranis += 3;

// H: sürüm uyumu ve SW kaynağı
const no = (s) => ((s || '').match(/(\d+)$/) || [])[1];
T('T34 APP_SURUM ve CACHE tutarlı (aynı numara)', APP && CACHE && no(APP) === no(CACHE.replace(/^iqbasics-v/, '')) && no(APP) === '173', { APP, CACHE });
T('T46 sw.js: motor KRİTİK önbellek girdisi (hata yutulmaz, HTTP önbelleği atlanır); skipWaiting yalnız mesajla',
  /KRITIK\s*=\s*\[\s*'\.\/js\/renk-cozumleme\.mjs'\s*\]/.test(sw || '') && /cache:\s*'reload'/.test(sw || '') && (sw.match(/skipWaiting\(\)/g) || []).length === 1 && /SKIP_WAITING'\) self\.skipWaiting\(\)/.test(sw || ''), null);

// ====== 7. Diğer testler ======
const calis = (dosya) => { const r = spawnSync(process.execPath, [path.join(ROOT, 'test', dosya)], { cwd: ROOT, encoding: 'utf8', timeout: 400000 }); const son = (r.stdout || '').trim().split('\n').pop(); return { kod: r.status, son }; };
const r28k = calis('28-renk-cozumleme.test.mjs');
T('T35 Ders 44 testleri (28) geçiyor', r28k.kod === 0 && /0 FAIL/.test(r28k.son), r28k);
const t29Hash = createHash('sha256').update(oku('test/29-satis-iptal-guvenligi.test.mjs') || '').digest('hex').slice(0, 16);
const r29k = calis('29-satis-iptal-guvenligi.test.mjs');
T('T36 Ders 45 testi (29) değişmedi ve bilinçli KIRMIZI kalıyor (çıkış kodu 1, FAIL > 0)', t29Hash === 'f5de86cf9eef6efd' /* Ders 47: yalnız onaylı T34b değişikliği sonrası test 29 */ && r29k.kod === 1 && /[1-9]\d* FAIL/.test(r29k.son), { t29Hash, r29k });
T('T37 bu çalıştırma commit/push yapmadı (HEAD aynı) ve motor/test git veya yayın komutu içermiyor', gitHead() === headBasta && !/git (commit|push)|gh-pages|deploy/i.test((motorKaynak || '') + (yardimci || '')), null);
T('T38 Firebase / gerçek veri erişimi yok (localhost dışı istekler engellendi; normal ve SW\'li bağlamda Firebase SDK yüklenmedi)', fb1 === 'undefined' && fb2 === 'undefined' && disari.length > 0, { fb1, fb2, disari: [...new Set(disari)] });
T('T39 testler gerçek davranışı çalıştırıyor (Node + tarayıcı + SW davranış kontrolü ≥ 25), parmak izi yalnız ek kanıt', davranis >= 25, davranis);
T('T-ek sayfa hatası yok', errs.length === 0, errs);

await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
