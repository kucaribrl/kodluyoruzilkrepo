// Çalıştırma: repo kökünde `npm i playwright` (bir kez) → `node test/05-parti-stok.test.mjs`
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
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(8934, r));

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.route('**/sw.js', r => r.abort());
await page.goto('http://127.0.0.1:8934/index.html');
await page.waitForTimeout(2500);
await page.waitForFunction(() => typeof db !== 'undefined' && typeof formHammadde === 'function', { timeout: 15000 });

const out = await page.evaluate(async () => {
  const R = { steps: [] };
  const ok = (n, c) => R.steps.push((c ? 'PASS ' : 'FAIL ') + n);
  try {
    // 1) YENİ kumaş kartı: renk + parti + stok gir
    formHammadde(0, 'Kumaş');
    await new Promise(r => setTimeout(r, 50));
    document.getElementById('h-ad').value = 'Stok Süprem';
    const box = document.getElementById('ham-renk-box');
    const row0 = box.querySelectorAll('input.rad')[0].closest('div');
    const inps = row0.querySelectorAll('input');
    ok('yeni: satırda 4 input (renk+parti+stok+top)', inps.length === 4);
    ok('yeni: parti kutusu rengin yanında', inps[1].placeholder === 'parti');
    inps[0].value = 'Beyaz'; inps[0].dispatchEvent(new Event('input'));
    inps[1].value = '4512B'; inps[1].dispatchEvent(new Event('input'));
    inps[2].value = '150'; inps[2].dispatchEvent(new Event('input'));
    inps[3].value = '6'; inps[3].dispatchEvent(new Event('input'));
    kaydetHammadde(0);
    await new Promise(r => setTimeout(r, 100));
    const h = db.hammadde.find(x => x.ad === 'Stok Süprem');
    const b = h && h.renkler.find(r => r.ad === 'Beyaz');
    ok('kaydet: parti stok kırılımına yazıldı', b && b.stok === 150 && b.partiler && b.partiler.length === 1 && b.partiler[0].kod === '4512B' && b.partiler[0].mik === 150);
    ok('kaydet: parti alanı renk objesinde kalmadı', b && !('parti' in b));

    // 2) DÜZENLE: parti kutusu dolu gelsin, stok değiştir → parti miktarı takip etsin
    formHammadde(h.id);
    await new Promise(r => setTimeout(r, 50));
    const box2 = document.getElementById('ham-renk-box');
    const r2 = box2.querySelectorAll('input.rad')[0].closest('div').querySelectorAll('input');
    ok('düzenle: parti prefill', r2[1].value === '4512B');
    r2[2].value = '180'; r2[2].dispatchEvent(new Event('input'));
    kaydetHammadde(h.id);
    await new Promise(r => setTimeout(r, 100));
    const b2 = db.hammadde.find(x => x.id === h.id).renkler.find(r => r.ad === 'Beyaz');
    ok('düzenle: stok 180 + parti güncel', b2.stok === 180 && b2.partiler[0].kod === '4512B' && b2.partiler[0].mik === 180);

    // 3) ÇOK PARTİLİ renk: kutu boş + placeholder "2 parti", dokunmadan kaydet → korunur
    const h3 = db.hammadde.find(x => x.id === h.id);
    h3.renkler.push({ ad: 'Siyah', stok: 80, top: 3, partiler: [{ kod: '7801', mik: 50 }, { kod: '7802', mik: 30 }] });
    h3.stok = 260; save();
    formHammadde(h.id);
    await new Promise(r => setTimeout(r, 50));
    const rowS = document.getElementById('ham-renk-box').querySelectorAll('input.rad')[1].closest('div').querySelectorAll('input');
    ok('çok parti: kutu boş, placeholder "2 parti"', rowS[1].value === '' && rowS[1].placeholder === '2 parti');
    const htmlB = document.getElementById('ham-renk-box').innerHTML;
    ok('çok parti: kırılım satırı görünüyor', htmlB.includes('7801 50') && htmlB.includes('7802 30'));
    kaydetHammadde(h.id);
    await new Promise(r => setTimeout(r, 100));
    const sy = db.hammadde.find(x => x.id === h.id).renkler.find(r => r.ad === 'Siyah');
    ok('çok parti: dokunmadan kaydet → korundu', sy.partiler.length === 2 && sy.partiler[0].kod === '7801');

    // 4) ÇOK PARTİLİ renge kod yazılırsa → tek partiye toplanır
    formHammadde(h.id);
    await new Promise(r => setTimeout(r, 50));
    const rowS2 = document.getElementById('ham-renk-box').querySelectorAll('input.rad')[1].closest('div').querySelectorAll('input');
    rowS2[1].value = '7900'; rowS2[1].dispatchEvent(new Event('input'));
    kaydetHammadde(h.id);
    await new Promise(r => setTimeout(r, 100));
    const sy2 = db.hammadde.find(x => x.id === h.id).renkler.find(r => r.ad === 'Siyah');
    ok('kod yazınca: tek partiye toplandı', sy2.partiler.length === 1 && sy2.partiler[0].kod === '7900' && sy2.partiler[0].mik === 80);

    // 5) Kumaş dışı tür: parti kutusu yok
    formHammadde(0, 'Aksesuar');
    await new Promise(r => setTimeout(r, 50));
    document.getElementById('h-renkli').checked = true; hamRenkliToggle();
    const rowA = document.getElementById('ham-renk-box').querySelectorAll('input.rad')[0].closest('div').querySelectorAll('input');
    ok('aksesuar: parti kutusu yok (2 input)', rowA.length === 2);
    closeM();

    // 6) Kod etiketi sadeleşti
    formHammadde(h.id);
    await new Promise(r => setTimeout(r, 50));
    const kodInp = document.getElementById('h-kod');
    ok('kod etiketi: placeholder parti içermiyor', kodInp && kodInp.placeholder === 'ör. SUP-180');
  } catch (e) { R.steps.push('EXC ' + (e && e.stack || e)); }
  return R;
});

// ekran görüntüsü: düzenleme formu açık, parti kutuları görünür
await page.evaluate(() => { const w = document.getElementById('ham-renk-wrap'); if (w) w.scrollIntoView({ block: 'center' }); });
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(os.tmpdir(), 'parti-stok-390.png') });

// sayfada JS hatası (pageerror) olmamalı → hata varsa test düşer
out.steps.push((errs.length === 0 ? 'PASS ' : 'FAIL ') + 'sayfa hatasız (pageerror yok)' + (errs.length ? ' → ' + errs.join(' | ') : ''));
console.log(out.steps.join('\n'));
console.log('pageErrors:', errs.length ? errs : 'none');
const fails = out.steps.filter(s => !s.startsWith('PASS')).length;
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
