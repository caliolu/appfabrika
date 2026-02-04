/**
 * BMAD Step Executor
 * Executes workflow steps interactively with AI + user interaction
 * Now with A/P/C/Y menu system, Advanced Elicitation (50+ methods), and YOLO mode
 */

import * as p from '@clack/prompts';
import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import type {
  ParsedStep,
  StepSection,
  StepResult,
  ExecutionContext,
  MenuOption,
  AgentPersona,
} from './types.js';
import { BMAD_AGENTS, getAgentsForPhase } from './types.js';
import {
  showStepMenu,
  runAdvancedElicitation,
  createYoloState,
  enableYoloMode,
  shouldAutoContinue,
  type YoloState,
} from './template-engine.js';

// Global YOLO state for the current workflow
let currentYoloState: YoloState = createYoloState();

/**
 * Stream AI response to console with clear formatting
 */
async function streamResponse(
  adapter: AnthropicAdapter,
  prompt: string,
  systemPrompt: string,
  showOutput: boolean = true
): Promise<string> {
  let fullContent = '';

  if (showOutput) {
    console.log('');
    console.log('┌' + '─'.repeat(58) + '┐');
    console.log('│ 🤖 AI Yanıtı:'.padEnd(59) + '│');
    console.log('└' + '─'.repeat(58) + '┘');
    console.log('');
  }

  const stream = adapter.stream(prompt, {
    maxTokens: 4096,
    systemPrompt,
  });

  for await (const chunk of stream) {
    if (showOutput) {
      process.stdout.write(chunk);
    }
    fullContent += chunk;
  }

  if (showOutput) {
    console.log('');
    console.log('');
    console.log('─'.repeat(60));
  }

  return fullContent;
}

/**
 * Build prompt from step section
 */
function buildSectionPrompt(
  section: StepSection,
  context: ExecutionContext,
  previousContent: string
): string {
  let prompt = `Proje: "${context.idea}"

Adım: ${section.title}

`;

  if (previousContent) {
    prompt += `Önceki içerik:
${previousContent.slice(0, 2000)}

`;
  }

  // Add section-specific instructions
  prompt += section.content;

  // Add questions if available
  if (section.questions.length > 0) {
    prompt += `

Lütfen şu soruları kullanıcıya sor:
${section.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
`;
  }

  prompt += `

Türkçe yanıt ver. Kısa ve öz ol.`;

  return prompt;
}

/**
 * Execute a single section of a step
 */
async function executeSection(
  section: StepSection,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  previousContent: string
): Promise<string> {
  const systemPrompt = `Sen deneyimli bir ürün geliştirme uzmanısın. BMAD metodolojisini kullanıyorsun.
Rolün: Kolaylaştırıcı - içerik üretici değil, keşif rehberi.
Kullanıcıyla işbirliği içinde çalış, sorular sor, geri bildirim al.
Türkçe konuş.`;

  console.log('');
  p.log.info(`📝 ${section.number}. ${section.title}`);

  const prompt = buildSectionPrompt(section, context, previousContent);
  const response = await streamResponse(adapter, prompt, systemPrompt);

  return response;
}

/**
 * Handle A/P/C/Y menu - Now with full Advanced Elicitation and YOLO mode
 */
async function handleMenu(
  menuOptions: MenuOption[],
  currentContent: string,
  stepName: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter
): Promise<{ action: string; content: string; continue: boolean }> {
  // Check YOLO mode first
  if (shouldAutoContinue(currentYoloState)) {
    return { action: 'approve', content: currentContent, continue: true };
  }

  // Use the new showStepMenu from template-engine
  const menuResult = await showStepMenu(
    currentContent,
    stepName,
    context,
    adapter,
    currentYoloState.enabled
  );

  // Handle YOLO mode activation
  if (menuResult.yoloEnabled) {
    currentYoloState = enableYoloMode(currentYoloState);
    return { action: 'yolo', content: currentContent, continue: true };
  }

  // Handle choices
  switch (menuResult.choice) {
    case 'continue':
      return { action: 'approve', content: currentContent, continue: true };

    case 'advanced':
      // Use full Advanced Elicitation with 50+ methods
      return {
        action: 'advanced',
        content: menuResult.enhancedContent || currentContent,
        continue: false,
      };

    case 'party':
      return {
        action: 'party',
        content: menuResult.enhancedContent || currentContent,
        continue: false,
      };

    case 'edit':
      return {
        action: 'edit',
        content: menuResult.enhancedContent || currentContent,
        continue: false,
      };

    case 'yolo':
      currentYoloState = enableYoloMode(currentYoloState);
      return { action: 'yolo', content: currentContent, continue: true };

    default:
      return { action: 'unknown', content: currentContent, continue: false };
  }
}

