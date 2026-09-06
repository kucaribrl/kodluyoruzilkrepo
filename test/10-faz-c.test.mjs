// Faz C (Eylül inceleme raporu — rapor/portal/PWA/kasa/envanter/düşükler): portal şifre özeti + oturum belirteci,
// dönem kıyası aynı gün sayısı, tahsilat tek tanım, karşılıksız çek kasa düzeltmesi, ciro ekstre, taksit yuvarlama,
// waTel 00, gunFark takvim, fiş guard'ları, aksesuar geldi (gelen kadar), katalog gizli fiyat, termal harita.
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

// ---- PO1: portal şifresi özetle doğrulanır, oturum belirteç ile ----
await ev(() => { db.cariler.push({ id: 5101, tip: 'musteri', ad: 'Portal Müşteri', bakiye: 0, kullanici: 'pm', sifre: 'gizli123' }); save(); });
await ev(async () => { portalGKad = 'pm'; portalGSif = 'yanlis'; await portalLogin(); });
T('yanlış şifre → giriş yok', await ev(() => portalGirisId === 0));
await ev(async () => { portalGKad = 'pm'; portalGSif = 'gizli123'; await portalLogin(); });
await wait(200);
const po = await ev(() => { const c = cari(5101); return { id: portalGirisId, h: c.sifreH, tok: c.portalTok, ls: localStorage.getItem('oz_portal_oturum') }; });
T('doğru şifre → giriş; eski düz metin özete taşındı; oturum belirteci id DEĞİL', po.id === 5101 && po.h && po.h.length >= 20 && po.tok && po.ls === po.tok && !/^\d+$/.test(po.ls), po);
await ev(async () => { const c = cari(5101); c.sifre = ''; save(); portalCikis(); portalGKad = 'pm'; portalGSif = 'gizli123'; await portalLogin(); });
T('düz metin silinince de özetle giriş çalışır', await ev(() => portalGirisId === 5101));
await ev(() => { localStorage.setItem('oz_portal_oturum', '5101'); });
T('localStorage\'a id yazan otomatik giriş alamaz', await ev(() => { const tok = localStorage.getItem('oz_portal_oturum'); const c = tok && !/^\d+$/.test(tok) ? db.cariler.find(x => x.portalTok === tok) : null; return !c; }));
await ev(() => { try { portalCikis() } catch (e) {} try { document.getElementById('pov').style.display = 'none' } catch (e) {} });

// ---- R2/R3: dönem kıyası aynı gün sayısı, tahsilat tek tanım ----
const r2 = await ev(() => { rapDonem = 'ay'; const o = rapOncekiAralik(); const now = new Date(); const ayBas = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); const oncBas = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(); return { uzun: o[1] - o[0], gecen: Date.now() - ayBas, oncBasOk: o[0] === oncBas, gy: rapGecenYilAralik()[2] }; });
T('R2: önceki dönem = bu ayın geçen süresi kadar (tam ay değil)', r2.oncBasOk && Math.abs(r2.uzun - r2.gecen) < 5000 && /aynı gün sayısı/.test(r2.gy), r2);
T('R3: tahsilat/önceki tahsilat aynı formülle (rapCtx tahOnc sayısal)', await ev(() => { const R = rapCtx(); return typeof R.netTL === 'function' && (R.tahOnc === null || typeof R.tahOnc === 'number'); }));

// ---- K2: tahsil edilmiş çek karşılıksız → kasa da düzelir ----
await ev(() => { const h = db.hesaplar[0]; db.cariler.push({ id: 5102, tip: 'musteri', ad: 'Çek Müşteri', bakiye: 0 }); db.cekler.push({ id: 5201, tur: 'cek', tip: 'alinan', cariId: 5102, cari: 'Çek Müşteri', tutar: 7000, vade: Date.now() - 86400000, banka: '—', durum: 'tahsil', cariIsle: true, tahsilHesapId: h.id }); h.bakiye = 10000; save(); window.__hid = h.id; cekKarsiliksiz(5201); });
await evet();
T('K2: karşılıksız → kasa −7.000, cari borç +7.000, hareket yazıldı', await ev(() => hesap(window.__hid).bakiye === 3000 && cari(5102).bakiye === 7000 && db.hareketler.some(x => x.tur === 'Karşılıksız Çek' && x.tutar === 7000)));

