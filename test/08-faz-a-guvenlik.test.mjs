// Faz A (Eylül 2026 inceleme raporu — kritik + güvenlik): yönetici kapısı adminMi, sıfırlamada mezar taşı yok,
// IndexedDB silme, portal belge şeması/kupon yeniden hesabı, mükerrer onay, analitik XSS, renksiz↔renkli stok, yedek kalıcılığı.
// Çalıştırma: `node test/08-faz-a-guvenlik.test.mjs`  (PLAYWRIGHT_CHROMIUM=/yol/chrome ile sistem Chromium'u)
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
const evet = async () => { await wait(150); await ev(() => document.getElementById('cYes').click()); await wait(250); };

// ---- Y2/Y3: yönetici kapısı ----
T('adminMi: patron → true', await ev(() => adminMi() === true));
await ev(() => { db.rol = 'magaza'; db.rolAyar = { magaza: { para: true } }; save(); });
T('mağaza (para izinli): paraGoster true ama adminMi FALSE', await ev(() => paraGoster() === true && adminMi() === false));
await ev(() => { rolIzinSet('magaza', 'y', 'kar', true); });
T('rolIzinSet: mağaza kendi iznini değiştiremez', await ev(() => !(db.rolAyar.magaza && db.rolAyar.magaza.kar)));
await ev(() => { try { closeM() } catch (e) {} setRol('patron'); });
await wait(200);
T('setRol("patron"): mağaza kendini yükseltemez (PIN/yönetici istenir)', await ev(() => db.rol === 'magaza'));
await ev(() => { try { closeM() } catch (e) {} go('ayarlar'); });
await wait(250);
T('Ayarlar (mağaza): Kullanıcılar & Roller / Veri Güvenliği gizli', await ev(() => { const h = document.getElementById('app').innerHTML; return !h.includes('Kullanıcılar &amp; Roller') && !h.includes('Kullanıcılar & Roller') && !h.includes('sifirla()') && !h.includes('bosBaslat()'); }));
T('topluZam/sifirla/bosBaslat/guvenliCikis (mağaza) → engellenir', await ev(() => { let n = 0; const ov = document.getElementById('ov'); const before = (db.urunler || []).length; topluZam(); if (!ov.classList.contains('show')) n++; sifirla(); if ((db.urunler || []).length === before && db.rol === 'magaza') n++; bosBaslat(); if ((db.urunler || []).length === before) n++; return n === 3; }));
await ev(() => { db.personelMod = true; setRol('depocu'); });
T('personel modunda setRol değişmez', await ev(() => db.rol === 'magaza'));
await ev(() => { db.personelMod = false; setRol('patron', true); });
T('setRol("patron", zorla): PIN/yönetici yolu çalışır', await ev(() => db.rol === 'patron' && adminMi()));
T('rolAyar ayrı "yonetim" domeninde, ayar belgesinde değil', await ev(() => CANLI_DOMEN.yonetim && CANLI_DOMEN.yonetim.includes('rolAyar') && !CANLI_DOMEN.ayar.includes('rolAyar') && ROL_OKU.magaza.includes('yonetim') && !ROL_YAZ.magaza.includes('yonetim')));

// ---- K1: sıfırla mezar taşı üretmez, senkron bayrağı kapanır ----
await ev(() => { db.urunler.push({ id: 777001, ad: 'Gerçek Ürün', kod: 'GR1', kat: 'X', renkler: [{ ad: 'Siyah', stok: 3 }], stok: 3, fiyat: 10, alis: 5 }); db.cariler.push({ id: 777002, ad: 'Gerçek Cari', tip: 'musteri', bakiye: 0 }); save(); });
await ev(() => sifirla()); await evet();
T('sifirla: mezar taşı YOK, demo verisi, canliBulut=false', await ev(() => (!db._tomb || Object.keys(db._tomb).length === 0) && db.ornek === true && db.canliBulut === false));
T('sifirla sonrası save(): yine mezar taşı yok', await ev(() => { save(); return !db._tomb || Object.values(db._tomb).every(o => !o || Object.keys(o).length === 0); }));
T('otoSenkron: canliBulut=false iken bağlanmaz', await ev(async () => (await otoSenkron()) === false));

