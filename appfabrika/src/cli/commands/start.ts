/**
 * Start Command
 * Single command that combines init + run into one seamless flow
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SpinnerService, getSpinnerService } from '../ui/spinner-service.js';
import { getCompletionScreen } from '../ui/completion-screen.js';
import { BMAD_STEPS, BMAD_STEP_NAMES, BMAD_STEP_EMOJIS, BmadStepType } from '../../types/bmad.types.js';
import { AnthropicAdapter } from '../../adapters/llm/anthropic.adapter.js';
import { getSecretManager } from '../../core/secrets.js';
import { runInteractiveStep } from './interactive-workflow.js';
import type { ProjectConfig, LLMProvider, AutomationTemplate } from '../../types/index.js';

/**
 * Workflow mode - quick (auto) or interactive (full conversation)
 */
type WorkflowMode = 'quick' | 'interactive';

/**
 * Turkish messages
 */
const MESSAGES = {
  WELCOME: '🏭 AppFabrika - Fikrinizi Ürüne Dönüştürün',
  IDEA_PROMPT: 'Proje fikrinizi tek cümlede açıklayın:',
  IDEA_PLACEHOLDER: 'örn: Restoran rezervasyon uygulaması',
  IDEA_REQUIRED: 'Proje fikri boş olamaz',
  NO_API_KEY: 'Anthropic API anahtarı bulunamadı.',
  API_KEY_HELP: 'API anahtarınızı kaydetmek için:\n  mkdir -p ~/.appfabrika && echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.appfabrika/.env',
  STEP_CONFIG: '📋 Adım Yapılandırması',
  WORKFLOW_START: '🚀 Workflow başlıyor...',
  STEP_COMPLETE: 'tamamlandı',
  MANUAL_STEP: 'Bu adım manuel tamamlanmalı.',
  PRESS_ENTER: 'Tamamladıktan sonra Enter\'a basın...',
  WORKFLOW_COMPLETE: 'Workflow tamamlandı!',
  MODE_SELECT: '🎯 Çalışma Modu',
  MODE_INTERACTIVE: '🎨 İnteraktif mod (her adımda seçenekler, geri bildirim, iterasyonlar)',
  MODE_QUICK: '⚡ Hızlı mod (otomatik çalıştır, minimal etkileşim)',
} as const;

/**
 * Step execution mode
 */
type StepMode = 'auto' | 'manual' | 'skip';

/**
 * BMAD step prompts for LLM
 */
