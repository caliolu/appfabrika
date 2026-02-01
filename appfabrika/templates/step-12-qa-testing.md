# {{stepName}} - Test ve Kalite Kontrolü

## Proje Fikri

{{projectIdea}}

## Önceki Adımlar

{{allPreviousOutputs}}

## Görev

Geliştirilen ve review edilen kodu kapsamlı bir şekilde test et ve kalite güvence raporu oluştur.

### 1. Test Planı

**Kapsam:**
- Fonksiyonel testler
- Non-fonksiyonel testler
- Regresyon testleri
- Edge case testleri

**Test Ortamları:**
- Development
- Staging
- Pre-production

### 2. Fonksiyonel Test Senaryoları

Her özellik için:

```
Test Case ID: TC-XXX
Özellik: [Özellik adı]
Önkoşullar: [Setup gereksinimleri]

Adımlar:
1. [Adım 1]
2. [Adım 2]
3. [Adım 3]

Beklenen Sonuç: [Açıklama]
Gerçek Sonuç: [Test sonrası doldurulacak]
Durum: Pass / Fail / Blocked
```

### 3. API Test Senaryoları

Her endpoint için:
- Happy path testi
- Invalid input testi
- Authentication testi
- Authorization testi
- Rate limiting testi

### 4. UI/UX Test Senaryoları

- Cross-browser testing (Chrome, Firefox, Safari)
- Responsive testing (Mobile, Tablet, Desktop)
- Accessibility testing (WCAG 2.1)
- Usability testing

### 5. Performance Testing

**Load Testing:**
- Normal yük (X concurrent users)
- Peak yük (Y concurrent users)
- Stress test (Z concurrent users)

**Metrikler:**
- Response time (avg, p95, p99)
- Throughput (req/sec)
- Error rate
- Resource utilization

### 6. Security Testing

**OWASP Top 10 Kontrolleri:**
- [ ] A01: Broken Access Control
- [ ] A02: Cryptographic Failures
- [ ] A03: Injection
- [ ] A04: Insecure Design
- [ ] A05: Security Misconfiguration
- [ ] A06: Vulnerable Components
- [ ] A07: Authentication Failures
- [ ] A08: Data Integrity Failures
- [ ] A09: Logging Failures
- [ ] A10: SSRF

### 7. Bug Report Template

```
Bug ID: BUG-XXX
Başlık: [Kısa açıklama]
Severity: Critical / High / Medium / Low
Priority: P1 / P2 / P3

Adımlar:
1. [Reproduce adımları]

Beklenen: [Beklenen davranış]
Gerçekleşen: [Gerçekleşen davranış]

Environment: [Browser, OS, etc.]
Ekran Görüntüsü: [Varsa]
Log: [Varsa]
```

### 8. Test Sonuç Raporu

**Özet:**
| Metrik | Değer |
|--------|-------|
| Toplam Test | XX |
| Geçen | XX |
| Kalan | XX |
| Bloke | XX |
| Pass Rate | XX% |

**Kritik Bulgular:**
(Varsa listelenir)

**Release Önerisi:**
- [ ] Go - Tüm kriterler karşılandı
- [ ] Conditional Go - Minor issues var ama kabul edilebilir
- [ ] No Go - Critical issues var

### 9. Known Issues ve Workarounds

| Issue | Severity | Workaround | Planlanan Fix |
|-------|----------|------------|---------------|
| | | | |

## Çıktı Formatı

Kapsamlı QA raporu:
1. Executive summary
2. Test coverage raporu
3. Bug listesi (severity'ye göre sıralı)
4. Performance metrikleri
5. Security findings
6. Release readiness assessment
