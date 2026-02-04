/**
 * BMAD Phase Orchestrator
 * Manages execution of all BMAD phases and workflows
 * Integrated with logging, token tracking, and caching
 */

import * as p from '@clack/prompts';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { AnthropicAdapter } from '../adapters/llm/anthropic.adapter.js';
import {
  BMAD_PHASES,
  BmadPhase,
  type PhaseDefinition,
  type WorkflowDefinition,
  type ExecutionContext,
  type WorkflowState,
  type ParsedWorkflow,
} from './types.js';
import { parseWorkflow, findBmadRoot } from './parser.js';
import { executeStep, executeStepAuto, generateWorkflowSummary } from './executor.js';
import {
  runPartyMode,
  generateDiagram,
  documentProject,
  type DiagramType,
} from './features.js';
import {
  generateProjectScaffolding,
  calculatePRDQuality,
  calculateArchitectureQuality,
  runAdversarialReview,
  editorialReviewProse,
  editorialReviewStructure,
  quickSpec,
  quickDev,
  getHelp,
  indexDocs,
  shardDoc,
} from './advanced-features.js';
import {
  runQualityGate,
  reviewAndFixLoop,
  generateAndWriteCode,
  generateAPIFiles,
  generateTestFiles,
  canWorkflowProceed,
  improveUntilPass,
  type QualityGateResult,
} from './workflow-engine.js';
import { logger } from './logger.js';
import { tokenTracker } from './token-tracker.js';
import { cache } from './cache.js';
import { loadBmadConfig, getConfig } from './config-loader.js';

/**
 * Workflow selection mode
 */
type WorkflowMode = 'all' | 'required' | 'custom';

/**
 * Execution mode
 */
type ExecutionMode = 'interactive' | 'auto';

/**
 * Workflow selection mode
 */
type SelectionMode = 'full' | 'required';

/**
 * Orchestrator configuration
 */
interface OrchestratorConfig {
  bmadRoot: string;
  projectPath: string;
  projectName: string;
  idea: string;
  adapter: AnthropicAdapter;
  mode: ExecutionMode;
  selectionMode?: SelectionMode;
}

/**
 * Phase Orchestrator class
 */