/**
 * Reset YOLO state for new workflow
 */
export function resetYoloState(): void {
  currentYoloState = createYoloState();
}

/**
 * Check if YOLO mode is active
 */
export function isYoloModeActive(): boolean {
  return currentYoloState.enabled;
}

/**
 * Execute a complete step (interactive mode)
 */
export async function executeStep(
  step: ParsedStep,
  context: ExecutionContext,
  adapter: AnthropicAdapter
): Promise<StepResult> {
  console.log('');
  console.log('═'.repeat(60));
  console.log(`📌 ${step.meta.name.toUpperCase()}`);
  if (step.meta.description) {
    console.log(`   ${step.meta.description}`);
  }
  console.log('═'.repeat(60));

  // Build step content
  let stepContent = step.goal || '';
  for (const section of step.sections) {
    stepContent += `\n\n### ${section.title}\n${section.content}`;
  }

  // Extract techniques from step content
  const techniques = extractTechniques(stepContent);

  let accumulatedContent = '';
  let iterations = 0;
  let approved = false;

  // If multiple techniques found, run ALL of them automatically
  if (techniques.length >= 2) {
    console.log('');
    console.log(`🎯 ${techniques.length} teknik tespit edildi - HEPSİ çalıştırılacak:`);
    techniques.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
    console.log('');

    // Run ALL techniques automatically
    const outputs: string[] = [];

    for (let i = 0; i < techniques.length; i++) {
      const output = await runTechnique(
        techniques[i],
        i,
        techniques.length,
        context,
        adapter,
        true
      );
      outputs.push(output);
      iterations++;
    }

    // Synthesize all outputs
    const synthesis = await synthesizeTechniques(
      techniques,
      outputs,
      context,
      adapter,
      true
    );
    iterations++;

    const techniqueOutput = techniques.map((t, i) =>
      `## ${t}\n\n${outputs[i]}`
    ).join('\n\n---\n\n') + '\n\n---\n\n# SENTEZ\n\n' + synthesis;

    // Run agent review
    const agentReview = await runAgentReview(
      techniqueOutput,
      step.meta.name,
      context,
      adapter,
      true
    );

    accumulatedContent = techniqueOutput + '\n\n---\n\n# 🎭 UZMAN DEĞERLENDİRMESİ\n\n' + agentReview;
  } else {
    // No multiple techniques, run standard sections
    const nonMenuSections = step.sections.filter(s => !s.isMenu);

    for (const section of nonMenuSections) {
      const sectionContent = await executeSection(
        section,
        context,
        adapter,
        accumulatedContent
      );
      accumulatedContent += '\n\n' + sectionContent;
      iterations++;

      // Get user input if section has questions
      if (section.questions.length > 0) {
        const userInput = await p.text({
          message: 'Cevabınız:',
          placeholder: 'Düşüncelerinizi yazın...',
        });

        if (p.isCancel(userInput)) {
          return { success: false, output: '', userApproved: false, iterations };
        }

        const processedContent = await streamResponse(
          adapter,
          `Önceki içerik:\n${accumulatedContent}\n\nKullanıcı cevabı: ${userInput}\n\nBu cevabı analiz et ve içeriğe entegre et. Türkçe yanıt ver.`,
          'Sen bir kolaylaştırıcısın. Kullanıcı cevabını mevcut içeriğe entegre et.'
        );

        accumulatedContent = processedContent;
        iterations++;
      }
    }

    // Run agent review for standard sections
    const agentReview = await runAgentReview(
      accumulatedContent,
      step.meta.name,
      context,
      adapter,
      true
    );

    accumulatedContent = accumulatedContent + '\n\n---\n\n# 🎭 UZMAN DEĞERLENDİRMESİ\n\n' + agentReview;
  }

  // Handle menu (A/P/C/Y loop) - Now with YOLO mode support
  while (!approved) {
    const menuResult = await handleMenu(
      step.menuOptions,
      accumulatedContent,
      step.meta.name,
      context,
      adapter
    );

    if (menuResult.action === 'cancel') {
      return { success: false, output: '', userApproved: false, iterations };
    }

    if (menuResult.action === 'skip') {
      return { success: true, output: 'Atlandı', userApproved: false, nextStep: step.meta.nextStepFile, iterations };
    }

    if (menuResult.continue) {
      approved = true;
      accumulatedContent = menuResult.content;
    } else {
      if (menuResult.content) {
        accumulatedContent = menuResult.content;
      }
      iterations++;
    }
  }

  p.log.success(`✅ ${step.meta.name} tamamlandı! (${iterations} iterasyon)`);

  return {
    success: true,
    output: accumulatedContent,
    userApproved: true,
    nextStep: step.meta.nextStepFile,
    iterations,
  };
}

