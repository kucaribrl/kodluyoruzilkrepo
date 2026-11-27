// Ders 50.3c-3b-2 — W1–W5 FIRESTORE waitForPendingWrites() ÖLÇÜMLERİ (yalnız YEREL emülatör; CI listesine GİRMEZ).
// Çalıştırma: IQ_EMU_DIR=<firebase-tools + firebase@10.12.0 geçici klasörü> node test/emulator/39b-yazim-bekleme.mjs   (IQ_TEKRAR=20 varsayılan)
// Yalıtım (39a ile aynı kurallar): yalnız "demo-iqbasics-test"; gerçek yapılandırma kullanılmaz (deney sayfası uygulamayı YÜKLEMEZ, yalnız
// Firebase 10.12.0 compat SDK'yı yerel kopyadan yükler); emülatör 127.0.0.1, boş geçici ana klasör, ölü dış vekil; tarayıcı yeni boş profil,
// DNS düzeyinde localhost dışı çözümsüz + localhost dışı her istek gerçekleşmeden engellenir; yalnız emulator_test/ yolları kullanılır.
// ÖLÇÜM KURALI: hipotez ve ölçüm AYRI raporlanır; hipotezin tutmaması "BEKLENTİ DIŞI" olarak raporlanır ve testi başarısız YAPMAZ.
// Test yalnız ölçüm düzeni bozulursa başarısızdır: yalıtım ihlali, eksik tekrar, temizlik / taşınma hatası, süreç kapanmaması.
import { spawn, execFileSync } from 'child_process'; import { createHash } from 'crypto'; import net from 'net'; import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url'; import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJE = 'demo-iqbasics-test', GERCEK_PROJE = 'iq-basics', SDK = '10.12.0', N = Math.max(20, +process.env.IQ_TEKRAR || 20);
const GERCEK_FIREBASE = /firestore\.googleapis\.com|firebaseio\.com|identitytoolkit|securetoken|firebaseapp\.com|googleapis\.com|firebase\.google\.com/;
const PENCERE = 2000, ZAMAN_ASIMI = 20000; // çevrimdışı gözlem penceresi; ağ açıldıktan sonra en çok bekleme
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 500) : '')); } };
const dur = (m) => { console.log('DUR: ' + m); console.log(`${ok} PASS, ${fail + 1} FAIL`); process.exit(1); };
const bekle = (ms) => new Promise(r => setTimeout(r, ms));
const EMU = process.env.IQ_EMU_DIR ? path.resolve(process.env.IQ_EMU_DIR) : null;
if (!EMU || !fs.existsSync(path.join(EMU, 'node_modules/.bin/firebase'))) dur('IQ_EMU_DIR ayarlı değil ya da firebase-tools kurulu değil (bkz. test/OKU.md)');
if (EMU === ROOT || EMU.startsWith(ROOT + path.sep)) dur('emülatör araçları depo İÇİNE kurulmamalı');
const SDK_DIR = path.join(EMU, 'node_modules/firebase');
if (JSON.parse(fs.readFileSync(path.join(SDK_DIR, 'package.json'), 'utf8')).version !== SDK) dur('SDK sürümü 10.12.0 değil');
const gitDurum = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).sort()
  .map(l => { const f = path.join(ROOT, l.slice(3)); let oz = '-'; try { if (fs.statSync(f).isFile()) oz = createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch (e) { oz = 'yok'; } return l + ' ' + oz; });
// Yalnız TESTİN KENDİ yan etkisi denetlenir: başlangıç ve bitişteki git durumu (durum kodu + izlenmeyen dosyalar + içerik özeti) aynı olmalı.
// Hangi dosyaların değişmesine izin verildiği her dersin commit öncesi kontrolünde ayrıca doğrulanır (burada sabit liste YOK).
const git0 = gitDurum();
console.log(`ORTAM: Firebase EMÜLATÖRÜ (gerçek Firebase DEĞİL) · proje ${PROJE} · SDK ${SDK} compat · tekrar ${N} · Node ${process.version}`);

// ---------- emülatör (39a ile aynı yalıtım) ----------
const bosPort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const acikMi = (port) => new Promise(r => { const c = net.connect({ host: '127.0.0.1', port }); c.once('connect', () => { c.destroy(); r(true); }); c.once('error', () => r(false)); });
const P = { firestore: await bosPort(), auth: await bosPort(), hub: await bosPort(), logging: await bosPort(), ws: await bosPort() };
const GECICI = fs.mkdtempSync(path.join(os.tmpdir(), 'iq-emu-')), EV = path.join(GECICI, 'ev');
fs.mkdirSync(path.join(EV, '.cache/firebase'), { recursive: true });
const onbellek = path.join(os.homedir(), '.cache/firebase/emulators'); if (!fs.existsSync(onbellek)) dur('emülatör Java dosyası indirilmemiş');
fs.symlinkSync(onbellek, path.join(EV, '.cache/firebase/emulators'));
fs.writeFileSync(path.join(GECICI, 'test.rules'), `rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
  match /emulator_test/{id} { allow read, write: if true; }
  match /{document=**} { allow read, write: if false; }
} }
`);
fs.writeFileSync(path.join(GECICI, 'firebase.json'), JSON.stringify({ firestore: { rules: 'test.rules' },
  emulators: { firestore: { host: '127.0.0.1', port: P.firestore, websocketPort: P.ws }, auth: { host: '127.0.0.1', port: P.auth }, hub: { host: '127.0.0.1', port: P.hub }, logging: { host: '127.0.0.1', port: P.logging }, ui: { enabled: false }, singleProjectMode: true } }));
const OLU = 'http://127.0.0.1:9';
const env = { PATH: process.env.PATH, HOME: EV, XDG_CONFIG_HOME: path.join(EV, '.config'), CLOUDSDK_CONFIG: path.join(EV, 'gcloud'), NO_UPDATE_NOTIFIER: '1', CI: '1',
  HTTP_PROXY: OLU, HTTPS_PROXY: OLU, http_proxy: OLU, https_proxy: OLU, NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1',
  JAVA_TOOL_OPTIONS: '-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=9 -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=9 -Dhttp.nonProxyHosts=localhost|127.0.0.1' };
let emuCikti = '', emuBitti = null;
const emu = spawn(path.join(EMU, 'node_modules/.bin/firebase'), ['emulators:start', '--only', 'firestore,auth', '--project', PROJE, '--config', path.join(GECICI, 'firebase.json')], { cwd: GECICI, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
emu.stdout.on('data', d => { emuCikti += d; }); emu.stderr.on('data', d => { emuCikti += d; }); emu.on('exit', (c, s) => { emuBitti = { c, s }; });
const emuDurdur = async () => { if (emuBitti) return; try { process.kill(-emu.pid, 'SIGINT'); } catch (e) { /* kapalı */ } for (let i = 0; i < 60 && !emuBitti; i++) await bekle(500); if (!emuBitti) { try { process.kill(-emu.pid, 'SIGKILL'); } catch (e) { /* kapalı */ } await bekle(1000); } };
let hazir = false; for (let i = 0; i < 120 && !emuBitti; i++) { if (/All emulators ready/.test(emuCikti) && await acikMi(P.firestore)) { hazir = true; break; } await bekle(500); }
if (!hazir) { console.log(emuCikti.slice(-1500)); await emuDurdur(); dur('emülatör başlatılamadı'); }
T('Y0 [yalıtım] emülatör yalnız 127.0.0.1 üzerinde, proje demo-iqbasics-test, gerçek proje kimliği yok', /127\.0\.0\.1/.test(emuCikti) && emuCikti.includes(PROJE) && !emuCikti.includes(GERCEK_PROJE));
const yerel = (yol, yontem = 'GET', govde) => new Promise((ok, no) => { const q = http.request({ host: '127.0.0.1', port: P.firestore, path: yol, method: yontem, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => ok({ s: r.statusCode, b })); }); q.on('error', no); if (govde) q.write(govde); q.end(); });
const DOK = `/v1/projects/${PROJE}/databases/(default)/documents`;
const temizle = async () => (await yerel(`/emulator/v1/projects/${PROJE}/databases/(default)/documents`, 'DELETE')).s === 200;
const belgeler = async () => { const r = await yerel(`${DOK}/emulator_test?pageSize=300`); return r.s === 200 ? (JSON.parse(r.b).documents || []).map(d => d.name.split('/').pop()) : null; };
const belgeVar = async (id) => (await yerel(`${DOK}/emulator_test/${id}`)).s === 200;

// ---------- deney sayfası sunucusu (uygulama YOK; yalnız yerel SDK) ----------
const DENEY = `<!doctype html><meta charset="utf-8"><title>deney</title>
<script src="/sdk/firebase-app-compat.js"></script><script src="/sdk/firebase-firestore-compat.js"></script>`;
const srv = http.createServer((req, res) => { const y = req.url.split('?')[0];
  if (y === '/deney') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(DENEY); }
  const m = y.match(/^\/sdk\/(firebase-(app|firestore)-compat\.js)$/); if (m) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(SDK_DIR, m[1]))); }
  res.writeHead(404); res.end(); }).listen(0, '127.0.0.1');