const BMAD_STEP_PROMPTS: Record<BmadStepType, (idea: string, context?: string) => string> = {
  [BmadStepType.BRAINSTORMING]: (idea) => `Sen bir ürün geliştirme uzmanısın. Aşağıdaki ürün fikri için beyin fırtınası yap:

**Fikir:** ${idea}

Lütfen şunları analiz et:
1. Fikrin güçlü yönleri
2. Potansiyel zorluklar
3. Hedef kitle analizi
4. Benzersiz değer önerisi
5. İlk adımlar için öneriler

Türkçe yanıt ver.`,

  [BmadStepType.RESEARCH]: (idea, context) => `Sen bir pazar araştırması uzmanısın. Aşağıdaki ürün fikri için araştırma yap:

**Fikir:** ${idea}

**Önceki Analiz:**
${context || 'Yok'}

Lütfen şunları araştır:
1. Pazar büyüklüğü ve potansiyeli
2. Rakip analizi
3. Teknoloji trendleri
4. Kullanıcı ihtiyaçları
5. Giriş engelleri

Türkçe yanıt ver.`,

  [BmadStepType.PRODUCT_BRIEF]: (idea, context) => `Sen bir ürün yöneticisisin. Aşağıdaki ürün fikri için özet doküman oluştur:

**Fikir:** ${idea}

**Araştırma Sonuçları:**
${context || 'Yok'}

Lütfen şunları içeren bir ürün özeti oluştur:
1. Vizyon ve misyon
2. Problem tanımı
3. Çözüm önerisi
4. Hedef kitle
5. Başarı kriterleri
6. Kapsam ve sınırlar

Türkçe yanıt ver.`,

  [BmadStepType.PRD]: (idea, context) => `Sen bir ürün gereksinimler analisti sin. Detaylı PRD oluştur:

**Fikir:** ${idea}

**Ürün Özeti:**
${context || 'Yok'}

Lütfen şunları içeren bir PRD oluştur:
1. Fonksiyonel gereksinimler
2. Fonksiyonel olmayan gereksinimler
3. Kullanıcı senaryoları
4. Kabul kriterleri
5. Öncelikler (MoSCoW)
6. Teknik kısıtlamalar

Türkçe yanıt ver.`,

  [BmadStepType.UX_DESIGN]: (idea, context) => `Sen bir UX tasarımcısısın. Kullanıcı deneyimi tasarımı yap:

**Fikir:** ${idea}

**Gereksinimler:**
${context || 'Yok'}

Lütfen şunları tasarla:
1. Kullanıcı akışları
2. Ekran düzeni önerileri
3. Navigasyon yapısı
4. Etkileşim kalıpları
5. Erişilebilirlik notları

Türkçe yanıt ver.`,

  [BmadStepType.ARCHITECTURE]: (idea, context) => `Sen bir yazılım mimarısın. Sistem mimarisi tasarla:

**Fikir:** ${idea}

**Gereksinimler ve UX:**
${context || 'Yok'}

Lütfen şunları tasarla:
1. Sistem bileşenleri
2. Veri akışı
3. Teknoloji seçimleri
4. API tasarımı
5. Güvenlik mimarisi
6. Ölçeklenebilirlik planı

Türkçe yanıt ver.`,

  [BmadStepType.EPICS_STORIES]: (idea, context) => `Sen bir agile koçusun. Epic ve kullanıcı hikayeleri oluştur:

**Fikir:** ${idea}

**Mimari:**
${context || 'Yok'}

Lütfen şunları oluştur:
1. Ana Epic'ler
2. Her Epic için kullanıcı hikayeleri
3. Kabul kriterleri
4. Story point tahminleri
5. Bağımlılıklar

Türkçe yanıt ver.`,

  [BmadStepType.SPRINT_PLANNING]: (idea, context) => `Sen bir Scrum Master'sın. Sprint planlaması yap:

**Fikir:** ${idea}

**Epic ve Hikayeler:**
${context || 'Yok'}

Lütfen şunları planla:
1. Sprint 1 kapsamı
2. Sprint hedefleri
3. Görev dağılımı
4. Risk değerlendirmesi
5. Definition of Done

Türkçe yanıt ver.`,

  [BmadStepType.TECH_SPEC]: (idea, context) => `Sen bir teknik lidersin. Teknik şartname hazırla:

**Fikir:** ${idea}

**Mimari ve Sprint Planı:**
${context || 'Yok'}

Lütfen şunları belirle:
1. Detaylı teknik tasarım
2. Veritabanı şeması
3. API endpoint'leri
4. Entegrasyon noktaları
5. Test stratejisi
6. Deployment planı

Türkçe yanıt ver.`,

  [BmadStepType.DEVELOPMENT]: (idea, context) => `Sen bir kıdemli yazılım geliştiricisin. Geliştirme rehberi oluştur:

**Fikir:** ${idea}

**Teknik Şartname:**
${context || 'Yok'}

Lütfen şunları sağla:
1. Kod yapısı önerisi
2. Başlangıç kodu snippets
3. Best practice'ler
4. Kod standartları
5. Debugging ipuçları

Türkçe yanıt ver.`,

  [BmadStepType.CODE_REVIEW]: (idea, context) => `Sen bir kod inceleme uzmanısın. Kod inceleme kontrol listesi oluştur:

**Fikir:** ${idea}

**Geliştirme Notları:**
${context || 'Yok'}

Lütfen şunları kontrol et:
1. Kod kalitesi kriterleri
2. Güvenlik kontrolleri
3. Performans kontrolleri
4. Test coverage
5. Dokümantasyon

Türkçe yanıt ver.`,

  [BmadStepType.QA_TESTING]: (idea, context) => `Sen bir QA mühendisisin. Test planı oluştur:

**Fikir:** ${idea}

**Geliştirme ve İnceleme:**
${context || 'Yok'}

Lütfen şunları planla:
1. Test senaryoları
2. Test türleri (unit, integration, e2e)
3. Test verileri
4. Kabul testleri
5. Regresyon planı

Türkçe yanıt ver.`,
};

