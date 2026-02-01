/**
 * ResumeService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  ResumeService,
  getResumeService,
  resetResumeService,
  ResumeAction,
  RESUME_MESSAGES,
  type ResumeInfo,
} from '../../src/services/resume-service.js';
import {
  CheckpointService,
  resetCheckpointService,
  type WorkflowSnapshot,
  type CheckpointProjectInfo,
} from '../../src/services/checkpoint-service.js';
import {
  WorkflowStateMachine,
  resetWorkflowStateMachine,
} from '../../src/services/workflow-state-machine.js';
import { StepStatus } from '../../src/types/workflow.types.js';
import type { BmadStepType } from '../../src/types/bmad.types.js';

describe('ResumeService', () => {
  let tempDir: string;
  let resumeService: ResumeService;
  let checkpointService: CheckpointService;
  let projectInfo: CheckpointProjectInfo;

  beforeEach(async () => {
    resetResumeService();
    resetCheckpointService();
    resetWorkflowStateMachine();

    tempDir = await mkdtemp(join(tmpdir(), 'resume-test-'));
    resumeService = new ResumeService({ projectPath: tempDir });
    checkpointService = new CheckpointService({ projectPath: tempDir });

    projectInfo = {
      projectPath: tempDir,
      projectIdea: 'Test project idea',
      llmProvider: 'anthropic',
      automationTemplate: 'full-auto',
    };
  });

  afterEach(async () => {
    resetResumeService();
    resetCheckpointService();
    resetWorkflowStateMachine();

    if (tempDir && existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create with project path', () => {
      const service = new ResumeService({ projectPath: '/test/path' });
      expect(service.getCheckpointsDir()).toBe('/test/path/.appfabrika/checkpoints');
    });
  });

  describe('detectResumableState', () => {
    it('should return false if no checkpoint exists', async () => {
      const result = await resumeService.detectResumableState();
      expect(result).toBe(false);
    });

    it('should return true if resumable checkpoint exists', async () => {
      // Create a checkpoint
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map([['step-01-brainstorming', 'completed']]),
        new Map([['step-01-brainstorming', { content: 'Output' }]])
      );
      await checkpointService.saveErrorCheckpoint(snapshot);

      const result = await resumeService.detectResumableState();
      expect(result).toBe(true);
    });
  });

  describe('getResumeInfo', () => {
    it('should return canResume false if no checkpoint', async () => {
      const info = await resumeService.getResumeInfo();

      expect(info.canResume).toBe(false);
      expect(info.totalSteps).toBe(12);
      expect(info.currentStep).toBeUndefined();
    });

    it('should return complete resume info', async () => {
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-05-ux-design',
        new Map<BmadStepType, 'pending' | 'in-progress' | 'completed' | 'skipped'>([
          ['step-01-brainstorming', 'completed'],
          ['step-02-research', 'completed'],
          ['step-03-product-brief', 'completed'],
          ['step-04-prd', 'completed'],
          ['step-05-ux-design', 'in-progress'],
        ]),
        new Map([
          ['step-01-brainstorming', { content: 'Output 1' }],
          ['step-02-research', { content: 'Output 2' }],
          ['step-03-product-brief', { content: 'Output 3' }],
          ['step-04-prd', { content: 'Output 4' }],
        ]),
        {
          code: 'TIMEOUT',
          message: 'API yanıt vermedi',
          stepId: 'step-05-ux-design',
          retryCount: 3,
          occurredAt: new Date().toISOString(),
        }
      );
      await checkpointService.saveErrorCheckpoint(snapshot);

      const info = await resumeService.getResumeInfo();

      expect(info.canResume).toBe(true);
      expect(info.currentStep).toBe('step-05-ux-design');
      expect(info.currentStepName).toBe('UX Tasarımı');
      expect(info.stepNumber).toBe(5);
      expect(info.totalSteps).toBe(12);
      expect(info.completedSteps).toBe(4);
      expect(info.errorMessage).toBe('API yanıt vermedi');
      expect(info.retryCount).toBe(3);
    });
  });

  describe('formatResumeInfo', () => {
    it('should format info when no checkpoint', () => {
      const info: ResumeInfo = {
        canResume: false,
        totalSteps: 12,
      };

      const formatted = resumeService.formatResumeInfo(info);
      expect(formatted).toBe(RESUME_MESSAGES.NO_CHECKPOINT);
    });

    it('should format complete resume info', () => {
      const info: ResumeInfo = {
        canResume: true,
        currentStep: 'step-05-ux-design',
        currentStepName: 'UX Tasarımı',
        stepNumber: 5,
        totalSteps: 12,
        completedSteps: 4,
        savedAt: new Date().toISOString(),
        errorMessage: 'API timeout',
        retryCount: 3,
      };

      const formatted = resumeService.formatResumeInfo(info);

      expect(formatted).toContain('Önceki çalışma yarıda kaldı');
      expect(formatted).toContain('Adım 5/12 - UX Tasarımı');
      expect(formatted).toContain('Hata: API timeout');
      expect(formatted).toContain('3 deneme sonrası başarısız oldu');
    });

    it('should format info without error', () => {
      const info: ResumeInfo = {
        canResume: true,
        currentStep: 'step-03-product-brief',
        currentStepName: 'Ürün Özeti',
        stepNumber: 3,
        totalSteps: 12,
        completedSteps: 2,
      };

      const formatted = resumeService.formatResumeInfo(info);

      expect(formatted).toContain('Önceki çalışma yarıda kaldı');
      expect(formatted).toContain('Adım 3/12 - Ürün Özeti');
      expect(formatted).not.toContain('Hata');
    });
  });

  describe('resumeWorkflow', () => {
    it('should return failure if no checkpoint', async () => {
      const stateMachine = new WorkflowStateMachine();

      const result = await resumeService.resumeWorkflow(stateMachine);

      expect(result.success).toBe(false);
      expect(result.action).toBe(ResumeAction.RESUME);
      expect(result.message).toBe(RESUME_MESSAGES.NO_CHECKPOINT);
    });

    it('should restore state machine from checkpoint', async () => {
      // Create checkpoint
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map<BmadStepType, 'pending' | 'in-progress' | 'completed' | 'skipped'>([
          ['step-01-brainstorming', 'completed'],
          ['step-02-research', 'completed'],
          ['step-03-product-brief', 'in-progress'],
        ]),
        new Map([
          ['step-01-brainstorming', { content: 'Output 1' }],
          ['step-02-research', { content: 'Output 2' }],
        ]),
        {
          code: 'E001',
          message: 'Test error',
          stepId: 'step-03-product-brief',
          retryCount: 2,
          occurredAt: new Date().toISOString(),
        }
      );
      await checkpointService.saveErrorCheckpoint(snapshot);

      const stateMachine = new WorkflowStateMachine();
      const result = await resumeService.resumeWorkflow(stateMachine);

      expect(result.success).toBe(true);
      expect(result.action).toBe(ResumeAction.RESUME);
      expect(result.startStep).toBe('step-03-product-brief');
      expect(result.restoredOutputs.size).toBe(2);
      expect(result.message).toContain('Ürün Özeti');

      // Verify state machine was restored
      expect(stateMachine.getStepState('step-01-brainstorming').status).toBe(
        StepStatus.COMPLETED
      );
      expect(stateMachine.getStepState('step-02-research').status).toBe(
        StepStatus.COMPLETED
      );

      // Checkpoint should be cleared
      expect(existsSync(checkpointService.getCheckpointPath())).toBe(false);
    });

    it('should handle skipped steps', async () => {
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map<BmadStepType, 'pending' | 'in-progress' | 'completed' | 'skipped'>([
          ['step-01-brainstorming', 'completed'],
          ['step-02-research', 'skipped'],
          ['step-03-product-brief', 'in-progress'],
        ]),
        new Map([['step-01-brainstorming', { content: 'Output 1' }]])
      );
      await checkpointService.saveErrorCheckpoint(snapshot);

      const stateMachine = new WorkflowStateMachine();
      await resumeService.resumeWorkflow(stateMachine);

      expect(stateMachine.getStepState('step-02-research').status).toBe(
        StepStatus.SKIPPED
      );
    });
  });

  describe('startFresh', () => {
    it('should clear all checkpoints and return fresh start result', async () => {
      // Create some checkpoints
      await mkdir(resumeService.getCheckpointsDir(), { recursive: true });
      await writeFile(
        join(resumeService.getCheckpointsDir(), 'step-01-brainstorming.json'),
        JSON.stringify({ test: true })
      );
      await writeFile(
        join(resumeService.getCheckpointsDir(), 'workflow-state.json'),
        JSON.stringify({ test: true })
      );

      const result = await resumeService.startFresh();

      expect(result.success).toBe(true);
      expect(result.action).toBe(ResumeAction.FRESH);
      expect(result.startStep).toBe('step-01-brainstorming');
      expect(result.restoredOutputs.size).toBe(0);
      expect(result.message).toBe(RESUME_MESSAGES.FRESH_SUCCESS);

      // Verify checkpoints are cleared
      expect(
        existsSync(join(resumeService.getCheckpointsDir(), 'step-01-brainstorming.json'))
      ).toBe(false);
      expect(
        existsSync(join(resumeService.getCheckpointsDir(), 'workflow-state.json'))
      ).toBe(false);
    });

    it('should handle non-existent checkpoints directory', async () => {
      const result = await resumeService.startFresh();

      expect(result.success).toBe(true);
      expect(result.action).toBe(ResumeAction.FRESH);
    });
  });

  describe('clearAllCheckpoints', () => {
    it('should clear all JSON files in checkpoints directory', async () => {
      await mkdir(resumeService.getCheckpointsDir(), { recursive: true });
      await writeFile(
        join(resumeService.getCheckpointsDir(), 'checkpoint1.json'),
        '{}'
      );
      await writeFile(
        join(resumeService.getCheckpointsDir(), 'checkpoint2.json'),
        '{}'
      );

      await resumeService.clearAllCheckpoints();

      expect(existsSync(join(resumeService.getCheckpointsDir(), 'checkpoint1.json'))).toBe(
        false
      );
      expect(existsSync(join(resumeService.getCheckpointsDir(), 'checkpoint2.json'))).toBe(
        false
      );
    });

    it('should not throw if directory does not exist', async () => {
      await expect(resumeService.clearAllCheckpoints()).resolves.not.toThrow();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const service1 = getResumeService({ projectPath: tempDir });
      const service2 = getResumeService();
      expect(service1).toBe(service2);
    });

    it('should return new instance after reset', () => {
      const service1 = getResumeService({ projectPath: tempDir });
      resetResumeService();
      const service2 = getResumeService({ projectPath: tempDir });
      expect(service1).not.toBe(service2);
    });

    it('should throw if no config on first call', () => {
      expect(() => getResumeService()).toThrow(
        'ResumeService config gerekli (ilk çağrı için)'
      );
    });
  });
});

describe('ResumeAction enum', () => {
  it('should have correct values', () => {
    expect(ResumeAction.RESUME).toBe('resume');
    expect(ResumeAction.FRESH).toBe('fresh');
  });
});

describe('RESUME_MESSAGES constant', () => {
  it('should have Turkish messages', () => {
    expect(RESUME_MESSAGES.PREVIOUS_WORK_FOUND).toContain('Önceki çalışma');
    expect(RESUME_MESSAGES.RESUMING).toContain('devam');
    expect(RESUME_MESSAGES.STARTING_FRESH).toContain('Yeniden');
    expect(RESUME_MESSAGES.RESUME_SUCCESS).toContain('devam');
    expect(RESUME_MESSAGES.FRESH_SUCCESS).toContain('başlatıldı');
    expect(RESUME_MESSAGES.NO_CHECKPOINT).toContain('bulunamadı');
    expect(RESUME_MESSAGES.CHECKPOINT_CLEARED).toContain('temizlendi');
  });
});
