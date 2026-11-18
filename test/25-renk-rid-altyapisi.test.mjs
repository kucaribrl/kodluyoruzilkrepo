// R2.1: Renk kimliği (rid) altyapısı — yalnız ürün kartı ve çoğaltma.
// Yeni renk → güvenli rastgele 'r_' + UUID; yeniden adlandırma/barkod/foto/hex değişince korunur; çoğaltmada yenilenir;
// eski kimliksiz renge SESSİZCE rid verilmez; kullanıcı rid değiştiremez; güvenli rastgele yoksa kayıt yapılmaz.
// Testler gerçek formUrun / renkEkle / kaydetUrun / cogaltUrun / renkKimlikDenetle çalıştırır. localhost dışı istekler engellenir.
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
const URL0 = `http://localhost:${srv.address().port}/`;

let ok = 0, fail = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x ? ' — ' + JSON.stringify(x).slice(0, 320) : '')); } };

const br = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const YARDIM = `
  const RD = {
    RID: /^r_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    kur(id, renkler, ek = {}) {
      db.lokasyonlar = [{ id: 'L-ana', ad: 'Mağaza', tip: 'magaza' }, { id: 'L-depo', ad: 'Depo', tip: 'depo' }];
      aktifLok = 'L-ana'; db.pin = null; db.transferler = []; db.isemirleri = []; db.satislar = []; db.bekleyenPortal = [];
      db.urunler = db.urunler.filter(u => u.id !== id && !(u.kod || '').startsWith('RD-K'));
      db.urunler.push({ id, ad: 'Rid Ürün ' + id, kod: 'RD-' + id, kat: 'Polo', marka: '', kaynak: 'uretim', cesit: 'Markalı', birim: 'seri', seri: 5,
        bedenler: [{ beden: 'S', adet: 1 }, { beden: 'M', adet: 1 }, { beden: 'L', adet: 1 }, { beden: 'XL', adet: 1 }, { beden: 'XXL', adet: 1 }],
        pb: 'TL', alis: 100, satis: 150, karYuzde: 50, kritik: 10, stok: 0, renkler: JSON.parse(JSON.stringify(renkler)), ...ek });
      stokProjYukle(); save();
    },
    r(id) { return renkObjs(urun(id)); },
    yeniRenk(id, ad, stok = 0) { formUrun(id); renkEkle(); const i = fRenk.length - 1; fRenk[i].ad = ad; fRenk[i].stok = stok; kaydetUrun(id); return RD.r(id).find(x => x.ad === ad); },
  };`;