/**
 * Generate options for a step (like the 3 alternatives feature)
 */
export async function generateOptions(
  step: ParsedStep,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  count: number = 3
): Promise<string[]> {
  const systemPrompt = 'Sen bir ürün geliştirme uzmanısın. Farklı alternatifler öner.';

  const prompt = `Proje: "${context.idea}"
Adım: ${step.meta.name}
Açıklama: ${step.meta.description}

${count} FARKLI yaklaşım/alternatif öner. Her biri tamamen farklı bir strateji olsun.

Her alternatif için:
- Kısa isim
- Temel konsept
- Avantaj
- Dezavantaj

Türkçe yanıt ver. Markdown formatında yaz.`;

  const response = await streamResponse(adapter, prompt, systemPrompt);

  // Parse alternatives from response
  const alternatives = response.split(/\*\*(?:Yaklaşım|Alternatif|Seçenek)\s+[A-Z]:/i)
    .filter(a => a.trim())
    .slice(0, count);

  return alternatives;
}

/**
 * Generate workflow summary/synthesis from all step outputs
 */
export async function generateWorkflowSummary(
  workflowName: string,
  workflowDescription: string,
  stepOutputs: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter
): Promise<string> {
  const systemPrompt = `Sen deneyimli bir ürün geliştirme uzmanısın.
Bir workflow'un tüm adımlarını analiz edip kapsamlı bir özet/sentez oluşturuyorsun.
Bu özet, sonraki workflow'lara girdi olarak kullanılacak.`;

  const prompt = `Proje: "${context.idea}"
Workflow: ${workflowName}
Açıklama: ${workflowDescription}

Tamamlanan Adımların Çıktıları:
${stepOutputs}

---

Lütfen bu workflow'un kapsamlı bir özetini oluştur:

## ${workflowName} - Özet

### Ana Bulgular
(En önemli 5-7 bulgu)

### Kararlar
(Alınan kararlar ve gerekçeleri)

### Sonraki Adımlar İçin Girdiler
(Sonraki workflow'lara aktarılması gereken kritik bilgiler)

### Açık Sorular
(Henüz cevaplanmamış sorular varsa)

### Riskler ve Dikkat Edilecekler
(Tespit edilen riskler)

Türkçe ve özlü yaz. Markdown formatında.`;

  console.log('');
  console.log('═'.repeat(60));
  console.log(`📊 ${workflowName.toUpperCase()} - ÖZET OLUŞTURULUYOR`);
  console.log('═'.repeat(60));

  const summary = await streamResponse(adapter, prompt, systemPrompt);

  return summary;
}

/**
 * Extract techniques/options from step content
 * Works across all BMAD workflows
 */
