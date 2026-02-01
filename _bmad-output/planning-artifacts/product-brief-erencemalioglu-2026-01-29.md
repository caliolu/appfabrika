---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
date: 2026-01-29
author: calio
projectName: AppFabrika
---

# Product Brief: AppFabrika

## Executive Summary

AppFabrika, non-teknik girisimcilerin ve solo gelistiricilerin fikirlerini calisan uygulamalara donusturmesini saglayan bir CLI aracidir. BMAD metodolojisini Claude Code otomasyonu ile birlestirerek, teknik bilgi gerektirmeden urun gelistirme surecini baslatir ve tamamlar. Kullanici sadece fikrini yazar, otomasyon seviyesini belirler - geri kalan her sey otomatik olarak gerceklesir ve sonuc GitHub'a yuklenir.

---

## Core Vision

### Problem Statement

BMAD ile urun gelistirme sureci yorucu ve teknik bilgi gerektiriyor. Her adimda onlarca soruya cevap vermek, teknik kararlari anlamak ve tutarli kalmak non-teknik girisimciler icin buyuk bir bariyer olusturuyor.

### Problem Impact

- Girisimciler fikirlerini hayata geciremeden vazgeciyor
- Teknik bilgi eksikligi inovasyon onunde engel
- Manuel BMAD sureci saatler/gunler aliyor
- Tutarsizlik ve yorgunluk kaliteyi dusuruyor

### Why Existing Solutions Fall Short

- AI IDE'ler (Cursor, Windsurf): Metodoloji yok, teknik bilgi gerektirir
- No-code platformlar (Bubble): Sinirli, gercek kod uretmez
- GPT Wrapper'lar: Tek LLM'e bagli, urun gelistirme akisi yok
- Manuel BMAD: Yorucu, zaman alici, teknik bariyer

### Proposed Solution

CLI tabanli bir arac:
1. Kullanici `appfabrika init` ile projeyi baslatir
2. Fikrini tek cumle ile yazar
3. Otomasyon seviyesi belirler (Full Auto / Checkpoint / Collaborative)
4. CLI, Claude Code uzerinden BMAD adimlarini otomatik yurutur
5. Sonuc: GitHub'a yuklenmis, calisan uygulama kodu

### Key Differentiators

- **BMAD Entegrasyonu:** Kanitlanmis metodoloji ile yapisal urun gelistirme
- **Claude Code Gucu:** Dosya okuma/yazma, git islemleri, tam gelistirme ortami
- **Ayarlanabilir Otomasyon:** Tam otomatikten isbirlikciye kadar kontrol
- **Non-Teknik Odakli:** Sifir teknik bilgi ile urun cikarabilme
- **Gercek Kod Ciktisi:** No-code degil, GitHub'a gercek kod
- **Sifir API Maliyeti:** Kullanici kendi Claude aboneligini kullanir

---

## Target Users

### Primary Users

#### Persona 1: Emre (32) - "Fikrim var ama yapamiyorum"
Pazarlama alaninda calisiyor, 3 yildir kafasinda bir SaaS fikri var. Youtube'da "how to build an app" videolari izledi ama React, backend, database gorunce vazgecti. Freelancer'lara fiyat sordu - 50-100K TL duydugunda rafa kaldirdi.

- **Yas Araligi:** 28-40
- **Teknik Seviye:** Dusuk
- **Engel:** Teknik bilgi eksikligi, maliyet
- **Ihtiyac:** Ucuz ve hizli MVP olusturma
- **Basari Kriteri:** Ilk odeme yapan musteriler

#### Persona 2: Zeynep (26) - "Bu is bana gore degil"
Universite mezunu, sosyal medyada startup hikayeleri goruyor. "Keski ben de yapabilsem" diyor ama hic denemedi bile. Kod yazanlar ona "farkli bir tur insan" gibi geliyor. Guzle fikirleri var ama "kim beni ciddiye alir" diye dusunuyor.

