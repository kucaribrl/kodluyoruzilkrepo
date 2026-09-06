# IQ Basics — Toptan Tekstil Yönetimi

Tek dosyalık (index.html) çevrimdışı çalışabilen bir PWA: stok, satış, cari, kasa/çek,
üretim (iş emri, fason), envanter (kumaş/aksesuar siparişi ve teslim), müşteri sipariş
portalı, raporlar, termal fiş, WhatsApp ve yazıcı otomasyonu. Çok cihazda Firebase
üzerinden canlı senkron çalışır.

- **Canlı uygulama:** https://kucaribrl.github.io/kodluyoruzilkrepo/
- **Yayınlama / bulut kurulumu:** `YAYINLAMA.md`
- **Firestore kuralları:** `firestore.rules` (Console'a yapıştırılıp yayınlanır), `storage.rules`

## Klasörler
| Yer | Ne |
|---|---|
| `index.html` | Uygulamanın tamamı (arayüz + veri modeli + senkron) |
| `sw.js`, `manifest.webmanifest` | PWA: çevrimdışı önbellek, kurulum |
| `yazici-agent/` | Bilgisayardaki termal yazıcıdan otomatik fiş basan ajan (Windows) — `BASLA-TR.md` |
| `wa-agent/` | WhatsApp mesajlarını otomatik gönderen ajan (Windows) — `OKU.md` |
| `sessiz-yazici/` | Tarayıcıdan sessiz yazdırma kısayolu |
| `test/` | Playwright uçtan uca testler — `test/OKU.md` |

## Geliştirme
- Sürüm damgası `index.html` içinde `APP_SURUM`, önbellek adı `sw.js` içinde `CACHE`; ikisi
  aynı numarayı taşımalı (CI kontrol eder). Her yayında ikisi birlikte artırılır.
- Para modeli: kalem fiyatları TL'dir; satışın `tutar` alanı satış para birimindedir,
  `satisDiv(s)` PB→TL çarpanıdır.
- Testler: `npm i playwright` (bir kez) → `for f in test/*.test.mjs; do node "$f" || exit 1; done`
- GitHub Actions her push'ta testleri, sürüm tutarlılığını ve bat/vbs/ps1 satır sonlarını kontrol eder.

## Lisans
MIT