/**
 * Derives a kebab-case project name from the user's idea
 */
function deriveProjectName(idea: string): string {
  return idea
    .toLowerCase()
    .trim()
    .replace(/[ğ]/g, 'g')
    .replace(/[ü]/g, 'u')
    .replace(/[ş]/g, 's')
    .replace(/[ı]/g, 'i')
    .replace(/[ö]/g, 'o')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Collect step preferences from user
 */
async function collectStepPreferences(): Promise<Map<BmadStepType, StepMode> | null> {
  const preferences = new Map<BmadStepType, StepMode>();

  console.log('');
  p.log.info(MESSAGES.STEP_CONFIG);
  console.log('');

  const bulkChoice = await p.select({
    message: 'Adımlar nasıl çalıştırılsın?',
    options: [
      { value: 'all-auto', label: '🤖 Tüm adımları otomatik çalıştır (önerilen)' },
      { value: 'custom', label: '⚙️ Her adımı ayrı ayrı ayarla' },
    ],
  });

  if (p.isCancel(bulkChoice)) {
    return null;
  }

  if (bulkChoice === 'all-auto') {
    for (const stepId of BMAD_STEPS) {
      preferences.set(stepId, 'auto');
    }
    return preferences;
  }

  // Custom: ask for each step
  console.log('');
  for (let i = 0; i < BMAD_STEPS.length; i++) {
    const stepId = BMAD_STEPS[i];
    const stepName = BMAD_STEP_NAMES[stepId];
    const emoji = BMAD_STEP_EMOJIS[stepId];

    const choice = await p.select({
      message: `${emoji} ${i + 1}. ${stepName}`,
      options: [
        { value: 'auto', label: '🤖 Otomatik' },
        { value: 'manual', label: '✋ Manuel' },
        { value: 'skip', label: '⏭️ Atla' },
      ],
    });

    if (p.isCancel(choice)) {
      return null;
    }

    preferences.set(stepId, choice as StepMode);
  }

  return preferences;
}

/**
 * Get previous step outputs for context
 */
async function getPreviousStepContext(
  projectPath: string,
  currentStepIndex: number
): Promise<string> {
  const checkpointsDir = join(projectPath, '.appfabrika', 'checkpoints');
  const contextSteps = BMAD_STEPS.slice(Math.max(0, currentStepIndex - 2), currentStepIndex);
  const contexts: string[] = [];

  for (const stepId of contextSteps) {
    try {
      const checkpointPath = join(checkpointsDir, `${stepId}.json`);
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);
      if (checkpoint.output?.content) {
        const stepName = BMAD_STEP_NAMES[stepId];
        const truncated = checkpoint.output.content.slice(0, 2000);
        contexts.push(`### ${stepName}\n${truncated}`);
      }
    } catch {
      // Skip if checkpoint doesn't exist
    }
  }

  return contexts.join('\n\n');
}

/**
 * Execute a BMAD step with streaming
 */
async function executeStep(
  stepId: BmadStepType,
  idea: string,
  spinner: SpinnerService,
  adapter: AnthropicAdapter,
  projectPath: string,
  stepIndex: number
): Promise<{ success: boolean; output: string }> {
  const stepName = BMAD_STEP_NAMES[stepId];
  const emoji = BMAD_STEP_EMOJIS[stepId];

  try {
    const context = await getPreviousStepContext(projectPath, stepIndex);
    const promptFn = BMAD_STEP_PROMPTS[stepId];
    const prompt = promptFn(idea, context || undefined);

    const systemPrompt = 'Sen bir deneyimli yazılım ürün geliştirme uzmanısın. BMAD metodolojisini kullanarak proje geliştirme sürecinde yardımcı oluyorsun. Yanıtlarını Türkçe ver.';

    // Stop spinner and show streaming header
    spinner.stop();
    console.log('');
    console.log(`${emoji} ${stepName} - Claude yanıtlıyor...`);
    console.log('─'.repeat(50));
    console.log('');

    // Stream the response
    let fullContent = '';
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

    return { success: true, output: fullContent };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, output: `Hata: ${errorMessage}` };
  }
}

/**
 * Save step output to checkpoint
 */
