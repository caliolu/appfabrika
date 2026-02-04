/**
 * BMAD Step Executor
 * Executes workflow steps interactively with AI + user interaction
 */

import * as p from '@clack/prompts';
import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import type {
  ParsedStep,
  StepSection,
  StepResult,
  ExecutionContext,
  MenuOption,
} from './types.js';

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
 * Handle A/P/C menu
 */
async function handleMenu(
  menuOptions: MenuOption[],
  currentContent: string,
  context: ExecutionContext,
  adapter: AnthropicAdapter
): Promise<{ action: string; content: string; continue: boolean }> {
  // Build menu options for prompt
  const options = [
    { value: 'approve', label: '✅ [C] Onayla ve devam et' },
    { value: 'revise', label: '✏️ Revize et (geri bildirim ver)' },
    { value: 'advanced', label: '🔬 [A] Gelişmiş Elicitation' },
    { value: 'party', label: '🎉 [P] Party Mode (çoklu bakış açısı)' },
    { value: 'regenerate', label: '🔄 Yeniden üret' },
    { value: 'skip', label: '⏭️ Bu adımı atla' },
  ];

  const choice = await p.select({
    message: 'Bu içerik için ne yapmak istersin?',
    options,
  });

  if (p.isCancel(choice)) {
    return { action: 'cancel', content: '', continue: false };
  }

  switch (choice) {
    case 'approve':
      return { action: 'approve', content: currentContent, continue: true };

    case 'revise': {
      const feedback = await p.text({
        message: 'Ne değişmeli? Geri bildirimini yaz:',
        placeholder: 'Örn: Daha fazla teknik detay ekle...',
      });

      if (p.isCancel(feedback)) {
        return { action: 'cancel', content: '', continue: false };
      }

      console.log('');
      p.log.info('✏️ Revize ediliyor...');

      const revisedContent = await streamResponse(
        adapter,
        `Mevcut içerik:
${currentContent}

Kullanıcı geri bildirimi: ${feedback}

Bu geri bildirime göre içeriği güncelle. Türkçe yanıt ver.`,
        'Sen deneyimli bir ürün geliştirme uzmanısın. İçeriği kullanıcı geri bildirimine göre güncelle.'
      );

      return { action: 'revise', content: revisedContent, continue: false };
    }

    case 'advanced': {
      console.log('');
      p.log.info('🔬 Gelişmiş Elicitation başlatılıyor...');

      const deepContent = await streamResponse(
        adapter,
        `Mevcut içerik:
${currentContent}

Bu içeriği derinleştir:
1. Eksik kalan noktaları tespit et
2. Alternatif yaklaşımlar öner
3. Risk ve fırsatları analiz et
4. Daha fazla soru sor

Türkçe yanıt ver.`,
        'Sen bir Gelişmiş Elicitation uzmanısın. İçeriği derinleştir ve eksikleri tespit et.'
      );

      return { action: 'advanced', content: deepContent, continue: false };
    }

    case 'party': {
      console.log('');
      p.log.info('🎉 Party Mode - Farklı bakış açıları...');

      const partyContent = await streamResponse(
        adapter,
        `Mevcut içerik:
${currentContent}

Farklı rollerdeki uzmanların bakış açısıyla değerlendir:
1. 📊 Analist: Veri ve metrik odaklı değerlendirme
2. 🎨 UX Tasarımcı: Kullanıcı deneyimi perspektifi
3. 🏗️ Mimar: Teknik fizibilite değerlendirmesi
4. 📋 PM: İş değeri ve önceliklendirme
5. 💻 Geliştirici: Uygulama zorluğu analizi

Her perspektiften kısa bir yorum yap. Türkçe yanıt ver.`,
        'Sen bir moderatörsün. Farklı uzman rollerini simüle ederek içeriği değerlendir.'
      );

      return { action: 'party', content: partyContent, continue: false };
    }

    case 'regenerate': {
      console.log('');
      p.log.info('🔄 Yeniden üretiliyor...');
      return { action: 'regenerate', content: '', continue: false };
    }

    case 'skip':
      return { action: 'skip', content: 'Atlandı', continue: true };

    default:
      return { action: 'unknown', content: currentContent, continue: false };
  }
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

  // If multiple techniques found, ask user how to proceed
  if (techniques.length >= 2) {
    console.log('');
    console.log(`🎯 ${techniques.length} teknik tespit edildi:`);
    techniques.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
    console.log('');

    const runChoice = await p.select({
      message: 'Bu tekniklerle ne yapmak istersin?',
      options: [
        { value: 'all', label: '🚀 Hepsini çalıştır ve sentezle (önerilen)' },
        { value: 'select', label: '🎯 Bazılarını seç' },
        { value: 'one', label: '1️⃣ Sadece birini seç' },
        { value: 'skip', label: '⏭️ Bu adımı atla' },
      ],
    });

    if (p.isCancel(runChoice)) {
      return { success: false, output: '', userApproved: false, iterations };
    }

    if (runChoice === 'skip') {
      return { success: true, output: 'Atlandı', userApproved: false, nextStep: step.meta.nextStepFile, iterations };
    }

    let selectedTechniques = techniques;

    if (runChoice === 'select') {
      // Multi-select
      const selected = await p.multiselect({
        message: 'Hangi teknikleri çalıştırmak istersin?',
        options: techniques.map((t, i) => ({ value: i.toString(), label: `${i + 1}. ${t}` })),
      });

      if (p.isCancel(selected)) {
        return { success: false, output: '', userApproved: false, iterations };
      }

      selectedTechniques = (selected as string[]).map(i => techniques[parseInt(i)]);
    } else if (runChoice === 'one') {
      // Single select
      const selected = await p.select({
        message: 'Hangi tekniği çalıştırmak istersin?',
        options: techniques.map((t, i) => ({ value: i.toString(), label: `${i + 1}. ${t}` })),
      });

      if (p.isCancel(selected)) {
        return { success: false, output: '', userApproved: false, iterations };
      }

      selectedTechniques = [techniques[parseInt(selected as string)]];
    }

    // Run selected techniques
    const outputs: string[] = [];

    for (let i = 0; i < selectedTechniques.length; i++) {
      const output = await runTechnique(
        selectedTechniques[i],
        i,
        selectedTechniques.length,
        context,
        adapter,
        true
      );
      outputs.push(output);
      iterations++;
    }

    // Synthesize if multiple
    if (selectedTechniques.length > 1) {
      const synthesis = await synthesizeTechniques(
        selectedTechniques,
        outputs,
        context,
        adapter,
        true
      );
      iterations++;

      accumulatedContent = selectedTechniques.map((t, i) =>
        `## ${t}\n\n${outputs[i]}`
      ).join('\n\n---\n\n') + '\n\n---\n\n# SENTEZ\n\n' + synthesis;
    } else {
      accumulatedContent = `## ${selectedTechniques[0]}\n\n${outputs[0]}`;
    }
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
  }

  // Handle menu (A/P/C loop)
  while (!approved) {
    const menuResult = await handleMenu(
      step.menuOptions,
      accumulatedContent,
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
 */
function extractTechniques(content: string): string[] {
  const techniques: string[] = [];

  // Match numbered techniques like "1. SCAMPER", "**1. SCAMPER**", etc.
  const numberedPattern = /(?:\*\*)?(\d+)\.\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?(?:\s*[-–]\s*|\s*\()/g;
  let match;
  while ((match = numberedPattern.exec(content)) !== null) {
    const name = match[2].trim();
    if (name.length > 2 && name.length < 50) {
      techniques.push(name);
    }
  }

  // Match lettered options like "A) Option", "**A)** Option"
  const letteredPattern = /(?:\*\*)?([A-Z])\)(?:\*\*)?\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?(?:\s*[-–]|\n)/g;
  while ((match = letteredPattern.exec(content)) !== null) {
    const name = match[2].trim();
    if (name.length > 2 && name.length < 50 && !techniques.includes(name)) {
      techniques.push(name);
    }
  }

  // Match bold headers like "**SCAMPER Yöntemi**"
  const boldPattern = /\*\*([^*]+?(?:Yöntemi|Tekniği|Analizi|Düşünme|Yaklaşımı))\*\*/g;
  while ((match = boldPattern.exec(content)) !== null) {
    const name = match[1].trim();
    if (name.length > 2 && name.length < 50 && !techniques.includes(name)) {
      techniques.push(name);
    }
  }

  return techniques.slice(0, 10); // Max 10 techniques
}

/**
 * Run a single technique and get output
 */
async function runTechnique(
  techniqueName: string,
  techniqueIndex: number,
  totalTechniques: number,
  context: ExecutionContext,
  adapter: AnthropicAdapter,
  showOutput: boolean = true
): Promise<string> {
  if (showOutput) {
    console.log('');
    console.log(`🔄 Teknik ${techniqueIndex + 1}/${totalTechniques}: ${techniqueName}`);
    console.log('┌' + '─'.repeat(58) + '┐');
    console.log(`│ 🤖 ${techniqueName} Analizi:`.padEnd(59) + '│');
    console.log('└' + '─'.repeat(58) + '┘');
  }

  const systemPrompt = `Sen deneyimli bir ürün geliştirme ve beyin fırtınası uzmanısın.
"${techniqueName}" tekniğini kullanarak kapsamlı bir analiz yap.
Bu tekniğin tüm adımlarını uygula ve somut sonuçlar üret.
Türkçe yanıt ver.`;

  const previousContext = Array.from(context.previousOutputs.entries())
    .slice(-2)
    .map(([id, content]) => `### ${id}\n${content.slice(0, 1000)}`)
    .join('\n\n');

  const prompt = `Proje: "${context.idea}"

Önceki Bağlam:
${previousContext || 'Yok'}

---

"${techniqueName}" tekniğini "${context.idea}" projesi için uygula.

Bu tekniğin:
1. Ana prensiplerini açıkla
2. Projeye özel olarak uygula
3. Somut bulgular ve öneriler çıkar
4. Aksiyon maddeleri belirle

Detaylı ve pratik ol. Türkçe yanıt ver.`;

  const output = await streamResponse(adapter, prompt, systemPrompt, showOutput);

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

    if (showOutput) {
      console.log('');
      console.log(`✅ ${step.meta.name} tamamlandı (${techniques.length} teknik + sentez)`);
    }

    return {
      success: true,
      output: fullOutput,
      userApproved: true,
      nextStep: step.meta.nextStepFile,
      iterations: techniques.length + 1,
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

  if (showOutput) {
    console.log('');
    console.log(`✅ ${step.meta.name} tamamlandı`);
  }

  return {
    success: true,
    output,
    userApproved: true,
    nextStep: step.meta.nextStepFile,
    iterations: 1,
  };
}
