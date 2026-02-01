/**
 * CheckpointService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  CheckpointService,
  getCheckpointService,
  resetCheckpointService,
  CHECKPOINT_ERRORS,
  CHECKPOINT_MESSAGES,
  type CheckpointProjectInfo,
  type WorkflowSnapshot,
  type CheckpointErrorInfo,
  type PartialOutput,
} from '../../src/services/checkpoint-service.js';
import type { BmadStepType } from '../../src/types/bmad.types.js';
import type { StepOutput, StepStatus } from '../../src/types/step.types.js';

describe('CheckpointService', () => {
  let tempDir: string;
  let checkpointService: CheckpointService;
  let projectInfo: CheckpointProjectInfo;

  beforeEach(async () => {
    resetCheckpointService();
    tempDir = await mkdtemp(join(tmpdir(), 'checkpoint-test-'));
    checkpointService = new CheckpointService({ projectPath: tempDir });

    projectInfo = {
      projectPath: tempDir,
      projectIdea: 'Test project idea',
      llmProvider: 'anthropic',
      automationTemplate: 'full-auto',
    };
  });

  afterEach(async () => {
    resetCheckpointService();
    if (tempDir && existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create with project path', () => {
      const service = new CheckpointService({ projectPath: '/test/path' });
      expect(service.getCheckpointsDir()).toBe('/test/path/.appfabrika/checkpoints');
    });
  });

  describe('getCheckpointPath', () => {
    it('should return correct checkpoint path', () => {
      const path = checkpointService.getCheckpointPath();
      expect(path).toBe(join(tempDir, '.appfabrika', 'checkpoints', 'workflow-state.json'));
    });
  });

  describe('captureWorkflowState', () => {
    it('should capture complete workflow state', () => {
      const currentStep: BmadStepType = 'step-03-product-brief';
      const stepStatuses = new Map<BmadStepType, StepStatus>([
        ['step-01-brainstorming', 'completed'],
        ['step-02-research', 'completed'],
        ['step-03-product-brief', 'in-progress'],
      ]);
      const completedOutputs = new Map<BmadStepType, StepOutput>([
        ['step-01-brainstorming', { content: 'Brainstorming output' }],
        ['step-02-research', { content: 'Research output' }],
      ]);

      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        currentStep,
        stepStatuses,
        completedOutputs
      );

      expect(snapshot.version).toBe('1.0.0');
      expect(snapshot.projectInfo).toEqual(projectInfo);
      expect(snapshot.currentStep).toBe(currentStep);
      expect(snapshot.stepStatuses).toHaveLength(3);
      expect(snapshot.completedOutputs).toHaveLength(2);
      expect(snapshot.resumable).toBe(true);
      expect(snapshot.savedAt).toBeDefined();
    });

    it('should capture state with error info', () => {
      const errorInfo: CheckpointErrorInfo = {
        code: 'E001',
        message: 'Test error',
        stepId: 'step-03-product-brief',
        retryCount: 3,
        occurredAt: new Date().toISOString(),
      };

      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map(),
        new Map(),
        errorInfo
      );

      expect(snapshot.error).toEqual(errorInfo);
    });

    it('should capture state with partial output', () => {
      const partialOutput: PartialOutput = {
        stepId: 'step-03-product-brief',
        content: 'Partial content here...',
        capturedAt: new Date().toISOString(),
      };

      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map(),
        new Map(),
        undefined,
        partialOutput
      );

      expect(snapshot.partialOutput).toEqual(partialOutput);
    });
  });

  describe('createErrorInfo', () => {
    it('should create error info from Error object', () => {
      const error = new Error('Test error message');
      const errorInfo = checkpointService.createErrorInfo(
        error,
        'step-05-ux-design',
        2
      );

      expect(errorInfo.message).toBe('Test error message');
      expect(errorInfo.stepId).toBe('step-05-ux-design');
      expect(errorInfo.retryCount).toBe(2);
      expect(errorInfo.technicalDetails).toContain('Error: Test error message');
      expect(errorInfo.occurredAt).toBeDefined();
    });

    it('should create error info from unknown error', () => {
      const errorInfo = checkpointService.createErrorInfo(
        'string error',
        'step-01-brainstorming',
        0
      );

      expect(errorInfo.message).toBe('Bilinmeyen bir hata oluştu');
      expect(errorInfo.code).toBe('E999');
    });

    it('should extract code from error with code property', () => {
      const error = new Error('API error');
      (error as any).code = 'RATE_LIMIT';

      const errorInfo = checkpointService.createErrorInfo(
        error,
        'step-04-prd',
        1
      );

      expect(errorInfo.code).toBe('RATE_LIMIT');
    });
  });

  describe('createPartialOutput', () => {
    it('should create partial output object', () => {
      const partialOutput = checkpointService.createPartialOutput(
        'step-06-architecture',
        'Partial architecture content...'
      );

      expect(partialOutput.stepId).toBe('step-06-architecture');
      expect(partialOutput.content).toBe('Partial architecture content...');
      expect(partialOutput.capturedAt).toBeDefined();
    });
  });

  describe('saveErrorCheckpoint', () => {
    it('should save checkpoint to file', async () => {
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map([['step-01-brainstorming', 'completed']]),
        new Map([['step-01-brainstorming', { content: 'Output' }]])
      );

      await checkpointService.saveErrorCheckpoint(snapshot);

      const checkpointPath = checkpointService.getCheckpointPath();
      expect(existsSync(checkpointPath)).toBe(true);

      const content = await readFile(checkpointPath, 'utf-8');
      const saved = JSON.parse(content);
      expect(saved.version).toBe('1.0.0');
      expect(saved.projectInfo.projectIdea).toBe('Test project idea');
    });

    it('should create checkpoints directory if not exists', async () => {
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-01-brainstorming',
        new Map(),
        new Map()
      );

      await checkpointService.saveErrorCheckpoint(snapshot);

      expect(existsSync(checkpointService.getCheckpointsDir())).toBe(true);
    });
  });

  describe('loadLatestCheckpoint', () => {
    it('should return null if no checkpoint exists', async () => {
      const snapshot = await checkpointService.loadLatestCheckpoint();
      expect(snapshot).toBeNull();
    });

    it('should load saved checkpoint', async () => {
      const originalSnapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-04-prd',
        new Map([
          ['step-01-brainstorming', 'completed'],
          ['step-02-research', 'completed'],
          ['step-03-product-brief', 'completed'],
          ['step-04-prd', 'in-progress'],
        ]),
        new Map([
          ['step-01-brainstorming', { content: 'Output 1' }],
          ['step-02-research', { content: 'Output 2' }],
          ['step-03-product-brief', { content: 'Output 3' }],
        ])
      );

      await checkpointService.saveErrorCheckpoint(originalSnapshot);
      const loaded = await checkpointService.loadLatestCheckpoint();

      expect(loaded).not.toBeNull();
      expect(loaded?.version).toBe('1.0.0');
      expect(loaded?.currentStep).toBe('step-04-prd');
      expect(loaded?.stepStatuses).toHaveLength(4);
      expect(loaded?.completedOutputs).toHaveLength(3);
    });

    it('should throw on invalid checkpoint format', async () => {
      // Create invalid checkpoint
      await mkdir(checkpointService.getCheckpointsDir(), { recursive: true });
      await writeFile(
        checkpointService.getCheckpointPath(),
        JSON.stringify({ invalid: 'data' }),
        'utf-8'
      );

      await expect(checkpointService.loadLatestCheckpoint()).rejects.toThrow(
        CHECKPOINT_ERRORS.INVALID_FORMAT
      );
    });
  });

  describe('hasResumableCheckpoint', () => {
    it('should return false if no checkpoint exists', async () => {
      const result = await checkpointService.hasResumableCheckpoint();
      expect(result).toBe(false);
    });

    it('should return true if resumable checkpoint exists', async () => {
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map(),
        new Map()
      );

      await checkpointService.saveErrorCheckpoint(snapshot);
      const result = await checkpointService.hasResumableCheckpoint();
      expect(result).toBe(true);
    });
  });

  describe('restoreStepStatuses', () => {
    it('should convert snapshot statuses back to Map', () => {
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map([
          ['step-01-brainstorming', 'completed'],
          ['step-02-research', 'skipped'],
        ]),
        new Map()
      );

      const restored = checkpointService.restoreStepStatuses(snapshot);

      expect(restored.size).toBe(2);
      expect(restored.get('step-01-brainstorming')).toBe('completed');
      expect(restored.get('step-02-research')).toBe('skipped');
    });
  });

  describe('restoreCompletedOutputs', () => {
    it('should convert snapshot outputs back to Map', () => {
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-03-product-brief',
        new Map(),
        new Map([
          ['step-01-brainstorming', { content: 'Output 1' }],
          ['step-02-research', { content: 'Output 2', files: ['file.md'] }],
        ])
      );

      const restored = checkpointService.restoreCompletedOutputs(snapshot);

      expect(restored.size).toBe(2);
      expect(restored.get('step-01-brainstorming')?.content).toBe('Output 1');
      expect(restored.get('step-02-research')?.files).toEqual(['file.md']);
    });
  });

  describe('clearCheckpoint', () => {
    it('should delete checkpoint file', async () => {
      const snapshot = checkpointService.captureWorkflowState(
        projectInfo,
        'step-01-brainstorming',
        new Map(),
        new Map()
      );

      await checkpointService.saveErrorCheckpoint(snapshot);
      expect(existsSync(checkpointService.getCheckpointPath())).toBe(true);

      await checkpointService.clearCheckpoint();
      expect(existsSync(checkpointService.getCheckpointPath())).toBe(false);
    });

    it('should not throw if checkpoint does not exist', async () => {
      await expect(checkpointService.clearCheckpoint()).resolves.not.toThrow();
    });
  });

  describe('onErrorSaveCheckpoint', () => {
    it('should save complete error checkpoint', async () => {
      const stepStatuses = new Map<BmadStepType, StepStatus>([
        ['step-01-brainstorming', 'completed'],
        ['step-02-research', 'in-progress'],
      ]);
      const completedOutputs = new Map<BmadStepType, StepOutput>([
        ['step-01-brainstorming', { content: 'Brainstorming done' }],
      ]);
      const error = new Error('API timeout');

      await checkpointService.onErrorSaveCheckpoint(
        projectInfo,
        'step-02-research',
        stepStatuses,
        completedOutputs,
        error,
        3,
        'Partial research content...'
      );

      const loaded = await checkpointService.loadLatestCheckpoint();
      expect(loaded).not.toBeNull();
      expect(loaded?.error?.message).toBe('API timeout');
      expect(loaded?.error?.retryCount).toBe(3);
      expect(loaded?.partialOutput?.content).toBe('Partial research content...');
      expect(loaded?.partialOutput?.stepId).toBe('step-02-research');
    });

    it('should save checkpoint without partial content', async () => {
      await checkpointService.onErrorSaveCheckpoint(
        projectInfo,
        'step-01-brainstorming',
        new Map(),
        new Map(),
        new Error('Test error'),
        0
      );

      const loaded = await checkpointService.loadLatestCheckpoint();
      expect(loaded?.partialOutput).toBeUndefined();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const service1 = getCheckpointService({ projectPath: tempDir });
      const service2 = getCheckpointService();
      expect(service1).toBe(service2);
    });

    it('should return new instance after reset', () => {
      const service1 = getCheckpointService({ projectPath: tempDir });
      resetCheckpointService();
      const service2 = getCheckpointService({ projectPath: tempDir });
      expect(service1).not.toBe(service2);
    });

    it('should throw if no config on first call', () => {
      expect(() => getCheckpointService()).toThrow(
        'CheckpointService config gerekli (ilk çağrı için)'
      );
    });
  });
});

describe('CHECKPOINT_ERRORS constant', () => {
  it('should have Turkish error messages', () => {
    expect(CHECKPOINT_ERRORS.SAVE_FAILED).toContain('kaydedilemedi');
    expect(CHECKPOINT_ERRORS.LOAD_FAILED).toContain('yüklenemedi');
    expect(CHECKPOINT_ERRORS.INVALID_FORMAT).toContain('formatı geçersiz');
    expect(CHECKPOINT_ERRORS.NOT_FOUND).toContain('bulunamadı');
  });
});

describe('CHECKPOINT_MESSAGES constant', () => {
  it('should have Turkish messages', () => {
    expect(CHECKPOINT_MESSAGES.SAVED).toContain('kaydedildi');
    expect(CHECKPOINT_MESSAGES.LOADED).toContain('yüklendi');
    expect(CHECKPOINT_MESSAGES.RESUMING).toContain('devam');
  });
});
