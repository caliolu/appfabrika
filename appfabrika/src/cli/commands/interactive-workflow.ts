/**
 * Interactive BMAD Workflow
 * Full conversational workflow with options, iterations, and user feedback
 */

import * as p from '@clack/prompts';
import { BmadStepType, BMAD_STEP_NAMES, BMAD_STEP_EMOJIS } from '../../types/bmad.types.js';
import { AnthropicAdapter } from '../../adapters/llm/anthropic.adapter.js';

/**
 * Interactive step configuration
 */
interface InteractiveStepConfig {
  stepId: BmadStepType;
  name: string;
  emoji: string;
  phases: StepPhase[];
}

/**
 * A phase within a step (e.g., "Generate Options", "Deep Dive", "Finalize")
 */
interface StepPhase {
  name: string;
  prompt: (context: StepContext) => string;
  options?: string[]; // If provided, user picks from these
  allowCustom?: boolean;
  requireApproval?: boolean;
}

/**
 * Context passed between phases
 */
interface StepContext {
  idea: string;
  previousSteps: Map<BmadStepType, string>;
  currentStepOutputs: string[];
  userSelections: string[];
}

/**
 * Result of an interactive step
 */
interface InteractiveStepResult {
  approved: boolean;
  finalOutput: string;
  iterations: number;
}

/**
 * Stream a response and return the full content
 */
async function streamResponse(
  adapter: AnthropicAdapter,
  prompt: string,
  systemPrompt: string
): Promise<string> {
  let fullContent = '';

  console.log('');
  console.log('─'.repeat(50));
  console.log('');

  const stream = adapter.stream(prompt, {
    maxTokens: 4096,
    systemPrompt,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk);
    fullContent += chunk;
  }

  console.log('');
  console.log('');
  console.log('─'.repeat(50));

  return fullContent;
}

/**
 * Interactive prompts for each BMAD step
 */
