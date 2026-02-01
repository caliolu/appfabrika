# {{stepName}} - Kod İnceleme

## Proje Fikri

{{projectIdea}}

## Önceki Adımlar

{{allPreviousOutputs}}

## Görev

Geliştirilen kodu kapsamlı bir şekilde incele ve iyileştirme önerileri sun. Bu adımda:

### 1. Kod Kalitesi İncelemesi

**Okunabilirlik:**
- [ ] Fonksiyon ve değişken isimleri anlamlı mı?
- [ ] Kod yapısı mantıklı mı?
- [ ] Gereksiz karmaşıklık var mı?

**Maintainability:**
- [ ] DRY prensibi uygulanmış mı?
- [ ] SOLID prensipleri takip ediliyor mu?
- [ ] Modülerlik yeterli mi?

**Performance:**
- [ ] Gereksiz döngüler var mı?
- [ ] Memory leak riski var mı?
- [ ] N+1 query problemi var mı?

### 2. Güvenlik İncelemesi

- [ ] Input validation yeterli mi?
- [ ] SQL injection koruması var mı?
- [ ] XSS koruması var mı?
- [ ] Authentication/Authorization doğru mu?
- [ ] Sensitive data exposure riski var mı?
- [ ] CORS policy doğru mu?

### 3. Test Coverage

- [ ] Unit test coverage yeterli mi? (min %80)
- [ ] Edge case'ler test edilmiş mi?
- [ ] Error case'ler test edilmiş mi?
- [ ] Integration testler var mı?

### 4. Error Handling

- [ ] Tüm hatalar düzgün handle ediliyor mu?
- [ ] Error mesajları kullanıcı dostu mu?
- [ ] Logging yeterli mi?
- [ ] Graceful degradation var mı?

### 5. Documentation

- [ ] README güncel mi?
- [ ] API documentation var mı?
- [ ] Inline comments yeterli mi?
- [ ] Type definitions doğru mu?

### 6. Best Practices

- [ ] Linting kurallarına uyuluyor mu?
- [ ] Consistent formatting var mı?
- [ ] Deprecated API kullanımı var mı?
- [ ] Dependencies güncel mi?

## İnceleme Formatı

Her bulgu için:

```
## [SEVERITY] Bulgu Başlığı

**Dosya:** path/to/file.ts:line
**Severity:** Critical / Major / Minor / Suggestion

**Açıklama:**
Sorunun detaylı açıklaması.

**Öneri:**
Çözüm önerisi ve örnek kod.

**Referans:**
İlgili best practice veya dokümantasyon linki.
```

## Severity Tanımları

- **Critical:** Güvenlik açığı veya major bug, hemen düzeltilmeli
- **Major:** Önemli sorun, release öncesi düzeltilmeli
- **Minor:** İyileştirme önerisi, sonra düzeltilebilir
- **Suggestion:** Nice to have, opsiyonel

## Çıktı

Yapılandırılmış code review raporu:
1. Executive summary
2. Kategorize edilmiş bulgular
3. Önceliklendirilmiş action items
4. Genel değerlendirme ve puan