// ---- K2: IndexedDB silme ----
T('idbSil: yazılan kopya silinir', await ev(async () => { db._t = Date.now(); await new Promise(r => { idbYaz(); setTimeout(r, 1000); }); const once = await idbOku(); const s = await idbSil(); const sonra = await idbOku(); return !!once && s === true && sonra === null; }));

// ---- Y5/Y23/K6: portal belge şeması + kupon ----
const norm = await ev(() => siparisNormalize({ mus: { x: 1 }, mid: 5, uid: 'u1', tutar: -50000, kalemler: 'bozuk', kupon: { kod: 'x', indirim: 9999999 }, istekUid: '1);alert(1);(' }));
T('siparisNormalize: mid yok sayılır, tutar≥0, kalemler dizi, kupon yalnız kod, istekUid sayı', norm.mid === 0 && norm.tutar === 0 && Array.isArray(norm.kalemler) && norm.kalemler.length === 0 && norm.kupon && norm.kupon.kod === 'x' && !('indirim' in norm.kupon) && norm.istekUid === 0 && typeof norm.mus === 'string', norm);
const norm2 = await ev(() => siparisNormalize({ mus: 'Ali', kalemler: [{ uid: '12', mik: '3', fiyat: 'abc', kademeInd: '<img src=x onerror=1>', renkler: [{ ad: 'Siyah', mik: '2' }] }] }));
T('siparisNormalize: kalem alanları sayıya/metne zorlanır', norm2.kalemler[0].uid === 12 && norm2.kalemler[0].mik === 3 && norm2.kalemler[0].fiyat === 0 && norm2.kalemler[0].kademeInd === 0 && norm2.kalemler[0].renkler[0].mik === 2, norm2.kalemler[0]);
// K6: sahte kuponla 1 ₺'ye sipariş → onayda FİYAT FARKI sorulur, satış oluşmaz
await ev(() => { db.rol = 'patron'; db.urunler.push({ id: 778001, ad: 'Kupon Test', kod: 'KT1', kat: 'X', fiyat: 500, satis: 500, alis: 200, birim: 'adet', stok: 100, renkler: [{ ad: 'Siyah', stok: 100 }] }); db.kuponlar = [{ kod: 'GERCEK', tip: 'yuzde', deger: 10, aktif: true }];
  db.bekleyenPortal.push({ id: 779001, mus: 'Saldırgan', mid: 0, tarih: Date.now(), kalemler: [{ uid: 778001, urun: 'Kupon Test', mik: 50, birim: 'adet', fiyat: 1 }], tutar: 1, kupon: { kod: 'X', indirim: 9999999 } }); save(); const n = db.satislar.length; portalOnay(779001); window.__satisN = n; });
