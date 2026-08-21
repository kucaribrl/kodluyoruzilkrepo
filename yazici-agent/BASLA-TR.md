# 🖨️ IQ Basics — Otomatik Yazıcı Ajanı (Windows)

Bu küçük program, **bilgisayara bağlı termal yazıcıdan otomatik fiş** bastırır.
Telefonda satışı bitirdiğinde fiş, bilgisayardaki yazıcıdan **kendiliğinden** çıkar —
telefonda "yazdır" onayı, dialog, bilgisayara elle basma yok.

## Nasıl çalışır?

1. Telefonda satış biter → uygulama fişi **buluta bir kuyruğa** atar.
2. Bilgisayardaki bu ajan kuyruğu dinler → yeni fiş gelince **yazıcıya basar**.
3. Fiş çıkar. ✅

Telefon ile bilgisayar aynı ağda olmak zorunda değil (ikisi de buluta bağlanır).
Bilgisayar **açık ve ajan çalışır** olduğu sürece basar. (Ajanı görünür `baslat.bat`
ile ya da penceresiz/otomatik — aşağıdaki "GİZLİ başlasın" bölümü — çalıştırabilirsin.)

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
  "etiketYaziciAdi": "",
  "kopyaVarsayilan": 1
}
```

- **email / sifre**: uygulamada buluta girdiğin **patron hesabı** (aynısı).
- **yaziciAdi**: **TERMAL FİŞ** yazıcının Windows'taki **tam adı**.
- **etiketYaziciAdi**: **BARKOD ETİKET** yazıcının adı (ör. `"XP-490B"`).
  - İki yazıcın da varsa ikisini de yaz → ajan **her işi doğru yazıcıya** basar
    (fiş → fiş yazıcısı, barkod → barkod yazıcısı). Elle varsayılan değiştirmek yok.
  - Yazıcı adını bul: **Başlat → Ayarlar → Bluetooth ve cihazlar → Yazıcılar ve tarayıcılar**
    (veya Denetim Masası → Aygıtlar ve Yazıcılar). İsmi **birebir** yaz.
  - Tek yazıcın varsa sadece `yaziciAdi`'nı yaz; `etiketYaziciAdi`'nı boş bırak.
  - İkisi de boşsa Windows'un **varsayılan** yazıcısına basar.

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

## Bilgisayar her açıldığında GİZLİ (penceresiz) başlasın — önerilen

O siyah terminal penceresini hiç görmek istemiyorsan, ajanın **arka planda, hiçbir pencere açılmadan** çalışmasını istiyorsun demektir. Şöyle yap:

- Klasördeki **`otomatik-baslat-kur.bat`** dosyasına **çift tıkla**. Bitti! ✅
  - İlk sefer gerekli paketleri (bir defalık) kurar, sonra otomatik başlatmayı ayarlar.
  - Artık bilgisayar her açıldığında ajan **hiçbir pencere görünmeden**, tamamen arka planda başlar — o terminal ekranı bir daha **çıkmaz**.
  - "Şimdi de (gizli) başlatayım mı?" diye sorar; **E** dersen hemen sessizce çalışır.
- **Çalışıyor mu?** Uygulamada **Ayarlar → Otomatik Yazıcı** ekranının üstündeki durum satırına bak: **🖨️ Ajan BAĞLI ✓** yazmalı.

Durdurmak / geri almak:
- **`durdur.bat`** → arka planda çalışan ajanı durdurur.
- **`otomatik-baslat-kaldir.bat`** → hem otomatik başlatmayı iptal eder hem çalışan ajanı durdurur.

> Nasıl çalışıyor? `otomatik-baslat-kur.bat`, Windows **Başlangıç** klasörüne, ajanı gizli başlatan **`gizli-baslat.vbs`**'ye bir kısayol koyar. VBScript pencereyi gizli açtığı için hiçbir şey görünmez. (İlk paket kurulumunun görünür olması normaldir; bir defalıktır.)

> Not: Gizli ajanın penceresi olmadığı için **kapatmak** istediğinde `durdur.bat` kullan (ya da bilgisayarı yeniden başlatıp otomatik-baslat-kaldir ile iptal et).

---

## Sık sorunlar

| Sorun | Çözüm |
|------|-------|
| Bilgisayar açılışında **"Çalıştır?" güvenlik kutusu** çıkıyor (onaylamayınca fiş basmıyor) | Dosyalar internetten indiği için Windows engel işareti koyuyor. `otomatik-baslat-kur.bat`'a **bir kez daha** çift tıkla — yeni sürüm engeli kaldırır, kutu bir daha çıkmaz ve ajan sessizce başlar. |
| "config.json bulunamadı" | 3. adımı yap: `config.example.json` → `config.json` kopyala, doldur. |
| "Bulut girişi başarısız" | e-posta/şifre yanlış. Uygulamada girdiğin hesabın aynısı olmalı. |
| Test fişi kuyruğa gitti ama çıkmadı | `yaziciAdi` yanlış olabilir. Windows'taki yazıcı adını birebir yaz. Ya da yazıcıyı **varsayılan** yapıp `yaziciAdi`'nı boş bırak. |
| "yazıcıya erişim ayarları geçerli değil" / InvalidPrinterException | Yazıcı adı Windows'takiyle uyuşmuyor. **`yazicilari-listele.bat`**'a çift tıkla → çıkan tam adı `config.json`'a birebir yaz, ajanı kapatıp `baslat.bat` ile tekrar aç. (Yeni sürüm adı otomatik eşlemeye çalışır.) |
| İzin/permission hatası | Uygulamada **Ayarlar → Senkron Teşhis → Bu Hesabı Yönetici Yap** ve `firestore.rules`'u Firebase Console'da yayınla. |
| Fiş çıkıyor ama soluk | Yazıcının **koyuluk/density** ayarını yükselt (yazıcı sürücüsü → Tercihler). |
| Fiş çok geniş/dar | Yazıcı sürücüsünde kağıt genişliğini (58/80 mm) doğru seç. |

Sorun sürerse: `baslat.bat` penceresindeki hata satırını not al.
