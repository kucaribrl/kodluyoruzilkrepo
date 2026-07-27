/* IQ Basics — Yazıcı Ajanı
 * Bilgisayara bağlı termal yazıcıya, buluttaki "yazdırma kuyruğunu" dinleyip
 * OTOMATİK fiş basar. Telefonda satış bitince fiş kendiliğinden çıkar.
 *
 * Kurulum ve çalıştırma için: BASLA-TR.md
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, query, where, onSnapshot,
        doc, updateDoc, deleteDoc } = require('firebase/firestore');

// --- Uygulamayla aynı (herkese açık) bulut ayarı ---
const FB_CONFIG = {
  apiKey: "AIzaSyCQWOyx02CEhuvzeo068pKucYwjxl6gS-k",
  authDomain: "iq-basics.firebaseapp.com",
  projectId: "iq-basics",
  storageBucket: "iq-basics.firebasestorage.app",
  messagingSenderId: "432547902086",
  appId: "1:432547902086:web:0ad08ac8e04df637951707"
};
const MAGAZA_ID = 'iqbasics';

// --- Kullanıcı ayarı ---
function loadConfig() {
  const p = path.join(__dirname, 'config.json');
  if (!fs.existsSync(p)) {
    console.error('\n❌ config.json bulunamadı. "config.example.json" dosyasını "config.json" olarak kopyalayıp içini doldur.\n');
    process.exit(1);
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error('❌ config.json okunamadı (yazım hatası olabilir):', e.message); process.exit(1); }
}
const cfg = loadConfig();
if (!cfg.email || !cfg.sifre || cfg.sifre === 'BULUT_SIFREN') {
  console.error('\n❌ config.json içine buluta girdiğin e-posta ve şifreyi yaz (patron hesabı).\n');
  process.exit(1);
}

const log = (...a) => console.log(new Date().toLocaleTimeString('tr-TR'), ...a);
const isWin = process.platform === 'win32';
const inFlight = new Set();

function dataUrlToPng(dataUrl, file) {
  const b64 = String(dataUrl).replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}

function printImage(file, copies, printerName) {
  return new Promise((resolve, reject) => {
    copies = Math.max(1, Math.min(5, +copies || 1));
    if (isWin) {
      const ps = path.join(__dirname, 'print-image.ps1');
      const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-img', file, '-copies', String(copies)];
      if (printerName) args.push('-printer', printerName);
      const child = spawn('powershell.exe', args, { windowsHide: true });
      let err = '';
      child.stderr.on('data', d => err += d);
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error('PowerShell çıkış kodu ' + code + (err ? ' — ' + err.trim() : ''))));
    } else {
      // macOS / Linux — CUPS lp
      const args = ['-n', String(copies)];
      if (printerName) { args.push('-d', printerName); }
      args.push('-o', 'fit-to-page', file);
      const child = spawn('lp', args);
      let err = '';
      child.stderr.on('data', d => err += d);
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error('lp çıkış kodu ' + code + (err ? ' — ' + err.trim() : ''))));
    }
  });
}

async function handleJob(db, snapDoc) {
  const id = snapDoc.id;
  if (inFlight.has(id)) return;
  const data = snapDoc.data();
  // fiş: tek görsel (data.resim) · barkod etiket: görsel dizisi (data.resimler)
  const imgs = (data && data.tur === 'etiket' && Array.isArray(data.resimler)) ? data.resimler
             : (data && data.resim ? [data.resim] : null);
  if (!data || data.durum !== 'bekliyor' || !imgs || !imgs.length) return;
  inFlight.add(id);
  const ref = doc(db, 'isletme', MAGAZA_ID, 'yazdirma', id);
  // hangi yazıcı? etiket → etiketYaziciAdi, fiş → yaziciAdi (biri boşsa diğerine/​varsayılana düşer)
  const etiket = data.tur === 'etiket';
  const printer = etiket ? (cfg.etiketYaziciAdi || cfg.yaziciAdi || '') : (cfg.yaziciAdi || '');
  try {
    await updateDoc(ref, { durum: 'basiliyor' });
    log('🖨️  Basılıyor:', etiket ? (imgs.length + ' barkod etiketi → ' + (printer || 'varsayılan'))
        : (data.tur === 'test' ? 'TEST' : ('Fiş #' + (data.satisId || '') + ' · ' + (data.mus || ''))));
    for (let i = 0; i < imgs.length; i++) {
      const tmp = path.join(os.tmpdir(), 'iq-' + (etiket ? 'etiket' : 'fis') + '-' + id + '-' + i + '.png');
      dataUrlToPng(imgs[i], tmp);
      await printImage(tmp, etiket ? 1 : (data.kopya || cfg.kopyaVarsayilan || 1), printer);
      try { fs.unlinkSync(tmp); } catch (e) {}
    }
    await deleteDoc(ref);
    log('✅ Basıldı ve kuyruktan silindi.');
  } catch (e) {
    log('⚠️  Baskı hatası:', e.message);
    try { await updateDoc(ref, { durum: 'hata', hata: String(e.message || e) }); } catch (_) {}
  } finally {
    inFlight.delete(id);
  }
}

async function main() {
  console.log('\n=== IQ Basics · Yazıcı Ajanı ===');
  console.log('Fiş yazıcısı   :', cfg.yaziciAdi || '(varsayılan yazıcı)');
  console.log('Barkod yazıcısı:', cfg.etiketYaziciAdi || '(fiş yazıcısı/varsayılan)');
  const app = initializeApp(FB_CONFIG);
  const auth = getAuth(app);
  const db = getFirestore(app);
  try {
    await signInWithEmailAndPassword(auth, cfg.email, cfg.sifre);
    log('🔐 Buluta giriş yapıldı:', cfg.email);
  } catch (e) {
    console.error('\n❌ Bulut girişi başarısız:', e.code || e.message);
    console.error('   config.json içindeki e-posta/şifreyi kontrol et.\n');
    process.exit(1);
  }
  const q = query(collection(db, 'isletme', MAGAZA_ID, 'yazdirma'), where('durum', '==', 'bekliyor'));
  console.log('\n✅ Yazıcı ajanı çalışıyor — yeni fişler bekleniyor. (Bu pencereyi kapatma.)\n');
  onSnapshot(q, snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === 'added' || ch.type === 'modified') handleJob(db, ch.doc);
    });
  }, err => {
    log('⚠️ Dinleme hatası:', err.message, '— yeniden bağlanılıyor...');
  });
}

process.on('unhandledRejection', e => log('⚠️ Beklenmeyen hata:', e && e.message));
main().catch(e => { console.error('Ajan başlatılamadı:', e); process.exit(1); });
