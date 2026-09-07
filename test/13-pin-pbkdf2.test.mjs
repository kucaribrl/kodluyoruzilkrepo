// PIN güvenliği: tuzlu PBKDF2 özeti, eski (djb2) kaydın ilk doğru girişte yükseltilmesi, 5 yanlışta 30 sn kilit,
// kilit ekranı / yönetici dönüşü / tutar gösterme akışlarının async doğrulaması.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  if (req.url.includes('sw.js')) { res.writeHead(404); return res.end(); }
  const p = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));
const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const page = await br.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app'));
let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' — ' + JSON.stringify(x).slice(0, 240) : '')); } };
const ev = (fn, a) => page.evaluate(fn, a);
const wait = ms => page.waitForTimeout(ms);

// 1) PIN kur → k2 biçimi, tuzlu, her kurulumda farklı
await ev(() => { document.body.insertAdjacentHTML('beforeend', '<input id="pin-yeni" value="1234"><input id="pin-yeni2" value="1234"><input id="pin-dk" value="3">'); kilitKur(); });
await wait(600);
const p1 = await ev(() => db.pin);
T('PIN kaydı k2:<tuz>:<özet> biçiminde (PBKDF2)', /^k2:[0-9a-f]{32}:[0-9a-f]{64}$/.test(p1), p1);
T('aynı PIN farklı tuzla farklı özet üretir', await ev(async () => (await pinOzet('1234')) !== db.pin));
T('doğru PIN geçer, yanlış geçmez', await ev(async () => (await pinDogrula('1234')) === true && (await pinDogrula('9999')) === false));

// 2) Eski djb2 kaydı: doğru girişte yükseltilir
await ev(() => { db.pin = pinHash('4321'); save(); });
T('eski kayıt: yanlış PIN reddedilir', await ev(async () => !(await pinDogrula('1111'))));
T('eski kayıt: doğru PIN kabul edilir ve k2\'ye yükseltilir', await ev(async () => { const ok1 = await pinDogrula('4321'); await new Promise(r => setTimeout(r, 300)); return ok1 && /^k2:/.test(db.pin) && (await pinDogrula('4321')); }));

// 3) 5 yanlışta kilit
T('5 yanlış deneme → 30 sn kilit (doğru PIN bile geçmez)', await ev(async () => { for (let i = 0; i < 5; i++) await pinDogrula('0000'); const kilit = +localStorage.getItem('iq_pin_kilit') > Date.now(); const dogru = await pinDogrula('4321'); return kilit && dogru === false; }));
await ev(() => { _pinKilit = 0; _pinHata = 0; localStorage.removeItem('iq_pin_kilit'); });

// 4) Akışlar: kilit ekranı, yönetici dönüşü, tutar gösterme (async)
await ev(() => { document.body.insertAdjacentHTML('beforeend', '<div id="kilit" style="display:flex"><input id="kilit-pin" value="4321"><div id="kilit-msg"></div></div>'); return kilitDene(); });
await wait(400);
T('kilit ekranı: doğru PIN ile açılır', await ev(() => document.getElementById('kilit').style.display === 'none'));
await ev(() => { db.rol = 'magaza'; db.rolAyar = { magaza: { para: true } }; document.body.insertAdjacentHTML('beforeend', '<input id="yd-pin" value="4321"><div id="yd-msg"></div>'); return yoneticiDonDene(); });
await wait(400);
T('yönetici dönüşü: PIN ile patron olur', await ev(() => db.rol === 'patron'));
await ev(() => { _paraGizli = true; document.body.insertAdjacentHTML('beforeend', '<input id="pg-pin" value="4321"><div id="pg-msg"></div>'); return tutarGosterDene(); });
await wait(400);
T('tutar gösterme: PIN ile açılır', await ev(() => _paraGizli === false));

console.log('pageErrors:', errs.length ? errs : 'none'); if (errs.length) fail++;
await br.close(); srv.close();
console.log(`\nSONUÇ: ${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
