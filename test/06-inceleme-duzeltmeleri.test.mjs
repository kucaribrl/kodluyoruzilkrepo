// Kod incelemesi (Eylül 2026) düzeltmelerinin regresyon testi.
// Çalıştırma: repo kökünde `npm i playwright` (bir kez) → `node test/06-inceleme-duzeltmeleri.test.mjs`
// Chromium yolu farklıysa: PLAYWRIGHT_CHROMIUM=/yol/chrome node test/...
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(8946, r));

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 250)));
await page.route('**/sw.js', r => r.abort());
await page.goto('http://127.0.0.1:8946/index.html');
await page.waitForTimeout(2500);
await page.waitForFunction(() => typeof db !== 'undefined' && typeof kaydetSatis === 'function', { timeout: 15000 });

const out = await page.evaluate(async () => {
  const R = [];
  const ok = (n, c, ek) => R.push((c ? 'PASS ' : 'FAIL ') + n + (!c && ek !== undefined ? ' → ' + ek : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    bosBaslat(); await sleep(200);
    const evet = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Evet, temizle')); if (evet) evet.click(); await sleep(250);
    db.kurUSD = 40; db.kurEUR = 43;
    db.cariler.push({ id: 501, tip: 'musteri', ad: "Musteri A'nın Firması", tel: '05551112233', bakiye: 1000 });
    db.cariler.push({ id: 503, tip: 'fason', ad: 'Fason USD', bakiye: 0, bakiyeUSD: 0, doviz: 'USD' });
    db.hesaplar[0].bakiye = 100000;
    if (!db.hesaplar.some(h => h.tur === 'pos')) db.hesaplar.push({ id: 9002, ad: 'POS Test', tur: 'pos', bakiye: 0 });
    db.ornek = false; save(); closeM();

    // ===== #6: esc() onclick içinde tek tırnağı korumaz → jsq şart =====
    ok("jsq: tek tırnak kaçırılıyor", jsq("a'b") === "a\\'b");
    const kum = "Süprem 30'luk";
    db.urunler.push({ id: 701, ad: 'Tişört', kat: 'Tişört', birim: 'adet', satis: 100, alis: 60, stok: 10, pb: 'TL', kumas: kum, renkler: [{ ad: 'Beyaz', stok: 10 }] });
    save();

    // ===== #3/#4: tahsilatta çek/kk → cariIsle + hesapId =====
    formOdeme(501); await sleep(120);
    document.getElementById('o-t').value = '300';
    document.getElementById('o-tur').value = 'Kredi Kartı';
    const pos = db.hesaplar.find(h => h.tur === 'pos');
    document.getElementById('o-hesap').value = String(pos.id);
    kaydetOdeme(501); await sleep(150);
    const kk = db.cekler.find(c => c.tur === 'kk');
    ok('#3: kk kaydında cariIsle=true', kk && kk.cariIsle === true, JSON.stringify(kk));
    ok('#4: kk kaydında seçilen POS hesabı saklandı', kk && kk.hesapId === pos.id, kk && kk.hesapId);
    const posOnce = pos.bakiye, hrOnce = db.hareketler.length;
    cekTahsil(kk.id); await sleep(120);
    ok('#4: kk tahsilatı POS hesabına girdi', pos.bakiye === posOnce + 300, pos.bakiye);
    ok('#20: çek/kk tahsili kasa hareketine yazıldı', db.hareketler.length === hrOnce + 1 && /Tahsil/.test(db.hareketler[db.hareketler.length - 1].tur));

    // karşılıksız → borç geri gelir
    formOdeme(501); await sleep(120);
    document.getElementById('o-t').value = '200';
    document.getElementById('o-tur').value = 'Çek';
    kaydetOdeme(501); await sleep(150);
    const cek = db.cekler.find(c => c.tur === 'cek' && c.durum === 'portfoyde');
    const bakOnce = cari(501).bakiye;
    cekKarsiliksiz(cek.id); await sleep(150);
    const btn = [...document.querySelectorAll('button')].find(b => /Karşılıksız/.test(b.textContent)); if (btn) btn.click(); await sleep(150);
    ok('#3: karşılıksız çekte borç geri eklendi', Math.abs(cari(501).bakiye - (bakOnce + 200)) < 0.01, cari(501).bakiye);

    // ===== #5: USD fason — iş emri borcu bakiyeUSD'ye =====
    const f = cari(503);
    cariBorcEkle(f, 4000);
    ok('#5: USD fasona TL borç kurdan bakiyeUSD\'ye yazıldı', Math.abs((f.bakiyeUSD || 0) - 100) < 0.01 && !(f.bakiye), 'usd=' + f.bakiyeUSD + ' tl=' + f.bakiye);

    // ===== #12: çok cihazlı id üretimi =====
    db.canliBulut = true;
    const id1 = nid('s'), id2 = nid('s');
    db.canliBulut = false;
    ok('#12: canlı senkronda id = sıra×100 + cihazNo', id1 >= 100000 && id2 === id1 + 100 && (id1 % 100) === CIHAZ_NO, id1 + ',' + id2);
    ok('#12: ID_SIRA cihaz ekli id\'den sırayı çıkarır', ID_SIRA(id1) === Math.floor(id1 / 100) && ID_SIRA(1043) === 1043);

    // ===== #21: tek net kâr =====
    const Rc = rapCtx();
    ok('#21: rapCtx.netKar = brutKar − isletmeGider', Math.abs(Rc.netKar - (Rc.brutKar - Rc.isletmeGider)) < 0.01);

    // ===== #29: yeni format bedenler fiş resminde [object Object] basmaz =====
    ok('#29: etiketBedenStr obje bedenleri çözer', etiketBedenStr({ bedenler: [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 2 }] }) === 'S-M');

    // ===== #15: cari düzenlemede bakiye alanı değişmediyse ezilmez =====
    formCari('musteri', 501); await sleep(150);
    cari(501).bakiye = 777; // "başka cihazda" bu arada değişti
    kaydetCari(501); await sleep(150);
    ok('#15: değişmeyen bakiye alanı güncel bakiyeyi ezmedi', cari(501).bakiye === 777, cari(501).bakiye);

    // ===== #1: gerçek verili cihazda #siparis müşteri moduna girmez =====
    ok('#1: gercekVeriVar() gerçek veride true', gercekVeriVar() === true);
    ok('#1: müşteri modunda save() mezar taşı üretmez', (() => { const t0 = JSON.stringify(db._tomb || {}); bulutMusteriMod = true; const c = db.cariler.pop(); save(); db.cariler.push(c); bulutMusteriMod = false; return JSON.stringify(db._tomb || {}) === t0; })());

    // ===== #10 (XSS): portal kumaş çipi tek tırnaklı kumaş adıyla çalışıyor =====
    portalOnizle(); await sleep(200);
    portalFiltreAcik = true; portalCiz(); await sleep(150);
    const chip = [...document.querySelectorAll('#pov [onclick]')].find(el => (el.getAttribute('onclick') || '').includes('portalKumas='));
    ok("#6/#10: kumaş çipi onclick'i jsq ile kaçırılmış", chip && chip.getAttribute('onclick').includes("30\\'luk"), chip && chip.getAttribute('onclick'));
    if (chip) { chip.click(); await sleep(100); }
    ok('#6/#10: çip tıklanınca filtre uygulandı (SyntaxError yok)', portalKumas === kum, portalKumas);
    portalKapat(); await sleep(100);

    for (const e of ['panel', 'satis', 'stok', 'cari', 'kasa', 'rapor', 'ayarlar']) { go(e); await sleep(80); }
  } catch (e) { R.push('EXC ' + (e && e.stack || e).slice(0, 400)); }
  return R;
});

out.push((errs.length === 0 ? 'PASS ' : 'FAIL ') + 'ekran turu temiz (pageerror yok)' + (errs.length ? ' → ' + errs.join(' | ') : ''));
console.log(out.join('\n'));
console.log('pageErrors:', errs.length ? errs : 'none');
const fails = out.filter(s => !s.startsWith('PASS')).length;
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
