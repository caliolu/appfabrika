/**
 * Workflow State Machine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WorkflowStateMachine,
  getWorkflowStateMachine,
  resetWorkflowStateMachine,
} from '../../src/services/workflow-state-machine.js';
import { BmadStepType, BMAD_STEPS } from '../../src/types/bmad.types.js';
import {
  StepStatus,
  AutomationMode,
  WorkflowEventType,
} from '../../src/types/workflow.types.js';

describe('WorkflowStateMachine', () => {
  let machine: WorkflowStateMachine;

  beforeEach(() => {
    resetWorkflowStateMachine();
    machine = new WorkflowStateMachine();
  });

  describe('initialization', () => {
    it('should initialize all 12 steps in pending status', () => {
      const states = machine.getAllStepStates();
      expect(states).toHaveLength(12);
      states.forEach((state) => {
        expect(state.status).toBe(StepStatus.PENDING);
      });
    });

    it('should initialize with AUTO automation mode by default', () => {
      const states = machine.getAllStepStates();
      states.forEach((state) => {
        expect(state.automationMode).toBe(AutomationMode.AUTO);
      });
    });

    it('should initialize with MANUAL automation mode when specified', () => {
      const manualMachine = new WorkflowStateMachine(AutomationMode.MANUAL);
      const states = manualMachine.getAllStepStates();
      states.forEach((state) => {
        expect(state.automationMode).toBe(AutomationMode.MANUAL);
      });
    });

    it('should set current step to first step (index 0)', () => {
      expect(machine.getCurrentStepIndex()).toBe(0);
      expect(machine.getCurrentStep()).toBe(BmadStepType.BRAINSTORMING);
    });

    it('should not be started initially', () => {
      expect(machine.isStarted()).toBe(false);
    });

    it('should not be complete initially', () => {
      expect(machine.isComplete()).toBe(false);
    });
  });

  describe('state queries', () => {
    it('should return step state for valid step', () => {
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(state.status).toBe(StepStatus.PENDING);
    });

    it('should throw error for invalid step', () => {
      expect(() => {
        machine.getStepState('invalid-step' as BmadStepType);
      }).toThrow('Adım bulunamadı');
    });

    it('should return all step states in order', () => {
      const states = machine.getAllStepStates();
      expect(states[0].stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(states[11].stepId).toBe(BmadStepType.QA_TESTING);
    });

    it('should return immutable copies of step states', () => {
      const state1 = machine.getStepState(BmadStepType.BRAINSTORMING);
      const state2 = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('startStep', () => {
    it('should transition pending step to in-progress', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.status).toBe(StepStatus.IN_PROGRESS);
    });

    it('should set startedAt timestamp', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.startedAt).toBeDefined();
      expect(new Date(state.startedAt!).getTime()).toBeGreaterThan(0);
    });

    it('should mark workflow as started', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      expect(machine.isStarted()).toBe(true);
    });

    it('should update current step index', () => {
      machine.startStep(BmadStepType.RESEARCH);
      expect(machine.getCurrentStep()).toBe(BmadStepType.RESEARCH);
      expect(machine.getCurrentStepIndex()).toBe(1);
    });

    it('should throw error when starting non-pending step', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      expect(() => {
        machine.startStep(BmadStepType.BRAINSTORMING);
      }).toThrow('Bu adım başlatılamaz');
    });
  });

  describe('completeStep', () => {
    it('should transition in-progress step to completed', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.completeStep(BmadStepType.BRAINSTORMING);
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.status).toBe(StepStatus.COMPLETED);
    });

    it('should set completedAt timestamp', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.completeStep(BmadStepType.BRAINSTORMING);
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.completedAt).toBeDefined();
    });

    it('should throw error when completing non-in-progress step', () => {
      expect(() => {
        machine.completeStep(BmadStepType.BRAINSTORMING);
      }).toThrow('Bu adım tamamlanamaz');
    });

    it('should mark workflow complete when all steps done', () => {
      // Complete all steps
      for (const step of BMAD_STEPS) {
        machine.startStep(step);
        machine.completeStep(step);
      }
      expect(machine.isComplete()).toBe(true);
    });
  });

  describe('skipStep', () => {
    it('should transition pending step to skipped', () => {
      machine.skipStep(BmadStepType.BRAINSTORMING);
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.status).toBe(StepStatus.SKIPPED);
    });

    it('should transition in-progress step to skipped', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.skipStep(BmadStepType.BRAINSTORMING);
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.status).toBe(StepStatus.SKIPPED);
    });

    it('should throw error when skipping completed step', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.completeStep(BmadStepType.BRAINSTORMING);
      expect(() => {
        machine.skipStep(BmadStepType.BRAINSTORMING);
      }).toThrow('Geçersiz durum geçişi');
    });

    it('should mark workflow complete when all steps skipped', () => {
      for (const step of BMAD_STEPS) {
        machine.skipStep(step);
      }
      expect(machine.isComplete()).toBe(true);
    });
  });

  describe('goToStep', () => {
    it('should reset completed step to pending', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.completeStep(BmadStepType.BRAINSTORMING);
      machine.goToStep(BmadStepType.BRAINSTORMING);
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.status).toBe(StepStatus.PENDING);
    });

    it('should reset skipped step to pending', () => {
      machine.skipStep(BmadStepType.BRAINSTORMING);
      machine.goToStep(BmadStepType.BRAINSTORMING);
      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.status).toBe(StepStatus.PENDING);
    });

    it('should update current step index', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.completeStep(BmadStepType.BRAINSTORMING);
      machine.startStep(BmadStepType.RESEARCH);
      machine.completeStep(BmadStepType.RESEARCH);

      machine.goToStep(BmadStepType.BRAINSTORMING);
      expect(machine.getCurrentStep()).toBe(BmadStepType.BRAINSTORMING);
    });

    it('should clear timestamps when resetting', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.completeStep(BmadStepType.BRAINSTORMING);
      machine.goToStep(BmadStepType.BRAINSTORMING);

      const state = machine.getStepState(BmadStepType.BRAINSTORMING);
      expect(state.startedAt).toBeUndefined();
      expect(state.completedAt).toBeUndefined();
    });

    it('should allow navigating to pending step without change', () => {
      machine.goToStep(BmadStepType.RESEARCH);
      expect(machine.getCurrentStep()).toBe(BmadStepType.RESEARCH);
      const state = machine.getStepState(BmadStepType.RESEARCH);
      expect(state.status).toBe(StepStatus.PENDING);
    });

    it('should throw error when going to in-progress step', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      expect(() => {
        machine.goToStep(BmadStepType.BRAINSTORMING);
      }).toThrow('Geçersiz durum geçişi');
    });

    it('should emit step-reset event when resetting step', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.STEP_RESET, callback);

      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.completeStep(BmadStepType.BRAINSTORMING);
      machine.goToStep(BmadStepType.BRAINSTORMING);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WorkflowEventType.STEP_RESET,
          stepId: BmadStepType.BRAINSTORMING,
        })
      );
    });
  });

  describe('automation mode', () => {
    it('should set step automation mode', () => {
      machine.setStepAutomationMode(BmadStepType.BRAINSTORMING, AutomationMode.MANUAL);
      expect(machine.getAutomationMode(BmadStepType.BRAINSTORMING)).toBe(AutomationMode.MANUAL);
    });

    it('should not affect other steps when setting individual mode', () => {
      machine.setStepAutomationMode(BmadStepType.BRAINSTORMING, AutomationMode.MANUAL);
      expect(machine.getAutomationMode(BmadStepType.RESEARCH)).toBe(AutomationMode.AUTO);
    });

    it('should set global automation mode', () => {
      machine.setGlobalAutomationMode(AutomationMode.MANUAL);
      expect(machine.getGlobalAutomationMode()).toBe(AutomationMode.MANUAL);
    });

    it('should update pending steps when setting global mode', () => {
      machine.setGlobalAutomationMode(AutomationMode.MANUAL);
      expect(machine.getAutomationMode(BmadStepType.BRAINSTORMING)).toBe(AutomationMode.MANUAL);
      expect(machine.getAutomationMode(BmadStepType.RESEARCH)).toBe(AutomationMode.MANUAL);
    });

    it('should not update non-pending steps when setting global mode', () => {
      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.setGlobalAutomationMode(AutomationMode.MANUAL);
      // In-progress step should keep its original mode
      expect(machine.getAutomationMode(BmadStepType.BRAINSTORMING)).toBe(AutomationMode.AUTO);
    });
  });

  describe('event system', () => {
    it('should emit step-started event', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.STEP_STARTED, callback);

      machine.startStep(BmadStepType.BRAINSTORMING);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WorkflowEventType.STEP_STARTED,
          stepId: BmadStepType.BRAINSTORMING,
        })
      );
    });

    it('should emit step-completed event', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.STEP_COMPLETED, callback);

      machine.startStep(BmadStepType.BRAINSTORMING);
      machine.completeStep(BmadStepType.BRAINSTORMING);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should emit step-skipped event', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.STEP_SKIPPED, callback);

      machine.skipStep(BmadStepType.BRAINSTORMING);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should emit workflow-started event on first step start', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.WORKFLOW_STARTED, callback);

      machine.startStep(BmadStepType.BRAINSTORMING);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should emit workflow-completed event when all steps done', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.WORKFLOW_COMPLETED, callback);

      for (const step of BMAD_STEPS) {
        machine.startStep(step);
        machine.completeStep(step);
      }

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should emit mode-changed event on step mode change', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.MODE_CHANGED, callback);

      machine.setStepAutomationMode(BmadStepType.BRAINSTORMING, AutomationMode.MANUAL);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WorkflowEventType.MODE_CHANGED,
          stepId: BmadStepType.BRAINSTORMING,
          previousValue: AutomationMode.AUTO,
          newValue: AutomationMode.MANUAL,
        })
      );
    });

    it('should emit mode-changed event on global mode change', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.MODE_CHANGED, callback);

      machine.setGlobalAutomationMode(AutomationMode.MANUAL);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WorkflowEventType.MODE_CHANGED,
          previousValue: AutomationMode.AUTO,
          newValue: AutomationMode.MANUAL,
        })
      );
    });

    it('should not emit mode-changed if mode is same', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.MODE_CHANGED, callback);

      machine.setGlobalAutomationMode(AutomationMode.AUTO); // Same as default

      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove listener with off()', () => {
      const callback = vi.fn();
      machine.on(WorkflowEventType.STEP_STARTED, callback);
      machine.off(WorkflowEventType.STEP_STARTED, callback);

      machine.startStep(BmadStepType.BRAINSTORMING);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      machine.on(WorkflowEventType.STEP_STARTED, callback1);
      machine.on(WorkflowEventType.STEP_STARTED, callback2);

      machine.startStep(BmadStepType.BRAINSTORMING);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      machine.on(WorkflowEventType.STEP_STARTED, errorCallback);
      machine.on(WorkflowEventType.STEP_STARTED, normalCallback);

      // Should not throw
      expect(() => {
        machine.startStep(BmadStepType.BRAINSTORMING);
      }).not.toThrow();

      // Other callbacks should still be called
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getWorkflowStateMachine();
      const instance2 = getWorkflowStateMachine();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = getWorkflowStateMachine();
      resetWorkflowStateMachine();
      const instance2 = getWorkflowStateMachine();
      expect(instance1).not.toBe(instance2);
    });

    it('should use provided automation mode for new instance', () => {
      resetWorkflowStateMachine();
      const instance = getWorkflowStateMachine(AutomationMode.MANUAL);
      expect(instance.getGlobalAutomationMode()).toBe(AutomationMode.MANUAL);
    });
  });
});
