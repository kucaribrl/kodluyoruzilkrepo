// Satış para birimi çevirisi + ön sipariş (stokta yok) kilidi + toplama emrinde kırık seri.
// Çalıştırma: `node test/15-pb-onsiparis-kirik.test.mjs`  (PLAYWRIGHT_CHROMIUM=/yol/chrome ile sistem Chromium'u)
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
  db.kurUSD = 40; db.kurEUR = 50; db.teslimKontrolZorunlu = false;
  db.cariler.push({ id: 5101, tip: 'musteri', ad: 'PB Müşteri', bakiye: 0 });
  // 4'lü seri (S-M-L-XL), parça satış 100 TL → seri 400 TL
  db.urunler.push({ id: 6101, ad: 'Seri Polo', kod: 'SP1', kat: 'Polo', birim: 'seri', seri: 4,
    bedenler: [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }],
    alis: 60, satis: 100, pb: 'TL', stok: 20, kritik: 0,
    renkler: [{ ad: 'Siyah', hex: '#000', stok: 10, barkod: 'sp1' }, { ad: 'Beyaz', hex: '#fff', stok: 10, barkod: 'sp2' }] });
  db.poslar = [{ id: 'pos1', ad: 'Banka POS', komisyon: 2, valorGun: 1, hesapId: null }];
  save();
});

// ===================== 1) Satış ekranı: TL → $ / € değişince yazılanlar çevrilir =====================
await ev(() => { formSatis(); musSec(5101); urunSec(6101); });
await wait(250);
const p0 = await ev(() => ({ v: $('s-fiyat').value, pb: document.querySelector('.s-fiyat-pb').textContent }));
T('PB1: panelde parça fiyatı TL (100) ve etiket TL', p0.v === '100' && p0.pb === 'TL', p0);
await ev(() => { $('s-tasima').value = 200; $('s-kesik').value = 100; sEkstra = [{ ad: 'Nakış', tutar: 80 }]; cizEkstra();
  sOdemeler[0].tutar = 1000; sOdemeler[0]._orj = { tutar: 1000, pb: 'TL' }; cizOdeme(); cizSepet(); });
await ev(() => setPB('USD')); await wait(150);
const p1 = await ev(() => ({ fiyat: $('s-fiyat').value, pb: document.querySelector('.s-fiyat-pb').textContent, tas: $('s-tasima').value, kes: $('s-kesik').value, eks: sEkstra[0].tutar, od: sOdemeler[0].tutar, odpb: sOdemeler[0].pb }));
T('PB2: $ seçince yazılanlar çevrildi (100→2,5 · 200→5 · 100→2,5 · 80→2 · 1000₺→$25)', p1.fiyat === '2.5' && p1.pb === 'USD' && p1.tas === '5' && p1.kes === '2.5' && p1.eks === 2 && p1.od === 25 && p1.odpb === 'USD', p1);
await ev(() => setPB('EUR')); await wait(100);
const p2 = await ev(() => ({ fiyat: $('s-fiyat').value, tas: $('s-tasima').value, od: sOdemeler[0].tutar, odpb: sOdemeler[0].pb }));
T('PB3: $ → € de çevrilir (kur 40/50: 5$ → 4€, 25$ → 20€)', p2.fiyat === '2' && p2.tas === '4' && p2.od === 20 && p2.odpb === 'EUR', p2);
await ev(() => setPB('TL')); await wait(100);
const p3 = await ev(() => ({ fiyat: $('s-fiyat').value, tas: $('s-tasima').value, kes: $('s-kesik').value, eks: sEkstra[0].tutar, od: sOdemeler[0].tutar, odpb: sOdemeler[0].pb }));
T('PB4: TL\'ye dönünce ilk yazılan değerler birebir geri gelir', p3.fiyat === '100' && p3.tas === '200' && p3.kes === '100' && p3.eks === 80 && p3.od === 1000 && p3.odpb === 'TL', p3);

