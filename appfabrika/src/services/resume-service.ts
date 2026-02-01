/**
 * Resume Service
 * Handles resuming interrupted workflows from checkpoints
 * Implements Story 7.5 - Resume from Checkpoint
 */

import { rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { BmadStepType } from '../types/bmad.types.js';
import { BMAD_STEP_NAMES, BMAD_STEPS } from '../types/bmad.types.js';
import type { StepOutput, StepStatus } from '../types/step.types.js';
import {
  CheckpointService,
  type WorkflowSnapshot,
  type CheckpointProjectInfo,
} from './checkpoint-service.js';
import { WorkflowStateMachine } from './workflow-state-machine.js';
import { StepStatus as WorkflowStepStatus } from '../types/workflow.types.js';

/**
 * Resume information for user display
 */
export interface ResumeInfo {
  /** Whether a resumable checkpoint exists */
  canResume: boolean;
  /** Current step at time of interruption */
  currentStep?: BmadStepType;
  /** Current step name in Turkish */
  currentStepName?: string;
  /** Step number (1-12) */
  stepNumber?: number;
  /** Total steps */
  totalSteps: number;
  /** Number of completed steps */
  completedSteps?: number;
  /** When the checkpoint was saved */
  savedAt?: string;
  /** Error message if interrupted due to error */
  errorMessage?: string;
  /** Number of retry attempts before failure */
  retryCount?: number;
}

/**
 * Resume action chosen by user
 */
export enum ResumeAction {
  /** Resume from checkpoint */
  RESUME = 'resume',
  /** Start fresh from beginning */
  FRESH = 'fresh',
}

/**
 * Result of resume operation
 */
export interface ResumeResult {
  /** Whether the operation was successful */
  success: boolean;
  /** The action that was taken */
  action: ResumeAction;
  /** Step to start/resume from */
  startStep: BmadStepType;
  /** Restored step outputs (empty if fresh start) */
  restoredOutputs: Map<BmadStepType, StepOutput>;
  /** Message describing the result */
  message: string;
}

/**
 * Configuration for ResumeService
 */
export interface ResumeServiceConfig {
  /** Path to the project directory */
  projectPath: string;
}

/**
 * Turkish messages for resume operations
 */
export const RESUME_MESSAGES = {
  PREVIOUS_WORK_FOUND: 'Önceki çalışma yarıda kaldı',
  STEP_INFO: 'Adım {current}/{total} - {stepName}',
  RESUMING: 'Kaldığı yerden devam ediliyor...',
  STARTING_FRESH: 'Yeniden başlatılıyor...',
  RESUME_SUCCESS: '{stepName} adımından devam ediliyor',
  FRESH_SUCCESS: 'Workflow baştan başlatıldı',
  NO_CHECKPOINT: 'Devam edilecek checkpoint bulunamadı',
  CHECKPOINT_CLEARED: 'Önceki ilerleme temizlendi',
  ERROR_AT_STEP: 'Hata: {errorMessage}',
  RETRY_INFO: '{retryCount} deneme sonrası başarısız oldu',
} as const;

/**
 * Service for resuming interrupted workflows
 */
export class ResumeService {
  private readonly checkpointService: CheckpointService;
  private readonly projectPath: string;
  private readonly checkpointsDir: string;

  /**
   * Create a new ResumeService
   * @param config - Service configuration
   */
  constructor(config: ResumeServiceConfig) {
    this.projectPath = config.projectPath;
    this.checkpointsDir = join(config.projectPath, '.appfabrika', 'checkpoints');
    this.checkpointService = new CheckpointService({ projectPath: config.projectPath });
  }

  /**
   * Detect if a resumable checkpoint exists
   * @returns True if resume is possible
   */
  async detectResumableState(): Promise<boolean> {
    return this.checkpointService.hasResumableCheckpoint();
  }

  /**
   * Get resume information for user display
   * @returns Resume information or null if no checkpoint
   */
  async getResumeInfo(): Promise<ResumeInfo> {
    const snapshot = await this.checkpointService.loadLatestCheckpoint();

    if (!snapshot) {
      return {
        canResume: false,
        totalSteps: BMAD_STEPS.length,
      };
    }

    const stepIndex = BMAD_STEPS.indexOf(snapshot.currentStep);
    const completedSteps = snapshot.stepStatuses.filter(
      (s) => s.status === 'completed'
    ).length;

    return {
      canResume: snapshot.resumable,
      currentStep: snapshot.currentStep,
      currentStepName: BMAD_STEP_NAMES[snapshot.currentStep],
      stepNumber: stepIndex + 1,
      totalSteps: BMAD_STEPS.length,
      completedSteps,
      savedAt: snapshot.savedAt,
      errorMessage: snapshot.error?.message,
      retryCount: snapshot.error?.retryCount,
    };
  }

  /**
   * Format resume info as user-friendly message
   * @param info - Resume information
   * @returns Formatted message for display
   */
  formatResumeInfo(info: ResumeInfo): string {
    if (!info.canResume) {
      return RESUME_MESSAGES.NO_CHECKPOINT;
    }

    const lines: string[] = [];

    // Main message
    lines.push(RESUME_MESSAGES.PREVIOUS_WORK_FOUND);

    // Step info
    if (info.stepNumber && info.currentStepName) {
      lines.push(
        RESUME_MESSAGES.STEP_INFO
          .replace('{current}', String(info.stepNumber))
          .replace('{total}', String(info.totalSteps))
          .replace('{stepName}', info.currentStepName)
      );
    }

    // Error info
    if (info.errorMessage) {
      lines.push(
        RESUME_MESSAGES.ERROR_AT_STEP.replace('{errorMessage}', info.errorMessage)
      );
    }

    // Retry info
    if (info.retryCount !== undefined && info.retryCount > 0) {
      lines.push(
        RESUME_MESSAGES.RETRY_INFO.replace('{retryCount}', String(info.retryCount))
      );
    }

    return lines.join('\n');
  }

  /**
   * Resume workflow from checkpoint
   * @param stateMachine - State machine to restore
   * @returns Resume result with restored outputs
   */
  async resumeWorkflow(stateMachine: WorkflowStateMachine): Promise<ResumeResult> {
    const snapshot = await this.checkpointService.loadLatestCheckpoint();

    if (!snapshot) {
      return {
        success: false,
        action: ResumeAction.RESUME,
        startStep: BMAD_STEPS[0],
        restoredOutputs: new Map(),
        message: RESUME_MESSAGES.NO_CHECKPOINT,
      };
    }

    // Restore state machine
    this.restoreStateMachine(stateMachine, snapshot);

    // Rebuild outputs map
    const restoredOutputs = this.checkpointService.restoreCompletedOutputs(snapshot);

    // Determine resume step
    const resumeStep = this.determineResumeStep(snapshot);

    // Clear the error checkpoint now that we're resuming
    await this.checkpointService.clearCheckpoint();

    const stepName = BMAD_STEP_NAMES[resumeStep];
    return {
      success: true,
      action: ResumeAction.RESUME,
      startStep: resumeStep,
      restoredOutputs,
      message: RESUME_MESSAGES.RESUME_SUCCESS.replace('{stepName}', stepName),
    };
  }

  /**
   * Start fresh by clearing all checkpoints
   * @returns Resume result for fresh start
   */
  async startFresh(): Promise<ResumeResult> {
    await this.clearAllCheckpoints();

    return {
      success: true,
      action: ResumeAction.FRESH,
      startStep: BMAD_STEPS[0],
      restoredOutputs: new Map(),
      message: RESUME_MESSAGES.FRESH_SUCCESS,
    };
  }

  /**
   * Clear all checkpoint files
   */
  async clearAllCheckpoints(): Promise<void> {
    if (!existsSync(this.checkpointsDir)) {
      return;
    }

    try {
      const files = await readdir(this.checkpointsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.checkpointsDir, file);
          await rm(filePath, { force: true });
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Restore state machine from snapshot
   * @param stateMachine - State machine to restore
   * @param snapshot - Workflow snapshot
   */
  private restoreStateMachine(
    stateMachine: WorkflowStateMachine,
    snapshot: WorkflowSnapshot
  ): void {
    // Restore step statuses
    for (const entry of snapshot.stepStatuses) {
      const stepState = stateMachine.getStepState(entry.stepId);

      // Only update if status changed
      if (stepState.status === WorkflowStepStatus.PENDING) {
        if (entry.status === 'completed') {
          stateMachine.startStep(entry.stepId);
          stateMachine.completeStep(entry.stepId);
        } else if (entry.status === 'skipped') {
          stateMachine.skipStep(entry.stepId);
        } else if (entry.status === 'in-progress') {
          stateMachine.startStep(entry.stepId);
        }
      }
    }
  }

  /**
   * Determine which step to resume from
   * @param snapshot - Workflow snapshot
   * @returns Step to resume execution from
   */
  private determineResumeStep(snapshot: WorkflowSnapshot): BmadStepType {
    // If there's an error, resume from the failed step
    if (snapshot.error) {
      return snapshot.error.stepId;
    }

    // Otherwise, resume from current step
    return snapshot.currentStep;
  }

  /**
   * Get the checkpoint service instance
   */
  getCheckpointService(): CheckpointService {
    return this.checkpointService;
  }

  /**
   * Get the checkpoints directory path
   */
  getCheckpointsDir(): string {
    return this.checkpointsDir;
  }
}

/**
 * Singleton instance
 */
let instance: ResumeService | null = null;

/**
 * Get or create the singleton ResumeService instance
 * @param config - Required on first call
 * @returns The ResumeService instance
 */
export function getResumeService(config?: ResumeServiceConfig): ResumeService {
  if (!instance) {
    if (!config) {
      throw new Error('ResumeService config gerekli (ilk çağrı için)');
    }
    instance = new ResumeService(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetResumeService(): void {
  instance = null;
}
