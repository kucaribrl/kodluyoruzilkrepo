// YALNIZ TEST YARDIMCISI — DEFTER KAYMASI TESPİT MOTORU (saf, salt okunur; uygulama kodunu çağırmaz, veriyi DEĞİŞTİRMEZ).
// Girdi: uygulama verisinin JSON anlık görüntüsü (db). Çıktı: ölçümler ve sınıflandırma.
//
// Ölçüler:
//   Cari devri  D(c) = bakiye − (kayıtlardan hesaplanan net)   — index.html cariEkstre() ile aynı tanım (bağımsız yazıldı; testte eşitliği denetlenir)
//   Kasa farkı  F(h) = bakiye − Σ(hareket: hesapId = h, yon in → +, out → −)   — defterKontrolAc() ile aynı tanım
// Kayıt dışı değişiklik ya da sayaç kaybı yoksa D ve F sabit kalır. Kayma = son − taban.
//
// Sınıflandırma (motor ASLA "kesin kayıp" demez):
//   KAYMA_YOK        |kayma| < eşik
//   YENI_KAYIT       tabanda olmayan kayıt (açılış bakiyesi): taban o an oluşur, kayma sayılmaz
//   ACIKLANAN        kayma, aradaki bilinen kayıt dışı olaylarla (cariye işlenen çek ekleme) TUTAR OLARAK açıklanıyor
//   OLASI_ETKI_KAYBI kayma, aradaki aynı yönlü kayıtlı olayların (tahsilat / satış borcu / kasa girişi) bir alt kümesinin toplamına eşit
//                    → "bu olay(lar)ın bakiye etkisi kaybolmuş OLABİLİR" (kanıt listesiyle); kesinlik yok
//   ACIKLANAMAYAN    kayma var ama yukarıdakilerin hiçbiri tutmuyor (ör. elle bakiye düzeltme) → "açıklanamayan defter kayması"
export const ESIK = 0.005;
const r2 = (x) => Math.round((+x || 0) * 100) / 100;
const kur = (d, pb) => (pb === 'USD' ? +d.kurUSD || 1 : pb === 'EUR' ? +d.kurEUR || 1 : 1);
const satisDiv = (d, s) => +s.satisKur || kur(d, s.pb);

// Bir carinin kayıt olayları (cariEkstre ile aynı kurallar). Her olay: { anahtar, borc, alacak, tur }
export function cariOlaylari(d, cid) {
  const c = (d.cariler || []).find(x => x && x.id === cid); if (!c) return [];
  const isMus = c.tip === 'musteri', ev = [];
  (d.satislar || []).filter(s => s && s.mid === cid && !s.iptal).forEach(s => { const div = satisDiv(d, s);
    if (s.tip === 'iade') { if (!s.nakit) ev.push({ anahtar: 'S' + s.id + ':iade', alacak: (+s.tutar || 0) * div, tur: 'iade' }); return; }
    ev.push({ anahtar: 'S' + s.id, borc: (+s.tutar || 0) * div, tur: 'satis' });
    const tak = (s.taksitler || []).filter(t => t.odendi).reduce((a, t) => a + (+t.tutar || 0), 0), pesin = (+s.odenen || 0) - tak;
    if (pesin > 0) ev.push({ anahtar: 'S' + s.id + ':odeme', alacak: pesin * div, tur: 'satis-odeme' });
    if (s.kesik > 0) ev.push({ anahtar: 'S' + s.id + ':kesik', alacak: s.kesik * div, tur: 'kesik' }); });
  (d.hareketler || []).filter(h => h && h.cariId === cid).forEach(h => {
    if (h.tip === 'alim') { if (h.tutar > 0) ev.push({ anahtar: 'H' + h.id, borc: h.tutar, tur: 'alim' }); return; }
    if (h.tip === 'alim-iptal') { if (h.tutar > 0) ev.push({ anahtar: 'H' + h.id, alacak: h.tutar, tur: 'alim-iptal' }); return; }
    const isTah = h.tip === 'tahsilat';
    if (h.tutar > 0) ev.push({ anahtar: 'H' + h.id, [isMus === isTah ? 'alacak' : 'borc']: h.tutar, tur: isTah ? 'tahsilat' : 'odeme' });
    if (h.kesik > 0) ev.push({ anahtar: 'H' + h.id + ':kesik', alacak: h.kesik, tur: 'kesik' }); });
  return ev;
}
export function cariDevir(d, cid) { const c = (d.cariler || []).find(x => x && x.id === cid); if (!c) return null;
  const net = cariOlaylari(d, cid).reduce((a, e) => a + (e.borc || 0) - (e.alacak || 0), 0); return r2((+c.bakiye || 0) - net); }
export function kasaFarki(d, hid) { const h = (d.hesaplar || []).find(x => x && x.id === hid); if (!h) return null;
  const net = (d.hareketler || []).filter(x => x && x.hesapId === hid && x.yon).reduce((a, x) => a + (x.yon === 'in' ? 1 : -1) * (+x.tutar || 0), 0); return r2((+h.bakiye || 0) - net); }

