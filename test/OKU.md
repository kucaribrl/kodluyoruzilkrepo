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
node test/07-envanter-siparis.test.mjs
node test/08-faz-a-guvenlik.test.mjs
node test/09-faz-b-para.test.mjs
node test/10-faz-c.test.mjs
node test/11-isemri-iptal-metre.test.mjs
node test/12-kumulatif-birlesim.test.mjs
node test/13-pin-pbkdf2.test.mjs
node test/14-foto-storage.test.mjs
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
| 04 | Parti/lot akışı — siparişte parti YOK, teslimde girilir; aynı renkten çoklu parti, stok kırılımı, 'siparişi kapat' |
| 05 | Stok kartında parti kutusu (tek/çok parti, koruma ve toplama davranışı) |
| 06 | Eylül 2026 kod incelemesi düzeltmeleri: kk/çek cariIsle+POS hesabı, USD fason borcu, çok cihazlı id, tek net kâr, bakiye ezilmesi, müşteri modu mezar taşı, onclick XSS (jsq) |
| 08 | Faz A güvenlik (Eylül inceleme raporu): adminMi yönetici kapısı, sıfırlamada mezar taşı yok, IndexedDB silme, portal belge şeması + kupon yeniden hesabı, mükerrer onay, analitik enjeksiyonu, renksiz↔renkli stok, yedek kalıcılığı |
| 09 | Faz B para doğruluğu: bosBaslat hesap id, ayar alan bazlı birleştirme, satışa bağlı çek koruması, üretim renk eşleşmesi, renksiz düşüm, renkli ürün satış kuralı, düzenlemede vade/kur, müşteri ekleme stash, taksitli iptal, dövizli stok raporu, kasa transfer, kritik 0, open_ kaçış |
| 10 | Faz C: portal şifre özeti + oturum belirteci, dönem kıyası (aynı gün sayısı), tahsilat tek tanım, karşılıksız çek kasa, ciro ekstre, taksit yuvarlama, waTel 00, gunFark, fiş guard, aksesuar gelen kadar, katalog gizli fiyat/kupon |
| 11 | Kumaş tüketiminde kg↔metre dönüşümü (gramaj × en) ve iş emri iptali (kumaş + 'elimde var' malzeme geri, otomatik alım siparişi iptal, başlamış üretimde engel) |
| 12 | K5 üç yönlü kümülatif birleşim: iki cihaz aynı cari/kasa/ürün stoğunu değiştirince taban + yerel fark + bulut fark (LWW para/stok silmez); taban yerelde, bulut belgesine gitmez |
| 13 | PIN güvenliği: tuzlu PBKDF2 özeti, eski djb2 kaydın yükseltilmesi, 5 yanlışta 30 sn kilit, kilit/yönetici dönüşü/tutar gösterme akışları |
| 14 | Fotoğraf deposu: Cloudinary → Firebase Storage → cihaz önceliği, izin hatasında base64'e düşüş, cihazdaki fotoğrafları toplu buluta taşıma |
| 07 | Envanter malzeme siparişi: gramaj/en/foto/kartela+renk kodu, tüm türlerde çeşit satırları, teslimde çoklu parti + fiş foto + kapat, iş emri önizleme/yazdır, tekrar sipariş, sade bekleyen ekranı, WA dönüşü |

> Not: Para birimi modeli — `kalem.fiyat` her zaman TL, satışın `tutar` alanı satış
> para birimindedir; `satisDiv(s)` PB→TL çarpanıdır. Hesap değiştiren her
> geliştirmeden sonra en az 01 ve 02 koşulmalıdır (TL + USD senaryoları içerir).
