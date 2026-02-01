---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional']
inputDocuments: ['product-brief-erencemalioglu-2026-01-29.md']
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
classification:
  projectType: 'CLI Tool / Developer Tool'
  domain: 'AI Automation / Developer Productivity'
  complexity: 'medium-high'
  projectContext: 'greenfield'
---

# Product Requirements Document - AppFabrika

**Author:** calio
**Date:** 2026-01-29

## Success Criteria

### User Success

**Emre (Fikri olan girisimci):**
- Tek cumleyle baslayip GitHub'da calisan koda ulasti
- Projeyi deploy edebilecek durumda
- Ilk kullanici/musteri kazandi

**Zeynep (Inanmayan girisimci):**
- "Ben bir uygulama yaptim!" diyebildi
- Sosyal medyada paylasacak somut bir urun cikartti
- Teknik bilgi olmadan tum sureci tamamladi

**"Aha!" Ani:** Proje tamamlandiginda - GitHub'da calisan, deploy edilebilir kod gorunce

### Business Success

**MVP Donemi (Ilk 3 ay):**
- CLI sorunsuz kurulup calisiyor
- 3 farkli proje tipiyle test edildi
- %90+ BMAD akis basari orani

**V2 Donemi (3-6 ay):**
- Web dashboard aktif
- Ilk beta kullanicilar
- Abonelik sistemi calisiyor

**V3+ Donemi (6+ ay):**
- MRR hedefleri (belirlenmedi)
- Aktif kullanici buyumesi
- Community olusumu

### Technical Success

| Metrik | Hedef |
|--------|-------|
| **BMAD Akis Basari Orani** | >%90 |
| **Hata Yonetimi** | Otomatik retry mekanizmasi |
| **GitHub Push Basarisi** | >%95 |
| **CLI Kurulum** | Tek komutla sorunsuz |

### Measurable Outcomes

- **Time to Value:** Fikir → GitHub (proje buyuklugune gore degisken, saatler)
- **Completion Rate:** Baslayan projelerin >%80'i tamamlaniyor
- **Retry Success:** Hata sonrasi otomatik deneme ile kurtarma >%70
- **User Satisfaction:** Beta kullanicilardan 4/5+ puan

## Product Scope

### MVP - Minimum Viable Product

**Core:**
- `npm install -g appfabrika` ile kurulum
- `appfabrika init` ve `appfabrika run` komutlari
- Tam BMAD workflow otomasyonu
- GitHub entegrasyonu
- 3 otomasyon seviyesi (Full Auto / Checkpoint / Collaborative)

**Teknik:**
- Claude Code entegrasyonu
- Otomatik hata retry mekanizmasi
- Proje durumu takibi

### Growth Features (Post-MVP / V2)

- Web Dashboard
- Kullanici hesaplari ve auth
- Odeme sistemi (Stripe)
- Kurulum rehberi ve dokumantasyon
- Proje gecmisi ve analitik

### Vision (Future / V3+)

- Paralel LLM destegi (Claude vs GPT karsilastirma)
- One-click deploy (Vercel, Railway)
- Template marketplace
- Team collaboration
- API erisimi
- White-label cozum

## User Journeys

### Journey 1: Emre - "Fikrim Sonunda Gercek Oldu"

**Persona:** Emre (32), pazarlamaci, 3 yildir SaaS fikri var, teknik bilgi yok

**Acilis Sahnesi:**
Emre, yillardir kafasinda freelancer'lari eslestiren bir platform fikri tasiyor. Youtube'da React tutoriallari izledi ama karmasikliktan vazgecti. Freelancer'lara fiyat sordu - 80.000 TL duydugunda rafa kaldirdi. Bir gun sosyal medyada AppFabrika reklamini goruyor.

**Yukselis:**
1. Terminal aciyor, `npm install -g appfabrika` yaziyor
2. `appfabrika init` komutu ile basliyor
3. Fikrini tek cumleyle yaziyor: "Freelancer'lari projelerle eslestiren platform"
4. Otomasyon seviyesi seciyor: "Full Auto"
5. BMAD adimlari otomatik ilerlemeye basliyor

