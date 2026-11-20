// Ders 50.3a — DEFTER KAYMASI TESPİT MOTORU, YALNIZ TEST (uygulama kodu DEĞİŞTİRİLMEZ; motor yalnız test yardımcısıdır).
// ORTAM: SAHTE, BELLEK İÇİ FIRESTORE — gerçek Firebase de, Firebase emülatörü de DEĞİLDİR (test/yardimci/iki-cihaz-sahte-firestore.mjs).
// Motor: test/yardimci/defter-kaymasi.mjs — saf ve salt okunur; uygulama verisinin JSON anlık görüntüsü üzerinde çalışır.
//
// Beklenen kayma BAĞIMSIZ bir gerçek değerden türetilir (motorun kendisinden değil):
//   beklenen kayma (cari / kasa) = (gerçekleşen bakiye − DOĞRU bakiye) + (bilerek yapılan kayıt dışı değişiklik)
//   DOĞRU bakiye = senaryonun matematiksel olarak doğru sonucu (iki işlem de sayılmış olsaydı).
// Beklenen sınıf: kayma 0 → KAYMA_YOK; birleşim kaybı → OLASI_ETKI_KAYBI; elle düzeltme → ACIKLANAMAYAN;
//   cariye işlenen çek → ACIKLANAN; yeni kayıt (açılış) → YENI_KAYIT. Motor ASLA "kesin kayıp" demez.
// Ayrıca: motorun cari devri her senaryoda uygulamanın kendi cariEkstre().devir değeriyle aynı olmalı; A, B ve sahte bulutta aynı tespit.
// Sentetik veri (9xxx). Sunucu rastgele port, sw.js → 404. Hata → çıkış kodu 1.
import path from 'path'; import { fileURLToPath } from 'url';
import { duzenekKur, islem, bekle, VERI_YOLU, GERCEK_FIREBASE } from './yardimci/iki-cihaz-sahte-firestore.mjs';
import { taban, tespit, cariDevir, UYARI_SINIFLARI, ESIK } from './yardimci/defter-kaymasi.mjs';

const DEPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.env.IQ_TEST_KOK ? path.resolve(process.env.IQ_TEST_KOK) : DEPO;
let ok = 0, fail = 0, yanlisAlarm = 0;
const T = (n, c, x) => { if (c) { ok++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 500) : '')); } };
console.log('ORTAM: SAHTE bellek içi Firestore (gerçek Firebase / emülatör DEĞİL) · kök: ' + (ROOT === DEPO ? 'depo' : ROOT));
const D = await duzenekKur(ROOT);
const { satis, tahsilat, elleBakiye, yeniCari, yeniKasa, cekEkle, cekTahsil, kasaGelirGider, gizle } = islem;
const r2 = (x) => Math.round((+x || 0) * 100) / 100;
const ozetle = (t) => t.map(x => `${x.tur}#${x.id}:${x.sinif}:${x.kayma}`).sort().join(' | ');