// Ödeme satırının kendi para birimi değişince tutar çevrilir
await ev(() => odemeSet(0, 'pb', 'USD')); await wait(50);
T('PB5: ödeme satırında ₺ → $ seçilince 1000 → 25', await ev(() => sOdemeler[0].tutar === 25 && sOdemeler[0].pb === 'USD'));
await ev(() => odemeSet(0, 'pb', 'TL')); await wait(50);
T('PB6: geri ₺ → birebir 1000', await ev(() => sOdemeler[0].tutar === 1000 && sOdemeler[0].pb === 'TL'));

// $ iken fiyatı dolar yazıp sepete ekle → TL'ye çevrilip saklanır, sepette $ görünür
await ev(() => { sOdemeler = [{ tur: 'Nakit', tutar: 0, pb: 'TL', hesapId: 0, vade: 0, foto: '' }]; $('s-tasima').value = 0; $('s-kesik').value = 0; sEkstra = []; cizEkstra(); setPB('USD'); });
await ev(() => { const el = $('s-fiyat'); el.value = '3'; sFiyatYaz(el); $('rq-0').value = 2; sepEkle(); });
await wait(150);
const s1 = await ev(() => ({ fiyat: sepet[0] && sepet[0].fiyat, txt: $('s-sepet').textContent, top: $('s-top').textContent }));
T('PB7: $3/parça girildi → seri fiyatı 3×4×40 = 480 TL saklandı', s1.fiyat === 480, s1);
T('PB8: sepet satırı ve toplam $ ile gösterilir ($3/parça · $24)', /\$3\/parça/.test(s1.txt) && /\$24/.test(s1.txt) && /\$24/.test(s1.top), s1);
// Kredi kartı ödemesinde POS kayda geçer (önceden kayboluyordu)
await ev(() => { sOdemeler = [{ tur: 'Kredi Kartı', tutar: 24, pb: 'USD', hesapId: 0, vade: 0, foto: '' }]; cizOdeme(); kaydetSatis(); });
await wait(300);
const sv = await ev(() => { const s = db.satislar[db.satislar.length - 1]; return s && { pb: s.pb, tutar: s.tutar, kur: s.satisKur, fiyat: s.kalemler[0].fiyat, posId: (s.odemeler[0] || {}).posId, cek: db.cekler.find(c => c.tur === 'kk') }; });
T('PB9: satış $ olarak kaydedildi (tutar 24, kur 40, kalem fiyatı TL 480)', sv && sv.pb === 'USD' && Math.abs(sv.tutar - 24) < 0.01 && sv.kur === 40 && sv.fiyat === 480, sv);
T('PB10: kredi kartı satırının POS\'u kayda geçti (komisyon/valör işler)', sv && sv.posId === 'pos1' && sv.cek && sv.cek.posId === 'pos1' && sv.cek.komisyon === 2, sv);
await ev(id => satisFis(id), await ev(() => db.satislar[db.satislar.length - 1].id)); await wait(200);
const fisTxt = await ev(() => document.getElementById('mB').textContent);
T('PB11: fişte kalem fiyatları da $ (₺480 yazmaz)', /\$12/.test(fisTxt) && !/₺480/.test(fisTxt), fisTxt.slice(0, 200));
await ev(() => closeM());

