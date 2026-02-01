/**
 * Step Executor Service
 * Executes BMAD steps by loading templates, filling context, and invoking Claude Code
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { BmadStepType } from '../types/bmad.types.js';
import { BMAD_STEP_NAMES } from '../types/bmad.types.js';
import {
  type StepOutput,
  type StepExecutionContext,
  type StepCheckpoint,
  type LegacyStepCheckpoint,
  type SaveCheckpointOptions,
  type StepStatus,
  type CheckpointAutomationMode,
  EXECUTOR_ERRORS,
  isLegacyCheckpoint,
} from '../types/step.types.js';
import type { BmadStepRegistry } from './bmad-step-registry.js';
import type { ClaudeCodeAdapter } from '../adapters/claude-code/claude-code.adapter.js';

/**
 * Template variable patterns
 */
const TEMPLATE_VARS = {
  PROJECT_IDEA: /\{\{projectIdea\}\}/g,
  STEP_NAME: /\{\{stepName\}\}/g,
  ALL_PREVIOUS_OUTPUTS: /\{\{allPreviousOutputs\}\}/g,
  PREVIOUS_OUTPUT: /\{\{previousOutput\.([^}]+)\}\}/g,
} as const;

/**
 * Executes BMAD steps with template loading and checkpoint persistence
 */
export class StepExecutor {
  private readonly registry: BmadStepRegistry;
  private readonly claudeCode: ClaudeCodeAdapter;
  private readonly templatesDir: string;
  private readonly checkpointsDir: string;

  /**
   * Create a new step executor
   * @param registry - The BMAD step registry
   * @param claudeCode - The Claude Code adapter
   * @param projectPath - Path to the project directory
   */
  constructor(
    registry: BmadStepRegistry,
    claudeCode: ClaudeCodeAdapter,
    projectPath: string
  ) {
    this.registry = registry;
    this.claudeCode = claudeCode;
    // Templates are in the package's templates directory
    this.templatesDir = join(dirname(new URL(import.meta.url).pathname), '../../templates');
    this.checkpointsDir = join(projectPath, '.appfabrika', 'checkpoints');
  }

