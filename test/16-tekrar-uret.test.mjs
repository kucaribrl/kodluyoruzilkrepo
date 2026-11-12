// 🏭 Tekrar Üret: eldeki ürünü yeniden üretmek için iş emri — ürün seçili, son iş emrinin ayarları dolu gelir.
// Çalıştırma: `node test/16-tekrar-uret.test.mjs`  (PLAYWRIGHT_CHROMIUM=/yol/chrome ile sistem Chromium'u)
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
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };
const ev = (fn, a) => page.evaluate(fn, a);
const wait = ms => page.waitForTimeout(ms);
const evet = async () => { await wait(150); await ev(() => document.getElementById('cYes').click()); await wait(250); };

await ev(() => bosBaslat()); await evet();
await ev(() => {
  const gun = 86400000, now = Date.now();
  db.cariler.push({ id: 5401, tip: 'tedarikci', ad: 'Kumaşçı Veli', bakiye: 0 });
  db.cariler.push({ id: 5402, tip: 'fason', ad: 'Kesimci Ali', bakiye: 0 });
  db.hammadde.push({ id: 8001, ad: 'Süprem', kat: 'Kumaş', birim: 'kg', alis: 200, pb: 'TL', tedId: 5401, ted: 'Kumaşçı Veli', stok: 50, renkler: [{ ad: 'Siyah', stok: 50 }] });
  const bed = [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }];
  db.urunler.push({ id: 7001, ad: 'Basic Tişört', kod: 'BT100', kat: 'Tişört', birim: 'seri', seri: 4, bedenler: bed, alis: 100, satis: 150, pb: 'TL', stok: 15, kritik: 2,
    renkler: [{ ad: 'Siyah', hex: '#000', stok: 10, barkod: 'bt1' }, { ad: 'Beyaz', hex: '#fff', stok: 5, barkod: 'bt2' }] });
  db.urunler.push({ id: 7002, ad: 'Yeni Model', kod: 'YM1', kat: 'Tişört', birim: 'seri', seri: 4, bedenler: bed, alis: 0, satis: 0, pb: 'TL', stok: 0, renkler: [{ ad: 'Gri', hex: '#999', stok: 0 }] });
  const ie = (id, gun0, o) => Object.assign({ id, urunId: 7001, urun: 'Basic Tişört', kod: 'BT100', birim: 'seri', seriAdet: 4, bedenler: bed, durum: 'tamam', stoklandi: true, malzeme: [],
    kumasId: 8001, kumasAd: 'Süprem', kumasFiyat: 200, kumasPB: 'TL', baslangic: now - gun0 * gun }, o);
  // eski (60 gün önce) ve SON (30 gün önce) üretim
  db.isemirleri.push(ie(9500, 60, { hedef: 4, renkDagilim: [{ ad: 'Siyah', adet: 4 }], duraklar: [{ ad: 'Kesim', fasonId: 5402, ucret: 4, durum: 'tamam' }], genelGiderBirim: 8, kumasTukBirim: 0.25, gun: 15 }));
  db.isemirleri.push(ie(9501, 30, { hedef: 8, renkDagilim: [{ ad: 'Siyah', adet: 5 }, { ad: 'Beyaz', adet: 3 }],
    duraklar: [{ ad: 'Kesim', fasonId: 5402, ucret: 5, durum: 'tamam' }, { ad: 'Dikim', ucret: 12, durum: 'tamam' }, { ad: 'Ütü / Paket', ucret: 3, durum: 'tamam' }],
    genelGiderBirim: 10, kumasTukBirim: 0.23, gun: 30 }));
  save();
});

// 1) Ürün kartında buton
await ev(() => urunDetay(7001)); await wait(200);
T('TÜ1: ürün kartında "🏭 Tekrar Üret" butonu (son üretimin bilgileriyle)', await ev(() => /Tekrar Üret — iş emri aç \(son üretimin bilgileriyle\)/.test(document.getElementById('mB').textContent)));
await ev(() => tekrarUret(7001)); await wait(600);
const f = await ev(() => ({
  ad: $('ie-ad').value, uid: ieUrunId, uyari: $('ie-kod-uyari').textContent, mod: ieMod, kumas: ieKumasId,
  renk: ieRenk.map(r => r.ad + ':' + r.adet + (r.yok ? '(alınacak)' : '')).join(','), tuk: $('ie-kumas-tuk').value, tukMod: ieTukMode,
  kes: $('dk-kesim-fas').value, uc: $('dk-kesim-uc').value, gg: $('ie-gg').value, plan: JSON.stringify(iePlanUcret), gun: $('ie-gun').value,
  gunChip: (document.querySelector('#ie-termin .c.on') || {}).textContent, kumasci: $('ie-kumasci').value, beden: ieBeden.map(b => b.beden).join(',') }));
