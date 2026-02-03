/**
 * Run Command
 * Executes the BMAD workflow for a project
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SpinnerService, getSpinnerService } from '../ui/spinner-service.js';
import { TerminalUI, getTerminalUI } from '../ui/terminal-ui.js';
import { ErrorDisplay, getErrorDisplay, ErrorAction } from '../ui/error-display.js';
import { CompletionScreen, getCompletionScreen } from '../ui/completion-screen.js';
import { ResumeService } from '../../services/resume-service.js';
import { CheckpointService } from '../../services/checkpoint-service.js';
import { BMAD_STEPS, BMAD_STEP_NAMES, BMAD_STEP_EMOJIS, BmadStepType } from '../../types/bmad.types.js';
import { AnthropicAdapter } from '../../adapters/llm/anthropic.adapter.js';
import { getSecretManager } from '../../core/secrets.js';
import type { ProjectConfig } from '../../types/project.types.js';

/**
 * Turkish messages for run command
 */
const RUN_MESSAGES = {
  WELCOME: '🚀 BMAD Workflow Başlatılıyor',
  NO_PROJECT: 'Bu dizinde AppFabrika projesi bulunamadı.',
  RUN_INIT_FIRST: 'Önce `appfabrika init` komutunu çalıştırın.',
  LOADING_CONFIG: 'Proje yapılandırması yükleniyor...',
  CONFIG_LOADED: 'Proje yüklendi',
  RESUME_PROMPT: 'Önceki çalışma yarıda kaldı. Devam etmek ister misiniz?',
  RESUME_YES: 'Kaldığı yerden devam et',
  RESUME_NO: 'Baştan başla',
  STARTING_STEP: 'Adım başlatılıyor',
  STEP_COMPLETE: 'tamamlandı',
  STEP_FAILED: 'başarısız',
  WORKFLOW_COMPLETE: 'Workflow tamamlandı!',
  WORKFLOW_FAILED: 'Workflow başarısız oldu.',
  MANUAL_STEP: 'Bu adım manuel tamamlanmalı.',
  PRESS_ENTER: 'Tamamladıktan sonra Enter\'a basın...',
  SKIPPING: 'Atlanıyor...',
  NO_API_KEY: 'Anthropic API anahtarı bulunamadı.',
  API_KEY_HELP: 'API anahtarınızı kaydetmek için:\n  echo "ANTHROPIC_API_KEY=sk-..." >> ~/.appfabrika/.env',
  STEP_CONFIG_INTRO: '📋 Adım Yapılandırması',
  STEP_CONFIG_DESC: 'Her adım için çalışma modunu seçin:',
  ALL_AUTO: '🤖 Tümünü Otomatik',
  ALL_MANUAL: '✋ Tümünü Manuel',
  CUSTOM: '⚙️ Özelleştir',
} as const;

/**
 * Step execution mode
 */
type StepMode = 'auto' | 'manual' | 'skip';

/**
 * Collect step preferences from user at the beginning
 */
