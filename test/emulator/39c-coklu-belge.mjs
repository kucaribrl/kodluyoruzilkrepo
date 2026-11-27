// Ders 50.3c-3b-3 — P1–P3 SEKİZ BAĞIMSIZ BELGE YAZIMI: tutarlılık, kısmi başarısızlık, bağlantı kopması (yalnız YEREL emülatör; CI'ya GİRMEZ).
// Çalıştırma: IQ_EMU_DIR=<firebase-tools + firebase@10.12.0 geçici klasörü> node test/emulator/39c-coklu-belge.mjs   (IQ_TEKRAR=20 varsayılan, en az 20)
// Ölçülen model: uygulamanın canliYazHemen davranışı — 8 domen belgesi için BAĞIMSIZ, paralel set() çağrıları (batch / transaction DEĞİL).
// Yalıtım (39a/39b ile aynı): yalnız "demo-iqbasics-test"; deney sayfası uygulamayı YÜKLEMEZ, yalnız yerel Firebase 10.12.0 compat SDK;
// emülatör 127.0.0.1, boş geçici ana klasör, ölü dış vekil; tarayıcı yeni boş profil, DNS düzeyinde localhost dışı çözümsüz + localhost dışı
// her istek gerçekleşmeden engellenir; yalnız emulator_test/ yolları. Sunucu durumu YALNIZ emülatörün yerel arayüzünden okunur.
// Hata enjeksiyonu açıkça etiketlenir: [Firestore tarafı] test kuralı yazımı reddeder · [Firestore tarafı] belge boyut sınırı ·
// [SDK, ağdan önce] geçersiz değer — SDK isteği göndermeden reddeder · [ağ seviyesi] tarayıcı çevrimdışı öykünmesi (localhost dahil bütün istekler düşer).
// ÖLÇÜM KURALI: hipotez ve ölçüm AYRI raporlanır; hipotezin tutmaması "BEKLENTİ DIŞI" olarak yazılır ve testi başarısız YAPMAZ.
// Test yalnız ölçüm düzeni bozulursa başarısızdır: yalıtım ihlali, eksik tekrar, temizlik / taşınma hatası, süreç kapanmaması, depoda yan etki.
import { spawn, execFileSync } from 'child_process'; import { createHash } from 'crypto'; import net from 'net'; import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url'; import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJE = 'demo-iqbasics-test', GERCEK_PROJE = 'iq-basics', SDK = '10.12.0', N = Math.max(20, +process.env.IQ_TEKRAR || 20);
const GERCEK_FIREBASE = /firestore\.googleapis\.com|firebaseio\.com|identitytoolkit|securetoken|firebaseapp\.com|googleapis\.com|firebase\.google\.com/;
const DOMEN = ['stok', 'cari', 'kasa', 'satis', 'cek', 'uretim', 'ayar', 'yonetim']; // uygulamanın 8 domeni (yalnız ADLAR; içerik sentetik)
const PENCERE = 2000, ZAMAN_ASIMI = 20000;
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 500) : '')); } };
const dur = (m) => { console.log('DUR: ' + m); console.log(`${ok} PASS, ${fail + 1} FAIL`); process.exit(1); };
const bekle = (ms) => new Promise(r => setTimeout(r, ms));
const EMU = process.env.IQ_EMU_DIR ? path.resolve(process.env.IQ_EMU_DIR) : null;
if (!EMU || !fs.existsSync(path.join(EMU, 'node_modules/.bin/firebase'))) dur('IQ_EMU_DIR ayarlı değil ya da firebase-tools kurulu değil (bkz. test/OKU.md)');
if (EMU === ROOT || EMU.startsWith(ROOT + path.sep)) dur('emülatör araçları depo İÇİNE kurulmamalı');
const SDK_DIR = path.join(EMU, 'node_modules/firebase');
if (JSON.parse(fs.readFileSync(path.join(SDK_DIR, 'package.json'), 'utf8')).version !== SDK) dur('SDK sürümü 10.12.0 değil');
// Yalnız TESTİN KENDİ yan etkisi denetlenir: başlangıç ve bitişteki git durumu (durum kodu + izlenmeyen dosyalar + içerik özeti) aynı olmalı.
const gitDurum = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean).sort()
  .map(l => { const f = path.join(ROOT, l.slice(3)); let oz = '-'; try { if (fs.statSync(f).isFile()) oz = createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch (e) { oz = 'yok'; } return l + ' ' + oz; });
const git0 = gitDurum();
console.log(`ORTAM: Firebase EMÜLATÖRÜ (gerçek Firebase DEĞİL) · proje ${PROJE} · SDK ${SDK} compat · tekrar ${N} · Node ${process.version}`);

// ---------- emülatör (39a/39b ile aynı yalıtım; test kuralı: adı _RED ile biten belgeye yazım REDDEDİLİR) ----------
const bosPort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const acikMi = (port) => new Promise(r => { const c = net.connect({ host: '127.0.0.1', port }); c.once('connect', () => { c.destroy(); r(true); }); c.once('error', () => r(false)); });
const P = { firestore: await bosPort(), auth: await bosPort(), hub: await bosPort(), logging: await bosPort(), ws: await bosPort() };
const GECICI = fs.mkdtempSync(path.join(os.tmpdir(), 'iq-emu-')), EV = path.join(GECICI, 'ev');
fs.mkdirSync(path.join(EV, '.cache/firebase'), { recursive: true });
const onbellek = path.join(os.homedir(), '.cache/firebase/emulators'); if (!fs.existsSync(onbellek)) dur('emülatör Java dosyası indirilmemiş');
fs.symlinkSync(onbellek, path.join(EV, '.cache/firebase/emulators'));
fs.writeFileSync(path.join(GECICI, 'test.rules'), `rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
  match /emulator_test/{id} { allow read: if true; allow write: if !id.matches('.*_RED$'); }   // kontrollü Firestore tarafı ret
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
const belgeler = async () => { const r = await yerel(`${DOK}/emulator_test?pageSize=300&mask.fieldPaths=surum`); return r.s === 200 ? (JSON.parse(r.b).documents || []).map(d => d.name.split('/').pop()) : null; };
// Sunucudaki 8 belgenin durumu (yalnız emülatörden): yok / var (sürüm işaretiyle)
const sunucu = async (ids) => Promise.all(ids.map(async id => { const r = await yerel(`${DOK}/emulator_test/${id}?mask.fieldPaths=surum`); return r.s === 200 ? ((JSON.parse(r.b).fields || {}).surum || {}).stringValue || '?' : null; }));

// ---------- deney sayfası (uygulama YOK; yalnız yerel SDK) ----------
const DENEY = `<!doctype html><meta charset="utf-8"><title>deney</title>
<script src="/sdk/firebase-app-compat.js"></script><script src="/sdk/firebase-firestore-compat.js"></script>`;
const srv = http.createServer((req, res) => { const y = req.url.split('?')[0];
  if (y === '/deney') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(DENEY); }
  const m = y.match(/^\/sdk\/(firebase-(app|firestore)-compat\.js)$/); if (m) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(SDK_DIR, m[1]))); }
  res.writeHead(404); res.end(); }).listen(0, '127.0.0.1');
await new Promise(r => srv.once('listening', r)); const U = `http://127.0.0.1:${srv.address().port}`;
const br = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1'], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const AG = { gecen: [], engellenen: [] };
async function cihaz() {
  const ctx = await br.newContext({ serviceWorkers: 'block' }); const d = { ctx, hatalar: [] };
  await ctx.route('**/*', r => { const u = new URL(r.request().url());
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') { AG.engellenen.push(u.href); return r.abort('blockedbyclient'); }
    AG.gecen.push(u.href); return r.continue(); });
  const p = await ctx.newPage(); p.on('pageerror', e => d.hatalar.push(e.message)); await p.goto(U + '/deney'); d.p = p;
  await p.evaluate(([PROJE, port]) => (async () => { const t = () => performance.now();
    const app = firebase.initializeApp({ apiKey: 'demo-anahtar', projectId: PROJE, appId: '1:000:web:demo' }); const fs = firebase.firestore(); fs.useEmulator('127.0.0.1', port);
    try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* uygulama gibi: hata yutulur */ }
    window.__d = { app, fs, t, iz: {},
      // 8 bağımsız set(): her biri kendi sözü; ayrıca Promise.all ve Promise.allSettled aynı sözler üzerinden izlenir
      yaz8(onek, surum, ayar) { const ps = [], kayit = [];
        ayar.sirada.forEach((dm, i) => { const id = onek + '-' + dm + (ayar.red.includes(i) ? '_RED' : ''); const k = { id, dm, bas: t(), son: null, durum: 'bekliyor', hata: null, senkron: false };
          const veri = { sentetik: true, domen: dm, surum, sira: i };
          if (ayar.buyuk === i) veri.dolgu = 'x'.repeat(1048600); // belge boyut sınırı (1 MiB) aşılır
          if (ayar.gecersiz === i) veri.bozuk = undefined;          // SDK istemci tarafında reddeder
          let p; try { p = fs.collection('emulator_test').doc(id).set(veri); } catch (e) { k.senkron = true; p = Promise.reject(e); }
          p.then(() => { k.son = t(); k.durum = 'onaylandı'; }, e => { k.son = t(); k.durum = 'reddedildi'; k.hata = String(e && (e.code || e.message)).slice(0, 80); });
          ps.push(p); kayit.push(k); });
        const hepsi = { durum: 'bekliyor', hata: null }, ayri = { durum: 'bekliyor', sonuc: null };
        Promise.all(ps).then(() => { hepsi.durum = 'başarılı'; }, e => { hepsi.durum = 'reddedildi'; hepsi.hata = String(e && (e.code || e.message)).slice(0, 80); hepsi.zaman = t(); });
        Promise.allSettled(ps).then(r => { ayri.durum = 'bitti'; ayri.sonuc = r.map(x => x.status); });
        this.iz[onek] = { kayit, hepsi, ayri }; },
      async sirali(onek, surum, kac) { for (let i = 0; i < kac; i++) await fs.collection('emulator_test').doc(onek + '-' + DOMEN_ADLARI[i]).set({ sentetik: true, domen: DOMEN_ADLARI[i], surum, sira: i }); },
      wpw(ad) { const k = this.iz['wpw:' + ad] = { durum: 'bekliyor', bas: t(), son: null }; fs.waitForPendingWrites().then(() => { k.son = t(); k.durum = 'bitti'; }, e => { k.son = t(); k.durum = 'hata:' + (e && e.code); }); },
      // önbellek: belge varsa sürümü; yoksa null. SDK önbellekte olmayan belgeyi hata ile bildirir ("unavailable") → ham kod ayrıca döner
      async onbellek(ids) { return Promise.all(ids.map(id => fs.collection('emulator_test').doc(id).get({ source: 'cache' }).then(s => ({ v: s.exists ? s.data().surum : null, ham: s.exists ? 'var' : 'exists=false' }), e => ({ v: null, ham: 'hata:' + (e && e.code) })))); },
      oku(onek) { const z = this.iz[onek]; return z && { kayit: z.kayit.map(k => ({ id: k.id, durum: k.durum, hata: k.hata, sure: k.son !== null ? k.son - k.bas : null, senkron: k.senkron })), hepsi: { ...z.hepsi }, ayri: { ...z.ayri } }; } };
  })(), [PROJE, P.firestore]);
  await p.evaluate((ad) => { window.DOMEN_ADLARI = ad; }, DOMEN);
  return d; }
const kapat = async (d) => { try { await d.p.evaluate(() => window.__d && window.__d.app.delete()); } catch (e) { /* kapalı */ } await d.ctx.close(); };
const oku = (d, onek) => d.p.evaluate((o) => window.__d.oku(o), onek);
const bitsin = async (d, onek, ms, kosul) => { const s = Date.now(); for (;;) { const o = await oku(d, onek); if (kosul(o)) return { ...o, zamanAsimi: false }; if (Date.now() - s > ms) return { ...o, zamanAsimi: true }; await bekle(20); } };
const wpwDurum = (d, ad) => d.p.evaluate((ad) => { const k = window.__d.iz['wpw:' + ad]; return { durum: k.durum, sure: k.son !== null ? k.son - k.bas : null }; }, ad);

// ---------- ölçüm kaydı ----------
const SONUC = {};
const ist = (a) => { const s = a.filter(x => typeof x === 'number').sort((x, y) => x - y); if (!s.length) return '—'; const m = s[Math.floor((s.length - 1) / 2)]; return `en az ${s[0].toFixed(0)} · ortanca ${m.toFixed(0)} · en çok ${s[s.length - 1].toFixed(0)} ms (n=${s.length})`; };
async function deney(kod, ad, enjeksiyon, hipotez, tek) {
  const k = { kod, ad, enjeksiyon, hipotez, tekrar: [], sinif: { HIPOTEZE_UYDU: 0, BEKLENTI_DISI: 0, ZAMAN_ASIMI: 0, SDK_HATASI: 0 }, tasinma: 0, sure: {}, sayac: {} };
  for (let i = 0; i < N; i++) {
    if (!(await temizle())) dur(kod + ': emülatör temizlenemedi');
    const once = await belgeler(); if (!once || once.length) k.tasinma++;
    let r; try { r = await tek(i); } catch (e) { r = { sinif: 'SDK_HATASI', not: String(e && e.message).slice(0, 200) }; }
    k.sinif[r.sinif] = (k.sinif[r.sinif] || 0) + 1; k.tekrar.push(r);
    for (const [a, v] of Object.entries(r.sure || {})) (k.sure[a] = k.sure[a] || []).push(v);
    for (const [a, v] of Object.entries(r.sayac || {})) k.sayac[a] = (k.sayac[a] || 0) + v;
  }
  if (!(await temizle()) || (await belgeler()).length) k.tasinma++;
  SONUC[kod] = k;
  console.log(`\n=== ${kod} — ${ad}\n    ENJEKSİYON: ${enjeksiyon}\n    HİPOTEZ   : ${hipotez}`);
  console.log(`    ÖLÇÜLEN   : ${Object.entries(k.sinif).map(([a, v]) => a + '=' + v).join(' · ')}`);
  if (Object.keys(k.sayac).length) console.log(`    SAYAÇLAR  : ${Object.entries(k.sayac).map(([a, v]) => a + '=' + v).join(' · ')}`);
  for (const [a, v] of Object.entries(k.sure)) console.log(`    SÜRE ${a}: ${ist(v)}`);
  const ornek = k.tekrar.find(r => r.ornek); if (ornek) console.log('    ÖRNEK TEKRAR: ' + ornek.ornek);
  const notlar = [...new Set(k.tekrar.map(r => r.not).filter(Boolean))]; if (notlar.length) console.log('    NOTLAR    : ' + notlar.slice(0, 5).join(' | '));
  console.log(`    SONUÇ     : ${k.sinif.HIPOTEZE_UYDU === N ? 'hipotez ' + N + '/' + N + ' tekrarda TUTTU' : 'BEKLENTİ DIŞI / tutarsız — ' + (N - k.sinif.HIPOTEZE_UYDU) + ' tekrarda hipotez tutmadı (rapor edilir, test sonucunu değiştirmez)'}`);
  T(`${kod} [ölçüm] ${N} tekrar tamamlandı ve sınıflandırıldı (her tekrar öncesi emülatör boş, sonraki tekrara taşınan yazım yok)`, k.tekrar.length === N && k.tasinma === 0, { tasinma: k.tasinma });
}
const durumOzet = (o, srv) => o.kayit.map((x, i) => `${x.id.split('-').slice(-1)[0]}:${x.durum === 'onaylandı' ? 'ok' : x.durum === 'reddedildi' ? 'RED(' + x.hata + ')' : 'bekl'}/${srv[i] ? 'sunucuda' : 'YOK'}`).join(' ');

// P1 — sekiz bağımsız paralel set(), hepsi başarılı
await deney('P1', 'sekiz bağımsız paralel set(), hata yok', 'yok', '8 sözün hepsi onaylanır; Promise.all başarılı; sunucuda 8 belgenin hepsi AYNI sürüm işaretini taşır', async (i) => {
  const d = await cihaz(), on = 'p1-' + i, surum = 'v' + i + '-' + Math.random().toString(36).slice(2, 8);
  await d.p.evaluate(([on, surum, sira]) => window.__d.yaz8(on, surum, { sirada: sira, red: [] }), [on, surum, DOMEN]);
  const o = await bitsin(d, on, ZAMAN_ASIMI, o => o.ayri.durum === 'bitti'); const srv = await sunucu(o.kayit.map(x => x.id)); await kapat(d);
  if (o.zamanAsimi) return { sinif: 'ZAMAN_ASIMI' };
  const sureler = o.kayit.map(x => x.sure); const uydu = o.hepsi.durum === 'başarılı' && o.kayit.every(x => x.durum === 'onaylandı') && srv.every(v => v === surum);
  return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: uydu ? null : durumOzet(o, srv), ornek: i === 0 ? durumOzet(o, srv) + ' · sürüm hepsinde aynı: ' + srv.every(v => v === surum) : null,
    sure: { 'ilk onay': Math.min(...sureler), 'son onay (8/8)': Math.max(...sureler), 'ilk ile son onay arası': Math.max(...sureler) - Math.min(...sureler) } }; });

