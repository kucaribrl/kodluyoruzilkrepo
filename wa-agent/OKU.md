# 🤖 IQ Basics — WhatsApp Ajanı (Windows)

Uygulamadaki **fiş, makbuz, sipariş ve hatırlatma** mesajlarını telefonda
WhatsApp açmadan **otomatik** gönderir. Yazıcı ajanı gibi çalışır:
uygulama mesajı buluttaki kuyruğa yazar, **bilgisayarındaki bu program**
kuyruğu dinleyip mesajı senin WhatsApp numaran üzerinden gönderir.

> **Nereye kurulur?** Yazıcı ajanının çalıştığı bilgisayara — masaüstüne
> `wa-agent` klasörü olarak. Telefonla aynı ağda olması gerekmez.

---

## Kurulum (bir kez · ~10 dakika)

### 1) Klasörü bilgisayara indir
- GitHub'da depoya gir → yeşil **Code** → **Download ZIP**.
- ZIP'i aç, içinden **`wa-agent`** klasörünü masaüstüne çıkar.
- (Node.js zaten kurulu — yazıcı ajanı için kurmuştun.)

### 2) Ayar dosyasını doldur
- Klasördeki **`config.example.json`**'u kopyala, adını **`config.json`** yap.
- Not defteriyle aç; buluta girdiğin **e-posta ve şifreyi** yaz
  (yazıcı ajanındaki config ile aynı bilgiler):
```json
{ "email": "senin@epostan.com", "sifre": "BULUT_SIFREN" }
```

### 3) Başlat ve WhatsApp'ı bağla
- **`baslat.bat`**'a çift tıkla. İlk sefer paketleri indirir (2-5 dk, bir defalık).
- Ekrana bir **kare kod (QR)** gelir. Telefonunda:
  **WhatsApp → Ayarlar → Bağlı Cihazlar → Cihaz Bağla** → kareyi okut.
- `✅ WhatsApp bağlı — mesaj kuyruğu dinleniyor.` yazınca hazırsın.
  Giriş kaydedilir; bir daha QR istemez. **Bu pencere açık kaldıkça** mesajlar gider.

### 4) Uygulamada aç ve dene
- **Ayarlar → 🤖 WhatsApp Otomasyonu → Otomasyonu Aç**.
- **🧪 Test mesajı kuyruğa ekle** → birkaç saniye içinde firma numarana
  WhatsApp mesajı düşmeli. Durumu **📋 Kuyruk durumu**ndan izlersin.

Artık her WhatsApp butonunda **🤖 Otomatik Gönder** seçeneği çıkar —
mesaj telefonuna dokunmadan gönderilir. İstersen **📱 Elle Aç** hâlâ orada.

---

## Zaten kendi whatsapp-web.js sistemin varsa (alternatif)

Bu klasörü ayrıca çalıştırmana gerek yok — kendi projene şunu ekle:
1. `npm i firebase`
2. `ornek-dinleyici.js`'yi projene kopyala, yanına yukarıdaki `config.json`'u koy.
3. Client hazır olduğunda bağla:
```js
const { waKuyrukBaslat } = require('./ornek-dinleyici');
client.on('ready', () => waKuyrukBaslat(client));
```

---

## Sık sorunlar

| Sorun | Çözüm |
|---|---|
| "permission-denied" | `firestore.rules` içindeki **wa_kuyruk** bölümü Firebase Console'da yayınlanmamış — depodaki güncel kuralları yapıştırıp Publish et. Ayrıca config'teki hesap yönetici/ortak olmalı. |
| QR sürekli yenileniyor / bağlanmıyor | Pencereyi kapatıp `baslat.bat`'ı tekrar aç; telefonda interneti kontrol et. |
| "npm install basarisiz" | Node.js kurulu mu? nodejs.org → LTS. Şirket ağı engelliyorsa telefon paylaşımıyla dene. |
| Mesaj "hata" durumuna düştü | Kuyruk durumunda nedeni yazar — çoğu zaman numara hatalıdır (cari kartındaki telefonu düzelt). |
| Bilgisayar kapanınca mesajlar? | Kuyrukta bekler; ajan tekrar açılınca hepsi gönderilir. |

> 🔒 `config.json` ve `wa-oturum/` klasörü (WhatsApp girişin) bu bilgisayarda
> kalır, repoya gönderilmez. Kimseyle paylaşma.