await new Promise(r => srv.once('listening', r)); const U = `http://127.0.0.1:${srv.address().port}`;

// ---------- tarayıcı: her cihaz = yeni boş profil; ağ yalıtımı; emülatör bağlantısını kesme anahtarı ----------
const br = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1'], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const AG = { gecen: [], engellenen: [] };
async function cihaz({ idbYok = false } = {}) {
  const ctx = await br.newContext({ serviceWorkers: 'block' }); const d = { ctx, emuKesik: false, hatalar: [] };
  await ctx.route('**/*', r => { const u = new URL(r.request().url());
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') { AG.engellenen.push(u.href); return r.abort('blockedbyclient'); }
    if (d.emuKesik && u.port === String(P.firestore)) return r.abort('connectionrefused'); // cihazın ağı "koptu" (yalnız emülatör trafiği)
    AG.gecen.push(u.href); return r.continue(); });
  if (idbYok) await ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
  d.yeniSekme = async () => { const p = await ctx.newPage(); p.on('pageerror', e => d.hatalar.push(e.message)); await p.goto(U + '/deney'); return p; };
  return d; }
// Sayfa içi: SDK'yı demo projesiyle başlat, emülatöre bağla; isteğe bağlı kalıcılık. Sözler (promise) zaman damgasıyla izlenir.
const KUR = ([PROJE, port, kalici]) => (async () => { const t = () => performance.now();
  const app = firebase.initializeApp({ apiKey: 'demo-anahtar', projectId: PROJE, appId: '1:000:web:demo' }); const fs = firebase.firestore(); fs.useEmulator('127.0.0.1', port);
  let kalicilik = 'kapalı'; if (kalici) { try { await fs.enablePersistence(kalici === 'sekmeler' ? { synchronizeTabs: true } : undefined); kalicilik = 'açık'; } catch (e) { kalicilik = 'HATA:' + (e.code || e.name) + ':' + String(e.message).slice(0, 140); } }
  window.__d = { app, fs, t, izler: {}, kalicilik,
    izle(ad, p) { const k = this.izler[ad] = { bas: t(), son: null, hata: null }; p.then(() => { k.son = t(); }, e => { k.son = t(); k.hata = String(e && (e.code || e.message)); }); },
    durum(ad) { const k = this.izler[ad]; return k ? { bitti: k.son !== null, sure: k.son !== null ? k.son - k.bas : null, hata: k.hata, gecen: t() - k.bas } : null; } };
  if (window.__d.kalicilik.startsWith('HATA') === false) await fs.collection('emulator_test').doc('_isinma_' + Math.random().toString(36).slice(2)).get({ source: 'cache' }).catch(() => null);
  return window.__d.kalicilik; })();