// P2a — Firestore tarafı ret (test kuralı): 8 yazımdan 3'ü reddedilir
await deney('P2a', 'kısmi başarısızlık — 3/8 yazım Firestore kuralıyla reddedilir', '[Firestore tarafı] test kuralı, adı _RED ile biten belgelere yazımı reddeder (istek sunucuya ULAŞIR, sunucu reddeder)',
  "Promise.all REDDEDİLİR (ilk hatayla); Promise.allSettled 5 başarılı + 3 reddedildi gösterir; başarılı 5 belge sunucuda KALIR (geri alınmaz); reddedilen 3 sunucuda yok ve yerel önbellekten de geri alınır; ardından waitForPendingWrites BAŞARIYLA biter", async (i) => {
  const d = await cihaz(), on = 'p2a-' + i, surum = 'v' + i, red = [1, 4, 6];
  await d.p.evaluate(([on, surum, sira, red]) => window.__d.yaz8(on, surum, { sirada: sira, red }), [on, surum, DOMEN, red]);
  const o = await bitsin(d, on, ZAMAN_ASIMI, o => o.ayri.durum === 'bitti'); const ids = o.kayit.map(x => x.id); const srv = await sunucu(ids);
  const onb = await d.p.evaluate((ids) => window.__d.onbellek(ids), ids); await d.p.evaluate(() => window.__d.wpw('son')); await bekle(300); const w = await wpwDurum(d, 'son'); await kapat(d);
  if (o.zamanAsimi) return { sinif: 'ZAMAN_ASIMI' };
  const basarili = o.kayit.map((x, j) => !red.includes(j)), uydu = o.hepsi.durum === 'reddedildi' && /permission-denied/.test(o.hepsi.hata)
    && o.ayri.sonuc.every((s, j) => s === (basarili[j] ? 'fulfilled' : 'rejected')) && srv.every((v, j) => (basarili[j] ? v === surum : v === null))
    && onb.every((x, j) => (basarili[j] ? x.v === surum : x.v === null)) && w.durum === 'bitti';
  return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: uydu ? null : durumOzet(o, srv) + ' önbellek=' + JSON.stringify(onb) + ' wpw=' + w.durum,
    ornek: i === 0 ? `Promise.all=${o.hepsi.durum}(${o.hepsi.hata}) · allSettled=[${o.ayri.sonuc.join(',')}] · ${durumOzet(o, srv)} · yerel önbellek (ham)=[${onb.map(x => x.ham).join(',')}] · wpw=${w.durum}` : null,
    sayac: { 'sunucuda kalan başarılı belge': srv.filter((v, j) => basarili[j] && v === surum).length, 'geri alınan başarılı belge': srv.filter((v, j) => basarili[j] && v === null).length, 'sunucuya giren reddedilmiş belge': srv.filter((v, j) => !basarili[j] && v !== null).length } }; });

