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

/**
 * Workflow selection mode
 */
type WorkflowMode = 'all' | 'required' | 'custom';

/**
 * Execution mode
 */
type ExecutionMode = 'interactive' | 'auto';

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
}

/**
 * Phase Orchestrator class
 */
export class BmadOrchestrator {
  private config: OrchestratorConfig;
  private completedWorkflows: Set<string> = new Set();
  private workflowOutputs: Map<string, string> = new Map();
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

    try {
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

    // Summary
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 ÖZET                                   ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Tamamlanan workflow: ${this.completedWorkflows.size}/${selectedWorkflows.length}`.padEnd(63) + '║');
    console.log(`║ Toplam adım: ${totalSteps}`.padEnd(63) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    return {
      success: this.completedWorkflows.size === selectedWorkflows.length,
      completedWorkflows: Array.from(this.completedWorkflows),
      totalSteps,
    };
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
  mode: 'interactive' | 'auto' = 'interactive'
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
  });

  const result = await orchestrator.run();
  return result.success;
}
