/* IQ Basics — WhatsApp Ajanı (TEK BAŞINA ÇALIŞIR)
 * Bilgisayarda çalışır; WhatsApp Web'e senin numaranla bağlanır ve
 * uygulamanın buluta yazdığı mesaj kuyruğunu (wa_kuyruk) otomatik gönderir.
 * Kurulum ve çalıştırma: OKU.md (kısaca: config.json doldur → baslat.bat)
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const { waKuyrukBaslat } = require('./ornek-dinleyici');

// gizli-baslat.vbs 'gizli' argümanıyla çalıştırır — o modda QR gösterilemez
const GIZLI = process.argv.includes('gizli');
const hataLog = m => { try { fs.appendFileSync(path.join(__dirname, 'ajan-hata.log'), new Date().toLocaleString('tr-TR') + ' - ' + m + '\n'); } catch (e) {} };

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, 'wa-oturum') }), // giriş bir kez — QR tekrar istemez
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-gpu'] }
});

client.on('qr', qr => {
  if (GIZLI) { hataLog('WhatsApp QR istedi (oturum düşmüş) — baslat.bat ile görünür açıp yeniden okutun.'); process.exit(3); }
  console.log('\n📱 TELEFONUNDA: WhatsApp > Ayarlar > Bağlı Cihazlar > Cihaz Bağla');
  console.log('   Sonra aşağıdaki kareyi kameraya okut (bir defalık):\n');
  qrcode.generate(qr, { small: true });
});
client.on('authenticated', () => console.log('🔑 WhatsApp girişi tamam (kayıt edildi — bir daha QR istemez).'));
client.on('ready', () => {
  console.log('✅ WhatsApp bağlı — mesaj kuyruğu dinleniyor. Bu pencereyi kapatma.');
  waKuyrukBaslat(client).catch(e => {
    const m = String((e && e.message) || e);
    console.error('❌ Bulut bağlantısı:', m);
    // e-posta/şifre hatası → tekrar denemenin anlamı yok, çıkış 2 (gizli başlatıcı durur)
    if (/auth\/|password|user-not-found|invalid-credential|invalid-email/i.test(m)) { hataLog('Bulut girişi reddedildi: ' + m); process.exit(2); }
  });
});
client.on('disconnected', r => { console.log('⚠️ WhatsApp bağlantısı koptu:', r, '— yeniden başlatılıyor.'); process.exit(1); });

// Beklenmeyen (yakalanmamış) promise hatası → günlüğe yaz, çık (baslat.bat/vbs yeniden başlatır)
process.on('unhandledRejection', e => {
  const m = String((e && e.message) || e);
  console.error('❌ Beklenmeyen hata:', m);
  hataLog('Beklenmeyen hata: ' + m);
  process.exit(1);
});

client.initialize().catch(e => {
  const m = String((e && e.message) || e);
  console.error('❌ WhatsApp başlatılamadı:', m);
  hataLog('WhatsApp başlatılamadı: ' + m);
  process.exit(1);
});
