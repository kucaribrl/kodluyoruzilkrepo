# ☁️ Öz Tekstil — Yayınlama Rehberi (Bulut / Firebase)

Bu rehber, müşterilerin **kendi telefonundan** portala girip sipariş verebilmesi için
uygulamayı internete + Firebase'e bağlamayı anlatır.

> Not: Uygulama bulut olmadan da tam çalışır (kiosk/kendi cihazın). Aşağıdakiler
> sadece **müşterinin kendi cihazından** sipariş vermesi içindir.

---

## Nasıl çalışır (özet)
- Sen panelde **"☁️ Buluta Yayınla"** dersin → ürün katalogun buluta gider.
- Müşteri linke girer → katalogu görür → **misafir olarak** (ad + telefon) sipariş verir.
- Sipariş buluta düşer → sen panelde **"📥 Bulut Siparişlerini Çek"** dersin → sipariş gelir.
- Senin cari/çek/kâr verilerin **buluta gitmez**, kendi cihazında kalır.

---

## Adım adım kurulum

### 1) Firebase projesi (5 dk)
1. https://console.firebase.google.com → **Proje oluştur** (ör. `oztekstil`)
2. Sol menü **Build → Firestore Database → Create database** → *Production mode* → bir bölge seç (ör. `europe-west`)
3. Sol menü **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**
4. **Authentication → Users → Add user**: kendine bir yönetici hesabı oluştur (e-posta + şifre) — bunu "Bulut Girişi"nde kullanacaksın.

### 2) Güvenlik kurallarını uygula
1. **Firestore → Rules** sekmesi
2. Bu depodaki **`firestore.rules`** dosyasının içeriğini yapıştır → **Publish**

### 3) Proje anahtarını uygulamaya yaz
1. Firebase → ⚙️ **Project settings → General** → aşağıda **"Your apps"** → Web app (yoksa `</>` ile ekle)
2. Çıkan `firebaseConfig` bilgilerini kopyala
3. `index.html` içindeki `FB_CONFIG` bloğunu doldur:
```js
const FB_CONFIG = {
  apiKey: "…", authDomain: "…", projectId: "…",
  storageBucket: "…", messagingSenderId: "…", appId: "…"
};
```
> Bu bilgiler gizli değildir (tarayıcıda çalışır); güvenlik yukarıdaki kurallarla sağlanır.

### 4) Uygulamayı yayınla (ücretsiz)
En kolay yol — **Netlify Drop**:
1. https://app.netlify.com/drop
2. `index.html` dosyasını sürükle-bırak
3. Sana `https://xxxx.netlify.app` gibi bir adres verir.
4. Müşteri linki: `https://xxxx.netlify.app/#siparis`

> Alternatif: Firebase Hosting, GitHub Pages, Vercel — hepsi ücretsiz çalışır.

### 5) Test et
1. Kendi telefonundan/panelinden **Portal → ☁️ Buluta Yayınla** (ilk girişte Firebase e-posta/şifre sorar)
2. Başka bir telefondan/tarayıcıdan `…/#siparis` adresini aç → katalog görünmeli → sipariş ver
3. Panelde **Portal → 📥 Bulut Siparişlerini Çek** → sipariş listeye düşmeli → **Onayla**

---

## Sık sorulanlar
- **Ücret?** Firebase ücretsiz *Spark* planı bu hacimde 0₺. Netlify de ücretsiz.
- **Müşteri şifresi?** MVP'de müşteri portalı **misafir** (ad+telefon) çalışır — şifreler buluta
  yazılmaz (güvenlik). İleride Firebase Auth ile müşteriye özel şifreli giriş + geçmiş/cari eklenebilir.
- **Fotoğraflar?** Ürün fotoğrafları katalogla birlikte gider (küçük/dataURL). Çok büyük
  fotoğraf koleksiyonu için ileride Firebase Storage'a geçilebilir.
- **Katalog güncelleme?** Stok/fiyat değişince tekrar **"Buluta Yayınla"** de — anında güncellenir.

---

## Sonraki adım (opsiyonel — Faz 2b)
Müşteriye **özel şifreli giriş** + sipariş geçmişi + cari durumu göstermek istersen,
Firebase Auth ile müşteri hesapları kurulur. Hazır olduğunda söyle, eklerim.
