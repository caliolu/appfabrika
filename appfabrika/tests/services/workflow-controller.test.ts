/**
 * Workflow Controller Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import {
  WorkflowController,
  getWorkflowController,
  resetWorkflowController,
  WorkflowAction,
  CONTROLLER_ERRORS,
  CONTROLLER_MESSAGES,
} from '../../src/services/workflow-controller.js';
import {
  WorkflowStateMachine,
  resetWorkflowStateMachine,
} from '../../src/services/workflow-state-machine.js';
import {
  StepExecutor,
  resetStepExecutor,
} from '../../src/services/step-executor.js';
import {
  BmadStepRegistry,
  resetBmadStepRegistry,
} from '../../src/services/bmad-step-registry.js';
import { ClaudeCodeAdapter, resetClaudeCodeAdapter } from '../../src/adapters/claude-code/claude-code.adapter.js';
import { BmadStepType, BMAD_STEP_NAMES } from '../../src/types/bmad.types.js';
import { StepStatus, AutomationMode } from '../../src/types/workflow.types.js';

// Test directories
const TEST_PROJECT_PATH = join(process.cwd(), '.test-workflow-controller');

describe('WorkflowController', () => {
  let controller: WorkflowController;
  let stateMachine: WorkflowStateMachine;
  let executor: StepExecutor;
  let registry: BmadStepRegistry;
  let claudeCode: ClaudeCodeAdapter;

  beforeEach(() => {
    resetWorkflowController();
    resetWorkflowStateMachine();
    resetStepExecutor();
    resetBmadStepRegistry();
    resetClaudeCodeAdapter();

    // Clean up test directory
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    mkdirSync(TEST_PROJECT_PATH, { recursive: true });

    stateMachine = new WorkflowStateMachine();
    registry = new BmadStepRegistry();
    claudeCode = new ClaudeCodeAdapter({
      projectPath: TEST_PROJECT_PATH,
      timeout: 5000,
    });
    executor = new StepExecutor(registry, claudeCode, TEST_PROJECT_PATH);

    controller = new WorkflowController(stateMachine, executor);
  });

  afterEach(() => {
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    resetWorkflowController();
    resetWorkflowStateMachine();
    resetStepExecutor();
    resetBmadStepRegistry();
    resetClaudeCodeAdapter();
  });

  describe('skipCurrentStep', () => {
    it('should skip pending step', async () => {
      const result = await controller.skipCurrentStep();

      expect(result.success).toBe(true);
      expect(result.stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(result.message).toContain('atlandı');

      const stepState = stateMachine.getStepState(BmadStepType.BRAINSTORMING);
      expect(stepState.status).toBe(StepStatus.SKIPPED);
    });

    it('should skip in-progress step', async () => {
      stateMachine.startStep(BmadStepType.BRAINSTORMING);

      const result = await controller.skipCurrentStep();

      expect(result.success).toBe(true);
      expect(stateMachine.getStepState(BmadStepType.BRAINSTORMING).status).toBe(
        StepStatus.SKIPPED
      );
    });

    it('should fail to skip completed step', async () => {
      stateMachine.startStep(BmadStepType.BRAINSTORMING);
      stateMachine.completeStep(BmadStepType.BRAINSTORMING);

      const result = await controller.skipCurrentStep();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Tamamlanmış');
    });

    it('should save skip checkpoint', async () => {
      vi.spyOn(executor, 'markStepSkipped').mockResolvedValue(undefined);

      await controller.skipCurrentStep();

      expect(executor.markStepSkipped).toHaveBeenCalledWith(
        BmadStepType.BRAINSTORMING,
        'auto'
      );
    });
  });

  describe('goToPreviousStep', () => {
    it('should fail when on first step', () => {
      const result = controller.goToPreviousStep();

      expect(result.success).toBe(false);
      expect(result.message).toContain('İlk adımdan');
    });

    it('should go back to previous completed step', () => {
      // Complete first step and move to second
      stateMachine.startStep(BmadStepType.BRAINSTORMING);
      stateMachine.completeStep(BmadStepType.BRAINSTORMING);
      stateMachine.startStep(BmadStepType.RESEARCH);

      const result = controller.goToPreviousStep();

      expect(result.success).toBe(true);
      expect(result.stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(result.newStepIndex).toBe(0);
    });

    it('should reset previous step to pending', () => {
      stateMachine.startStep(BmadStepType.BRAINSTORMING);
      stateMachine.completeStep(BmadStepType.BRAINSTORMING);
      stateMachine.startStep(BmadStepType.RESEARCH);

      controller.goToPreviousStep();

      const stepState = stateMachine.getStepState(BmadStepType.BRAINSTORMING);
      expect(stepState.status).toBe(StepStatus.PENDING);
    });
  });

  describe('goToStep', () => {
    it('should fail for invalid step index', () => {
      const result = controller.goToStep(-1);
      expect(result.success).toBe(false);

      const result2 = controller.goToStep(100);
      expect(result2.success).toBe(false);
    });

    it('should go to specific completed step', () => {
      // Complete first two steps
      stateMachine.startStep(BmadStepType.BRAINSTORMING);
      stateMachine.completeStep(BmadStepType.BRAINSTORMING);
      stateMachine.startStep(BmadStepType.RESEARCH);
      stateMachine.completeStep(BmadStepType.RESEARCH);
      stateMachine.startStep(BmadStepType.PRODUCT_BRIEF);

      const result = controller.goToStep(0);

      expect(result.success).toBe(true);
      expect(result.stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(result.newStepIndex).toBe(0);
    });
  });

  describe('setCurrentStepAutomation', () => {
    it('should set manual mode', () => {
      const result = controller.setCurrentStepAutomation(AutomationMode.MANUAL);

      expect(result.success).toBe(true);
      expect(result.message).toContain('manuel');

      const stepState = stateMachine.getStepState(BmadStepType.BRAINSTORMING);
      expect(stepState.automationMode).toBe(AutomationMode.MANUAL);
    });

    it('should set auto mode', () => {
      // First set to manual
      controller.setCurrentStepAutomation(AutomationMode.MANUAL);

      // Then back to auto
      const result = controller.setCurrentStepAutomation(AutomationMode.AUTO);

      expect(result.success).toBe(true);
      expect(result.message).toContain('otomatik');
    });
  });

  describe('switchToManual / switchToAuto', () => {
    it('should switch to manual mode', () => {
      const result = controller.switchToManual();

      expect(result.success).toBe(true);
      expect(stateMachine.getAutomationMode(BmadStepType.BRAINSTORMING)).toBe(
        AutomationMode.MANUAL
      );
    });

    it('should switch to auto mode', () => {
      controller.switchToManual();
      const result = controller.switchToAuto();

      expect(result.success).toBe(true);
      expect(stateMachine.getAutomationMode(BmadStepType.BRAINSTORMING)).toBe(
        AutomationMode.AUTO
      );
    });
  });

  describe('pause / resume', () => {
    it('should pause workflow', () => {
      controller.pause();
      expect(controller.isPausedState()).toBe(true);
    });

    it('should resume workflow', () => {
      controller.pause();
      controller.resume();
      expect(controller.isPausedState()).toBe(false);
    });
  });

  describe('getCurrentStepInfo', () => {
    it('should return current step information', () => {
      const info = controller.getCurrentStepInfo();

      expect(info.stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(info.stepName).toBe(BMAD_STEP_NAMES[BmadStepType.BRAINSTORMING]);
      expect(info.stepIndex).toBe(0);
      expect(info.status).toBe(StepStatus.PENDING);
      expect(info.automationMode).toBe(AutomationMode.AUTO);
    });

    it('should reflect state changes', () => {
      stateMachine.startStep(BmadStepType.BRAINSTORMING);
      controller.switchToManual();

      const info = controller.getCurrentStepInfo();

      expect(info.status).toBe(StepStatus.IN_PROGRESS);
      expect(info.automationMode).toBe(AutomationMode.MANUAL);
    });
  });

  describe('getAvailableActions', () => {
    it('should include skip for pending step', () => {
      const actions = controller.getAvailableActions();
      expect(actions).toContain(WorkflowAction.SKIP);
    });

    it('should not include back for first step', () => {
      const actions = controller.getAvailableActions();
      expect(actions).not.toContain(WorkflowAction.BACK);
    });

    it('should include back for non-first step', () => {
      stateMachine.startStep(BmadStepType.BRAINSTORMING);
      stateMachine.completeStep(BmadStepType.BRAINSTORMING);
      stateMachine.startStep(BmadStepType.RESEARCH);

      const actions = controller.getAvailableActions();
      expect(actions).toContain(WorkflowAction.BACK);
    });

    it('should include correct mode switch option', () => {
      let actions = controller.getAvailableActions();
      expect(actions).toContain(WorkflowAction.MANUAL);
      expect(actions).not.toContain(WorkflowAction.AUTO);

      controller.switchToManual();

      actions = controller.getAvailableActions();
      expect(actions).toContain(WorkflowAction.AUTO);
      expect(actions).not.toContain(WorkflowAction.MANUAL);
    });
  });

  describe('executeAction', () => {
    it('should execute SKIP action', async () => {
      const result = await controller.executeAction(WorkflowAction.SKIP);
      expect(result.success).toBe(true);
    });

    it('should execute MANUAL action', async () => {
      const result = await controller.executeAction(WorkflowAction.MANUAL);
      expect(result.success).toBe(true);
      expect(stateMachine.getAutomationMode(BmadStepType.BRAINSTORMING)).toBe(
        AutomationMode.MANUAL
      );
    });

    it('should execute AUTO action', async () => {
      controller.switchToManual();
      const result = await controller.executeAction(WorkflowAction.AUTO);
      expect(result.success).toBe(true);
    });

    it('should execute PAUSE action', async () => {
      const result = await controller.executeAction(WorkflowAction.PAUSE);
      expect(result.success).toBe(true);
      expect(controller.isPausedState()).toBe(true);
    });

    it('should execute RESUME action', async () => {
      controller.pause();
      const result = await controller.executeAction(WorkflowAction.RESUME);
      expect(result.success).toBe(true);
      expect(controller.isPausedState()).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same instance on subsequent calls', () => {
      const instance1 = getWorkflowController(stateMachine, executor);
      const instance2 = getWorkflowController();

      expect(instance1).toBe(instance2);
    });

    it('should throw when getting without parameters', () => {
      resetWorkflowController();

      expect(() => {
        getWorkflowController();
      }).toThrow('parametreleri gerekli');
    });

    it('should return new instance after reset', () => {
      const instance1 = getWorkflowController(stateMachine, executor);
      resetWorkflowController();
      const instance2 = getWorkflowController(stateMachine, executor);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Turkish error messages', () => {
    it('should have Turkish error messages', () => {
      expect(CONTROLLER_ERRORS.NO_CURRENT_STEP).toContain('Aktif');
      expect(CONTROLLER_ERRORS.CANNOT_SKIP_COMPLETED).toContain('Tamamlanmış');
      expect(CONTROLLER_ERRORS.CANNOT_GO_BACK_FIRST).toContain('İlk');
    });

    it('should have Turkish success messages', () => {
      expect(CONTROLLER_MESSAGES.STEP_SKIPPED).toContain('atlandı');
      expect(CONTROLLER_MESSAGES.WENT_BACK).toContain('geri');
      expect(CONTROLLER_MESSAGES.MODE_CHANGED_MANUAL).toContain('manuel');
    });
  });
});