**Doruk Noktasi:**
2 saat sonra terminal "Project completed! GitHub repo: emre-freelancer-app" diyor. Repo'ya bakiyor - gercek, calisan kod var.

**Cozum:**
`npm start` yaziyor, tarayicida uygulama aciliyor. Ilk kez fikrini somut olarak goruyor. Hemen landing page yapip ilk kullanicilari aramaya basliyor.

**Kazanim:** Fikir → Calisan MVP (teknik bilgi olmadan)

---

### Journey 2: Zeynep - "Ben de Yapabilirmisim"

**Persona:** Zeynep (26), universite mezunu, ozguven eksikligi, "kod yazmak bana gore degil" inanci

**Acilis Sahnesi:**
Zeynep, sosyal medyada surekli genc girisimci hikayeleri goruyor. Kendi fikri var - universite ogrencileri icin ders notu paylasim platformu. Ama "bu isler benim ligim degil" diye dusunuyor. LinkedIn'de bir post goruyor: "Tek cumleyle uygulama yap."

**Yukselis:**
1. Yari supheyle kurulum yapiyor
2. `appfabrika init` ile basliyor
3. "Universite ogrencileri icin ders notu paylasim platformu" yaziyor
4. "Checkpoint" modu seciyor - neler oldugunu gormek istiyor
5. Her adimda kisa aciklama gorup onay veriyor

**Doruk Noktasi:**
3 saat sonra GitHub'da repo goruyor. Kodu anlamiyor ama `npm start` yapinca gercek bir uygulama calisiyor!

**Cozum:**
Ekran goruntusu alip Instagram'da paylasiyor: "Ilk uygulamami yaptim!" Arkadaslari sasiriyor. Zeynep hayatinda ilk kez "belki ben de girisimci olabilirim" diye hissediyor.

**Kazanim:** Ozguven + Somut urun + Sosyal ispat

---

### Journey 3: Hata Senaryosu - Otomatik Recovery

**Senaryo:** Kullanici projesini calistirirken BMAD adiminda hata olusuyor (rate limit, network, vb.)

**Akis:**
1. CLI hata tespit ediyor
2. "Hata olustu, yeniden deneniyor (1/3)..." mesaji
3. 30 saniye bekleme
4. Otomatik yeniden deneme
5. Basarili olursa devam, degilse bir sonraki deneme

**Kullanici Deneyimi:**
- Kullanici mudahale etmiyor
- Sadece kisa bekleme goruyor
- 3 deneme sonrasi basarisizsa anlasilir hata mesaji

**Kazanim:** Kesintisiz deneyim, teknik sorunlar kullaniciya yansimaz

---

### Journey Requirements Summary

| Yolculuk | Gereken Yetenekler |
|----------|-------------------|
| **Emre - Full Auto** | Tek komut kurulum, fikir girisi, tam otomasyon, GitHub push |
| **Zeynep - Checkpoint** | Adim adim ilerleme, onay noktalari, anlasilir aciklamalar |
| **Hata Recovery** | Otomatik retry, kullanici bilgilendirme, graceful degradation |

**Kritik Yetenekler:**
- CLI kurulum ve komutlar (`init`, `run`)
- 3 otomasyon seviyesi
- BMAD workflow orkestrasyonu
- GitHub entegrasyonu
- Otomatik hata yonetimi ve retry
- Kullanici dostu ilerleme mesajlari

## CLI Tool Specific Requirements

### Project-Type Overview

AppFabrika iki katmanli bir LLM mimarisi kullanir:
1. **Response Generator (LLM API):** BMAD sorularina otomatik cevap uretir (GPT, Claude API, vb.)
2. **Executor (Claude Code):** Cevaplari alir, BMAD workflow'unu calistirir, kod yazar, git push yapar

### Architecture Pattern

```
[Kullanici Fikri]
       ↓
[AppFabrika CLI]
       ↓
[LLM API - GPT/Claude] ←→ BMAD sorulari & cevaplar
       ↓
[Claude Code] → Dosya, kod, git islemleri
       ↓
[GitHub Repo]
```

### Core CLI Commands

| Komut | Islem |
|-------|-------|
| `appfabrika init` | Fikir, LLM secimi, otomasyon seviyesi |
| `appfabrika run` | BMAD akisini calistirir |