function extractTechniques(content: string): string[] {
  const techniques: string[] = [];
  const seen = new Set<string>();

  const addTechnique = (name: string) => {
    const cleaned = name.trim().replace(/\*\*/g, '').replace(/^[-•]\s*/, '');
    if (cleaned.length > 3 && cleaned.length < 60 && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      techniques.push(cleaned);
    }
  };

  // 1. Numbered patterns: "1. Name", "**1. Name**", "1) Name"
  const numberedPatterns = [
    /(?:\*\*)?(\d+)[.)]\s*(?:\*\*)?([^*\n:]+?)(?:\*\*)?(?:\s*[-–:]|\s*\(|\n)/g,
    /^(\d+)\.\s+\*\*([^*]+)\*\*/gm,
  ];

  for (const pattern of numberedPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      addTechnique(match[2]);
    }
  }

  // 2. Lettered patterns: "A) Name", "**A)** Name", "[A] Name", "A. Name"
  const letteredPatterns = [
    /(?:\*\*)?([A-Z])[).]\s*(?:\*\*)?([^*\n:]+?)(?:\*\*)?(?:\s*[-–:]|\n)/g,
    /\[([A-Z])\]\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?(?:\s*[-–]|\n)/g,
    /^###?\s*\*\*([A-Z])[.)]\s*([^*]+)\*\*/gm,
  ];

  for (const pattern of letteredPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      addTechnique(match[2]);
    }
  }

  // 3. Bold technique/method names
  const boldPatterns = [
    /\*\*([^*]+?(?:Yöntemi|Tekniği|Analizi|Düşünme|Yaklaşımı|Stratejisi|Modeli|Metodu|Çerçevesi|Framework|Pattern|Analysis|Method|Approach))\*\*/gi,
    /\*\*([^*]{5,40})\*\*\s*[-–:]\s*[A-Z]/g, // Bold followed by description
  ];

  for (const pattern of boldPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      addTechnique(match[1]);
    }
  }

  // 4. PRD-specific patterns
  const prdPatterns = [
    /(?:FR|NFR|US|UC|REQ)-?\d+[.:]\s*([^\n]+)/g, // Functional requirements
    /###\s*(?:\d+\.)?\s*([^#\n]+(?:Gereksinim|Requirement|Feature|Özellik))/gi,
  ];

  for (const pattern of prdPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      addTechnique(match[1]);
    }
  }

  // 5. Architecture-specific patterns
  const archPatterns = [
    /(?:Mimari|Architecture|Pattern|Desen)[:\s]+\*\*([^*]+)\*\*/gi,
    /\*\*(Monolitik|Mikroservis|Serverless|Event-Driven|Layered|Hexagonal|Clean Architecture|CQRS|DDD)[^*]*\*\*/gi,
  ];

  for (const pattern of archPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      addTechnique(match[1]);
    }
  }

  // 6. UX-specific patterns
  const uxPatterns = [
    /\*\*(User Journey|Kullanıcı Yolculuğu|Wireframe|Mockup|Prototype|Persona|Flow|Akış)[^*]*\*\*/gi,
    /(?:Tasarım|Design)\s+(?:Prensibi|Principle|Pattern|Desen)[:\s]+\*\*([^*]+)\*\*/gi,
  ];

  for (const pattern of uxPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      addTechnique(match[1]);
    }
  }

  // 7. Sprint/Story patterns
  const sprintPatterns = [
    /(?:Epic|Story|Task|Sprint)[:\s]+\*\*([^*]+)\*\*/gi,
    /\*\*(?:Epic|Story|Hikaye)\s+\d+[:\s]+([^*]+)\*\*/gi,
  ];

  for (const pattern of sprintPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      addTechnique(match[1]);
    }
  }

  // 8. General heading patterns (### Heading)
  const headingPattern = /^#{2,3}\s+(?:\d+\.)?\s*([^#\n]{5,50})/gm;
  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    const heading = match[1].trim();
    // Only add if it looks like a technique/option (not a meta heading)
    if (!heading.match(/^(STEP|ADIM|MENU|SUCCESS|FAILURE|CRITICAL|MANDATORY|EXECUTION)/i)) {
      addTechnique(heading);
    }
  }

  return techniques.slice(0, 15); // Max 15 techniques per step
}

