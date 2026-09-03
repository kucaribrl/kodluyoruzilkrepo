// Çalıştırma: repo kökünde `npm i playwright` (bir kez) → `node test/01-hata-duzeltmeleri.test.mjs`
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
await new Promise(r => srv.listen(8941, r));

const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 250)));
await page.route('**/sw.js', r => r.abort());
await page.goto('http://127.0.0.1:8941/index.html');
await page.waitForTimeout(2500);
await page.waitForFunction(() => typeof db !== 'undefined' && typeof kaydetSatis === 'function', { timeout: 15000 });

const out = await page.evaluate(async () => {
  const R = [];
  const ok = (n, c, ek) => R.push((c ? 'PASS ' : 'FAIL ') + n + (!c && ek !== undefined ? ' → ' + ek : ''));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const confirmEvet = async () => { await sleep(150); const b = [...document.querySelectorAll('button')].find(x => /Evet|Kaydet|Yine de|Geri Al|Karşılıksız|temizle/i.test(x.textContent) && x.closest('#ov,#m,.modal,body')); if (b) b.click(); await sleep(150); };
  try {
    // temiz zemin
    bosBaslat(); await sleep(200);
    const evet = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Evet, temizle')); if (evet) evet.click(); await sleep(250);
    ok('H26: bosBaslat ortakHarcama+kupon temiz', (db.ortakHarcama || []).length === 0 && (db.kuponlar || []).length === 0,
      'oh=' + (db.ortakHarcama || []).length + ' kp=' + (db.kuponlar || []).length);

    db.kurUSD = 40; db.kurEUR = 43;
    db.cariler.push({ id: 501, tip: 'musteri', ad: 'Musteri A', tel: '05551112233', bakiye: 0 });
    db.cariler.push({ id: 502, tip: 'tedarikci', ad: 'Ted B', bakiye: 0, doviz: 'TL' });
    db.urunler.push({ id: 601, ad: 'Polo TL', kat: 'Polo', birim: 'adet', satis: 400, alis: 250, stok: 100, pb: 'TL' });
    db.urunler.push({ id: 602, ad: 'Polo USD', kat: 'Polo', birim: 'adet', satis: 12, alis: 8, stok: 100, pb: 'USD' });
    db.hesaplar[0].bakiye = 100000; save();

    // ===== H2: dövizli ürün fiyatı TL'ye çevriliyor =====
    sMusId = 501;
    ok('H2: musUrunFiyat USD ürün = 480 TL', musUrunFiyat(602) === 480, musUrunFiyat(602));
    ok('H2: portalFiyat USD ürün = 480 TL', Math.abs(portalFiyat(db.urunler.find(u => u.id === 602)) - 480) < 0.01, portalFiyat(db.urunler.find(u => u.id === 602)));

    // ===== USD SATIŞ (form üzerinden) =====
    formSatis(); await sleep(150);
    sMusId = 501; setPB('USD');
    sepet.push({ uid: 601, urun: 'Polo TL', mik: 2, birim: 'adet', fiyat: 400 });
    document.getElementById('s-kdv').value = '0';
    kaydetSatis(); await sleep(250);
    // limit yoksa direkt commit; stok yeterli
    const sUSD = db.satislar[db.satislar.length - 1];
    ok('USD satış: tutar $20 (800TL/40)', sUSD && Math.abs(sUSD.tutar - 20) < 0.01, sUSD && sUSD.tutar);
    const mA = cari(501);
    ok('USD satış: borç 800 TL', Math.abs(mA.bakiye - 800) < 0.5, mA.bakiye);

    // ===== H1: iade çift kur yok =====
    iadeAl(sUSD.id); await sleep(150);
    iadeSel = { 0: { '_': 1 } }; iadeCiz(); await sleep(80);
    iadeKaydet(); await sleep(200);
    const iade = db.satislar[db.satislar.length - 1];
    ok('H1: iade tutarı $10 (PB)', iade && iade.tip === 'iade' && Math.abs(iade.tutar - 10) < 0.01, iade && iade.tutar);
    ok('H1: cari 800-400=400 TL', Math.abs(mA.bakiye - 400) < 0.5, mA.bakiye);

    // ===== H21: ekstrede iade alacak =====
    const eks = cariEkstre(501);
    const iadeSatir = eks.evs.find(e => e.ad === 'İade');
    ok('H21: ekstre İade=alacak 400', iadeSatir && Math.abs((iadeSatir.alacak || 0) - 400) < 0.5, JSON.stringify(iadeSatir || {}));

    // ===== H15: enCokSatan tek kur =====
    const ec = enCokSatan(30, 5).find(x => x.uid === 601);
    ok('H15: çok satan ciro 800 TL (çift kur değil)', ec && Math.abs(ec.ciro - 800) < 0.5, ec && ec.ciro);

    // ===== ÇEKLİ SATIŞ + H3/H4 =====
    formSatis(); await sleep(150);
    sMusId = 501; setPB('TL');
    sepet.push({ uid: 601, urun: 'Polo TL', mik: 1, birim: 'adet', fiyat: 1000 });
    document.getElementById('s-kdv').value = '0';
    sOdemeler[0] = { tur: 'Çek', tutar: 1000, pb: 'TL', hesapId: 0, vade: Date.now() + 86400000, foto: '' };
    kaydetSatis(); await sleep(250);
    const sCek = db.satislar[db.satislar.length - 1];
    const cek = db.cekler.find(c => c.id === (sCek.odemeler[0] || {})._cekId);
    ok('çekli satış: çek oluştu + cariIsle', !!cek && cek.cariIsle === true, JSON.stringify(cek || {}).slice(0, 60));
    // H4: karşılıksız → borç geri
    const bOnce = mA.bakiye;
    cekKarsiliksiz(cek.id); await confirmEvet();
    ok('H4: karşılıksız → borç +1000', Math.abs(mA.bakiye - (bOnce + 1000)) < 0.5, mA.bakiye + ' vs ' + (bOnce + 1000));
    // ikinci çekli satış: tahsil et → silme engellensin
    formSatis(); await sleep(150);
    sMusId = 501; setPB('TL');
    sepet.push({ uid: 601, urun: 'Polo TL', mik: 1, birim: 'adet', fiyat: 500 });
    document.getElementById('s-kdv').value = '0';
    sOdemeler[0] = { tur: 'Çek', tutar: 500, pb: 'TL', hesapId: 0, vade: Date.now() + 86400000, foto: '' };
    kaydetSatis(); await sleep(250);
    const sCek2 = db.satislar[db.satislar.length - 1];
    const cek2 = db.cekler.find(c => c.id === (sCek2.odemeler[0] || {})._cekId);
    cekTahsil(cek2.id); await sleep(150);
    const sayiOnce = db.satislar.length;
    silSatis(sCek2.id); await sleep(150);
    ok('H3: tahsil edilmiş çekli satış silinemedi', db.satislar.length === sayiOnce && db.cekler.some(c => c.id === cek2.id), 'satis=' + db.satislar.length);

    // ===== H5: parti negatif bakiye =====
    const hh = { id: 9001, ad: 'Parti Kumaş', kat: 'Kumaş', birim: 'kg', stok: 10, renkler: [{ ad: 'Lacivert', stok: 10, top: 0, partiler: [{ kod: 'A1', mik: 10 }] }], kritik: 0, alis: 0, pb: 'TL' };
    db.hammadde.push(hh);
    malStoklaRenk(hh, 'Lacivert', -15);
    const lr = hh.renkler[0];
    ok('H5a: 10-15 → stok -5', Math.abs(lr.stok - (-5)) < 0.01, lr.stok);
    malStoklaRenk(hh, 'Lacivert', 20, 'B2');
    ok('H5b: -5+20 → stok 15 (hayalet yok)', Math.abs(lr.stok - 15) < 0.01, lr.stok);

    // ===== H6: dagit taşmıyor =====
    const dg = dagit(3, { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 });
    const dgSum = Object.values(dg).reduce((a, x) => a + x, 0);
    ok('H6: dagit(3, 6×eşit) toplam=3', dgSum === 3, JSON.stringify(dg));

    // ===== H14: kampanya bitişi =====
    db.kampanya = null;
    open_('t', `<input id="kmp-bas" value="Deneme"><input id="kmp-urun" value="0"><input id="kmp-met" value=""><input id="kmp-bitis" value="2026-09-01T18:30">`);
    kampanyaKaydet(); await sleep(100);
    ok('H14: kampanya bitişi geçerli', db.kampanya && db.kampanya.bitis > 0 && !isNaN(db.kampanya.bitis), db.kampanya && db.kampanya.bitis);

    // ===== H12/H13: fişler =====
    const sFis = { id: 777, tip: 'satis', mid: 501, mus: 'Musteri A', tarih: Date.now(), kalemler: [{ uid: 601, urun: 'Polo TL', mik: 2, birim: 'adet', fiyat: 400 }], araToplam: 800, iskonto: 0, kdv: 0, kdvTutar: 0, tasima: 5, ekstralar: [{ ad: 'Nakış', tutar: 3 }], tutar: 28, odenen: 0, kesik: 0, pb: 'USD', satisKur: 40, odemeler: [] };
    const html = fisHTML(sFis);
    ok('H12: fişte Nakış satırı var', html.includes('Nakış'));
    ok('H12: fişte Taşıma satırı var', html.includes('Taşıma / Kargo'));
    ok('H12: TOPLAM 28$ (taşıma dahil)', /TOPLAM[\s\S]{0,60}28(\.0)?\$/.test(html), (html.match(/TOPLAM[\s\S]{0,80}/)||[''])[0]);
    ok('H13: kalem fiyatı PB (10$)', html.includes('10.0$')||html.includes('10$'), '');
    const esc1 = fisEscPosText(sFis);
    ok('fiş: ESC/POS hatasız', !!esc1 && esc1.length > 100);
    const wa = fisText(sFis);
    ok('H16: WA fişinde 10$ kalem', wa.includes('10,00$') || wa.includes('$10'), wa.slice(0, 200));

    // ===== H39: vade çipleri =====
    formSatis(); await sleep(150);
    ok('H39: vade çipleri render', !!document.getElementById('sv-30'));
    setVade(30);
    ok('H39: vade %2.5 hesaplandı', vadeFarkiYuzde() === 2.5, vadeFarkiYuzde());
    setVade(0); closeM();

    // ===== H10/H27: portal onay =====
    db.cariler.push({ id: 555, tip: 'musteri', ad: 'Kupon Musterisi', bakiye: 0 }); // fiyat geçmişi temiz → katalog=liste fiyatı
    db.bekleyenPortal.push({ id: 8001, mus: 'Kupon Musterisi', mid: 555, tarih: Date.now(), kalemler: [{ uid: 601, urun: 'Polo TL', mik: 2, birim: 'adet', fiyat: 400 }], tutar: 720, kupon: { kod: 'X10', ind: 80 }, tel: '', adres: '', sehir: '' });
    save();
    portalOnay(8001); await sleep(250);
    const pSat = db.satislar[db.satislar.length - 1];
    ok('H10: kuponlu onay → satış 720', pSat && Math.abs(pSat.tutar - 720) < 0.5 && Math.abs(pSat.kalemler.reduce((a, k) => a + k.fiyat * k.mik, 0) - 720) < 0.5, pSat && pSat.tutar);
    db.bekleyenPortal.push({ id: 8002, mus: 'Musteri A', mid: 501, tarih: Date.now(), kalemler: [{ uid: 601, urun: 'Gizli Fiyat', mik: 1, birim: 'adet', fiyat: 0 }], tutar: 0, tel: '' });
    save();
    const satN = db.satislar.length;
    portalOnay(8002); await sleep(200);
    ok('H27: 0₺ kalemli onay engellendi', db.satislar.length === satN && db.bekleyenPortal.some(x => x.id === 8002));
    closeM();

    // ===== H37/38: tırnaklı kategori çipleri =====
    db.urunler.push({ id: 603, ad: "Test'li Ürün", kat: "Çocuk'lu", birim: 'adet', satis: 10, alis: 5, stok: 5, pb: 'TL' });
    save(); go('stok'); await sleep(150);
    const chip = [...document.querySelectorAll('.seg')].find(x => x.textContent.includes("Çocuk'lu"));
    ok('H38: tırnaklı kategori çipi render', !!chip);
    let chipOk = true; try { if (chip) chip.click(); await sleep(120); chipOk = stokKat === "Çocuk'lu"; } catch (e) { chipOk = false; }
    ok('H38: tırnaklı çip tıklanınca filtre çalıştı', chipOk, stokKat);

    // ===== H23: EUR seçeneği cari formunda yok =====
    formCari('tedarikci'); await sleep(120);
    const dv = document.getElementById('c-doviz');
    ok('H23: c-doviz sadece TL/USD', dv && dv.options.length === 2, dv && dv.options.length);
    closeM();

    // ===== H8: rapor tek NET KÂR (K-Z) =====
    go('rapor'); await sleep(250);
    const rh = document.getElementById('app').innerHTML;
    ok('H8: mükerrer NET KÂR kartı yok', !rh.includes('NET KÂR (brüt − giderler)'));
    ok('H8: K-Z tablosu duruyor', rh.includes('= NET KÂR'));

    // ===== ölü kod gitti =====
    ok('ölü kod: kumasStok/maliyetSim/ieDurakFiyat yok', typeof window.kumasStok === 'undefined' && typeof window.maliyetSim === 'undefined' && typeof window.ieDurakFiyat === 'undefined');

    // ===== ekran turu =====
    for (const e of ['panel', 'satis', 'stok', 'cari', 'envanter', 'uretim', 'kasa', 'rapor', 'ayarlar', 'daha']) { go(e); await sleep(80); }
    ok('ekran turu: hepsi açıldı', true); // asıl kontrol aşağıda: pageerror sayısı
  } catch (e) { R.push('EXC ' + (e && e.stack || e).slice(0, 400)); }
  return R;
});

// sayfada JS hatası (pageerror) olmamalı → hata varsa test düşer
out.push((errs.length === 0 ? 'PASS ' : 'FAIL ') + 'ekran turu temiz (pageerror yok)' + (errs.length ? ' → ' + errs.join(' | ') : ''));
console.log(out.join('\n'));
console.log('pageErrors:', errs.length ? errs : 'none');
const fails = out.filter(s => !s.startsWith('PASS')).length;
await browser.close(); srv.close();
process.exit(fails ? 1 : 0);
