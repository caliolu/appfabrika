/**
 * Workflow Runner Service
 * Orchestrates sequential execution of BMAD workflow steps
 */

import { BmadStepType, BMAD_STEPS, BMAD_STEP_NAMES } from '../types/bmad.types.js';
import { StepStatus, AutomationMode, WorkflowEventType } from '../types/workflow.types.js';
import type { StepOutput, StepExecutionContext } from '../types/step.types.js';
import { WorkflowStateMachine } from './workflow-state-machine.js';
import { StepExecutor } from './step-executor.js';
import { BmadStepRegistry } from './bmad-step-registry.js';
import { ManualStepDetector } from './manual-step-detector.js';

/**
 * Configuration for workflow execution
 */
export interface WorkflowConfig {
  /** Path to the project directory */
  projectPath: string;
  /** User's project idea */
  projectIdea: string;
  /** Global automation mode */
  automationMode?: AutomationMode;
  /** Callback for step completion */
  onStepComplete?: (stepId: BmadStepType, output: StepOutput) => void;
  /** Callback for step skip */
  onStepSkip?: (stepId: BmadStepType) => void;
  /** Callback for manual step detection */
  onManualStepDetected?: (stepId: BmadStepType, output: StepOutput) => void;
  /** Callback for workflow progress */
  onProgress?: (current: number, total: number, stepId: BmadStepType) => void;
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
  /** Whether the workflow completed successfully */
  success: boolean;
  /** Map of all step outputs */
  outputs: Map<BmadStepType, StepOutput>;
  /** Total number of steps completed */
  completedCount: number;
  /** Total number of steps skipped */
  skippedCount: number;
  /** Error if workflow failed */
  error?: Error;
  /** Step that failed (if any) */
  failedStep?: BmadStepType;
}

/**
 * Turkish error messages for workflow runner
 */
export const RUNNER_ERRORS = {
  WORKFLOW_ALREADY_RUNNING: 'Workflow zaten çalışıyor',
  NO_PROJECT_PATH: 'Proje yolu belirtilmedi',
  NO_PROJECT_IDEA: 'Proje fikri belirtilmedi',
  STEP_EXECUTION_FAILED: 'Adım çalıştırılamadı: {stepId}',
} as const;

/**
 * Orchestrates sequential execution of BMAD workflow steps
 */
export class WorkflowRunner {
  private readonly stateMachine: WorkflowStateMachine;
  private readonly executor: StepExecutor;
  private readonly registry: BmadStepRegistry;
  private isRunning: boolean = false;
  private projectPath: string = '';
  private projectIdea: string = '';

  /**
   * Create a new workflow runner
   * @param stateMachine - The workflow state machine
   * @param executor - The step executor
   * @param registry - The BMAD step registry
   */
  constructor(
    stateMachine: WorkflowStateMachine,
    executor: StepExecutor,
    registry: BmadStepRegistry
  ) {
    this.stateMachine = stateMachine;
    this.executor = executor;
    this.registry = registry;
  }