/**
 * Determine the type of item for better prompting
 */
function getItemType(itemName: string, workflowName: string): { type: string; promptStyle: string } {
  const lowerName = itemName.toLowerCase();
  const lowerWorkflow = workflowName.toLowerCase();

  if (lowerWorkflow.includes('brainstorm') || lowerName.includes('tekni') || lowerName.includes('yöntem')) {
    return { type: 'Teknik', promptStyle: 'brainstorming' };
  }
  if (lowerWorkflow.includes('prd') || lowerName.includes('gereksinim') || lowerName.includes('requirement')) {
    return { type: 'Gereksinim', promptStyle: 'prd' };
  }
  if (lowerWorkflow.includes('architect') || lowerName.includes('mimari') || lowerName.includes('pattern')) {
    return { type: 'Mimari Karar', promptStyle: 'architecture' };
  }
  if (lowerWorkflow.includes('ux') || lowerName.includes('tasarım') || lowerName.includes('design')) {
    return { type: 'UX Elementi', promptStyle: 'ux' };
  }
  if (lowerWorkflow.includes('epic') || lowerWorkflow.includes('story')) {
    return { type: 'Story', promptStyle: 'story' };
  }
  if (lowerWorkflow.includes('sprint')) {
    return { type: 'Sprint Öğesi', promptStyle: 'sprint' };
  }
  if (lowerWorkflow.includes('research') || lowerName.includes('araştırma')) {
    return { type: 'Araştırma Alanı', promptStyle: 'research' };
  }

  return { type: 'Öğe', promptStyle: 'generic' };
}

/**
 * Build prompt based on item type
 */
function buildItemPrompt(
  itemName: string,
  itemType: { type: string; promptStyle: string },
  context: ExecutionContext,
  previousContext: string
): { system: string; user: string } {
  const baseContext = `Proje: "${context.idea}"
Workflow: ${context.workflow.meta.name}

Önceki Bağlam:
${previousContext || 'Yok'}

---

`;

  switch (itemType.promptStyle) {
    case 'brainstorming':
      return {
        system: `Sen deneyimli bir beyin fırtınası ve yaratıcı düşünme uzmanısın.
"${itemName}" tekniğini kullanarak kapsamlı bir analiz yap.
Türkçe yanıt ver.`,
        user: baseContext + `"${itemName}" tekniğini "${context.idea}" projesi için uygula.

1. Tekniğin ana prensiplerini kısaca açıkla
2. Projeye özel olarak uygula (somut örneklerle)
3. Elde edilen fikirler ve bulgular
4. Önerilen aksiyon maddeleri

Detaylı ve pratik ol.`
      };

    case 'prd':
      return {
        system: `Sen deneyimli bir ürün yöneticisi ve gereksinim analistsin.
Fonksiyonel ve non-fonksiyonel gereksinimleri detaylı analiz edersin.
Türkçe yanıt ver.`,
        user: baseContext + `"${itemName}" gereksinimini "${context.idea}" projesi için detaylandır.

1. Gereksinimin kapsamı ve tanımı
2. Kabul kriterleri (testlenebilir maddeler)
3. Kullanıcı senaryoları
4. Bağımlılıklar ve önkoşullar
5. Öncelik (Must/Should/Could/Won't)

Somut ve ölçülebilir ol.`
      };

    case 'architecture':
      return {
        system: `Sen deneyimli bir yazılım mimarısın.
Mimari kararları ve pattern'leri detaylı analiz edersin.
Türkçe yanıt ver.`,
        user: baseContext + `"${itemName}" mimari yaklaşımını "${context.idea}" projesi için değerlendir.

1. Bu yaklaşımın tanımı ve prensipleri
2. Projeye uygunluk analizi
3. Avantajlar ve dezavantajlar
4. Uygulama stratejisi
5. Riskler ve azaltma yöntemleri

Teknik ve pratik ol.`
      };

    case 'ux':
      return {
        system: `Sen deneyimli bir UX tasarımcısısın.
Kullanıcı deneyimi ve arayüz tasarımı konusunda uzmansın.
Türkçe yanıt ver.`,
        user: baseContext + `"${itemName}" UX elementini "${context.idea}" projesi için tasarla.

1. Element tanımı ve amacı
2. Kullanıcı etkileşimi akışı
3. Görsel tasarım önerileri
4. Erişilebilirlik kriterleri
5. Responsive davranış

Kullanıcı odaklı ol.`
      };

    case 'story':
      return {
        system: `Sen deneyimli bir Agile koç ve product owner'sın.
User story ve epic yazımında uzmansın.
Türkçe yanıt ver.`,
        user: baseContext + `"${itemName}" hikayesini "${context.idea}" projesi için detaylandır.

1. User Story formatı (As a... I want... So that...)
2. Kabul kriterleri (Given/When/Then)
3. Story point tahmini
4. Alt görevler
5. Bağımlılıklar

INVEST kriterlerine uygun ol.`
      };

    case 'research':
      return {
        system: `Sen deneyimli bir araştırmacı ve analistsin.
Pazar, teknik ve domain araştırması konusunda uzmansın.
Türkçe yanıt ver.`,
        user: baseContext + `"${itemName}" araştırma alanını "${context.idea}" projesi için analiz et.

1. Araştırma kapsamı ve soruları
2. Mevcut durum analizi
3. Rakip/alternatif analizi
4. Fırsat ve tehditler
5. Öneriler ve sonuçlar

Veri odaklı ve objektif ol.`
      };

    default:
      return {
        system: `Sen deneyimli bir ürün geliştirme uzmanısın.
BMAD metodolojisini kullanarak kapsamlı analiz yaparsın.
Türkçe yanıt ver.`,
        user: baseContext + `"${itemName}" öğesini "${context.idea}" projesi için analiz et.

1. Tanım ve kapsam
2. Projeye uygulanması
3. Bulgular ve öneriler
4. Aksiyon maddeleri

Detaylı ve pratik ol.`
      };
  }
}

