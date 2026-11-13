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
node test/15-pb-onsiparis-kirik.test.mjs
node test/16-tekrar-uret.test.mjs
node test/17-tek-magaza.test.mjs
node test/18-gunsonu-portal-geri.test.mjs
node test/19-git-guvenlik-hook.test.mjs   # tarayıcı gerektirmez
node test/20-stok-transfer.test.mjs      # GÖZLEM testi: riskler CI'ı kırmaz
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
| 18 | Gün sonu kanal kanal sayım (nakit ₺/$/€, POS slip, havale, çek) + kayıt; portalda adet başı fiyat; tükenmiş üründe geri düğmesi; soldan sağa kaydırınca geri |
| 17 | Tek mağaza görünümü: açılışta mağaza seçimi, sadece seçili mağazanın satış/cari/çek/rapor verisi, mağaza mağaza satırlar gizli, Ayarlar'da 'Tüm mağazaları göster', seçim cihaza özel; yeniden açılışta gerçek veri yüklenmesi |
| 16 | 🏭 Tekrar Üret: ürün kartından / bitmiş iş emrinden, ürün seçili + son (ya da seçilen) iş emrinin kumaş, tüketim, renk dağılımı, kesimci-ücret, genel gider, sonraki aşama ücretleri ve termini dolu iş emri; önceki iş emri yoksa sadece ürün; depocuda buton yok |
| 19 | Git güvenlik Hook'u (`.claude/hooks/git-guvenlik-kontrolu.mjs`): korunan dala (main, master, canlı yayın dalı) push ve force push → DENY; dal belirtilmeyen push'ta push.default / remote.<ad>.push / remote.pushDefault / mirror etkisi; HEAD, HEAD:main, refs/heads/main, git -C/-c, bileşik komutlar; bash -c / eval / değişkenli komutlar → ASK; tırnak içi metin ve heredoc'ta geçen 'git push' → karar yok; riskli yerel işlemler → ASK; GitHub MCP ile korunan dala yazma ve merge → DENY; Hook asla 'allow' vermez. Yalnızca geçici, yalıtılmış git depolarında çalışır |
| 20 | Stok transferi GÖZLEM testi (S1–S8, ERP v171 mevcut davranışı): PASS/FAIL yalnız altyapı + bugün doğru olan temel akışlar (oluştur/teslim, renkli ürün, yoldayken iptal, iptal kaydı korunur). Riskler `GÖZLEM` satırlarıyla [RİSK GÖZLENDİ]/[İŞ KURALINA AYKIRI] etiketli basılır ve çıkış kodunu etkilemez: teslim sonrası iptal, iki cihazda çift teslim, teslim+iptal çakışması, onay penceresi açıkken uzaktan güncelleme, aynı ürün iki satır, açık transferli ürünün silinmesi, yetersiz stok. İki cihaz tek sayfada `canliDomenUygula` ile simüle edilir — gerçek Firestore sırası/transaction'ı kanıtlamaz. localhost dışı tüm istekler engellenir |
| 15 | Satış ekranında
 ₺ → $ / € değişince yazılı tutarların (parça fiyatı, taşıma, ek ücret, kesik, ödeme satırı) kura göre çevrilmesi + POS kaydı; ön sipariş kilidi (mal stoğa girmeden teslim/toplama/kargo yok, FIFO açılma, portal); toplama emrinde kırık seri ekle/düzenle/kaldır (tutar, bakiye, stok, seri bozma ve birebir geri alma) |


> Not: Para birimi modeli — `kalem.fiyat` her zaman TL, satışın `tutar` alanı satış
> para birimindedir; `satisDiv(s)` PB→TL çarpanıdır. Hesap değiştiren her
> geliştirmeden sonra en az 01 ve 02 koşulmalıdır (TL + USD senaryoları içerir).

## Git güvenlik Hook'u — güvenlik sınırları
`.claude/hooks/git-guvenlik-kontrolu.mjs`, Claude Code'un `PreToolUse` olayında Bash ve
`mcp__github__*` araç çağrılarını inceler. Kararları yalnızca **deny**, **ask** ya da
"karar yok"tur; **asla allow vermez**, yani mevcut izinleri yalnızca sıkılaştırır.

- **Hook başlatılamazsa koruma yoktur.** Claude Code belgesine göre Hook başlatılamazsa
  (Node kurulu değil, dosya yok), 0/2 dışı kodla çıkarsa, geçersiz JSON basarsa veya zaman
  aşımına uğrarsa bu *engellemeyen hata*dır ve araç çağrısı **çalışır**. Bunu kapatmak için
  ayarda `"onFailure": "block"` kullanılmalıdır (Claude Code ≥ 2.1.295). Betik içindeki
  hatalar betik tarafından yakalanır ve **ask**'e çevrilir.
- Yalnızca Claude Code araç çağrılarını görür: kendi terminaliniz, GitHub web arayüzü,
  `gh` CLI, CI ve bu ayar dosyası olmayan makineler korunmaz.
- Metin çözümlemesi kazaları önler; kasıtlı gizlemeye (ör. betik dosyası içinden push,
  `$(echo gi)t push`) karşı tam koruma değildir.
- Dal belirtilmeyen push'ta hedef Git ayarları okunarak belirlenir; emin olunamazsa **ask**.
- Kesin koruma için GitHub'da `main` ve canlı yayın dalına **branch protection** açılmalıdır.
- Hook, `.claude/settings.json` içinde tanımlanana kadar **etkin değildir**.

