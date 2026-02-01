/**
 * Workflow Types
 * Defines types for BMAD workflow state management
 */

import type { BmadStepType } from './bmad.types.js';

/**
 * Step execution status
 */
export enum StepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

/**
 * Automation mode for steps
 */
export enum AutomationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

/**
 * Error information for a step
 */
export interface StepError {
  /** Error code for programmatic handling */
  code: string;
  /** User-friendly error message */
  message: string;
  /** Number of retry attempts made */
  retryCount: number;
}

/**
 * State of a single BMAD step
 */
export interface StepState {
  /** Step identifier */
  stepId: BmadStepType;
  /** Current status of the step */
  status: StepStatus;
  /** Automation mode for this step */
  automationMode: AutomationMode;
  /** ISO 8601 timestamp when step started */
  startedAt?: string;
  /** ISO 8601 timestamp when step completed */
  completedAt?: string;
  /** Error information if step failed */
  error?: StepError;
}

/**
 * Complete workflow state
 */
export interface WorkflowState {
  /** Index of the current step (0-11) */
  currentStepIndex: number;
  /** Map of step IDs to their states */
  steps: Map<BmadStepType, StepState>;
  /** Global automation mode */
  globalAutomationMode: AutomationMode;
  /** ISO 8601 timestamp when workflow started */
  startedAt?: string;
  /** ISO 8601 timestamp when workflow completed */
  completedAt?: string;
}

/**
 * Workflow event types
 */
export enum WorkflowEventType {
  STEP_STARTED = 'step-started',
  STEP_COMPLETED = 'step-completed',
  STEP_SKIPPED = 'step-skipped',
  STEP_RESET = 'step-reset',
  MODE_CHANGED = 'mode-changed',
  WORKFLOW_STARTED = 'workflow-started',
  WORKFLOW_COMPLETED = 'workflow-completed',
}

/**
 * Workflow event payload
 */
export interface WorkflowEvent {
  /** Type of event */
  type: WorkflowEventType;
  /** Step ID related to event (if applicable) */
  stepId?: BmadStepType;
  /** Previous state (for mode changes) */
  previousValue?: string;
  /** New state (for mode changes) */
  newValue?: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
}

/**
 * Callback function for workflow events
 */
export type WorkflowEventCallback = (event: WorkflowEvent) => void;

/**
 * Turkish error messages for workflow operations
 */
export const WORKFLOW_ERRORS = {
  INVALID_TRANSITION: 'Geçersiz durum geçişi: {from} → {to}',
  STEP_NOT_FOUND: 'Adım bulunamadı: {stepId}',
  STEP_NOT_PENDING: 'Bu adım başlatılamaz, durum: {status}',
  STEP_NOT_IN_PROGRESS: 'Bu adım tamamlanamaz, durum: {status}',
  ALREADY_IN_PROGRESS: 'Bu adım zaten işleniyor: {stepId}',
  WORKFLOW_COMPLETED: 'Workflow zaten tamamlandı',
  WORKFLOW_NOT_STARTED: 'Workflow henüz başlatılmadı',
} as const;
