// Çalıştırma: repo kökünde `npm i playwright` (bir kez) → `node test/04-parti-siparis.test.mjs`
// Chromium yolu farklıysa: PLAYWRIGHT_CHROMIUM=/yol/chrome node test/...
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(f);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/json', '.png': 'image/png' }[ext] || 'text/plain';
  res.writeHead(200, { 'content-type': mime });
  res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(8931, r));

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
const opened = [];
await page.addInitScript(() => {
  window.__opened = [];
  const wo = window.open;
  window.open = (u) => { window.__opened.push(u); return { closed: false }; };
  navigator.share = undefined;
});
await page.route('**/sw.js', r => r.abort());
await page.goto('http://127.0.0.1:8931/index.html');
await page.waitForTimeout(2500);
await page.waitForFunction(() => typeof db !== 'undefined' && typeof malSipForm === 'function', { timeout: 15000 });
await page.waitForTimeout(500);

const out = await page.evaluate(async () => {
  const R = { steps: [] };
  const ok = (n, c) => R.steps.push((c ? 'PASS ' : 'FAIL ') + n);
  try {
    // temiz durum: kumaş kartı renklerle
    db.hammadde.push({ id: nid('h'), ad: 'Test Süprem', kat: 'Kumaş', birim: 'kg', detay: '', stok: 0, renkler: [{ ad: 'Beyaz', stok: 0, top: 0 }, { ad: 'Siyah', stok: 0, top: 0 }], kritik: 0, alis: 0, pb: 'TL', ted: '', tedId: null });
    save();

    // 1) sipariş formu — parti kutusu rengin yanında mı
    malSipForm(0);
    document.getElementById('ms-ad').value = 'Test Süprem'; msAdDegis();
    await new Promise(r => setTimeout(r, 50));
    const box = document.getElementById('ms-satir-box');
    const rows = box ? box.children : [];
    ok('form: 2 renk satırı geldi', rows.length === 2);
    const inps = rows[0] ? rows[0].querySelectorAll('input') : [];
    ok('form: satırda 3 input (renk+parti+miktar)', inps.length === 3);
    ok('form: parti kutusu rengin hemen yanında', inps[1] && inps[1].placeholder === 'parti');

    // 2) parti + miktar doldur, kaydet
    inps[1].value = '4512B'; inps[1].dispatchEvent(new Event('input'));
    inps[2].value = '120'; inps[2].dispatchEvent(new Event('input'));
    const r2 = rows[1].querySelectorAll('input');
    r2[1].value = '7801'; r2[1].dispatchEvent(new Event('input'));
    r2[2].value = '80'; r2[2].dispatchEvent(new Event('input'));
    kaydetMalSip(0);
    const s = db.malSiparis[db.malSiparis.length - 1];
    ok('kaydet: satır partileri kaydedildi', s && s.satirlar[0].parti === '4512B' && s.satirlar[1].parti === '7801');
    R.sid = s.id;

    // 3) WhatsApp mesajında parti var mı
    malSipGonder(s.id);
    await new Promise(r => setTimeout(r, 100));
    const wa = window.__opened.find(u => /wa\.me|whatsapp/.test(u)) || '';
    const dec = decodeURIComponent(wa);
    ok('WA: mesajda "(parti 4512B)" var', dec.includes('(parti 4512B)'));
    ok('WA: mesajda "(parti 7801)" var', dec.includes('(parti 7801)'));
    closeM();

    // 4) teslim modali — parti prefill
    malSipTeslim(s.id);
    const p0 = document.getElementById('mt-p-0'), p1 = document.getElementById('mt-p-1');
    ok('teslim: parti kutuları siparişten dolu geldi', p0 && p0.value === '4512B' && p1 && p1.value === '7801');
    // beyaz tam, siyah kısmi + parti düzeltilmiş
    document.getElementById('mt-g-0').value = '120';
    document.getElementById('mt-g-1').value = '50';
    p1.value = '7802'; // gelen top farklı parti çıktı
    kaydetMalSipTeslim(s.id);
    const s2 = db.malSiparis.find(x => x.id === s.id);
    ok('teslim: kısmi durum', s2.durum === 'kismi');
    ok('teslim: partiGelen geçmişi', s2.satirlar[0].partiGelen === '4512B 120' && s2.satirlar[1].partiGelen === '7802 50');
    ok('teslim: son parti saklandı', s2.satirlar[1].parti === '7802');

    // 5) stok parti kırılımı
    const h = db.hammadde.find(x => x.ad === 'Test Süprem');
    const b = h.renkler.find(r => r.ad === 'Beyaz'), sy = h.renkler.find(r => r.ad === 'Siyah');
    ok('stok: Beyaz 120 @ parti 4512B', b && b.stok === 120 && b.partiler && b.partiler.length === 1 && b.partiler[0].kod === '4512B' && b.partiler[0].mik === 120);
    ok('stok: Siyah 50 @ parti 7802', sy && sy.stok === 50 && sy.partiler && sy.partiler[0].kod === '7802' && sy.partiler[0].mik === 50);

    // 6) kalan teslim — prefill artık son gelen parti (7802)
    malSipTeslim(s.id);
    const p1b = document.getElementById('mt-p-1');
    ok('teslim2: parti prefill son gelen kod', p1b && p1b.value === '7802');
    document.getElementById('mt-g-0').value = '0';
    document.getElementById('mt-g-1').value = '30';
    p1b.value = '7803';
    kaydetMalSipTeslim(s.id);
    const s3 = db.malSiparis.find(x => x.id === s.id);
    ok('teslim2: tamamlandı', s3.durum === 'geldi');
    ok('teslim2: geçmiş birikti', s3.satirlar[1].partiGelen === '7802 50 · 7803 30');
    const sy2 = db.hammadde.find(x => x.ad === 'Test Süprem').renkler.find(r => r.ad === 'Siyah');
    ok('stok: Siyah 80, 2 parti', sy2.stok === 80 && sy2.partiler.length === 2 && sy2.partiler[1].kod === '7803');

    // 7) detay ekranı parti gösteriyor
    malSipDetay(s.id);
    const html = document.getElementById('m-body') ? document.getElementById('m-body').innerHTML : document.body.innerHTML;
    ok('detay: parti geçmişi görünüyor', html.includes('4512B 120') && html.includes('7803 30'));
    closeM();

    // 8) Kumaş dışı tür — parti kutusu YOK (regresyon)
    malSipForm(0);
    document.getElementById('ms-kat').value = 'Aksesuar'; msKatDegis();
    const w2 = document.getElementById('ms-satir-wrap');
    ok('aksesuar: parti kutusu yok', w2 && !w2.innerHTML.includes('parti'));
    closeM();

    // 9) düzenleme — form partiyi geri yüklüyor
    // yeni bekleyen sipariş
    malSipForm(0);
    document.getElementById('ms-ad').value = 'Test Süprem'; msAdDegis();
    await new Promise(r => setTimeout(r, 50));
    const rowsB = document.getElementById('ms-satir-box').children;
    const iB = rowsB[0].querySelectorAll('input');
    iB[1].value = 'X99'; iB[1].dispatchEvent(new Event('input'));
    iB[2].value = '10'; iB[2].dispatchEvent(new Event('input'));
    kaydetMalSip(0);
    const sE = db.malSiparis[db.malSiparis.length - 1];
    closeM(); malSipForm(sE.id);
    const iE = document.getElementById('ms-satir-box').children[0].querySelectorAll('input');
    ok('düzenle: parti formda geri geldi', iE[1].value === 'X99');
    closeM();
  } catch (e) { R.steps.push('EXC ' + (e && e.stack || e)); }
  return R;
});

console.log(out.steps.join('\n'));
console.log('pageErrors:', errs.length ? errs : 'none');
const fails = out.steps.filter(s => !s.startsWith('PASS')).length;
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
