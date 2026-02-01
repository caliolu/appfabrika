/**
 * Workflow Controller Service
 * Handles user interactions during BMAD workflow execution
 */

import { BmadStepType, BMAD_STEPS, BMAD_STEP_NAMES } from '../types/bmad.types.js';
import { StepStatus, AutomationMode } from '../types/workflow.types.js';
import { WorkflowStateMachine } from './workflow-state-machine.js';
import { StepExecutor } from './step-executor.js';

/**
 * User action types for workflow control
 */
export enum WorkflowAction {
  /** Skip the current step */
  SKIP = 'skip',
  /** Go back to previous step */
  BACK = 'back',
  /** Switch to manual mode */
  MANUAL = 'manual',
  /** Switch to auto mode */
  AUTO = 'auto',
  /** Retry current step */
  RETRY = 'retry',
  /** Pause workflow */
  PAUSE = 'pause',
  /** Resume workflow */
  RESUME = 'resume',
}

/**
 * Result of a controller action
 */
export interface ActionResult {
  /** Whether the action was successful */
  success: boolean;
  /** The affected step */
  stepId?: BmadStepType;
  /** Message describing the result */
  message: string;
  /** New step index after action */
  newStepIndex?: number;
}

/**
 * Turkish error messages for workflow control
 */
export const CONTROLLER_ERRORS = {
  NO_CURRENT_STEP: 'Aktif adım yok',
  CANNOT_SKIP_COMPLETED: 'Tamamlanmış adım atlanamaz',
  CANNOT_GO_BACK_FIRST: 'İlk adımdan geri gidilemez',
  CANNOT_GO_BACK_TO_STEP: 'Bu adıma geri gidilemez: {stepId}',
  INVALID_ACTION: 'Geçersiz aksiyon: {action}',
  WORKFLOW_NOT_STARTED: 'Workflow henüz başlamadı',
} as const;

/**
 * Turkish success messages for workflow control
 */
export const CONTROLLER_MESSAGES = {
  STEP_SKIPPED: '{stepName} adımı atlandı',
  WENT_BACK: '{stepName} adımına geri dönüldü',
  MODE_CHANGED_MANUAL: '{stepName} manuel moda geçirildi',
  MODE_CHANGED_AUTO: '{stepName} otomatik moda geçirildi',
} as const;

/**
 * Controls user interactions during workflow execution
 */
export class WorkflowController {
  private readonly stateMachine: WorkflowStateMachine;
  private readonly executor: StepExecutor;
  private isPaused: boolean = false;

  /**
   * Create a new workflow controller
   * @param stateMachine - The workflow state machine
   * @param executor - The step executor
   */
  constructor(stateMachine: WorkflowStateMachine, executor: StepExecutor) {
    this.stateMachine = stateMachine;
    this.executor = executor;
  }

  /**
   * Skip the current step
   * @returns Action result
   */
  async skipCurrentStep(): Promise<ActionResult> {
    const currentStep = this.stateMachine.getCurrentStep();
    const stepState = this.stateMachine.getStepState(currentStep);

    // Can only skip pending or in-progress steps
    if (
      stepState.status !== StepStatus.PENDING &&
      stepState.status !== StepStatus.IN_PROGRESS
    ) {
      return {
        success: false,
        stepId: currentStep,
        message: CONTROLLER_ERRORS.CANNOT_SKIP_COMPLETED,
      };
    }

    // Skip in state machine
    this.stateMachine.skipStep(currentStep);

    // Save skip checkpoint
    await this.executor.markStepSkipped(
      currentStep,
      stepState.automationMode === AutomationMode.MANUAL ? 'manual' : 'auto'
    );

    const stepName = BMAD_STEP_NAMES[currentStep];
    return {
      success: true,
      stepId: currentStep,
      message: CONTROLLER_MESSAGES.STEP_SKIPPED.replace('{stepName}', stepName),
      newStepIndex: this.stateMachine.getCurrentStepIndex(),
    };
  }

  /**
   * Go back to the previous step
   * @returns Action result
   */
  goToPreviousStep(): ActionResult {
    const currentIndex = this.stateMachine.getCurrentStepIndex();

    // Can't go back from first step
    if (currentIndex === 0) {
      return {
        success: false,
        message: CONTROLLER_ERRORS.CANNOT_GO_BACK_FIRST,
      };
    }

    const previousStepId = BMAD_STEPS[currentIndex - 1];

    // Use goToStep to reset the previous step
    try {
      this.stateMachine.goToStep(previousStepId);

      const stepName = BMAD_STEP_NAMES[previousStepId];
      return {
        success: true,
        stepId: previousStepId,
        message: CONTROLLER_MESSAGES.WENT_BACK.replace('{stepName}', stepName),
        newStepIndex: currentIndex - 1,
      };
    } catch {
      return {
        success: false,
        stepId: previousStepId,
        message: CONTROLLER_ERRORS.CANNOT_GO_BACK_TO_STEP.replace(
          '{stepId}',
          previousStepId
        ),
      };
    }
  }

  /**
   * Go to a specific step by index
   * @param stepIndex - The step index to go to (0-11)
   * @returns Action result
   */
  goToStep(stepIndex: number): ActionResult {
    if (stepIndex < 0 || stepIndex >= BMAD_STEPS.length) {
      return {
        success: false,
        message: CONTROLLER_ERRORS.INVALID_ACTION.replace(
          '{action}',
          `goToStep(${stepIndex})`
        ),
      };
    }

    const targetStepId = BMAD_STEPS[stepIndex];

    try {
      this.stateMachine.goToStep(targetStepId);

      const stepName = BMAD_STEP_NAMES[targetStepId];
      return {
        success: true,
        stepId: targetStepId,
        message: CONTROLLER_MESSAGES.WENT_BACK.replace('{stepName}', stepName),
        newStepIndex: stepIndex,
      };
    } catch {
      return {
        success: false,
        stepId: targetStepId,
        message: CONTROLLER_ERRORS.CANNOT_GO_BACK_TO_STEP.replace(
          '{stepId}',
          targetStepId
        ),
      };
    }
  }