async function collectStepPreferences(
  startStepIndex: number
): Promise<Map<BmadStepType, StepMode> | null> {
  const preferences = new Map<BmadStepType, StepMode>();

  console.log('');
  p.log.info(RUN_MESSAGES.STEP_CONFIG_INTRO);
  p.log.message(RUN_MESSAGES.STEP_CONFIG_DESC);
  console.log('');

  // First ask for bulk selection
  const bulkChoice = await p.select({
    message: 'Nasıl ilerlemek istersiniz?',
    options: [
      { value: 'all-auto', label: '🤖 Tüm adımları otomatik çalıştır' },
      { value: 'all-manual', label: '✋ Tüm adımları manuel tamamlayacağım' },
      { value: 'custom', label: '⚙️ Her adımı ayrı ayrı ayarla' },
    ],
  });

  if (p.isCancel(bulkChoice)) {
    return null;
  }

  // Apply bulk choice
  if (bulkChoice === 'all-auto') {
    for (let i = startStepIndex; i < BMAD_STEPS.length; i++) {
      preferences.set(BMAD_STEPS[i], 'auto');
    }
    return preferences;
  }

  if (bulkChoice === 'all-manual') {
    for (let i = startStepIndex; i < BMAD_STEPS.length; i++) {
      preferences.set(BMAD_STEPS[i], 'manual');
    }
    return preferences;
  }

  // Custom: ask for each step
  console.log('');
  p.log.info('Her adım için mod seçin:');
  console.log('');

  for (let i = startStepIndex; i < BMAD_STEPS.length; i++) {
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

  // Show summary
  console.log('');
  p.log.info('📊 Yapılandırma Özeti:');

  let autoCount = 0;
  let manualCount = 0;
  let skipCount = 0;

  for (const mode of preferences.values()) {
    if (mode === 'auto') autoCount++;
    else if (mode === 'manual') manualCount++;
    else if (mode === 'skip') skipCount++;
  }

  p.log.message(`   🤖 Otomatik: ${autoCount} adım`);
  p.log.message(`   ✋ Manuel: ${manualCount} adım`);
  p.log.message(`   ⏭️ Atlanan: ${skipCount} adım`);
  console.log('');

  const confirm = await p.confirm({
    message: 'Bu yapılandırma ile devam edilsin mi?',
  });

  if (p.isCancel(confirm) || !confirm) {
    return null;
  }

  return preferences;
}

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

  [BmadStepType.PRD]: (idea, context) => `Sen bir ürün gereksinimler analisti sin. Detaylı PRD (Product Requirements Document) oluştur:

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

Format: As a [user], I want [goal], so that [benefit]

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
 * Check if current directory is an AppFabrika project
 */
async function isAppFabrikaProject(projectPath: string): Promise<boolean> {
  const configPath = join(projectPath, '.appfabrika', 'config.json');
  return existsSync(configPath);
}

/**
 * Load project configuration
 */
async function loadProjectConfig(projectPath: string): Promise<ProjectConfig> {
  const configPath = join(projectPath, '.appfabrika', 'config.json');
  const content = await readFile(configPath, 'utf-8');
  return JSON.parse(content) as ProjectConfig;
}

/**
 * Get previous step outputs for context
 */
async function getPreviousStepContext(
  projectPath: string,
  currentStepIndex: number
): Promise<string> {
  const { readFile: fsReadFile } = await import('node:fs/promises');
  const checkpointsDir = join(projectPath, '.appfabrika', 'checkpoints');

  // Get last 2 completed steps for context
  const contextSteps = BMAD_STEPS.slice(Math.max(0, currentStepIndex - 2), currentStepIndex);
  const contexts: string[] = [];

  for (const stepId of contextSteps) {
    try {
      const checkpointPath = join(checkpointsDir, `${stepId}.json`);
      const content = await fsReadFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);
      if (checkpoint.output?.content) {
        const stepName = BMAD_STEP_NAMES[stepId];
        // Truncate to avoid token limits
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
 * Execute a BMAD step using real Anthropic API
 */
async function executeStep(
  stepId: BmadStepType,
  config: ProjectConfig,
  spinner: SpinnerService,
  adapter: AnthropicAdapter,
  projectPath: string,
  stepIndex: number
): Promise<{ success: boolean; output: string }> {
  const stepName = BMAD_STEP_NAMES[stepId];
  const emoji = BMAD_STEP_EMOJIS[stepId];

  spinner.updateText(`${emoji} ${stepName} çalışıyor...`);

  try {
    // Get context from previous steps
    const context = await getPreviousStepContext(projectPath, stepIndex);

    // Get the prompt for this step
    const promptFn = BMAD_STEP_PROMPTS[stepId];
    const prompt = promptFn(config.idea, context || undefined);

    spinner.updateText(`${emoji} ${stepName} - Claude ile iletişim kuruluyor...`);

    // Call Anthropic API with longer timeout
    const response = await adapter.complete(prompt, {
      maxTokens: 4096,
      timeout: 120000, // 2 minutes timeout for complex prompts
      systemPrompt: 'Sen bir deneyimli yazılım ürün geliştirme uzmanısın. BMAD (Build, Measure, Analyze, Decide) metodolojisini kullanarak proje geliştirme sürecinde yardımcı oluyorsun. Yanıtlarını Türkçe ver ve yapılandırılmış, anlaşılır format kullan.',
    });

    return {
      success: true,
      output: response.content,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      output: `Hata: ${errorMessage}`,
    };
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
  const { writeFile, mkdir } = await import('node:fs/promises');
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
 * Run command implementation
 */
export const runCommand = new Command('run')
  .description('BMAD workflow\'unu çalıştır')
  .option('-s, --step <step>', 'Belirli bir adımdan başla (1-12)')
  .option('-a, --auto', 'Tüm adımları otomatik çalıştır')
  .action(async (options) => {
    const projectPath = process.cwd();

    // Check if this is an AppFabrika project
    if (!await isAppFabrikaProject(projectPath)) {
      p.log.error(RUN_MESSAGES.NO_PROJECT);
      p.log.info(RUN_MESSAGES.RUN_INIT_FIRST);
      process.exit(1);
    }

    p.intro(RUN_MESSAGES.WELCOME);

    // Load project config
    const config = await loadProjectConfig(projectPath);
    p.log.success(`${RUN_MESSAGES.CONFIG_LOADED}: ${config.projectName}`);

    // Load API key and create adapter
    const secretManager = getSecretManager();
    const apiKey = await secretManager.getApiKey('anthropic');

    if (!apiKey) {
      p.log.error(RUN_MESSAGES.NO_API_KEY);
      p.log.info(RUN_MESSAGES.API_KEY_HELP);
      process.exit(1);
    }

    const adapter = new AnthropicAdapter({
      apiKey,
      model: 'claude-sonnet-4-20250514',
    });

    // Check for resumable checkpoint
    const resumeService = new ResumeService({ projectPath });
    const canResume = await resumeService.detectResumableState();

    let startStepIndex = 0;

    if (canResume && !options.auto) {
      const resumeInfo = await resumeService.getResumeInfo();

      const shouldResume = await p.confirm({
        message: `${RUN_MESSAGES.RESUME_PROMPT} (${resumeInfo.currentStepName})`,
      });

      if (p.isCancel(shouldResume)) {
        p.cancel('İptal edildi.');
        process.exit(0);
      }

      if (shouldResume) {
        const result = await resumeService.resumeWorkflow(
          // We'd need a state machine here, for now just get the step index
          { getCurrentStep: () => resumeInfo.currentStep } as any
        );
        startStepIndex = BMAD_STEPS.indexOf(result.startStep);
        p.log.info(`${resumeInfo.currentStepName} adımından devam ediliyor...`);
      } else {
        await resumeService.startFresh();
      }
    }

    // Parse --step option
    if (options.step) {
      const stepNum = parseInt(options.step, 10);
      if (stepNum >= 1 && stepNum <= 12) {
        startStepIndex = stepNum - 1;
      }
    }

    const terminalUI = getTerminalUI();
    const spinner = getSpinnerService();
    const errorDisplay = getErrorDisplay();
    const completionScreen = getCompletionScreen();

    const completedSteps: BmadStepType[] = [];
    const startTime = Date.now();

    // Collect step preferences upfront (unless --auto flag is used)
    let stepPreferences: Map<BmadStepType, StepMode> | null = null;

    if (!options.auto) {
      stepPreferences = await collectStepPreferences(startStepIndex);

      if (!stepPreferences) {
        p.cancel('İptal edildi.');
        process.exit(0);
      }
    } else {
      // --auto flag: set all to auto
      stepPreferences = new Map();
      for (let i = startStepIndex; i < BMAD_STEPS.length; i++) {
        stepPreferences.set(BMAD_STEPS[i], 'auto');
      }
    }

    console.log('');
    p.log.info('🚀 Workflow başlıyor...');

    // Execute workflow steps
    for (let i = startStepIndex; i < BMAD_STEPS.length; i++) {
      const stepId = BMAD_STEPS[i];
      const stepName = BMAD_STEP_NAMES[stepId];
      const emoji = BMAD_STEP_EMOJIS[stepId];
      const stepMode = stepPreferences.get(stepId) || 'auto';

      // Show current step
      console.log('');
      console.log(terminalUI.formatStepDisplay(stepId, { showNumber: true, showDescription: true }));

      // Handle skip mode
      if (stepMode === 'skip') {
        p.log.warn(`${emoji} ${stepName} atlandı`);
        continue;
      }

      // Handle manual mode
      if (stepMode === 'manual') {
        p.log.info(RUN_MESSAGES.MANUAL_STEP);
        await p.text({
          message: RUN_MESSAGES.PRESS_ENTER,
          placeholder: 'Enter\'a basın...',
        });

        await saveStepCheckpoint(projectPath, stepId, 'Manuel olarak tamamlandı');
        completedSteps.push(stepId);
        p.log.success(`${emoji} ${stepName} ${RUN_MESSAGES.STEP_COMPLETE}`);
        continue;
      }

      // Execute step automatically (auto mode)
      spinner.startStep(stepId);

      try {
        const result = await executeStep(stepId, config, spinner, adapter, projectPath, i);

        if (result.success) {
          await saveStepCheckpoint(projectPath, stepId, result.output);
          completedSteps.push(stepId);
          spinner.succeedStep(`${emoji} ${stepName} ${RUN_MESSAGES.STEP_COMPLETE}`);
        } else {
          spinner.failStep(`${emoji} ${stepName} ${RUN_MESSAGES.STEP_FAILED}`);

          // Show error and options
          console.log('');
          console.log(errorDisplay.render(new Error(result.output || 'Adım başarısız oldu'), {
            retryAttempts: 1,
            maxRetries: 3,
          }));
          p.log.error(`Hata detayı: ${result.output}`);

          const errorAction = await p.select({
            message: 'Ne yapmak istersiniz?',
            options: [
              { value: 'retry', label: '[R] Yeniden Dene' },
              { value: 'skip', label: '[S] Atla' },
              { value: 'quit', label: '[Q] Çıkış' },
            ],
          });

          if (errorAction === 'quit' || p.isCancel(errorAction)) {
            p.cancel('Workflow duraklatıldı.');
            process.exit(1);
          }

          if (errorAction === 'skip') {
            continue;
          }

          // Retry - decrement i to repeat this step
          i--;
        }
      } catch (error) {
        spinner.failStep(`${emoji} ${stepName} ${RUN_MESSAGES.STEP_FAILED}`);

        console.log('');
        console.log(errorDisplay.renderSimple(error));

        // Save checkpoint
        const checkpointService = new CheckpointService({ projectPath });
        await checkpointService.onErrorSaveCheckpoint(
          {
            projectPath,
            projectIdea: config.idea,
            llmProvider: config.llmProvider,
            automationTemplate: config.automationTemplate,
          },
          stepId,
          new Map(),
          new Map(),
          error,
          0
        );

        p.log.error('İlerleme kaydedildi. `appfabrika run` ile devam edebilirsiniz.');
        process.exit(1);
      }
    }

    // Show completion screen
    const duration = Date.now() - startTime;
    console.log('');
    console.log(completionScreen.render({
      projectName: config.projectName,
      localPath: projectPath,
      stats: {
        totalSteps: BMAD_STEPS.length,
        completedSteps: completedSteps.length,
        skippedSteps: BMAD_STEPS.length - completedSteps.length,
        durationMs: duration,
      },
    }));

    p.outro(RUN_MESSAGES.WORKFLOW_COMPLETE);
  });