const kur = (p, kalici) => p.evaluate(KUR, [PROJE, P.firestore, kalici]);
const yaz = (p, id, iz) => p.evaluate(([id, iz]) => { window.__d.izle(iz, window.__d.fs.collection('emulator_test').doc(id).set({ sentetik: true, id, t: Date.now() })); }, [id, iz]);
const wpw = (p, iz) => p.evaluate((iz) => { window.__d.izle(iz, window.__d.fs.waitForPendingWrites()); }, iz);
const durum = (p, iz) => p.evaluate((iz) => window.__d.durum(iz), iz);
const ag = (p, acik) => p.evaluate((acik) => (acik ? window.__d.fs.enableNetwork() : window.__d.fs.disableNetwork()), acik);
const bekleBitsin = async (p, iz, ms) => { const s = Date.now(); for (;;) { const d = await durum(p, iz); if (d && d.bitti) return d; if (Date.now() - s > ms) return { ...d, zamanAsimi: true }; await bekle(25); } };
const kapat = async (d) => { for (const p of d.ctx.pages()) { try { await p.evaluate(() => window.__d && window.__d.app.delete()); } catch (e) { /* sayfa kapalı */ } } await d.ctx.close(); };

// ---------- ölçüm kaydı ----------
const SONUC = {};
const ist = (a) => { const s = a.filter(x => typeof x === 'number').sort((x, y) => x - y); if (!s.length) return '—'; const m = s[Math.floor((s.length - 1) / 2)]; return `en az ${s[0].toFixed(0)} · ortanca ${m.toFixed(0)} · en çok ${s[s.length - 1].toFixed(0)} ms (n=${s.length})`; };
async function deney(kod, ad, hipotez, tek) {
  const kayit = { kod, ad, hipotez, tekrar: [], sinif: { HIPOTEZE_UYDU: 0, BEKLENTI_DISI: 0, ZAMAN_ASIMI: 0, SDK_HATASI: 0 }, tasinma: 0, sure: {} };
  for (let i = 0; i < N; i++) {
    if (!(await temizle())) dur(kod + ': emülatör temizlenemedi');
    const once = await belgeler(); if (!once || once.length) { kayit.tasinma++; }
    let r; try { r = await tek(i); } catch (e) { r = { sinif: 'SDK_HATASI', not: String(e && e.message).slice(0, 200) }; }
    kayit.sinif[r.sinif] = (kayit.sinif[r.sinif] || 0) + 1; kayit.tekrar.push(r);
    for (const [k, v] of Object.entries(r.sure || {})) (kayit.sure[k] = kayit.sure[k] || []).push(v);
  }
  if (!(await temizle()) || (await belgeler()).length) kayit.tasinma++;
  SONUC[kod] = kayit;
  console.log(`\n=== ${kod} — ${ad}\n    HİPOTEZ : ${hipotez}`);
  console.log(`    ÖLÇÜLEN : ${Object.entries(kayit.sinif).map(([k, v]) => k + '=' + v).join(' · ')}`);
  for (const [k, v] of Object.entries(kayit.sure)) console.log(`    SÜRE ${k}: ${ist(v)}`);
  const notlar = [...new Set(kayit.tekrar.map(r => r.not).filter(Boolean))]; if (notlar.length) console.log('    NOTLAR  : ' + notlar.slice(0, 6).join(' | '));
  const uydu = kayit.sinif.HIPOTEZE_UYDU === N;
  console.log(`    SONUÇ   : ${uydu ? 'hipotez ' + N + '/' + N + ' tekrarda TUTTU' : 'BEKLENTİ DIŞI / tutarsız — ' + (N - kayit.sinif.HIPOTEZE_UYDU) + ' tekrarda hipotez tutmadı (rapor edilir, test sonucunu değiştirmez)'}`);
  T(`${kod} [ölçüm] ${N} tekrar tamamlandı ve sınıflandırıldı (her tekrar öncesi emülatör boş, sonraki tekrara taşınan yazım yok)`, kayit.tekrar.length === N && kayit.tasinma === 0, { tasinma: kayit.tasinma });
  return kayit;
}

