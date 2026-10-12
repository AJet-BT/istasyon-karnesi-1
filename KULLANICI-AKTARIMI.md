# Aynı kullanıcılarla başka kurulumda giriş

Bu paket, 25. sürümün kaynak koduna ek olarak canlı uygulamanın mevcut hesap kayıtlarını, bcrypt parola hash’lerini, aktif/pasif durumlarını, rollerini, çalışma alanlarını ve üyeliklerini içerir. E-posta ve şifreler değiştirilmez. Pasif veya arşivlenmiş hesaplar tekrar etkinleştirilmez. Eski oturumlar ve oturum token’ları taşınmaz.

## Yeni bilgisayarda yerel kurulum

Paketi açın ve proje klasöründe Node.js 22.13+ ile şu komutları sırayla çalıştırın:

```text
npm run install:ci
npm run build
npm run accounts:restore
npm run dev
```

Aktarım komutu, yeni ve boş yerel D1 veritabanının şemasını oluşturur ve hesapları tek transaction içinde aktarır. Mevcut veritabanı varsa durur; hiçbir hesabı veya kaydı üzerine yazmaz. Aktarım bir kez yapılır; uygulama açılışında, build’de veya girişte tekrar çalışmaz. Bu işlemden sonra mevcut aktif hesaplar aynı e-posta ve şifreleriyle giriş yapabilir.

Dev sunucusunun gösterdiği yerel adresi açıp uygulamanın giriş ekranını kullanın. Hesap yedeği, canlı D1/R2 performans kayıtlarının veya yüklenmiş dosyaların yedeği değildir.

## Başka Git hesabına taşıma

Kaynak kodunu yeni Git hesabınızın deposuna gönderebilirsiniz. `private-transfer/` klasörü `.gitignore` ile Git dışında tutulur; parola hash’leri dahil bu özel yedeği herkese açık bir depoya göndermeyin. Yeni kurulumda bu klasörü ayrıca ZIP’ten kopyalayıp yukarıdaki aktarım komutunu çalıştırın. Şifreler kaynak kodunda veya client dosyalarında tutulmaz.

Git hesabı uygulama hesabından bağımsızdır. Git’ten indirmek yalnız kaynak kodunu getirir; kullanıcılarla giriş için bu özel yedeğin yeni veritabanına aktarılması gerekir.

## Yeni canlı kurulum

Kaynak, Cloudflare Workers/D1/R2 runtime’ına göre hazırlanmıştır. Başka Git hesabı veya farklı bir hosting hesabı için yeni Site/Worker ve yeni D1/R2 bağlantıları oluşturulmalıdır; eski Sites proje kimliğini ve canlı veritabanını yanlışlıkla yeniden kullanmayın. Kaynakta mevcut proje kimliği tarihsel bağlam olarak korunur; yeni hosting hedefi kendi kimliğini sağlamalıdır.

Yeni ve tamamen boş D1 veritabanını oluşturduktan sonra, kendi yeni Wrangler yapılandırmanızla özel SQL yedeğini bir kez içeri alın:

```text
npx wrangler d1 execute YENI_VERITABANI_ADI --remote --config YENI_WRANGLER_YAPILANDIRMASI --file private-transfer/accounts-new-database.sql
```

Yer tutucuları yeni hedefinizin gerçek adı ve yapılandırmasıyla değiştirin. SQL dosyası şemayı da içerir; öncesinde ayrıca migration uygulamayın ve var olan veritabanına çalıştırmayın. `DB` bağlantısı bu yeni veritabanını, `BUCKET` bağlantısı yeni R2 alanını göstermelidir. Uygulama HTTPS üzerinden çalışmalıdır.

Bu paketi hazırlarken mevcut üretim veritabanına yazılmadı ve yeni bir canlı hedefe deployment yapılmadı. Yeni hedef bilgileri verilmediği için uzak kurulum sizin hedefinizde henüz uygulanmış değildir.

## Doğrulama

Aktarım, yeni yerel D1 üzerinde test edildi: hesap kimlikleri, bcrypt hash’leri, roller, çalışma alanları, üyelikler ve aktif/pasif durumları korundu; yeniden aktarım reddedildi; oturumlar taşınmadı. Mevcut yöneticiyle uygulamanın gerçek parola giriş yolu ayrıca kontrol edildi. Ayrıntılı doğrulama durumu paket bilgi dosyasında bulunur.

Yerel D1 yaklaşımı ve transaction davranışı için [Cloudflare yerel D1 geliştirme](https://developers.cloudflare.com/d1/best-practices/local-development/) ve [D1 batch işlemleri](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) belgelerine bakabilirsiniz.
