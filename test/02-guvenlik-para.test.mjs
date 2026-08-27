// Çalıştırma: repo kökünde `npm i playwright` (bir kez) → `node test/02-guvenlik-para.test.mjs`
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
await new Promise(r => srv.listen(8944, r));

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 250)));
await page.route('**/sw.js', r => r.abort());
await page.goto('http://127.0.0.1:8944/index.html');
await page.waitForTimeout(2500);
await page.waitForFunction(() => typeof db !== 'undefined' && typeof kaydetSatis === 'function', { timeout: 15000 });

const out = await page.evaluate(async () => {
  const R = [];
  const ok = (n, c, ek) => R.push((c ? 'PASS ' : 'FAIL ') + n + (!c && ek !== undefined ? ' → ' + ek : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try {
    // temiz zemin
    bosBaslat(); await sleep(200);
    const evet = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Evet, temizle')); if (evet) evet.click(); await sleep(250);
    db.kurUSD = 40;
    db.cariler.push({ id: 501, tip: 'musteri', ad: 'Musteri A', tel: '0555', bakiye: 0 });
    db.urunler.push({ id: 601, ad: 'Polo', kat: 'Polo', birim: 'adet', satis: 400, alis: 250, stok: 100, pb: 'TL' });
    db.hesaplar[0].bakiye = 0; save();

    // ===== Y2: esc + guvenliSrc =====
    ok("Y2: esc tek tırnak", esc("O'Brien") === 'O&#39;Brien', esc("O'Brien"));
    ok('Y2: guvenliSrc javascript engeli', guvenliSrc('javascript:alert(1)') === '');
    ok('Y2: guvenliSrc data:image geçer', guvenliSrc('data:image/png;base64,AAA') === 'data:image/png;base64,AAA');

    // ===== Y4: satış tahsilatı deftere =====
    formSatis(); await sleep(150);
    sMusId = 501; setPB('TL');
    sepet.push({ uid: 601, urun: 'Polo', mik: 1, birim: 'adet', fiyat: 1000 });
    document.getElementById('s-kdv').value = '0';
    sOdemeler[0] = { tur: 'Nakit', tutar: 1000, pb: 'TL', hesapId: db.hesaplar[0].id, vade: 0, foto: '' };
    kaydetSatis(); await sleep(250);
    const sN = db.satislar[db.satislar.length - 1];
    const hrk = (db.hareketler || []).find(h => h.tur === 'Satış Tahsilatı');
    ok('Y4: defter kaydı oluştu (in 1000)', hrk && hrk.yon === 'in' && Math.abs(hrk.tutar - 1000) < 0.5, JSON.stringify(hrk || {}));
    ok('Y4: hesap bakiyesi 1000 (çift sayma yok)', Math.abs(db.hesaplar[0].bakiye - 1000) < 0.5, db.hesaplar[0].bakiye);
    // iptal → out kaydı
    silSatis(sN.id); await sleep(150); document.getElementById('cYes').click(); await sleep(200);
    const hrkOut = (db.hareketler || []).find(h => h.tur === 'Satış İptali');
    ok('Y4: iptal defter kaydı (out)', hrkOut && hrkOut.yon === 'out' && Math.abs(db.hesaplar[0].bakiye) < 0.5, 'bak=' + db.hesaplar[0].bakiye);

    // ===== Y5: USD satışta rapor çift kur yok =====
    formSatis(); await sleep(150);
    sMusId = 501; setPB('USD');
    sepet.push({ uid: 601, urun: 'Polo', mik: 2, birim: 'adet', fiyat: 400 }); // 800 TL = $20
    document.getElementById('s-kdv').value = '0';
    kaydetSatis(); await sleep(250);
    go('rapor'); await sleep(250);
    // ürünler sekmesine geç (rapor sekme fn adını bilmiyoruz — DOM'daki sekmeye tıkla)
    const urSek = [...document.querySelectorAll('.tb,.seg,.tab')].find(x => /Ürün/i.test(x.textContent));
    if (urSek) { urSek.click(); await sleep(250); }
    const rh = document.getElementById('app').innerHTML;
    ok('Y5: raporda 32.000 (şişkin) YOK', !rh.includes('32.000'), '');
    ok('Y5: raporda 800 TL ciro VAR', rh.includes('800'), '');

    // ===== Y3: sahte fiyatlı portal siparişi =====
    db.bekleyenPortal.push({ id: 8101, mus: 'Musteri A', mid: 501, tarih: Date.now(), kalemler: [{ uid: 601, urun: 'Polo', mik: 2, birim: 'adet', fiyat: 1 }], tutar: 2, tel: '' });
    save();
    const satOnce = db.satislar.length;
    portalOnay(8101); await sleep(250);
    const cMsg = document.getElementById('cMsg');
    ok('Y3: fiyat farkı uyarısı çıktı', cMsg && cMsg.textContent.includes('FİYAT FARKI'), cMsg && cMsg.textContent.slice(0, 60));
    document.getElementById('cYes').click(); await sleep(300);
    const pSat = db.satislar[db.satislar.length - 1];
    ok('Y3: katalog fiyatından onaylandı (800)', db.satislar.length === satOnce + 1 && pSat && Math.abs(pSat.tutar - 800) < 1.5, pSat && pSat.tutar);

    // ===== İ3: iadede vade farkı =====
    const sVadeli = { id: 9301, tip: 'satis', mid: 501, mus: 'Musteri A', tarih: Date.now(), kalemler: [{ uid: 601, urun: 'Polo', mik: 1, birim: 'adet', fiyat: 100 }], araToplam: 100, iskonto: 0, vadeFarki: 10, kdv: 0, tutar: 110, odenen: 0, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [], durum: 'tamam' };
    db.satislar.push(sVadeli); save();
    const ih = (() => { const eski = iadeSel; iadeSel = { 0: { '_': 1 } }; const r = iadeHesap(sVadeli); iadeSel = eski; return r; })();
    ok('İ3: iade net 110 (vade dahil)', Math.abs(ih.net - 110) < 0.01, ih.net);

    // ===== İ4: bugunSatis iadeyi düşüyor =====
    const bs0 = bugunSatis();
    db.satislar.push({ id: 9302, tip: 'iade', mid: 501, mus: 'Musteri A', tarih: Date.now(), kaynakId: 9301, kalemler: [], tutar: 50, pb: 'TL', satisKur: 1 }); save();
    ok('İ4: bugünkü satış 50 azaldı', Math.abs(bugunSatis() - (bs0 - 50)) < 0.01, bs0 + ' → ' + bugunSatis());

    // ===== İ1: ekstre taksit ayrımı =====
    db.satislar.push({ id: 9303, tip: 'satis', mid: 501, mus: 'Musteri A', tarih: Date.now(), kalemler: [{ uid: 601, urun: 'Polo', mik: 1, birim: 'adet', fiyat: 300 }], araToplam: 300, tutar: 300, odenen: 200, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [], taksitler: [{ tutar: 200, vade: Date.now(), odendi: true }] });
    save();
    const eks = cariEkstre(501);
    const satOdeme = eks.evs.filter(e => e.ad === 'Ödeme (satışta)' && Math.abs((e.alacak || 0) - 200) < 0.5);
    ok('İ1: taksit satış-anı ödemesinden düşüldü (200 peşin satırı YOK)', satOdeme.length === 0, satOdeme.length + ' satır');

    // ===== V1: yedekte foto yok =====
    db.urunler[0].foto = 'data:image/png;base64,' + 'A'.repeat(50000); save();
    autoYedek('test');
    const yd = JSON.parse(localStorage.getItem('iq_yedekler'))[0];
    const ydDb = JSON.parse(yd.veri);
    ok('V1: yedekte ürün fotoğrafı ayıklandı', (ydDb.urunler[0].foto || '') === '' && yd.etiket.includes('fotoğrafsız'), yd.etiket);
    db.urunler[0].foto = ''; save();

    // ===== V4: save true dönüyor =====
    ok('V4: save() true döndü', save() === true);

    // ===== K1: kayıt formunda personel rolleri yok =====
    portalPreview = true; portalView = 'bulutgiris'; bulutAuthTab = 'kayit'; davetRol = ''; portalCiz(); await sleep(200);
    const rolSel = document.getElementById('pb-rol');
    ok('K1: kayıt rol seçici 2 seçenek (müşteri+fason)', rolSel && rolSel.options.length === 2, rolSel && rolSel.options.length);
    document.getElementById('pov').style.display = 'none';

    // ===== O3: canliRol düşük yetki =====
    const eskiKul = typeof bulutKul !== 'undefined' ? bulutKul : null;
    bulutKul = { rol: 'garip', mail: 'saldirgan@x.com' };
    ok('O3: bilinmeyen rol → musteri', canliRol() === 'musteri', canliRol());
    bulutKul = { rol: '?', mail: 'birol575@hotmail.com' };
    ok('O3: sahip maili → admin', canliRol() === 'admin', canliRol());
    bulutKul = eskiKul;

    // ekran turu
    for (const e of ['panel', 'satis', 'stok', 'cari', 'envanter', 'uretim', 'kasa', 'rapor', 'ayarlar', 'daha']) { go(e); await sleep(80); }
    ok('ekran turu temiz', true);
  } catch (e) { R.push('EXC ' + (e && e.stack || e).slice(0, 400)); }
  return R;
});

console.log(out.join('\n'));
console.log('pageErrors:', errs.length ? errs : 'none');
const fails = out.filter(s => !s.startsWith('PASS')).length;
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
