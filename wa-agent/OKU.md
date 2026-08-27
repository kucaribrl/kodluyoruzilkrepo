# 🤖 IQ Basics — WhatsApp Otomasyonu (whatsapp-web.js entegrasyonu)

Uygulamadaki **fiş, makbuz, sipariş ve hatırlatma** mesajlarını telefonda
WhatsApp açmadan, senin mevcut **whatsapp-web.js** sistemin otomatik göndersin.

## Nasıl çalışır?

1. Uygulamada **Ayarlar → WhatsApp Otomasyonu**'nu aç.
2. Artık her WhatsApp butonunda iki seçenek çıkar:
   **🤖 Otomatik Gönder** → mesaj buluttaki `wa_kuyruk`'a yazılır.
   **📱 Elle Aç** → eski davranış (telefonda WhatsApp açılır).
3. Bilgisayarındaki whatsapp-web.js sistemi kuyruğu dinler, mesajı gönderir,
   durumu `gonderildi` yapar. Uygulamadan **Kuyruk durumu** ile izlersin.

Yazıcı ajanıyla aynı desen: telefon ↔ bilgisayar aynı ağda olmak zorunda değil.

## Kurulum (senin whatsapp-web.js projende)

1. `npm i firebase`
2. Bu klasördeki **`ornek-dinleyici.js`**'yi projene kopyala.
3. Yanına `config.json` koy (yazıcı ajanındakiyle aynı biçim):
```json
{ "email": "ornek@eposta.com", "sifre": "BULUT_SIFREN" }
```
4. Client hazır olunca başlat:
```js
const { waKuyrukBaslat } = require('./ornek-dinleyici');
client.on('ready', () => waKuyrukBaslat(client));
```

## Bir kez yapılacaklar

- **Firebase kurallarını yeniden yayınla** — repodaki `firestore.rules`'a
  `wa_kuyruk` bölümü eklendi (Console → Firestore → Rules → yapıştır → Publish).
  Yayınlamazsan kuyruğa yazma "permission-denied" verir.
- Uygulamada **Ayarlar → WhatsApp Otomasyonu → 🧪 Test mesajı** ile dene
  (test kendi firma numarana gider).

## Güvenlik notları

- Kuyruk telefon numarası içerir → kurallar yalnız **onaylı personel**e açık.
- İki dinleyici aynı anda çalışsa bile mesaj **iki kez gitmez**
  (transaction ile sahiplenme).
- Gönderim başarısızsa kayıt `hata` durumuna düşer ve nedeni yazılır —
  uygulamadaki *Kuyruk durumu* ekranında görürsün.