// W1 — tek sekme, çevrimiçi
await deney('W1', 'tek sekme, çevrimiçi', 'waitForPendingWrites yazım sunucuca onaylanınca tamamlanır; tamamlandığında belge emülatörde vardır', async (i) => {
  const d = await cihaz(); const p = await d.yeniSekme(); await kur(p, 'sekmeler'); const id = 'w1-' + i;
  await yaz(p, id, 'set'); await wpw(p, 'w'); const w = await bekleBitsin(p, 'w', ZAMAN_ASIMI); const s = await bekleBitsin(p, 'set', 2000); const var_ = await belgeVar(id);
  await kapat(d); if (w.zamanAsimi) return { sinif: 'ZAMAN_ASIMI' }; if (w.hata) return { sinif: 'SDK_HATASI', not: w.hata };
  return { sinif: var_ ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: var_ ? null : 'bekleme bitti ama belge sunucuda yok', sure: { 'waitForPendingWrites': w.sure, 'set() sözü': s.sure } }; });

// W2 — tek sekme, çevrimdışı (SDK ile ağ kapalı)
await deney('W2', 'tek sekme, çevrimdışı (disableNetwork)', `ağ kapalıyken ${PENCERE} ms içinde TAMAMLANMAZ ve belge sunucuda yoktur; ağ açılınca tamamlanır ve belge sunucuda vardır`, async (i) => {
  const d = await cihaz(); const p = await d.yeniSekme(); await kur(p, 'sekmeler'); const id = 'w2-' + i;
  await ag(p, false); await yaz(p, id, 'set'); await wpw(p, 'w'); await bekle(PENCERE); const ara = await durum(p, 'w'); const araVar = await belgeVar(id);
  const t0 = Date.now(); await ag(p, true); const w = await bekleBitsin(p, 'w', ZAMAN_ASIMI); const acildiktan = Date.now() - t0; const sonVar = await belgeVar(id);
  await kapat(d); if (w.zamanAsimi) return { sinif: 'ZAMAN_ASIMI', not: 'ağ açıldıktan sonra da bitmedi' }; if (w.hata) return { sinif: 'SDK_HATASI', not: w.hata };
  const uydu = !ara.bitti && !araVar && sonVar; return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: uydu ? null : JSON.stringify({ araBitti: ara.bitti, araVar, sonVar }), sure: { 'ağ açıldıktan sonra tamamlanma': acildiktan } }; });

