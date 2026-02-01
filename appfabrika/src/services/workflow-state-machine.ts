/**
 * Workflow State Machine
 * Manages BMAD workflow state and transitions (ADR-004)
 */

import { BmadStepType, BMAD_STEPS } from '../types/bmad.types.js';
import {
  StepStatus,
  AutomationMode,
  WorkflowEventType,
  WORKFLOW_ERRORS,
  type StepState,
  type WorkflowState,
  type WorkflowEvent,
  type WorkflowEventCallback,
} from '../types/workflow.types.js';

/**
 * State machine for managing BMAD workflow execution
 * Tracks step states, automation modes, and emits events on state changes
 */
export class WorkflowStateMachine {
  private state: WorkflowState;
  private listeners: Map<WorkflowEventType, Set<WorkflowEventCallback>>;

  /**
   * Create a new workflow state machine
   * @param automationMode - Initial automation mode for all steps (default: AUTO)
   */
  constructor(automationMode: AutomationMode = AutomationMode.AUTO) {
    this.listeners = new Map();

    // Initialize listeners for each event type
    for (const eventType of Object.values(WorkflowEventType)) {
      this.listeners.set(eventType, new Set());
    }

    // Initialize all steps in pending state
    const steps = new Map<BmadStepType, StepState>();
    for (const stepId of BMAD_STEPS) {
      steps.set(stepId, {
        stepId,
        status: StepStatus.PENDING,
        automationMode,
      });
    }

    this.state = {
      currentStepIndex: 0,
      steps,
      globalAutomationMode: automationMode,
    };
  }

  // ============================================
  // State Queries
  // ============================================

  /**
   * Get the current step being executed
   * @returns The current BmadStepType
   */
  getCurrentStep(): BmadStepType {
    return BMAD_STEPS[this.state.currentStepIndex];
  }

  /**
   * Get the current step index (0-11)
   * @returns The current step index
   */
  getCurrentStepIndex(): number {
    return this.state.currentStepIndex;
  }

  /**
   * Get the state of a specific step
   * @param stepId - The step to get state for
   * @returns The step state
   * @throws Error if step not found
   */
  getStepState(stepId: BmadStepType): StepState {
    const stepState = this.state.steps.get(stepId);
    if (!stepState) {
      throw new Error(
        WORKFLOW_ERRORS.STEP_NOT_FOUND.replace('{stepId}', stepId)
      );
    }
    return { ...stepState };
  }

  /**
   * Get all step states in order
   * @returns Array of all step states
   */
  getAllStepStates(): StepState[] {
    return BMAD_STEPS.map((stepId) => {
      const state = this.state.steps.get(stepId);
      return state ? { ...state } : this.createDefaultStepState(stepId);
    });
  }