const INTERACTIVE_STEP_PROMPTS: Record<BmadStepType, {
  explore: (idea: string, context?: string) => string;
  options: (idea: string, context?: string) => string;
  deepen: (idea: string, selection: string, context?: string) => string;
  finalize: (idea: string, content: string, feedback?: string) => string;
}> = {
  [BmadStepType.BRAINSTORMING]: {
    explore: (idea) => `Ürün fikri: "${idea}"

Bu fikir için 3 FARKLI yaklaşım/yön öner. Her biri tamamen farklı bir strateji olsun:

**Yaklaşım A:** [İsim]
- Temel konsept
- Hedef kitle
- Farklılaştırıcı özellik

**Yaklaşım B:** [İsim]
- Temel konsept
- Hedef kitle
- Farklılaştırıcı özellik

**Yaklaşım C:** [İsim]
- Temel konsept
- Hedef kitle
- Farklılaştırıcı özellik

Kısa ve öz tut. Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için hangi yaklaşımı tercih edersin?`,

    deepen: (idea, selection) => `"${idea}" projesi için "${selection}" yaklaşımını seçtin.

Şimdi bu yaklaşımı derinleştir:

1. **Güçlü Yönler** (5 madde)
2. **Potansiyel Riskler** (5 madde)
3. **Hedef Kitle Detayı**
   - Demografik
   - Psikografik
   - Davranışsal
4. **Benzersiz Değer Önerisi** (tek cümle)
5. **İlk 3 Ayda Yapılacaklar**

Detaylı ve pratik ol. Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" için beyin fırtınası dokümanını finalize et.

Mevcut içerik:
${content}

${feedback ? `Kullanıcı geri bildirimi: ${feedback}` : ''}

Son halini hazırla. Eksiği varsa tamamla, fazlası varsa sadeleştir.`,
  },

  [BmadStepType.RESEARCH]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Önceki analiz:\n${context}\n` : ''}

Araştırma yapılması gereken 4 alan öner:

**Alan 1:** [Pazar/Rakip/Teknoloji/Kullanıcı]
- Neden önemli?
- Ne araştırılmalı?

**Alan 2-4:** (aynı format)

Kısa tut. Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için hangi alanları araştırmamı istersin?`,

    deepen: (idea, selection, context) => `"${idea}" için "${selection}" araştırması:

${context ? `Bağlam:\n${context}\n` : ''}

Detaylı araştırma raporu hazırla:

1. **Pazar Büyüklüğü** (rakamlar)
2. **Ana Rakipler** (3-5 tane, güçlü/zayıf yönleri)
3. **Trendler** (yükselen, düşen)
4. **Fırsatlar** (boşluklar, niş alanlar)
5. **Tehditler** (engeller, riskler)

Somut veriler ve örnekler kullan. Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" için araştırma raporunu finalize et.

${content}

${feedback ? `Geri bildirim: ${feedback}` : ''}

Eksikleri tamamla, tutarsızlıkları düzelt.`,
  },

  [BmadStepType.PRODUCT_BRIEF]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Araştırma:\n${context}\n` : ''}

Ürün özeti için 3 farklı VİZYON öner:

**Vizyon A:** [Kısa slogan]
- Çözdüğü problem
- Nasıl çözüyor
- Başarı metriği

**Vizyon B-C:** (aynı format)

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için hangi vizyon sana uygun?`,

    deepen: (idea, selection, context) => `"${idea}" - Vizyon: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Tam Product Brief hazırla:

1. **Vizyon** (1 cümle)
2. **Misyon** (1 paragraf)
3. **Problem Tanımı** (kim, ne, neden)
4. **Çözüm Önerisi** (nasıl)
5. **Hedef Kitle** (detaylı persona)
6. **Başarı Kriterleri** (ölçülebilir, 5 tane)
7. **Kapsam** (ne dahil, ne hariç)
8. **Varsayımlar ve Riskler**

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" Product Brief'i finalize et.

${content}

${feedback ? `Düzeltme: ${feedback}` : ''}`,
  },

  [BmadStepType.PRD]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Product Brief:\n${context}\n` : ''}

PRD için öncelik belirle. 3 farklı MVP kapsamı öner:

**MVP A - Minimal:**
- 3 temel özellik

**MVP B - Dengeli:**
- 5-7 özellik

**MVP C - Kapsamlı:**
- 10+ özellik

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için hangi MVP kapsamını tercih edersin?`,

    deepen: (idea, selection, context) => `"${idea}" - MVP: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Detaylı PRD hazırla:

## Fonksiyonel Gereksinimler
Her özellik için:
- FR-001: [Özellik adı]
  - Açıklama
  - Kabul kriterleri
  - Öncelik (Must/Should/Could)

## Non-Fonksiyonel Gereksinimler
- Performans
- Güvenlik
- Ölçeklenebilirlik

## Kullanıcı Senaryoları
- US-001: [Senaryo]

## Kısıtlamalar
- Teknik
- İş
- Yasal

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" PRD'yi finalize et.

${content}

${feedback ? `Revizyon: ${feedback}` : ''}`,
  },

  [BmadStepType.UX_DESIGN]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `PRD:\n${context}\n` : ''}

UX için 3 farklı tasarım yaklaşımı öner:

**Yaklaşım A:** [Minimalist/Feature-rich/Gamified/vb.]
- Ana karakteristik
- Örnek uygulama

**Yaklaşım B-C:** (aynı format)

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için hangi UX yaklaşımı?`,

    deepen: (idea, selection, context) => `"${idea}" - UX: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

UX Tasarım Dokümanı:

## Ana Ekranlar
Her ekran için:
- Ekran adı
- Amacı
- Ana bileşenler
- Kullanıcı aksiyonları

## Kullanıcı Akışları
- Onboarding akışı
- Ana kullanım akışı
- Hata durumları

## Navigasyon Yapısı
- Site haritası
- Menü yapısı

## Tasarım Prensipleri
- Renk paleti önerisi
- Tipografi
- Spacing sistemi

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" UX dokümanını finalize et.

${content}