### LLM Configuration

- Kullanici hangi LLM'i kullanacagini secer (GPT, Claude API, vb.)
- API key'ini girer (bir kere, config'e kaydedilir)
- Farkli modellerin guclu yanlari kullanilabilir

### Implementation Considerations

- Node.js / TypeScript tabanli
- npm paketi olarak dagitim
- OpenAI SDK + Anthropic SDK (LLM API icin)
- Claude Code CLI bagimliligi (kullanici onceden kurmus olmali)
- Cross-platform destek (macOS, Linux, Windows)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP
- En kisa yoldan kullanicinin sorununu coz
- Teknik karmasiklik kullaniciya yansimadan calis
- Fikir → GitHub akisi sorunsuz tamamlansin

**Resource Requirements:**
- 1 gelistirici (calio)
- Claude Code + LLM API erisimi
- GitHub hesabi

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Emre - Full Auto modu ile tam otomasyon
- Zeynep - Checkpoint modu ile adim adim onay
- Hata Recovery - Otomatik retry mekanizmasi

**Must-Have Capabilities:**
- `appfabrika init` - Proje baslat, fikir al, ayar sec
- `appfabrika run` - BMAD akisini calistir
- LLM API entegrasyonu (GPT veya Claude API)
- Claude Code entegrasyonu (executor)
- 3 otomasyon seviyesi (Full Auto / Checkpoint / Collaborative)
- Otomatik hata retry (3 deneme)
- Terminal'de ilerleme gosterimi
- GitHub'a otomatik push (Claude Code uzerinden)

### Post-MVP Features

**Phase 2 (V2 - Kullaniciya Acilma):**
- Web Dashboard
- Kullanici hesaplari ve auth
- Odeme sistemi (Stripe)
- Kurulum rehberi ve video dokumantasyon
- Birden fazla LLM secenegi
- Proje gecmisi ve analitik

**Phase 3 (V3+ - Platform):**
- Paralel LLM karsilastirma
- One-click deploy (Vercel, Railway)
- Template marketplace
- Team collaboration
- API erisimi
- White-label cozum

### Risk Mitigation Strategy

**Technical Risks:**
- Claude Code API degisiklikleri → Surum sabitleme, hata yakalama
- LLM API rate limits → Retry mekanizmasi, bekleme suresi
- BMAD workflow hatalari → Checkpoint'ler, kurtarma noktalari

**Market Risks:**
- "Gercekten calisiyor mu?" supheleri → Demo videolari, ornek projeler
- Hedef kitleye ulasim → Sosyal medya, community building

**Resource Risks:**
- Solo gelistirme → MVP'yi kucuk tut, iteratif gelistir
- Zaman kisitlari → Oncelik siralamasina sadik kal

## Functional Requirements

### Proje Baslangici

- FR1: Kullanici `appfabrika init` komutu ile yeni proje baslatabilir
- FR2: Kullanici proje fikrini tek cumle olarak girebilir
- FR3: Kullanici LLM secimi yapabilir (GPT veya Claude API)
- FR4: Kullanici otomasyon sablonu secebilir (Full Auto / Business Manuel / Full Manuel / Custom)
- FR5: Sistem proje klasoru ve temel yapiyi olusturabilir

### BMAD Workflow (Tam Adimlar)

- FR6: Sistem BMAD Brainstorming adimini calistirabilir
- FR7: Sistem BMAD Research adimini calistirabilir (Market/Technical/Domain)
- FR8: Sistem BMAD Product Brief adimini calistirabilir
- FR9: Sistem BMAD PRD adimini calistirabilir
- FR10: Sistem BMAD UX Design adimini calistirabilir
- FR11: Sistem BMAD Architecture adimini calistirabilir
- FR12: Sistem BMAD Epics & Stories adimini calistirabilir
- FR13: Sistem BMAD Sprint Planning adimini calistirabilir
- FR14: Sistem BMAD Tech Spec adimini calistirabilir
- FR15: Sistem BMAD Development (kod uretimi) adimini calistirabilir
- FR16: Sistem BMAD Code Review adimini calistirabilir
- FR17: Sistem BMAD QA/Testing adimini calistirabilir
- FR18: Sistem BMAD adimlarini sirali olarak yurutebilir
- FR19: Sistem her BMAD adiminin ciktisini kaydedebilir
- FR20: Sistem manuel tamamlanan adimlari algilayip sonraki adima gecebilir
- FR21: Kullanici istenen adimi atlayabilir (skip)
- FR22: Kullanici atlanan adima geri donebilir