  /**
   * Load a prompt template for a step
   * @param stepId - The step to load template for
   * @returns The template content
   * @throws Error if template not found
   */
  async loadPromptTemplate(stepId: BmadStepType): Promise<string> {
    const templatePath = join(this.templatesDir, `${stepId}.md`);

    try {
      const content = await readFile(templatePath, 'utf-8');
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          EXECUTOR_ERRORS.TEMPLATE_NOT_FOUND.replace('{stepId}', stepId)
        );
      }
      throw new Error(
        EXECUTOR_ERRORS.TEMPLATE_READ_FAILED.replace('{path}', templatePath)
      );
    }
  }

  /**
   * Fill template variables with context values
   * @param template - The template string
   * @param context - The execution context
   * @param stepId - The current step ID
   * @returns The filled template
   */
  fillTemplate(template: string, context: StepExecutionContext, stepId: BmadStepType): string {
    let filled = template;

    // Replace {{projectIdea}}
    filled = filled.replace(TEMPLATE_VARS.PROJECT_IDEA, context.projectIdea);

    // Replace {{stepName}}
    filled = filled.replace(TEMPLATE_VARS.STEP_NAME, BMAD_STEP_NAMES[stepId]);

    // Replace {{allPreviousOutputs}}
    const allOutputs = this.formatAllOutputs(context.previousOutputs);
    filled = filled.replace(TEMPLATE_VARS.ALL_PREVIOUS_OUTPUTS, allOutputs);

    // Replace {{previousOutput.stepId}}
    filled = filled.replace(TEMPLATE_VARS.PREVIOUS_OUTPUT, (_match, outputStepId) => {
      const output = context.previousOutputs.get(outputStepId as BmadStepType);
      return output?.content ?? '';
    });

    return filled;
  }

  /**
   * Execute a BMAD step
   * @param stepId - The step to execute
   * @param context - The execution context
   * @returns The step output
   */
  async executeStep(stepId: BmadStepType, context: StepExecutionContext): Promise<StepOutput> {
    const startedAt = new Date().toISOString();
    const automationMode = context.automationMode ?? 'auto';

    // Mark step as started
    await this.markStepStarted(stepId, automationMode);

    // Load template
    const template = await this.loadPromptTemplate(stepId);

    // Fill template with context
    const prompt = this.fillTemplate(template, context, stepId);

    try {
      // Execute via Claude Code
      const output = await this.claudeCode.executeStep(stepId, prompt);

      // Save checkpoint with full metadata
      await this.saveCheckpoint(stepId, output, {
        automationMode,
        startedAt,
      });

      return output;
    } catch (error) {
      // Save error checkpoint for crash recovery
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.saveCheckpoint(
        stepId,
        { content: '', metadata: { success: false } },
        {
          automationMode,
          startedAt,
          error: {
            code: 'E010', // Claude Code error
            message: errorMessage,
            retryCount: 0,
          },
        }
      );
      throw error;
    }
  }

  /**
   * Save step output as checkpoint (ADR-002 compliant)
   * @param stepId - The step that was executed
   * @param output - The step output
   * @param options - Additional checkpoint options
   */
  async saveCheckpoint(
    stepId: BmadStepType,
    output: StepOutput,
    options?: SaveCheckpointOptions
  ): Promise<void> {
    try {
      // Ensure checkpoints directory exists
      await mkdir(this.checkpointsDir, { recursive: true });

      const now = new Date().toISOString();
      const duration = (output.metadata?.duration as number) ?? 0;
      const success = (output.metadata?.success as boolean) ?? true;

      // Determine status based on success and error
      let status: StepStatus = 'completed';
      if (options?.error) {
        status = 'in-progress'; // Failed during execution
      } else if (!success) {
        status = 'in-progress';
      }

      const checkpoint: StepCheckpoint = {
        stepId,
        status,
        automationMode: options?.automationMode ?? 'auto',
        startedAt: options?.startedAt ?? now,
        completedAt: status === 'completed' ? now : undefined,
        duration,
        output,
        error: options?.error,
      };

      const checkpointPath = join(this.checkpointsDir, `${stepId}.json`);
      await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        EXECUTOR_ERRORS.CHECKPOINT_WRITE_FAILED.replace('{stepId}', stepId) +
        ` (${errorMessage})`
      );
    }
  }

  /**
   * Mark a step as started (creates pending checkpoint)
   * @param stepId - The step being started
   * @param automationMode - The automation mode for this step
   */
  async markStepStarted(
    stepId: BmadStepType,
    automationMode: CheckpointAutomationMode = 'auto'
  ): Promise<void> {
    try {
      await mkdir(this.checkpointsDir, { recursive: true });

      const checkpoint: StepCheckpoint = {
        stepId,
        status: 'in-progress',
        automationMode,
        startedAt: new Date().toISOString(),
      };

      const checkpointPath = join(this.checkpointsDir, `${stepId}.json`);
      await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        EXECUTOR_ERRORS.CHECKPOINT_WRITE_FAILED.replace('{stepId}', stepId) +
        ` (${errorMessage})`
      );
    }
  }

  /**
   * Mark a step as skipped
   * @param stepId - The step being skipped
   * @param automationMode - The automation mode for this step
   */
  async markStepSkipped(
    stepId: BmadStepType,
    automationMode: CheckpointAutomationMode = 'auto'
  ): Promise<void> {
    try {
      await mkdir(this.checkpointsDir, { recursive: true });

      const now = new Date().toISOString();
      const checkpoint: StepCheckpoint = {
        stepId,
        status: 'skipped',
        automationMode,
        startedAt: now,
        completedAt: now,
        duration: 0,
      };

      const checkpointPath = join(this.checkpointsDir, `${stepId}.json`);
      await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        EXECUTOR_ERRORS.CHECKPOINT_WRITE_FAILED.replace('{stepId}', stepId) +
        ` (${errorMessage})`
      );
    }
  }

  /**
   * Load a checkpoint for a step (handles legacy format)
   * @param stepId - The step to load checkpoint for
   * @returns The step output or null if not found
   */
  async loadCheckpoint(stepId: BmadStepType): Promise<StepOutput | null> {
    const checkpointPath = join(this.checkpointsDir, `${stepId}.json`);

    try {
      const content = await readFile(checkpointPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Handle legacy format
      if (isLegacyCheckpoint(parsed)) {
        return parsed.output;
      }

      // Handle new format
      const checkpoint = parsed as StepCheckpoint;
      return checkpoint.output ?? null;
    } catch (error) {
      // File not found is expected - return null
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      // JSON parse errors or other read errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        EXECUTOR_ERRORS.CHECKPOINT_READ_FAILED.replace('{stepId}', stepId) +
        ` (${errorMessage})`
      );
    }
  }

  /**
   * Load full checkpoint metadata for a step
   * @param stepId - The step to load checkpoint for
   * @returns The full checkpoint or null if not found
   */
  async loadCheckpointMetadata(stepId: BmadStepType): Promise<StepCheckpoint | null> {
    const checkpointPath = join(this.checkpointsDir, `${stepId}.json`);

    try {
      const content = await readFile(checkpointPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Handle legacy format - convert to new format
      if (isLegacyCheckpoint(parsed)) {
        return this.convertLegacyCheckpoint(parsed);
      }

      return parsed as StepCheckpoint;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        EXECUTOR_ERRORS.CHECKPOINT_READ_FAILED.replace('{stepId}', stepId) +
        ` (${errorMessage})`
      );
    }
  }

  /**
   * Convert legacy checkpoint to new format
   * @param legacy - The legacy checkpoint
   * @returns Converted checkpoint in new format
   */
  private convertLegacyCheckpoint(legacy: LegacyStepCheckpoint): StepCheckpoint {
    return {
      stepId: legacy.stepId,
      status: legacy.success ? 'completed' : 'in-progress',
      automationMode: 'auto',
      startedAt: legacy.executedAt,
      completedAt: legacy.success ? legacy.executedAt : undefined,
      duration: legacy.duration,
      output: legacy.output,
    };
  }

  /**
   * Check if a step has been completed
   * @param stepId - The step to check
   * @returns True if step is completed or skipped
   */
  async isStepCompleted(stepId: BmadStepType): Promise<boolean> {
    const checkpoint = await this.loadCheckpointMetadata(stepId);
    if (!checkpoint) return false;
    return checkpoint.status === 'completed' || checkpoint.status === 'skipped';
  }

  /**
   * Get the status of a step
   * @param stepId - The step to check
   * @returns The step status or 'pending' if no checkpoint
   */
  async getStepStatus(stepId: BmadStepType): Promise<StepStatus> {
    const checkpoint = await this.loadCheckpointMetadata(stepId);
    return checkpoint?.status ?? 'pending';
  }

  /**
   * Load all available checkpoints
   * @returns Map of step outputs keyed by step ID
   */
  async loadAllCheckpoints(): Promise<Map<BmadStepType, StepOutput>> {
    const outputs = new Map<BmadStepType, StepOutput>();

    if (!existsSync(this.checkpointsDir)) {
      return outputs;
    }

    // Get all registered steps
    const steps = this.registry.getAllSteps();

    for (const step of steps) {
      const output = await this.loadCheckpoint(step.id);
      if (output) {
        outputs.set(step.id, output);
      }
    }

    return outputs;
  }

  /**
   * Load all checkpoint metadata
   * @returns Map of full checkpoints keyed by step ID
   */
  async loadAllCheckpointMetadata(): Promise<Map<BmadStepType, StepCheckpoint>> {
    const checkpoints = new Map<BmadStepType, StepCheckpoint>();

    if (!existsSync(this.checkpointsDir)) {
      return checkpoints;
    }

    const steps = this.registry.getAllSteps();

    for (const step of steps) {
      const checkpoint = await this.loadCheckpointMetadata(step.id);
      if (checkpoint) {
        checkpoints.set(step.id, checkpoint);
      }
    }

    return checkpoints;
  }

  /**
   * Get workflow progress summary
   * @returns Summary of step statuses
   */
  async getWorkflowProgress(): Promise<{
    total: number;
    completed: number;
    skipped: number;
    inProgress: number;
    pending: number;
  }> {
    const steps = this.registry.getAllSteps();
    const checkpoints = await this.loadAllCheckpointMetadata();

    let completed = 0;
    let skipped = 0;
    let inProgress = 0;

    for (const step of steps) {
      const checkpoint = checkpoints.get(step.id);
      if (!checkpoint) continue;

      switch (checkpoint.status) {
        case 'completed':
          completed++;
          break;
        case 'skipped':
          skipped++;
          break;
        case 'in-progress':
          inProgress++;
          break;
      }
    }

    return {
      total: steps.length,
      completed,
      skipped,
      inProgress,
      pending: steps.length - completed - skipped - inProgress,
    };
  }

  /**
   * Format all previous outputs as a string for template insertion
   * @param outputs - Map of previous step outputs
   * @returns Formatted string
   */
  private formatAllOutputs(outputs: Map<BmadStepType, StepOutput>): string {
    if (outputs.size === 0) {
      return '(Henüz önceki adım çıktısı yok)';
    }

    const formatted: string[] = [];

    for (const [stepId, output] of outputs) {
      const stepName = BMAD_STEP_NAMES[stepId];
      formatted.push(`## ${stepName}\n\n${output.content}`);
    }

    return formatted.join('\n\n---\n\n');
  }

  /**
   * Get the templates directory path
   */
  getTemplatesDir(): string {
    return this.templatesDir;
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
let instance: StepExecutor | null = null;

/**
 * Get or create the singleton StepExecutor instance
 * @param registry - Required on first call
 * @param claudeCode - Required on first call
 * @param projectPath - Required on first call
 * @returns The StepExecutor instance
 */
export function getStepExecutor(
  registry?: BmadStepRegistry,
  claudeCode?: ClaudeCodeAdapter,
  projectPath?: string
): StepExecutor {
  if (!instance) {
    if (!registry || !claudeCode || !projectPath) {
      throw new Error('StepExecutor parametreleri gerekli (ilk çağrı için)');
    }
    instance = new StepExecutor(registry, claudeCode, projectPath);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetStepExecutor(): void {
  instance = null;
}