/**
 * Run a single technique/item and get output
 */
async function runTechnique(
  itemName: string,
  itemIndex: number,
  totalItems: number,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  const itemType = getItemType(itemName, context.workflow.meta.name);

  if (showOutput) {
    console.log('');
    console.log(`🔄 ${itemType.type} ${itemIndex + 1}/${totalItems}: ${itemName}`);
    console.log('┌' + '─'.repeat(58) + '┐');
    console.log(`│ 🤖 ${itemName.slice(0, 45)} Analizi:`.padEnd(59) + '│');
    console.log('└' + '─'.repeat(58) + '┘');
  }

  const previousContext = Array.from(context.previousOutputs.entries())
    .slice(-2)
    .map(([id, content]) => `### ${id}\n${content.slice(0, 1000)}`)
    .join('\n\n');

  const prompts = buildItemPrompt(itemName, itemType, context, previousContext);
  const output = await streamResponse(adapter, prompts.user, prompts.system, showOutput);

  if (showOutput) {
    console.log('────────────────────────────────────────────────────────────');
  }

  return output;
}

/**
 * Synthesize all technique outputs
 */
async function synthesizeTechniques(
  techniques: string[],
  outputs: string[],
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('📊 TÜM TEKNİKLERİN SENTEZİ');
    console.log('════════════════════════════════════════════════════════════');
  }

  const systemPrompt = `Sen deneyimli bir strateji ve sentez uzmanısın.
Birden fazla tekniğin sonuçlarını analiz edip kapsamlı bir sentez oluştur.
Türkçe yanıt ver.`;

  const techniquesWithOutputs = techniques.map((t, i) =>
    `### ${t}\n${outputs[i].slice(0, 1500)}`
  ).join('\n\n---\n\n');

  const prompt = `Proje: "${context.idea}"

Aşağıdaki ${techniques.length} tekniğin sonuçlarını sentezle:

${techniquesWithOutputs}

---

## Sentez Raporu Oluştur:

### 1. Ortak Bulgular
(Tüm tekniklerde tekrar eden temalar)

### 2. Benzersiz Perspektifler
(Her tekniğin getirdiği farklı bakış açıları)

### 3. Ana Çıkarımlar
(En önemli 5-7 sonuç)

### 4. Çelişkiler ve Gerilimler
(Varsa, farklı tekniklerin çelişen önerileri)

### 5. Önerilen Yol Haritası
(Tüm bulgulara dayanan somut adımlar)

### 6. Öncelikler
(Hangi bulgular en kritik)

Kapsamlı ve aksiyon odaklı ol. Türkçe yanıt ver.`;

  const synthesis = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  return synthesis;
}

