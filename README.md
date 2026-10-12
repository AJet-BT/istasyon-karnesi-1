# AJet İstasyon Karnesi

İstasyon performans verilerini Excel ve CSV dosyalarından alan; havalimanı bilgileri, KPI hesaplamaları, filtreler, grafikler ve raporlarla operasyon değerlendirmesi sağlayan web uygulaması.

## Özellikler

- Excel/CSV yükleme, başlık ve dönem algılama, veri doğrulama ve yeniden işleme.
- İstasyon, dönem ve hizmet sağlayıcı filtreleri; ortak hesaplama kurallarıyla KPI ve karşılaştırmalar.
- Excel/CSV çıktıları, tarayıcı yazdırma akışıyla Hızlı PDF ve Master PDF.
- Kullanıcı hesapları, yetkilendirme ve mevcut hesapların yeni yerel kuruluma aktarılması.

## Teknoloji ve gereksinimler

Node.js **22.13.0 veya üstü** ve npm gerekir. Proje Next.js 16, React 19, TypeScript, Vinext/Vite ve Cloudflare Workers kullanır. Veritabanı D1, dosya depolama R2; veri katmanı Drizzle, Excel işlemleri SheetJS ve grafikler Recharts ile sağlanır.

## Yerel kurulum

Komutları `package.json` dosyasının bulunduğu proje kökünde çalıştırın. Yeni ve boş yerel kurulumda mevcut hesapları da taşımak için:

```sh
npm run install:ci
npm run build
npm run accounts:restore
npm run dev
```

`accounts:restore`, dahil edilen `private-transfer/accounts.json` dosyasından şema ve hesap kayıtlarını boş yerel D1 veritabanına aktarır. Dolu hedefi değiştirmez; build önceden alınmalıdır. Hesapların mevcut e-posta ve parolaları kullanılabilir; eski oturumlar taşınmaz. Komutun gösterdiği yerel adresi tarayıcıda açın.

Hesap yedeği kullanılmadan sıfırdan kurulum yapılacaksa build sonrasında `drizzle/` altındaki migration dosyalarını sıralarıyla yerel D1'e uygulayın. Hesap aktarımı ile boş veritabanı migration akışını aynı hedefte gelişigüzel birleştirmeyin. Canlı veya dolu veritabanına aktarım için [KULLANICI-AKTARIMI.md](KULLANICI-AKTARIMI.md) dosyasını izleyin.

## Yapılandırma

`.openai/hosting.json`, D1 `DB` ve R2 `BUCKET` bağlayıcılarını tanımlar. `.env.example` bakım ve test yapılandırması için değişken adlarını gösterir:

| Değişken | Kullanım |
| --- | --- |
| `ACCOUNT_RESET_TOKEN` | Yetkili, tek seferlik hesap bakımı; en az 32 karakter |
| `ENABLE_TEST_DATA_AUTO_IMPORT` | Kontrollü demo/test veri aktarımı; production varsayılanı `false` |

Worker ortamına özgü secret ayarları ve hesap bakımının ayrıntıları [özgün README](_archive/README.original.md) ve [kullanıcı aktarım belgesi](KULLANICI-AKTARIMI.md) içindedir. Verilen ZIP gerçek `.env.local` içermiyor; `.env.example` ve özel hesap yedekleri içeriyor.

## Komutlar

| Komut | Amaç |
| --- | --- |
| `npm run dev` | Yerel geliştirme |
| `npm run build` | Production Worker ve istemci çıktıları |
| `npm run start` | Hazırlanmış build'i başlatma |
| `npm run typecheck` | TypeScript kontrolü |
| `npm run lint` | Kod biçimi ve kuralları |
| `npm test` | Build/artifact doğrulaması ve Node testleri |
| `npm run regression` | Lint, tip kontrolü ve regresyon akışı |
| `npm run validate:artifact` | Worker, istemci varlıkları ve hosting manifesti kontrolü |

Testlerin kapsamı [QUALITY_GATE.md](QUALITY_GATE.md) içinde açıklanır. Bu GitHub hazırlığı sırasında uygulama testleri veya canlı hesap bakımı çalıştırılmadı; paket içeriğinin korunması doğrulandı.

## Klasör yapısı

| Yol | İçerik |
| --- | --- |
| `app/`, `lib/` | Arayüz, API ve ortak iş kuralları |
| `db/`, `drizzle/` | Veritabanı şeması ve migration dosyaları |
| `worker/`, `build/` | Worker giriş noktası ve build entegrasyonu |
| `scripts/`, `tests/` | Taşınabilir komutlar ve testler |
| `private-transfer/` | Mevcut hesap kayıtları ve parola hash'leri |
| `_archive/` | Özgün README ve dosya bütünlüğü manifesti |

## GitHub paketinin kapsamı

Hedef **AJet-BT/istasyon-karnesi-1**, görünürlük **private**. Kullanıcının isteği doğrultusunda ZIP'teki bütün dosyalar, özel hesap yedekleri dahil, pakette korunur. Özgün `.gitignore` saklanır; ilk aktarımda dosyalar açıkça dahil edilerek ignore kurallarının mevcut içeriği atlaması önlenir.

ZIP'in dış sarmalayıcı klasörü depo köküne açılmıştır. Güncellenen README'nin özgün hali [_archive/README.original.md](_archive/README.original.md), özgün dosya adları ve SHA-256 değerleri [_archive/transfer-manifest.json](_archive/transfer-manifest.json) içinde bulunur. Manifest, özgün dosyaların yeni paketteki yerlerini gösterir. Uygulama kodu değiştirilmedi.

## Çalıştırma ortamı

Mevcut hedef Vinext/Cloudflare Workers ve D1/R2 ortamıdır. Farklı bir hosting ortamına geçiş veri ve dosya depolama bağlayıcılarının uyarlanmasını gerektirir. GitHub'a kaynak aktarılması uygulamayı otomatik yayımlamaz.
