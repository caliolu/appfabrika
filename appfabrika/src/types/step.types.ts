/**
 * Step Types
 * Defines types for BMAD step registry and handlers
 */

import type { BmadStepType } from './bmad.types.js';
import type { AutomationMode } from './workflow.types.js';
import type { LLMProvider } from './config.types.js';

/**
 * Step category grouping
 */
export enum StepCategory {
  /** Steps 1-4: Brainstorming, Research, Product Brief, PRD */
  BUSINESS = 'business',
  /** Steps 5-7: UX Design, Architecture, Epics & Stories */
  DESIGN = 'design',
  /** Steps 8-12: Sprint Planning, Tech Spec, Dev, Review, QA */
  TECHNICAL = 'technical',
}

/**
 * Input for step handler execution
 */
export interface StepInput {
  /** The prompt to send to LLM */
  prompt: string;
  /** Outputs from previous steps */
  previousOutputs: Map<BmadStepType, StepOutput>;
  /** User's original project idea */
  projectIdea?: string;
}

/**
 * Context for step execution
 */
export interface StepContext {
  /** Path to the project directory */
  projectPath: string;
  /** Current automation mode */
  automationMode: AutomationMode;
  /** LLM provider to use */
  llmProvider: LLMProvider;
}

/**
 * Output from step handler execution
 */
export interface StepOutput {
  /** The main content output */
  content: string;
  /** List of files created/modified */
  files?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Handler function for executing a step
 */
export type StepHandler = (
  input: StepInput,
  context: StepContext
) => Promise<StepOutput>;

/**
 * Definition of a BMAD step
 */
export interface StepDefinition {
  /** Step identifier (e.g., step-01-brainstorming) */
  id: BmadStepType;
  /** Turkish display name */
  name: string;
  /** Turkish description */
  description: string;
  /** Category grouping */
  category: StepCategory;
  /** Path to prompt template file */
  templatePath: string;
  /** Optional custom handler */
  handler?: StepHandler;
  /** Steps that must complete before this one */
  requiredInputs?: BmadStepType[];
}

/**
 * Turkish error messages for registry operations
 */
export const REGISTRY_ERRORS = {
  STEP_NOT_FOUND: 'Adım bulunamadı: {stepId}',
  STEP_ALREADY_EXISTS: 'Adım zaten kayıtlı: {stepId}',
  HANDLER_NOT_FOUND: 'Handler bulunamadı: {stepId}',
  INVALID_STEP_DEFINITION: 'Geçersiz adım tanımı: {field} eksik',
} as const;

/**
 * Turkish error messages for step executor operations
 */
export const EXECUTOR_ERRORS = {
  TEMPLATE_NOT_FOUND: 'Şablon bulunamadı: {stepId}',
  TEMPLATE_READ_FAILED: 'Şablon okunamadı: {path}',
  CHECKPOINT_WRITE_FAILED: 'Checkpoint yazılamadı: {stepId}',
  CHECKPOINT_READ_FAILED: 'Checkpoint okunamadı: {stepId}',
  CHECKPOINT_INVALID: 'Checkpoint formatı geçersiz: {stepId}',
} as const;

/**
 * Context for step execution
 */
export interface StepExecutionContext {
  /** Path to the project directory */
  projectPath: string;
  /** User's original project idea */
  projectIdea: string;
  /** Outputs from previous steps */
  previousOutputs: Map<BmadStepType, StepOutput>;
  /** Current automation mode for the step */
  automationMode?: 'auto' | 'manual';
}

/**
 * Step execution status (ADR-002)
 */
export type StepStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';

/**
 * Automation mode for step execution (ADR-002)
 */
export type CheckpointAutomationMode = 'auto' | 'manual';

/**
 * Error information stored in checkpoint (ADR-002)
 */
export interface CheckpointError {
  /** Error code (e.g., E001) */
  code: string;
  /** User-friendly error message */
  message: string;
  /** Number of retry attempts */
  retryCount: number;
}

/**
 * Checkpoint data structure for persisted step outputs (ADR-002)
 * Supports crash recovery and workflow resume functionality
 */
export interface StepCheckpoint {
  /** Step identifier (e.g., step-01-brainstorming) */
  stepId: BmadStepType;
  /** Current status of the step */
  status: StepStatus;
  /** Automation mode used for this step */
  automationMode: CheckpointAutomationMode;
  /** When step execution started (ISO 8601) */
  startedAt?: string;
  /** When step execution completed (ISO 8601) */
  completedAt?: string;
  /** Execution duration in ms */
  duration?: number;
  /** Step output data (present when status is 'completed') */
  output?: StepOutput;
  /** Error information (present when step failed) */
  error?: CheckpointError;
}

/**
 * Legacy checkpoint format for backward compatibility
 */
export interface LegacyStepCheckpoint {
  stepId: BmadStepType;
  executedAt: string;
  duration: number;
  success: boolean;
  output: StepOutput;
}

/**
 * Options for saving checkpoints
 */
export interface SaveCheckpointOptions {
  /** Automation mode for the step */
  automationMode?: CheckpointAutomationMode;
  /** When step execution started */
  startedAt?: string;
  /** Error information if step failed */
  error?: CheckpointError;
}

/**
 * Type guard to check if checkpoint is legacy format
 */
export function isLegacyCheckpoint(checkpoint: unknown): checkpoint is LegacyStepCheckpoint {
  const cp = checkpoint as LegacyStepCheckpoint;
  return (
    typeof cp === 'object' &&
    cp !== null &&
    'executedAt' in cp &&
    'success' in cp &&
    !('status' in cp)
  );
}
