/**
 * Workflow Runner Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import {
  WorkflowRunner,
  getWorkflowRunner,
  resetWorkflowRunner,
  RUNNER_ERRORS,
  type WorkflowConfig,
} from '../../src/services/workflow-runner.js';
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
import { BmadStepType, BMAD_STEPS } from '../../src/types/bmad.types.js';
import { StepStatus, AutomationMode } from '../../src/types/workflow.types.js';
import type { StepOutput } from '../../src/types/step.types.js';

// Test directories
const TEST_PROJECT_PATH = join(process.cwd(), '.test-workflow-runner');

describe('WorkflowRunner', () => {
  let runner: WorkflowRunner;
  let stateMachine: WorkflowStateMachine;
  let executor: StepExecutor;
  let registry: BmadStepRegistry;
  let claudeCode: ClaudeCodeAdapter;

  beforeEach(() => {
    resetWorkflowRunner();
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

    runner = new WorkflowRunner(stateMachine, executor, registry);
  });

  afterEach(() => {
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    resetWorkflowRunner();
    resetWorkflowStateMachine();
    resetStepExecutor();
    resetBmadStepRegistry();
    resetClaudeCodeAdapter();
  });

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(runner).toBeDefined();
      expect(runner.getStateMachine()).toBe(stateMachine);
    });
  });

  describe('runWorkflow', () => {
    it('should throw error if workflow already running', async () => {
      // Start a workflow that will hang
      const config: WorkflowConfig = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
      };

      // Mock executeStep to never resolve
      vi.spyOn(executor, 'executeStep').mockImplementation(
        () => new Promise(() => {})
      );

      // Start workflow without awaiting
      const runPromise = runner.runWorkflow(config);

      // Try to start another workflow
      await expect(runner.runWorkflow(config)).rejects.toThrow(
        RUNNER_ERRORS.WORKFLOW_ALREADY_RUNNING
      );

      // Cancel the hanging promise (not needed for test but good practice)
      vi.restoreAllMocks();
    });

    it('should throw error if project path missing', async () => {
      const config = {
        projectPath: '',
        projectIdea: 'Test',
      } as WorkflowConfig;

      await expect(runner.runWorkflow(config)).rejects.toThrow(
        RUNNER_ERRORS.NO_PROJECT_PATH
      );
    });

    it('should throw error if project idea missing', async () => {
      const config = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: '',
      } as WorkflowConfig;

      await expect(runner.runWorkflow(config)).rejects.toThrow(
        RUNNER_ERRORS.NO_PROJECT_IDEA
      );
    });

    it('should execute all steps sequentially', async () => {
      const executedSteps: BmadStepType[] = [];

      vi.spyOn(executor, 'executeStep').mockImplementation(
        async (stepId: BmadStepType) => {
          executedSteps.push(stepId);
          return { content: `Output for ${stepId}` };
        }
      );

      const config: WorkflowConfig = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
      };

      const result = await runner.runWorkflow(config);

      expect(result.success).toBe(true);
      expect(executedSteps.length).toBe(12);
      // Verify order
      for (let i = 0; i < BMAD_STEPS.length; i++) {
        expect(executedSteps[i]).toBe(BMAD_STEPS[i]);
      }
    });

    it('should pass previous outputs to each step', async () => {
      const contexts: Map<BmadStepType, StepOutput[]> = new Map();

      vi.spyOn(executor, 'executeStep').mockImplementation(
        async (stepId, context) => {
          contexts.set(stepId, Array.from(context.previousOutputs.values()));
          return { content: `Output for ${stepId}` };
        }
      );

      const config: WorkflowConfig = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
      };

      await runner.runWorkflow(config);

      // First step should have no previous outputs
      expect(contexts.get(BmadStepType.BRAINSTORMING)?.length).toBe(0);

      // Second step should have one previous output
      expect(contexts.get(BmadStepType.RESEARCH)?.length).toBe(1);

      // Last step should have 11 previous outputs
      expect(contexts.get(BmadStepType.QA_TESTING)?.length).toBe(11);
    });

    it('should call onStepComplete callback', async () => {
      const completedSteps: BmadStepType[] = [];

      vi.spyOn(executor, 'executeStep').mockResolvedValue({
        content: 'Test output',
      });

      const config: WorkflowConfig = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
        onStepComplete: (stepId) => {
          completedSteps.push(stepId);
        },
      };

      await runner.runWorkflow(config);

      expect(completedSteps.length).toBe(12);
    });

    it('should call onProgress callback', async () => {
      const progressCalls: { current: number; total: number }[] = [];

      vi.spyOn(executor, 'executeStep').mockResolvedValue({
        content: 'Test output',
      });

      const config: WorkflowConfig = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
        onProgress: (current, total) => {
          progressCalls.push({ current, total });
        },
      };

      await runner.runWorkflow(config);

      expect(progressCalls.length).toBe(12);
      expect(progressCalls[0]).toEqual({ current: 1, total: 12 });
      expect(progressCalls[11]).toEqual({ current: 12, total: 12 });
    });

    it('should stop on step failure and return error info', async () => {
      vi.spyOn(executor, 'executeStep').mockImplementation(
        async (stepId: BmadStepType) => {
          if (stepId === BmadStepType.PRD) {
            throw new Error('PRD generation failed');
          }
          return { content: `Output for ${stepId}` };
        }
      );

      const config: WorkflowConfig = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
      };

      const result = await runner.runWorkflow(config);

      expect(result.success).toBe(false);
      expect(result.failedStep).toBe(BmadStepType.PRD);
      expect(result.error?.message).toBe('PRD generation failed');
      expect(result.completedCount).toBe(3); // BRAINSTORMING, RESEARCH, PRODUCT_BRIEF
    });

    it('should return outputs for all completed steps', async () => {
      vi.spyOn(executor, 'executeStep').mockImplementation(
        async (stepId: BmadStepType) => {
          return { content: `Output for ${stepId}` };
        }
      );

      const config: WorkflowConfig = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
      };

      const result = await runner.runWorkflow(config);

      expect(result.outputs.size).toBe(12);
      expect(result.outputs.get(BmadStepType.BRAINSTORMING)?.content).toBe(
        'Output for step-01-brainstorming'
      );
    });
  });

  describe('resumeWorkflow', () => {
    it('should skip already completed steps', async () => {
      const executedSteps: BmadStepType[] = [];

      // First, complete some steps
      vi.spyOn(executor, 'executeStep').mockImplementation(
        async (stepId: BmadStepType) => {
          executedSteps.push(stepId);
          return { content: `Output for ${stepId}` };
        }
      );

      // Simulate completing first 3 steps
      vi.spyOn(executor, 'loadAllCheckpoints').mockResolvedValue(
        new Map([
          [BmadStepType.BRAINSTORMING, { content: 'Brainstorming output' }],
          [BmadStepType.RESEARCH, { content: 'Research output' }],
          [BmadStepType.PRODUCT_BRIEF, { content: 'Brief output' }],
        ])
      );

      vi.spyOn(executor, 'loadAllCheckpointMetadata').mockResolvedValue(
        new Map([
          [
            BmadStepType.BRAINSTORMING,
            {
              stepId: BmadStepType.BRAINSTORMING,
              status: 'completed',
              automationMode: 'auto',
            },
          ],
          [
            BmadStepType.RESEARCH,
            {
              stepId: BmadStepType.RESEARCH,
              status: 'completed',
              automationMode: 'auto',
            },
          ],
          [
            BmadStepType.PRODUCT_BRIEF,
            {
              stepId: BmadStepType.PRODUCT_BRIEF,
              status: 'completed',
              automationMode: 'auto',
            },
          ],
        ])
      );

      const config: WorkflowConfig = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
      };

      const result = await runner.resumeWorkflow(config);

      // Should only execute steps 4-12
      expect(executedSteps.length).toBe(9);
      expect(executedSteps[0]).toBe(BmadStepType.PRD);
    });
  });

  describe('getProgress', () => {
    it('should return correct counts', async () => {
      // Initial state - all pending
      let progress = runner.getProgress();
      expect(progress.total).toBe(12);
      expect(progress.pending).toBe(12);
      expect(progress.completed).toBe(0);

      // Simulate some progress
      stateMachine.startStep(BmadStepType.BRAINSTORMING);
      progress = runner.getProgress();
      expect(progress.inProgress).toBe(1);
      expect(progress.pending).toBe(11);

      stateMachine.completeStep(BmadStepType.BRAINSTORMING);
      progress = runner.getProgress();
      expect(progress.completed).toBe(1);
      expect(progress.pending).toBe(11);
    });

    it('should return current step', () => {
      const progress = runner.getProgress();
      expect(progress.current).toBe(BmadStepType.BRAINSTORMING);
    });
  });

  describe('isWorkflowRunning', () => {
    it('should return false when not running', () => {
      expect(runner.isWorkflowRunning()).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same instance on subsequent calls', () => {
      const instance1 = getWorkflowRunner(stateMachine, executor, registry);
      const instance2 = getWorkflowRunner();

      expect(instance1).toBe(instance2);
    });

    it('should throw when getting without initial parameters', () => {
      resetWorkflowRunner();

      expect(() => {
        getWorkflowRunner();
      }).toThrow('parametreleri gerekli');
    });

    it('should return new instance after reset', () => {
      const instance1 = getWorkflowRunner(stateMachine, executor, registry);
      resetWorkflowRunner();
      const instance2 = getWorkflowRunner(stateMachine, executor, registry);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Turkish error messages', () => {
    it('should have Turkish error messages', () => {
      expect(RUNNER_ERRORS.WORKFLOW_ALREADY_RUNNING).toContain('çalışıyor');
      expect(RUNNER_ERRORS.NO_PROJECT_PATH).toContain('belirtilmedi');
      expect(RUNNER_ERRORS.NO_PROJECT_IDEA).toContain('belirtilmedi');
    });
  });
});
