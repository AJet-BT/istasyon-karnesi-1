# AJet Platform Kalite Kapısı

`npm run regression` sırasıyla lint, TypeScript kontrolü, süre sınırı olan temiz production build, üretilmiş Sites artifact doğrulaması ve tüm Node testlerini çalıştırır. Başarısız bir adım sürümün yayımlanmasını engeller. Windows, macOS ve Linux aynı Node uygulamalarını kullanır; Bash veya GNU timeout gerekmez.

Otomatik testler gerçek Excel çalışma kitaplarını ortak algılama/ayrıştırma hattından geçirir, veritabanı kayıtlarını ve yeniden işlemeyi doğrular, payda/kapsam kurallarını çalıştırır ve uygulamanın gerçek `PerformanceReport` bileşenini HTML olarak render eder. HTML testleri tarayıcıdan kaydedilmiş PDF kanıtı değildir. Ayrı örnek PDF üretimi kalite kapısının parçası değildir.

Yerel uygulama açıkken `node scripts/browser-acceptance.mjs`, gerçek rapor yolundan dört PDF varyantını ve iki masaüstü viewportunu doğrular. `node --import ./scripts/portable-ts-register.mjs scripts/trend-layout-acceptance.mjs`, büyük hacim ve süre değerlerinde ekran/yazdırma eksen etiketlerinin SVG sınırları içinde kaldığını ölçer. Bu ikinci kontrol örnek PDF üretmez; gerçek uygulama PDF incelemesinin yerine geçmez.

## Tarayıcı doğrulaması

1. Dosya ve rapor başlığı ile normal yüklemeyi tamamlayın. Dönem, Handling Provider, sayfa ve başlık satırının kaynaktan algılandığını; belirsizlikte işlemin durduğunu doğrulayın. İstisna eşleştirmesi, önizleme, yeni sürüm, yeniden işleme, silme ve geri yükleme akışlarını kontrol edin.
2. Genel Bakış, trend, istasyon, tooltip, drawer, Excel ve CSV değerlerini aynı kaynak kayıtlarıyla karşılaştırın. Gerçek sıfır ile boş kaynak değerini, birimleri, metrik yönünü ve raporlanan istasyon kapsamını kontrol edin.
3. Ana dönem ve karşılaştırma filtrelerini değiştirin. Gelecek dönemlerin tarihsel pencereye girmediğini; farklı istasyon, Handling Provider, coğrafya, test/üretim veya metrik kapsamlarında değişim üretilmediğini doğrulayın.
4. Uygulamadaki **Hızlı PDF** ve **Master PDF** düğmelerinden yazdırma görünümünü açıp tarayıcının PDF kaydını kullanın. Karşılaştırma açık/kapalı ve tek/çoklu istasyon kapsamlarını deneyin. Kaydedilen gerçek PDF'leri render ederek tüm sayfaları, taşmaları, kesilen satırları, grafik/legend/etiketleri, AJet logolu kapağı, port KPI kutucuklarını ve KPI paritesini inceleyin.
5. Rapor geçmişinde PDF'nin yalnız yazdırma için hazırlanmış olarak gösterildiğini kontrol edin. Tarayıcı kaydı doğrulanmadığı için başarı veya dosya boyutu iddiası yapılmamalıdır. İç test bayrağı gerçek rapor kayıtlarından belirlenir; kullanıcıya veri türü etiketi gösterilmez.
6. Yalnız ana sayfanın 12 aylık trend seçicisini tüm operasyonel metriklerle deneyin. Varsayılan OTP / OTA iki çizgidir. Başlık, birim, tooltip, boş dönemler, kapsam ve dönem sonunu kontrol edin. PDF snapshot’ındaki seçimin ve grafiğin ana sayfayla eşleştiğini, diğer analiz trendlerinin değişmediğini doğrulayın. PDF’de dosya adı, sayfa/satır, eşleştirme/hesaplama sürümü, teknik köken veya test etiketi bulunmamalıdır. Port kutucukları dashboard sırasını kullanır; karşılaştırma kapalıyken boş karşılaştırma sayfası olmaz.
7. Masaüstü ve dar ekranlarda kartların, filtrelerin, tabloların, yükleme formunun ve rapor seçeneklerinin kullanılabilir olduğunu doğrulayın. Bulunan sorunu ortak bileşen veya hesaplama katmanında düzeltip etkilenen kontrolleri tekrarlayın.

## Ortak metrik kuralları

- Yolcu metriğinin tek kimliği **Yolcu Sayısı**dır. OTP/OTA, Hasarlı/Kayıp Bagaj ve Safety/Emniyet Raporlaması kartları birlikte yer alır.
- Extgoms–Okunmayan Doküman Sayısı, Vize Pasaport Doküman Aksaklıkları, Emniyet Raporlaması ve Hasar Raporlama GSE adet; Dijital Biniş Kartı Kullanım Oranı kaynakta 0–1 oranıdır.
- Eksik değer sıfır değildir; **Kaynakta Raporlanmamış** olarak açıklanır. Raporlanan sıfır korunur.
- Toplamlar yalnız raporlanan değerleri; ağırlıklı oranlar yalnız metrik ve uygun paydası birlikte bulunan kayıtları kullanır. Dijital biniş kartı oranı yolcu ağırlıklıdır.
- Ana dönem tarihsel grafiklerin bitişidir. Karşılaştırma dönemi ikincil bağlamdır; ana pencereyi değiştirmez.
- Frontend, tooltip, drawer, tablolar, PDF, Excel ve CSV aynı ortak metrik ve karşılaştırma katmanını kullanır.
- Rapor oluşturma, aktif filtreleri, kayıtları, seçili ana trend metriğini ve karşılaştırmayı değişmez bir kapsam olarak yakalar. İki PDF seçeneği de bu kapsamı kullanır.

## Hesap bakım işlemi

Otomatik testler yetkisiz/tekrarlanan isteği, eşzamanlı işlemi, transaction rollback'ini, oturum iptalini, yeni yönetici girişini ve veri korunmasını doğrular. Production hesap sıfırlaması test çalıştırmanın veya uygulama başlangıcının parçası değildir. Yetkili tek seferlik bakım işlemi diğer hesapları arşivler, tüm mevcut oturumları iptal eder ve çalışma alanları, yüklemeler, performans verileri, eşleştirmeler ile denetim kayıtlarını korur.