// Taban: bütün cariler ve kasalar için D/F + o andaki olay anahtarları + çek kimlikleri
export function taban(d) {
  const o = { cari: {}, kasa: {}, olay: new Set(), cek: new Set((d.cekler || []).filter(Boolean).map(k => k.id)) };
  (d.cariler || []).filter(Boolean).forEach(c => { o.cari[c.id] = cariDevir(d, c.id); cariOlaylari(d, c.id).forEach(e => o.olay.add(e.anahtar)); });
  (d.hesaplar || []).filter(Boolean).forEach(h => { o.kasa[h.id] = kasaFarki(d, h.id); });
  (d.hareketler || []).filter(Boolean).forEach(h => o.olay.add('H' + h.id));
  return o;
}
// Küçük alt küme toplamı (n ≤ 14): hedefe eşit bir alt küme var mı? → bulunan öğeler
function altKume(ogeler, hedef) { const n = Math.min(ogeler.length, 14);
  for (let m = 1; m < (1 << n); m++) { let t = 0; const s = []; for (let i = 0; i < n; i++) if (m & (1 << i)) { t += ogeler[i].tutar; s.push(ogeler[i]); } if (Math.abs(t - hedef) < ESIK) return s; }
  return null; }

// Tabandan bu yana kayma ve sınıflandırma
export function tespit(t0, d) {
  const sonuc = [];
  for (const c of (d.cariler || []).filter(Boolean)) {
    const son = cariDevir(d, c.id);
    if (!(c.id in t0.cari)) { sonuc.push({ tur: 'cari', id: c.id, ad: c.ad, baslangic: null, son, kayma: 0, sinif: 'YENI_KAYIT', kanit: ['açılış bakiyesi ' + (+c.bakiye || 0)] }); continue; }
    const k = r2(son - t0.cari[c.id]); let sinif = 'KAYMA_YOK', kanit = [];
    if (Math.abs(k) >= ESIK) {
      // Bilinen kayıt dışı olay: cariye işlenen yeni çek (müşteride bakiyeyi tutarı kadar düşürür → D'yi −tutar kaydırır)
      const cekler = (d.cekler || []).filter(x => x && !t0.cek.has(x.id) && x.cariId === c.id && x.cariIsle && x.tip === 'alinan');
      const cekEtki = r2(cekler.reduce((a, x) => a - (+x.tutar || 0), 0));
      if (cekler.length && Math.abs(cekEtki - k) < ESIK) { sinif = 'ACIKLANAN'; kanit = cekler.map(x => 'çek #' + x.id + ' (cariye işlendi) ' + x.tutar); }
      else {
        // Aynı yönlü yeni kayıtlı olaylar: D arttıysa (bakiye beklenenden yüksek) → alacak olayı (tahsilat/kesik) etkisi düşmüş olabilir;
        // D azaldıysa (bakiye beklenenden düşük) → borç olayı (satış) etkisi düşmüş olabilir
        const yeni = cariOlaylari(d, c.id).filter(e => !t0.olay.has(e.anahtar));
        const aday = yeni.filter(e => k > 0 ? (e.alacak || 0) > 0 : (e.borc || 0) > 0).map(e => ({ ...e, tutar: r2(k > 0 ? e.alacak : e.borc) }));
        const s = altKume(aday, Math.abs(k));
        if (s) { sinif = 'OLASI_ETKI_KAYBI'; kanit = [...s.map(e => e.tur + ' ' + e.anahtar + ' ' + e.tutar), 'aday olay sayısı ' + aday.length + ' (eşleşme kesin değil; aynı tutarlı başka olay da olabilir)']; }
        else { sinif = 'ACIKLANAMAYAN'; kanit = ['kayıtlı olaylarla açıklanamıyor (ör. elle düzeltme ya da kayıt dışı değişiklik)']; }
      }
    }
    sonuc.push({ tur: 'cari', id: c.id, ad: c.ad, baslangic: t0.cari[c.id], son, kayma: k, sinif, kanit });
  }
  for (const h of (d.hesaplar || []).filter(Boolean)) {
    const son = kasaFarki(d, h.id);
    if (!(h.id in t0.kasa)) { sonuc.push({ tur: 'kasa', id: h.id, ad: h.ad, baslangic: null, son, kayma: 0, sinif: 'YENI_KAYIT', kanit: ['açılış bakiyesi ' + (+h.bakiye || 0)] }); continue; }
    const k = r2(son - t0.kasa[h.id]); let sinif = 'KAYMA_YOK', kanit = [];
    if (Math.abs(k) >= ESIK) {
      // F azaldıysa giriş (yon in) etkisi, arttıysa çıkış (yon out) etkisi düşmüş olabilir
      const aday = (d.hareketler || []).filter(x => x && x.hesapId === h.id && x.yon === (k < 0 ? 'in' : 'out') && !t0.olay.has('H' + x.id)).map(x => ({ anahtar: 'H' + x.id, tur: x.tur || x.tip || 'hareket', tutar: r2(x.tutar) }));
      const s = altKume(aday, Math.abs(k));
      if (s) { sinif = 'OLASI_ETKI_KAYBI'; kanit = [...s.map(e => e.tur + ' ' + e.anahtar + ' ' + e.tutar), 'aday olay sayısı ' + aday.length + ' (eşleşme kesin değil; aynı tutarlı başka olay da olabilir)']; }
      else { sinif = 'ACIKLANAMAYAN'; kanit = ['kasa hareketleriyle açıklanamıyor']; }
    }
    sonuc.push({ tur: 'kasa', id: h.id, ad: h.ad, baslangic: t0.kasa[h.id], son, kayma: k, sinif, kanit });
  }
  return sonuc;
}
export const UYARI_SINIFLARI = new Set(['OLASI_ETKI_KAYBI', 'ACIKLANAMAYAN']); // kullanıcıya uyarı gerektirenler