// ===================== 2) Ön sipariş: mal stoğa girmeden teslim / toplama / kargo yok =====================
await ev(() => {
  db.urunler.push({ id: 6201, ad: 'Ön Polo', kod: 'OP1', kat: 'Polo', birim: 'adet', seri: 1, alis: 50, satis: 100, pb: 'TL', stok: 2, kritik: 0,
    renkler: [{ ad: 'Siyah', hex: '#000', stok: 2, barkod: 'op1' }] });
  save();
});
const yeniSatis = async (adet) => {
  await ev(a => { formSatis(); musSec(5101); urunSec(6201); setPB('TL'); }, adet); await wait(200);
  await ev(a => { $('rq-0').value = a; sepEkle(); kaydetSatis(); }, adet); await wait(200);
  const msg = await ev(() => document.getElementById('cMsg').textContent);
  await evet();
  return { msg, s: await ev(() => { const s = db.satislar[db.satislar.length - 1]; return { id: s.id, eksik: s.eksik, eksikStok: s.eksikStok, teslim: s.teslimDurum }; }) };
};
const A = await yeniSatis(5);
T('ÖS1: stokta 2 varken 5 satış → ön sipariş uyarısı kilidi anlatıyor', /KİLİTLİ/.test(A.msg), A.msg);
T('ÖS2: satış ön sipariş (ayrıldı) + eksik 3 kaydı', A.s.eksikStok && A.s.teslim === 'ayrildi' && A.s.eksik.length === 1 && A.s.eksik[0].adet === 3, A.s);
T('ÖS3: kilit — 3 adet stoğa gelmedi', await ev(id => { const e = onSipEksik(db.satislar.find(x => x.id === id)); return e.length === 1 && e[0].adet === 3; }, A.s.id));
// teslim engeli
await ev(id => satisDurum(id), A.s.id); await wait(200);
const tm = await ev(() => document.getElementById('cMsg').textContent);
await ev(() => document.getElementById('cNo').click()); await wait(150);
T('ÖS4: "Teslim Et" → STOĞA GELMEMİŞ uyarısı, teslim olmadı', /STOĞA GELMEMİŞ/.test(tm) && /teslim edilemez/.test(tm) && await ev(id => db.satislar.find(x => x.id === id).teslimDurum === 'ayrildi', A.s.id), tm);
// aşama (kargo) engeli
await ev(id => { const s = db.satislar.find(x => x.id === id); s.sipDurum = 'onaylandi'; s.sipGecmis = [{ k: 'onaylandi', t: Date.now() }]; sipAsamaSet(id, 'kargoda', { bildirme: true }); }, A.s.id); await wait(200);
await ev(() => document.getElementById('cNo').click()); await wait(150);
T('ÖS5: "Kargoya Ver" aşaması kilitli (onaylandı\'da kaldı)', await ev(id => db.satislar.find(x => x.id === id).sipDurum === 'onaylandi', A.s.id));
// toplama emri engeli
await ev(id => { const s = db.satislar.find(x => x.id === id); s.depo = 'bekliyor'; save(); depoEmri(id); }, A.s.id); await wait(200);
const de = await ev(() => document.getElementById('mB').textContent);
T('ÖS6: toplama emrinde "Mal bekleniyor" uyarısı + satırda "3 stoğa gelmedi"', /Mal bekleniyor/.test(de) && /3 stoğa gelmedi/.test(de), de.slice(0, 200));
await ev(id => depoTik(id, '0_0'), A.s.id); await wait(100);
T('ÖS7: stoğa gelmemiş satır işaretlenemez', await ev(id => !(db.satislar.find(x => x.id === id).depoCheck || {})['0_0'], A.s.id));
await ev(id => depoHazirla(id), A.s.id); await wait(200);
await ev(() => document.getElementById('cNo').click()); await wait(150);
T('ÖS8: "Hazırladım" kilitli — depo bekliyor\'da kaldı', await ev(id => db.satislar.find(x => x.id === id).depo === 'bekliyor', A.s.id));
await ev(() => closeM());
// ikinci ön sipariş: stok zaten eksideyken eksik, satılan adedi aşmaz
const B = await yeniSatis(2);
T('ÖS9: stok eksideyken 2 satış → eksik 2 (4 değil), stok −5', B.s.eksik[0].adet === 2 && await ev(() => urun(6201).renkler[0].stok === -5), B.s);
// mal geliyor: 3 adet → önce ESKİ sipariş (A) açılır, yeni (B) kilitli kalır
await ev(() => { stokUygula({ uid: 6201, renkler: [{ ad: 'Siyah', mik: 3 }] }, +1); save(); });
const fifo = await ev(([a, b]) => ({ a: onSipEksik(db.satislar.find(x => x.id === a)), b: onSipEksik(db.satislar.find(x => x.id === b)) }), [A.s.id, B.s.id]);
T('ÖS10: 3 adet stoğa girdi → A açıldı, B (2) hâlâ bekliyor (FIFO)', fifo.a.length === 0 && fifo.b.length === 1 && fifo.b[0].adet === 2, fifo);
await ev(id => satisDurum(id), A.s.id); await wait(250);
T('ÖS11: malı gelen A artık normal teslim edilir', await ev(id => db.satislar.find(x => x.id === id).teslimDurum === 'teslim', A.s.id));
await ev(() => { try { closeM() } catch (e) {} });
await ev(() => { go('satis'); }); await wait(150);
const ls = await ev(() => document.getElementById('app').textContent);
T('ÖS12: listede B "⏳ mal bekleniyor" rozetiyle', /mal bekleniyor/.test(ls), ls.slice(0, 120));
// kilit atlatılamaz (yönetici dahil) — "Tamam" sadece kapatır
await ev(id => satisDurum(id), B.s.id); await wait(200);
await evet();
T('ÖS13: B kilitliyken "Tamam" teslim ETMEZ (atlatma yok)', await ev(id => db.satislar.find(x => x.id === id).teslimDurum === 'ayrildi', B.s.id));
// kalan 2 adet de gelince B açılır
await ev(() => { stokUygula({ uid: 6201, renkler: [{ ad: 'Siyah', mik: 2 }] }, +1); save(); });
await ev(id => satisDurum(id), B.s.id); await wait(250);
T('ÖS13b: mal tamamlanınca B teslim edilir (stok 0)', await ev(id => db.satislar.find(x => x.id === id).teslimDurum === 'teslim' && urun(6201).renkler[0].stok === 0, B.s.id));
await ev(() => { try { closeM() } catch (e) {} });
// portal siparişi de stok yoksa ön sipariş olur
await ev(() => { db.bekleyenPortal.push({ id: 9301, mus: 'PB Müşteri', mid: 5101, tel: '', tarih: Date.now(), kalemler: [{ uid: 6201, urun: 'Ön Polo', mik: 4, birim: 'adet', fiyat: 100, renkler: [{ ad: 'Siyah', mik: 4 }] }], tutar: 400 }); save(); portalOnay(9301, 400, true); });
await wait(250);
const ps = await ev(() => { const s = db.satislar.find(x => x.portalId === 9301); return s && { eksikStok: s.eksikStok, eksik: s.eksik, kilit: onSipEksik(s).length }; });
T('ÖS14: stoksuz portal siparişi de ön sipariş + kilitli', ps && ps.eksikStok && ps.eksik[0].adet === 4 && ps.kilit === 1, ps);
await ev(() => { try { closeM() } catch (e) {} });

