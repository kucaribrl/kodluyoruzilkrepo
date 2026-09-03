# IQ Basics — Test Paketi

Tarayıcıda (Playwright/Chromium) gerçek kullanıcı akışlarını koşan uçtan uca testler.
Her dosya kendi yerel sunucusunu açar, `index.html`'i yükler, akışı sürer ve
PASS/FAIL satırları basar; hata varsa çıkış kodu 1 olur.

## Kurulum (bir kez)
```bash
npm i playwright      # tarayıcıyı da indirir
```

## Çalıştırma
```bash
node test/01-hata-duzeltmeleri.test.mjs
node test/02-guvenlik-para.test.mjs
node test/03-temiz-uctan-uca.test.mjs
node test/04-parti-siparis.test.mjs
node test/05-parti-stok.test.mjs
node test/06-inceleme-duzeltmeleri.test.mjs
```
Hepsi birden:
```bash
for f in test/*.test.mjs; do echo "== $f =="; node "$f" || exit 1; done
```

Sistemde kurulu bir Chromium kullanmak istersen:
```bash
PLAYWRIGHT_CHROMIUM=/usr/bin/chromium node test/01-hata-duzeltmeleri.test.mjs
```

## Kapsam
| Dosya | Ne test eder |
|---|---|
| 01 | 50 hatalık denetimin kritik düzeltmeleri: iade kuru, dövizli ürün fiyatı, çek kilidi/karşılıksız, parti stoğu, dagit, kampanya tarihi, fiş toplamları, portal kupon, rol/temizlik |
| 02 | Güvenlik+para raporu: esc/guvenliSrc, satış tahsilatının kasa defterine yazımı, dövizli rapor çift-kur, portal fiyat güvencesi, iade vade farkı, ekstre taksit ayrımı, yedek foto ayıklama |
| 03 | Sıfırdan temiz akış: temizle → müşteri/ürün → satış → fişler → kumaş siparişi+parti+teslim → rapor → portal → tüm ekranlar |
| 04 | Kumaş siparişi formunda parti/lot akışı (giriş → teslim prefill → stok FIFO → WhatsApp metni) |
| 05 | Stok kartında parti kutusu (tek/çok parti, koruma ve toplama davranışı) |
| 06 | Eylül 2026 kod incelemesi düzeltmeleri: kk/çek cariIsle+POS hesabı, USD fason borcu, çok cihazlı id, tek net kâr, bakiye ezilmesi, müşteri modu mezar taşı, onclick XSS (jsq) |

> Not: Para birimi modeli — `kalem.fiyat` her zaman TL, satışın `tutar` alanı satış
> para birimindedir; `satisDiv(s)` PB→TL çarpanıdır. Hesap değiştiren her
> geliştirmeden sonra en az 01 ve 02 koşulmalıdır (TL + USD senaryoları içerir).
