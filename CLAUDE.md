# CLAUDE.md — IQ Basics (toptan tekstil yönetimi)

Türkçe konuşan bir tekstil toptancısının günlük kullandığı CANLI uygulama.
Kullanıcıyla Türkçe, sade ve teknik terim kullanmadan konuş. Commit mesajları Türkçe.

## ⛔ Onay gerektiren işlemler (önce AÇIK onay al)
Aşağıdakileri kullanıcı açıkça "evet / yap" demeden YAPMA — testler geçse bile:
- `git push` (push, uzak depoyu değiştirir ve yayın iş akışını tetikleyebilir. Yayın etkisini doğrulamadan güvenli olduğunu varsayma).
- Canlı yayın, PR açma, `main` dalına dokunma.
- `firestore.rules` / `storage.rules` yayınlama (kullanıcı Firebase Console'da yapar; değişikliği hazırla, ona ne yapacağını söyle).
- Üretim (gerçek) verisini değiştiren her işlem: buluttaki Firestore verisine yazan, silen, toplu güncelleyen, sıfırlayan, yedekten geri yükleyen komut/betikler.
Onay istemeden önce ne yapılacağını, neyin değişeceğini ve geri dönüşünü kısaca anlat.
Bir onay sadece o işlem içindir; sonraki push/yayın için yeniden sor.

## Mimari (kısa)
- Tek sayfa PWA: tüm kod `index.html` içinde (HTML+CSS+JS, framework/derleme yok).
  `sw.js` önbellek/çevrimdışı, `qrcode.js` yerel kütüphane, Firebase SDK CDN'den.
- Sunucu yok: iş mantığı tarayıcıda. Bulut = Firebase (Firestore, Auth, Storage).
  Güvenlik sınırı `firestore.rules` / `storage.rules`.
- `yazici-agent/`, `wa-agent/` (Node.js, Windows): buluttaki `yazdirma` ve
  `wa_kuyruk` kuyruklarını dinler. `sessiz-yazici/`: sessiz baskı betiği.
- Yayın: GitHub Pages. Push, uzak depoyu değiştirir ve yayın iş akışını
  tetikleyebilir. Yayın etkisini doğrulamadan güvenli olduğunu varsayma (bkz. onay kuralları).
- Her oturum başında git branch --show-current ve git status ile aktif dalı doğrula. Dalı varsayma.

## Veri modeli
- Tüm veri tek `db` nesnesi → localStorage (`KEY`) + IndexedDB yedeği. `save()` ile yazılır.
- Bulut senkronu: `CANLI_DOMEN` (domain başına TEK Firestore belgesi:
  stok/cari/kasa/satis/cek/uretim/ayar/yonetim). Yeni bir liste ekliyorsan ilgili
  domaine VE gerekiyorsa `MERGE_LISTELER`'e ekle; sayaç gibi toplanan alanlar
  `KUMULATIF` (üç yönlü birleşim, K5).
- Kayıtlar `_m` damgası taşır; silinenler `_tomb` ile izlenir. Kayıt fiziksel
  silinmez: iptal = `iptal:true` (çizili kalır). Yeni silme akışı da böyle olmalı.
- Para: `kalem.fiyat` HER ZAMAN TL; satışın `tutar`/`odenen`/`tasima`/`ekstralar`
  alanları satışın para biriminde (`s.pb`); çevirme `satisDiv(s)`. Ürün fiyatı
  `urunSatisTL(u)` / `urunAlisTL(u)`. Seri üründe `u.alis`/`u.satis` PARÇA başıdır,
  `birimAdet(u)` seri adedi.
- Çok lokasyon: ürün stoğu `renk.loklar[lokId]` (ya da `u.loklar`) gerçek kaynak;
  `.stok` sadece aktif lokasyonun yansıması (`stokProjKaydet`/`stokProjYukle`).
  Aktif lokasyon cihaza özel (`iq_aktifLok`). Depo ≠ mağaza: çek/müşteri/tahsilat
  mağazaya yazılır (`magazaLokId`, `magazaListe`).
- Rol/izin: `ROLLER`, `rolYetki`, `canSee`, `adminMi`, `paraGoster`, `karGoster`.
  İstemci kontrolü tek başına güvenlik değildir; gerekirse rules da güncellenir.

## Kod yazma kuralları
- `index.html` büyük ve tek dosya: değişiklikten sonra TÜM `<script>` bloklarını
  `new vm.Script()` ile ayrıştırarak (parse) doğrula.
- Tek satırlık fonksiyonların ortasına `//` yorum koyma (satırın geri kalanını
  yorum yapar). `/* */` kullan.
- `load()` (dosyanın başında çalışır) ve onun çağırdıklarında `const`/`let` ile
  sonradan tanımlanan bir şey kullanma — `function` bildirimi kullan (TDZ hatası
  uygulamayı ÖRNEK veriye düşürür).
- Kullanıcı metnini HTML'e basarken `esc()`, onclick içinde `jsq()`, resim
  kaynağında `guvenliSrc()` kullan.
- Onay: sıradan işlem `askConfirm(msg, fn, etiket)`; para/stok silen kritik
  işlem `askKritik(...)` (PIN ya da "SİL").
- Pencereler: ana `open_(baslik, html)` (#ov), ikincil `#sov`, onay `#cov`.
- Kullanılmayan fonksiyon/CSS bırakma; ölü kodu kaldır.

## Sürüm ve yayın
1. Her değişiklikte `index.html` → `APP_SURUM = '2026.07.24-N'` ve `sw.js` →
   `CACHE = 'iqbasics-vN'`: N AYNI olmalı (CI kontrol eder), bir artırılır.
   Komutlar depo kökünden.
2. Tüm testleri çalıştır ve sonucu raporla (bkz. Testler).
3. Commit (Türkçe, ne/neden).
4. Push / yayın: SADECE kullanıcının açık onayıyla. Push öncesinde aktif dalı,
   hedef uzak dalı ve GitHub Pages yayın kaynağını doğrula. Hangi dalın
   güncelleneceğini kullanıcıya açıkla. Her push için ayrıca açık onay al.
   Testler geçse bile otomatik push yapma; onay sonrası hangi sürümün yayında
   olduğunu söyle (Ayarlar'da görünür).

## Testler
- `test/NN-*.test.mjs`: Playwright ile gerçek tarayıcı akışı. Çalıştırma:
  `for f in test/*.test.mjs; do node "$f" || exit 1; done`
  (`node_modules/playwright` yoksa global kurulumdan bağla; tarayıcı kurulu).
- Yeni test: kendi sunucusunu RASTGELE portta açsın (`listen(0)`), `sw.js` için
  404 dönsün (yoksa service worker sayfayı yeniden yükler), başarısızlıkta
  `process.exit(1)` versin.
- Onaylar: `#cov/#cMsg/#cYes/#cNo`; kritik onay: `#kk-txt`'e "SİL" + `kritikOnayla()`.
- Davranışı değiştiren her özellik için test ekle ve `test/OKU.md` (çalıştırma
  listesi + Kapsam tablosu) güncelle.
- **Başarısızlık raporu:** Her test çalıştırmasından sonra başarısız olanları
  (dosya + test adı + hata) kullanıcıya bildir. Önceden var olan hatalarla yeni
  değişiklikten kaynaklananları AYIR: şüphede değişikliği geri alıp (ör.
  `git stash`) aynı testi temiz kodda çalıştırarak karşılaştır ve sonucu belirt.
- **İş kurallarını bozma:** Testi geçirmek için gerçek iş kuralını (para, stok,
  bakiye, onay, kilit, yetki davranışı) değiştirme. Test eskimişse (davranış
  bilerek değişmişse) testi gerçek davranışa göre güncelle ve bunu raporda söyle;
  emin değilsen kullanıcıya sor.

## Yapma
- `wa-agent/config.json`, `yazici-agent/config.json`, `wa-oturum/` commit etme.
- `.bat/.vbs/.ps1` dosyalarının CRLF satır sonunu bozma.
- Onay gerektiren işlemleri (yukarıda) onaysız yapma.
- Kullanıcının e-posta/telefon bilgisini dış servislere gönderme.

## Bilinen riskler (dokunurken dikkat)
- Firestore belge sınırı 1 MB: `satis`/`kasa` belgeleri büyüyor.
- localStorage kotası: fotoğraflar Cloudinary yoksa base64 olarak içeride.
- `aktifLok` hâlâ `CANLI_DOMEN.ayar` içinde (yazılıyor, okunurken yok sayılıyor).
- Eski testler (01–06) sabit port kullanıyor; paralel çalıştırma çakışır.
