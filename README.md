# Jeoteknik Hesaplama Asistanı - M1 + M2 + M3 VSA

Çok katmanlı zemin için ortalama kesme dalga hızı (VSA) hesaplama uygulaması. M1, M2, M3, M4, M5, M6 ve M7 yöntemlerini destekler.

## 🚀 Özellikler

### 📊 Hesaplama Yöntemleri
- **M1**: Katmanların kesme dalga hızlarının ağırlıklı kare ortalamasının karekökü
- **M2**: Katmanların kesme dalga hızlarının ağırlıklı aritmetik ortalaması
- **M3**: Rayleigh uyumlu, tam SI birimli hesaplama
- **M4**: Zamana göre ağırlıklandırılmış (harmonik) ortalama
- **M5**: Harmonik ortalama
- **M6**: Rayleigh periyodu kullanarak ASWV-FSP ilişkisi
- **M7**: Önerilen yeni yöntem

### 📁 Excel Entegrasyonu (Çoklu Ölçüm)
<<<<<<< HEAD
- **Excel Dosyası Yükleme**: .xlsx formatında 100'e kadar ölçüm verilerini yükleyin
=======
- **Excel Dosyası Yükleme**: .xlsx formatında 20'ye kadar ölçüm verilerini yükleyin
>>>>>>> origin/master
- **Excel Çıktısı**: Tüm ölçümlerin sonuçlarını Excel formatında indirin
- **Örnek Excel**: Doğru format için örnek Excel dosyası indirin
- **Ölçüm Navigasyonu**: Yüklenen ölçümler arasında geçiş yapın

### 🎯 Derinlik Modları
- **Vs30**: 30 metre derinlik için hesaplama
- **Saha Hs**: Tüm profil derinliği için hesaplama (Excel yüklendiğinde otomatik seçilir)
- **Özel**: Kullanıcı tanımlı derinlik için hesaplama

### 📈 Gelişmiş Özellikler
- Otomatik derinlik kalibrasyonu
- Sapma analizi ve öneriler
- Batch hesaplama (tüm presets)
- Jeoteknik rapor oluşturma
- JSON formatında veri dışa aktarma

## 📋 Excel Dosya Formatı (Çoklu Ölçüm)

### Sütun Sırası
1. **Ölçüm Adı**: Saha/Proje adı (isteğe bağlı, boş bırakılabilir)
2. **Vs (m/s)**: Kesme dalga hızı - **Zorunlu**
3. **ρ (kg/m³)**: Yoğunluk - Boş bırakılabilir
4. **Kalınlık (m)**: Katman kalınlığı - **Zorunlu**

### Çoklu Ölçüm Formatı
- Her ölçüm için bir başlık satırı ekleyin (örn: 'Saha 1')
- Başlık satırından sonra katman verilerini girin
- Boş satırlarla ölçümleri ayırın
<<<<<<< HEAD
- Maksimum 100 ölçüm desteklenir
=======
- Maksimum 20 ölçüm desteklenir
>>>>>>> origin/master

### Örnek Veri Yapısı
| Ölçüm Adı | Vs (m/s) | ρ (kg/m³) | Kalınlık (m) |
|------------|----------|-----------|---------------|
| Saha 1 | | | |
| | 180 | 1900 | 5 |
| | 300 | 2000 | 10 |
| | 600 | 2100 | 15 |
| | | | |
| Saha 2 | | | |
| | 200 | 1950 | 8 |
| | 350 | 2050 | 12 |

### Önemli Notlar
- Excel dosyası .xlsx formatında olmalıdır
- İlk satır başlık satırı olmalıdır
- Vs ve Kalınlık pozitif sayı olmalıdır
- ρ boş bırakılırsa varsayılan değer (1900 kg/m³) kullanılır
- En az 1 katman olmalıdır
<<<<<<< HEAD
- Maksimum 100 ölçüm desteklenir
=======
- Maksimum 20 ölçüm desteklenir
>>>>>>> origin/master
- Her ölçüm için en az 1 katman olmalıdır
- Derinlik modu otomatik olarak "Saha Hs (tüm profil)" olarak ayarlanır
- Kullanıcı isterse derinlik modunu değiştirebilir

## 🛠️ Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Uygulamayı derle
npm run build

# Testleri çalıştır
npm test
```

## 📖 Kullanım

### 1. Excel Dosyası Yükleme (Çoklu Ölçüm)
1. "Excel Dosyası Yükle" butonuna tıklayın
2. .xlsx formatında hazırladığınız dosyayı seçin (maksimum 20 ölçüm)
3. Veriler otomatik olarak yüklenecektir
4. İlk ölçüm otomatik olarak seçilecektir
5. Derinlik modu otomatik olarak "Saha Hs (tüm profil)" olarak ayarlanır

### 2. Çoklu Ölçüm Navigasyonu
1. Yüklenen ölçümler arasında "Önceki" ve "Sonraki" butonları ile geçiş yapın
2. Mevcut ölçüm bilgisi üst kısımda görüntülenir
3. Her ölçüm için ayrı katman verileri yüklenir

### 3. Manuel Veri Girişi
1. Katman ekleme butonu ile yeni katmanlar ekleyin
2. Her katman için kalınlık, Vs ve ρ değerlerini girin
3. Varsayılan yoğunluk değerini ayarlayın

### 4. Hesaplama
1. Derinlik modunu seçin (Vs30, Saha Hs, Özel)
2. Sonuçlar otomatik olarak hesaplanacaktır
3. T periyotlarını görmek için checkbox'ı işaretleyin

### 5. Sonuçları İndirme
- **Excel (Çoklu Ölçüm)**: "Excel İndir" butonu ile tüm ölçümlerin sonuçlarını Excel formatında indirin
- **JSON**: "JSON İndir" butonu ile veri yapısını indirin
- **Jeoteknik Rapor**: Preset seçiliyse detaylı rapor indirin

## 🔧 Teknik Detaylar

### Kullanılan Teknolojiler
- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS
- **Excel İşlemleri**: SheetJS (xlsx)
- **Build Tool**: Vite
- **Testing**: Vitest

### Hesaplama Algoritmaları
- **M1/M2**: Basit ağırlıklı ortalamalar
- **M3**: Transfer Matrix Method, Rayleigh, MOC-2008
- **M4/M5**: Harmonik ortalama
- **M6/M7**: Gelişmiş periyot hesaplamaları

## 📊 Preset Profiller

Uygulama önceden tanımlanmış zemin profilleri içerir:
- Tena-Colunga 2009
- AD6D4E9C5826149D5301D17C10E29FFAFD9D69805F6E7A9212BB9F3BD9EBD7EB
- Ve diğerleri...

## 🧪 Test

```bash
# Tüm testleri çalıştır
npm test

# Test UI'ı aç
npm run test:ui

# Testleri bir kez çalıştır
npm run test:run
```

## 📝 Lisans

Bu proje eğitim ve araştırma amaçlı geliştirilmiştir.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📞 İletişim

Sorularınız için issue açabilir veya pull request gönderebilirsiniz.

---

**Not**: Bu uygulama jeoteknik mühendislik hesaplamaları için geliştirilmiştir. Profesyonel kullanım öncesi sonuçları doğrulamanız önerilir.
