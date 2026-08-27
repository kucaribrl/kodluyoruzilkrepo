# ☁️ IQ Basics — Yayınlama & Kullanıcı Rehberi

Bu uygulama tek dosyalık bir web uygulamasıdır (`index.html`). Bulut olmadan da
kendi cihazında tam çalışır. Aşağıdakiler, **müşteri / çalışan / fasonun kendi
telefonundan** girip kendi işini görmesi için bulutu (Firebase) devreye alır.

> Güvenlik ilkesi: Katalog-yayın yolunda cari/çek/kasa buluta gitmez. Ancak
> **Canlı Senkron açıkken** stok/cari/kasa/çek/satış/üretim verileri de
> `isletme/iqbasics/veri/*` altına yazılır ve YALNIZ **onaylı + rol yetkili**
> personel hesapları erişebilir (Firestore kuralları sunucu tarafında zorlar;
> kurallar dosyasındaki onay şartını yayınlamayı unutma). Müşteriler yalnız
> katalog, kendi siparişleri ve kendi bakiye/geçmişini görür.

---

## Roller
| Rol | Görür | Görmez |
|-----|-------|--------|
| **Patron / Ortak (sen)** | Her şey (kendi cihazında) | — |
| **Müşteri** | Katalog, kendi fiyatı, kendi bakiyesi, kendi sipariş geçmişi | Başka müşteri, cari/çek/kâr |
| **Çalışan** | Stok/katalog, müşteri adına sipariş girer | Cari/çek/kâr/kasa |
| **Fason** | Kendine atanan iş emirleri, durum bildirir | Fiyat/cari/kâr, başka fason |

---

## Kurulum (tek seferlik)

### 1) Firebase projesi
1. https://console.firebase.google.com → proje (ör. **iq-basics**)
2. **Build → Firestore Database → Create database** → *Production* → bölge (ör. `eur3`)
3. **Build → Authentication → Sign-in method → Email/Password → Enable**

### 2) Güvenlik kuralları
- **Firestore → Rules** → bu depodaki **`firestore.rules`** içeriğini yapıştır → **Publish**

### 3) Proje anahtarı
- Zaten `index.html` içindeki `FB_CONFIG` dolu (iq-basics). Başka projede kullanacaksan
  ⚙️ **Project settings → Your apps → Web** bilgileriyle değiştir. (Bu bilgiler gizli değildir.)

### 4) Kendini yönetici yap (tek seferlik)
1. Uygulamada portala gir (`.../#siparis`) → **Kayıt Ol** → kendi e-posta/şifrenle kayıt ol
2. Firebase **Firestore → Data → `kullanicilar`** → oluşan kaydını aç →
   `rol` = **`admin`**, `onay` = **`true`** yap
3. Artık **☁️ Buluta Yayınla / 👥 Bulut Kullanıcıları** bu hesapla çalışır

### 5) Uygulamayı yayınla
- Bu depo **GitHub Pages** ile yayında: `https://<kullanıcı>.github.io/<repo>/`
- Alternatif: Netlify Drop (index.html'i sürükle) / Firebase Hosting / Vercel — hepsi ücretsiz

---

## Günlük kullanım

### Yayınlama
- **Portal → ☁️ Buluta Yayınla**: katalogu + onaylı müşterilerin bakiye/geçmişini günceller.
  Stok/fiyat değişince tekrar bas.

### Müşteri kabulü
1. Müşteri `.../#siparis` → **Kayıt Ol → Müşteri**
2. Sen: **Portal → 👥 Bulut Kullanıcıları** → onayla, cari bağla
3. Müşteri girer → katalog + kendi bakiyesi/geçmişi; sipariş verir
4. Sen: **Portal → 📥 Bulut Siparişlerini Çek** → onayla (satışa döner, stok düşer)

### Çalışan
- **Kayıt Ol → Çalışan** → sen onayla → stok görür, **müşteri adına** sipariş girer
  (siparişte "çalışan" etiketi görünür)

### Fason
1. **Kayıt Ol → Fason** → sen onayla, **cari bağla** (fason kaydını seç — iş emirleri buradan eşleşir)
2. Üretimde ona durak atadıysan: **Portal → 🧵 Fasona İş Gönder**
3. Fason girer → iş emirlerini görür → "Başladım / Bitirdim / Teslim Ettim (adet)"
4. Sen: **Portal → 📥 Fason Durumları** → durumu görürsün
   > Gerçek teslim alma / stok / ödeme yine Üretim ekranından **elle** yapılır (bulut yalnız haberleşme).

### Uygulamayı telefona kurma (PWA)
- Android/Chrome: site açılınca **"📲 Uygulamayı Yükle"** ya da menü → *Ana ekrana ekle*
- iPhone/Safari: Paylaş → *Ana Ekrana Ekle*

---

## Sık sorulanlar
- **Ücret?** Firebase Spark (ücretsiz) + GitHub Pages = 0₺.
- **Kayıt olan admin olur mu?** Hayır. Kayıtta rol yalnız müşteri/çalışan/fason olabilir,
  onaysız başlar. Admin yalnız Firestore'dan elle atanır (sadece sen).
- **Müşteri başka müşteriyi görür mü?** Hayır — Firestore kuralları kendi verisine hapseder.