T('TÜ2: ürün seçili geldi, kod sabit (mevcut ürüne üretim)', f.ad === 'Basic Tişört' && f.uid === 7001 && /Mevcut ürüne üretim/.test(f.uyari), f);
T('TÜ3: SON iş emrinin kumaşı seçili (Süprem), tüketim 230 gram/ürün', f.mod === 'kumas' && f.kumas === 8001 && f.tuk === '230' && f.tukMod === 'gram', f);
T('TÜ4: renk dağılımı dolu: Siyah 5 (stokta), Beyaz 3 (kumaş stokta yok → alınacak)', f.renk === 'Siyah:5,Beyaz:3(alınacak)', f);
T('TÜ5: kesimci + ücret, genel gider, kumaşçı dolu', f.kes === 'Kesimci Ali' && f.uc === '5' && f.gg === '10' && f.kumasci === 'Kumaşçı Veli', f);
T('TÜ6: sonraki aşama ücretleri (Dikim 12, Ütü/Paket 3) ve 30 gün termin', f.plan === '{"Dikim":12,"Ütü / Paket":3}' && f.gun === '30' && f.gunChip === '30 gün', f);
T('TÜ7: seri içeriği üründen (S-M-L-XL)', f.beden === 'S,M,L,XL', f);
// İş emrini aç → yeni iş emri aynı ürüne bağlı, ayarlar taşındı
const n0 = await ev(() => db.isemirleri.length);
await page.click('#mB button:has-text("İş Emrini Aç")'); await wait(400);
const y = await ev(() => { const i = db.isemirleri[db.isemirleri.length - 1]; const k = db.hammadde.find(h => h.id === 8001);
  return { n: db.isemirleri.length, urunId: i.urunId, hedef: i.hedef, rd: i.renkDagilim.map(r => r.ad + r.adet).join(','), plan: JSON.stringify(i.planUcret), tuk: i.kumasTukBirim, kes: i.duraklar[0].fasonId, uc: i.duraklar[0].ucret, gg: i.genelGiderBirim, gun: i.gun,
    siyahKumas: +k.renkler.find(r => r.ad === 'Siyah').stok.toFixed(2), alim: db.malSiparis.filter(s => s.oto && s.ieId === i.id).map(s => (s.satirlar || []).map(z => z.renk).join('+')).join('|'), urunSay: db.urunler.length }; });
T('TÜ8: yeni iş emri açıldı, aynı ürüne bağlı (yeni ürün yok), 8 seri', y.n === n0 + 1 && y.urunId === 7001 && y.hedef === 8 && y.rd === 'Siyah5,Beyaz3' && y.urunSay === 2, y);
T('TÜ9: kesimci/ücret, genel gider, plan ücretleri, termin, tüketim iş emrine geçti', y.kes === 5402 && y.uc === 5 && y.gg === 10 && y.plan === '{"Dikim":12,"Ütü / Paket":3}' && y.gun === 30 && Math.abs(y.tuk - 0.23) < 1e-9, y);
T('TÜ10: Siyah kumaş stoktan düştü (5 seri × 4 × 0,23 = 4,6 kg), Beyaz kumaşçıdan alım listesine', y.siyahKumas === 45.4 && y.alim === 'Beyaz', y);
// 2) Bitmiş iş emri detayından: O iş emrinin bilgileriyle
await ev(() => { closeM(); uretimDetay(9500); }); await wait(200);
T('TÜ11: bitmiş iş emri detayında "🔁 Bu Ürünü Tekrar Üret" butonu', await ev(() => /Bu Ürünü Tekrar Üret/.test(document.getElementById('mB').textContent)));
await ev(() => tekrarUret(7001, 9500)); await wait(600);
const f2 = await ev(() => ({ gg: $('ie-gg').value, uc: $('dk-kesim-uc').value, tuk: $('ie-kumas-tuk').value, renk: ieRenk.map(r => r.ad + ':' + r.adet).join(','), gun: $('ie-gun').value }));
T('TÜ12: seçilen ESKİ iş emrinin bilgileri geldi (genel gider 8, ücret 4, 250 g, Siyah 4, 15 gün)', f2.gg === '8' && f2.uc === '4' && f2.tuk === '250' && f2.renk === 'Siyah:4' && f2.gun === '15', f2);
await ev(() => closeM());
// 3) Önceki iş emri olmayan ürün: sadece ürün seçili gelir
await ev(() => { window.__toasts = []; const o = window.toast; window.toast = function (t, ms) { window.__toasts.push(t); return o(t, ms); }; tekrarUret(7002); }); await wait(600);
const f3 = await ev(() => ({ uid: ieUrunId, toasts: window.__toasts }));
T('TÜ13: önceki iş emri yoksa ürün seçili gelir + bilgi mesajı', f3.uid === 7002 && f3.toasts.some(t => /önceki iş emri yok/.test(t)), f3);
await ev(() => closeM());
// 4) Yetki: depocu butonu görmez
await ev(() => { db.rol = 'depocu'; urunDetay(7001); }); await wait(150);
T('TÜ14: depocu rolünde "Tekrar Üret" butonu yok', await ev(() => !/Tekrar Üret/.test(document.getElementById('mB').textContent)));
await ev(() => { closeM(); db.rol = 'patron'; save(); });

T('sayfa hatası yok', errs.length === 0, errs);
console.log(`\n${ok} geçti, ${fail} kaldı`);
await br.close(); srv.close();
process.exit(fail ? 1 : 0);