${feedback ? `Değişiklik: ${feedback}` : ''}`,
  },

  [BmadStepType.ARCHITECTURE]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `UX/PRD:\n${context}\n` : ''}

3 farklı mimari yaklaşım öner:

**Mimari A:** Monolitik
- Avantaj/Dezavantaj
- Ne zaman uygun

**Mimari B:** Mikroservis
- Avantaj/Dezavantaj
- Ne zaman uygun

**Mimari C:** Serverless
- Avantaj/Dezavantaj
- Ne zaman uygun

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için hangi mimari?`,

    deepen: (idea, selection, context) => `"${idea}" - Mimari: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Mimari Tasarım Dokümanı:

## Sistem Bileşenleri
- Her bileşenin sorumluluğu
- Bileşenler arası iletişim

## Teknoloji Stack
- Frontend: (neden)
- Backend: (neden)
- Database: (neden)
- Cache: (neden)
- Queue: (neden)

## API Tasarımı
- Ana endpoint'ler
- Authentication yöntemi

## Veri Modeli
- Ana entity'ler
- İlişkiler

## Güvenlik
- Katmanlar
- Önlemler

## Deployment
- Ortamlar
- CI/CD yaklaşımı

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" mimari dokümanını finalize et.

${content}

${feedback ? `Güncelleme: ${feedback}` : ''}`,
  },

  [BmadStepType.EPICS_STORIES]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Mimari/PRD:\n${context}\n` : ''}

Epic organizasyonu için 3 yaklaşım öner:

**Yaklaşım A:** Özellik bazlı
- Epic 1: Auth
- Epic 2: Core Feature
- ...

**Yaklaşım B:** Kullanıcı journey bazlı
- Epic 1: Onboarding
- Epic 2: İlk kullanım
- ...

**Yaklaşım C:** Teknik katman bazlı
- Epic 1: Altyapı
- Epic 2: Backend
- ...

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için epic organizasyonu?`,

    deepen: (idea, selection, context) => `"${idea}" - Epic: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Epic ve Story Dokümanı:

## Epic 1: [İsim]
**Hedef:**

### Story 1.1
- **Başlık:**
- **Açıklama:** As a [user], I want [goal], so that [benefit]
- **Kabul Kriterleri:**
  - [ ] Kriter 1
  - [ ] Kriter 2
- **Story Points:**
- **Bağımlılıklar:**

### Story 1.2-1.N (aynı format)

## Epic 2-N (aynı format)

## Bağımlılık Haritası

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" epic/story dokümanını finalize et.

${content}

${feedback ? `Revize: ${feedback}` : ''}`,
  },

  [BmadStepType.SPRINT_PLANNING]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Epic/Story:\n${context}\n` : ''}

Sprint stratejisi için 3 seçenek:

**Strateji A:** 1 haftalık sprintler (hızlı iterasyon)
**Strateji B:** 2 haftalık sprintler (dengeli)
**Strateji C:** 3 haftalık sprintler (kapsamlı)

Her biri için Sprint 1 kapsamı öner.

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için sprint stratejisi?`,

    deepen: (idea, selection, context) => `"${idea}" - Sprint: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Sprint Planlama Dokümanı:

## Sprint 1
**Hedef:** [Tek cümle]
**Süre:**

### Sprint Backlog
| Story | Points | Sorumlu | Durum |
|-------|--------|---------|-------|
| ... | ... | ... | ... |

### Definition of Done
- [ ] Kod yazıldı
- [ ] Test yazıldı
- [ ] Review yapıldı
- [ ] Deploy edildi

### Riskler ve Aksiyonlar

## Sprint 2-3 (Ön plan)

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" sprint planını finalize et.

${content}

${feedback ? `Düzelt: ${feedback}` : ''}`,
  },

  [BmadStepType.TECH_SPEC]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Mimari:\n${context}\n` : ''}

Tech spec detay seviyesi için 3 seçenek:

**A:** High-level (hızlı başlangıç)
**B:** Detailed (standart)
**C:** Comprehensive (enterprise)

Her biri için içerik kapsamı belirt.

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için tech spec detay seviyesi?`,

    deepen: (idea, selection, context) => `"${idea}" - Tech Spec: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Teknik Şartname:

## Database Şeması
\`\`\`sql
CREATE TABLE ...
\`\`\`

## API Endpoint'leri
\`\`\`
POST /api/v1/...
GET /api/v1/...
\`\`\`

## Servis Detayları
Her servis için:
- Sorumluluk
- Interface
- Bağımlılıklar

## Deployment Planı
- Ortamlar
- Konfigürasyon
- Monitoring

## Test Stratejisi
- Unit test yaklaşımı
- Integration test
- E2E test

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" tech spec'i finalize et.

${content}

${feedback ? `Güncelle: ${feedback}` : ''}`,
  },

  [BmadStepType.DEVELOPMENT]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Tech Spec:\n${context}\n` : ''}

Geliştirme başlangıcı için 3 yaklaşım:

**A:** Boilerplate/Template kullan
**B:** Sıfırdan başla
**C:** Mevcut projeyi fork et

Her biri için starter code öner.

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için geliştirme yaklaşımı?`,

    deepen: (idea, selection, context) => `"${idea}" - Dev: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Geliştirme Rehberi:

## Proje Yapısı
\`\`\`
project/
├── src/
│   ├── ...
\`\`\`

## Başlangıç Kodu
Her ana bileşen için örnek kod

## Coding Standards
- Naming conventions
- File organization
- Error handling patterns

## Development Workflow
- Branch stratejisi
- Commit mesaj formatı
- PR süreci

## Best Practices
- Do's and Don'ts

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" dev rehberini finalize et.

${content}

${feedback ? `Ekle: ${feedback}` : ''}`,
  },

  [BmadStepType.CODE_REVIEW]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Dev Guide:\n${context}\n` : ''}

Code review sıkılığı için 3 seviye:

**A:** Light (hızlı review)
**B:** Standard (dengeli)
**C:** Strict (enterprise)

Her seviye için checklist kapsamı belirt.

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için review sıkılığı?`,

    deepen: (idea, selection, context) => `"${idea}" - Review: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Code Review Checklist:

## Kod Kalitesi
- [ ] Clean code prensipleri
- [ ] SOLID prensipleri
- [ ] DRY/KISS

## Güvenlik
- [ ] Input validation
- [ ] SQL injection
- [ ] XSS
- [ ] Auth/Auth

## Performans
- [ ] N+1 queries
- [ ] Memory leaks
- [ ] Caching

## Test
- [ ] Unit test coverage
- [ ] Edge cases

## Documentation
- [ ] Kod yorumları
- [ ] API docs

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" review checklist'i finalize et.

${content}

${feedback ? `Ekle: ${feedback}` : ''}`,
  },

  [BmadStepType.QA_TESTING]: {
    explore: (idea, context) => `Ürün: "${idea}"

${context ? `Review:\n${context}\n` : ''}

Test kapsamı için 3 seviye:

**A:** Smoke tests (kritik path)
**B:** Functional tests (feature coverage)
**C:** Full regression (kapsamlı)

Her biri için test senaryosu sayısı tahmin et.

Türkçe yanıt ver.`,

    options: (idea) => `"${idea}" için test kapsamı?`,

    deepen: (idea, selection, context) => `"${idea}" - QA: "${selection}"

${context ? `Bağlam:\n${context}\n` : ''}

Test Planı:

## Test Senaryoları
### Pozitif Testler
| ID | Senaryo | Adımlar | Beklenen Sonuç |
|----|---------|---------|----------------|
| TC-001 | ... | ... | ... |

### Negatif Testler
| ID | Senaryo | Adımlar | Beklenen Sonuç |

## Test Türleri
- Unit test örnekleri
- Integration test örnekleri
- E2E test örnekleri

## Test Data
- Test kullanıcıları
- Test verileri

## Kabul Kriterleri
- Coverage hedefi
- Performance metrikleri

Türkçe yanıt ver.`,

    finalize: (idea, content, feedback) => `"${idea}" test planını finalize et.

${content}

${feedback ? `Düzelt: ${feedback}` : ''}`,
  },
};