const yeniSayfa = async () => { const ctx = await br.newContext(); const dis = [];
  await ctx.route('**/*', route => { const h = new URL(route.request().url()).hostname; if (h === 'localhost' || h === '127.0.0.1') return route.continue(); dis.push(h); return route.abort(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p.goto(URL0); await p.waitForFunction(() => typeof db !== 'undefined' && document.getElementById('app')); await p.addScriptTag({ content: YARDIM });
  return { p, ctx, errs, dis }; };
const A = await yeniSayfa(); const page = A.p; const ev = (fn, a) => page.evaluate(fn, a);
const ESKI = [{ ad: 'Siyah', hex: '#111', barkod: '8690000000011', stok: 0, loklar: { 'L-ana': 5, 'L-depo': 7 }, kirik: { S: 1 }, defo: 2 },
              { ad: 'Beyaz', hex: '#fff', barkod: '8690000000028', stok: 0, loklar: { 'L-ana': 2 } }];

T('altyapı: canlı senkron kapalı; güvenli rastgele (crypto) mevcut', await ev(() => canliAcik === false && typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'));

// T1–T3 yeni renk ve farklı ürünler
const t1 = await ev((E) => { RD.kur(9601, E); const a = RD.yeniRenk(9601, 'Kırmızı'); const b = RD.yeniRenk(9601, 'Mavi');
  RD.kur(9602, []); const c = RD.yeniRenk(9602, 'Kırmızı'); return { a: a && a.rid, b: b && b.rid, c: c && c.rid, re: [a, b, c].every(x => x && RD.RID.test(x.rid)) }; }, ESKI);
T('T1 yeni renk "r_"+UUID v4 biçiminde rid alır', t1.re, t1);
T('T2 aynı ürüne eklenen iki rengin rid\'si farklı', t1.a && t1.b && t1.a !== t1.b, t1);
T('T3 farklı üründe aynı adlı yeni rengin rid\'si farklı', t1.c && t1.c !== t1.a, t1);

// T4–T6, T8 kimlikli renk: ad / barkod / foto / hex değişince rid korunur
const t4 = await ev(() => { RD.kur(9603, []); const ilk = RD.yeniRenk(9603, 'Siyah', 3).rid;
  formUrun(9603); fRenk[0].ad = 'Lacivert'; kaydetUrun(9603); const ad = RD.r(9603)[0];
  formUrun(9603); fRenk[0].barkod = '8691234567890'; kaydetUrun(9603); const bk = RD.r(9603)[0];
  formUrun(9603); fRenk[0].foto = 'data:image/png;base64,AAAA'; fRenk[0].hex = '#123456'; kaydetUrun(9603); const ft = RD.r(9603)[0];
  formUrun(9603); kaydetUrun(9603); const ay = RD.r(9603)[0];
  return { ilk, ad: [ad.ad, ad.rid], bk: [bk.barkod, bk.rid], ft: [ft.foto ? 'var' : 'yok', ft.rid], ay: ay.rid, loklar: ay.loklar }; });
const ilkGecerli = /^r_[0-9a-f]{8}-[0-9a-f]{4}-4/.test(t4.ilk || '');
T('T4 Siyah → Lacivert: rid değişmez', ilkGecerli && t4.ad[0] === 'Lacivert' && t4.ad[1] === t4.ilk, t4);
T('T5 barkod değişince rid değişmez', ilkGecerli && t4.bk[0] === '8691234567890' && t4.bk[1] === t4.ilk, t4);
T('T6 foto / hex değişince rid değişmez', ilkGecerli && t4.ft[0] === 'var' && t4.ft[1] === t4.ilk, t4);
T('T8 kimlikli ürün kartı değişmeden kaydedilince rid ve stok korunur', ilkGecerli && t4.ay === t4.ilk && t4.loklar['L-ana'] === 3, t4);

// Gösterim: ad / barkod tabanlı anahtar neden kalıcı kimlik olamaz
const g = await ev(() => { RD.kur(9604, []); const s = RD.yeniRenk(9604, 'Siyah'); const adAnahtarOnce = 'ad:' + s.ad.toLocaleLowerCase('tr-TR'), bkOnce = 'bk:' + s.barkod, rid = s.rid;
  formUrun(9604); fRenk[0].ad = 'Lacivert'; fRenk[0].barkod = '8690000009999'; kaydetUrun(9604); const yeniSiyah = RD.yeniRenk(9604, 'Siyah');
  const l = RD.r(9604).find(x => x.ad === 'Lacivert');
  return { adAnahtariYeniRengiGosteriyor: ('ad:' + yeniSiyah.ad.toLocaleLowerCase('tr-TR')) === adAnahtarOnce, bkDegisti: ('bk:' + l.barkod) !== bkOnce, ridAyni: l.rid === rid, yeniSiyahFarkli: yeniSiyah.rid !== rid }; });
T('T4b/T5b ad ve barkod tabanlı anahtar kalıcı değil: yeniden adlandırma + aynı adla yeni renk → ad anahtarı YENİ rengi gösterir, barkod anahtarı değişir; rid eski renkte kalır', g.adAnahtariYeniRengiGosteriyor && g.bkDegisti && g.ridAyni && g.yeniSiyahFarkli, g);

// T7, T19 çoğaltma ve yeni ürün
const t7 = await ev(async () => { RD.kur(9605, []); RD.yeniRenk(9605, 'Siyah'); RD.yeniRenk(9605, 'Beyaz'); const kaynak = RD.r(9605).map(r => r.rid);
  cogaltUrun(9605); await new Promise(r => setTimeout(r, 300)); const formdaRid = fRenk.map(r => r.rid || (r._orj && r._orj.rid) || null);
  $('u-kod').value = 'RD-KOPYA'; const n = db.urunler.length; kaydetUrun(0); const kopya = db.urunler.length > n ? db.urunler[db.urunler.length - 1] : null;
  const kr = kopya ? renkObjs(kopya).map(r => r.rid) : [];
  // yeni ürün (boş form) iki renkle
  formUrun(0); $('u-ad').value = 'Rid Yeni Ürün'; $('u-kod').value = 'RD-KYENI'; $('u-kat').value = 'Polo'; $('u-alis').value = '10'; $('u-satis').value = '20';
  fRenk = []; renkEkle(); renkEkle(); fRenk[0].ad = 'Gri'; fRenk[1].ad = 'Yeşil'; const n2 = db.urunler.length; kaydetUrun(0);
  const yeni = db.urunler.length > n2 ? db.urunler[db.urunler.length - 1] : null; const yr = yeni ? renkObjs(yeni).map(r => r.rid) : [];
  return { kaynak, formdaRid, kr, yr, kaynakSonra: RD.r(9605).map(r => r.rid) }; });
T('T7 çoğaltılan ürünün bütün renkleri yeni rid alır (kaynaktan farklı, birbirinden farklı); çoğaltma formunda kaynağın rid\'si taşınmaz', t7.kr.length === 2 && t7.kr.every(r => r && !t7.kaynak.includes(r)) && t7.kr[0] !== t7.kr[1] && t7.formdaRid.every(r => !t7.kaynak.includes(r)) && JSON.stringify(t7.kaynakSonra) === JSON.stringify(t7.kaynak), t7);
T('T19 yeni ürün (gerçek formUrun(0) → kaydetUrun(0)) her rengine ayrı rid verir', t7.yr.length === 2 && t7.yr.every(r => /^r_/.test(r || '')) && t7.yr[0] !== t7.yr[1], t7);

// T9, T10, T17 eski kimliksiz renk
const t9 = await ev((E) => { RD.kur(9606, E); formUrun(9606); kaydetUrun(9606); const a = RD.r(9606);
  formUrun(9606); fRenk[0].ad = 'Antrasit'; fRenk[1].barkod = '8690000005555'; kaydetUrun(9606); const b = RD.r(9606);
  return { ridA: a.map(r => r.rid === undefined ? 'yok' : r.rid), siyah: { l: a[0].loklar, k: a[0].kirik, d: a[0].defo }, ridB: b.map(r => r.rid === undefined ? 'yok' : r.rid), adB: b.map(r => r.ad) }; }, ESKI);
T('T9 eski kimliksiz renk açılıp kaydedilince sessizce rid almaz', t9.ridA.every(r => r === 'yok'), t9);
T('T10 eski renk loklar {5,7}, kirik {S:1}, defo 2 korunur', t9.siyah.l['L-ana'] === 5 && t9.siyah.l['L-depo'] === 7 && t9.siyah.k && t9.siyah.k.S === 1 && t9.siyah.d === 2, t9);
T('T17 eski renkte ad/barkod değişikliği kendiliğinden rid oluşturmaz', t9.adB[0] === 'Antrasit' && t9.ridB.every(r => r === 'yok'), t9);

// T11 aynı rid iki renkte → kayıt reddedilir
const t11 = await ev(() => { RD.kur(9607, [{ ad: 'Siyah', hex: '#111', barkod: '1', rid: 'r_ayni', stok: 0, loklar: { 'L-ana': 1 } }, { ad: 'Beyaz', hex: '#fff', barkod: '2', rid: 'r_ayni', stok: 0, loklar: { 'L-ana': 2 } }]);
  const once = JSON.stringify(urun(9607)); formUrun(9607); $('u-ad').value = 'Değişmemeli'; $('toast').textContent = ''; kaydetUrun(9607);
  return { ayni: JSON.stringify(urun(9607)) === once, mesaj: $('toast').textContent }; });
T('T11 aynı rid iki renkte → kayıt reddedilir, ürün değişmez, mesaj gösterilir', t11.ayni && /kimli(k|ği)/i.test(t11.mesaj), t11);

// T12 kullanıcı rid değiştiremez
const t12 = await ev(() => { RD.kur(9608, []); const ilk = RD.yeniRenk(9608, 'Siyah').rid;
  formUrun(9608); const inputVar = !!document.querySelector('#renk-box [data-rid], #renk-box input[name="rid"]') || /r_[0-9a-f]{8}/.test($('renk-box').innerHTML);
  fRenk[0].rid = 'r_hack'; if (fRenk[0]._orj) { /* _orj geçici form referansıdır; kimlik kaynağı olamaz */ }
  renkEkle(); const i = fRenk.length - 1; fRenk[i].ad = 'Mavi'; fRenk[i].rid = 'r_hack2'; kaydetUrun(9608);
  const r = RD.r(9608); return { ilk, siyah: r.find(x => x.ad === 'Siyah').rid, mavi: r.find(x => x.ad === 'Mavi').rid, inputVar }; });
T('T12 formda rid alanı yok; forma rid yazılsa da kayıt yok sayar (mevcut korunur, yeni renk güvenli rid alır)', !t12.inputVar && t12.siyah === t12.ilk && /^r_[0-9a-f]{8}-/.test(t12.mavi) && t12.mavi !== 'r_hack2', t12);

// T13 kart açıkken başka cihazdan gelen yeni renk
const t13 = await ev(() => { RD.kur(9609, []); const s = RD.yeniRenk(9609, 'Siyah', 2).rid; _sbGuncelle('urunler', db.urunler);
  formUrun(9609); const bulut = JSON.parse(JSON.stringify(urun(9609))); bulut.renkler.push({ ad: 'Yeşil', hex: '#0a0', barkod: '3', rid: 'r_uzak-1111', stok: 0, loklar: { 'L-depo': 4 } }); bulut._m = Date.now() + 1000;
  canliDomenUygula('stok', { urunler: db.urunler.map(u => u.id === 9609 ? bulut : u) }); kaydetUrun(9609);
  const r = RD.r(9609); return { s, siyah: r.find(x => x.ad === 'Siyah').rid, yesil: (r.find(x => x.ad === 'Yeşil') || {}).rid }; });
T('T13 kart açıkken başka cihazda eklenen renk (rid r_uzak-1111) korunur; mevcut rid değişmez', /^r_[0-9a-f]{8}-/.test(t13.s || '') && t13.siyah === t13.s && t13.yesil === 'r_uzak-1111', t13);

// T14 R1 korumaları (mükerrer ad + silme engeli) kimlikli renklerde de çalışır
const t14 = await ev(() => { RD.kur(9610, []); RD.yeniRenk(9610, 'Siyah', 5); RD.yeniRenk(9610, 'Beyaz');
  const once = JSON.stringify(urun(9610)); formUrun(9610); fRenk[1].ad = 'siyah'; $('toast').textContent = ''; kaydetUrun(9610); const m1 = $('toast').textContent, a1 = JSON.stringify(urun(9610)) === once;
  formUrun(9610); fRenk.splice(0, 1); $('toast').textContent = ''; kaydetUrun(9610); return { m1, a1, m2: $('toast').textContent, siyahVar: RD.r(9610).some(x => x.ad === 'Siyah') }; });
T('T14 R1: mükerrer ad reddedilir, stoklu kimlikli renk silinemez', t14.a1 && /aynı renk/i.test(t14.m1) && t14.siyahVar && /silinemez/i.test(t14.m2), t14);

// T15 Ders 39 denetimi kimlikli/kimliksiz sayımı
const t15 = await ev((E) => { RD.kur(9611, E); RD.yeniRenk(9611, 'Kırmızı'); const u = urun(9611);
  const r = renkKimlikDenetle({ urunler: [u], satislar: [], transferler: [], isemirleri: [], bekleyenPortal: [] }); return { o: r.ozet, mrid: r.ozet.mukerrerRid }; }, ESKI);
T('T15 denetim: 3 renkten 2 eski kimliksiz, 1 yeni kimlikli → kimliksiz 2, mükerrer rid 0', t15.o.renk === 3 && t15.o.kimliksiz === 2 && t15.mrid === 0, t15);

// T16 güvenli rastgele yoksa yarım kayıt oluşmaz
const t16 = await ev(() => { RD.kur(9612, [{ ad: 'Siyah', hex: '#111', barkod: '1', stok: 0, loklar: { 'L-ana': 1 } }]); const once = JSON.stringify(urun(9612)); const n = db.urunler.length;
  const ru = Object.getOwnPropertyDescriptor(crypto, 'randomUUID'), gr = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }); Object.defineProperty(crypto, 'getRandomValues', { value: () => { throw new Error('yok'); }, configurable: true });
  let sonuc;
  try { formUrun(9612); renkEkle(); const i = fRenk.length - 1; fRenk[i].ad = 'Mavi'; $('u-ad').value = 'Değişmemeli'; $('toast').textContent = ''; kaydetUrun(9612);
    sonuc = { ayni: JSON.stringify(urun(9612)) === once, mesaj: $('toast').textContent, sayi: db.urunler.length === n }; }
  finally { delete crypto.randomUUID; delete crypto.getRandomValues; if (ru) Object.defineProperty(crypto, 'randomUUID', ru); if (gr) Object.defineProperty(crypto, 'getRandomValues', gr); }
  sonuc.geriGeldi = typeof crypto.randomUUID === 'function'; return sonuc; });
T('T16 güvenli kimlik üretilemezse kayıt yapılmaz (ürün değişmez, mesaj), zayıf kimlik üretilmez', t16.ayni && t16.sayi && /kimli(k|ği)/i.test(t16.mesaj) && t16.geriGeldi, t16);

// T18 iki ayrı istemci (ayrı tarayıcı bağlamı) — kontrollü çakışma denetimi
const B = await yeniSayfa();
const ridA = await ev(() => { if (typeof yeniRid !== 'function') return ['YOK']; RD.kur(9613, []); return [RD.yeniRenk(9613, 'Siyah').rid, ...Array.from({ length: 2000 }, () => yeniRid())]; });
const ridB = await B.p.evaluate(() => { if (typeof yeniRid !== 'function') return ['YOK2']; RD.kur(9613, []); return [RD.yeniRenk(9613, 'Siyah').rid, ...Array.from({ length: 2000 }, () => yeniRid())]; });
const hepsi = [...ridA, ...ridB];
T('T18 iki ayrı istemcide aynı ürün kimliği/aynı adla üretilen renkler ve 2×2000 kimlik çakışmıyor (bu deneme çakışmamayı gözlemler; UUID için matematiksel sıfır-çakışma garantisi iddia edilmez)', ridA[0] !== ridB[0] && new Set(hepsi).size === hepsi.length && hepsi.every(r => /^r_[0-9a-f-]{36}$/.test(r)), { a0: ridA[0], b0: ridB[0], n: hepsi.length, tekil: new Set(hepsi).size });

T('altyapı: dış istek tamamlanmadı (Firebase dahil)', ![...A.dis, ...B.dis].some(h => /firestore|firebaseio|identitytoolkit|securetoken/.test(h)), [...A.dis, ...B.dis]);
T('altyapı: sayfa hatası yok', A.errs.length === 0 && B.errs.length === 0, [...A.errs, ...B.errs]);
await br.close(); srv.close();
console.log(`\n${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
