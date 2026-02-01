# {{stepName}} - Ürün Gereksinimleri Dokümanı (PRD)

## Proje Fikri

{{projectIdea}}

## Önceki Adımlar

{{allPreviousOutputs}}

## Görev

Ürün Özeti'ni temel alarak detaylı bir Ürün Gereksinimleri Dokümanı (PRD) oluştur. Bu belge, geliştirme ekibi için teknik referans niteliğinde olacak.

### 1. Genel Bakış
- Ürün adı ve versiyonu
- Belge amacı ve kapsamı
- Hedef okuyucu kitlesi
- Belge geçmişi

### 2. Fonksiyonel Gereksinimler (FR)
Her gereksinim için:
- FR-XXX: Gereksinim açıklaması
- Öncelik: P1 (Kritik) / P2 (Önemli) / P3 (İstenen)
- Kabul kriterleri
- Bağımlılıklar

Kategoriler:
- Kullanıcı Yönetimi
- Ana İşlevsellik
- Veri Yönetimi
- Entegrasyonlar
- Raporlama

### 3. Fonksiyonel Olmayan Gereksinimler (NFR)
- Performans gereksinimleri (yanıt süreleri, throughput)
- Güvenlik gereksinimleri
- Ölçeklenebilirlik gereksinimleri
- Erişilebilirlik gereksinimleri
- Uyumluluk gereksinimleri

### 4. Kullanıcı Hikayeleri
Format: "Bir [kullanıcı türü] olarak, [amaç] istiyorum, böylece [fayda]."

Her hikaye için:
- Kabul kriterleri (Given/When/Then)
- Mockup/wireframe referansı (varsa)
- Öncelik

### 5. Veri Modeli
- Ana varlıklar (entities)
- İlişkiler
- Veri tipleri ve kısıtlamalar
- Örnek veri

### 6. API Gereksinimleri
- Endpoint listesi
- İstek/yanıt formatları
- Kimlik doğrulama
- Rate limiting

### 7. Kullanıcı Arayüzü Gereksinimleri
- Sayfa/ekran listesi
- Navigasyon yapısı
- Responsive tasarım gereksinimleri
- Erişilebilirlik gereksinimleri

### 8. Entegrasyon Gereksinimleri
- Üçüncü parti servisler
- API entegrasyonları
- Veri senkronizasyonu

### 9. Test Gereksinimleri
- Test senaryoları özeti
- Kabul test kriterleri
- Performans test kriterleri

### 10. Lansman Kriterleri
- MVP için minimum gereksinimler
- Go/No-Go kriterleri
- Rollback planı

## Çıktı Formatı

Yapılandırılmış, numaralandırılmış gereksinimler içeren teknik bir belge oluştur. Her gereksinim izlenebilir ve test edilebilir olmalı. Markdown formatında, tablolar ve listeler kullanarak düzenli bir sunum sağla.