// P2b — Firestore tarafı ret: belge boyut sınırı (uygulamanın bilinen 1 MB riski)
await deney('P2b', 'kısmi başarısızlık — 1/8 belge 1 MiB sınırını aşar', '[Firestore tarafı] satis belgesine 1.048.600 karakterlik dolgu eklenir (sınır 1 MiB); SDK isteği gönderir, sunucu reddeder',
  'satis yazımı reddedilir, diğer 7 belge sunucuda KALIR; Promise.all reddedilir, allSettled 7 başarılı + 1 reddedildi', async (i) => {
  const d = await cihaz(), on = 'p2b-' + i, surum = 'v' + i, buyuk = DOMEN.indexOf('satis');
  await d.p.evaluate(([on, surum, sira, buyuk]) => window.__d.yaz8(on, surum, { sirada: sira, red: [], buyuk }), [on, surum, DOMEN, buyuk]);
  const o = await bitsin(d, on, ZAMAN_ASIMI, o => o.ayri.durum === 'bitti'); const srv = await sunucu(o.kayit.map(x => x.id)); await kapat(d);
  if (o.zamanAsimi) return { sinif: 'ZAMAN_ASIMI', not: 'sözler 20 sn içinde bitmedi' };
  const uydu = o.hepsi.durum === 'reddedildi' && o.ayri.sonuc.every((s, j) => s === (j === buyuk ? 'rejected' : 'fulfilled')) && srv.every((v, j) => (j === buyuk ? v === null : v === surum));
  return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: uydu ? null : `Promise.all=${o.hepsi.durum} ` + durumOzet(o, srv),
    ornek: i === 0 ? `Promise.all=${o.hepsi.durum}(${o.hepsi.hata}) · allSettled=[${o.ayri.sonuc.join(',')}] · ${durumOzet(o, srv)}` : null,
    sayac: { 'sunucuda kalan diğer belge': srv.filter((v, j) => j !== buyuk && v === surum).length } }; });