// W3 — iki sekme, aynı cihaz (kalıcılık + synchronizeTabs); cihazın emülatör bağlantısı kopuk
await deney('W3', 'iki sekme, aynı cihaz (IndexedDB kalıcılık + synchronizeTabs)', `A'nın yazımı bekliyorken B'nin waitForPendingWrites çağrısı da ${PENCERE} ms içinde TAMAMLANMAZ (A'nın yazımını bekler) — BELİRSİZ, ölçülüyor`, async (i) => {
  const d = await cihaz(); const A = await d.yeniSekme(), B = await d.yeniSekme(); const ka = await kur(A, 'sekmeler'), kb = await kur(B, 'sekmeler'); const id = 'w3-' + i;
  d.emuKesik = true; await yaz(A, id, 'set'); await wpw(A, 'wa'); await wpw(B, 'wb'); await bekle(PENCERE);
  const a = await durum(A, 'wa'), b = await durum(B, 'wb'), araVar = await belgeVar(id);
  const t0 = Date.now(); d.emuKesik = false; const wa = await bekleBitsin(A, 'wa', ZAMAN_ASIMI); const sa = Date.now() - t0; const wb = b.bitti ? b : await bekleBitsin(B, 'wb', ZAMAN_ASIMI); const sonVar = await belgeVar(id);
  await kapat(d);
  if (!ka.startsWith('açık') || !kb.startsWith('açık')) return { sinif: 'SDK_HATASI', not: 'kalıcılık açılamadı: ' + ka + ' / ' + kb };
  if (wa.zamanAsimi || (wb && wb.zamanAsimi)) return { sinif: 'ZAMAN_ASIMI', not: JSON.stringify({ wa: wa.zamanAsimi, wb: wb && wb.zamanAsimi }) };
  const uydu = !a.bitti && !b.bitti && !araVar && sonVar;
  return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: `A bekleme ${a.bitti ? 'BİTTİ' : 'bekliyor'} · B bekleme ${b.bitti ? 'BİTTİ (' + (b.sure || 0).toFixed(0) + ' ms, A\'nın yazımı sunucuda ' + (araVar ? 'var' : 'YOK') + ')' : 'bekliyor'}`,
    sure: { "B'nin waitForPendingWrites (kopukken)": b.bitti ? b.sure : undefined, 'bağlantı geldikten sonra A tamamlanma': sa } }; });