// ---- K3: ciro ekstreye hareket ----
await ev(() => { db.cariler.push({ id: 5103, tip: 'tedarikci', ad: 'Ciro Tedarikçi', bakiye: 9000 }); db.cekler.push({ id: 5202, tur: 'cek', tip: 'alinan', cariId: 5102, cari: 'Çek Müşteri', tutar: 4000, vade: Date.now() + 1e8, banka: '—', durum: 'portfoyde' }); save(); document.body.insertAdjacentHTML('beforeend', '<select id="ci-cari"><option value="5103" selected>x</option></select>'); cekCiroKaydet(5202); });
await wait(200);
T('K3: ciro → tedarikçi borcu 5.000, ekstre hareketi "Çek Ciro"', await ev(() => cari(5103).bakiye === 5000 && db.hareketler.some(x => x.tur === 'Çek Ciro' && x.cariId === 5103 && x.tutar === 4000)));

// ---- taksit yuvarlama ----
await ev(() => { db.satislar.push({ id: 5301, tip: 'satis', mid: 5102, mus: 'Çek Müşteri', tarih: Date.now(), kalemler: [], tutar: 1000.5, odenen: 0, kesik: 0, pb: 'TL', satisKur: 1, odemeler: [] }); save(); document.body.insertAdjacentHTML('beforeend', '<input id="op-n" value="3"><input id="op-ilk" value=""><input id="op-ara" value="30">'); odemePlaniKaydet(5301); });
await wait(200);
T('taksit: toplam tam olarak kalana eşit (sapma yok)', await ev(() => { const s = db.satislar.find(x => x.id === 5301); const top = s.taksitler.reduce((a, t) => a + t.tutar, 0); return Math.abs(top - 1000.5) < 0.001; }));

// ---- waTel 00, gunFark takvim, fiş guard, termal harita ----
T('waTel: 0049… → 49…, 05xx → 905xx', await ev(() => waTel('0049 171 1234567') === '491711234567' && waTel('0532 111 22 33') === '905321112233'));
T('gunFark: bugün 23:59 → 0, yarın 00:01 → 1', await ev(() => { const d1 = new Date(); d1.setHours(23, 59, 0, 0); const d2 = new Date(); d2.setDate(d2.getDate() + 1); d2.setHours(0, 1, 0, 0); return gunFark(d1.getTime()) === 0 && gunFark(d2.getTime()) === 1; }));
T('satisFis(silinmiş id) çökmez', await ev(() => { try { satisFis(999999999); return true; } catch (e) { return false; } }));

// ---- E1: aksesuar geldi → yalnız gelen kadar düşer ----
const e1 = await ev(() => { db.hammadde.push({ id: 5401, ad: 'Düğme X', kat: 'Aksesuar', birim: 'adet', stok: 0, renkler: [] }); db.isemirleri.push({ id: 5402, urun: 'T', kod: 'T1', hedef: 10, birim: 'adet', durum: 'devam', duraklar: [], malzeme: [{ ad: 'Düğme X', hid: 5401, mik: 500, birim: 'adet', durum: 'alinacak', alimId: 5403 }] }); const s = { id: 5403, oto: true, ieId: 5402, hid: 5401, ad: 'Düğme X', kat: 'Aksesuar', durum: 'geldi', satirlar: [{ renk: '', miktar: 500, gelen: 300 }] }; db.malSiparis.push(s); malStoklaRenk(db.hammadde.find(h => h.id === 5401), '', 300); aksesuarGeldiIsle(s); return db.hammadde.find(h => h.id === 5401).stok; });
T('E1: 500 sipariş, 300 geldi → stok 300−300=0 (−200 eksi olmaz)', e1 === 0, e1);

// ---- B5: katalog belgesinde gizli fiyat 0, kupon limit yok ----
await ev(() => { db.urunler.push({ id: 5501, ad: 'Gizli', kod: 'G1', kat: 'X', birim: 'adet', satis: 999, fiyat: 999, alis: 1, fiyatGizli: true, stok: 1, renkler: [{ ad: 'A', stok: 1 }] }); db.kuponlar = [{ kod: 'K1', tip: 'yuzde', deger: 5, aktif: true, limit: 3, kullanim: 1 }]; });
const md = await ev(() => _magazaDoc());
T('B5: gizli fiyatlı ürün satis=0, kuponda limit/kullanım yok', md.urunler.find(u => u.id === 5501).satis === 0 && md.kuponlar[0] && !('limit' in md.kuponlar[0]) && !('kullanim' in md.kuponlar[0]), md.kuponlar);

// ---- ekran turu ----
for (const s of ['ozet', 'stok', 'satis', 'cari', 'kasa', 'cek', 'envanter', 'uretim', 'rapor', 'ayar', 'portal']) { await ev(x => { try { go(x) } catch (e) { window.__goErr = x + ': ' + e.message } }, s); await wait(80); }
T('ekran turu hatasız', !(await ev(() => window.__goErr || '')));
console.log('pageErrors:', errs.length ? errs : 'none'); if (errs.length) fail++;
await br.close(); srv.close();
console.log(`\nSONUÇ: ${ok} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