/**
 * Run agent review - all relevant agents provide their perspective
 */
async function runAgentReview(
  stepOutput: string,
  stepName: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  const agents = getAgentsForPhase(context.phase);

  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║ 🎭 AGENT DEĞERLENDİRMESİ'.padEnd(59) + '║');
    console.log('║ ' + `${agents.length} uzman perspektifinden analiz`.padEnd(57) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  const agentFeedbacks: { agent: AgentPersona; feedback: string }[] = [];

  for (const agent of agents) {
    if (showOutput) {
      console.log('');
      console.log(`${agent.emoji} ${agent.name} (${agent.title}) değerlendiriyor...`);
      console.log('─'.repeat(60));
    }

    const systemPrompt = `Sen ${agent.name}, bir ${agent.title}'sın.
Rol: ${agent.role}
Uzmanlık alanların: ${agent.expertise.join(', ')}
Perspektif: ${agent.perspective}
İletişim tarzı: ${agent.communicationStyle}

Bu perspektiften değerlendirme yap. Kendi uzmanlık alanına odaklan.
Her zaman şu soruları düşün:
${agent.criticalQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Türkçe yanıt ver. Kısa ve öz ol (max 150 kelime).`;

    const prompt = `Proje: "${context.idea}"
Adım: ${stepName}
Workflow: ${context.workflow.meta.name}

Adım Çıktısı:
${stepOutput.slice(0, 3000)}

---

${agent.name} olarak bu çıktıyı değerlendir:

1. **Güçlü Yönler** (kendi uzmanlık alanından)
2. **Endişeler/Riskler** (kritik sorularına göre)
3. **Öneriler** (somut iyileştirmeler)

Kısa ve öz ol. Sadece kendi perspektifinden konuş.`;

    const feedback = await streamResponse(adapter, prompt, systemPrompt, showOutput);
    agentFeedbacks.push({ agent, feedback });
  }

  // Synthesize all agent feedbacks
  if (showOutput) {
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('📊 UZMAN GÖRÜŞLERİ SENTEZİ');
    console.log('════════════════════════════════════════════════════════════');
  }

  const synthesisPrompt = `Aşağıdaki ${agents.length} uzmanın görüşlerini sentezle:

${agentFeedbacks.map(({ agent, feedback }) =>
  `### ${agent.emoji} ${agent.name} (${agent.title})\n${feedback}`
).join('\n\n---\n\n')}

---

## Sentez Raporu:

### ✅ Konsensüs (Tüm uzmanların hemfikir olduğu noktalar)

### ⚠️ Kritik Endişeler (Öncelikli ele alınması gerekenler)

### 💡 Önerilen Aksiyonlar (Somut adımlar)

### 🔄 Sonraki Adım İçin Notlar

Kısa ve aksiyon odaklı ol. Türkçe yanıt ver.`;

  const synthesis = await streamResponse(
    adapter,
    synthesisPrompt,
    'Sen deneyimli bir proje yöneticisisin. Farklı uzman görüşlerini sentezleyip aksiyon planı oluştur.',
    showOutput
  );

  // Combine all feedbacks
  const fullReview = agentFeedbacks.map(({ agent, feedback }) =>
    `## ${agent.emoji} ${agent.name} (${agent.title})\n\n${feedback}`
  ).join('\n\n---\n\n') + '\n\n---\n\n# 📊 SENTEZ\n\n' + synthesis;

  return fullReview;
}

/**
 * Execute step in auto mode with ALL techniques (no user interaction)
 */
