// Ders 50.3c-3b-1 — FIREBASE EMÜLATÖRÜ YALITIM TESTİ (yalnız YEREL; CI listesine GİRMEZ: dosya adı .test.mjs ile bitmez).
// Amaç: uygulama sayfası DEĞİŞTİRİLMEDEN Firebase 10.12.0 compat SDK ile yerel emülatöre bağlanır; gerçek üretim projesine HİÇBİR bağlantı kurulmaz.
// Çalıştırma (test/OKU.md): IQ_EMU_DIR=<firebase-tools ve firebase@10.12.0 kurulu geçici klasör> node test/emulator/39a-yalitim.mjs
// Yalıtım katmanları:
//   1) Proje: yalnız "demo-iqbasics-test" (demo- öneki: kimlik bilgisi olmadan, gerçek kaynaklara bağlanmadan çalışır). Başka kimlik → test BAŞLAMAZ.
//   2) Uygulama: sayfa yüklenmeden önce çalışan betik firebase.initializeApp'i sarar; uygulamanın gerçek yapılandırması (FB_CONFIG) SDK'ya
//      HİÇ verilmez, yerine demo yapılandırması verilir; Firestore ve Auth ilk kullanımdan önce emülatöre yönlendirilir. Yönlendirme
//      kurulamazsa sayfa başlatılmaz (test durur).
//   3) Ağ (tarayıcı): yeni ve boş tarayıcı profili; DNS düzeyinde localhost dışı her ad çözümsüz (--host-resolver-rules) + her istek
//      gerçekleşmeden önce yakalanır: localhost / 127.0.0.1 dışı her istek ENGELLENİR; gstatic SDK dosyaları yerel kopyadan verilir.
//   4) Emülatör süreci: geçici klasörde firebase.json + basit test kuralları; yalnız 127.0.0.1; boş geçici ana klasör (gerçek oturum /
//      kimlik bilgisi görülmez); dış ağ vekili ölü adrese yönlendirilir; kalıcı veri yok; test sonunda süreç kapatılır ve portlar doğrulanır.
import { spawn, execFileSync } from 'child_process'; import { createHash } from 'crypto'; import net from 'net'; import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url'; import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJE = 'demo-iqbasics-test', GERCEK_PROJE = 'iq-basics', SDK = '10.12.0';
const GERCEK_FIREBASE = /firestore\.googleapis\.com|firebaseio\.com|identitytoolkit|securetoken|firebaseapp\.com|googleapis\.com|firebase\.google\.com/;
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 500) : '')); } };
const dur = (m) => { console.log('DUR: ' + m); console.log(`${ok} PASS, ${fail + 1} FAIL`); process.exit(1); };
const bekle = (ms) => new Promise(r => setTimeout(r, ms));