// P2c — SDK, ağdan önce: geçersiz değer
await deney('P2c', 'kısmi başarısızlık — 1/8 yazımda geçersiz değer', '[SDK, ağdan önce] kasa verisine undefined alan konur; SDK istemci tarafında reddeder (istek GÖNDERİLMEZ)',
  'kasa yazımı EŞZAMANLI (çağrı anında) hata verir, diğer 7 belge sunucuda kalır; Promise.all reddedilir (invalid-argument)', async (i) => {
  const d = await cihaz(), on = 'p2c-' + i, surum = 'v' + i, gecersiz = DOMEN.indexOf('kasa');
  await d.p.evaluate(([on, surum, sira, gecersiz]) => window.__d.yaz8(on, surum, { sirada: sira, red: [], gecersiz }), [on, surum, DOMEN, gecersiz]);
  const o = await bitsin(d, on, ZAMAN_ASIMI, o => o.ayri.durum === 'bitti'); const srv = await sunucu(o.kayit.map(x => x.id)); await kapat(d);
  if (o.zamanAsimi) return { sinif: 'ZAMAN_ASIMI' };
  const k = o.kayit[gecersiz], uydu = k.senkron && /invalid-argument/.test(k.hata) && o.hepsi.durum === 'reddedildi' && srv.every((v, j) => (j === gecersiz ? v === null : v === surum));
  return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: uydu ? null : JSON.stringify({ senkron: k.senkron, hata: k.hata, all: o.hepsi.durum }) + ' ' + durumOzet(o, srv),
    ornek: i === 0 ? `kasa: eşzamanlı=${k.senkron} hata=${k.hata} · Promise.all=${o.hepsi.durum} · ${durumOzet(o, srv)}` : null }; });