export async function executeStepAuto(
  step: ParsedStep,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<StepResult> {
  if (showOutput) {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log(`║ 📌 ADIM: ${step.meta.name}`.padEnd(59) + '║');
    if (step.meta.description) {
      console.log(`║    ${step.meta.description.slice(0, 50)}`.padEnd(59) + '║');
    }
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  // Build step content
  let stepContent = step.goal || '';
  for (const section of step.sections) {
    stepContent += `\n\n### ${section.title}\n${section.content}`;
  }

  // Extract techniques from step content
  const techniques = extractTechniques(stepContent);

  // If multiple techniques found, run ALL of them
  if (techniques.length >= 2) {
    if (showOutput) {
      console.log('');
      console.log(`🎯 ${techniques.length} teknik tespit edildi - HEPSİ çalıştırılacak:`);
      techniques.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
      console.log('');
    }

    const outputs: string[] = [];

    // Run each technique
    for (let i = 0; i < techniques.length; i++) {
      const output = await runTechnique(
        techniques[i],
        i,
        techniques.length,
        context,
        adapter,
        showOutput
      );
      outputs.push(output);
    }

    // Synthesize all outputs
    const synthesis = await synthesizeTechniques(
      techniques,
      outputs,
      context,
      adapter,
      showOutput
    );

    // Combine all outputs
    const fullOutput = techniques.map((t, i) =>
      `## ${t}\n\n${outputs[i]}`
    ).join('\n\n---\n\n') + '\n\n---\n\n# SENTEZ\n\n' + synthesis;

    // Run agent review on the output
    const agentReview = await runAgentReview(
      fullOutput,
      step.meta.name,
      context,
      adapter,
      showOutput
    );

    // Combine step output with agent review
    const finalOutput = fullOutput + '\n\n---\n\n# 🎭 UZMAN DEĞERLENDİRMESİ\n\n' + agentReview;

    if (showOutput) {
      console.log('');
      console.log(`✅ ${step.meta.name} tamamlandı (${techniques.length} teknik + sentez + ${getAgentsForPhase(context.phase).length} uzman değerlendirmesi)`);
    }

    return {
      success: true,
      output: finalOutput,
      userApproved: true,
      nextStep: step.meta.nextStepFile,
      iterations: techniques.length + 1 + getAgentsForPhase(context.phase).length + 1,
    };
  }

  // No multiple techniques, run standard step
  const systemPrompt = `Sen deneyimli bir ürün geliştirme uzmanısın. BMAD metodolojisini kullanıyorsun.
Bu adımı otomatik olarak tamamla. Kapsamlı ve detaylı çıktı üret.
Türkçe yanıt ver.`;

  const previousContext = Array.from(context.previousOutputs.entries())
    .slice(-2)
    .map(([id, content]) => `### ${id}\n${content.slice(0, 1500)}`)
    .join('\n\n');

  const prompt = `Proje: "${context.idea}"
Workflow: ${context.workflow.meta.name}
Adım: ${step.meta.name}
Açıklama: ${step.meta.description}

Önceki Çıktılar:
${previousContext || 'Yok'}

Adım İçeriği:
${stepContent}

---

Bu adımı tamamla. Tüm gereksinimleri karşıla. Türkçe ve detaylı yanıt ver.`;

  const output = await streamResponse(adapter, prompt, systemPrompt, showOutput);

  // Run agent review on the output
  const agentReview = await runAgentReview(
    output,
    step.meta.name,
    context,
    adapter,
    showOutput
  );

  // Combine step output with agent review
  const finalOutput = output + '\n\n---\n\n# 🎭 UZMAN DEĞERLENDİRMESİ\n\n' + agentReview;

  if (showOutput) {
    console.log('');
    console.log(`✅ ${step.meta.name} tamamlandı (1 adım + ${getAgentsForPhase(context.phase).length} uzman değerlendirmesi)`);
  }

  return {
    success: true,
    output: finalOutput,
    userApproved: true,
    nextStep: step.meta.nextStepFile,
    iterations: 1 + getAgentsForPhase(context.phase).length + 1,
  };
}