async function senaryo({ kod, ad, dogru, kasit = {}, yeniBeklenen = 0, adimlar }) {
  const B = D.bulutKur(); const A = await D.cihazAc(B, 'A', 11); const Bc = await D.cihazAc(B, 'B', 22);
  const t0y = await D.yerles(B); const dA0 = await D.cihazVeri(A); const t0 = taban(dA0);
  T(`${kod} [altyapı] başlangıçta senkron durulur ve taban alınır`, t0y >= 0 && Object.keys(t0.cari).length === 2 && Object.keys(t0.kasa).length === 1, { t0y });
  let ek = {}; try { ek = (await adimlar(B, A, Bc)) || {}; } catch (e) { ek = { HATA: String(e.message).slice(0, 200) }; }
  const t1y = await D.yerles(B);
  T(`${kod} [altyapı] senkron durulur, adımlar hatasız`, t1y >= 0 && !ek.HATA, { t1y, ...ek });
  const dA = await D.cihazVeri(A), dB = await D.cihazVeri(Bc), dK = D.bulutVeri(B);
  const tA = tespit(t0, dA), tB = tespit(t0, dB), tK = tespit(t0, dK);
  T(`${kod} [tutarlılık] A, B ve sahte bulut AYNI tespiti verir`, ozetle(tA) === ozetle(tB) && ozetle(tA) === ozetle(tK), { A: ozetle(tA), B: ozetle(tB), bulut: ozetle(tK) });
  // motorun devri = uygulamanın cariEkstre devri (bağımsız uygulamanın doğruluğu)
  const uyg = await A.page.evaluate(() => db.cariler.map(c => [c.id, Math.round(cariEkstre(c.id).devir * 100) / 100]));
  T(`${kod} [motor] cari devri uygulamanın cariEkstre().devir değeriyle aynı (${uyg.length} cari)`, uyg.every(([id, dv]) => Math.abs(cariDevir(dA, id) - dv) < ESIK), { uyg, motor: uyg.map(([id]) => [id, cariDevir(dA, id)]) });
  // beklenen kayma ve sınıf (bağımsız gerçek değerden)
  const gercek = { cari: Object.fromEntries((dA.cariler || []).map(c => [c.id, +c.bakiye || 0])), kasa: Object.fromEntries((dA.hesaplar || []).map(h => [h.id, +h.bakiye || 0])) };
  const satirlar = [];
  for (const x of tA) {
    if (x.sinif === 'YENI_KAYIT') { satirlar.push({ ...x, beklenenKayma: 0, beklenenSinif: 'YENI_KAYIT' }); continue; }
    const dg = (dogru[x.tur] || {})[x.id], ks = (kasit[x.tur] || {})[x.id];
    const birlesimKaybi = r2((gercek[x.tur][x.id] || 0) - dg), kasitTutar = ks ? ks.tutar : 0;
    const beklenenKayma = r2(birlesimKaybi + kasitTutar);
    const beklenenSinif = Math.abs(beklenenKayma) < ESIK ? 'KAYMA_YOK' : (Math.abs(birlesimKaybi) >= ESIK && !ks) ? 'OLASI_ETKI_KAYBI' : (ks && Math.abs(birlesimKaybi) < ESIK) ? ks.sinif : 'BİLEŞİK';
    satirlar.push({ ...x, beklenenKayma, beklenenSinif, birlesimKaybi });
  }
  for (const s of satirlar) {
    const alarm = UYARI_SINIFLARI.has(s.sinif) && !UYARI_SINIFLARI.has(s.beklenenSinif); if (alarm) yanlisAlarm++;
    console.log(`RAPOR ${kod} ${s.tur}#${s.id} başlangıç=${s.baslangic} son=${s.son} beklenenKayma=${s.beklenenKayma} ölçülenKayma=${s.kayma} sınıf=${s.sinif} (beklenen ${s.beklenenSinif}) yanlışAlarm=${alarm ? 'EVET' : 'hayır'}${s.kanit.length ? ' kanıt=' + JSON.stringify(s.kanit) : ''}`);
    T(`${kod} [tespit] ${s.tur}#${s.id}: ölçülen kayma = beklenen (${s.beklenenKayma}) ve sınıf = ${s.beklenenSinif}`, Math.abs(s.kayma - s.beklenenKayma) < ESIK && s.sinif === s.beklenenSinif, s);
  }
  T(`${kod} [tespit] yeni kayıt sayısı = ${yeniBeklenen}`, satirlar.filter(s => s.sinif === 'YENI_KAYIT').length === yeniBeklenen, satirlar.filter(s => s.sinif === 'YENI_KAYIT').map(s => s.tur + '#' + s.id));
  T(`${kod} [altyapı] sayfa hatası yok`, A.hatalar.length === 0 && Bc.hatalar.length === 0, [...A.hatalar, ...Bc.hatalar].slice(0, 3));
  await A.ctx.close(); await Bc.ctx.close();
  return satirlar;
}
const DOGRU = (a, b, k) => ({ cari: { 9001: a, 9002: b }, kasa: { 9101: k } });
const SON = {};
// ===== Kayıplı senaryolar (test 34'te bilinen hata) — kayıp tutarı OLASI_ETKI_KAYBI olarak tespit edilmeli =====
SON.S1 = await senaryo({ kod: 'S1', ad: 'eşzamanlı iki satış', dogru: DOGRU(700, 300, 1000),
  adimlar: async (B, A, Bc) => { await satis(A); await satis(Bc); await gizle(A); await D.teslim(B, Bc); await gizle(Bc); } });