// ===================== 3) Toplama emrinde kırık seri ekle / düzenle =====================
await ev(() => {
  db.urunler.push({ id: 6301, ad: 'Kırık Polo', kod: 'KP1', kat: 'Polo', birim: 'seri', seri: 4,
    bedenler: [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }],
    alis: 60, satis: 100, pb: 'TL', stok: 15, kritik: 0,
    renkler: [{ ad: 'Siyah', hex: '#000', stok: 10, barkod: 'kp1', kirik: null }, { ad: 'Beyaz', hex: '#fff', stok: 5, barkod: 'kp2', kirik: null }] });
  db.cariler.push({ id: 5301, tip: 'musteri', ad: 'Kırık Müşteri', bakiye: 0 });
  save();
});
await ev(() => { formSatis(); musSec(5301); urunSec(6301); setPB('TL'); }); await wait(200);
await ev(() => { $('rq-0').value = 5; $('rq-1').value = 2; sepEkle(); $('s-depo').checked = true; kaydetSatis(); }); await wait(300);
const ks = await ev(() => { const s = db.satislar[db.satislar.length - 1]; return { id: s.id, tutar: s.tutar, depo: s.depo, bak: cari(5301).bakiye, siyah: urun(6301).renkler[0].stok }; });
T('KS1: 5 Siyah + 2 Beyaz seri (400 ₺) → 2.800 ₺, toplama emri açık, Siyah stok 5', ks.tutar === 2800 && ks.depo === 'bekliyor' && ks.bak === 2800 && ks.siyah === 5, ks);
await ev(id => depoEmri(id), ks.id); await wait(200);
T('KS2: toplama emrinde seri satırlarında "✂️ kırık" butonu var', await ev(() => [...document.querySelectorAll('#mB button')].filter(b => /✂️ kırık/.test(b.textContent)).length === 2));
// depocu: Siyah 5 seri yerine 4 tam + kırık S·L·XL
await ev(id => depoKirikGir(id, 6301, 'Siyah'), ks.id); await wait(200);
T('KS3: kırık paneli açıldı (istenen 5 seri, 4 beden kutusu)', await ev(() => document.getElementById('sov').classList.contains('show') && /İstenen 5 seri/.test(document.getElementById('sB').textContent) && document.querySelectorAll('#sB input[id^="dk-b-"]').length === 4));
await ev(() => { $('dk-tam').value = 4; $('dk-b-0').value = 1; $('dk-b-2').value = 1; $('dk-b-3').value = 1; depoKirikOzet(); });
T('KS4: özet: 4 tam seri + 3 parça · istenen 20 parça, gönderilen 19 (−1)', await ev(() => /4 tam seri \+ 3 parça/.test($('dk-ozet').textContent) && /-1 parça/.test($('dk-ozet').textContent)));
await ev(() => depoKirikKaydet()); await wait(300);
const k1 = await ev(id => { const s = db.satislar.find(x => x.id === id); const K = s.kalemler.find(k => !k.kirik), KK = s.kalemler.find(k => k.kirik); const r = urun(6301).renkler[0];
  return { kSiyah: K.renkler.find(x => x.ad === 'Siyah').mik, kMik: K.mik, kk: KK && { mik: KK.mik, fiyat: KK.fiyat, birim: KK.birim, beden: KK.renkler[0].beden }, tutar: s.tutar, bak: cari(5301).bakiye, stok: r.stok, kirik: r.kirik, chk: s.depoCheck, log: (s.eksikCozum || []).map(c => c.ozet).join(' | ') }; }, ks.id);