/**
 * Run a single interactive step
 */
export async function runInteractiveStep(
  stepId: BmadStepType,
  idea: string,
  adapter: AnthropicAdapter,
  previousSteps: Map<BmadStepType, string>
): Promise<InteractiveStepResult> {
  const stepName = BMAD_STEP_NAMES[stepId];
  const emoji = BMAD_STEP_EMOJIS[stepId];
  const prompts = INTERACTIVE_STEP_PROMPTS[stepId];

  const systemPrompt = 'Sen deneyimli bir ürün geliştirme uzmanısın. BMAD metodolojisini kullanıyorsun. Kısa, öz ve pratik yanıtlar ver. Türkçe konuş.';

  // Get context from previous 2 steps
  const contextSteps = Array.from(previousSteps.entries()).slice(-2);
  const context = contextSteps.map(([id, content]) =>
    `### ${BMAD_STEP_NAMES[id]}\n${content.slice(0, 1500)}`
  ).join('\n\n');

  let iterations = 0;
  let currentContent = '';
  let approved = false;

  console.log('');
  console.log('═'.repeat(60));
  console.log(`${emoji} ${stepName.toUpperCase()}`);
  console.log('═'.repeat(60));

  // Phase 1: Explore options
  console.log('');
  p.log.info('📊 Seçenekleri keşfediyorum...');

  const exploreResponse = await streamResponse(
    adapter,
    prompts.explore(idea, context),
    systemPrompt
  );

  // Phase 2: User selection
  const selection = await p.text({
    message: 'Hangi yaklaşımı/seçeneği tercih ediyorsun? (A/B/C veya kendi fikrin)',
    placeholder: 'A, B, C veya kendi cümleni yaz...',
  });

  if (p.isCancel(selection)) {
    return { approved: false, finalOutput: '', iterations: 0 };
  }

  // Phase 3: Deep dive
  console.log('');
  p.log.info(`🔍 "${selection}" seçimi için detaylandırıyorum...`);

  currentContent = await streamResponse(
    adapter,
    prompts.deepen(idea, selection as string, context),
    systemPrompt
  );
  iterations++;

  // Phase 4: Iteration loop
  while (!approved) {
    const action = await p.select({
      message: 'Bu içerik nasıl?',
      options: [
        { value: 'approve', label: '✅ Onayla ve devam et' },
        { value: 'revise', label: '✏️ Revize et (geri bildirim ver)' },
        { value: 'regenerate', label: '🔄 Baştan üret' },
        { value: 'skip', label: '⏭️ Bu adımı atla' },
      ],
    });

    if (p.isCancel(action)) {
      return { approved: false, finalOutput: '', iterations };
    }

    if (action === 'approve') {
      // Finalize
      console.log('');
      p.log.info('📝 Finalize ediliyor...');

      currentContent = await streamResponse(
        adapter,
        prompts.finalize(idea, currentContent),
        systemPrompt
      );

      approved = true;
    } else if (action === 'revise') {
      const feedback = await p.text({
        message: 'Ne değişmeli? Geri bildirimini yaz:',
        placeholder: 'Örn: Daha fazla teknik detay ekle, güvenlik kısmını genişlet...',
      });

      if (p.isCancel(feedback)) continue;

      console.log('');
      p.log.info('✏️ Revize ediliyor...');

      currentContent = await streamResponse(
        adapter,
        prompts.finalize(idea, currentContent, feedback as string),
        systemPrompt
      );
      iterations++;
    } else if (action === 'regenerate') {
      console.log('');
      p.log.info('🔄 Yeniden üretiliyor...');

      currentContent = await streamResponse(
        adapter,
        prompts.deepen(idea, selection as string, context),
        systemPrompt
      );
      iterations++;
    } else if (action === 'skip') {
      return { approved: false, finalOutput: 'Atlandı', iterations };
    }
  }

  p.log.success(`${emoji} ${stepName} tamamlandı! (${iterations} iterasyon)`);

  return {
    approved: true,
    finalOutput: currentContent,
    iterations,
  };
}