- **Yas Araligi:** 20-30
- **Teknik Seviye:** Sifir
- **Engel:** Ozguven eksikligi, "bu benim ligim degil" inanci
- **Ihtiyac:** Ilk adimi atabilecegi guvenli ortam
- **Basari Kriteri:** "Ben bir uygulama yaptim!" diyebilmek

### User Journey

| Asama | Deneyim |
|-------|---------|
| **Kesfetme** | Sosyal medyada "kod yazmadan uygulama" icerigini goruyor |
| **Ilk Adim** | CLI'yi kuruyor, `appfabrika init` calistiriyor |
| **Baslangic** | Tek cumleyle fikrini yaziyor |
| **Sihir Ani** | Claude Code calisiyor, terminalde ilerlemeyi goruyor |
| **Sonuc** | GitHub'da calisan kod + kullanim aciklamasi |
| **Zafer** | "Ben bir uygulama yaptim" - sosyal medyada paylasim |

---

## Success Metrics

### User Success Metrics

**Emre (Fikri olan girisimci) icin:**
- GitHub'da calisan kod reposu olusturuldu
- Uygulama deploy edilebilir durumda
- Ilk musteri/abone kazanildi

**Zeynep (Inanmayan girisimci) icin:**
- Ilk projesini basariyla tamamladi
- "Ben bir uygulama yaptim" diyebildi
- Sosyal medyada paylasacak bir urun cikartti

### Business Objectives

**Gelir Modeli:** Abonelik (SaaS) - V2'de aktif edilecek

| Tier | Ozellikler |
|------|-----------|
| **Free** | Ayda 1 proje, temel ozellikler |
| **Pro** | Ayda 5 proje, tum ozellikler |
| **Unlimited** | Sinirsiz proje, API erisimi |

**3 Aylik Hedefler:** Belirlenmedi (MVP sonrasi netlesecek)

### Key Performance Indicators

| KPI | Aciklama |
|-----|----------|
| **MRR** | Aylik tekrarlayan gelir |
| **Aktif Kullanici** | Ayda en az 1 proje baslatan |
| **Tamamlanan Proje** | GitHub'a basariyla yuklenen |
| **Free → Paid Conversion** | Odeme yapan kullanici orani |
| **Churn Rate** | Aylik iptal orani |
| **Time to Value** | Fikir girisi → GitHub ciktisi suresi |

---

## MVP Scope

### Core Features

**AppFabrika CLI:**
- `npm install -g appfabrika` ile global kurulum
- `appfabrika init` - yeni proje baslat
- `appfabrika run` - BMAD akisini calistir
- Tam BMAD workflow: Product Brief → PRD → Architecture → Epics → Kod
- GitHub entegrasyonu - otomatik repo olusturma ve push

**Otomasyon Seviyeleri:**
- **Full Auto:** Minimum mudahale, LLM tum kararlari verir
- **Checkpoint:** Kritik kararlarda (mimari, teknoloji) onay ister
- **Collaborative:** Her BMAD adiminda kullaniciyi dahil eder

### Out of Scope for MVP

- Web Dashboard (V2)
- Kurulum rehberi / dokumantasyon sitesi (V2)
- Paralel LLM karsilastirma (V2)
- Otomatik deploy - Vercel/Netlify (V2)
- Team collaboration ozellikleri (V2+)
- Odeme sistemi (V2)
- Alternatif LLM destegi (V2)

### MVP Success Criteria

- CLI kurulumu ve calistirilmasi sorunsuz
- Fikir → GitHub repo akisi calisiyor
- Tam BMAD adimlari otomatik ilerliyor
- 3 farkli fikir ile test edildi ve calisti

### Future Vision

**V2 - Kullaniciya Acilma:**
- Web Dashboard + Proje yonetimi
- Kurulum rehberi + Video dokumantasyon
- Odeme sistemi (Stripe)
- Kullanici hesaplari

**V3 - Genisleme:**
- Paralel LLM destegi
- One-click deploy
- Proje sablonlari

**V4 - Platform:**
- Team collaboration
- API erisimi
- Template marketplace