SON.S2 = await senaryo({ kod: 'S2', ad: 'eşzamanlı eşit iki tahsilat', dogru: DOGRU(300, 300, 1200),
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await tahsilat(Bc, 9001, 100); await gizle(A); await D.teslim(B, Bc); await gizle(Bc); } });
SON.Z1b = await senaryo({ kod: 'Z1b', ad: 'farklı tutarlar, çaprazlaşan yazım', dogru: DOGRU(350, 300, 1150),
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await tahsilat(Bc, 9001, 50); await gizle(A); await gizle(Bc); } });
SON.Z3a = await senaryo({ kod: 'Z3a', ad: 'eşit tahsilatlar 2 sn arayla, ilk değişiklik buluta gitmemiş', dogru: DOGRU(300, 300, 1200),
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await bekle(2000); await tahsilat(Bc, 9001, 100); await gizle(A); await D.teslim(B, Bc); await bekle(450); await gizle(Bc); } });
SON.Z4a = await senaryo({ kod: 'Z4a', ad: 'satışlar 2 sn arayla, ilk satış buluta gitmemiş', dogru: DOGRU(700, 300, 1000),
  adimlar: async (B, A, Bc) => { await satis(A); await bekle(2000); await satis(Bc); await gizle(A); await D.teslim(B, Bc); await bekle(450); await gizle(Bc); } });
// Ek bulgu (Ders 50.3a): çaprazlaşan yazımda FARKLI carilere yapılan işlemlerden biri de kaybolur (kayıp aynı kayıtla sınırlı değil)
SON.Z1c = await senaryo({ kod: 'Z1c', ad: 'çaprazlaşan yazım, FARKLI cariler (A: cari A satış, B: cari B tahsilat)', dogru: DOGRU(600, 250, 1050),
  adimlar: async (B, A, Bc) => { await satis(A); await tahsilat(Bc, 9002, 50); await gizle(A); await gizle(Bc); } });
SON['S3/S4'] = await senaryo({ kod: 'S3/S4', ad: 'çevrimdışı cihazın eski belgesi sonradan gelir', dogru: DOGRU(400, 250, 1150),
  adimlar: async (B, A, Bc) => { await D.cevrimdisi(Bc); await tahsilat(A, 9001, 100); await gizle(A); await D.yerles(B); await tahsilat(Bc, 9002, 50); await gizle(Bc); await D.cevrimici(B, Bc); } });
// ===== Doğru sonuçlanan senaryolar — yanlış kayıp uyarısı OLMAMALI =====
SON.Z1a = await senaryo({ kod: 'Z1a', ad: 'farklı tutarlar, aralıklı yazım', dogru: DOGRU(350, 300, 1150),
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await tahsilat(Bc, 9001, 50); await gizle(A); await D.teslim(B, Bc); await bekle(450); await gizle(Bc); } });
SON.Z3b = await senaryo({ kod: 'Z3b', ad: 'eşit tahsilatlar, değişiklik önce ulaşmış', dogru: DOGRU(300, 300, 1200),
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await gizle(A); await D.teslim(B, Bc); await bekle(2000); await tahsilat(Bc, 9001, 100); await gizle(Bc); } });
SON.Z4b = await senaryo({ kod: 'Z4b', ad: 'satışlar, ilk satış önce ulaşmış', dogru: DOGRU(700, 300, 1000),
  adimlar: async (B, A, Bc) => { await satis(A); await gizle(A); await D.teslim(B, Bc); await bekle(2000); await satis(Bc); await gizle(Bc); } });
SON.S5 = await senaryo({ kod: 'S5', ad: 'aynı belgenin yeniden teslimi', dogru: DOGRU(400, 300, 1100),
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await gizle(A); await D.yerles(B);
    for (let i = 0; i < 2; i++) { const c = B.belge.get(VERI_YOLU('cari')).j, k = B.belge.get(VERI_YOLU('kasa')).j;
      await Bc.page.evaluate(([c, k, yc, yk]) => { _canliGolge = {}; window.__sahteTeslim(yc, c); window.__sahteTeslim(yk, k); }, [c, k, VERI_YOLU('cari'), VERI_YOLU('kasa')]); await bekle(450); } } });
// ===== Normal işlemler =====
SON.N1 = await senaryo({ kod: 'N1', ad: 'elle cari bakiye düzeltme (500 → 550)', dogru: DOGRU(550, 300, 1000), kasit: { cari: { 9001: { tutar: 50, sinif: 'ACIKLANAMAYAN' } } },
  adimlar: async (B, A) => { await elleBakiye(A, 9001, 550); await gizle(A); } });
SON.N2 = await senaryo({ kod: 'N2', ad: 'açılış bakiyesi: yeni cari (250) ve yeni kasa (400)', dogru: DOGRU(500, 300, 1000), yeniBeklenen: 2,
  adimlar: async (B, A) => { const c = await yeniCari(A, 'Sentetik Müşteri C', '05000000003', 250); const h = await yeniKasa(A, 'Sentetik Kasa 2', 400); await gizle(A); return c && h ? {} : { HATA: 'yeni kayıt açılamadı ' + c + ' ' + h }; } });
