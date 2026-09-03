// Parti akışı (YENİ tasarım): siparişte parti YOK — parti depoya inerken (teslimde) girilir,
// aynı renkten birden fazla parti ayrı satır olarak eklenebilir; stok parti kırılımıyla tutulur.
// Çalıştırma: repo kökünde `npm i playwright` (bir kez) → `node test/04-parti-siparis.test.mjs`
// Chromium yolu farklıysa: PLAYWRIGHT_CHROMIUM=/yol/chrome node test/...
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p.includes('sw.js')) { res.writeHead(404); res.end(); return; }
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
await page.addInitScript(() => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push(u); return { closed: false }; };
  navigator.share = undefined;
});
await page.route('**/sw.js', r => r.abort());
await page.goto('http://127.0.0.1:8931/index.html');
await page.waitForFunction(() => typeof db !== 'undefined' && typeof malSipForm === 'function', { timeout: 15000 });
await page.waitForTimeout(500);

const out = await page.evaluate(async () => {
  const R = { steps: [] };
  const ok = (n, c) => R.steps.push((c ? 'PASS ' : 'FAIL ') + n);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    // temiz durum: kumaş kartı renklerle
    db.hammadde.push({ id: nid('h'), ad: 'Test Süprem', kat: 'Kumaş', birim: 'kg', detay: '', stok: 0, renkler: [{ ad: 'Beyaz', stok: 0, top: 0 }, { ad: 'Siyah', stok: 0, top: 0 }], kritik: 0, alis: 0, pb: 'TL', ted: '', tedId: null });
    save();

    // 1) sipariş formu — renkler otomatik gelir, parti kutusu YOK (parti teslimde girilir)
    malSipForm(0);
    document.getElementById('ms-ad').value = 'Test Süprem'; msAdDegis();
    await sleep(60);
    const box = document.getElementById('ms-satir-box');
    const rows = box ? box.children : [];
    ok('form: 2 renk satırı geldi', rows.length === 2);
    const inps = rows[0] ? rows[0].querySelectorAll('input') : [];
    ok('form: satırda 3 input (renk+kartela kodu+miktar) — parti YOK', inps.length === 3 && inps[1].placeholder === 'kod');
    ok('form: parti kutusu hiç yok', box && !box.innerHTML.includes('parti no'));

    // 2) miktarları doldur, kaydet — satırlar partisiz
    inps[2].value = '120'; inps[2].dispatchEvent(new Event('input'));
    const r2 = rows[1].querySelectorAll('input');
    r2[2].value = '80'; r2[2].dispatchEvent(new Event('input'));
    kaydetMalSip(0);
    const s = db.malSiparis[db.malSiparis.length - 1];
    ok('kaydet: satırlar partisiz kaydedildi', s && s.satirlar.length === 2 && !s.satirlar[0].parti && !s.satirlar[1].parti);
    R.sid = s.id;

    // 3) WhatsApp mesajı — renkler var, parti geçmiyor
    malSipGonder(s.id);
    await sleep(150);
    const wa = window.__opened.find(u => /wa\.me|whatsapp/.test(u)) || '';
    const dec = decodeURIComponent(wa);
    ok('WA: renk satırları mesajda', dec.includes('Beyaz') && dec.includes('Siyah'));
    ok('WA: mesajda parti YOK', !dec.includes('parti'));

    // 4) teslim: Beyaz tek parti tam; Siyah 2 FARKLI PARTİ kısmi (30+20)
    malSipTeslim(s.id);
    await sleep(60);
    ok('teslim: parti kutuları teslim modalında', document.getElementById('mt-wrap').innerHTML.includes('parti no'));
    ok('teslim: ＋ parti butonu var', document.getElementById('mt-wrap').innerHTML.includes('＋ parti'));
    mtSatir[0].rows = [{ parti: '4512B', mik: 120 }];
    mtSatir[1].rows = [{ parti: '7801', mik: 30 }, { parti: '7802', mik: 20 }];
    kaydetMalSipTeslim(s.id);
    const s2 = db.malSiparis.find(x => x.id === s.id);
    ok('teslim: kısmi durum (kapat işaretlenmedi)', s2.durum === 'kismi');
    ok('teslim: partiGelen geçmişi (çoklu parti)', s2.satirlar[0].partiGelen === '4512B 120' && s2.satirlar[1].partiGelen === '7801 30 · 7802 20');

    // 5) stok parti kırılımı
    const h = db.hammadde.find(x => x.ad === 'Test Süprem');
    const b = h.renkler.find(r => r.ad === 'Beyaz'), sy = h.renkler.find(r => r.ad === 'Siyah');
    ok('stok: Beyaz 120 @ parti 4512B', b && b.stok === 120 && b.partiler && b.partiler.length === 1 && b.partiler[0].kod === '4512B' && b.partiler[0].mik === 120);
    ok('stok: Siyah 50 = 7801(30) + 7802(20)', sy && sy.stok === 50 && sy.partiler && sy.partiler.length === 2 && sy.partiler[0].kod === '7801' && sy.partiler[0].mik === 30 && sy.partiler[1].kod === '7802' && sy.partiler[1].mik === 20);

    // 6) kalan teslim — yeni parti, sipariş tamamlanır
    malSipTeslim(s.id);
    await sleep(60);
    mtSatir[0].rows = [{ parti: '', mik: 0 }];
    mtSatir[1].rows = [{ parti: '7803', mik: 30 }];
    kaydetMalSipTeslim(s.id);
    const s3 = db.malSiparis.find(x => x.id === s.id);
    ok('teslim2: tamamlandı', s3.durum === 'geldi');
    ok('teslim2: geçmiş birikti', s3.satirlar[1].partiGelen === '7801 30 · 7802 20 · 7803 30');
    const sy2 = db.hammadde.find(x => x.ad === 'Test Süprem').renkler.find(r => r.ad === 'Siyah');
    ok('stok: Siyah 80, 3 parti', sy2.stok === 80 && sy2.partiler.length === 3 && sy2.partiler[2].kod === '7803');

    // 7) detay ekranı parti geçmişini gösteriyor
    malSipDetay(s.id);
    const html = document.getElementById('mB') ? document.getElementById('mB').innerHTML : document.body.innerHTML;
    ok('detay: parti geçmişi görünüyor', html.includes('4512B 120') && html.includes('7803 30'));
    closeM();

    // 8) EKSİK KAPAMA: yeni sipariş 100, 90 gelir, "siparişi kapat" → geldi + fark
    malSipForm(0);
    document.getElementById('ms-ad').value = 'Test Süprem'; msAdDegis();
    await sleep(60);
    msSatir = [{ renk: 'Beyaz', miktar: 100 }];
    kaydetMalSip(0);
    const sK = db.malSiparis[db.malSiparis.length - 1];
    malSipTeslim(sK.id); await sleep(60);
    mtSatir[0].rows = [{ parti: 'K1', mik: 90 }];
    document.getElementById('mt-kapat').checked = true;
    kaydetMalSipTeslim(sK.id);
    const sK2 = db.malSiparis.find(x => x.id === sK.id);
    ok('kapat: 90/100 ile sipariş KAPANDI', sK2.durum === 'geldi' && sK2.gelenMiktar === 90);
    malSipDetay(sK.id);
    const dH = document.getElementById('mB').innerHTML;
    ok('kapat: detayda "eksik" yok, fark var', !dH.includes('eksik') && dH.includes('fark'));
    closeM();

    // 9) Kumaş dışı tür — teslimde de parti kutusu YOK (regresyon)
    malSipForm(0);
    document.getElementById('ms-kat').value = 'Aksesuar'; msKatDegis();
    await sleep(50);
    document.getElementById('ms-ad').value = 'Test Düğme';
    msSatir = [{ renk: 'Sedef', miktar: 100 }];
    kaydetMalSip(0);
    const sA = db.malSiparis[db.malSiparis.length - 1];
    malSipTeslim(sA.id); await sleep(60);
    ok('aksesuar teslim: parti kutusu yok', !document.getElementById('mt-wrap').innerHTML.includes('parti'));
    closeM();
  } catch (e) { R.steps.push('EXC ' + (e && e.stack || e)); }
  return R;
});

// sayfada JS hatası (pageerror) olmamalı → hata varsa test düşer
out.steps.push((errs.length === 0 ? 'PASS ' : 'FAIL ') + 'sayfa hatasız (pageerror yok)' + (errs.length ? ' → ' + errs.join(' | ') : ''));
console.log(out.steps.join('\n'));
console.log('pageErrors:', errs.length ? errs : 'none');
const fails = out.steps.filter(s => !s.startsWith('PASS')).length;
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