async function saveStepCheckpoint(
  projectPath: string,
  stepId: BmadStepType,
  output: string
): Promise<void> {
  const checkpointsDir = join(projectPath, '.appfabrika', 'checkpoints');
  await mkdir(checkpointsDir, { recursive: true });

  const checkpoint = {
    stepId,
    status: 'completed',
    completedAt: new Date().toISOString(),
    output: { content: output },
  };

  const checkpointPath = join(checkpointsDir, `${stepId}.json`);
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

/**
 * Start command - combines init + run
 */
export const startCommand = new Command('start')
  .description('Yeni proje başlat ve BMAD workflow\'unu çalıştır')
  .option('-a, --auto', 'Tüm adımları otomatik çalıştır (hızlı mod)')
  .option('-i, --interactive', 'İnteraktif mod (seçenekler, geri bildirim, iterasyonlar)')
  .action(async (options) => {
    p.intro(MESSAGES.WELCOME);

    // Check API key first
    const secretManager = getSecretManager();
    const apiKey = await secretManager.getApiKey('anthropic');

    if (!apiKey) {
      p.log.error(MESSAGES.NO_API_KEY);
      p.log.info(MESSAGES.API_KEY_HELP);
      process.exit(1);
    }

    // Ask for project idea
    const idea = await p.text({
      message: MESSAGES.IDEA_PROMPT,
      placeholder: MESSAGES.IDEA_PLACEHOLDER,
      validate: (value) => {
        if (!value || !value.trim()) {
          return MESSAGES.IDEA_REQUIRED;
        }
      },
    });

    if (p.isCancel(idea)) {
      p.cancel('İptal edildi.');
      process.exit(0);
    }

    // Select workflow mode
    let workflowMode: WorkflowMode = 'quick';
    let stepPreferences: Map<BmadStepType, StepMode> = new Map();

    if (options.auto) {
      // --auto flag: quick mode, all steps auto
      workflowMode = 'quick';
      for (const stepId of BMAD_STEPS) {
        stepPreferences.set(stepId, 'auto');
      }
    } else if (options.interactive) {
      // --interactive flag: interactive mode
      workflowMode = 'interactive';
    } else {
      // Ask user for mode
      console.log('');
      p.log.info(MESSAGES.MODE_SELECT);

      const modeChoice = await p.select({
        message: 'Nasıl çalışmak istersiniz?',
        options: [
          {
            value: 'interactive',
            label: MESSAGES.MODE_INTERACTIVE,
            hint: 'Her adımda 3 seçenek sunar, geri bildirim alır, istediğiniz kadar revize eder',
          },
          {
            value: 'quick',
            label: MESSAGES.MODE_QUICK,
            hint: 'Tüm adımları otomatik çalıştırır, sonucu gösterir',
          },
        ],
      });

      if (p.isCancel(modeChoice)) {
        p.cancel('İptal edildi.');
        process.exit(0);
      }

      workflowMode = modeChoice as WorkflowMode;

      // For quick mode, collect step preferences
      if (workflowMode === 'quick') {
        const prefs = await collectStepPreferences();
        if (!prefs) {
          p.cancel('İptal edildi.');
          process.exit(0);
        }
        stepPreferences = prefs;
      }
    }

    // Create project folder
    const projectName = deriveProjectName(idea.trim());
    const projectPath = join(process.cwd(), projectName);

    if (existsSync(projectPath)) {
      p.log.warn(`Klasör zaten mevcut: ${projectName}`);
      const overwrite = await p.confirm({
        message: 'Üzerine yazılsın mı?',
      });
      if (p.isCancel(overwrite) || !overwrite) {
        p.cancel('İptal edildi.');
        process.exit(0);
      }
    }

    // Create folder structure
    const appfabrikaPath = join(projectPath, '.appfabrika');
    const checkpointsPath = join(appfabrikaPath, 'checkpoints');
    await mkdir(checkpointsPath, { recursive: true });

    // Save config
    const config: ProjectConfig = {
      version: '1.0.0',
      projectName,
      idea: idea.trim(),
      llmProvider: 'anthropic' as LLMProvider,
      automationTemplate: 'checkpoint' as AutomationTemplate,
      createdAt: new Date().toISOString(),
    };

    await writeFile(
      join(appfabrikaPath, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    p.log.success(`Proje oluşturuldu: ${projectName}`);

    // Create adapter
    const adapter = new AnthropicAdapter({
      apiKey,
      model: 'claude-sonnet-4-20250514',
    });

    console.log('');
    p.log.info(MESSAGES.WORKFLOW_START);
    console.log(`📌 Mod: ${workflowMode === 'interactive' ? 'İnteraktif' : 'Hızlı'}`);

    const spinner = getSpinnerService();
    const completionScreen = getCompletionScreen();
    const completedSteps: BmadStepType[] = [];
    const previousStepOutputs = new Map<BmadStepType, string>();
    const startTime = Date.now();
    let totalIterations = 0;

    // Execute workflow
    for (let i = 0; i < BMAD_STEPS.length; i++) {
      const stepId = BMAD_STEPS[i];
      const stepName = BMAD_STEP_NAMES[stepId];
      const emoji = BMAD_STEP_EMOJIS[stepId];

      if (workflowMode === 'interactive') {
        // INTERACTIVE MODE: Full conversational workflow
        const result = await runInteractiveStep(
          stepId,
          idea.trim(),
          adapter,
          previousStepOutputs
        );

        if (result.approved) {
          await saveStepCheckpoint(projectPath, stepId, result.finalOutput);
          previousStepOutputs.set(stepId, result.finalOutput);
          completedSteps.push(stepId);
          totalIterations += result.iterations;
        } else if (result.finalOutput === 'Atlandı') {
          console.log('');
          p.log.warn(`${emoji} ${stepName} atlandı`);
        } else {
          // User cancelled
          p.cancel('Workflow duraklatıldı.');
          process.exit(0);
        }
      } else {
        // QUICK MODE: Auto/manual/skip based on preferences
        const stepMode = stepPreferences.get(stepId) || 'auto';

        // Handle skip
        if (stepMode === 'skip') {
          console.log('');
          p.log.warn(`${emoji} ${stepName} atlandı`);
          continue;
        }

        // Handle manual
        if (stepMode === 'manual') {
          console.log('');
          p.log.info(`${emoji} ${stepName} - ${MESSAGES.MANUAL_STEP}`);
          await p.text({
            message: MESSAGES.PRESS_ENTER,
            placeholder: 'Enter\'a basın...',
          });
          await saveStepCheckpoint(projectPath, stepId, 'Manuel olarak tamamlandı');
          completedSteps.push(stepId);
          p.log.success(`${emoji} ${stepName} ${MESSAGES.STEP_COMPLETE}`);
          continue;
        }

        // Auto mode
        spinner.startStep(stepId);
        const result = await executeStep(stepId, idea.trim(), spinner, adapter, projectPath, i);

        if (result.success) {
          await saveStepCheckpoint(projectPath, stepId, result.output);
          previousStepOutputs.set(stepId, result.output);
          completedSteps.push(stepId);
          p.log.success(`${emoji} ${stepName} ${MESSAGES.STEP_COMPLETE}`);
        } else {
          p.log.error(`${emoji} ${stepName} başarısız: ${result.output}`);

          const action = await p.select({
            message: 'Ne yapmak istersiniz?',
            options: [
              { value: 'retry', label: '🔄 Yeniden dene' },
              { value: 'skip', label: '⏭️ Atla' },
              { value: 'quit', label: '🚪 Çıkış' },
            ],
          });

          if (p.isCancel(action) || action === 'quit') {
            p.cancel('Workflow duraklatıldı.');
            process.exit(1);
          }

          if (action === 'retry') {
            i--; // Retry this step
          }
        }
      }
    }

    // Show completion
    const duration = Date.now() - startTime;
    console.log('');
    console.log(completionScreen.render({
      projectName,
      localPath: projectPath,
      stats: {
        totalSteps: BMAD_STEPS.length,
        completedSteps: completedSteps.length,
        skippedSteps: BMAD_STEPS.length - completedSteps.length,
        durationMs: duration,
      },
    }));

    if (workflowMode === 'interactive' && totalIterations > 0) {
      console.log(`📊 Toplam iterasyon: ${totalIterations}`);
    }

    p.outro(MESSAGES.WORKFLOW_COMPLETE);
  });