const EMU = process.env.IQ_EMU_DIR ? path.resolve(process.env.IQ_EMU_DIR) : null;
if (!EMU || !fs.existsSync(path.join(EMU, 'node_modules/.bin/firebase'))) dur('IQ_EMU_DIR ayarlı değil ya da firebase-tools kurulu değil (bkz. test/OKU.md)');
if (EMU.startsWith(ROOT + path.sep) || EMU === ROOT) dur('emülatör araçları depo İÇİNE kurulmamalı');
const SDK_DIR = path.join(EMU, 'node_modules/firebase'), SDK_SURUM = JSON.parse(fs.readFileSync(path.join(SDK_DIR, 'package.json'), 'utf8')).version;
const CLI_SURUM = JSON.parse(fs.readFileSync(path.join(EMU, 'node_modules/firebase-tools/package.json'), 'utf8')).version;
const gitDurum = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).sort()
  .map(l => { const f = path.join(ROOT, l.slice(3)); let oz = '-'; try { if (fs.statSync(f).isFile()) oz = createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch (e) { oz = 'yok'; } return l + ' ' + oz; });
// Yalnız TESTİN KENDİ yan etkisi denetlenir: başlangıç ve bitişteki git durumu (durum kodu + izlenmeyen dosyalar + içerik özeti) aynı olmalı.
// Hangi dosyaların değişmesine izin verildiği her dersin commit öncesi kontrolünde ayrıca doğrulanır (burada sabit liste YOK).
const git0 = gitDurum();
console.log(`ORTAM: Firebase EMÜLATÖRÜ (gerçek Firebase DEĞİL) · proje ${PROJE} · firebase-tools ${CLI_SURUM} · firebase SDK ${SDK_SURUM} · Node ${process.version}`);
T('A0 [araç] tarayıcıya verilecek SDK uygulamanın kullandığı sürümle aynı (10.12.0 compat)', SDK_SURUM === SDK && ['app', 'firestore', 'auth'].every(m => fs.existsSync(path.join(SDK_DIR, `firebase-${m}-compat.js`))), SDK_SURUM);
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
T('A0 [uygulama] index.html değiştirilmeden kullanılıyor: SDK 10.12.0 compat, gerçek proje kimliği yapılandırmada (test onu SDK\'ya hiç vermeyecek)', INDEX.includes(`firebasejs/${SDK}/firebase-firestore-compat.js`) && INDEX.includes(`projectId: "${GERCEK_PROJE}"`));

// ---------- emülatör ----------
const bosPort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const acikMi = (port) => new Promise(r => { const c = net.connect({ host: '127.0.0.1', port }); c.once('connect', () => { c.destroy(); r(true); }); c.once('error', () => r(false)); });
const P = { firestore: await bosPort(), auth: await bosPort(), hub: await bosPort(), logging: await bosPort(), ws: await bosPort() };
const GECICI = fs.mkdtempSync(path.join(os.tmpdir(), 'iq-emu-')), EV = path.join(GECICI, 'ev');
fs.mkdirSync(path.join(EV, '.cache/firebase'), { recursive: true });
const onbellek = path.join(os.homedir(), '.cache/firebase/emulators');
if (!fs.existsSync(onbellek)) dur('emülatör Java dosyası indirilmemiş (kurulum aşaması: firebase setup:emulators:firestore)');
fs.symlinkSync(onbellek, path.join(EV, '.cache/firebase/emulators')); // yalnız emülatör dosyası; oturum / kimlik bilgisi YOK
fs.writeFileSync(path.join(GECICI, 'test.rules'), `rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
  match /emulator_test/{id} { allow read, write: if true; }   // yalnız sahte test belgesi
  match /{document=**} { allow read, write: if false; }       // işletme yolları dahil her şey KAPALI
} }
`);
fs.writeFileSync(path.join(GECICI, 'firebase.json'), JSON.stringify({ firestore: { rules: 'test.rules' },
  emulators: { firestore: { host: '127.0.0.1', port: P.firestore, websocketPort: P.ws }, auth: { host: '127.0.0.1', port: P.auth }, hub: { host: '127.0.0.1', port: P.hub }, logging: { host: '127.0.0.1', port: P.logging }, ui: { enabled: false }, singleProjectMode: true } }, null, 2));
const OLU = 'http://127.0.0.1:9'; // dış ağa çıkmak isteyen her şey ölü vekile gider
const env = { PATH: process.env.PATH, HOME: EV, XDG_CONFIG_HOME: path.join(EV, '.config'), CLOUDSDK_CONFIG: path.join(EV, 'gcloud'), NO_UPDATE_NOTIFIER: '1', CI: '1',
  HTTP_PROXY: OLU, HTTPS_PROXY: OLU, http_proxy: OLU, https_proxy: OLU, NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1',
  JAVA_TOOL_OPTIONS: '-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=9 -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=9 -Dhttp.nonProxyHosts=localhost|127.0.0.1' };
T('A1 [süreç] emülatör ortamında gerçek kimlik bilgisi yok (boş ana klasör; GOOGLE_* / FIREBASE_TOKEN aktarılmadı)', !Object.keys(env).some(k => /^GOOGLE_|FIREBASE_TOKEN|GCLOUD/.test(k)) && !fs.existsSync(path.join(EV, '.config')));
let emuCikti = '';
const emu = spawn(path.join(EMU, 'node_modules/.bin/firebase'), ['emulators:start', '--only', 'firestore,auth', '--project', PROJE, '--config', path.join(GECICI, 'firebase.json')], { cwd: GECICI, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
emu.stdout.on('data', d => { emuCikti += d; }); emu.stderr.on('data', d => { emuCikti += d; });
let emuBitti = null; emu.on('exit', (c, s) => { emuBitti = { c, s }; });
let hazir = false; for (let i = 0; i < 120 && !emuBitti; i++) { if (/All emulators ready/.test(emuCikti) && await acikMi(P.firestore) && await acikMi(P.auth)) { hazir = true; break; } await bekle(500); }
const emuDurdur = async () => { if (emuBitti) return; try { process.kill(-emu.pid, 'SIGINT'); } catch (e) { /* zaten kapalı */ }
  for (let i = 0; i < 60 && !emuBitti; i++) await bekle(500); if (!emuBitti) { try { process.kill(-emu.pid, 'SIGKILL'); } catch (e) { /* zaten kapalı */ } await bekle(1000); } };
if (!hazir) { console.log(emuCikti.slice(-1500)); await emuDurdur(); dur('emülatör başlatılamadı'); }
T('A2 [emülatör] Firestore ve Auth emülatörleri yalnız 127.0.0.1 üzerinde başladı', hazir && /127\.0\.0\.1/.test(emuCikti), emuCikti.slice(-400));
const yerelGet = (port, yol, yontem = 'GET', govde) => new Promise((ok, no) => { const q = http.request({ host: '127.0.0.1', port, path: yol, method: yontem, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => ok({ s: r.statusCode, b })); }); q.on('error', no); if (govde) q.write(govde); q.end(); });
const hub = JSON.parse((await yerelGet(P.hub, '/emulators')).b);
T('A2 [emülatör] emülatör merkezi: Firestore ve Auth 127.0.0.1, başka emülatör yok', hub.firestore && hub.firestore.host === '127.0.0.1' && hub.firestore.port === P.firestore && hub.auth && hub.auth.host === '127.0.0.1' && Object.keys(hub).filter(k => !['firestore', 'auth', 'hub', 'logging'].includes(k)).length === 0, hub);
T('A2 [proje] emülatör proje kimliği demo-iqbasics-test (tek proje kipi)', new RegExp(PROJE).test(emuCikti) && !emuCikti.includes(GERCEK_PROJE), emuCikti.match(/project[^\n]*/gi));

// ---------- uygulama sunucusu ----------
const srv = http.createServer((req, res) => { const y = decodeURIComponent(req.url.split('?')[0]);
  if (y.includes('sw.js')) { res.writeHead(404); return res.end(); }
  if (y === '/bos') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>boş</title>boş'); }
  const p = path.join(ROOT, y === '/' ? 'index.html' : y); if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': /\.m?js$/.test(p) ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end(); } }).listen(0, '127.0.0.1');
await new Promise(r => srv.once('listening', r)); const U = `http://127.0.0.1:${srv.address().port}`;

// ---------- tarayıcı: yeni boş profil + ağ yalıtımı ----------
const br = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1'], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const ctx = await br.newContext({ serviceWorkers: 'block' }); // kalıcı OLMAYAN yeni profil
const istekler = [], engellenen = [], yerelVerilen = [];
await ctx.route('**/*', r => { const u = new URL(r.request().url());
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') { istekler.push(u.href); return r.continue(); }
  const m = u.hostname === 'www.gstatic.com' && u.pathname.match(new RegExp(`^/firebasejs/${SDK.replace(/\./g, '\\.')}/(firebase-(app|firestore|auth|storage)-compat\\.js)$`));
  if (m) { yerelVerilen.push(u.href); return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(SDK_DIR, m[1])) }); }
  engellenen.push(u.href); return r.abort('blockedbyclient'); });
const page = await ctx.newPage(); const hatalar = []; page.on('pageerror', e => hatalar.push(e.message));
await page.goto(U + '/bos');
const bos = await page.evaluate(async () => ({ ls: localStorage.length, idb: ((await indexedDB.databases()) || []).length, cerez: document.cookie }));
T('A3 [profil] yeni ve BOŞ tarayıcı profili: localStorage 0, IndexedDB 0, çerez yok (mevcut kullanıcı depoları kullanılmıyor)', bos.ls === 0 && bos.idb === 0 && !bos.cerez && (await ctx.cookies()).length === 0, bos);
const disDeneme = await page.evaluate(async () => { try { await fetch('https://firestore.googleapis.com/v1/projects/x'); return 'GİTTİ'; } catch (e) { return 'engellendi'; } });
T('A3 [ağ] dış istek gerçekleşmeden ENGELLENDİ (deneme: firestore.googleapis.com)', disDeneme === 'engellendi' && engellenen.some(u => u.includes('firestore.googleapis.com')), { disDeneme, engellenen });
const dnsDeneme = await page.evaluate(async () => { try { await fetch('http://example.com/'); return 'GİTTİ'; } catch (e) { return 'engellendi'; } });
T('A3 [ağ] başka dış adres de engellendi (example.com)', dnsDeneme === 'engellendi', dnsDeneme);

// Uygulama sayfası yüklenmeden önce: initializeApp sarılır (gerçek yapılandırma SDK'ya verilmez) + emülatöre yönlendirme
await ctx.addInitScript(([PROJE, fsPort, authPort]) => {
  window.__emu = { denenen: null, kuruldu: false, hata: null, demo: { apiKey: 'demo-anahtar', authDomain: '127.0.0.1', projectId: PROJE, storageBucket: PROJE + '.appspot.com', appId: '1:000:web:demo' } };
  let fb; Object.defineProperty(window, 'firebase', { configurable: true, get() { return fb; }, set(v) { fb = v;
    if (v && typeof v.initializeApp === 'function' && !v.__emuSarildi) { const asil = v.initializeApp.bind(v); v.__emuSarildi = true;
      v.initializeApp = function (cfg) { window.__emu.denenen = cfg ? { projectId: cfg.projectId } : null;
        const app = asil(window.__emu.demo); // GERÇEK yapılandırma (cfg) SDK'ya HİÇ verilmez
        try { v.firestore().useEmulator('127.0.0.1', fsPort); v.auth().useEmulator('http://127.0.0.1:' + authPort, { disableWarnings: true }); window.__emu.kuruldu = true; }
        catch (e) { window.__emu.hata = String(e && e.message); throw new Error('emülatöre yönlendirme kurulamadı — başlatma durduruldu'); }
        return app; }; } } });
}, [PROJE, P.firestore, P.auth]);
await page.goto(U + '/'); await page.waitForFunction(() => window.kurtarmaDurumu && kurtarmaDurumu.durum === 'tamam' && typeof bulutBaslat === 'function', null, { timeout: 20000 });
// Not: uygulama Firebase'i AÇILIŞTA kendisi başlatıyor (bulutBaslat) — bu başlatma da sarmalayıcıdan geçmeli: tek uygulama, demo kimliği, emülatör kurulu
const ilk = await page.evaluate(() => ({ surum: window.firebase && firebase.SDK_VERSION, uygulama: firebase.apps.length, projeler: firebase.apps.map(a => a.options.projectId), emu: { denenen: window.__emu.denenen, kuruldu: window.__emu.kuruldu, hata: window.__emu.hata }, ornek: db.ornek, canli: typeof canliAcik !== 'undefined' && canliAcik }));
T('A4 [SDK] uygulama Firebase 10.12.0 compat SDK\'sını yükledi (yerel kopyadan); canlı senkron kapalı, veri yalnız örnek veri', ilk.surum === SDK && ilk.ornek === true && ilk.canli === false && yerelVerilen.length >= 3, { ilk, yerelVerilen });
T('A4 [açılış] uygulamanın AÇILIŞTAKİ her Firebase başlatması da sarmalayıcıdan geçti: tek uygulama, proje demo-iqbasics-test, emülatör yönlendirmesi kurulu (gerçek yapılandırma SDK\'ya verilmedi)', ilk.uygulama <= 1 && ilk.projeler.every(x => x === PROJE) && (ilk.uygulama === 0 || (ilk.emu.kuruldu === true && ilk.emu.denenen && ilk.emu.denenen.projectId === GERCEK_PROJE && !ilk.emu.hata)), ilk);
const bag = await page.evaluate(() => { const b = bulutBaslat(); const o = firebase.app().options; return { b, proje: o.projectId, anahtar: o.apiKey, emu: { ...window.__emu, demo: undefined }, auth: firebase.auth().emulatorConfig && { host: firebase.auth().emulatorConfig.host, port: firebase.auth().emulatorConfig.port } }; });
T('A5 [yönlendirme] uygulamanın kendi bulutBaslat() çağrısı: SDK yapılandırması demo-iqbasics-test (gerçek "iq-basics" denendi ama SDK\'ya VERİLMEDİ), emülatör yönlendirmesi kuruldu', bag.b === true && bag.proje === PROJE && bag.anahtar === 'demo-anahtar' && bag.emu.denenen && bag.emu.denenen.projectId === GERCEK_PROJE && bag.emu.kuruldu === true && !bag.emu.hata, bag);
T('A5 [yönlendirme] Auth emülatörü 127.0.0.1 üzerinde yapılandırıldı', bag.auth && bag.auth.host === '127.0.0.1' && bag.auth.port === P.auth, bag.auth);

// Yalnız sahte belge: yaz → sunucudan oku (uygulamanın _fb örneğiyle)
const isaret = 'sentetik-' + Math.random().toString(36).slice(2) + '-' + Date.now();
const yo = await page.evaluate(async (isaret) => { const ref = _fb.collection('emulator_test').doc('yalitim');
  try { await ref.set({ deger: isaret, sentetik: true }); const s = await ref.get({ source: 'server' }); return { ok: true, veri: s.data(), onbellek: s.metadata.fromCache, yol: ref.path }; }
  catch (e) { return { ok: false, hata: String(e && (e.code || e.message)) }; } }, isaret);
T('A6 [yaz/oku] sahte belge emulator_test/yalitim yazıldı ve SUNUCUDAN (önbellek değil) okundu; değer aynı', yo.ok && yo.veri && yo.veri.deger === isaret && yo.veri.sentetik === true && yo.onbellek === false && yo.yol === 'emulator_test/yalitim', yo);
const rest = await yerelGet(P.firestore, `/v1/projects/${PROJE}/databases/(default)/documents/emulator_test/yalitim`);
T('A6 [doğrulama] emülatörün kendi yerel arayüzünden okunan değer de aynı (proje demo-iqbasics-test)', rest.s === 200 && JSON.parse(rest.b).fields.deger.stringValue === isaret, rest);
const kok = await yerelGet(P.firestore, `/v1/projects/${PROJE}/databases/(default)/documents:listCollectionIds`, 'POST', '{}');
T('A6 [yalnız sahte] emülatörde yalnız "emulator_test" koleksiyonu var (işletme verisi yazılmadı)', kok.s === 200 && JSON.stringify(JSON.parse(kok.b).collectionIds || []) === '["emulator_test"]', kok.b);
const yasak = await page.evaluate(async () => { try { await _fb.collection('isletme').doc('iqbasics').get({ source: 'server' }); return 'OKUNDU'; } catch (e) { return String(e && e.code); } });
T('A6 [kurallar] test kuralları işletme yolunu kapatıyor (okuma reddedildi: permission-denied)', yasak === 'permission-denied', yasak);
const yerelDb = await page.evaluate(() => ({ ornek: db.ornek, canli: canliAcik }));
T('A7 [ERP] uygulamanın yerel verisi yalnız boş profilin örnek verisi; canlı senkron başlamadı', yerelDb.ornek === true && yerelDb.canli === false, yerelDb);

// Ağ denetimi: gerçekleşen her istek yalnız yerel; gerçek Firebase'e 0; gerçek proje kimliği hiçbir istekte yok
const disaGiden = istekler.filter(u => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u));
T('A8 [ağ] gerçekleşen bütün istekler yalnız localhost / 127.0.0.1 (' + istekler.length + ' istek)', disaGiden.length === 0 && istekler.length > 0, disaGiden);
T('A8 [ağ] gerçek Firebase / Google adreslerine GİDEN istek sayısı 0 (engellenenler gerçekleşmedi)', istekler.filter(u => GERCEK_FIREBASE.test(u)).length === 0, istekler.filter(u => GERCEK_FIREBASE.test(u)));
T('A8 [ağ] gerçek proje kimliği ("iq-basics") hiçbir istekte yok; emülatör istekleri demo projesine', !istekler.some(u => u.includes(GERCEK_PROJE)) && istekler.some(u => u.includes(String(P.firestore))), istekler.filter(u => u.includes(String(P.firestore))).slice(0, 3));
console.log('BİLGİ engellenen dış istekler: ' + JSON.stringify(engellenen) + ' · yerelden verilen SDK dosyası: ' + yerelVerilen.length);
T('A8 [altyapı] sayfa hatası yok', hatalar.length === 0, hatalar.slice(0, 3));

// ---------- kapanış ----------
await br.close(); srv.close();
await emuDurdur();
const portlar = await Promise.all(Object.values(P).map(acikMi));
T('A9 [kapanış] emülatör süreci kapandı ve bütün portları serbest', !!emuBitti && portlar.every(x => !x), { emuBitti, portlar });
fs.rmSync(GECICI, { recursive: true, force: true });
T('A9 [kalıcılık] geçici yapılandırma ve emülatör verisi silindi (dışa aktarma yok)', !fs.existsSync(GECICI));
const git1 = gitDurum();
T('A9 [depo] test depoda hiçbir yan etki bırakmadı: başlangıç ve bitişteki git durumu (durum, izlenmeyen dosyalar, içerik özeti) birebir aynı', JSON.stringify(git1) === JSON.stringify(git0), { git0, git1 });
console.log(`${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
