# 🖨️ Sessiz Baskı — MC gibi, ekransız yazdırma (Windows)

MC programı bilgisayara kurulu olduğu için yazıcıya **direkt** basar, yazdırma
ekranı çıkmaz. Bizimki web sitesi olduğu için tarayıcı normalde her seferinde
ekran gösterir. **Bu başlatıcı, Chrome'u "sessiz baskı" moduna sokar** — artık
"Yazdır" deyince ekran çıkmaz, direkt basar. Tam MC gibi.

## Kurulum (bir kez · 3 dakika)

### 1) Google Chrome kurulu olsun
Yoksa: https://www.google.com/chrome

### 2) Yazıcıyı VARSAYILAN yap + kağıt boyutunu ayarla
- **Başlat → Ayarlar → Bluetooth ve cihazlar → Yazıcılar ve tarayıcılar**
- Yazıcına tıkla → **"Varsayılan olarak ayarla"**
- Sonra **"Yazdırma tercihleri"** → **Kağıt boyutu** = gerçek etiket/fiş ölçün
  (barkod etiketi için ör. 60×40 mm; termal fiş için 80 mm rulo)
- **Media type = Labels with gaps** (etiketli yazıcıda boş etiket beslemesini keser)

> 💡 Sessiz modda üstbilgi/altbilgi (URL, saat) **basılmaz** — o sorun da gider.

### 3) Bu klasörü bilgisayara indir
GitHub → **Code → Download ZIP** → içinden **`sessiz-yazici`** klasörünü çıkar.

### 4) Başlat
- **`IQ-Basics-Sessiz-Yazici.bat`** dosyasına **çift tıkla**
- Uygulama açılır. Artık **Yazdır** deyince ekran çıkmaz, direkt basar ✅
- Uygulamayı hep **bu .bat'tan** aç (masaüstüne kısayolunu koyabilirsin)

## İki yazıcın varsa (fiş + barkod ayrı)
Sessiz mod **varsayılan** yazıcıya basar. Hangisine basacaksan onu Windows'ta
**varsayılan** yap. Sık değiştireceksen **yazıcı ajanı** daha iyi (aşağıda).

## Daha da otomatik: Yazıcı Ajanı
Telefondan satış yapınca bilgisayarın **kendiliğinden** basmasını istersen
`yazici-agent` klasöründeki ajanı kur (BASLA-TR.md). O, telefondan gelen fişi
bilgisayardaki yazıcıya otomatik basar — hiç dokunmadan.

## Sık sorunlar
| Sorun | Çözüm |
|------|-------|
| Yine ekran çıkıyor | Uygulamayı normal Chrome'dan değil, **bu .bat'tan** aç. |
| Yanlış yazıcıya basıyor | Doğru yazıcıyı Windows'ta **varsayılan** yap. |
| İçerik kayıyor / boş etiket | Sürücüde **kağıt boyutunu** etikete ayarla + **Labels with gaps**. |
| Baskı soluk | Sürücü → **Koyuluk/Density** yükselt. |
| "Chrome bulunamadı" | Chrome'u kur (google.com/chrome). |