// W3k — W3'ün KONTROLÜ (yeni deney değil): aynı düzen, bağlantı kopuk, ama HİÇ yazım yok → B'nin beklemesi yalnız yazım yüzünden mi sürüyor?
await deney('W3k', "W3 kontrolü — iki sekme, bağlantı kopuk, bekleyen yazım YOK", "bekleyen yazım yokken B'nin waitForPendingWrites çağrısı bağlantı kopuk olsa da hemen tamamlanır (W3'teki bekleme A'nın yazımından kaynaklanır)", async (i) => {
  const d = await cihaz(); const A = await d.yeniSekme(), B = await d.yeniSekme(); const ka = await kur(A, 'sekmeler'), kb = await kur(B, 'sekmeler');
  d.emuKesik = true; await wpw(B, 'wb'); const b = await bekleBitsin(B, 'wb', PENCERE); d.emuKesik = false; await kapat(d);
  if (!ka.startsWith('açık') || !kb.startsWith('açık')) return { sinif: 'SDK_HATASI', not: 'kalıcılık açılamadı: ' + ka + ' / ' + kb };
  if (b.hata) return { sinif: 'SDK_HATASI', not: b.hata };
  return { sinif: b.bitti ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: b.bitti ? null : 'yazım yokken de bekledi', sure: { "B'nin waitForPendingWrites (yazım yok, kopuk)": b.bitti ? b.sure : undefined } }; });

// W4 — iki ayrı cihaz (ayrı boş profiller)
await deney('W4', 'iki ayrı cihaz (ayrı boş profiller)', "A çevrimdışı yazım bekletirken B'nin waitForPendingWrites çağrısı hemen tamamlanır; A'nın yazımı sunucuda YOKTUR (B'nin \"onaylandı\" demesi A'yı kapsamaz)", async (i) => {
  const dA = await cihaz(), dB = await cihaz(); const A = await dA.yeniSekme(), B = await dB.yeniSekme(); await kur(A, 'sekmeler'); await kur(B, 'sekmeler'); const id = 'w4-' + i;
  await ag(A, false); await yaz(A, id, 'set'); await wpw(A, 'wa'); await wpw(B, 'wb'); const b = await bekleBitsin(B, 'wb', ZAMAN_ASIMI); const araVar = await belgeVar(id); const a = await durum(A, 'wa');
  await ag(A, true); const wa = await bekleBitsin(A, 'wa', ZAMAN_ASIMI); const sonVar = await belgeVar(id);
  await kapat(dA); await kapat(dB);
  if (b.zamanAsimi || wa.zamanAsimi) return { sinif: 'ZAMAN_ASIMI' }; if (b.hata) return { sinif: 'SDK_HATASI', not: b.hata };
  const uydu = b.bitti && !araVar && !a.bitti && sonVar; return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: uydu ? null : JSON.stringify({ bBitti: b.bitti, araVar, aBitti: a.bitti, sonVar }), sure: { "B'nin waitForPendingWrites": b.sure } }; });

