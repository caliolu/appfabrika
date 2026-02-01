# {{stepName}} - Epic ve Kullanıcı Hikayeleri

## Proje Fikri

{{projectIdea}}

## Önceki Adımlar

{{allPreviousOutputs}}

## Görev

PRD, UX Tasarımı ve Mimari kararlarını temel alarak implementasyon için Epic ve User Story breakdown'u oluştur. Bu belge, sprint planlaması için temel olacak.

### Epic Yapısı

Her Epic için:
- Epic ID ve başlık
- Kullanıcı değeri açıklaması
- Kapsam tanımı
- Bağımlılıklar
- Story listesi

### User Story Formatı

```
Story [Epic-ID].[Story-No]: [Başlık]

As a [kullanıcı türü],
I want [amaç],
So that [fayda].

Acceptance Criteria:
- Given [ön koşul]
  When [eylem]
  Then [beklenen sonuç]

Tasks:
- [ ] Task 1
- [ ] Task 2

Story Points: [1/2/3/5/8/13]
Priority: [P1/P2/P3]
```

---

## Epic Breakdown

### Epic 1: [Temel Altyapı / Foundation]

**Kullanıcı Değeri:** Geliştirme ekibi projeyi başlatabilir ve temel yapıyı kurabilir.

Stories:
1. Proje kurulumu ve konfigürasyon
2. Development environment setup
3. CI/CD pipeline kurulumu
4. Temel database setup

---

### Epic 2: [Kullanıcı Yönetimi / User Management]

**Kullanıcı Değeri:** Kullanıcılar sisteme güvenli şekilde erişebilir.

Stories:
1. Kayıt (Registration)
2. Giriş (Login)
3. Şifre sıfırlama
4. Profil yönetimi

---

### Epic 3: [Ana İşlevsellik - Bölüm 1]

**Kullanıcı Değeri:** [PRD'den alınan ana değer önerisi]

Stories:
(PRD gereksinimlerine göre detaylandır)

---

### Epic 4: [Ana İşlevsellik - Bölüm 2]

(Gerektiği kadar Epic ekle)

---

## Önceliklendirme Matrisi

| Epic | MVP? | Öncelik | Tahmini Efor |
|------|------|---------|--------------|
| Epic 1 | Evet | P1 | |
| Epic 2 | Evet | P1 | |
| Epic 3 | Evet | P1 | |
| Epic 4 | Hayır | P2 | |

## Bağımlılık Grafiği

```
Epic 1 (Foundation)
    └── Epic 2 (User Management)
        └── Epic 3 (Core Feature 1)
            └── Epic 4 (Core Feature 2)
```

## MVP Kapsamı

MVP için dahil edilecek story'ler:
- Epic 1: Tüm story'ler
- Epic 2: Story 1, 2
- Epic 3: Story 1, 2, 3

## Risk ve Varsayımlar

| Risk | Etki | Olasılık | Azaltma Stratejisi |
|------|------|----------|-------------------|
| | | | |

## Çıktı Formatı

Yapılandırılmış, JIRA/Linear formatına uygun Epic ve Story breakdown'u oluştur. Her story implementasyon için yeterli detay içermeli. Story point tahminleri Fibonacci serisine göre olmalı.