await wait(250);
T('K6: sahte kupon → FİYAT FARKI onayı çıkar, satış oluşmaz', await ev(() => document.getElementById('cov').classList.contains('show') && document.getElementById('cMsg').textContent.includes('FİYAT FARKI') && db.satislar.length === window.__satisN));
await ev(() => document.getElementById('cNo').click());
await ev(() => { const o = db.bekleyenPortal.find(x => x.id === 779001); const kat = portalKalemFiyat({ uid: 778001, mik: 50 }).net * 50; window.__bek = kat - Math.round(kat * 0.10); o.kupon = { kod: 'GERCEK' }; o.tutar = window.__bek; save(); portalOnay(779001); });
await wait(250);
T('K6: gerçek kupon (%10) katalog+kademe fiyatından yeniden hesaplanır → fark sorulmaz, satış doğru tutarla oluşur', await ev(() => !document.getElementById('cov').classList.contains('show') && db.satislar.some(s => s.mus === 'Saldırgan' && Math.abs(s.tutar - window.__bek) < 1)), await ev(() => ({ bek: window.__bek, cov: document.getElementById('cMsg').textContent.slice(0, 120) })));
// Y6: aynı bulutId ikinci kez onaylanamaz
await ev(() => { db.islenenSiparis = db.islenenSiparis || []; db.islenenSiparis.push('BULUT-XYZ'); db.bekleyenPortal.push({ id: 779002, bulutId: 'BULUT-XYZ', mus: 'Tekrar', mid: 0, tarih: Date.now(), kalemler: [{ uid: 778001, urun: 'Kupon Test', mik: 1, birim: 'adet', fiyat: 500 }], tutar: 500 }); save(); window.__n2 = db.satislar.length; portalOnay(779002); });
await wait(200);
T('Y6: işlenmiş bulutId → mükerrer kayıt kaldırılır, satış oluşmaz', await ev(() => db.satislar.length === window.__n2 && !db.bekleyenPortal.some(x => x.id === 779002)));

// ---- K7: analitik alanları sayıya zorlanır (XSS/onclick enjeksiyonu yok) ----
await ev(() => pazarAnalizCiz([{ mid: '1);alert(1);(', mus: 'Kötü', gorunum: { '778001': { kez: '<img src=x onerror=1>', sure: 5 } }, sepet: [{ uid: 778001, mik: '<b>3</b>' }], talep: false, guncel: Date.now() }]));
await wait(150);
T('K7: analitik HTML’inde enjeksiyon yok', await ev(() => { const h = document.getElementById('mB').innerHTML; return !h.includes('<img src=x') && !h.includes('alert(1)'); }));
await ev(() => closeM());

// ---- Y12/Y13: renksiz ↔ renkli stok ----
const y12 = await ev(() => { const h = { id: 1, ad: 'Fermuar', kat: 'Aksesuar', stok: 500, renkler: [] }; malStoklaRenk(h, 'Siyah 18cm', 200); return h; });
T('Y12: renksiz 500 + ilk renkli 200 → "—" 500 korunur, toplam 700', y12.stok === 700 && y12.renkler.some(r => r.ad === '—' && r.stok === 500) && y12.renkler.some(r => r.ad === 'Siyah 18cm' && r.stok === 200), y12);
const y13 = await ev(() => { const h = { id: 2, ad: 'Düğme', kat: 'Aksesuar', stok: 0, renkler: [{ ad: 'Siyah', stok: 0 }] }; malStoklaRenk(h, '', 500); malStoklaRenk(h, 'Siyah', -100); return h; });
T('Y13: renkli malzemeye renksiz giriş "—" rengine; renk toplamı = h.stok', y13.renkler.some(r => r.ad === '—' && r.stok === 500) && Math.abs(y13.stok - 400) < 0.01 && y13.renkler.find(r => r.ad === 'Siyah').stok === -100, y13);

// ---- Y11: yedeğe dönüş kalıcı (db._t yenilenir) ----
await ev(() => { autoYedek('test'); db._t = 1; otoYedekGeri(0); }); await evet();
T('Y11: yedek geri yüklenince _t güncel (IDB kopyası ezmez)', await ev(() => Date.now() - (+db._t || 0) < 10000));

// ---- ekran turu ----
for (const s of ['ozet', 'stok', 'satis', 'cari', 'kasa', 'envanter', 'uretim', 'rapor', 'ayar', 'portal']) { await ev(x => { try { go(x) } catch (e) { window.__goErr = x + ': ' + e.message } }, s); await wait(80); }
T('ekran turu hatasız', !(await ev(() => window.__goErr || '')));
console.log('pageErrors:', errs.length ? errs : 'none'); if (errs.length) fail++;
await br.close(); srv.close();
console.log(`\nSONUÇ: ${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
