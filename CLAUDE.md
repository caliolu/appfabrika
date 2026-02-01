# urun-fab

Bu proje BMAD (Build Measure Analyze Decide) metodolojisi ile yonetilmektedir.

## BMAD Workflow

BMAD workflow asagidaki adimlari icerir:

1. **Product Brief** - `/bmad-bmm-create-product-brief` ile urun fikrini tanimla
2. **Research** - `/bmad-bmm-research` ile pazar ve teknik arastirma yap
3. **PRD** - `/bmad-bmm-create-prd` ile detayli gereksinim dokumani olustur
4. **Architecture** - `/bmad-bmm-create-architecture` ile mimari tasarimi yap
5. **UX Design** - `/bmad-bmm-create-ux-design` ile kullanici deneyimini planla
6. **Epics & Stories** - `/bmad-bmm-create-epics-and-stories` ile is parcalarini olustur
7. **Sprint Planning** - `/bmad-bmm-sprint-planning` ile sprint planla
8. **Development** - `/bmad-bmm-dev-story` ile hikaye bazli gelistirme yap

## Proje Yapisi

```
docs/
  prd/           # Product Requirements Documents
  architecture/  # Architecture decisions
  epics/         # Epic and story files
  ux/            # UX designs
  research/      # Research documents
  tech-specs/    # Technical specifications
_bmad/           # BMAD core files
```

## Yardim

Herhangi bir noktada takilirsan `/bmad-help` komutunu kullan.
