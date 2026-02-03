# AppFabrika

BMAD (Brainstorm, Market, Architect, Develop) metodolojisi ile fikir asamasindan urune kadar tum sureci otomatiklestiren CLI araci.

## Ozellikler

- **12 Adimli BMAD Workflow**: Fikir gelistirmeden QA testine kadar kapsamli urun gelistirme sureci
- **Yapay Zeka Destekli**: Anthropic Claude API ile akilli icerik uretimi
- **Checkpoint Sistemi**: Yarida kalan calismalari kaldigi yerden devam ettirme
- **Turkce Arayuz**: Tamamen Turkce kullanici deneyimi
- **Esnek Otomasyon**: Tam otomatik veya adim adim kontrol

## BMAD Workflow Adimlari

| # | Adim | Aciklama |
|---|------|----------|
| 1 | Fikir Gelistirme | Proje fikrini analiz et, guclu/zayif yonleri belirle |
| 2 | Arastirma | Pazar, rakip ve teknoloji arastirmasi yap |
| 3 | Urun Ozeti | Vizyon, misyon ve basari kriterlerini tanimla |
| 4 | Gereksinimler (PRD) | Fonksiyonel ve teknik gereksinimleri dokumante et |
| 5 | UX Tasarimi | Kullanici akislari ve arayuz tasarimi olustur |
| 6 | Mimari | Sistem mimarisi ve teknoloji secimlerini planla |
| 7 | Epic ve Hikayeler | Agile epic'ler ve kullanici hikayeleri olustur |
| 8 | Sprint Planlama | Sprint hedefleri ve gorev dagilimi yap |
| 9 | Teknik Sartname | Detayli teknik tasarim ve API dokumantasyonu |
| 10 | Gelistirme | Kod yapisi ve best practice onerileri |
| 11 | Kod Inceleme | Kalite, guvenlik ve performans kontrolleri |
| 12 | Test | Test plani ve senaryo olusturma |

## Kurulum

```bash
# npm ile global kurulum
npm install -g appfabrika

# veya kaynak koddan
git clone https://github.com/caliolu/appfabrika.git
cd appfabrika
npm install
npm run build
npm link
```

## Yapilandirma

### API Anahtari

AppFabrika, Anthropic Claude API kullanir. API anahtarinizi ayarlayin:

```bash
# .env dosyasina ekleyin
mkdir -p ~/.appfabrika
echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.appfabrika/.env
chmod 600 ~/.appfabrika/.env
```

API anahtari almak icin: https://console.anthropic.com/

## Kullanim

### Yeni Proje Baslat

```bash
appfabrika init
```

Interaktif olarak sorar:
- Proje fikriniz
- LLM saglayici secimi (Anthropic/OpenAI)
- Otomasyon modu (checkpoint/full-auto)

### BMAD Workflow Calistir

```bash
# Interaktif mod (checkpoint'li)
appfabrika run

# Tam otomatik mod
appfabrika run --auto

# Belirli bir adimdan basla
appfabrika run --step 5

# Belirli adimi otomatik calistir
appfabrika run --auto --step 1
```

### Ornek Cikti

```
$ appfabrika run --auto

  BMAD Workflow Baslatiliyor

  Proje yuklendi: my-awesome-project

  1. Fikir Gelistirme
     Proje fikrini analiz ediyor...

  2. Arastirma
     Pazar ve teknik arastirma yapiyor...

  ... (12 adim)

  Tebrikler! Projeniz hazir!

   GitHub: https://github.com/user/project
   Yerel:  /path/to/project

   Istatistikler:
   - 12 adim tamamlandi
   - Toplam sure: 10 dakika 38 saniye
```

## Proje Yapisi

```
my-project/
├── .appfabrika/
│   ├── config.json          # Proje yapilandirmasi
│   └── checkpoints/         # Adim ciktilari
│       ├── step-01-brainstorming.json
│       ├── step-02-research.json
│       └── ...
└── ...
```

## Gelistirme

```bash
# Bagimliliklari yukle
npm install

# Gelistirme modu (watch)
npm run dev

# Build
npm run build

# Testleri calistir
npm test

# Lint
npm run lint

# Tip kontrolu
npm run typecheck
```

### Teknoloji Stack

- **Runtime**: Node.js 18+
- **Dil**: TypeScript
- **CLI Framework**: Commander.js
- **UI**: @clack/prompts, Ora spinner
- **LLM**: Anthropic Claude API (@anthropic-ai/sdk)
- **Build**: tsup
- **Test**: Vitest

## Mimari

```
src/
├── cli/
│   ├── commands/        # CLI komutlari (init, run)
│   └── ui/              # Terminal UI bilesenleri
├── adapters/
│   └── llm/             # LLM adapter'lari (Anthropic, OpenAI)
├── services/
│   ├── checkpoint-service.ts
│   ├── resume-service.ts
│   └── bmad-step-registry.ts
├── core/
│   ├── config.ts        # Yapilandirma yonetimi
│   └── secrets.ts       # API key yonetimi
└── types/               # TypeScript tipleri
```

## Katki

1. Fork edin
2. Feature branch olusturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'feat: add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request acin

## Lisans

MIT License - detaylar icin [LICENSE](LICENSE) dosyasina bakin.

## Iletisim

- GitHub: [@caliolu](https://github.com/caliolu)
- Proje: [https://github.com/caliolu/appfabrika](https://github.com/caliolu/appfabrika)