export class BmadOrchestrator {
  private config: OrchestratorConfig;
  private completedWorkflows: Set<string> = new Set();
  private workflowOutputs: Map<string, string> = new Map();
  private workflowScores: Map<string, number> = new Map();
  private currentPhase: BmadPhase = BmadPhase.ANALYSIS;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    // Initialize logging context
    logger.info('BMAD Orchestrator başlatıldı', {
      projectName: config.projectName,
      mode: config.mode,
    });
  }

  /**
   * Initialize utilities (config, cache, etc.)
   */
  async init(): Promise<void> {
    // Load BMAD config
    await loadBmadConfig(this.config.bmadRoot);
    const bmadConfig = getConfig();
    logger.info('BMAD config yüklendi', {
      userName: bmadConfig.user_name,
      language: bmadConfig.communication_language,
    });

    // Initialize cache
    await cache.init();
    logger.debug('Cache başlatıldı');
  }

  /**
   * Display phase overview
   */
  private displayPhaseOverview(): void {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           🏭 BMAD FULL WORKFLOW                              ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');

    for (const phase of BMAD_PHASES) {
      console.log(`║ ${phase.emoji} ${phase.name.padEnd(15)} │ ${phase.workflows.length} workflow`.padEnd(63) + '║');
      for (const workflow of phase.workflows) {
        const req = workflow.required ? '⚠️' : '  ';
        console.log(`║   ${req} ${workflow.name.padEnd(25)} │ ${workflow.stepCount} adım`.padEnd(60) + '║');
      }
      console.log('╟──────────────────────────────────────────────────────────────╢');
    }

    const totalSteps = BMAD_PHASES.reduce(
      (t, p) => t + p.workflows.reduce((wt, w) => wt + w.stepCount, 0),
      0
    );
    console.log(`║ Toplam: ${totalSteps} adım`.padEnd(63) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
  }

  /**
   * Select which workflows to run
   */
  private async selectWorkflows(): Promise<WorkflowDefinition[] | null> {
    // If selection mode is 'required', skip the selection UI
    if (this.config.selectionMode === 'required') {
      const requiredWorkflows = BMAD_PHASES.flatMap(phase =>
        phase.workflows.filter(w => w.required)
      );

      console.log('');
      p.log.info(`📋 Zorunlu workflow'lar otomatik seçildi (${requiredWorkflows.length} workflow)`);

      for (const wf of requiredWorkflows) {
        console.log(`   ${wf.agentEmoji} ${wf.name} (${wf.stepCount} adım)`);
      }

      return requiredWorkflows;
    }

    this.displayPhaseOverview();

    const modeChoice = await p.select({
      message: 'Hangi workflow\'ları çalıştırmak istersin?',
      options: [
        {
          value: 'all',
          label: '🎯 Tümü (önerilen)',
          hint: 'Tüm fazlar ve tüm workflow\'lar',
        },
        {
          value: 'required',
          label: '⚡ Sadece zorunlular',
          hint: 'Zorunlu workflow\'lar (PRD, Architecture, vb.)',
        },
        {
          value: 'custom',
          label: '⚙️ Özel seçim',
          hint: 'İstediğin workflow\'ları seç',
        },
        {
          value: 'phase',
          label: '📦 Faz bazlı seç',
          hint: 'Belirli bir fazı seç',
        },
      ],
    });

    if (p.isCancel(modeChoice)) {
      return null;
    }

    if (modeChoice === 'all') {
      return BMAD_PHASES.flatMap(phase => phase.workflows);
    }

    if (modeChoice === 'required') {
      return BMAD_PHASES.flatMap(phase =>
        phase.workflows.filter(w => w.required)
      );
    }

    if (modeChoice === 'phase') {
      const phaseChoice = await p.select({
        message: 'Hangi fazı çalıştırmak istersin?',
        options: BMAD_PHASES.map(phase => ({
          value: phase.phase,
          label: `${phase.emoji} ${phase.name}`,
          hint: `${phase.workflows.length} workflow`,
        })),
      });

      if (p.isCancel(phaseChoice)) {
        return null;
      }

      const selectedPhase = BMAD_PHASES.find(p => p.phase === phaseChoice);
      return selectedPhase?.workflows || [];
    }

    // Custom selection
    const selectedWorkflows: WorkflowDefinition[] = [];

    for (const phase of BMAD_PHASES) {
      console.log('');
      p.log.info(`${phase.emoji} ${phase.name}`);

      for (const workflow of phase.workflows) {
        const include = await p.confirm({
          message: `${workflow.agentEmoji} ${workflow.name} (${workflow.stepCount} adım)${workflow.required ? ' ⚠️ Zorunlu' : ''}`,
          initialValue: workflow.required,
        });

        if (p.isCancel(include)) {
          return null;
        }

        if (include) {
          selectedWorkflows.push(workflow);
        }
      }
    }

    return selectedWorkflows;
  }

  /**
   * Execute a single workflow
   */
  private async executeWorkflow(
    workflow: WorkflowDefinition
  ): Promise<boolean> {
    console.log('');
    console.log('┌' + '─'.repeat(58) + '┐');
    console.log(`│ ${workflow.agentEmoji} ${workflow.name}`.padEnd(59) + '│');
    console.log(`│ ${workflow.description}`.padEnd(59) + '│');
    console.log(`│ Adım sayısı: ${workflow.stepCount}`.padEnd(59) + '│');
    console.log('└' + '─'.repeat(58) + '┘');

    // Check workflow dependencies before starting
    const dependencyCheck = canWorkflowProceed(
      workflow.id,
      this.completedWorkflows,
      this.workflowScores
    );

    if (!dependencyCheck.canProceed) {
      console.log('');
      p.log.warn(`⚠️ Workflow başlatılamıyor: ${dependencyCheck.reason}`);

      if (dependencyCheck.blockers.length > 0) {
        console.log('📋 Engelleyen workflow\'lar:');
        for (const blocker of dependencyCheck.blockers) {
          console.log(`   - ${blocker}`);
        }
      }

      if (this.config.mode === 'interactive') {
        const forceRun = await p.confirm({
          message: 'Yine de çalıştırmak ister misin? (önerilmez)',
          initialValue: false,
        });

        if (p.isCancel(forceRun) || !forceRun) {
          return false;
        }
        p.log.warn('⚠️ Bağımlılık kontrolü atlanarak devam ediliyor...');
      } else {
        p.log.error('Otomatik modda bağımlılık hatası nedeniyle workflow atlanıyor.');
        return false;
      }
    }

    try {
      // Handle special workflows (Party Mode, Diagrams, Document Project)
      if (workflow.id.startsWith('party-mode')) {
        return await this.executePartyMode(workflow);
      }

      if (workflow.id.startsWith('create-') && workflow.path.includes('excalidraw')) {
        return await this.executeDiagramWorkflow(workflow);
      }

      if (workflow.id === 'document-project') {
        return await this.executeDocumentProject(workflow);
      }

      if (workflow.id === 'code-scaffolding') {
        return await this.executeCodeScaffolding(workflow);
      }

      if (workflow.id === 'adversarial-review') {
        return await this.executeAdversarialReview(workflow);
      }

      if (workflow.id === 'quality-validation') {
        return await this.executeQualityValidation(workflow);
      }

      if (workflow.id === 'quick-spec') {
        return await this.executeQuickSpec(workflow);
      }

      if (workflow.id === 'quick-dev') {
        return await this.executeQuickDev(workflow);
      }

      if (workflow.id === 'editorial-review') {
        return await this.executeEditorialReview(workflow);
      }

      // Brainstorming workflow
      if (workflow.id === 'brainstorming') {
        return await this.executeBrainstorming(workflow);
      }

      // Research workflows
      if (workflow.id.includes('research')) {
        return await this.executeResearch(workflow);
      }

      // Sprint status workflow
      if (workflow.id === 'sprint-status') {
        return await this.executeSprintStatus(workflow);
      }

      // Correct course workflow
      if (workflow.id === 'correct-course') {
        return await this.executeCorrectCourse(workflow);
      }

      // Check implementation readiness workflow
      if (workflow.id === 'check-implementation-readiness') {
        return await this.executeCheckReadiness(workflow);
      }

      const parsedWorkflow = await parseWorkflow(
        workflow.path,
        this.config.bmadRoot
      );

      // Build execution context
      const context: ExecutionContext = {
        projectName: this.config.projectName,
        projectPath: this.config.projectPath,
        idea: this.config.idea,
        phase: parsedWorkflow.meta.phase,
        workflow: parsedWorkflow,
        state: {
          workflowId: workflow.id,
          currentStepIndex: 0,
          completedSteps: [],
          outputs: new Map(),
          startedAt: new Date(),
          lastUpdatedAt: new Date(),
        },
        previousOutputs: this.workflowOutputs,
        userPreferences: new Map(),
      };

      // Execute each step
      let stepIndex = 0;
      let workflowOutput = '';
      const isAutoMode = this.config.mode === 'auto';

      for (const step of parsedWorkflow.steps) {
        stepIndex++;
        console.log('');
        p.log.info(`Adım ${stepIndex}/${parsedWorkflow.steps.length}`);

        // Use auto or interactive execution based on mode
        const result = isAutoMode
          ? await executeStepAuto(step, context, this.config.adapter)
          : await executeStep(step, context, this.config.adapter);

        if (!result.success) {
          p.log.error(`Adım başarısız: ${step.meta.name}`);

          if (isAutoMode) {
            // In auto mode, log and continue
            p.log.warn('Otomatik modda devam ediliyor...');
          } else {
            const action = await p.select({
              message: 'Ne yapmak istersin?',
              options: [
                { value: 'retry', label: '🔄 Yeniden dene' },
                { value: 'skip', label: '⏭️ Bu adımı atla' },
                { value: 'abort', label: '🛑 Workflow\'u iptal et' },
              ],
            });

            if (p.isCancel(action) || action === 'abort') {
              return false;
            }

            if (action === 'retry') {
              stepIndex--; // Retry this step
              continue;
            }
          }
        }

        workflowOutput += `\n\n## ${step.meta.name}\n${result.output}`;
        context.state.completedSteps.push(step.meta.name);
        context.state.lastUpdatedAt = new Date();

        // Save checkpoint
        await this.saveCheckpoint(workflow.id, stepIndex, workflowOutput);
      }

      // Generate workflow summary
      console.log('');
      p.log.info('📊 Workflow özeti oluşturuluyor...');

      const summary = await generateWorkflowSummary(
        workflow.name,
        workflow.description,
        workflowOutput,
        context,
        this.config.adapter
      );

      // Append summary to workflow output
      const finalOutput = workflowOutput + '\n\n---\n\n# ÖZET\n' + summary;

      // In interactive mode, show summary and ask for approval
      if (!isAutoMode) {
        const approved = await p.confirm({
          message: 'Bu özet sonraki workflow\'lara aktarılacak. Onaylıyor musun?',
          initialValue: true,
        });

        if (p.isCancel(approved) || !approved) {
          p.log.warn('Özet onaylanmadı, yeniden düzenleme gerekebilir.');
        }
      }

      // Mark workflow as complete
      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, finalOutput);

      // Save final output to docs folder
      await this.saveWorkflowOutput(workflow.id, workflow.name, finalOutput);

      // Run quality gate for this workflow
      console.log('');
      p.log.info('🔍 Kalite kapısı kontrolü yapılıyor...');

      const qualityResult = await runQualityGate(
        workflow.id,
        finalOutput,
        this.config.adapter,
        true
      );

      // Store the quality score
      this.workflowScores.set(workflow.id, qualityResult.result.score);

      // Show quality result
      if (qualityResult.result.passed) {
        p.log.success(`✅ Kalite kapısı geçildi! (${qualityResult.result.score}/100 - Min: ${qualityResult.result.minimumRequired})`);
      } else {
        p.log.warn(`⚠️ Kalite kapısı geçilemedi (${qualityResult.result.score}/100 - Min: ${qualityResult.result.minimumRequired})`);

        // Show issues
        if (qualityResult.result.issues.length > 0) {
          console.log('\n📋 Tespit edilen sorunlar:');
          for (const issue of qualityResult.result.issues.slice(0, 5)) {
            console.log(`   - [${issue.severity}] ${issue.message}`);
          }
        }

        // In interactive mode, ask if user wants to improve
        if (!isAutoMode) {
          const improveNow = await p.confirm({
            message: 'İçeriği iyileştirmek ister misin?',
            initialValue: true,
          });

          if (!p.isCancel(improveNow) && improveNow) {
            p.log.info('🔄 İçerik iyileştiriliyor...');

            const improveResult = await reviewAndFixLoop(
              finalOutput,
              workflow.id.includes('prd') ? 'prd' : workflow.id.includes('arch') ? 'architecture' : 'general',
              this.config.adapter,
              3,
              true
            );

            // Update output with improved version
            const improvedOutput = improveResult.finalContent;
            this.workflowOutputs.set(workflow.id, improvedOutput);
            await this.saveWorkflowOutput(workflow.id, workflow.name, improvedOutput);

            p.log.success(`✅ İçerik ${improveResult.iterations} iterasyonda iyileştirildi!`);
          }
        } else {
          // Auto mode: automatically try to improve if score is too low
          if (qualityResult.result.score < qualityResult.result.minimumRequired * 0.8) {
            p.log.info('🔄 Otomatik iyileştirme başlatılıyor...');

            const improveResult = await improveUntilPass(
              finalOutput,
              workflow.id,
              this.config.adapter,
              5,
              true
            );

            if (improveResult.passed) {
              this.workflowOutputs.set(workflow.id, improveResult.content);
              this.workflowScores.set(workflow.id, improveResult.finalScore);
              await this.saveWorkflowOutput(workflow.id, workflow.name, improveResult.content);
              p.log.success(`✅ İçerik otomatik iyileştirildi! (${improveResult.finalScore}/100)`);
            }
          }
        }
      }

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      console.log('');
      console.log('📄 Çıktı kaydedildi: docs/' + workflow.id + '.md');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Workflow hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Party Mode workflow
   */
  private async executePartyMode(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      // Determine topic based on workflow phase
      let topic = '';
      if (workflow.id.includes('analysis')) {
        topic = `${this.config.idea} - Analiz bulgularını değerlendirelim. Pazar fırsatları, riskler ve ürün stratejisi hakkında ne düşünüyorsunuz?`;
      } else if (workflow.id.includes('planning')) {
        topic = `${this.config.idea} - PRD ve UX planını inceleyelim. Gereksinimler yeterli mi? UX akışları mantıklı mı?`;
      } else if (workflow.id.includes('solutioning')) {
        topic = `${this.config.idea} - Mimari kararları ve epic/story planını değerlendirelim. Teknik yaklaşım doğru mu?`;
      } else if (workflow.id.includes('retrospective')) {
        topic = `${this.config.idea} - Uygulama sürecini değerlendirelim. Ne iyi gitti? Ne daha iyi olabilirdi?`;
      } else {
        topic = `${this.config.idea} - Genel değerlendirme`;
      }

      // Build minimal context for party mode
      const previousContext = Array.from(this.workflowOutputs.entries())
        .slice(-3)
        .map(([id, content]) => `### ${id}\n${content.slice(0, 1000)}`)
        .join('\n\n');

      const result = await runPartyMode(
        {
          topic: topic + '\n\nÖnceki Çalışmalar:\n' + previousContext,
          context: {
            projectName: this.config.projectName,
            projectPath: this.config.projectPath,
            idea: this.config.idea,
            phase: this.currentPhase,
            workflow: { meta: { name: workflow.name, description: workflow.description, phase: this.currentPhase, order: 0, required: true }, steps: [], currentStepIndex: 0 },
            state: { workflowId: workflow.id, currentStepIndex: 0, completedSteps: [], outputs: new Map(), startedAt: new Date(), lastUpdatedAt: new Date() },
            previousOutputs: this.workflowOutputs,
            userPreferences: new Map(),
          },
          rounds: 2,
        },
        this.config.adapter,
        true
      );

      // Save output
      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, result.discussion);
      await this.saveWorkflowOutput(workflow.id, workflow.name, result.discussion);

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      console.log('📄 Çıktı kaydedildi: docs/' + workflow.id + '.md');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Party Mode hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Diagram workflow
   */
  private async executeDiagramWorkflow(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      // Determine diagram type from workflow id
      let diagramType: DiagramType = 'architecture';
      if (workflow.id.includes('wireframe')) diagramType = 'wireframe';
      else if (workflow.id.includes('flowchart')) diagramType = 'flowchart';
      else if (workflow.id.includes('dataflow')) diagramType = 'dataflow';
      else if (workflow.id.includes('erd')) diagramType = 'erd';

      const context = {
        projectName: this.config.projectName,
        projectPath: this.config.projectPath,
        idea: this.config.idea,
        phase: this.currentPhase,
        workflow: { meta: { name: workflow.name, description: workflow.description, phase: this.currentPhase, order: 0, required: true }, steps: [], currentStepIndex: 0 },
        state: { workflowId: workflow.id, currentStepIndex: 0, completedSteps: [], outputs: new Map(), startedAt: new Date(), lastUpdatedAt: new Date() },
        previousOutputs: this.workflowOutputs,
        userPreferences: new Map(),
      };

      const result = await generateDiagram(
        {
          type: diagramType,
          title: `${this.config.projectName} - ${workflow.name}`,
          description: workflow.description,
          context,
        },
        this.config.adapter,
        true
      );

      // Save both JSON and markdown
      const diagramsDir = join(this.config.projectPath, 'docs', 'diagrams');
      await mkdir(diagramsDir, { recursive: true });

      // Save Excalidraw JSON
      const jsonPath = join(diagramsDir, `${workflow.id}.excalidraw`);
      await writeFile(jsonPath, JSON.stringify(result.json, null, 2), 'utf-8');

      // Save markdown description
      const output = `# ${workflow.name}\n\n${result.markdown}\n\n---\n\n📊 Excalidraw dosyası: diagrams/${workflow.id}.excalidraw`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      console.log('📄 Çıktı kaydedildi: docs/' + workflow.id + '.md');
      console.log('📊 Diyagram kaydedildi: docs/diagrams/' + workflow.id + '.excalidraw');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Diyagram hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Document Project workflow
   */
  private async executeDocumentProject(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      const analysis = await documentProject(
        this.config.projectPath,
        this.config.adapter,
        true
      );

      const output = `# Proje Dokümantasyonu

## Genel Bakış
${analysis.overview}

## Mimari
${analysis.architecture}

## Teknolojiler
${analysis.technologies.map(t => `- ${t}`).join('\n')}

## Kod Pattern'leri
${analysis.patterns.map(p => `- ${p}`).join('\n')}

## Dizin Yapısı
${analysis.structure}

## İyileştirme Önerileri
${analysis.recommendations.map(r => `- ${r}`).join('\n')}
`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      console.log('📄 Çıktı kaydedildi: docs/' + workflow.id + '.md');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Dokümantasyon hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Code Scaffolding workflow
   */
  private async executeCodeScaffolding(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║ 🏗️ KOD SCAFFOLDING - GERÇEK DOSYA YAZIMI'.padEnd(59) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      // Get architecture info from previous outputs
      const archOutput = this.workflowOutputs.get('create-architecture') || '';
      const prdOutput = this.workflowOutputs.get('create-prd') || '';

      // Extract tech stack from architecture
      const techStackMatch = archOutput.match(/teknoloji|stack|framework/gi);
      const techStack = techStackMatch ? ['TypeScript', 'Node.js', 'React'] : ['TypeScript', 'Node.js'];

      // In interactive mode, confirm before writing files
      if (this.config.mode === 'interactive') {
        const confirmWrite = await p.confirm({
          message: `Proje dosyaları ${this.config.projectPath}/src dizinine yazılacak. Onaylıyor musun?`,
          initialValue: true,
        });

        if (p.isCancel(confirmWrite) || !confirmWrite) {
          p.log.warn('Kod scaffolding iptal edildi.');
          return false;
        }
      }

      // Use generateAndWriteCode for REAL file writing
      console.log('');
      p.log.info('📝 Proje dosyaları oluşturuluyor ve diske yazılıyor...');

      const result = await generateAndWriteCode(
        this.config.projectPath,
        this.config.projectName,
        archOutput.slice(0, 3000) || 'Standard web application with TypeScript',
        techStack,
        this.config.adapter,
        true
      );

      if (!result.success) {
        p.log.error('Kod scaffolding başarısız oldu.');
        return false;
      }

      // Also generate API files if applicable
      if (archOutput.toLowerCase().includes('api') || archOutput.toLowerCase().includes('rest')) {
        console.log('');
        p.log.info('🔌 API dosyaları oluşturuluyor...');

        const apiResult = await generateAPIFiles(
          this.config.projectPath,
          archOutput.slice(0, 2000),
          this.config.adapter,
          true
        );

        if (apiResult.success) {
          result.files.push(...apiResult.files);
        }
      }

      // Generate test files
      console.log('');
      p.log.info('🧪 Test dosyaları oluşturuluyor...');

      const testResult = await generateTestFiles(
        this.config.projectPath,
        result.files.map(f => f.path),
        this.config.adapter,
        true
      );

      if (testResult.success) {
        result.files.push(...testResult.files);
      }

      // Save generated files info
      const output = `# Kod Scaffolding

## Oluşturulan Dosyalar
${result.files.map(f => `- \`${f.path}\`: ${f.description} ${f.written ? '✅' : '❌'}`).join('\n')}

## İstatistikler
- Toplam dosya: ${result.files.length}
- Başarıyla yazılan: ${result.files.filter(f => f.written).length}
- Hatalı: ${result.files.filter(f => !f.written).length}

## Sonraki Adımlar
1. \`cd ${this.config.projectPath}\`
2. \`npm install\` veya \`pnpm install\`
3. \`npm run dev\` veya \`pnpm dev\`

---
📁 Toplam ${result.files.length} dosya diske yazıldı
`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı! (${result.files.filter(f => f.written).length} dosya yazıldı)`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Scaffolding hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Adversarial Review workflow
   */
  private async executeAdversarialReview(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║ ⚔️ ADVERSARIAL REVIEW (AUTO-FIX ENABLED)'.padEnd(59) + '║');
      console.log('║ ' + 'Tüm dokümanları agresif şekilde eleştir ve düzelt'.padEnd(57) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      const allOutputs = Array.from(this.workflowOutputs.entries())
        .map(([id, content]) => `## ${id}\n${content.slice(0, 1500)}`)
        .join('\n\n---\n\n');

      const result = await runAdversarialReview(
        allOutputs,
        'general',
        this.config.adapter,
        true
      );

      // If there are critical issues, run the review and fix loop for affected documents
      const criticalFindings = result.findings.filter(f => f.severity === 'critical');
      const fixedDocs: string[] = [];

      if (criticalFindings.length > 0 && (this.config.mode === 'auto' || this.config.mode === 'interactive')) {
        console.log('');
        p.log.warn(`⚠️ ${criticalFindings.length} kritik bulgu tespit edildi!`);

        const shouldFix = this.config.mode === 'auto' ? true : await (async () => {
          const confirm = await p.confirm({
            message: 'Kritik bulgular için otomatik düzeltme çalıştırılsın mı?',
            initialValue: true,
          });
          return !p.isCancel(confirm) && confirm;
        })();

        if (shouldFix) {
          // Fix PRD if it has critical issues
          const prdContent = this.workflowOutputs.get('create-prd');
          if (prdContent && criticalFindings.some(f => f.category.toLowerCase().includes('prd') || f.finding.toLowerCase().includes('prd'))) {
            console.log('\n📋 PRD düzeltiliyor...');
            const fixResult = await reviewAndFixLoop(prdContent, 'prd', this.config.adapter, 3, true);
            this.workflowOutputs.set('create-prd', fixResult.finalContent);
            await this.saveWorkflowOutput('create-prd', 'PRD', fixResult.finalContent);
            fixedDocs.push('PRD');
          }

          // Fix Architecture if it has critical issues
          const archContent = this.workflowOutputs.get('create-architecture');
          if (archContent && criticalFindings.some(f => f.category.toLowerCase().includes('arch') || f.finding.toLowerCase().includes('mimari'))) {
            console.log('\n🏗️ Mimari düzeltiliyor...');
            const fixResult = await reviewAndFixLoop(archContent, 'architecture', this.config.adapter, 3, true);
            this.workflowOutputs.set('create-architecture', fixResult.finalContent);
            await this.saveWorkflowOutput('create-architecture', 'Architecture', fixResult.finalContent);
            fixedDocs.push('Architecture');
          }
        }
      }

      const passScore = result.passedReview ? 80 : 40;
      this.workflowScores.set(workflow.id, passScore);

      const output = `# Adversarial Review Raporu

## Özet
- Toplam bulgu: ${result.findings.length}
- Kritik: ${result.findings.filter(f => f.severity === 'critical').length}
- Major: ${result.findings.filter(f => f.severity === 'major').length}
- Minor: ${result.findings.filter(f => f.severity === 'minor').length}
- Geçti mi: ${result.passedReview ? '✅ Evet' : '❌ Hayır'}
${fixedDocs.length > 0 ? `- Düzeltilen dokümanlar: ${fixedDocs.join(', ')}` : ''}

## Bulgular

${result.findings.map((f, i) => `### ${i + 1}. [${f.severity.toUpperCase()}] ${f.category}
**Bulgu:** ${f.finding}
**Etki:** ${f.impact}
**Öneri:** ${f.recommendation}
`).join('\n')}

---
🔍 Review Skoru: ${passScore}/100
`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı! (${result.findings.length} bulgu${fixedDocs.length > 0 ? `, ${fixedDocs.length} doküman düzeltildi` : ''})`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Adversarial review hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Quality Validation workflow
   */
  private async executeQualityValidation(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║ ✅ KALİTE VALİDASYONU (QUALITY GATES)'.padEnd(59) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      const scores: { name: string; id: string; score: any; gateResult?: QualityGateResult }[] = [];
      let allPassed = true;

      // PRD Quality Gate
      const prdContent = this.workflowOutputs.get('create-prd');
      if (prdContent) {
        console.log('\n📋 PRD kalite kapısı kontrol ediliyor...');
        const prdScore = await calculatePRDQuality(prdContent, this.config.adapter, true);
        const prdGate = await runQualityGate('create-prd', prdContent, this.config.adapter, false);

        this.workflowScores.set('create-prd', prdGate.result.score);
        scores.push({ name: 'PRD', id: 'create-prd', score: prdScore, gateResult: prdGate.result });

        if (!prdGate.result.passed) {
          allPassed = false;
          p.log.warn(`⚠️ PRD kalite kapısını geçemedi (${prdGate.result.score}/${prdGate.result.minimumRequired})`);

          // Auto-fix if in auto mode
          if (this.config.mode === 'auto') {
            const improved = await improveUntilPass(prdContent, 'create-prd', this.config.adapter, 3, true);
            if (improved.passed) {
              this.workflowOutputs.set('create-prd', improved.content);
              this.workflowScores.set('create-prd', improved.finalScore);
              await this.saveWorkflowOutput('create-prd', 'PRD', improved.content);
              p.log.success(`✅ PRD otomatik iyileştirildi (${improved.finalScore}/100)`);
            }
          }
        } else {
          p.log.success(`✅ PRD kalite kapısı geçti (${prdGate.result.score}/100)`);
        }
      }

      // Architecture Quality Gate
      const archContent = this.workflowOutputs.get('create-architecture');
      if (archContent) {
        console.log('\n🏗️ Mimari kalite kapısı kontrol ediliyor...');
        const archScore = await calculateArchitectureQuality(archContent, this.config.adapter, true);
        const archGate = await runQualityGate('create-architecture', archContent, this.config.adapter, false);

        this.workflowScores.set('create-architecture', archGate.result.score);
        scores.push({ name: 'Architecture', id: 'create-architecture', score: archScore, gateResult: archGate.result });

        if (!archGate.result.passed) {
          allPassed = false;
          p.log.warn(`⚠️ Mimari kalite kapısını geçemedi (${archGate.result.score}/${archGate.result.minimumRequired})`);

          // Auto-fix if in auto mode
          if (this.config.mode === 'auto') {
            const improved = await improveUntilPass(archContent, 'create-architecture', this.config.adapter, 3, true);
            if (improved.passed) {
              this.workflowOutputs.set('create-architecture', improved.content);
              this.workflowScores.set('create-architecture', improved.finalScore);
              await this.saveWorkflowOutput('create-architecture', 'Architecture', improved.content);
              p.log.success(`✅ Mimari otomatik iyileştirildi (${improved.finalScore}/100)`);
            }
          }
        } else {
          p.log.success(`✅ Mimari kalite kapısı geçti (${archGate.result.score}/100)`);
        }
      }

      // Epics & Stories Quality Gate
      const epicsContent = this.workflowOutputs.get('create-epics-and-stories');
      if (epicsContent) {
        console.log('\n📚 Epic/Story kalite kapısı kontrol ediliyor...');
        const epicsGate = await runQualityGate('create-epics-and-stories', epicsContent, this.config.adapter, false);

        this.workflowScores.set('create-epics-and-stories', epicsGate.result.score);
        scores.push({
          name: 'Epics & Stories',
          id: 'create-epics-and-stories',
          score: { overall: epicsGate.result.score, grade: epicsGate.result.passed ? 'A' : 'C', summary: '', categories: [] },
          gateResult: epicsGate.result,
        });

        if (!epicsGate.result.passed) {
          allPassed = false;
        }
      }

      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, s) => a + (s.gateResult?.score || s.score.overall), 0) / scores.length)
        : 0;

      const output = `# Kalite Validasyon Raporu

## Genel Değerlendirme
- **Tüm kapılar geçti mi:** ${allPassed ? '✅ Evet' : '❌ Hayır'}
- **Ortalama Skor:** ${avgScore}/100

## Kalite Kapıları

| Doküman | Skor | Minimum | Durum |
|---------|------|---------|-------|
${scores.map(s => `| ${s.name} | ${s.gateResult?.score || s.score.overall}/100 | ${s.gateResult?.minimumRequired || 70} | ${s.gateResult?.passed ? '✅ Geçti' : '❌ Geçemedi'} |`).join('\n')}

## Detaylı Analiz

${scores.map(s => `### ${s.name} (${s.score.overall}/100 - ${s.score.grade})

${s.score.summary || 'Detaylı analiz mevcut değil.'}

${s.gateResult ? `**Kalite Kapısı Detayları:**
- Skor: ${s.gateResult.score}/${s.gateResult.minimumRequired}
- Durum: ${s.gateResult.passed ? '✅ Geçti' : '❌ Geçemedi'}
${s.gateResult.issues.length > 0 ? `- Sorunlar:\n${s.gateResult.issues.slice(0, 5).map(i => `  - [${i.severity}] ${i.message}`).join('\n')}` : ''}
` : ''}
`).join('\n')}

---
📊 Ortalama Skor: ${avgScore}/100
🚦 Sonuç: ${allPassed ? '✅ Tüm kalite kapıları geçildi - Implementation\'a geçilebilir' : '⚠️ Bazı kalite kapıları geçilemedi - İyileştirme gerekli'}
`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      // Store overall validation score
      this.workflowScores.set(workflow.id, avgScore);

      p.log.success(`✅ ${workflow.name} tamamlandı! (${allPassed ? 'Tüm kapılar geçti' : 'Bazı kapılar geçemedi'})`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Validasyon hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Quick Spec workflow
   */
  private async executeQuickSpec(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      const context = {
        projectName: this.config.projectName,
        projectPath: this.config.projectPath,
        idea: this.config.idea,
        phase: this.currentPhase,
        workflow: { meta: { name: workflow.name, description: workflow.description, phase: this.currentPhase, order: 0, required: true }, steps: [], currentStepIndex: 0 },
        state: { workflowId: workflow.id, currentStepIndex: 0, completedSteps: [], outputs: new Map(), startedAt: new Date(), lastUpdatedAt: new Date() },
        previousOutputs: this.workflowOutputs,
        userPreferences: new Map(),
      };

      const output = await quickSpec(this.config.idea, context, this.config.adapter, true);

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Quick spec hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Quick Dev workflow
   */
  private async executeQuickDev(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      const context = {
        projectName: this.config.projectName,
        projectPath: this.config.projectPath,
        idea: this.config.idea,
        phase: this.currentPhase,
        workflow: { meta: { name: workflow.name, description: workflow.description, phase: this.currentPhase, order: 0, required: true }, steps: [], currentStepIndex: 0 },
        state: { workflowId: workflow.id, currentStepIndex: 0, completedSteps: [], outputs: new Map(), startedAt: new Date(), lastUpdatedAt: new Date() },
        previousOutputs: this.workflowOutputs,
        userPreferences: new Map(),
      };

      const output = await quickDev(this.config.idea, context, this.config.adapter, true);

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Quick dev hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Editorial Review workflow
   */
  private async executeEditorialReview(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║ ✍️ EDITORIAL REVIEW'.padEnd(59) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      const allOutputs = Array.from(this.workflowOutputs.entries())
        .map(([id, content]) => `## ${id}\n${content.slice(0, 1000)}`)
        .join('\n\n');

      // Prose review
      console.log('\n📝 Yazım kalitesi inceleniyor...');
      const proseResult = await editorialReviewProse(allOutputs, this.config.adapter, true);

      // Structure review
      console.log('\n📐 Yapı inceleniyor...');
      const structureResult = await editorialReviewStructure(allOutputs, this.config.adapter, true);

      const output = `# Editorial Review Raporu

## Yazım Kalitesi

### Bulunan Sorunlar
${proseResult.issues.map(i => `- **${i.type}** (${i.location}): ${i.suggestion}`).join('\n')}

## Yapı Analizi

### Sorunlar
${structureResult.issues.map(i => `- ${i}`).join('\n')}

### Önerilen Outline
${structureResult.suggestedOutline.map((s, i) => `${i + 1}. ${s}`).join('\n')}

---
📊 Toplam ${proseResult.issues.length} yazım + ${structureResult.issues.length} yapı sorunu
`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Editorial review hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Brainstorming workflow
   */
  private async executeBrainstorming(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║ 🧠 BEYİN FIRTINASI'.padEnd(59) + '║');
      console.log('║ ' + 'Çoklu tekniklerle fikir üretimi'.padEnd(57) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      const techniques = [
        { name: 'SCAMPER', description: 'Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse' },
        { name: 'Mind Mapping', description: 'Merkezi fikirden dallanan görsel harita' },
        { name: 'Six Thinking Hats', description: 'Beyaz (veriler), Kırmızı (duygular), Siyah (riskler), Sarı (faydalar), Yeşil (yaratıcılık), Mavi (süreç)' },
        { name: 'SWOT Analysis', description: 'Güçlü yönler, Zayıf yönler, Fırsatlar, Tehditler' },
        { name: 'How Might We', description: 'Nasıl yapabiliriz soruları' },
        { name: 'Reverse Brainstorming', description: 'Problemi nasıl daha kötü yapabiliriz?' },
      ];

      let output = `# Beyin Fırtınası Oturumu\n\n**Fikir:** ${this.config.idea}\n\n`;

      for (const technique of techniques) {
        console.log(`\n🔄 ${technique.name} tekniği uygulanıyor...`);

        const systemPrompt = `Sen yaratıcı bir beyin fırtınası uzmanısın.
${technique.name} tekniğini kullanarak fikir üret.
Teknik açıklaması: ${technique.description}`;

        const prompt = `Fikir: ${this.config.idea}

${technique.name} tekniğini kullanarak bu fikri analiz et ve geliştir.
- Her adımı detaylı açıkla
- Somut öneriler sun
- Yenilikçi bakış açıları getir`;

        const stream = this.config.adapter.stream(prompt, {
          maxTokens: 2048,
          systemPrompt,
        });

        let techniqueOutput = '';
        for await (const chunk of stream) {
          process.stdout.write(chunk);
          techniqueOutput += chunk;
        }
        console.log('');

        output += `## ${technique.name}\n\n${techniqueOutput}\n\n---\n\n`;
      }

      // Synthesize all techniques
      console.log('\n📊 Tüm teknikler sentezleniyor...');

      const synthesisPrompt = `Beyin fırtınası sonuçları:\n${output}\n\nBu sonuçları sentezle:
1. En güçlü fikirler
2. Ortak temalar
3. Öncelikli aksiyon önerileri
4. Risk/fırsat matrisi`;

      const synthesisStream = this.config.adapter.stream(synthesisPrompt, {
        maxTokens: 2048,
        systemPrompt: 'Sen bir strateji danışmanısın. Beyin fırtınası sonuçlarını sentezle.',
      });

      let synthesis = '';
      for await (const chunk of synthesisStream) {
        process.stdout.write(chunk);
        synthesis += chunk;
      }
      console.log('');

      output += `## Sentez ve Öncelikler\n\n${synthesis}`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      this.workflowScores.set(workflow.id, 75);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı! (${techniques.length} teknik uygulandı)`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Brainstorming hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Research workflow (market, domain, technical)
   */
  private async executeResearch(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      // Determine research type from workflow id
      let researchType = 'general';
      let researchEmoji = '🔍';
      let researchAreas: string[] = [];

      if (workflow.id.includes('market')) {
        researchType = 'Pazar Araştırması';
        researchEmoji = '📈';
        researchAreas = [
          'Pazar büyüklüğü ve trendler',
          'Hedef müşteri segmentleri',
          'Rekabet analizi',
          'Fiyatlandırma stratejileri',
          'Dağıtım kanalları',
          'Giriş engelleri',
        ];
      } else if (workflow.id.includes('domain')) {
        researchType = 'Alan Araştırması';
        researchEmoji = '🏭';
        researchAreas = [
          'Sektör dinamikleri',
          'Düzenleyici çerçeve',
          'Endüstri standartları',
          'Best practice\'ler',
          'Teknoloji trendleri',
          'Paydaş analizi',
        ];
      } else if (workflow.id.includes('technical')) {
        researchType = 'Teknik Araştırma';
        researchEmoji = '⚙️';
        researchAreas = [
          'Teknoloji seçenekleri',
          'Mimari pattern\'ler',
          'Entegrasyon gereksinimleri',
          'Performans kriterleri',
          'Güvenlik gereksinimleri',
          'Ölçeklenebilirlik',
        ];
      }

      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log(`║ ${researchEmoji} ${researchType.toUpperCase()}`.padEnd(59) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      let output = `# ${researchType}\n\n**Konu:** ${this.config.idea}\n\n`;

      for (const area of researchAreas) {
        console.log(`\n🔎 ${area} araştırılıyor...`);

        const systemPrompt = `Sen deneyimli bir ${researchType.toLowerCase()} uzmanısın.
${area} konusunda derinlemesine analiz yap.
Somut veriler, örnekler ve referanslar kullan.`;

        const prompt = `Konu: ${this.config.idea}

"${area}" hakkında detaylı araştırma yap:
- Mevcut durum analizi
- Önemli bulgular
- Fırsatlar ve riskler
- Öneriler`;

        const stream = this.config.adapter.stream(prompt, {
          maxTokens: 1536,
          systemPrompt,
        });

        let areaOutput = '';
        for await (const chunk of stream) {
          process.stdout.write(chunk);
          areaOutput += chunk;
        }
        console.log('');

        output += `## ${area}\n\n${areaOutput}\n\n---\n\n`;
      }

      // Generate executive summary
      console.log('\n📋 Yönetici özeti oluşturuluyor...');

      const summaryPrompt = `Araştırma sonuçları:\n${output.slice(0, 4000)}\n\n
Yönetici özeti oluştur:
1. Ana bulgular (3-5 madde)
2. Kritik başarı faktörleri
3. Önerilen aksiyon planı
4. Sonraki adımlar`;

      const summaryStream = this.config.adapter.stream(summaryPrompt, {
        maxTokens: 1024,
        systemPrompt: 'Sen bir strateji danışmanısın. Araştırma bulgularını özetle.',
      });

      let summary = '';
      for await (const chunk of summaryStream) {
        process.stdout.write(chunk);
        summary += chunk;
      }
      console.log('');

      output += `## Yönetici Özeti\n\n${summary}`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      this.workflowScores.set(workflow.id, 70);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı! (${researchAreas.length} alan araştırıldı)`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Research hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Sprint Status workflow
   */
  private async executeSprintStatus(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║ 📊 SPRINT DURUMU'.padEnd(59) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      // Check if sprint-status.yaml exists
      const sprintStatusPath = join(this.config.projectPath, 'docs', 'sprint-status.yaml');
      let existingStatus = '';

      if (existsSync(sprintStatusPath)) {
        existingStatus = await readFile(sprintStatusPath, 'utf-8');
        console.log('\n📄 Mevcut sprint durumu bulundu.');
      }

      // Get epic/story info from previous outputs
      const epicsContent = this.workflowOutputs.get('create-epics-stories') ||
                          this.workflowOutputs.get('create-epics-and-stories') || '';

      const systemPrompt = `Sen bir Scrum Master'sın.
Sprint durumunu analiz et ve raporla.
Risk ve engelleri belirle, öneriler sun.`;

      const prompt = `Proje: ${this.config.idea}

Mevcut Sprint Durumu:
${existingStatus || 'Henüz sprint durumu yok.'}

Epic/Story Bilgisi:
${epicsContent.slice(0, 2000)}

Sprint durumu raporu oluştur:
1. **Sprint Özeti**
   - Sprint hedefi
   - Başlangıç/Bitiş tarihleri
   - Tamamlanma oranı

2. **Story Durumları**
   - Tamamlanan
   - Devam eden
   - Bekleyen
   - Engellenen

3. **Riskler ve Engeller**
   - Mevcut engeller
   - Potansiyel riskler
   - Etki analizi

4. **Öneriler**
   - Hız artırma önerileri
   - Kaynak optimizasyonu
   - Sonraki sprint için notlar

YAML formatında sprint-status dosyası da üret.`;

      const stream = this.config.adapter.stream(prompt, {
        maxTokens: 2048,
        systemPrompt,
      });

      let output = '';
      for await (const chunk of stream) {
        process.stdout.write(chunk);
        output += chunk;
      }
      console.log('');

      // Extract YAML and save
      const yamlMatch = output.match(/```yaml\n([\s\S]*?)\n```/);
      if (yamlMatch) {
        await writeFile(sprintStatusPath, yamlMatch[1], 'utf-8');
        console.log('\n📄 Sprint durumu kaydedildi: docs/sprint-status.yaml');
      }

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      this.workflowScores.set(workflow.id, 70);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Sprint status hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Correct Course workflow
   */
  private async executeCorrectCourse(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║ 🔄 ROTA DÜZELTME'.padEnd(59) + '║');
      console.log('║ ' + 'Sprint sırasında değişiklik yönetimi'.padEnd(57) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      // Get change description in interactive mode
      let changeDescription = '';
      if (this.config.mode === 'interactive') {
        const change = await p.text({
          message: 'Hangi değişiklik gerekiyor? (Yeni gereksinim, engel, öncelik değişikliği vb.)',
          placeholder: 'Değişikliği açıklayın...',
        });

        if (p.isCancel(change)) {
          return false;
        }
        changeDescription = change as string;
      } else {
        changeDescription = 'Sprint sırasında ortaya çıkan değişiklikleri analiz et.';
      }

      const systemPrompt = `Sen deneyimli bir Scrum Master ve değişiklik yönetimi uzmanısın.
Sprint sırasında ortaya çıkan değişiklikleri analiz et.
Etki değerlendirmesi yap ve çözüm öner.`;

      const prdContent = this.workflowOutputs.get('create-prd')?.slice(0, 1500) || '';
      const archContent = this.workflowOutputs.get('create-architecture')?.slice(0, 1500) || '';

      const prompt = `Proje: ${this.config.idea}

Değişiklik Talebi:
${changeDescription}

Mevcut PRD Özeti:
${prdContent}

Mevcut Mimari Özeti:
${archContent}

Analiz et:
1. **Etki Analizi**
   - PRD üzerindeki etki
   - Mimari üzerindeki etki
   - Sprint planı üzerindeki etki
   - Kaynak gereksinimleri

2. **Risk Değerlendirmesi**
   - Teknik riskler
   - Zaman riskleri
   - Kalite riskleri

3. **Çözüm Önerileri**
   - Seçenek A: [Değişikliği kabul et]
   - Seçenek B: [Değişikliği ertele]
   - Seçenek C: [Alternatif çözüm]

4. **Uygulama Planı**
   - Gerekli güncellemeler
   - Etkilenen story'ler
   - Tahmini ek efor

5. **Karar Önerisi**
   - Önerilen aksiyon
   - Gerekçe`;

      const stream = this.config.adapter.stream(prompt, {
        maxTokens: 2048,
        systemPrompt,
      });

      let output = `# Rota Düzeltme Raporu\n\n**Değişiklik:** ${changeDescription}\n\n`;
      for await (const chunk of stream) {
        process.stdout.write(chunk);
        output += chunk;
      }
      console.log('');

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      this.workflowScores.set(workflow.id, 70);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı!`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Correct course hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Execute Check Implementation Readiness workflow
   */
  private async executeCheckReadiness(workflow: WorkflowDefinition): Promise<boolean> {
    try {
      console.log('');
      console.log('╔' + '═'.repeat(58) + '╗');
      console.log('║ ✅ UYGULAMA HAZIRLIĞI KONTROLÜ'.padEnd(59) + '║');
      console.log('║ ' + 'PRD, UX, Mimari uyum ve eksiklik analizi'.padEnd(57) + '║');
      console.log('╚' + '═'.repeat(58) + '╝');

      const prdContent = this.workflowOutputs.get('create-prd') || '';
      const uxContent = this.workflowOutputs.get('create-ux-design') || '';
      const archContent = this.workflowOutputs.get('create-architecture') || '';
      const epicsContent = this.workflowOutputs.get('create-epics-stories') ||
                          this.workflowOutputs.get('create-epics-and-stories') || '';

      const checks: { name: string; status: 'pass' | 'warn' | 'fail'; issues: string[] }[] = [];

      // Check PRD completeness
      console.log('\n📋 PRD kontrol ediliyor...');
      const prdCheck = await this.checkDocument('PRD', prdContent, [
        'Problem tanımı',
        'Hedef kullanıcılar',
        'Fonksiyonel gereksinimler',
        'Non-fonksiyonel gereksinimler',
        'Kabul kriterleri',
        'Başarı metrikleri',
      ]);
      checks.push(prdCheck);

      // Check UX completeness
      console.log('\n🎨 UX tasarımı kontrol ediliyor...');
      const uxCheck = await this.checkDocument('UX', uxContent, [
        'Kullanıcı akışları',
        'Wireframe\'ler',
        'UI bileşenleri',
        'Erişilebilirlik',
        'Responsive tasarım',
      ]);
      checks.push(uxCheck);

      // Check Architecture completeness
      console.log('\n🏗️ Mimari kontrol ediliyor...');
      const archCheck = await this.checkDocument('Mimari', archContent, [
        'Sistem mimarisi',
        'Veri modeli',
        'API tasarımı',
        'Güvenlik',
        'Performans',
        'Ölçeklenebilirlik',
      ]);
      checks.push(archCheck);

      // Check Epics/Stories completeness
      console.log('\n📚 Epic/Story kontrol ediliyor...');
      const epicsCheck = await this.checkDocument('Epic/Stories', epicsContent, [
        'Epic tanımları',
        'User story\'ler',
        'Kabul kriterleri',
        'Story point tahminleri',
        'Bağımlılıklar',
      ]);
      checks.push(epicsCheck);

      // Cross-document alignment check
      console.log('\n🔗 Dokümanlar arası uyum kontrol ediliyor...');
      const alignmentResult = await this.checkAlignment(prdContent, uxContent, archContent, epicsContent);

      const allPassed = checks.every(c => c.status === 'pass') && alignmentResult.aligned;
      const totalIssues = checks.reduce((sum, c) => sum + c.issues.length, 0) + alignmentResult.issues.length;

      const output = `# Uygulama Hazırlığı Raporu

## Genel Durum
- **Hazır mı:** ${allPassed ? '✅ Evet' : '❌ Hayır'}
- **Toplam sorun:** ${totalIssues}

## Doküman Kontrolleri

| Doküman | Durum | Sorun Sayısı |
|---------|-------|--------------|
${checks.map(c => `| ${c.name} | ${c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'} | ${c.issues.length} |`).join('\n')}

## Detaylı Bulgular

${checks.map(c => `### ${c.name} ${c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌'}

${c.issues.length > 0 ? c.issues.map(i => `- ${i}`).join('\n') : 'Sorun bulunamadı.'}
`).join('\n')}

### Dokümanlar Arası Uyum ${alignmentResult.aligned ? '✅' : '❌'}

${alignmentResult.issues.length > 0 ? alignmentResult.issues.map(i => `- ${i}`).join('\n') : 'Tüm dokümanlar uyumlu.'}

## Sonuç

${allPassed
  ? '✅ **Proje implementasyona hazır!** Tüm dokümanlar tamamlanmış ve uyumlu.'
  : `⚠️ **Dikkat gerekiyor!** ${totalIssues} sorun çözülmeli.

### Öncelikli Aksiyonlar
${checks.filter(c => c.status !== 'pass').map(c => `1. ${c.name} dokümanını gözden geçir`).join('\n')}
${alignmentResult.issues.length > 0 ? '2. Dokümanlar arası tutarsızlıkları gider' : ''}
`}
`;

      this.completedWorkflows.add(workflow.id);
      this.workflowOutputs.set(workflow.id, output);
      this.workflowScores.set(workflow.id, allPassed ? 85 : 50);
      await this.saveWorkflowOutput(workflow.id, workflow.name, output);

      p.log.success(`✅ ${workflow.name} tamamlandı! (${allPassed ? 'Hazır' : `${totalIssues} sorun bulundu`})`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      p.log.error(`Check readiness hatası: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Helper: Check document completeness
   */
  private async checkDocument(
    name: string,
    content: string,
    requiredSections: string[]
  ): Promise<{ name: string; status: 'pass' | 'warn' | 'fail'; issues: string[] }> {
    const issues: string[] = [];

    if (!content || content.length < 100) {
      return { name, status: 'fail', issues: [`${name} dokümanı bulunamadı veya çok kısa.`] };
    }

    const contentLower = content.toLowerCase();
    for (const section of requiredSections) {
      const sectionLower = section.toLowerCase();
      // Check for Turkish or English equivalents
      const found = contentLower.includes(sectionLower) ||
                   contentLower.includes(section.replace(/[ıİ]/g, 'i').toLowerCase());

      if (!found) {
        issues.push(`"${section}" bölümü eksik veya yetersiz.`);
      }
    }

    const missingPercent = issues.length / requiredSections.length;
    const status = missingPercent === 0 ? 'pass' : missingPercent < 0.3 ? 'warn' : 'fail';

    return { name, status, issues };
  }

  /**
   * Helper: Check cross-document alignment
   */
  private async checkAlignment(
    prd: string,
    ux: string,
    arch: string,
    epics: string
  ): Promise<{ aligned: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Simple alignment checks
    if (prd && arch) {
      // Check if architecture mentions key PRD features
      const prdFeatures = prd.match(/özellik|feature|gereksinim|requirement/gi)?.length || 0;
      const archMentions = arch.match(/özellik|feature|gereksinim|requirement/gi)?.length || 0;

      if (prdFeatures > 0 && archMentions < prdFeatures * 0.3) {
        issues.push('Mimari dokümanı PRD gereksinimlerini yeterince karşılamıyor olabilir.');
      }
    }

    if (prd && epics) {
      // Check if epics cover PRD requirements
      const prdReqs = prd.match(/\d\.\s*[^\n]+/g)?.length || 0;
      const epicStories = epics.match(/story|hikaye|epic/gi)?.length || 0;

      if (prdReqs > 0 && epicStories < prdReqs * 0.5) {
        issues.push('Epic/Story\'ler PRD gereksinimlerini tam olarak kapsamıyor olabilir.');
      }
    }

    if (ux && epics) {
      // Check if epics mention UI components
      const uxComponents = ux.match(/button|form|modal|page|ekran|sayfa/gi)?.length || 0;
      const epicUIRefs = epics.match(/UI|arayüz|interface|ekran/gi)?.length || 0;

      if (uxComponents > 5 && epicUIRefs < 3) {
        issues.push('Epic/Story\'ler UX bileşenlerine yeterli referans vermiyor olabilir.');
      }
    }

    return { aligned: issues.length === 0, issues };
  }

  /**
   * Save checkpoint for workflow progress
   */
  private async saveCheckpoint(
    workflowId: string,
    stepIndex: number,
    content: string
  ): Promise<void> {
    const checkpointsDir = join(
      this.config.projectPath,
      '.appfabrika',
      'checkpoints'
    );
    await mkdir(checkpointsDir, { recursive: true });

    const checkpoint = {
      workflowId,
      stepIndex,
      content,
      savedAt: new Date().toISOString(),
    };

    const checkpointPath = join(checkpointsDir, `${workflowId}.json`);
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  /**
   * Load checkpoint for workflow
   */
  private async loadCheckpoint(
    workflowId: string
  ): Promise<{ stepIndex: number; content: string } | null> {
    const checkpointPath = join(
      this.config.projectPath,
      '.appfabrika',
      'checkpoints',
      `${workflowId}.json`
    );

    if (!existsSync(checkpointPath)) {
      return null;
    }

    try {
      const content = await readFile(checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content);
      return {
        stepIndex: checkpoint.stepIndex,
        content: checkpoint.content,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get list of existing checkpoint files
   */
  private async getExistingCheckpoints(): Promise<string[]> {
    const checkpointsDir = join(this.config.projectPath, '.appfabrika', 'checkpoints');

    if (!existsSync(checkpointsDir)) {
      return [];
    }

    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(checkpointsDir);
      return files.filter(f => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  /**
   * Load all checkpoints and restore state
   */
  private async loadAllCheckpoints(): Promise<void> {
    const checkpointFiles = await this.getExistingCheckpoints();

    for (const file of checkpointFiles) {
      const workflowId = file.replace('.json', '');
      const checkpoint = await this.loadCheckpoint(workflowId);

      if (checkpoint && checkpoint.content) {
        this.completedWorkflows.add(workflowId);
        this.workflowOutputs.set(workflowId, checkpoint.content);
      }
    }
  }

  /**
   * Load completed workflows from docs folder
   */
  private async loadCompletedWorkflowsFromDocs(): Promise<void> {
    const docsDir = join(this.config.projectPath, 'docs');

    if (!existsSync(docsDir)) {
      return;
    }

    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(docsDir);
      const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'bmad-report.md');

      for (const file of mdFiles) {
        const workflowId = file.replace('.md', '');
        const filePath = join(docsDir, file);
        const content = await readFile(filePath, 'utf-8');

        if (content.length > 100) {
          this.completedWorkflows.add(workflowId);
          this.workflowOutputs.set(workflowId, content);
        }
      }

      if (this.completedWorkflows.size > 0) {
        p.log.info(`📂 ${this.completedWorkflows.size} tamamlanmış workflow bulundu ve yüklendi.`);
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Save workflow output to docs folder
   */
  private async saveWorkflowOutput(
    workflowId: string,
    workflowName: string,
    content: string
  ): Promise<void> {
    const docsDir = join(this.config.projectPath, 'docs');
    await mkdir(docsDir, { recursive: true });

    const filename = `${workflowId}.md`;
    const filePath = join(docsDir, filename);

    const header = `---
workflow: ${workflowId}
name: ${workflowName}
project: ${this.config.projectName}
generatedAt: ${new Date().toISOString()}
---

# ${workflowName}

> Proje: ${this.config.projectName}
> Fikir: ${this.config.idea}

`;

    await writeFile(filePath, header + content, 'utf-8');
  }

  /**
   * Run the full BMAD workflow
   */
  async run(): Promise<{
    success: boolean;
    completedWorkflows: string[];
    totalSteps: number;
  }> {
    // Initialize utilities
    await this.init();

    logger.info('BMAD Full Workflow başlatılıyor', {
      projectName: this.config.projectName,
      idea: this.config.idea.slice(0, 100),
    });

    console.log('');
    console.log('🏭 BMAD Full Workflow başlatılıyor...');
    console.log(`📁 Proje: ${this.config.projectName}`);
    console.log(`💡 Fikir: ${this.config.idea}`);

    // Check for existing checkpoints and offer resume
    const checkpointsDir = join(this.config.projectPath, '.appfabrika', 'checkpoints');
    if (existsSync(checkpointsDir) && this.config.mode === 'interactive') {
      const checkpointFiles = await this.getExistingCheckpoints();

      if (checkpointFiles.length > 0) {
        console.log('');
        p.log.info(`📂 ${checkpointFiles.length} tamamlanmamış workflow bulundu.`);

        const resumeChoice = await p.select({
          message: 'Ne yapmak istersin?',
          options: [
            { value: 'resume', label: '🔄 Kaldığı yerden devam et', hint: 'Önceki ilerlemeyi yükle' },
            { value: 'fresh', label: '🆕 Baştan başla', hint: 'Önceki ilerlemeyi sil' },
            { value: 'keep', label: '➡️ Devam et (ilerlemeyi koru)', hint: 'Tamamlananları atla' },
          ],
        });

        if (!p.isCancel(resumeChoice)) {
          if (resumeChoice === 'resume') {
            await this.loadAllCheckpoints();
            console.log('');
            p.log.success(`✅ ${this.completedWorkflows.size} workflow yüklendi.`);
          } else if (resumeChoice === 'fresh') {
            // Clear checkpoints
            for (const file of checkpointFiles) {
              const filePath = join(checkpointsDir, file);
              if (existsSync(filePath)) {
                await writeFile(filePath, '', 'utf-8'); // Clear file
              }
            }
            p.log.info('🗑️ Önceki ilerleme silindi.');
          } else if (resumeChoice === 'keep') {
            await this.loadCompletedWorkflowsFromDocs();
          }
        }
      }
    }

    // Select workflows
    const selectedWorkflows = await this.selectWorkflows();

    if (!selectedWorkflows || selectedWorkflows.length === 0) {
      p.cancel('Workflow seçilmedi.');
      return {
        success: false,
        completedWorkflows: [],
        totalSteps: 0,
      };
    }

    console.log('');
    p.log.info(`📋 ${selectedWorkflows.length} workflow seçildi`);

    let totalSteps = 0;
    let currentWorkflowIndex = 0;

    // Execute each workflow in order
    for (const workflow of selectedWorkflows) {
      currentWorkflowIndex++;

      console.log('');
      console.log('═'.repeat(60));
      console.log(`📦 Workflow ${currentWorkflowIndex}/${selectedWorkflows.length}`);

      const success = await this.executeWorkflow(workflow);

      if (!success) {
        const continueAnyway = await p.confirm({
          message: 'Workflow başarısız oldu. Devam etmek ister misin?',
          initialValue: false,
        });

        if (p.isCancel(continueAnyway) || !continueAnyway) {
          break;
        }
      }

      totalSteps += workflow.stepCount;
    }

    // Summary with quality scores
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 ÖZET                                   ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Tamamlanan workflow: ${this.completedWorkflows.size}/${selectedWorkflows.length}`.padEnd(63) + '║');
    console.log(`║ Toplam adım: ${totalSteps}`.padEnd(63) + '║');
    console.log('╟──────────────────────────────────────────────────────────────╢');
    console.log('║                  📈 KALİTE SKORLARI                          ║');
    console.log('╟──────────────────────────────────────────────────────────────╢');

    // Show quality scores
    const scoreEntries = Array.from(this.workflowScores.entries());
    if (scoreEntries.length > 0) {
      for (const [workflowId, score] of scoreEntries) {
        const status = score >= 70 ? '✅' : score >= 50 ? '⚠️' : '❌';
        console.log(`║ ${status} ${workflowId.padEnd(35)} ${score}/100`.padEnd(60) + '║');
      }

      const avgScore = Math.round(
        scoreEntries.reduce((sum, [, s]) => sum + s, 0) / scoreEntries.length
      );
      console.log('╟──────────────────────────────────────────────────────────────╢');
      console.log(`║ 📊 Ortalama Kalite Skoru: ${avgScore}/100`.padEnd(63) + '║');

      // Overall assessment
      const allPassed = scoreEntries.every(([, s]) => s >= 70);
      if (allPassed) {
        console.log('║ 🎉 Tüm kalite kapıları geçildi!'.padEnd(63) + '║');
      } else {
        const failedCount = scoreEntries.filter(([, s]) => s < 70).length;
        console.log(`║ ⚠️ ${failedCount} workflow kalite kapısını geçemedi`.padEnd(63) + '║');
      }
    } else {
      console.log('║ Henüz kalite skoru hesaplanmadı'.padEnd(63) + '║');
    }

    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Display token usage summary
    tokenTracker.displaySummary();

    // Save final summary report
    await this.saveFinalReport(selectedWorkflows, totalSteps);

    // Save token stats
    await tokenTracker.save();

    // Flush logs
    await logger.flush();

    // Close cache
    await cache.close();

    const success = this.completedWorkflows.size === selectedWorkflows.length;
    logger.info('BMAD workflow tamamlandı', {
      success,
      completedWorkflows: this.completedWorkflows.size,
      totalSteps,
      tokenStats: tokenTracker.getStats(),
    });

    return {
      success,
      completedWorkflows: Array.from(this.completedWorkflows),
      totalSteps,
    };
  }

  /**
   * Save final BMAD summary report
   */
  private async saveFinalReport(
    workflows: WorkflowDefinition[],
    totalSteps: number
  ): Promise<void> {
    const scoreEntries = Array.from(this.workflowScores.entries());
    const avgScore = scoreEntries.length > 0
      ? Math.round(scoreEntries.reduce((sum, [, s]) => sum + s, 0) / scoreEntries.length)
      : 0;

    const report = `---
project: ${this.config.projectName}
generatedAt: ${new Date().toISOString()}
mode: ${this.config.mode}
---

# BMAD Workflow Raporu

## Proje Bilgileri
- **Proje Adı:** ${this.config.projectName}
- **Fikir:** ${this.config.idea}
- **Mod:** ${this.config.mode}
- **Tarih:** ${new Date().toLocaleString('tr-TR')}

## Workflow Özeti
- **Toplam Workflow:** ${workflows.length}
- **Tamamlanan:** ${this.completedWorkflows.size}
- **Toplam Adım:** ${totalSteps}

## Kalite Skorları

| Workflow | Skor | Durum |
|----------|------|-------|
${scoreEntries.map(([id, score]) => `| ${id} | ${score}/100 | ${score >= 70 ? '✅ Geçti' : '❌ Geçemedi'} |`).join('\n')}

**Ortalama Skor:** ${avgScore}/100

## Tamamlanan Workflow'lar

${Array.from(this.completedWorkflows).map(id => `- ✅ ${id}`).join('\n')}

## Çıktı Dosyaları

${Array.from(this.workflowOutputs.keys()).map(id => `- docs/${id}.md`).join('\n')}

---

🏭 Bu rapor AppFabrika BMAD Orchestrator tarafından otomatik oluşturulmuştur.
`;

    const docsDir = join(this.config.projectPath, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'bmad-report.md'), report, 'utf-8');

    console.log('');
    console.log('📄 Final rapor kaydedildi: docs/bmad-report.md');
  }
}

/**
 * Create and run BMAD orchestrator
 */
export async function runBmadWorkflow(
  projectPath: string,
  projectName: string,
  idea: string,
  adapter: AnthropicAdapter,
  mode: 'interactive' | 'auto' = 'interactive',
  selectionMode: 'full' | 'required' = 'full'
): Promise<boolean> {
  // Find BMAD root
  const bmadRoot = await findBmadRoot(projectPath);

  if (!bmadRoot) {
    // Use default BMAD location
    const defaultBmadRoot = join(
      process.env.HOME || '',
      'Desktop',
      'urun-fab',
      '_bmad'
    );

    if (!existsSync(defaultBmadRoot)) {
      p.log.error('BMAD dosyaları bulunamadı.');
      p.log.info('_bmad klasörünün proje dizininde veya ~/Desktop/urun-fab/ altında olduğundan emin olun.');
      return false;
    }

    const orchestrator = new BmadOrchestrator({
      bmadRoot: defaultBmadRoot,
      projectPath,
      projectName,
      idea,
      adapter,
      mode,
      selectionMode,
    });

    const result = await orchestrator.run();
    return result.success;
  }

  const orchestrator = new BmadOrchestrator({
    bmadRoot,
    projectPath,
    projectName,
    idea,
    adapter,
    mode,
    selectionMode,
  });

  const result = await orchestrator.run();
  return result.success;
}

/**
 * Run BMAD help system
 */
export async function runBmadHelp(
  topic: string,
  adapter: AnthropicAdapter
): Promise<void> {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║ ❓ BMAD YARDIM SİSTEMİ'.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  const helpResult = await getHelp(topic, adapter, true);

  console.log('');
  console.log('─'.repeat(60));
  console.log('');
  console.log(helpResult);
}

/**
 * Run index docs tool
 */
export async function runIndexDocs(
  projectPath: string,
  adapter: AnthropicAdapter
): Promise<void> {
  const docsDir = join(projectPath, 'docs');

  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║ 📚 DOKÜMAN İNDEKSLEME'.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  if (!existsSync(docsDir)) {
    p.log.error('docs/ klasörü bulunamadı.');
    return;
  }

  const result = await indexDocs(docsDir, adapter, true);

  // Save index
  const indexPath = join(docsDir, 'index.md');
  await writeFile(indexPath, result, 'utf-8');

  console.log('');
  p.log.success('✅ İndeks oluşturuldu: docs/index.md');
}

/**
 * Run shard doc tool
 */
export async function runShardDoc(
  filePath: string,
  adapter: AnthropicAdapter
): Promise<void> {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║ ✂️ DOKÜMAN PARÇALAMA'.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  if (!existsSync(filePath)) {
    p.log.error(`Dosya bulunamadı: ${filePath}`);
    return;
  }

  const content = await readFile(filePath, 'utf-8');
  const result = await shardDoc(content, adapter, true);

  // Save shards
  const dir = join(filePath, '..', 'shards');
  await mkdir(dir, { recursive: true });

  for (const shard of result.shards) {
    const shardPath = join(dir, `${shard.id}.md`);
    await writeFile(shardPath, `# ${shard.title}\n\n${shard.content}`, 'utf-8');
  }

  console.log('');
  p.log.success(`✅ ${result.shards.length} parça oluşturuldu: ${dir}/`);
}

/**
 * Run a single workflow by ID
 */
export async function runSingleWorkflow(
  workflowId: string,
  projectPath: string,
  projectName: string,
  idea: string,
  adapter: AnthropicAdapter,
  mode: 'interactive' | 'auto' = 'interactive'
): Promise<boolean> {
  // Find the workflow
  const workflow = BMAD_PHASES.flatMap(p => p.workflows).find(w => w.id === workflowId);

  if (!workflow) {
    p.log.error(`Workflow bulunamadı: ${workflowId}`);
    console.log('');
    console.log('Mevcut workflow\'lar:');
    for (const phase of BMAD_PHASES) {
      console.log(`\n${phase.emoji} ${phase.name}:`);
      for (const w of phase.workflows) {
        console.log(`  - ${w.id}: ${w.name}`);
      }
    }
    return false;
  }

  // Find BMAD root
  const bmadRoot = await findBmadRoot(projectPath) || join(
    process.env.HOME || '',
    'Desktop',
    'urun-fab',
    '_bmad'
  );

  if (!existsSync(bmadRoot)) {
    p.log.error('BMAD dosyaları bulunamadı.');
    return false;
  }

  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log(`║ 🎯 TEK WORKFLOW: ${workflow.name}`.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  const orchestrator = new BmadOrchestrator({
    bmadRoot,
    projectPath,
    projectName,
    idea,
    adapter,
    mode,
    selectionMode: 'full',
  });

  // Load existing outputs for context
  await orchestrator['loadCompletedWorkflowsFromDocs']();

  // Execute the single workflow
  const success = await orchestrator['executeWorkflow'](workflow);

  return success;
}

/**
 * List all available workflows
 */
export function listWorkflows(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                📋 BMAD WORKFLOW\'LAR                          ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');

  for (const phase of BMAD_PHASES) {
    console.log(`║ ${phase.emoji} ${phase.name.toUpperCase()}`.padEnd(63) + '║');
    console.log('╟──────────────────────────────────────────────────────────────╢');

    for (const workflow of phase.workflows) {
      const req = workflow.required ? '⚠️' : '  ';
      console.log(`║ ${req} ${workflow.id.padEnd(30)} ${workflow.agentEmoji} ${workflow.agent.padEnd(10)}`.padEnd(60) + '║');
    }
    console.log('╟──────────────────────────────────────────────────────────────╢');
  }

  const total = BMAD_PHASES.reduce((t, p) => t + p.workflows.length, 0);
  const required = BMAD_PHASES.reduce(
    (t, p) => t + p.workflows.filter(w => w.required).length,
    0
  );

  console.log(`║ Toplam: ${total} workflow (${required} zorunlu)`.padEnd(63) + '║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}
