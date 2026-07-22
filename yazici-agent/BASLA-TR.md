# 🖨️ IQ Basics — Otomatik Yazıcı Ajanı (Windows)

Bu küçük program, **bilgisayara bağlı termal yazıcıdan otomatik fiş** bastırır.
Telefonda satışı bitirdiğinde fiş, bilgisayardaki yazıcıdan **kendiliğinden** çıkar —
telefonda "yazdır" onayı, dialog, bilgisayara elle basma yok.

## Nasıl çalışır?

1. Telefonda satış biter → uygulama fişi **buluta bir kuyruğa** atar.
2. Bilgisayardaki bu ajan kuyruğu dinler → yeni fiş gelince **yazıcıya basar**.
3. Fiş çıkar. ✅

Telefon ile bilgisayar aynı ağda olmak zorunda değil (ikisi de buluta bağlanır).
Bilgisayar **açık ve bu pencere çalışır** olduğu sürece basar.

---

## Kurulum (bir kez · ~5 dakika)

### 1) Node.js kur
- [https://nodejs.org](https://nodejs.org) adresine gir → **LTS** sürümünü indir → kur (hep "İleri").

### 2) Bu klasörü bilgisayara indir
- GitHub'da depoya gir → yeşil **Code** düğmesi → **Download ZIP**.
- ZIP'i aç, içinden **`yazici-agent`** klasörünü masaüstüne çıkar.

### 3) Ayar dosyasını doldur
- Klasördeki **`config.example.json`** dosyasını kopyala, adını **`config.json`** yap.
- Not defteri ile aç, doldur:

```json
{
  "email": "birol575@hotmail.com",
  "sifre": "BULUTA_GIRDIGIN_SIFRE",
  "yaziciAdi": "",
  "kopyaVarsayilan": 1
}
```

- **email / sifre**: uygulamada buluta girdiğin **patron hesabı** (aynısı).
- **yaziciAdi**: termal yazıcının Windows'taki **tam adı**.
  - Bul: **Başlat → Ayarlar → Bluetooth ve cihazlar → Yazıcılar ve tarayıcılar**
    (veya Denetim Masası → Aygıtlar ve Yazıcılar). Oradaki ismi **birebir** yaz.
    Örn: `"yaziciAdi": "XP-80C"`
  - Boş bırakırsan (`""`) Windows'un **varsayılan** yazıcısına basar. Termal yazıcıyı
    varsayılan yaparsan boş bırakabilirsin.

> 🔒 `config.json` içinde şifren var — bu dosyayı kimseyle paylaşma, ZIP'e koyup gönderme.

### 4) Başlat
- Klasördeki **`baslat.bat`** dosyasına **çift tıkla**.
- İlk açılışta paketleri indirir (bir defalık). Sonra:
  `✅ Yazıcı ajanı çalışıyor — yeni fişler bekleniyor.` yazar.
- **Bu pencereyi kapatma.** (Kapatınca baskı durur; tekrar `baslat.bat`'a tıkla.)

### 5) Telefonda aç
- Uygulama → **Ayarlar → Otomatik Yazıcı** → **"Satış bitince otomatik yazıcıya gönder"** aç.
- **🧪 Test Fişi Gönder** ile dene — yazıcıdan "TEST FİŞİ" çıkmalı.

Bitti! Artık her satışta fiş otomatik çıkar. Fişi tek tek göndermek istersen:
satış fişini aç → **🖨️ Bilgisayardaki Yazıcıya Gönder**.

---

## Bilgisayar her açıldığında kendi başlasın (isteğe bağlı)

Bilgisayarı her açtığında ajanın otomatik çalışmasını istersen:
1. `Win + R` → `shell:startup` yaz → Enter (Başlangıç klasörü açılır).
2. `baslat.bat` dosyasına sağ tık → **Kısayol oluştur** → kısayolu bu klasöre taşı.

---

## Sık sorunlar

| Sorun | Çözüm |
|------|-------|
| "config.json bulunamadı" | 3. adımı yap: `config.example.json` → `config.json` kopyala, doldur. |
| "Bulut girişi başarısız" | e-posta/şifre yanlış. Uygulamada girdiğin hesabın aynısı olmalı. |
| Test fişi kuyruğa gitti ama çıkmadı | `yaziciAdi` yanlış olabilir. Windows'taki yazıcı adını birebir yaz. Ya da yazıcıyı **varsayılan** yapıp `yaziciAdi`'nı boş bırak. |
| İzin/permission hatası | Uygulamada **Ayarlar → Senkron Teşhis → Bu Hesabı Yönetici Yap** ve `firestore.rules`'u Firebase Console'da yayınla. |
| Fiş çıkıyor ama soluk | Yazıcının **koyuluk/density** ayarını yükselt (yazıcı sürücüsü → Tercihler). |
| Fiş çok geniş/dar | Yazıcı sürücüsünde kağıt genişliğini (58/80 mm) doğru seç. |

Sorun sürerse: `baslat.bat` penceresindeki hata satırını not al.