// W5 — kalıcılık kurulamadı: (a) ikinci sekme synchronizeTabs olmadan (failed-precondition), (b) IndexedDB yok (unimplemented)
for (const [kod, ad, yontem] of [['W5a', 'kalıcılık başarısız — aynı cihazda ikinci sekme, synchronizeTabs YOK', 'sekme'], ['W5b', 'kalıcılık başarısız — tarayıcıda IndexedDB yok', 'idb']])
  await deney(kod, ad, 'kalıcılık hatası yakalanır, SDK bellek önbelleğiyle çalışmaya devam eder; waitForPendingWrites çevrimiçi tamamlanır, çevrimdışı tamamlanmaz (W1/W2 ile aynı); sekme kapandığında çevrimdışı yazım sunucuya ULAŞMAMIŞTIR (yeniden açılışta gönderilip gönderilmediği burada ölçülmez — O2)', async (i) => {
    const d = await cihaz({ idbYok: yontem === 'idb' }); let ilk = null; if (yontem === 'sekme') { ilk = await d.yeniSekme(); await kur(ilk, 'tek'); }
    const p = await d.yeniSekme(); const kal = await kur(p, 'tek'); const id = kod.toLowerCase() + '-' + i;
    await yaz(p, id + '-c', 'set1'); await wpw(p, 'w1'); const w1 = await bekleBitsin(p, 'w1', ZAMAN_ASIMI); const v1 = await belgeVar(id + '-c');
    await ag(p, false); await yaz(p, id + '-o', 'set2'); await wpw(p, 'w2'); await bekle(PENCERE); const w2 = await durum(p, 'w2'); const v2 = await belgeVar(id + '-o');
    await p.close(); if (ilk) await ilk.close(); await bekle(300); const kayboldu = !(await belgeVar(id + '-o')); await d.ctx.close();
    const hata = kal.startsWith('HATA') ? kal : null;
    if (w1.zamanAsimi) return { sinif: 'ZAMAN_ASIMI', not: 'çevrimiçi bekleme bitmedi · ' + kal };
    const uydu = !!hata && w1.bitti && !w1.hata && v1 && !w2.bitti && !v2 && kayboldu;
    return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: (hata || 'kalıcılık AÇILDI (hata üretilemedi)') + (uydu ? '' : ' · ' + JSON.stringify({ w1: w1.bitti, v1, w2: w2.bitti, v2, kayboldu })), sure: { 'çevrimiçi waitForPendingWrites': w1.sure } }; });

// ---------- özet, yalıtım kanıtı, kapanış ----------
console.log('\n=== ÖZET (hipotez ↔ ölçüm)');
for (const k of Object.values(SONUC)) console.log(`${k.kod.padEnd(4)} ${String(k.sinif.HIPOTEZE_UYDU).padStart(2)}/${N} uydu · beklenti dışı ${k.sinif.BEKLENTI_DISI} · zaman aşımı ${k.sinif.ZAMAN_ASIMI} · SDK hatası ${k.sinif.SDK_HATASI} — ${k.ad}`);
const disaGiden = AG.gecen.filter(u => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u));
T('Y1 [ağ] gerçekleşen bütün istekler yalnız localhost / 127.0.0.1 (' + AG.gecen.length + ' istek)', disaGiden.length === 0 && AG.gecen.length > 0, disaGiden.slice(0, 3));
T('Y1 [ağ] gerçek Firebase / Google adreslerine GİDEN istek sayısı 0', AG.gecen.filter(u => GERCEK_FIREBASE.test(u)).length === 0);
T('Y1 [ağ] gerçek proje kimliği hiçbir istekte yok; emülatör istekleri demo projesine', !AG.gecen.some(u => u.includes(GERCEK_PROJE)) && AG.gecen.some(u => u.includes(String(P.firestore))));
console.log('BİLGİ engellenen dış istek: ' + AG.engellenen.length + (AG.engellenen.length ? ' ' + JSON.stringify([...new Set(AG.engellenen)].slice(0, 5)) : ''));
const sonBelge = await belgeler(), koleks = JSON.parse((await yerel(`${DOK}:listCollectionIds`, 'POST', '{}')).b).collectionIds || [];
T('Y2 [veri] emülatörde yalnız emulator_test kullanıldı ve deney sonunda boş', JSON.stringify(sonBelge) === '[]' && koleks.every(c => c === 'emulator_test'), { sonBelge, koleks });
T('Y2 [süreç] açık tarayıcı bağlamı kalmadı', br.contexts().length === 0, br.contexts().length);
await br.close(); srv.close(); await emuDurdur();
const portlar = await Promise.all(Object.values(P).map(acikMi));
T('Y3 [kapanış] emülatör süreci kapandı, bütün portlar serbest', !!emuBitti && portlar.every(x => !x), { emuBitti, portlar });
fs.rmSync(GECICI, { recursive: true, force: true });
T('Y3 [kalıcılık] geçici yapılandırma ve emülatör verisi silindi', !fs.existsSync(GECICI));
const git1 = gitDurum();
T('Y3 [depo] deney depoda hiçbir yan etki bırakmadı: başlangıç ve bitişteki git durumu (durum, izlenmeyen dosyalar, içerik özeti) birebir aynı', JSON.stringify(git1) === JSON.stringify(git0), { git0, git1 });
console.log(`${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
