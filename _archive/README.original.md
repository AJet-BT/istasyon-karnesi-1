## Kullanıcılı taşınabilir paket

Bu ZIP mevcut kullanıcı kayıtları ve bcrypt parola hash'leri içeren özel `private-transfer/` yedeğiyle gelir. Yeni ve boş yerel kurulumda `npm run install:ci`, `npm run build`, `npm run accounts:restore`, `npm run dev` komutlarını sırayla çalıştırın. Aynı aktif hesaplar aynı e-posta ve şifrelerini kullanır.

Git klonu veritabanını otomatik taşımaz. Özel yedeği yeni kurulumun proje klasörüne ayrıca kopyalayın; `private-transfer/` Git dışında tutulur. Başka canlı hedef ve veritabanı için [KULLANICI-AKTARIMI.md](KULLANICI-AKTARIMI.md) talimatlarını izleyin.

# AJet İstasyon Performans Platformu

Excel istasyon verilerini doğrulayan, havalimanı master verisiyle zenginleştiren ve ortak metrik kurallarıyla KPI, grafik, filtre, Excel/CSV ve PDF raporları üreten operasyon platformu.

## Teknoloji ve yerel çalıştırma

Next.js 16, React 19, TypeScript, Vinext/Cloudflare Workers, D1, R2, Drizzle, SheetJS ve Recharts kullanılır. Node.js `>=22.13.0` ve npm gerekir. Paket komutları Windows, macOS ve Linux'ta çalışır.

```text
npm run install:ci
npm run dev
```

Kurulum kilitli bağımlılıkları tek, süre sınırı olan `npm ci` ile kurar, Vinext tarball bütünlüğünü ve kurulum sırasında bağımlılık girdilerinin değişmediğini kontrol eder. Önbellek, geçici dosyalar ve Wrangler günlükleri Git dışındaki `.sites-runtime/` altında tutulur. Yerel D1/R2 durumu `.wrangler/state/` altında oluşturulur.

Veritabanı şeması için önce build alın, ardından `drizzle/` içindeki SQL migration dosyalarını sıralarıyla yerel D1'e uygulayın. Örneğin:

```text
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_jazzy_the_spike.sql
```

Diğer migration dosyalarını aynı komutla sırayla uygulayın. Uygulanmış migration dosyalarını yeniden çalıştırmayın. Yerel hesap bakım testi için korunacak çalışma alanı/veri kapsamının ayrıca hazırlanmış olması gerekir.

## Veri yükleme ve raporlama

Normal yüklemede **Excel dosyası** ve **Rapor / Veri Kümesi Başlığı** girilir. Uygulama çalışma sayfasını, gerçek başlık satırını, dönem ve Handling Provider bilgisini kaynaktan algılar. Belirsizlik veya geçersiz değer importu durdurur. Ayrıntılı sayfa/sütun eşleştirmesi istisna bölümündedir; başarılı seçim yeniden işleme için saklanır. XLSX, XLS ve CSV dosyaları 15 MB'a kadar kabul edilir.

PDF’ler AJet logolu kapak, dönem, iş filtreleri ve KPI kutucuklarıyla sunulur. Teknik köken ve iç veri türü bayrakları kayıtlarda korunur; PDF sunumuna taşınmaz. Master PDF port kutucuklarını dashboard sırasıyla gösterir. Ana sayfanın seçili 12 aylık metriği değişmez rapor snapshot’ına alınır. Boş kaynak hücresi **Kaynakta Raporlanmamış**, gerçek sıfır ise sıfırdır. Yolcu metriği **Yolcu Sayısı** adıyla tek kimlikte kullanılır. Yeni adet metrikleri ve yolcu ağırlıklı Dijital Biniş Kartı Kullanım Oranı ortak hesaplama katmanını kullanır.

PDF seçenekleri tam olarak **Hızlı PDF** ve **Master PDF**'dir. Hızlı PDF aktif kapsamın tüm KPI'larını ve uygun karşılaştırmasını özetler. Master PDF tarihsel grafikler, karşılaştırma grafikleri, istasyon dökümü, veri kalitesi/kapsam ve kaynak izlenebilirliği ekler. Her ikisi aynı değişmez kapsamdan gerçek uygulama bileşenini yazdırır. PDF tarayıcının yazdırma/kaydetme akışıyla alınır; uygulama kaydetme sonucunu veya PDF boyutunu doğrulayamaz ve rapor geçmişini buna göre hazırlanmış olarak işaretler.

## Runtime bağlayıcıları ve hesap bakımı

`DB` ve `BUCKET`, `.openai/hosting.json` üzerinden D1 ve R2 runtime bindingleri olarak sağlanır. Secret değerlerini kaynak koduna veya Git'e eklemeyin. Yerel Worker secret'ları Git dışında kalan `.dev.vars` dosyasında; production değerleri güvenli runtime secret yönetiminde tanımlanır.

- `ACCOUNT_RESET_TOKEN`: En az 32 karakterlik, yetkili tek seferlik hesap bakımını koruyan secret.
- `ENABLE_TEST_DATA_AUTO_IMPORT`: Yalnız kontrollü demo/test için `true`; production için `false`.

Uygulama başlangıcında otomatik yönetici oluşturma veya bootstrap hesabı açma yoktur. Yetkili bakım istemcisi `POST /api/maintenance/account-reset` adresine aynı origin'den Bearer bakım token'ı ve yönetici e-postası/şifresi içeren JSON gönderir. İşlem yalnız `madiyaman@ajet.com` hesabını aktif sistem yöneticisi yapar; diğer hesapları arşivler, mevcut oturumları iptal eder ve verileri korur. Mevcut yönetici ID'si korunur; hesap yoksa açıkça oluşturulur. Tek seferlik tamamlanma kaydı tekrar ve eşzamanlı çalıştırmayı engeller. Bakım token'ını işlem tamamlandıktan sonra runtime'dan kaldırın. Production bakım işlemi normal test veya build komutlarınca çalıştırılmaz.

## Doğrulama ve deployment

```text
npm run typecheck
npm test
npm run regression
```

`npm test` temiz production build/artifact doğrulamasından sonra tüm Node testlerini çalıştırır. `npm run regression` ayrıca lint ve TypeScript kontrolü yapar. Artifact doğrulaması, üretilmiş Worker'ın `default.fetch` dışa aktarımını, client varlıklarını ve kaynakla eşleşen hosting manifestini inceler.

Otomatik testler gerçek import/kayıt/yeniden işleme davranışını, metrik ve kapsam kurallarını, hesap bakımını ve gerçek rapor bileşeninin HTML'ini kapsar. Tarayıcı etkileşimleri ile uygulamadan kaydedilmiş PDF'lerin görsel doğrulaması ayrıca yapılır; örnek Python PDF'leri bu doğrulamanın yerine kullanılmaz. Ayrıntılar [QUALITY_GATE.md](QUALITY_GATE.md) içindedir.

Mevcut deployment hedefi OpenAI Sites üzerindeki Vinext/Cloudflare Workers runtime'ıdır. D1 `DB`, R2 `BUCKET` ve gerekli runtime secret'ları sağlanmalıdır. Bu kaynak doğrudan Vercel'e taşınamaz; farklı bir runtime için veri ve dosya depolama adaptörü gerekir.
