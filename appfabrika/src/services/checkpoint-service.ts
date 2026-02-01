/**
 * Checkpoint Service
 * Handles saving and loading workflow state for crash recovery
 * Implements Story 7.4 - Checkpoint Save on Error
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { BmadStepType } from '../types/bmad.types.js';
import type { StepOutput, StepStatus } from '../types/step.types.js';
import type { LLMProvider } from '../types/config.types.js';
import type { AutomationTemplate } from '../types/project.types.js';

/**
 * Project information for checkpoint
 */
export interface CheckpointProjectInfo {
  /** Path to the project directory */
  projectPath: string;
  /** User's project idea */
  projectIdea: string;
  /** Selected LLM provider */
  llmProvider?: LLMProvider;
  /** Selected automation template */
  automationTemplate?: AutomationTemplate;
}

/**
 * Error information for checkpoint
 */
export interface CheckpointErrorInfo {
  /** Error code */
  code: string;
  /** User-friendly error message */
  message: string;
  /** Technical details (stack trace) */
  technicalDetails?: string;
  /** Step where error occurred */
  stepId: BmadStepType;
  /** Number of retry attempts made */
  retryCount: number;
  /** When the error occurred */
  occurredAt: string;
}

/**
 * Partial output from interrupted step
 */
export interface PartialOutput {
  /** Step that was interrupted */
  stepId: BmadStepType;
  /** Partial content captured */
  content: string;
  /** When the partial output was captured */
  capturedAt: string;
}

/**
 * Step status entry for serialization
 */
export interface StepStatusEntry {
  /** Step identifier */
  stepId: BmadStepType;
  /** Step status */
  status: StepStatus;
}

/**
 * Step output entry for serialization
 */
export interface StepOutputEntry {
  /** Step identifier */
  stepId: BmadStepType;
  /** Step output */
  output: StepOutput;
}

/**
 * Full workflow snapshot for crash recovery
 */
export interface WorkflowSnapshot {
  /** Snapshot version */
  version: '1.0.0';
  /** When the snapshot was saved */
  savedAt: string;
  /** Project information */
  projectInfo: CheckpointProjectInfo;
  /** Current step at time of snapshot */
  currentStep: BmadStepType;
  /** All step statuses */
  stepStatuses: StepStatusEntry[];
  /** Completed step outputs */
  completedOutputs: StepOutputEntry[];
  /** Partial output from interrupted step */
  partialOutput?: PartialOutput;
  /** Error information if snapshot is due to error */
  error?: CheckpointErrorInfo;
  /** Whether workflow can be resumed */
  resumable: boolean;
}

/**
 * Configuration for CheckpointService
 */
export interface CheckpointServiceConfig {
  /** Path to the project directory */
  projectPath: string;
}

/**
 * Turkish error messages for checkpoint operations
 */
export const CHECKPOINT_ERRORS = {
  SAVE_FAILED: 'Checkpoint kaydedilemedi: {reason}',
  LOAD_FAILED: 'Checkpoint yüklenemedi: {reason}',
  INVALID_FORMAT: 'Checkpoint formatı geçersiz',
  NOT_FOUND: 'Checkpoint bulunamadı',
  DIR_CREATE_FAILED: 'Checkpoint dizini oluşturulamadı',
} as const;

/**
 * Turkish messages for checkpoint operations
 */
export const CHECKPOINT_MESSAGES = {
  SAVED: 'İlerleme kaydedildi',
  LOADED: 'Checkpoint yüklendi',
  RESUMING: 'Kaldığı yerden devam ediliyor...',
} as const;

/**
 * Checkpoint file names
 */
const CHECKPOINT_FILES = {
  WORKFLOW_STATE: 'workflow-state.json',
  CHECKPOINTS_DIR: 'checkpoints',
} as const;

/**
 * Service for managing workflow checkpoints
 */
export class CheckpointService {
  private readonly projectPath: string;
  private readonly checkpointsDir: string;

  /**
   * Create a new CheckpointService
   * @param config - Service configuration
   */
  constructor(config: CheckpointServiceConfig) {
    this.projectPath = config.projectPath;
    this.checkpointsDir = join(config.projectPath, '.appfabrika', CHECKPOINT_FILES.CHECKPOINTS_DIR);
  }

  /**
   * Get the path to the workflow state checkpoint file
   */
  getCheckpointPath(): string {
    return join(this.checkpointsDir, CHECKPOINT_FILES.WORKFLOW_STATE);
  }