### LLM Entegrasyonu

- FR23: Sistem LLM API'ye BMAD sorularini gonderebilir
- FR24: Sistem LLM'den gelen cevaplari alabilir
- FR25: Sistem LLM cevaplarini BMAD formatina donusturebilir
- FR26: Kullanici farkli LLM saglayicilari kullanabilir

### Otomasyon Yonetimi

- FR27: Kullanici her BMAD adimi icin ayri ayri otomasyon/manuel secimi yapabilir
- FR28: Kullanici calisma sirasinda herhangi bir adimi otomasyona alabilir
- FR29: Kullanici calisma sirasinda herhangi bir adimi manuel'e gecirebilir
- FR30: Kullanici "Full Auto" sablonunu secebilir
- FR31: Kullanici "Business Manuel" sablonunu secebilir
- FR32: Kullanici "Full Manuel" sablonunu secebilir
- FR33: Kullanici "Custom" sablonuyla adim adim secim yapabilir
- FR34: Sistem kullanicinin secimlerini hatirlayip sonraki projelerde onerebilir

### Hata Yonetimi

- FR35: Sistem hata durumunda otomatik yeniden deneyebilir (3 deneme)
- FR36: Sistem yeniden deneme arasinda bekleme suresi uygulayabilir
- FR37: Sistem 3 deneme sonrasi anlasilir hata mesaji gosterebilir
- FR38: Sistem hata durumunda projeyi kurtarma noktasindan devam ettirebilir

### Terminal Arayuzu

- FR39: Sistem mevcut BMAD adimini gosterebilir
- FR40: Sistem her adimin otomasyon/manuel durumunu gosterebilir
- FR41: Sistem ilerleme durumunu canli gosterebilir
- FR42: Sistem tamamlanan adimlari isaretleyebilir
- FR43: Sistem proje tamamlandiginda ozet gosterebilir

### Konfigurasyon

- FR44: Kullanici LLM API key'ini bir kere girip kaydedebilir
- FR45: Sistem konfigurasyon dosyasini guvenli saklayabilir
- FR46: Kullanici varsayilan otomasyon sablonunu kaydedebilir
- FR47: Kullanici varsayilan LLM tercihini kaydedebilir

### GitHub Entegrasyonu (Claude Code Uzerinden)

- FR48: Sistem proje tamamlandiginda GitHub reposu olusturabilir
- FR49: Sistem kodu GitHub'a push edebilir
- FR50: Sistem proje tamamlandiginda repo URL'sini gosterebilir

## Non-Functional Requirements

### Performance

- NFR1: BMAD adim gecisleri kullaniciyi 5 saniyeden fazla bekletmemeli
- NFR2: LLM API cevaplari 30 saniye icinde alinmali (timeout)
- NFR3: Terminal UI guncellemeleri anlik olmali (<100ms)
- NFR4: Proje baslangici (init) 3 saniye icinde tamamlanmali

### Security

- NFR5: LLM API key'leri sifrelenmis olarak saklanmali
- NFR6: API key'ler log'larda veya hata mesajlarinda gorunmemeli
- NFR7: Konfigurasyon dosyasi sadece kullanici tarafindan okunabilir olmali (chmod 600)

### Integration

- NFR8: OpenAI API (GPT) ile uyumlu olmali
- NFR9: Anthropic API (Claude) ile uyumlu olmali
- NFR10: Claude Code CLI ile sorunsuz calisabilmeli
- NFR11: GitHub API (gh CLI) ile uyumlu olmali

### Reliability

- NFR12: LLM API hatalari otomatik retry ile %70 oraninda kurtarilabilmeli
- NFR13: Network hatalari 3 denemeye kadar otomatik tekrarlanmali
- NFR14: Proje durumu her adimda kaydedilmeli (crash recovery)
- NFR15: Yarida kalan projeler kaldigi yerden devam edebilmeli
