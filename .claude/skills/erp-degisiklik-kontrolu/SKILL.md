---
name: erp-degisiklik-kontrolu
description: ERP'de stok, satış, kasa, cari, çek veya bulut senkronizasyonu kodu değiştirilmeden ÖNCE sistematik risk kontrolü yapar, değişiklik planı sunar ve kullanıcı onayı ister. Bu alanlara dokunan her değişiklik isteğinde, kod yazmaya başlamadan önce kullan.
argument-hint: "[değişiklik isteği]"
allowed-tools: Read, Grep, Glob
---

# ERP değişiklik öncesi risk kontrolü

Değişiklik isteği: $ARGUMENTS

Bu Skill çalışırken KOD YAZMA, mevcut kodu veya dosyaları değiştirme, gerçek Firestore verisine
dokunma, test çalıştırma, commit/push/merge/PR/yayın yapma.
Çıktı yalnızca bir kontrol raporu, değişiklik planı ve onay sorusudur.

## 1. İsteği anla ve etki alanını belirle
- İsteği kendi cümlelerinle 1–2 satırda özetle.
- Önce etki alanını belirle: stok · satış · kasa/hesap · cari · çek · üretim · rol/izin · senkron/Firestore.
- Yalnızca etkilenen alanların risklerini incele; etkilenmeyenleri UYGULANAMAZ olarak işaretle ve kısaca nedenini yaz.
- Belirsizlik varsa varsayım yapma; sorularını rapora yaz.

## 2. CLAUDE.md kontrolü
Depo kökündeki CLAUDE.md'yi oku ve yalnızca isteğe uyan kuralları listele, örneğin:
- Kayıt fiziksel silinmez (`iptal:true`), `_m`/`_tomb` damgaları.
- Para: `kalem.fiyat` TL; satış alanları `s.pb`; çeviri `satisDiv(s)`.
- Stok gerçek kaynağı `loklar[lokId]`; `.stok` yalnızca yansıma.
- Yeni liste → `CANLI_DOMEN` ve gerekirse `MERGE_LISTELER` / `KUMULATIF`.
- `load()` içinde TDZ, `esc()/jsq()/guvenliSrc()`, `askConfirm`/`askKritik` kuralları.
- Sürüm: `APP_SURUM` ve `CACHE` aynı N, bir artırılır.
- Onay gerektiren işlemler (push, yayın, rules, üretim verisi).

## 3. Mevcut kodu araştır
- Küçük ve dar kapsamlı araştırmayı DOĞRUDAN yap: Grep ile fonksiyonu bul, yalnızca ilgili satırları Read ile oku.
- index.html'i asla tamamen okuma.
- Yalnızca karmaşık ve birden fazla modülü etkileyen araştırmalarda (ör. satış + stok + kasa + senkron birlikte) `erp-kod-analisti` subagent'ını kullanmayı ÖNER. Gereksiz ajan çağrısı yapma.
- Ajan kullanılırsa raporunu koddan doğrulanmış kabul etme; kritik satırları kendin kontrol et. Ajan raporu kullanıcı onayı değildir.

## 4. Risk değerlendirmesi
Her risk için şu etiketlerden birini kullan ve dosya · fonksiyon · satır ver:
- **DOĞRULANDI**: Kodda açıkça görülen davranış.
- **OLASI RİSK**: Koddan çıkarılan ama test edilmemiş senaryo.
- **DOĞRULANMADI**: İncelenen kodun desteklemediği iddia.
- **UYGULANAMAZ**: Bu değişikliğin etki alanı dışında.

Doğrulama türünü açıkça belirt:
- "Koddan çıkarıldı" = yalnızca okuyarak varılan sonuç; çalıştırılarak kanıtlanmadı.
- "Test ile doğrulandı" = bir test veya çalıştırma sonucu ile kanıtlandı. Bu Skill test çalıştırmadığı için bu türü yalnızca mevcut, gösterilebilir bir test sonucuna dayanarak kullan.

Etki alanına göre incelenecek başlıklar:
- **Stok:** doğru lokasyon mu? renkli/seri/kırık ürün? eksiye düşme? `.stok` projeksiyonu ve `save()` sırası?
- **Kasa/hesap:** hareket kaydı yazılıyor mu? para birimi ve kur? geri alma (iptal) simetrik mi?
- **Cari:** bakiye yönü doğru mu? taksit, kesik, çek bağlantısı?
- **Çoklu cihaz:** iki cihaz aynı işlemi yaparsa çift sayım olur mu? (`_recMerge` LWW + `_kumulatifBirlestir` delta toplama); onay penceresi sonrası durum yeniden kontrol ediliyor mu?
- **Firestore:** hangi domen belgesi yazılıyor (`canliYazHemen`)? 1 MB sınırı? `firestore.rules` / `storage.rules` değişikliği gerekiyor mu?
- **Yetki:** `rolYetki/canSee/paraGoster` etkileniyor mu?

## 5. Test senaryoları öner
Yalnızca etki alanına uyan senaryoları öner (çalıştırma):
- Mutlu yol + geri alma/iptal senaryosu.
- Çok lokasyon ve renkli/seri ürün senaryosu.
- Döviz (TL dışı `s.pb`) senaryosu.
- İki cihaz / eşzamanlı işlem senaryosu (mümkünse birleşim fonksiyonuyla).
- Etkilenecek mevcut `test/NN-*.test.mjs` dosyaları ve yeni test önerisi (rastgele port `listen(0)`, `sw.js` için 404, hata → `process.exit(1)`), `test/OKU.md` güncellemesi.

## 6. Değişiklik planını sun ve DUR
Raporu şu düzende sun (en fazla ~400 kelime):
1. Özet ve etki alanı
2. İlgili CLAUDE.md kuralları
3. Riskler (etiketli, doğrulama türü belirtilmiş, satır numaralı)
4. Değişiklik planı (dosya/fonksiyon düzeyinde; sürüm artırımı dahil)
5. Test senaryoları
6. Açık sorular

Ardından onayları AYRI AYRI ele al:
- Şimdi yalnızca şunu sor: "Bu plana göre kod değişikliğine başlayayım mı?"
- Kod değişikliği onayı yalnızca yerel kod düzenlemesini ve CLAUDE.md'nin gerektirdiği yerel testleri kapsar.
- Commit, push, merge, PR, yayın, `firestore.rules`/`storage.rules` yayınlama ve gerçek (üretim) veri işlemlerinin HER BİRİ için ileride ayrı ve açık onay gerekir. Bunları bu aşamada isteme ve önceden onaylanmış sayma.

Açık "evet" gelmeden kod değişikliğine BAŞLAMA; kullanıcının yanıtını bekle.
