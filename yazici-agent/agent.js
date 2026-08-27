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
        doc, updateDoc, deleteDoc, setDoc, runTransaction } = require('firebase/firestore');

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
// Hedefli durdurma için PID dosyası (durdur.bat yalnız bu süreci kapatır)
try { fs.writeFileSync(path.join(__dirname, 'agent.pid'), String(process.pid)); } catch (e) {}
process.on('exit', () => { try { fs.unlinkSync(path.join(__dirname, 'agent.pid')); } catch (e) {} });
const isWin = process.platform === 'win32';
const inFlight = new Set();

function dataUrlToPng(dataUrl, file) {
  const b64 = String(dataUrl).replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}

// Ham ESC/POS baytlarını yazıcıya DOĞRUDAN gönderir (Windows sürücüsünü baypas eder)
// → yazıcının doğal çözünürlüğünde, nokta-nokta net baskı (eski sistem gibi).
function printRaw(file, copies, printerName) {
  return new Promise((resolve, reject) => {
    copies = Math.max(1, Math.min(5, +copies || 1));
    if (isWin) {
      const ps = path.join(__dirname, 'print-raw.ps1');
      const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps, '-file', file, '-copies', String(copies)];
      if (printerName) args.push('-printer', printerName);
      const child = spawn('powershell.exe', args, { windowsHide: true });
      let err = '';
      child.stderr.on('data', d => err += d);
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error('PowerShell (ham) çıkış kodu ' + code + (err ? ' — ' + err.trim() : ''))));
    } else {
      // macOS / Linux — CUPS ham geçiş
      const args = [];
      if (printerName) { args.push('-d', printerName); }
      args.push('-o', 'raw');
      args.push('-n', String(copies), file);
      const child = spawn('lp', args);
      let err = '';
      child.stderr.on('data', d => err += d);
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error('lp (ham) çıkış kodu ' + code + (err ? ' — ' + err.trim() : ''))));
    }
  });
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
  const etiket = data && data.tur === 'etiket';
  // fiş için ham ESC/POS varsa onu kullan (sürücüyü baypas → net baskı)
  const escpos = (!etiket && data && typeof data.escpos === 'string' && data.escpos.length > 32) ? data.escpos : null;
  if (!data || data.durum !== 'bekliyor' || (!escpos && (!imgs || !imgs.length))) return;
  inFlight.add(id);
  const ref = doc(db, 'isletme', MAGAZA_ID, 'yazdirma', id);
  // güvenlik: aşırı büyük iş verisini basma (yanlış/kötü niyetli kuyruk kaydı)
  const boyut = (escpos ? escpos.length : 0) + (imgs ? imgs.reduce((a, x) => a + (x ? x.length : 0), 0) : 0);
  if (boyut > 8 * 1024 * 1024 || (imgs && imgs.length > 60)) {
    log('⚠️ İş çok büyük, atlandı:', id, Math.round(boyut / 1024) + 'KB');
    try { await updateDoc(ref, { durum: 'hata', hata: 'iş verisi çok büyük' }); } catch (e) {}
    inFlight.delete(id); return;
  }
  // hangi yazıcı? etiket → etiketYaziciAdi, fiş → yaziciAdi (biri boşsa diğerine/​varsayılana düşer)
  const printer = etiket ? (cfg.etiketYaziciAdi || cfg.yaziciAdi || '') : (cfg.yaziciAdi || '');
  // config ham baskıyı kapatmadıysa (hamBaski:false) ESC/POS kullan
  const useRaw = escpos && cfg.hamBaski !== false;
  try {
    // işi güvenle sahiplen: hâlâ 'bekliyor' ise al (iki ajan aynı fişi iki kez basmasın)
    const alindi = await runTransaction(db, async (tr) => {
      const d0 = await tr.get(ref);
      if (!d0.exists() || d0.data().durum !== 'bekliyor') return false;
      tr.update(ref, { durum: 'basiliyor' });
      return true;
    });
    if (!alindi) { inFlight.delete(id); return; }
    log('🖨️  Basılıyor:', etiket ? (imgs.length + ' barkod etiketi → ' + (printer || 'varsayılan'))
        : (data.tur === 'test' ? 'TEST' : ('Fiş #' + (data.satisId || '') + ' · ' + (data.mus || '') + (useRaw ? ' · ham ESC/POS' : ''))));
    if (useRaw) {
      const tmp = path.join(os.tmpdir(), 'iq-fis-' + id + '.bin');
      fs.writeFileSync(tmp, Buffer.from(escpos, 'base64'));
      await printRaw(tmp, data.kopya || cfg.kopyaVarsayilan || 1, printer);
      try { fs.unlinkSync(tmp); } catch (e) {}
    } else {
      for (let i = 0; i < imgs.length; i++) {
        const tmp = path.join(os.tmpdir(), 'iq-' + (etiket ? 'etiket' : 'fis') + '-' + id + '-' + i + '.png');
        dataUrlToPng(imgs[i], tmp);
        await printImage(tmp, etiket ? 1 : (data.kopya || cfg.kopyaVarsayilan || 1), printer);
        try { fs.unlinkSync(tmp); } catch (e) {}
      }
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
    await signInWithEmailAndPassword(auth, cfg.email, cfg.sifre).catch(e => {
    if (String(e && e.code || '').startsWith('auth/')) {
      console.error('❌ Bulut girişi reddedildi (' + e.code + ') — config.json içindeki e-posta/şifreyi düzelt.');
      process.exit(2); // gizli-baslat.vbs bu kodda yeniden denemeyi DURDURUR
    }
    throw e;
  });
    log('🔐 Buluta giriş yapıldı:', cfg.email);
  } catch (e) {
    console.error('\n❌ Bulut girişi başarısız:', e.code || e.message);
    console.error('   config.json içindeki e-posta/şifreyi kontrol et.\n');
    process.exit(1);
  }
  // 💓 "Hayattayım" sinyali — uygulama "Ajan bağlı ✓" göstersin diye buluta yaz (20 sn'de bir)
  const heartbeat = async () => {
    // Not: mevcut kurallarla izinli olan yazdirma koleksiyonuna yazilir
    // (durum:"ajan" oldugu icin is kuyrugu sorgusuna takilmaz).
    try { await setDoc(doc(db, 'isletme', MAGAZA_ID, 'yazdirma', '_ajan_durum'),
      { durum: 'ajan', online: true, ts: Date.now(), cihaz: os.hostname(), yazici: cfg.yaziciAdi || 'varsayılan', etiket: cfg.etiketYaziciAdi || '' }); }
    catch (e) { /* sessiz */ }
  };
  await heartbeat();
  setInterval(heartbeat, 20000);
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