// P3a — sıralı yazım, 4 onaydan sonra ağ kopar, kalan 4 yazım kopukken yapılır
await deney('P3a', 'bağlantı kopması — 4 belge onaylandıktan sonra ağ koptu, 4 belge kopukken yazıldı', '[ağ seviyesi] tarayıcı çevrimdışı öykünmesi (Playwright setOffline: localhost dahil bütün istekler düşer)',
  "kopukken sunucuda YALNIZ ilk 4 belge vardır (başka cihazın okuyacağı YARIM görüntü); 4 bekleyen söz ve waitForPendingWrites bitmez; ağ gelince 8/8 sunucuda ve bekleme biter — sekiz belge için ORTAK atomiklik YOK", async (i) => {
  const d = await cihaz(), on = 'p3a-' + i, surum = 'v' + i;
  await d.p.evaluate(([on, surum]) => window.__d.sirali(on, surum, 4), [on, surum]);
  await d.ctx.setOffline(true); const tk = Date.now();
  await d.p.evaluate(([on, surum, sira]) => window.__d.yaz8(on, surum, { sirada: sira, red: [] }), [on + 'k', surum, DOMEN.slice(4)]); await d.p.evaluate(() => window.__d.wpw('k'));
  await bekle(PENCERE); const ara = await oku(d, on + 'k'), aw = await wpwDurum(d, 'k');
  const ilkIds = DOMEN.slice(0, 4).map(dm => on + '-' + dm), sonIds = ara.kayit.map(x => x.id); const araSrv = await sunucu([...ilkIds, ...sonIds]);
  await d.ctx.setOffline(false); const t0 = Date.now(); const son = await bitsin(d, on + 'k', ZAMAN_ASIMI, o => o.ayri.durum === 'bitti'); const sa = Date.now() - t0;
  for (let j = 0; j < 100 && (await wpwDurum(d, 'k')).durum === 'bekliyor'; j++) await bekle(50); const sw = await wpwDurum(d, 'k'); const sonSrv = await sunucu([...ilkIds, ...sonIds]); await kapat(d);
  if (son.zamanAsimi) return { sinif: 'ZAMAN_ASIMI', not: 'ağ geldikten sonra 20 sn içinde bitmedi' };
  const yarim = araSrv.slice(0, 4).every(v => v === surum) && araSrv.slice(4).every(v => v === null), uydu = yarim && ara.kayit.every(x => x.durum === 'bekliyor') && aw.durum === 'bekliyor' && sonSrv.every(v => v === surum) && sw.durum === 'bitti';
  return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: uydu ? null : JSON.stringify({ araSrv: araSrv.map(Boolean), bekleyen: ara.kayit.map(x => x.durum), aw: aw.durum, sonSrv: sonSrv.map(Boolean), sw: sw.durum }),
    ornek: i === 0 ? `kopukken sunucu: ${araSrv.map(v => (v ? 1 : 0)).join('')} (1=var) · bekleyen sözler ${ara.kayit.filter(x => x.durum === 'bekliyor').length}/4 · waitForPendingWrites=${aw.durum} → ağ gelince sunucu ${sonSrv.map(v => (v ? 1 : 0)).join('')} · bekleme=${sw.durum}` : null,
    sayac: { 'kopukken yarım görüntü (4/8)': yarim ? 1 : 0 }, sure: { 'ağ gelince 4 bekleyenin onayı': sa } }; });