  /**
   * Check if the workflow is complete
   * @returns true if all steps are completed or skipped
   */
  isComplete(): boolean {
    for (const stepState of this.state.steps.values()) {
      if (
        stepState.status !== StepStatus.COMPLETED &&
        stepState.status !== StepStatus.SKIPPED
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if the workflow has started
   * @returns true if any step has been started
   */
  isStarted(): boolean {
    return this.state.startedAt !== undefined;
  }

  /**
   * Get the global automation mode
   * @returns The global automation mode
   */
  getGlobalAutomationMode(): AutomationMode {
    return this.state.globalAutomationMode;
  }

  // ============================================
  // State Transitions
  // ============================================

  /**
   * Start a step - transitions from pending to in-progress
   * @param stepId - The step to start
   * @throws Error if step cannot be started
   */
  startStep(stepId: BmadStepType): void {
    const stepState = this.getStepState(stepId);

    // Only pending steps can be started
    if (stepState.status !== StepStatus.PENDING) {
      throw new Error(
        WORKFLOW_ERRORS.STEP_NOT_PENDING.replace('{status}', stepState.status)
      );
    }

    const now = new Date().toISOString();

    // Start workflow if this is the first step
    if (!this.state.startedAt) {
      this.state.startedAt = now;
      this.emit({
        type: WorkflowEventType.WORKFLOW_STARTED,
        timestamp: now,
      });
    }

    // Update step state
    this.updateStepState(stepId, {
      status: StepStatus.IN_PROGRESS,
      startedAt: now,
    });

    // Update current step index
    const stepIndex = BMAD_STEPS.indexOf(stepId);
    if (stepIndex >= 0) {
      this.state.currentStepIndex = stepIndex;
    }

    this.emit({
      type: WorkflowEventType.STEP_STARTED,
      stepId,
      timestamp: now,
    });
  }

  /**
   * Complete a step - transitions from in-progress to completed
   * @param stepId - The step to complete
   * @throws Error if step cannot be completed
   */
  completeStep(stepId: BmadStepType): void {
    const stepState = this.getStepState(stepId);

    // Only in-progress steps can be completed
    if (stepState.status !== StepStatus.IN_PROGRESS) {
      throw new Error(
        WORKFLOW_ERRORS.STEP_NOT_IN_PROGRESS.replace(
          '{status}',
          stepState.status
        )
      );
    }

    const now = new Date().toISOString();

    // Update step state
    this.updateStepState(stepId, {
      status: StepStatus.COMPLETED,
      completedAt: now,
    });

    this.emit({
      type: WorkflowEventType.STEP_COMPLETED,
      stepId,
      timestamp: now,
    });

    // Check if workflow is complete
    if (this.isComplete()) {
      this.state.completedAt = now;
      this.emit({
        type: WorkflowEventType.WORKFLOW_COMPLETED,
        timestamp: now,
      });
    }
  }

  /**
   * Skip a step - transitions to skipped
   * Can skip from pending or in-progress
   * @param stepId - The step to skip
   */
  skipStep(stepId: BmadStepType): void {
    const stepState = this.getStepState(stepId);

    // Can skip from pending or in-progress
    if (
      stepState.status !== StepStatus.PENDING &&
      stepState.status !== StepStatus.IN_PROGRESS
    ) {
      throw new Error(
        WORKFLOW_ERRORS.INVALID_TRANSITION.replace('{from}', stepState.status).replace(
          '{to}',
          StepStatus.SKIPPED
        )
      );
    }

    const now = new Date().toISOString();

    // Update step state
    this.updateStepState(stepId, {
      status: StepStatus.SKIPPED,
      completedAt: now,
    });

    this.emit({
      type: WorkflowEventType.STEP_SKIPPED,
      stepId,
      timestamp: now,
    });

    // Check if workflow is complete
    if (this.isComplete()) {
      this.state.completedAt = now;
      this.emit({
        type: WorkflowEventType.WORKFLOW_COMPLETED,
        timestamp: now,
      });
    }
  }

  /**
   * Navigate to a specific step - resets it to pending for re-execution
   * Allows revisiting skipped or completed steps
   * @param stepId - The step to navigate to
   */
  goToStep(stepId: BmadStepType): void {
    const stepState = this.getStepState(stepId);

    // Only completed or skipped steps can be reset via goToStep
    if (
      stepState.status !== StepStatus.COMPLETED &&
      stepState.status !== StepStatus.SKIPPED
    ) {
      // If already pending, just update current index
      if (stepState.status === StepStatus.PENDING) {
        const stepIndex = BMAD_STEPS.indexOf(stepId);
        if (stepIndex >= 0) {
          this.state.currentStepIndex = stepIndex;
        }
        return;
      }

      throw new Error(
        WORKFLOW_ERRORS.INVALID_TRANSITION.replace('{from}', stepState.status).replace(
          '{to}',
          StepStatus.PENDING
        )
      );
    }

    const now = new Date().toISOString();

    // Reset step to pending
    this.updateStepState(stepId, {
      status: StepStatus.PENDING,
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
    });

    // Update current step index
    const stepIndex = BMAD_STEPS.indexOf(stepId);
    if (stepIndex >= 0) {
      this.state.currentStepIndex = stepIndex;
    }

    // Clear workflow completion if we're going back
    this.state.completedAt = undefined;

    // Emit step reset event
    this.emit({
      type: WorkflowEventType.STEP_RESET,
      stepId,
      timestamp: now,
    });
  }

  // ============================================
  // Automation Control
  // ============================================

  /**
   * Set automation mode for a specific step
   * @param stepId - The step to configure
   * @param mode - The automation mode to set
   */
  setStepAutomationMode(stepId: BmadStepType, mode: AutomationMode): void {
    const stepState = this.getStepState(stepId);
    const previousMode = stepState.automationMode;

    if (previousMode === mode) {
      return; // No change needed
    }

    this.updateStepState(stepId, { automationMode: mode });

    this.emit({
      type: WorkflowEventType.MODE_CHANGED,
      stepId,
      previousValue: previousMode,
      newValue: mode,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Set global automation mode - affects all steps
   * @param mode - The automation mode to set globally
   */
  setGlobalAutomationMode(mode: AutomationMode): void {
    const previousMode = this.state.globalAutomationMode;

    if (previousMode === mode) {
      return; // No change needed
    }

    this.state.globalAutomationMode = mode;

    // Update all steps that haven't started yet
    for (const stepState of this.state.steps.values()) {
      if (stepState.status === StepStatus.PENDING) {
        stepState.automationMode = mode;
      }
    }

    this.emit({
      type: WorkflowEventType.MODE_CHANGED,
      previousValue: previousMode,
      newValue: mode,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get automation mode for a specific step
   * @param stepId - The step to get mode for
   * @returns The automation mode for the step
   */
  getAutomationMode(stepId: BmadStepType): AutomationMode {
    return this.getStepState(stepId).automationMode;
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to workflow events
   * @param eventType - The event type to listen for
   * @param callback - The callback function to invoke
   */
  on(eventType: WorkflowEventType, callback: WorkflowEventCallback): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.add(callback);
    }
  }

  /**
   * Unsubscribe from workflow events
   * @param eventType - The event type to stop listening for
   * @param callback - The callback function to remove
   */
  off(eventType: WorkflowEventType, callback: WorkflowEventCallback): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private updateStepState(
    stepId: BmadStepType,
    updates: Partial<StepState>
  ): void {
    const currentState = this.state.steps.get(stepId);
    if (currentState) {
      this.state.steps.set(stepId, { ...currentState, ...updates });
    }
  }

  private createDefaultStepState(stepId: BmadStepType): StepState {
    return {
      stepId,
      status: StepStatus.PENDING,
      automationMode: this.state.globalAutomationMode,
    };
  }

  private emit(event: WorkflowEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(event);
        } catch {
          // Ignore callback errors to prevent breaking the state machine
        }
      }
    }
  }
}

/**
 * Singleton instance for convenience
 */
let instance: WorkflowStateMachine | null = null;

/**
 * Get the singleton WorkflowStateMachine instance
 * @param automationMode - Initial automation mode (only used if creating new instance)
 * @returns The WorkflowStateMachine instance
 */
export function getWorkflowStateMachine(
  automationMode?: AutomationMode
): WorkflowStateMachine {
  if (!instance) {
    instance = new WorkflowStateMachine(automationMode);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetWorkflowStateMachine(): void {
  instance = null;
}
