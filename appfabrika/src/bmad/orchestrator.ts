/**
 * BMAD Phase Orchestrator
 * Manages execution of all BMAD phases and workflows
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
    console.log('');
    console.log('🏭 BMAD Full Workflow başlatılıyor...');
    console.log(`📁 Proje: ${this.config.projectName}`);
    console.log(`💡 Fikir: ${this.config.idea}`);

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

    // Save final summary report
    await this.saveFinalReport(selectedWorkflows, totalSteps);

    return {
      success: this.completedWorkflows.size === selectedWorkflows.length,
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