// P3b — sekiz paralel set(), rastgele anda ağ kopar → belge başına sınıflandırma (onaylı / belirsiz / bekleyen)
await deney('P3b', 'bağlantı kopması — sekiz paralel set() sürerken rastgele anda ağ koptu', '[ağ seviyesi] tarayıcı çevrimdışı öykünmesi, yazımlar başladıktan 60–160 ms sonra (rastgele; P1\'de onaylar 84–461 ms arasında geldi — onay penceresi kapsanır)',
  "kopma anında belgeler üçe ayrılır: ONAYLI (söz bitti), BELİRSİZ (söz bitmedi ama belge sunucuda VAR — istemci bilmiyor), BEKLEYEN (söz bitmedi, sunucuda yok); ağ gelince 8/8 sunucuda, sözler biter, çift/eksik yazım yok", async (i) => {
  const d = await cihaz(), on = 'p3b-' + i, surum = 'v' + i, gec = 60 + Math.floor(Math.random() * 101);
  await d.p.evaluate(([on, surum, sira]) => window.__d.yaz8(on, surum, { sirada: sira, red: [] }), [on, surum, DOMEN]); await bekle(gec); await d.ctx.setOffline(true);
  const an = await oku(d, on); await bekle(PENCERE); const ara = await oku(d, on); const ids = ara.kayit.map(x => x.id); const araSrv = await sunucu(ids);
  const sinif = ara.kayit.map((x, j) => (an.kayit[j].durum === 'onaylandı' ? 'ONAYLI' : araSrv[j] ? 'BELIRSIZ' : 'BEKLEYEN'));
  await d.p.evaluate(() => window.__d.wpw('k')); const aw = await wpwDurum(d, 'k');
  await d.ctx.setOffline(false); const son = await bitsin(d, on, ZAMAN_ASIMI, o => o.ayri.durum === 'bitti'); for (let j = 0; j < 100 && (await wpwDurum(d, 'k')).durum === 'bekliyor'; j++) await bekle(50);
  const sw = await wpwDurum(d, 'k'); const sonSrv = await sunucu(ids); const tum = await belgeler(); await kapat(d);
  if (son.zamanAsimi) return { sinif: 'ZAMAN_ASIMI', not: 'ağ geldikten sonra 20 sn içinde bitmedi' };
  const say = (s) => sinif.filter(x => x === s).length, beklenen = sinif.some(x => x !== 'ONAYLI');
  const uydu = sonSrv.every(v => v === surum) && son.ayri.sonuc.every(s => s === 'fulfilled') && tum.length === 8 && sw.durum === 'bitti' && (beklenen ? aw.durum === 'bekliyor' : true);
  return { sinif: uydu ? 'HIPOTEZE_UYDU' : 'BEKLENTI_DISI', not: uydu ? null : JSON.stringify({ sinif, sonSrv: sonSrv.map(Boolean), tum: tum.length, aw: aw.durum, sw: sw.durum }),
    ornek: i === 0 ? `kopma ${gec} ms sonra · ${sinif.map((s, j) => DOMEN[j] + ':' + s).join(' ')} · kopukken waitForPendingWrites=${aw.durum} → son: sunucu 8/8=${sonSrv.every(v => v === surum)}` : null,
    sayac: { 'ONAYLI belge': say('ONAYLI'), 'BELİRSİZ belge (sunucuda var, istemci onay almadı)': say('BELIRSIZ'), 'BEKLEYEN belge': say('BEKLEYEN'), 'kopukken yarım görüntü olan tekrar': araSrv.some(Boolean) && !araSrv.every(Boolean) ? 1 : 0 } }; });

