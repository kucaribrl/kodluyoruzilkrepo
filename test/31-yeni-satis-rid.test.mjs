// R2.2b.2: YENİ satış satırlarında renk kimliği (rid) — gerçek sepet (urnBilgi → rq-i → sepEkle) ve gerçek kayıt (kaydetSatis) akışı.
// Sözleşme:
//   - rid YALNIZ ürünün gerçek renk kaydından alınır; kanonik motorla (window.renkMotoru) doğrulanır: tam rid + doğru ürün + global benzersizlik.
//   - rid'siz eski renk: rid üretilmez/kopyalanmaz; satır eskisi gibi rid'siz kaydedilir (satış ENGELLENMEZ).
//   - Doğrulama başarısızsa ya da motor hazır değilse: tahmin yok, sepet/satış/stok/cari/kasa DEĞİŞMEZ, kullanıcıya hata bildirilir.
//   - Sepette birleştirme anahtarı: rid varsa rid; rid'siz satır yalnız rid'siz aynı adla birleşir. Eski satış düzenlenirken rid EKLENMEZ.
//   - Miktar, fiyat, lokasyon, ödeme, stok hesaplama, iptal, transfer, üretim, portal, senkron, finans davranışı değişmez.
// Sentetik veri; localhost dışı istekler engellenir; Firebase yok. Sunucu rastgele port, sw.js → 404.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { createHash } from 'crypto'; import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOTOR = '/js/renk-cozumleme.mjs';
const SV = { motor: 'gercek' };
const srv = http.createServer((req, res) => {
  const y = decodeURIComponent(req.url.split('?')[0]);
  if (y.includes('sw.js')) { res.writeHead(404); return res.end(); }
  if (y === MOTOR && SV.motor === 'yok') { res.writeHead(404); return res.end(); }
  if (y === MOTOR && SV.motor === 'surum2') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(fs.readFileSync(path.join(ROOT, MOTOR), 'utf8').replace('export const MOTOR_SURUM = 1;', 'export const MOTOR_SURUM = 2;')); }
  const p = path.join(ROOT, y === '/' ? 'index.html' : y);
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const d = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': /\.m?js$/.test(p) ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(d); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await new Promise(r => srv.once('listening', r));

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 320) : '')); } };
const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const disari = []; const errs = [];
const R = { S1: 'r_a1111111-1111-4111-8111-111111111111', B1: 'r_a2222222-2222-4222-8222-222222222222', S2: 'r_a3333333-3333-4333-8333-333333333333',
  L2: 'r_a4444444-4444-4444-8444-444444444444', M3a: 'r_a5555555-5555-4555-8555-555555555555', M3b: 'r_a6666666-6666-4666-8666-666666666666', K4: 'r_a7777777-7777-4777-8777-777777777777' };

