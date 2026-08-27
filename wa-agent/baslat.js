/* IQ Basics — WhatsApp Ajanı (TEK BAŞINA ÇALIŞIR)
 * Bilgisayarda çalışır; WhatsApp Web'e senin numaranla bağlanır ve
 * uygulamanın buluta yazdığı mesaj kuyruğunu (wa_kuyruk) otomatik gönderir.
 * Kurulum ve çalıştırma: OKU.md (kısaca: config.json doldur → baslat.bat)
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { waKuyrukBaslat } = require('./ornek-dinleyici');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, 'wa-oturum') }), // giriş bir kez — QR tekrar istemez
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-gpu'] }
});

client.on('qr', qr => {
  console.log('\n📱 TELEFONUNDA: WhatsApp > Ayarlar > Bağlı Cihazlar > Cihaz Bağla');
  console.log('   Sonra aşağıdaki kareyi kameraya okut (bir defalık):\n');
  qrcode.generate(qr, { small: true });
});
client.on('authenticated', () => console.log('🔑 WhatsApp girişi tamam (kayıt edildi — bir daha QR istemez).'));
client.on('ready', () => {
  console.log('✅ WhatsApp bağlı — mesaj kuyruğu dinleniyor. Bu pencereyi kapatma.');
  waKuyrukBaslat(client).catch(e => { console.error('❌ Bulut bağlantısı:', (e && e.message) || e); });
});
client.on('disconnected', r => { console.log('⚠️ WhatsApp bağlantısı koptu:', r, '— yeniden başlatılıyor.'); process.exit(1); });

client.initialize();