// ---------- özet, yalıtım kanıtı, kapanış ----------
console.log('\n=== ÖZET (hipotez ↔ ölçüm)');
for (const k of Object.values(SONUC)) console.log(`${k.kod.padEnd(4)} ${String(k.sinif.HIPOTEZE_UYDU).padStart(2)}/${N} uydu · beklenti dışı ${k.sinif.BEKLENTI_DISI} · zaman aşımı ${k.sinif.ZAMAN_ASIMI} · SDK hatası ${k.sinif.SDK_HATASI} — ${k.ad}`);
const disaGiden = AG.gecen.filter(u => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u));
T('Y1 [ağ] gerçekleşen bütün istekler yalnız localhost / 127.0.0.1 (' + AG.gecen.length + ' istek)', disaGiden.length === 0 && AG.gecen.length > 0, disaGiden.slice(0, 3));
T('Y1 [ağ] gerçek Firebase / Google adreslerine GİDEN istek sayısı 0', AG.gecen.filter(u => GERCEK_FIREBASE.test(u)).length === 0);
T('Y1 [ağ] gerçek proje kimliği hiçbir istekte yok; emülatör istekleri demo projesine', !AG.gecen.some(u => u.includes(GERCEK_PROJE)) && AG.gecen.some(u => u.includes(String(P.firestore))));
console.log('BİLGİ engellenen dış istek: ' + AG.engellenen.length + (AG.engellenen.length ? ' ' + JSON.stringify([...new Set(AG.engellenen.map(u => new URL(u).host + new URL(u).pathname))].slice(0, 3)) : ''));
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