SON.N3 = await senaryo({ kod: 'N3', ad: 'çek ekleme (cariye işlenir, 200) ve tahsil (kasaya girer)', dogru: DOGRU(500, 100, 1200), kasit: { cari: { 9002: { tutar: -200, sinif: 'ACIKLANAN' } } },
  adimlar: async (B, A) => { const id = await cekEkle(A, 9002, 200); if (!id) return { HATA: 'çek eklenemedi' }; await cekTahsil(A, id); await gizle(A); } });
SON.N4 = await senaryo({ kod: 'N4', ad: 'kasa gelir 150 ve gider 70', dogru: DOGRU(500, 300, 1080),
  adimlar: async (B, A) => { await kasaGelirGider(A, 'in', 150); await kasaGelirGider(A, 'out', 70); await gizle(A); } });
SON.N5 = await senaryo({ kod: 'N5', ad: 'kayıtların farklı sırayla birleşmesi (B domenleri ters sırayla alır, sonra yazar)', dogru: DOGRU(600, 250, 1050),
  adimlar: async (B, A, Bc) => { await satis(A); await gizle(A); await tahsilat(Bc, 9002, 50);
    await D.teslim(B, Bc, ['kasa', 'satis', 'cari', 'stok', 'ayar', 'cek', 'uretim', 'yonetim']); await bekle(450); await gizle(Bc); } });
SON.N6 = await senaryo({ kod: 'N6', ad: 'birleşimin tekrar uygulanması (bütün belgeler 3 kez, iki cihaza)', dogru: DOGRU(400, 300, 1100),
  adimlar: async (B, A, Bc) => { await tahsilat(A, 9001, 100); await gizle(A); await D.yerles(B);
    for (let i = 0; i < 3; i++) for (const C of [A, Bc]) { await C.page.evaluate(() => { _canliGolge = {}; }); C.gordugu.clear(); await D.teslim(B, C); await bekle(450); } } });
SON.N7 = await senaryo({ kod: 'N7', ad: 'iki cihazın farklı zamanlarda eşitlenmesi (B uzun süre çevrimdışı, yazmadan)', dogru: DOGRU(500, 270, 1130),
  adimlar: async (B, A, Bc) => { await D.cevrimdisi(Bc); await tahsilat(A, 9001, 100); await satis(A); await gizle(A); await D.yerles(B); await bekle(1000);
    await D.cevrimici(B, Bc); await D.yerles(B); await tahsilat(Bc, 9002, 30); await gizle(Bc); } });

// ===== Özet doğrulamaları =====
const uyari = (k) => (SON[k] || []).filter(s => UYARI_SINIFLARI.has(s.sinif));
for (const k of ['S1', 'S2', 'Z1b', 'Z1c', 'Z3a', 'Z4a', 'S3/S4'])
  T(`ÖZET ${k}: kayıp tutarı (100) OLASI_ETKI_KAYBI olarak, kanıtla tespit edildi; "kesin kayıp" sınıfı yok`, uyari(k).length > 0 && uyari(k).every(s => s.sinif === 'OLASI_ETKI_KAYBI' && Math.abs(Math.abs(s.kayma) - 100) < ESIK && s.kanit.length > 0), uyari(k));
for (const k of ['Z1a', 'Z3b', 'Z4b', 'S5', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'])
  T(`ÖZET ${k}: kayıp uyarısı yok (yanlış alarm 0)`, uyari(k).length === 0, uyari(k));
T('ÖZET N1: elle düzeltme "kayıp" değil "açıklanamayan defter kayması" (+50) olarak sınıflandı', uyari('N1').length === 1 && uyari('N1')[0].sinif === 'ACIKLANAMAYAN' && Math.abs(uyari('N1')[0].kayma - 50) < ESIK, uyari('N1'));
T('ÖZET N3: cariye işlenen çek ACIKLANAN (−200), uyarı yok', (SON.N3 || []).some(s => s.sinif === 'ACIKLANAN' && Math.abs(s.kayma + 200) < ESIK) && uyari('N3').length === 0, SON.N3);
T('ÖZET toplam yanlış alarm = 0', yanlisAlarm === 0, yanlisAlarm);
T('ORTAM sahte Firestore kullanıldı; gerçek Firebase/Auth sunucularına istek denemesi bile yok', ![...D.disari].some(h => GERCEK_FIREBASE.test(h)), [...D.disari]);
await D.kapat();
console.log(`\nYANLIŞ ALARM: ${yanlisAlarm}`);
console.log(`${ok} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
