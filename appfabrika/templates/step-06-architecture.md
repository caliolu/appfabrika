# {{stepName}} - Sistem Mimarisi

## Proje Fikri

{{projectIdea}}

## Önceki Adımlar

{{allPreviousOutputs}}

## Görev

PRD ve UX tasarımını temel alarak kapsamlı bir Mimari Tasarım dokümanı oluştur. Bu belge, teknik implementasyonun temelini oluşturacak.

### 1. Mimari Genel Bakış

- Seçilen mimari pattern (Monolith, Microservices, Serverless, etc.)
- Yüksek seviye sistem diyagramı (metin tabanlı)
- Temel bileşenler ve sorumlulukları
- Mimari karar gerekçeleri

### 2. Teknoloji Stack

| Katman | Teknoloji | Versiyon | Gerekçe |
|--------|-----------|----------|---------|
| Frontend | | | |
| Backend | | | |
| Database | | | |
| Cache | | | |
| Queue | | | |
| Hosting | | | |

### 3. Bileşen Mimarisi

Her ana bileşen için:
- Sorumluluklar
- API/Interface tanımları
- Bağımlılıklar
- Ölçeklenebilirlik stratejisi

### 4. Veri Mimarisi

- Veri modeli (Entity-Relationship)
- Database şema tasarımı
- Veri akış diyagramları
- Veri tutarlılık stratejisi

### 5. API Tasarımı

- API stil (REST, GraphQL, gRPC)
- Endpoint listesi ve açıklamaları
- Authentication/Authorization
- Rate limiting stratejisi
- Versioning stratejisi

### 6. Güvenlik Mimarisi

- Authentication mekanizması
- Authorization modeli
- Veri şifreleme (at rest, in transit)
- Güvenlik katmanları
- Compliance gereksinimleri

### 7. Altyapı ve Deployment

- Deployment topolojisi
- CI/CD pipeline
- Environment stratejisi (dev, staging, prod)
- Infrastructure as Code yaklaşımı

### 8. Ölçeklenebilirlik ve Performans

- Yatay/dikey ölçekleme stratejisi
- Caching stratejisi
- CDN kullanımı
- Performance hedefleri ve SLAs

### 9. Monitoring ve Observability

- Logging stratejisi
- Metrics ve alerting
- Distributed tracing
- Health checks

### 10. Disaster Recovery

- Backup stratejisi
- Recovery point objective (RPO)
- Recovery time objective (RTO)
- Failover mekanizmaları

### 11. Architecture Decision Records (ADRs)

Kritik kararlar için:
- ADR-001: [Karar konusu]
  - Durum: Kabul edildi
  - Bağlam: ...
  - Karar: ...
  - Sonuçlar: ...

## Çıktı Formatı

Teknik bir Architecture Decision Document formatında, diyagramlar için metin tabanlı gösterimler (ASCII art veya yapılandırılmış listeler) kullanan bir belge oluştur. Geliştirme ekibi için implementasyon rehberi niteliğinde olmalı.