  /**
   * Run the complete BMAD workflow
   * @param config - Workflow configuration
   * @returns Workflow result
   */
  async runWorkflow(config: WorkflowConfig): Promise<WorkflowResult> {
    if (this.isRunning) {
      throw new Error(RUNNER_ERRORS.WORKFLOW_ALREADY_RUNNING);
    }

    if (!config.projectPath) {
      throw new Error(RUNNER_ERRORS.NO_PROJECT_PATH);
    }

    if (!config.projectIdea) {
      throw new Error(RUNNER_ERRORS.NO_PROJECT_IDEA);
    }

    this.isRunning = true;
    this.projectPath = config.projectPath;
    this.projectIdea = config.projectIdea;

    const outputs = new Map<BmadStepType, StepOutput>();
    let completedCount = 0;
    let skippedCount = 0;
    let failedStep: BmadStepType | undefined;
    let error: Error | undefined;

    try {
      // Load existing checkpoints for resume capability
      const existingOutputs = await this.executor.loadAllCheckpoints();
      for (const [stepId, output] of existingOutputs) {
        outputs.set(stepId, output);
      }

      // Execute steps in order
      for (let i = 0; i < BMAD_STEPS.length; i++) {
        const stepId = BMAD_STEPS[i];
        const stepState = this.stateMachine.getStepState(stepId);

        // Report progress
        if (config.onProgress) {
          config.onProgress(i + 1, BMAD_STEPS.length, stepId);
        }

        // Skip already completed or skipped steps
        if (
          stepState.status === StepStatus.COMPLETED ||
          stepState.status === StepStatus.SKIPPED
        ) {
          if (stepState.status === StepStatus.COMPLETED) {
            completedCount++;
          } else {
            skippedCount++;
          }
          continue;
        }

        // Check if step should be skipped based on automation mode
        const automationMode =
          stepState.automationMode ?? config.automationMode ?? AutomationMode.AUTO;

        if (automationMode === AutomationMode.SKIP) {
          this.stateMachine.skipStep(stepId);
          await this.executor.markStepSkipped(stepId);
          skippedCount++;
          if (config.onStepSkip) {
            config.onStepSkip(stepId);
          }
          continue;
        }

        // Check for manual step output when in MANUAL mode
        if (automationMode === AutomationMode.MANUAL) {
          const manualDetector = new ManualStepDetector({
            projectPath: this.projectPath,
          });

          const manualOutput = await manualDetector.loadManualOutput(stepId);
          if (manualOutput) {
            // Manual output detected - use it and continue
            if (stepState.status === StepStatus.PENDING) {
              this.stateMachine.startStep(stepId);
            }

            // Save as checkpoint
            await this.executor.saveCheckpoint(stepId, manualOutput, {
              automationMode: 'manual',
            });

            this.stateMachine.completeStep(stepId);
            outputs.set(stepId, manualOutput);
            completedCount++;

            if (config.onManualStepDetected) {
              config.onManualStepDetected(stepId, manualOutput);
            }
            if (config.onStepComplete) {
              config.onStepComplete(stepId, manualOutput);
            }
            continue;
          }
          // No manual output found - step will be executed as AUTO
          // In a real CLI, this would prompt the user to complete manually
        }

        // Execute step
        const context: StepExecutionContext = {
          projectPath: this.projectPath,
          projectIdea: this.projectIdea,
          previousOutputs: outputs,
          automationMode: automationMode === AutomationMode.AUTO ? 'auto' : 'manual',
        };

        try {
          // Update state machine
          if (stepState.status === StepStatus.PENDING) {
            this.stateMachine.startStep(stepId);
          }

          // Execute via executor
          const output = await this.executor.executeStep(stepId, context);

          // Update state and track output
          this.stateMachine.completeStep(stepId);
          outputs.set(stepId, output);
          completedCount++;

          if (config.onStepComplete) {
            config.onStepComplete(stepId, output);
          }
        } catch (stepError) {
          // Step failed - save state and stop workflow
          failedStep = stepId;
          error = stepError instanceof Error ? stepError : new Error(String(stepError));
          break;
        }
      }
    } finally {
      this.isRunning = false;
    }

    return {
      success: !error && this.stateMachine.isComplete(),
      outputs,
      completedCount,
      skippedCount,
      error,
      failedStep,
    };
  }

  /**
   * Resume workflow from last checkpoint
   * @param config - Workflow configuration
   * @returns Workflow result
   */
  async resumeWorkflow(config: WorkflowConfig): Promise<WorkflowResult> {
    // Load checkpoint metadata to restore state machine state
    const checkpoints = await this.executor.loadAllCheckpointMetadata();

    // Restore state machine from checkpoints
    for (const [stepId, checkpoint] of checkpoints) {
      const stepState = this.stateMachine.getStepState(stepId);

      if (checkpoint.status === 'completed' && stepState.status === StepStatus.PENDING) {
        // Mark as started then completed to trigger proper state transitions
        this.stateMachine.startStep(stepId);
        this.stateMachine.completeStep(stepId);
      } else if (checkpoint.status === 'skipped' && stepState.status === StepStatus.PENDING) {
        this.stateMachine.skipStep(stepId);
      }
      // in-progress steps will be re-executed
    }

    // Continue with normal workflow execution
    return this.runWorkflow(config);
  }

  /**
   * Check if workflow is currently running
   * @returns true if running
   */
  isWorkflowRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current workflow progress
   * @returns Progress object with counts
   */
  getProgress(): {
    total: number;
    completed: number;
    skipped: number;
    inProgress: number;
    pending: number;
    current: BmadStepType;
  } {
    const states = this.stateMachine.getAllStepStates();
    let completed = 0;
    let skipped = 0;
    let inProgress = 0;

    for (const state of states) {
      switch (state.status) {
        case StepStatus.COMPLETED:
          completed++;
          break;
        case StepStatus.SKIPPED:
          skipped++;
          break;
        case StepStatus.IN_PROGRESS:
          inProgress++;
          break;
      }
    }

    return {
      total: BMAD_STEPS.length,
      completed,
      skipped,
      inProgress,
      pending: BMAD_STEPS.length - completed - skipped - inProgress,
      current: this.stateMachine.getCurrentStep(),
    };
  }

  /**
   * Get state machine instance for direct access
   */
  getStateMachine(): WorkflowStateMachine {
    return this.stateMachine;
  }
}

/**
 * Singleton instance
 */
let instance: WorkflowRunner | null = null;

/**
 * Get or create the singleton WorkflowRunner instance
 * @param stateMachine - Required on first call
 * @param executor - Required on first call
 * @param registry - Required on first call
 * @returns The WorkflowRunner instance
 */
export function getWorkflowRunner(
  stateMachine?: WorkflowStateMachine,
  executor?: StepExecutor,
  registry?: BmadStepRegistry
): WorkflowRunner {
  if (!instance) {
    if (!stateMachine || !executor || !registry) {
      throw new Error('WorkflowRunner parametreleri gerekli (ilk çağrı için)');
    }
    instance = new WorkflowRunner(stateMachine, executor, registry);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetWorkflowRunner(): void {
  instance = null;
}
