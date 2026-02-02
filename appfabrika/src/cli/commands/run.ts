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
import { BMAD_STEPS, BMAD_STEP_NAMES, BMAD_STEP_EMOJIS } from '../../types/bmad.types.js';
import type { BmadStepType } from '../../types/bmad.types.js';
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
} as const;

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
 * Simulate step execution (placeholder for real LLM integration)
 */
async function executeStep(
  stepId: BmadStepType,
  config: ProjectConfig,
  spinner: SpinnerService
): Promise<{ success: boolean; output: string }> {
  const stepName = BMAD_STEP_NAMES[stepId];
  const emoji = BMAD_STEP_EMOJIS[stepId];

  spinner.updateText(`${emoji} ${stepName} çalışıyor...`);

  // Simulate LLM processing time (2-5 seconds)
  const delay = 2000 + Math.random() * 3000;
  await new Promise(resolve => setTimeout(resolve, delay));

  // For now, return simulated success
  // In real implementation, this would call the LLM adapter
  return {
    success: true,
    output: `${stepName} adımı tamamlandı.\n\nProje: ${config.idea}\n\nBu bir simülasyon çıktısıdır. Gerçek implementasyonda LLM API çağrılacak.`,
  };
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

    const isCheckpointMode = config.automationTemplate === 'checkpoint';
    const completedSteps: BmadStepType[] = [];
    const startTime = Date.now();

    // Execute workflow steps
    for (let i = startStepIndex; i < BMAD_STEPS.length; i++) {
      const stepId = BMAD_STEPS[i];
      const stepName = BMAD_STEP_NAMES[stepId];
      const emoji = BMAD_STEP_EMOJIS[stepId];

      // Show current step
      console.log('');
      console.log(terminalUI.formatStepDisplay({
        stepId,
        stepNumber: i + 1,
        totalSteps: BMAD_STEPS.length,
        status: 'in-progress',
      }));

      // In checkpoint mode, ask for confirmation
      if (isCheckpointMode && !options.auto) {
        const action = await p.select({
          message: `${emoji} ${stepName} - Ne yapmak istersiniz?`,
          options: [
            { value: 'auto', label: '🤖 Otomatik çalıştır' },
            { value: 'manual', label: '✋ Manuel tamamlayacağım' },
            { value: 'skip', label: '⏭️ Atla' },
            { value: 'quit', label: '🚪 Çıkış' },
          ],
        });

        if (p.isCancel(action) || action === 'quit') {
          // Save checkpoint before exit
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
            new Error('User cancelled'),
            0
          );
          p.cancel('Workflow duraklatıldı. `appfabrika run` ile devam edebilirsiniz.');
          process.exit(0);
        }

        if (action === 'skip') {
          p.log.warn(`${emoji} ${stepName} atlandı`);
          continue;
        }

        if (action === 'manual') {
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
      }

      // Execute step automatically
      spinner.startStep(stepId);

      try {
        const result = await executeStep(stepId, config, spinner);

        if (result.success) {
          await saveStepCheckpoint(projectPath, stepId, result.output);
          completedSteps.push(stepId);
          spinner.succeedStep(`${emoji} ${stepName} ${RUN_MESSAGES.STEP_COMPLETE}`);
        } else {
          spinner.failStep(`${emoji} ${stepName} ${RUN_MESSAGES.STEP_FAILED}`);

          // Show error and options
          console.log('');
          console.log(errorDisplay.render(new Error('Adım başarısız oldu'), {
            retryAttempts: 1,
            maxRetries: 3,
          }));

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