  /**
   * Save an error checkpoint when workflow stops due to error
   * @param snapshot - The workflow snapshot to save
   */
  async saveErrorCheckpoint(snapshot: WorkflowSnapshot): Promise<void> {
    try {
      await mkdir(this.checkpointsDir, { recursive: true });

      const checkpointPath = this.getCheckpointPath();
      await writeFile(checkpointPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(CHECKPOINT_ERRORS.SAVE_FAILED.replace('{reason}', reason));
    }
  }

  /**
   * Capture current workflow state as a snapshot
   * @param projectInfo - Project information
   * @param currentStep - Current step being executed
   * @param stepStatuses - Map of all step statuses
   * @param completedOutputs - Map of completed step outputs
   * @param error - Error information if snapshot is due to error
   * @param partialOutput - Partial output from interrupted step
   */
  captureWorkflowState(
    projectInfo: CheckpointProjectInfo,
    currentStep: BmadStepType,
    stepStatuses: Map<BmadStepType, StepStatus>,
    completedOutputs: Map<BmadStepType, StepOutput>,
    error?: CheckpointErrorInfo,
    partialOutput?: PartialOutput
  ): WorkflowSnapshot {
    // Convert Maps to arrays for JSON serialization
    const stepStatusEntries: StepStatusEntry[] = [];
    for (const [stepId, status] of stepStatuses) {
      stepStatusEntries.push({ stepId, status });
    }

    const outputEntries: StepOutputEntry[] = [];
    for (const [stepId, output] of completedOutputs) {
      outputEntries.push({ stepId, output });
    }

    return {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      projectInfo,
      currentStep,
      stepStatuses: stepStatusEntries,
      completedOutputs: outputEntries,
      partialOutput,
      error,
      resumable: true,
    };
  }

  /**
   * Save a partial output when step is interrupted
   * @param stepId - Step that was interrupted
   * @param content - Partial content captured
   */
  createPartialOutput(stepId: BmadStepType, content: string): PartialOutput {
    return {
      stepId,
      content,
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Create error info for checkpoint
   * @param error - The error that occurred
   * @param stepId - Step where error occurred
   * @param retryCount - Number of retry attempts made
   */
  createErrorInfo(
    error: unknown,
    stepId: BmadStepType,
    retryCount: number
  ): CheckpointErrorInfo {
    let code = 'E999';
    let message = 'Bilinmeyen bir hata oluştu';
    let technicalDetails: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      technicalDetails = error.stack;

      // Try to extract error code if available
      if ('code' in error && typeof error.code === 'string') {
        code = error.code;
      }
    }

    return {
      code,
      message,
      technicalDetails,
      stepId,
      retryCount,
      occurredAt: new Date().toISOString(),
    };
  }

  /**
   * Load the latest workflow checkpoint
   * @returns The workflow snapshot or null if not found
   */
  async loadLatestCheckpoint(): Promise<WorkflowSnapshot | null> {
    const checkpointPath = this.getCheckpointPath();

    if (!existsSync(checkpointPath)) {
      return null;
    }

    try {
      const content = await readFile(checkpointPath, 'utf-8');
      const snapshot = JSON.parse(content) as WorkflowSnapshot;

      // Validate basic structure
      if (!snapshot.version || !snapshot.projectInfo || !snapshot.currentStep) {
        throw new Error(CHECKPOINT_ERRORS.INVALID_FORMAT);
      }

      return snapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(CHECKPOINT_ERRORS.LOAD_FAILED.replace('{reason}', reason));
    }
  }

  /**
   * Check if a resumable checkpoint exists
   */
  async hasResumableCheckpoint(): Promise<boolean> {
    const snapshot = await this.loadLatestCheckpoint();
    return snapshot !== null && snapshot.resumable === true;
  }

  /**
   * Convert step statuses from snapshot back to Map
   * @param snapshot - The workflow snapshot
   */
  restoreStepStatuses(snapshot: WorkflowSnapshot): Map<BmadStepType, StepStatus> {
    const map = new Map<BmadStepType, StepStatus>();
    for (const entry of snapshot.stepStatuses) {
      map.set(entry.stepId, entry.status);
    }
    return map;
  }

  /**
   * Convert completed outputs from snapshot back to Map
   * @param snapshot - The workflow snapshot
   */
  restoreCompletedOutputs(snapshot: WorkflowSnapshot): Map<BmadStepType, StepOutput> {
    const map = new Map<BmadStepType, StepOutput>();
    for (const entry of snapshot.completedOutputs) {
      map.set(entry.stepId, entry.output);
    }
    return map;
  }

  /**
   * Delete the checkpoint after successful resume
   */
  async clearCheckpoint(): Promise<void> {
    const checkpointPath = this.getCheckpointPath();

    if (existsSync(checkpointPath)) {
      const { unlink } = await import('node:fs/promises');
      await unlink(checkpointPath);
    }
  }

  /**
   * Callback function for retry service to save checkpoint on error
   * @param projectInfo - Project information
   * @param currentStep - Current step being executed
   * @param stepStatuses - Map of all step statuses
   * @param completedOutputs - Map of completed step outputs
   * @param error - The error that occurred
   * @param retryCount - Number of retry attempts made
   * @param partialContent - Partial content from interrupted step
   */
  async onErrorSaveCheckpoint(
    projectInfo: CheckpointProjectInfo,
    currentStep: BmadStepType,
    stepStatuses: Map<BmadStepType, StepStatus>,
    completedOutputs: Map<BmadStepType, StepOutput>,
    error: unknown,
    retryCount: number,
    partialContent?: string
  ): Promise<void> {
    const errorInfo = this.createErrorInfo(error, currentStep, retryCount);
    const partialOutput = partialContent
      ? this.createPartialOutput(currentStep, partialContent)
      : undefined;

    const snapshot = this.captureWorkflowState(
      projectInfo,
      currentStep,
      stepStatuses,
      completedOutputs,
      errorInfo,
      partialOutput
    );

    await this.saveErrorCheckpoint(snapshot);
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
let instance: CheckpointService | null = null;

/**
 * Get or create the singleton CheckpointService instance
 * @param config - Required on first call
 * @returns The CheckpointService instance
 */
export function getCheckpointService(config?: CheckpointServiceConfig): CheckpointService {
  if (!instance) {
    if (!config) {
      throw new Error('CheckpointService config gerekli (ilk çağrı için)');
    }
    instance = new CheckpointService(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCheckpointService(): void {
  instance = null;
}