T('KS5: sipariş: Siyah 4 seri + ayrı kırık kalemi 3 parça × 100 ₺', k1.kSiyah === 4 && k1.kMik === 6 && k1.kk && k1.kk.mik === 3 && k1.kk.fiyat === 100 && k1.kk.birim === 'adet' && JSON.stringify(k1.kk.beden) === '{"S":1,"L":1,"XL":1}', k1);
T('KS6: tutar 2.800 → 2.700 ₺, müşteri bakiyesi de 2.700', k1.tutar === 2700 && k1.bak === 2700, k1);
T('KS7: stok: 1 seri bozuldu → Siyah 5 tam seri + 1 tek M (kırık)', k1.stok === 5 && JSON.stringify(k1.kirik) === '{"M":1}', k1);
T('KS8: düzenlenen satırlar toplandı işaretli + patron için kayıt', Object.keys(k1.chk).length === 2 && /4 tam seri \+ kırık S · L · XL/.test(k1.log), k1);
const de2 = await ev(() => document.getElementById('mB').textContent);
T('KS9: toplama emrinde kırık satırı (S · L · XL) ve "✂️ düzenle" görünür', /Kırık Polo \(kırık seri\)/.test(de2) && /S · L · XL/.test(de2) && /düzenle/.test(de2), de2.slice(0, 300));
// düzenle: kırık S·L (2 parça)
await ev(id => depoKirikGir(id, 6301, 'Siyah'), ks.id); await wait(150);
const pre2 = await ev(() => ({ tam: $('dk-tam').value, s: $('dk-b-0').value, l: $('dk-b-2').value, xl: $('dk-b-3').value }));
T('KS10: tekrar açınca kayıtlı değerler dolu gelir (4 · S1 L1 XL1)', pre2.tam === '4' && pre2.s === '1' && pre2.l === '1' && pre2.xl === '1', pre2);
await ev(() => { $('dk-b-3').value = 0; depoKirikKaydet(); }); await wait(300);
const k2 = await ev(id => { const s = db.satislar.find(x => x.id === id); const KK = s.kalemler.find(k => k.kirik); const r = urun(6301).renkler[0]; return { kk: KK && KK.mik, tutar: s.tutar, bak: cari(5301).bakiye, stok: r.stok, kirik: r.kirik }; }, ks.id);
T('KS11: düzenleme: kırık 2 parça → tutar 2.600, stok 5 seri + M·XL tek', k2.kk === 2 && k2.tutar === 2600 && k2.bak === 2600 && k2.stok === 5 && JSON.stringify(k2.kirik) === '{"M":1,"XL":1}', k2);
// satışı formdan düzenle-kaydet: kırık kalem korunur, stok kaymaz
await ev(id => { closeM(); formSatis(0, id); }, ks.id); await wait(250);
const sepTxt = await ev(() => document.getElementById('s-sepet').textContent);
T('KS12: satış düzenlemede kırık satırı görünür (✂️ · S · L)', /kırık seri \(depodan\)/.test(sepTxt) && /Siyah: S · L/.test(sepTxt), sepTxt);
await ev(() => kaydetSatis()); await wait(300);
const k3 = await ev(id => { const s = db.satislar.find(x => x.id === id); const r = urun(6301).renkler[0]; return { kk: (s.kalemler.find(k => k.kirik) || {}).mik, tutar: s.tutar, stok: r.stok, kirik: r.kirik, bak: cari(5301).bakiye }; }, ks.id);
T('KS13: düzenle-kaydet sonrası kırık kalem + stok + bakiye aynı', k3.kk === 2 && k3.tutar === 2600 && k3.stok === 5 && JSON.stringify(k3.kirik) === '{"M":1,"XL":1}' && k3.bak === 2600, k3);
// kırığı kaldır → 5 tam seriye birebir dönüş (bozulan seri geri tamamlanır)
await ev(id => { try { closeM() } catch (e) {} depoEmri(id); depoKirikGir(id, 6301, 'Siyah'); }, ks.id); await wait(200);
await ev(() => depoKirikKaldir()); await wait(300);
const k4 = await ev(id => { const s = db.satislar.find(x => x.id === id); const r = urun(6301).renkler[0]; return { kk: s.kalemler.some(k => k.kirik), siyah: s.kalemler.find(k => !k.kirik).renkler.find(x => x.ad === 'Siyah').mik, tutar: s.tutar, stok: r.stok, kirik: r.kirik, kayit: !!(s.depoKirik) }; }, ks.id);
T('KS14: kırık kaldırıldı → Siyah 5 seri, 2.800 ₺, stok 5 seri, tek parça yok', !k4.kk && k4.siyah === 5 && k4.tutar === 2800 && k4.stok === 5 && k4.kirik === null && !k4.kayit, k4);
// tam seri yerine tamamen kırık: Beyaz 2 seri → 1 tam + 1 seri değerinde tek parça değil, sadece M×2 ekle (ek parça)
await ev(id => { depoKirikGir(id, 6301, 'Beyaz'); }, ks.id); await wait(150);
await ev(() => { $('dk-tam').value = 2; $('dk-b-1').value = 2; depoKirikKaydet(); }); await wait(300);
const k5 = await ev(id => { const s = db.satislar.find(x => x.id === id); const r = urun(6301).renkler[1]; return { tutar: s.tutar, kk: (s.kalemler.find(k => k.kirik) || {}).mik, stok: r.stok, kirik: r.kirik }; }, ks.id);
T('KS15: tam seriye EK tek parça (Beyaz +M×2) → +200 ₺; 2 M için 2 seri bozulur (Beyaz 1 seri + S·L·XL ikişer tek)', k5.tutar === 3000 && k5.kk === 2 && k5.stok === 1 && JSON.stringify(k5.kirik) === '{"S":2,"L":2,"XL":2}', k5);
// iptal → stok birebir geri (bozulan seri yeniden tamamlanır)
await ev(id => { const s = db.satislar.find(x => x.id === id); revertSatis(s); save(); }, ks.id);
const k6 = await ev(() => ({ siyah: urun(6301).renkler[0].stok, beyaz: urun(6301).renkler[1].stok, bk: urun(6301).renkler[1].kirik, bak: cari(5301).bakiye }));
T('KS16: satış geri alınınca stok birebir başa döner (Siyah 10, Beyaz 5, tek parça yok)', k6.siyah === 10 && k6.beyaz === 5 && k6.bk === null && k6.bak === 0, k6);
await ev(id => { const s = db.satislar.find(x => x.id === id); applySatis(s); save(); }, ks.id);
await ev(() => { try { document.getElementById('sov').classList.remove('show'); closeM(); } catch (e) {} });

// ===================== SON =====================
T('sayfa hatası yok', errs.length === 0, errs);
console.log(`\n${ok} geçti, ${fail} kaldı`);
await br.close(); srv.close();
process.exit(fail ? 1 : 0);