  /**
   * Set automation mode for current step
   * @param mode - The automation mode to set
   * @returns Action result
   */
  setCurrentStepAutomation(mode: AutomationMode): ActionResult {
    const currentStep = this.stateMachine.getCurrentStep();

    this.stateMachine.setStepAutomationMode(currentStep, mode);

    const stepName = BMAD_STEP_NAMES[currentStep];
    const message =
      mode === AutomationMode.MANUAL
        ? CONTROLLER_MESSAGES.MODE_CHANGED_MANUAL
        : CONTROLLER_MESSAGES.MODE_CHANGED_AUTO;

    return {
      success: true,
      stepId: currentStep,
      message: message.replace('{stepName}', stepName),
    };
  }

  /**
   * Set automation mode for a specific step
   * @param stepId - The step to configure
   * @param mode - The automation mode to set
   * @returns Action result
   */
  setStepAutomation(stepId: BmadStepType, mode: AutomationMode): ActionResult {
    this.stateMachine.setStepAutomationMode(stepId, mode);

    const stepName = BMAD_STEP_NAMES[stepId];
    const message =
      mode === AutomationMode.MANUAL
        ? CONTROLLER_MESSAGES.MODE_CHANGED_MANUAL
        : CONTROLLER_MESSAGES.MODE_CHANGED_AUTO;

    return {
      success: true,
      stepId,
      message: message.replace('{stepName}', stepName),
    };
  }

  /**
   * Switch current step to manual mode
   * @returns Action result
   */
  switchToManual(): ActionResult {
    return this.setCurrentStepAutomation(AutomationMode.MANUAL);
  }

  /**
   * Switch current step to auto mode
   * @returns Action result
   */
  switchToAuto(): ActionResult {
    return this.setCurrentStepAutomation(AutomationMode.AUTO);
  }

  /**
   * Pause the workflow
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the workflow
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Check if workflow is paused
   */
  isPausedState(): boolean {
    return this.isPaused;
  }

  /**
   * Get current step information
   */
  getCurrentStepInfo(): {
    stepId: BmadStepType;
    stepName: string;
    stepIndex: number;
    status: StepStatus;
    automationMode: AutomationMode;
  } {
    const currentStep = this.stateMachine.getCurrentStep();
    const stepState = this.stateMachine.getStepState(currentStep);

    return {
      stepId: currentStep,
      stepName: BMAD_STEP_NAMES[currentStep],
      stepIndex: this.stateMachine.getCurrentStepIndex(),
      status: stepState.status,
      automationMode: stepState.automationMode,
    };
  }

  /**
   * Get available actions for current step
   */
  getAvailableActions(): WorkflowAction[] {
    const currentIndex = this.stateMachine.getCurrentStepIndex();
    const stepState = this.stateMachine.getStepState(
      this.stateMachine.getCurrentStep()
    );

    const actions: WorkflowAction[] = [];

    // Can skip if pending or in-progress
    if (
      stepState.status === StepStatus.PENDING ||
      stepState.status === StepStatus.IN_PROGRESS
    ) {
      actions.push(WorkflowAction.SKIP);
    }

    // Can go back if not first step
    if (currentIndex > 0) {
      actions.push(WorkflowAction.BACK);
    }

    // Can always switch modes
    if (stepState.automationMode === AutomationMode.AUTO) {
      actions.push(WorkflowAction.MANUAL);
    } else {
      actions.push(WorkflowAction.AUTO);
    }

    // Can pause/resume
    if (this.isPaused) {
      actions.push(WorkflowAction.RESUME);
    } else {
      actions.push(WorkflowAction.PAUSE);
    }

    return actions;
  }

  /**
   * Execute an action
   * @param action - The action to execute
   * @returns Action result
   */
  async executeAction(action: WorkflowAction): Promise<ActionResult> {
    switch (action) {
      case WorkflowAction.SKIP:
        return this.skipCurrentStep();
      case WorkflowAction.BACK:
        return this.goToPreviousStep();
      case WorkflowAction.MANUAL:
        return this.switchToManual();
      case WorkflowAction.AUTO:
        return this.switchToAuto();
      case WorkflowAction.PAUSE:
        this.pause();
        return { success: true, message: 'Workflow duraklatıldı' };
      case WorkflowAction.RESUME:
        this.resume();
        return { success: true, message: 'Workflow devam ediyor' };
      default:
        return {
          success: false,
          message: CONTROLLER_ERRORS.INVALID_ACTION.replace(
            '{action}',
            String(action)
          ),
        };
    }
  }
}

/**
 * Singleton instance
 */
let instance: WorkflowController | null = null;

/**
 * Get or create the singleton WorkflowController instance
 * @param stateMachine - Required on first call
 * @param executor - Required on first call
 * @returns The WorkflowController instance
 */
export function getWorkflowController(
  stateMachine?: WorkflowStateMachine,
  executor?: StepExecutor
): WorkflowController {
  if (!instance) {
    if (!stateMachine || !executor) {
      throw new Error('WorkflowController parametreleri gerekli (ilk çağrı için)');
    }
    instance = new WorkflowController(stateMachine, executor);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetWorkflowController(): void {
  instance = null;
}