const YARDIMCI = `
  const R = ${JSON.stringify(R)};
  const Y = {
    kur() {
      db.satisTaslak = null; delete db.satisTaslak;
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }]; aktifLok = 'L-ana'; db.pin = null;
      const bed = [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }, { beden: 'XXL', adet: 1 }];
      db.urunler = [
        { id: 9601, ad: 'Rid Polo', kod: 'RP-1', kat: 'Polo', birim: 'adet', pb: 'TL', alis: 60, satis: 100, kritik: 0, stok: 0,
          renkler: [{ ad: 'Siyah', rid: R.S1, hex: '#111', barkod: '960101', stok: 0, loklar: { 'L-ana': 50, 'L-depo': 9 } },
                    { ad: 'Beyaz', rid: R.B1, hex: '#fff', barkod: '960102', stok: 0, loklar: { 'L-ana': 50 } },
                    { ad: 'Gri', hex: '#888', barkod: '960103', stok: 0, loklar: { 'L-ana': 50 } }] },
        { id: 9602, ad: 'Rid Tişört', kod: 'RP-2', kat: 'Tişört', birim: 'adet', pb: 'TL', alis: 30, satis: 70, kritik: 0, stok: 0,
          renkler: [{ ad: 'Siyah', rid: R.S2, hex: '#111', barkod: '960201', stok: 0, loklar: { 'L-ana': 50 } },
                    { ad: 'Lacivert', rid: R.L2, hex: '#00f', barkod: '960202', stok: 0, loklar: { 'L-ana': 50 } }] },
        { id: 9603, ad: 'Çift Mavi', kod: 'RP-3', kat: 'Gömlek', birim: 'adet', pb: 'TL', alis: 20, satis: 40, kritik: 0, stok: 0,
          renkler: [{ ad: 'Mavi', rid: R.M3a, hex: '#09f', barkod: '960301', stok: 0, loklar: { 'L-ana': 50 } },
                    { ad: 'Mavi', rid: R.M3b, hex: '#08e', barkod: '960302', stok: 0, loklar: { 'L-ana': 50 } }] },
        { id: 9604, ad: 'Seri Polo', kod: 'RP-4', kat: 'Polo', birim: 'seri', seri: 5, bedenler: bed, pb: 'TL', alis: 20, satis: 30, kritik: 0, stok: 0,
          renkler: [{ ad: 'Siyah', rid: R.K4, hex: '#111', barkod: '960401', stok: 0, loklar: { 'L-ana': 20 }, kirik: { S: 3, M: 2 } }] },
      ];
      db.cariler = [{ id: 'c-31', ad: 'Rid Müşteri', tip: 'musteri', bakiye: 0, lokId: 'L-ana' }];
      db.hesaplar = [{ id: 'h-31', ad: 'Nakit Kasa', bakiye: 1000, lokId: 'L-ana' }];
      db.hareketler = []; db.cekler = []; db.transferler = []; db.isemirleri = []; db.bekleyenPortal = [];
      db.satislar = [{ id: 's-eski', tip: 'satis', lokId: 'L-ana', mid: 'c-31', mus: 'Rid Müşteri', pb: 'TL', tarih: 1600000000000, tutar: 200, araToplam: 200, odenen: 0, odemeler: [],
        kalemler: [{ uid: 9601, urun: 'Rid Polo', mik: 2, birim: 'adet', fiyat: 100, renkler: [{ ad: 'Siyah', mik: 2 }] }] }];
      stokProjYukle(); save();
    },
    baslat() { formSatis(); sMusId = 'c-31'; sOdemeler = []; },
    // GERÇEK panel akışı: ürün seç → urnBilgi panelini çiz → renk satırlarına adet yaz → sepEkle
    ekle(uid, adetler) { $('toast').textContent = ''; sUrunId = uid; urnBilgi(); const u = urun(uid);
      renkObjs(u).forEach((r, i) => { const el = $('rq-' + i); if (el) el.value = String(adetler[i] || 0); });
      try { sepEkle(); } catch (e) { return 'HATA ' + e.message; } return $('toast').textContent; },
    kaydet() { $('toast').textContent = ''; const n = db.satislar.length; try { kaydetSatis(); } catch (e) { return { hata: e.message }; }
      const yeni = db.satislar.length > n ? db.satislar[db.satislar.length - 1] : null; return { toast: $('toast').textContent, yeni: yeni && JSON.parse(JSON.stringify(yeni)) }; },
    sepet() { return JSON.parse(JSON.stringify(sepet)); },
    anlik() { return JSON.stringify({ u: db.urunler, s: db.satislar, c: db.cariler, h: db.hesaplar, hr: db.hareketler, ck: db.cekler }); },
    lok(uid, i, L = 'L-ana') { return +urun(uid).renkler[i].loklar[L]; },
  };
`;
async function sayfa(motor = 'gercek') {
  SV.motor = motor;
  const ctx = await br.newContext({ serviceWorkers: 'block' });
  await ctx.route('**/*', r => { const h = new URL(r.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return r.continue(); disari.push(h); return r.abort(); });
  const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${srv.address().port}/`);
  await page.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app') && window.renkMotoru && (window.renkMotoru.hazir || window.renkMotoru.hata), null, { timeout: 15000 });
  await page.addScriptTag({ content: YARDIMCI });
  return { ctx, page, ev: (f, a) => page.evaluate(f, a).catch(e => ({ HATA: String(e.message).slice(0, 200) })) };
}
const { ctx, page, ev } = await sayfa();

// ---- Temel akış: Siyah 3 (rid) + Gri 2 (rid'siz) + nakit ödeme ----
const a = await ev(() => { Y.kur(); const kaynakOnce = JSON.stringify(urun(9601).renkler.map(r => ({ ad: r.ad, rid: r.rid, barkod: r.barkod, hex: r.hex })));
  Y.baslat(); const t1 = Y.ekle(9601, [3, 0, 2]); const sep = Y.sepet();
  sOdemeler = [{ tur: 'Nakit', tutar: 50, pb: 'TL', hesapId: 'h-31' }];
  const k = Y.kaydet(); const ls = localStorage.getItem(KEY);
  return { t1, sep, k, eski: JSON.stringify(db.satislar.find(s => s.id === 's-eski')), ls: ls && ls.includes(R.S1), siyah: Y.lok(9601, 0), gri: Y.lok(9601, 2), depo: Y.lok(9601, 0, 'L-depo'),
    kasa: db.hesaplar[0].bakiye, bakiye: db.cariler[0].bakiye, hr: db.hareketler.length, kaynakOnce, kaynakSonra: JSON.stringify(urun(9601).renkler.map(r => ({ ad: r.ad, rid: r.rid, barkod: r.barkod, hex: r.hex }))) }; });
const yk = a.k && a.k.yeni && a.k.yeni.kalemler && a.k.yeni.kalemler?.[0];
const ySiyah = yk && yk.renkler && yk.renkler.find(r => r.ad === 'Siyah'), yGri = yk && yk.renkler && yk.renkler.find(r => r.ad === 'Gri');
T('T1 yeni satış doğru ürün UID\'sini taşır (9601)', yk && yk.uid === 9601, yk);
T('T2 yeni satış doğru RID\'yi taşır (Siyah → ürünün gerçek rid\'i)', ySiyah && ySiyah.rid === R.S1, ySiyah);
T('T5 sepet satırı RID taşır', a.sep && a.sep[0] && a.sep[0]?.renkler && a.sep[0]?.renkler.some(r => r.ad === 'Siyah' && r.rid === R.S1 && r.mik === 3), a.sep);
T('T6 satış kaydı RID taşır (db.satislar içindeki kayıt)', ySiyah && ySiyah.rid === R.S1 && ySiyah.mik === 3, a.k);
T('T7 JSON kopyalama ve kalıcı yerel kayıt (localStorage) RID\'yi korur', a.ls === true && JSON.parse(JSON.stringify(a.k.yeni)).kalemler?.[0]?.renkler.find(r => r.ad === 'Siyah')?.rid === R.S1, { ls: a.ls });
T('T13 eksik RID için kimlik üretilmez (Gri satırında rid alanı yok)', yGri && !('rid' in yGri) && yGri.mik === 2, yGri);
T('T14 eksik RID başka renkten kopyalanmaz; ürünün Gri rengine de rid yazılmaz', yGri && !('rid' in yGri) && !JSON.parse(a.kaynakSonra)[2].rid, a.kaynakSonra);
T('T43 kaynak renk kayıtları (ad/rid/barkod/renk) değişmez', a.kaynakOnce === a.kaynakSonra, { once: a.kaynakOnce, sonra: a.kaynakSonra });
T('T27 fiyat değişmez (kalem fiyatı 100 TL, tutar 500)', yk && yk.fiyat === 100 && a.k.yeni.tutar === 500, yk && [yk.fiyat, a.k.yeni.tutar]);
T('T28 lokasyon değişmez (satış L-ana; Depo stoğu 9)', a.k.yeni && a.k.yeni.lokId === 'L-ana' && a.depo === 9, [a.k.yeni && a.k.yeni.lokId, a.depo]);
T('T29 ödeme bilgisi değişmez (Nakit 50 → kasa 1050, hareket, bakiye 450)', a.k.yeni && a.k.yeni.odemeler.length === 1 && a.k.yeni.odemeler[0]?.tutar === 50 && a.kasa === 1050 && a.hr === 1 && a.bakiye === 450, { kasa: a.kasa, bakiye: a.bakiye, hr: a.hr });
T('T30 stok hesaplama değişmez (Siyah 50→47, Gri 50→48)', a.siyah === 47 && a.gri === 48, [a.siyah, a.gri]);
T('T19 eski satış kaydı değişmez', a.eski === JSON.stringify({ id: 's-eski', tip: 'satis', lokId: 'L-ana', mid: 'c-31', mus: 'Rid Müşteri', pb: 'TL', tarih: 1600000000000, tutar: 200, araToplam: 200, odenen: 0, odemeler: [], kalemler: [{ uid: 9601, urun: 'Rid Polo', mik: 2, birim: 'adet', fiyat: 100, renkler: [{ ad: 'Siyah', mik: 2 }] }] }) || (JSON.parse(a.eski).kalemler?.[0]?.renkler[0]?.rid === undefined && JSON.parse(a.eski).tarih === 1600000000000), a.eski);
T('T20 eski satışlara toplu RID eklenmez', !JSON.stringify(JSON.parse(a.eski)).includes('rid'), a.eski);

// ---- Ad değişimi / tarihsel ad ----
const b = await ev(() => { const s = db.satislar[db.satislar.length - 1]; urun(9601).renkler[0].ad = 'Antrasit'; save();
  const k = s.kalemler[0].renkler.find(r => r.rid === R.S1); return { ad: k && k.ad, rid: k && k.rid }; });
T('T3 renk adı satış anı snapshot\'ı olarak korunur (Siyah)', b.ad === 'Siyah', b);
T('T4 renk adı sonradan değişse de satıştaki RID sabit kalır', b.rid === R.S1, b);
T('T45 satış kaydı tarihsel adını korur (ürün rengi artık Antrasit)', b.ad === 'Siyah' && (await ev(() => urun(9601).renkler[0]?.ad)) === 'Antrasit', b);
const t31 = await ev(async () => { const s = db.satislar[db.satislar.length - 1]; urun(9601).renkler[0].ad = 'Siyah'; save(); silSatis(s.id); const t = $('kk-txt'); if (t) { t.value = 'SİL'; await kritikOnayla(); }
  return { iptal: !!s.iptal, siyah: Y.lok(9601, 0), gri: Y.lok(9601, 2), kasa: db.hesaplar[0].bakiye, bakiye: db.cariler[0].bakiye }; });
T('T31 satış iptali davranışı değişmez (stok 50/50, kasa 1000, bakiye 0)', t31.iptal && t31.siyah === 50 && t31.gri === 50 && t31.kasa === 1000 && t31.bakiye === 0, t31);

// ---- Birleştirme ----
const c = await ev(() => { Y.kur(); Y.baslat(); Y.ekle(9601, [2]); Y.ekle(9601, [3, 1]); const s1 = Y.sepet();
  Y.ekle(9602, [4]); Y.ekle(9603, [1, 2]); Y.ekle(9603, [0, 1]); const s2 = Y.sepet(); const k = Y.kaydet(); return { s1, s2, k }; });
T('T8 aynı UID+RID güvenli birleşir (Siyah 2+3 = 5, tek satır, rid korunur)', c.s1 && c.s1.length === 1 && c.s1[0]?.renkler.filter(r => r.rid === R.S1).length === 1 && c.s1[0]?.renkler.find(r => r.rid === R.S1)?.mik === 5 && c.s1[0]?.mik === 6, c.s1);
T('T24 sepet birleştirmede RID kaybolmaz (Siyah ve Beyaz rid\'leri ayrı ayrı yerinde)', c.s1 && c.s1[0]?.renkler.find(r => r.ad === 'Beyaz')?.rid === R.B1, c.s1);
const k9 = c.k && c.k.yeni && c.k.yeni.kalemler;
T('T9 aynı adlı (Siyah) farklı ürün/RID karışmaz: 9601→S1, 9602→S2', k9 && k9.find(k => k.uid === 9601)?.renkler.find(r => r.ad === 'Siyah')?.rid === R.S1 && k9.find(k => k.uid === 9602)?.renkler.find(r => r.ad === 'Siyah')?.rid === R.S2, k9);
const mavi = k9 && k9.find(k => k.uid === 9603);
T('T10 aynı ürün içinde aynı adlı farklı RID\'ler (Mavi/Mavi) birleştirilmez; ikinci ekleme doğru kimliğe gider: M3a=1, M3b=2+1=3', mavi && mavi.renkler.length === 2 && mavi.renkler.find(r => r.rid === R.M3a)?.mik === 1 && mavi.renkler.find(r => r.rid === R.M3b)?.mik === 3 && mavi.mik === 4, mavi);
T('T25 satış hazırlamada RID kaybolmaz (bütün renk satırlarında rid)', k9 && k9.every(k => k.renkler.every(r => typeof r.rid === 'string')), k9);
T('T26 satış kaydetmede RID kaybolmaz (kayıtlı satışta 5 renk satırı, hepsi rid\'li)', k9 && k9.reduce((a, k) => a + k.renkler.filter(r => r.rid).length, 0) === 5, k9);
const t44 = await ev(() => { const al = () => { Y.kur(); Y.baslat(); Y.ekle(9601, [2, 1, 1]); Y.ekle(9603, [1, 1]); return JSON.stringify(Y.kaydet().yeni.kalemler); }; return [al(), al()]; });
T('T44 aynı girdi aynı sonucu üretir', Array.isArray(t44) && t44[0] === t44[1] && t44[0]?.includes(R.M3b), t44);

// ---- Ret senaryoları: sepete ekleme ----
async function retEkle(bozma, uid, adet) { return ev(([bozma, uid, adet]) => { Y.kur(); (new Function('R', bozma))(R); save(); Y.baslat(); const once = Y.anlik(); const sOnce = JSON.stringify(sepet);
  const t = Y.ekle(uid, adet); return { t, sepetAyni: JSON.stringify(sepet) === sOnce, veriAyni: Y.anlik() === once, sepet: Y.sepet() }; }, [bozma, uid, adet]); }
const red = (x) => x && x.sepetAyni && x.veriAyni && /kimli|rid|renk/i.test(x.t || '') && !/^HATA/.test(x.t || '');
const t11 = await retEkle("urun(9601).renkler[0].rid = 'r_ bozuk';", 9601, [1]);
T('T11 yanlış (bozuk biçimli) RID reddedilir; sepet ve veri değişmez', red(t11), t11);
const t15 = await retEkle("urun(9602).renkler[1].rid = R.S1;", 9601, [1]);
T('T15 global RID çakışması (başka üründe aynı rid) reddedilir', red(t15), t15);
const t16 = await retEkle("urun(9602).renkler = 'Siyah,Lacivert';", 9601, [1]);
T('T16 bozuk renk listesi (başka üründe) reddedilir', red(t16), t16);
const t42 = await retEkle("urun(9601).renkler[1].rid = R.S1;", 9601, [1]);
T('T42 aynı üründe mükerrer RID reddedilir', red(t42), t42);
const t42b = await retEkle("urun(9601).renkler[1].rid = R.S1;", 9601, [0, 0, 1]);
T('T42b rid\'siz eski renk (Gri) yine satılabilir; ama kimlik çakışan renk satışa girmez', t42b.sepet.length === 1 && t42b.sepet[0]?.renkler.length === 1 && t42b.sepet[0]?.renkler[0]?.ad === 'Gri' && !('rid' in t42b.sepet[0]?.renkler[0]), t42b);

// ---- Ret senaryoları: kaydetme (sepet elle/taslaktan bozulmuş) ----
async function retKaydet(bozma) { return ev(([bozma]) => { Y.kur(); Y.baslat(); Y.ekle(9601, [2, 1]); (new Function('R', bozma))(R); const once = Y.anlik(), sOnce = JSON.stringify(sepet);
  const k = Y.kaydet(); return { toast: k.toast, yeni: k.yeni, hata: k.hata, veriAyni: Y.anlik() === once, sepetAyni: JSON.stringify(sepet) === sOnce, n: db.satislar.length }; }, [bozma]); }
const kred = (x) => x && !x.yeni && !x.hata && x.veriAyni && x.sepetAyni && x.n === 1 && /kimli|rid|renk/i.test(x.toast || '');
const t12 = await retKaydet("sepet[0].renkler[0].rid = R.S2;");
T('T12 başka ürüne ait RID (9602\'nin Siyah\'ı 9601 satırında) kayıtta reddedilir', kred(t12), t12);
const t41 = await retKaydet("sepet[0].uid = '9601';");
T('T41 yanlış ürün kimliği ("9601" metin) kayıtta reddedilir', kred(t41), t41);
const t41b = await retKaydet("urun(9602).renkler[1].rid = R.S1;");
T('T41b sepete eklendikten SONRA oluşan global çakışma kayıtta yakalanır; satış kısmen bile kaydedilmez (stok/cari/kasa aynı)', kred(t41b), t41b);
const t11b = await retKaydet("sepet[0].renkler[0].rid = 'r_ yanlis';");
T('T11b sepette bozulmuş RID kayıtta reddedilir', kred(t11b), t11b);

// ---- Seri / kırık ----
const s = await ev(() => { Y.kur(); Y.baslat(); Y.ekle(9604, [2]); const k = Y.kaydet(); return { k: k.yeni && k.yeni.kalemler[0], stok: Y.lok(9604, 0) }; });
T('T21 tam seri miktarı korunur (2 seri, stok 20→18, rid taşır)', s.k && s.k.mik === 2 && s.k.birim === 'seri' && s.k.renkler[0]?.rid === R.K4 && s.k.renkler[0]?.mik === 2 && s.stok === 18, s);
const kr = await ev(() => { Y.kur();
  const sat = { id: 's-kirik', tip: 'satis', lokId: 'L-ana', mid: 'c-31', mus: 'Rid Müşteri', pb: 'TL', tarih: 1700000000000, tutar: 60, araToplam: 60, odenen: 0, odemeler: [],
    kalemler: [{ uid: 9604, urun: 'Seri Polo', mik: 2, birim: 'seri', fiyat: 30, renkler: [{ ad: 'Siyah', rid: R.K4, mik: 2 }] },
               { uid: 9604, urun: 'Seri Polo (kırık seri)', mik: 3, birim: 'adet', fiyat: 6, kirik: true, renkler: [{ ad: 'Siyah', rid: R.K4, mik: 3, beden: { S: 2, L: 1 } }] }] };
  db.satislar.push(sat); applySatis(sat); save(); const kirikOnce = JSON.stringify(urun(9604).renkler[0].kirik);
  formSatis(null, 's-kirik'); const k = Y.kaydet(); const g = db.satislar.find(x => x.id === 's-kirik');
  return { toast: k.toast, kal: JSON.parse(JSON.stringify(g.kalemler)), kirikOnce, kirikSonra: JSON.stringify(urun(9604).renkler[0].kirik), lok: Y.lok(9604, 0) }; });
const krK = kr.kal && kr.kal.find(k => k.kirik);
T('T22 kırık seri beden dağılımı korunur (düzenle → kaydet: {S:2, L:1}; kırık stok aynı)', krK && JSON.stringify(krK.renkler[0]?.beden) === JSON.stringify({ S: 2, L: 1 }) && kr.kirikOnce === kr.kirikSonra, kr);
T('T23 kırık seri RID korunur (düzenleme ve yeniden kayıt sonrası)', krK && krK.renkler[0]?.rid === R.K4 && kr.kal.find(k => !k.kirik)?.renkler[0]?.rid === R.K4, kr.kal);

// ---- Eski satış düzenlenirken rid eklenmez ----
const ed = await ev(() => { Y.kur(); formSatis(null, 's-eski'); sepDuzenle(0); return new Promise(res => setTimeout(() => { Y.ekle(9601, [3]); const sep = Y.sepet(); const k = Y.kaydet();
  const g = db.satislar.find(x => x.id === 's-eski'); res({ sep, kal: JSON.parse(JSON.stringify(g.kalemler)), toast: k.toast, siyah: Y.lok(9601, 0) }); }, 250)); });
T('T19b eski (rid\'siz) satış düzenlense de ad üzerinden RID eklenmez; miktar güncellenir (2→3; uygulanmamış eski kayıt: stok 50+2−3=49)', ed.kal && ed.kal[0]?.renkler.length === 1 && !('rid' in ed.kal[0]?.renkler[0]) && ed.kal[0]?.renkler[0]?.mik === 3 && ed.siyah === 49, ed);
await ctx.close();

// ---- Motor hazır değil / sürüm yanlış ----
for (const [ad, mod] of [['T17 motor hazır değilse (dosya yok) RID tahmin edilmez: rid\'li renk sepete girmez, rid\'siz renk satılabilir', 'yok'], ['T18 motor sürümü yanlışsa RID tahmin edilmez (aynı güvenli ret)', 'surum2']]) {
  const S = await sayfa(mod);
  const m = await S.ev(() => { Y.kur(); Y.baslat(); const once = Y.anlik(); const t = Y.ekle(9601, [1]); const sep1 = Y.sepet(); const veriAyni = Y.anlik() === once;
    Y.ekle(9601, [0, 0, 2]); const sep2 = Y.sepet();
    sepet.push({ uid: 9601, urun: 'Rid Polo', mik: 1, birim: 'adet', fiyat: 100, renkler: [{ ad: 'Siyah', rid: R.S1, mik: 1 }] }); const once2 = Y.anlik(); const k = Y.kaydet();
    return { hazir: window.renkMotoru.hazir, t, sep1, veriAyni, sep2, kToast: k.toast, kYeni: !!k.yeni, kAyni: Y.anlik() === once2 }; });
  T(ad, m.hazir === false && m.sep1.length === 0 && m.veriAyni && /motor|kimli/i.test(m.t || '') && m.sep2.length === 1 && !('rid' in m.sep2[0].renkler[0]) && !m.kYeni && m.kAyni && /motor|kimli/i.test(m.kToast || ''), m);
  await S.ctx.close();
}

// ---- Değişmeyen iş fonksiyonları (Ders 47 başlangıç parmak izi) + davranış ----
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const govde = (ad) => { const i = html.indexOf('function ' + ad + '('); return i < 0 ? '' : html.slice(i, html.indexOf('\nfunction ', i + 10)); };
const iz = (ad) => createHash('sha256').update(govde(ad)).digest('hex').slice(0, 16);
const TABAN = {
  stokUygula: '8756afbaf86825a6',
  kirikStokUygula: 'f06e13d1da9f1767',
  defoUygula: '08930395b2c8a7f8',
  applySatis: '37274ab71919979c',
  revertSatis: '1be85dd420636592',
  silSatis: '4c4422b31b4d1a9f',
  satisGeriAl: '09c4da268ab54bc6',
  transferStokUygula: '06fd6711ac3da230',
  lokStokRenk: 'fd2ae5ad65c2edc8',
  _isEmriStoklaCommit: '14863def812dc9af',
  portalOnay: '615ba0d5faeba870',
  canliDomenUygula: '28cfaa0ea2260cea',
  _recMerge: '7fb79bbce540700e',
  _sbAl: 'db73110a61d221b3',
  _kumulatifBirlestir: 'b844992000bd5e8e',
  kasaHareket: 'a1cd577175e87b48',
  kaydetUrun: '970639b7a1738d9d',
  renkGuncel: '1852c9b19ee5375e',
  yeniRid: 'bd2e9ed3c4bb6c48',
  renkSilEngel: '13c800bc0d9395f5',
};
const fark = (l) => l.filter(f => !TABAN[f] || iz(f) !== TABAN[f] || govde(f).length < 40);
T('T30b stok fonksiyonları değişmedi (stokUygula, kirikStokUygula, defoUygula, applySatis)', fark(['stokUygula', 'kirikStokUygula', 'defoUygula', 'applySatis']).length === 0, fark(['stokUygula', 'kirikStokUygula', 'defoUygula', 'applySatis']));
T('T31b iptal fonksiyonları değişmedi (revertSatis, satisGeriAl; silSatis Ders 48 Karar 2/3 ile test 32\'de davranışla)', fark(['revertSatis', 'satisGeriAl']).length === 0, fark(['revertSatis', 'satisGeriAl']));
T('T32 transfer davranışı değişmedi (transferStokUygula)', fark(['transferStokUygula', 'lokStokRenk']).length === 0, fark(['transferStokUygula']));
T('T33 üretim davranışı değişmedi (_isEmriStoklaCommit)', fark(['_isEmriStoklaCommit']).length === 0, null);
T('T34 portal davranışı değişmedi (portalOnay)', fark(['portalOnay']).length === 0, null);
T('T35 senkron davranışı değişmedi (canliDomenUygula, _recMerge, _sbAl, _kumulatifBirlestir)', fark(['canliDomenUygula', '_recMerge', '_sbAl', '_kumulatifBirlestir']).length === 0, null);
T('T36 finans davranışı değişmedi (kasaHareket; ödeme akışı T29\'da davranışla)', fark(['kasaHareket']).length === 0, null);
T('T43b renk kartı işlevleri değişmedi (kaydetUrun, renkGuncel, yeniRid, renkSilEngel)', fark(['kaydetUrun', 'renkGuncel', 'yeniRid', 'renkSilEngel']).length === 0, fark(['kaydetUrun', 'renkGuncel', 'yeniRid', 'renkSilEngel']));
T('T-ek index.html motorun kopyasını içermez; yalnız yükleyici + doğrulama çağrısı', !/function renkCoz\b|function globalRidTara\b|RENK_MUTABAKAT/.test(html) && (html.match(/renk-cozumleme/g) || []).length === 1, null);

T('T37 Firebase erişimi yok (localhost dışı her istek engellendi)', disari.length > 0 && !disari.some(h => /^(localhost|127\.0\.0\.1)$/.test(h)), [...new Set(disari)]);
T('T38 gerçek veri kullanılmıyor (yalnız sentetik 96xx ürünler / c-31 müşteri)', a.k && a.k.yeni && a.k.yeni.mid === 'c-31' && yk && yk.uid >= 9600 && yk.uid < 9700, null);
const calis = (d) => { const r = spawnSync(process.execPath, [path.join(ROOT, 'test', d)], { cwd: ROOT, encoding: 'utf8', timeout: 500000 }); return { kod: r.status, son: (r.stdout || '').trim().split('\n').pop() }; };
const r28 = calis('28-renk-cozumleme.test.mjs'), r30 = calis('30-renk-motoru-pwa.test.mjs');
T('T39 mevcut testler korunur (28 ve 30 yeşil)', r28.kod === 0 && r30.kod === 0, { r28, r30 });
const r29t = spawnSync(process.execPath, [path.join(ROOT, 'test', '29-satis-iptal-guvenligi.test.mjs')], { cwd: ROOT, encoding: 'utf8', timeout: 500000 });
const r29 = { kod: r29t.status, son: (r29t.stdout || '').trim().split('\n').pop(), fail: (r29t.stdout || '').split('\n').filter(l => l.startsWith('FAIL ')).map(l => l.split(' ')[1]).sort() };
/* Ders 48 (kullanıcı onayı): güvenli iptal sonrası test 29 = 37 PASS / 9 FAIL; kalan 9 = Karar 1/3 (T6,T7,T15,T38) + Karar 3/3 mutabakat (T8–T11,T30) */
T('T40 test 29 bilinçli kırmızı kalır: tam olarak 37 PASS / 9 FAIL ve başarısız kimlikler birebir aynı', r29.kod === 1 && /37 PASS, 9 FAIL/.test(r29.son) && JSON.stringify(r29.fail) === JSON.stringify(['T10', 'T11', 'T15', 'T30', 'T38', 'T6', 'T7', 'T8', 'T9']), r29);
T('T-ek sayfa hatası yok', errs.length === 0, errs);

await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
