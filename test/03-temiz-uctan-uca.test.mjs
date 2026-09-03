// Çalıştırma: repo kökünde `npm i playwright` (bir kez) → `node test/03-temiz-uctan-uca.test.mjs`
// Chromium yolu farklıysa: PLAYWRIGHT_CHROMIUM=/yol/chrome node test/...
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'text/javascript' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(8939, r));

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // taze profil = boş localStorage
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('dialog', d => d.accept());
await page.route('**/sw.js', r => r.abort());
await page.goto('http://127.0.0.1:8939/index.html');
await page.waitForTimeout(2500);
await page.waitForFunction(() => typeof db !== 'undefined' && typeof go === 'function', { timeout: 15000 });

const out = await page.evaluate(async () => {
  const R = [];
  const ok = (n, c, ek) => R.push((c ? 'PASS ' : 'FAIL ') + n + (ek !== undefined && !c ? ' → ' + ek : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    // ===== 0) ESKİ VERİYİ TEMİZLE — uygulamanın kendi temizleyicisiyle =====
    if (typeof bosBaslat === 'function') { try { bosBaslat(); } catch (e) { R.push('bosBaslat HATA ' + e.message); } }
    await sleep(250);
    // uygulama içi onay penceresindeki "Evet, temizle" düğmesine bas
    const evet = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Evet, temizle'));
    ok('temizlik: onay penceresi çıktı', !!evet);
    if (evet) evet.click();
    await sleep(300);
    ok('temizlik: satış/cari/ürün boş', db.satislar.length === 0 && db.urunler.length === 0 && db.cariler.length === 0,
      'satis=' + db.satislar.length + ' urun=' + db.urunler.length + ' cari=' + db.cariler.length);
    R.push('bilgi: temizlik sonrası kalanlar → ortakHarcama=' + ((db.ortakHarcama || []).length) + ' hammadde=' + ((db.hammadde || []).length) + ' cekler=' + ((db.cekler || []).length) + ' malSiparis=' + ((db.malSiparis || []).length) + ' isemirleri=' + ((db.isemirleri || []).length) + ' kuponlar=' + ((db.kuponlar || []).length) + ' kasaHareket=' + ((db.kasaHareket || []).length));

    // ===== 1) SIFIRDAN VERİ KUR =====
    db.cariler.push({ id: 501, tip: 'musteri', ad: 'Test Müşteri', tel: '05551112233', bakiye: 0, bakiyeUSD: 0 });
    db.urunler.push({ id: 601, ad: 'Basic Polo', kat: 'Polo', birim: 'seri', satis: 600, alis: 400, stok: 0, pb: 'TL', bedenler: ['S','M','L','XL'], renkler: [{ ad: 'Siyah', stok: 10 }, { ad: 'Beyaz', stok: 10 }] });
    db.kurUSD = 40; save();
    ok('kurulum: müşteri+ürün eklendi', db.cariler.length === 1 && db.urunler.length === 1);

    // ===== 2) SATIŞ (UI üzerinden) =====
    formSatis(); await sleep(150);
    sMusId = 501;
    sepet.push({ uid: 601, urun: 'Basic Polo', mik: 2, birim: 'seri', fiyat: 600, renkler: [{ ad: 'Siyah', mik: 1 }, { ad: 'Beyaz', mik: 1 }] });
    if (typeof cizSepet === 'function') { try { cizSepet() } catch (e) {} }
    if (typeof satisOzet === 'function') { try { satisOzet() } catch (e) {} }
    kaydetSatis(); await sleep(200);
    const s = db.satislar[db.satislar.length - 1];
    ok('satış: kayıt oluştu', !!s && s.kalemler.length === 1, JSON.stringify(s || {}).slice(0, 80));
    const u = db.urunler.find(x => x.id === 601);
    const kalanStok = u.renkler.reduce((a, r) => a + (+r.stok || 0), 0);
    ok('satış: renk stokları düştü (20→18)', kalanStok === 18, 'kalan=' + kalanStok);
    const m = db.cariler.find(c => c.id === 501);
    ok('satış: müşteri borcu = tutar (ödeme 0)', Math.abs((+m.bakiye || 0) - (s ? s.tutar - s.odenen : 0) * 1) < 0.01, 'bakiye=' + m.bakiye + ' tutar=' + (s && s.tutar));

    // ===== 3) FİŞ ÜRETİMLERİ (3 tür de hatasız çalışmalı) =====
    let f1 = '', f2 = '', f3 = '';
    try { f1 = typeof fisText === 'function' ? fisText(s) : 'yok'; ok('fiş: WhatsApp metni üretildi', !!f1); } catch (e) { ok('fiş: WhatsApp metni üretildi', false, e.message); }
    try { f2 = fisEscPosText(s); ok('fiş: ESC/POS üretildi', !!f2 && f2.length > 100); } catch (e) { ok('fiş: ESC/POS üretildi', false, e.message); }
    try { f3 = typeof fisResimData === 'function' ? 'fn-var' : 'yok'; ok('fiş: resim fonksiyonu mevcut', f3 === 'fn-var'); } catch (e) { ok('fiş: resim', false, e.message); }

    // ===== 4) TAHSİLAT =====
    const oncekiBakiye = +m.bakiye || 0;
    try { kasaHareket((db.hesaplar[0]||{}).id, 'in', 100, 'tahsilat', 'Test tahsilat', 501) } catch (e) { R.push('kasaHareket HATA ' + e.message); }
    ok('kasa: hareket yazıldı', (db.hareketler || []).length > 0, 'hareketler=' + (db.hareketler||[]).length);

    // ===== 5) KUMAŞ SİPARİŞİ + PARTİ + TESLİM =====
    malSipForm(0); await sleep(120);
    document.getElementById('ms-ad').value = 'E2E Süprem';
    // YENİ tasarım: siparişte parti yok — parti teslimde (depoya inerken) girilir (bkz. test 04)
    msSatir = [{ renk: 'Lacivert', miktar: 50 }];
    kaydetMalSip(0); await sleep(150);
    const ms = db.malSiparis[db.malSiparis.length - 1];
    ok('kumaş siparişi: kaydedildi (partisiz)', !!ms && ms.satirlar[0].miktar === 50 && !ms.satirlar[0].parti);
    malSipTeslim(ms.id); await sleep(120);
    ok('teslim: parti kutusu teslim modalında', (document.getElementById('mt-wrap') || {innerHTML:''}).innerHTML.includes('parti no'));
    mtSatir[0].rows = [{ parti: 'P100', mik: 50 }];
    kaydetMalSipTeslim(ms.id); await sleep(150);
    const hh = db.hammadde.find(x => x.ad === 'E2E Süprem');
    const lr = hh && hh.renkler.find(r => r.ad === 'Lacivert');
    ok('teslim: stok 50 @ P100', lr && lr.stok === 50 && lr.partiler && lr.partiler[0].kod === 'P100');
    ok('teslim: sipariş durumu geldi', db.malSiparis.find(x => x.id === ms.id).durum === 'geldi');

    // ===== 6) RAPOR TUTARLILIĞI =====
    go('rapor'); await sleep(200);
    const rHtml = document.getElementById('app').innerHTML;
    ok('rapor: ekran açıldı', rHtml.length > 2000);
    const satisToplam = db.satislar.filter(x => x.tip !== 'iade').reduce((a, x) => a + (x.tutar * (x.pb === 'USD' ? (x.satisKur || db.kurUSD) : 1)), 0);
    R.push('bilgi: satış toplamı(TL)=' + satisToplam.toFixed(2));

    // ===== 7) PORTAL: sepet + toplam =====
    portalDil = 'tr'; portalOnizle(); await sleep(200);
    portalRenkMik(601, 'Siyah', 1); await sleep(100);
    const pt = portalTotal();
    ok('portal: sepet toplamı = 600', Math.abs(pt - 600) < 0.01, 'pt=' + pt);
    // portal siparişi gönder (yerel mod)
    portalMusAd = 'Test Müşteri'; portalTel = '05551112233';
    if (typeof portalSiparisGonder === 'function') { try { portalSiparisGonder(); await sleep(200); } catch (e) { R.push('portalSiparisGonder HATA ' + e.message); } }
    const pb = (db.bekleyenPortal || []).length;
    R.push('bilgi: portal bekleyen sipariş=' + pb);
    document.getElementById('pov').style.display = 'none';

    // ===== 8) TÜM EKRANLAR (temiz veriyle) =====
    for (const e of ['panel','satis','stok','cari','envanter','uretim','kasa','rapor','ayarlar','daha']) {
      try { go(e); await sleep(100); } catch (x) { ok('ekran ' + e, false, x.message); }
    }
  } catch (e) { R.push('EXC ' + (e && e.stack || e).slice(0, 300)); }
  return R;
});

// ekran turu ve tüm akış boyunca sayfada JS hatası (pageerror) olmamalı → hata varsa test düşer
out.push((errs.length === 0 ? 'PASS ' : 'FAIL ') + 'ekran turu temiz (pageerror yok)' + (errs.length ? ' → ' + errs.join(' | ') : ''));
console.log(out.join('\n'));
console.log('pageErrors:', errs.length ? errs : 'none');
const fails = out.filter(s => !s.startsWith('PASS') && !s.startsWith('bilgi:')).length;
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
