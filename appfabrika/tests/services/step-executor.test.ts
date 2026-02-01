/**
 * Step Executor Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import {
  StepExecutor,
  getStepExecutor,
  resetStepExecutor,
} from '../../src/services/step-executor.js';
import { BmadStepRegistry, resetBmadStepRegistry } from '../../src/services/bmad-step-registry.js';
import { ClaudeCodeAdapter, resetClaudeCodeAdapter } from '../../src/adapters/claude-code/claude-code.adapter.js';
import { BmadStepType, BMAD_STEP_NAMES } from '../../src/types/bmad.types.js';
import type { StepOutput, StepExecutionContext, StepCheckpoint, LegacyStepCheckpoint } from '../../src/types/step.types.js';
import { EXECUTOR_ERRORS, isLegacyCheckpoint } from '../../src/types/step.types.js';

// Test directories
const TEST_PROJECT_PATH = join(process.cwd(), '.test-step-executor');
const TEST_TEMPLATES_DIR = join(process.cwd(), 'templates');
const TEST_CHECKPOINTS_DIR = join(TEST_PROJECT_PATH, '.appfabrika', 'checkpoints');

describe('StepExecutor', () => {
  let executor: StepExecutor;
  let registry: BmadStepRegistry;
  let claudeCode: ClaudeCodeAdapter;

  beforeEach(() => {
    resetStepExecutor();
    resetBmadStepRegistry();
    resetClaudeCodeAdapter();

    // Clean up test directory
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    mkdirSync(TEST_PROJECT_PATH, { recursive: true });

    registry = new BmadStepRegistry();
    claudeCode = new ClaudeCodeAdapter({
      projectPath: TEST_PROJECT_PATH,
      timeout: 5000,
    });

    executor = new StepExecutor(registry, claudeCode, TEST_PROJECT_PATH);
  });

  afterEach(() => {
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    resetStepExecutor();
    resetBmadStepRegistry();
    resetClaudeCodeAdapter();
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(executor.getCheckpointsDir()).toBe(TEST_CHECKPOINTS_DIR);
    });

    it('should set templates directory', () => {
      const templatesDir = executor.getTemplatesDir();
      expect(templatesDir).toContain('templates');
    });
  });

  describe('loadPromptTemplate', () => {
    it('should load existing template', async () => {
      // Templates should exist in the project
      const template = await executor.loadPromptTemplate(BmadStepType.BRAINSTORMING);
      expect(template).toContain('{{projectIdea}}');
      expect(template).toContain('{{stepName}}');
    });

    it('should load business step templates (1-4)', async () => {
      const businessSteps = [
        BmadStepType.BRAINSTORMING,
        BmadStepType.RESEARCH,
        BmadStepType.PRODUCT_BRIEF,
        BmadStepType.PRD,
      ];

      for (const stepId of businessSteps) {
        const template = await executor.loadPromptTemplate(stepId);
        expect(template).toContain('{{projectIdea}}');
      }
    });

    it('should load design step templates (5-7)', async () => {
      const designSteps = [
        BmadStepType.UX_DESIGN,
        BmadStepType.ARCHITECTURE,
        BmadStepType.EPICS_STORIES,
      ];

      for (const stepId of designSteps) {
        const template = await executor.loadPromptTemplate(stepId);
        expect(template).toContain('{{projectIdea}}');
        expect(template).toContain('{{allPreviousOutputs}}');
      }
    });

    it('should load technical step templates (8-12)', async () => {
      const technicalSteps = [
        BmadStepType.SPRINT_PLANNING,
        BmadStepType.TECH_SPEC,
        BmadStepType.DEVELOPMENT,
        BmadStepType.CODE_REVIEW,
        BmadStepType.QA_TESTING,
      ];

      for (const stepId of technicalSteps) {
        const template = await executor.loadPromptTemplate(stepId);
        expect(template).toContain('{{projectIdea}}');
        expect(template).toContain('{{allPreviousOutputs}}');
      }
    });

    it('should load all 12 BMAD step templates', async () => {
      const allSteps = [
        BmadStepType.BRAINSTORMING,
        BmadStepType.RESEARCH,
        BmadStepType.PRODUCT_BRIEF,
        BmadStepType.PRD,
        BmadStepType.UX_DESIGN,
        BmadStepType.ARCHITECTURE,
        BmadStepType.EPICS_STORIES,
        BmadStepType.SPRINT_PLANNING,
        BmadStepType.TECH_SPEC,
        BmadStepType.DEVELOPMENT,
        BmadStepType.CODE_REVIEW,
        BmadStepType.QA_TESTING,
      ];

      for (const stepId of allSteps) {
        const template = await executor.loadPromptTemplate(stepId);
        expect(template).toContain('{{projectIdea}}');
        expect(template.length).toBeGreaterThan(100);
      }
    });
  });

  describe('fillTemplate', () => {
    const context: StepExecutionContext = {
      projectPath: TEST_PROJECT_PATH,
      projectIdea: 'Test proje fikri',
      previousOutputs: new Map(),
    };

    it('should replace {{projectIdea}}', () => {
      const template = 'Fikir: {{projectIdea}}';
      const filled = executor.fillTemplate(template, context, BmadStepType.BRAINSTORMING);
      expect(filled).toBe('Fikir: Test proje fikri');
    });

    it('should replace {{stepName}} with Turkish name', () => {
      const template = 'Adım: {{stepName}}';
      const filled = executor.fillTemplate(template, context, BmadStepType.BRAINSTORMING);
      expect(filled).toBe(`Adım: ${BMAD_STEP_NAMES[BmadStepType.BRAINSTORMING]}`);
    });

    it('should replace {{allPreviousOutputs}} with empty message when no outputs', () => {
      const template = 'Önceki: {{allPreviousOutputs}}';
      const filled = executor.fillTemplate(template, context, BmadStepType.RESEARCH);
      expect(filled).toContain('Henüz önceki adım çıktısı yok');
    });

    it('should replace {{allPreviousOutputs}} with formatted outputs', () => {
      const contextWithOutputs: StepExecutionContext = {
        ...context,
        previousOutputs: new Map([
          [BmadStepType.BRAINSTORMING, { content: 'Brainstorming çıktısı' }],
        ]),
      };

      const template = '{{allPreviousOutputs}}';
      const filled = executor.fillTemplate(template, contextWithOutputs, BmadStepType.RESEARCH);

      expect(filled).toContain('Fikir Geliştirme');
      expect(filled).toContain('Brainstorming çıktısı');
    });

    it('should replace {{previousOutput.stepId}}', () => {
      const contextWithOutputs: StepExecutionContext = {
        ...context,
        previousOutputs: new Map([
          [BmadStepType.BRAINSTORMING, { content: 'Önceki çıktı içeriği' }],
        ]),
      };

      const template = '{{previousOutput.step-01-brainstorming}}';
      const filled = executor.fillTemplate(template, contextWithOutputs, BmadStepType.RESEARCH);
      expect(filled).toBe('Önceki çıktı içeriği');
    });

    it('should handle missing previous output gracefully', () => {
      const template = '{{previousOutput.step-01-brainstorming}}';
      const filled = executor.fillTemplate(template, context, BmadStepType.RESEARCH);
      expect(filled).toBe('');
    });

    it('should replace multiple variables', () => {
      const template = 'Proje: {{projectIdea}}, Adım: {{stepName}}';
      const filled = executor.fillTemplate(template, context, BmadStepType.BRAINSTORMING);
      expect(filled).toContain('Test proje fikri');
      expect(filled).toContain(BMAD_STEP_NAMES[BmadStepType.BRAINSTORMING]);
    });
  });

  describe('saveCheckpoint', () => {
    const mockOutput: StepOutput = {
      content: 'Test output content',
      metadata: {
        duration: 1000,
        success: true,
      },
    };

    it('should create checkpoints directory if not exists', async () => {
      expect(existsSync(TEST_CHECKPOINTS_DIR)).toBe(false);

      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, mockOutput);

      expect(existsSync(TEST_CHECKPOINTS_DIR)).toBe(true);
    });

    it('should save checkpoint with ADR-002 format', async () => {
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, mockOutput);

      const checkpointPath = join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`);
      expect(existsSync(checkpointPath)).toBe(true);

      const content = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as StepCheckpoint;
      expect(content.stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(content.status).toBe('completed');
      expect(content.automationMode).toBe('auto');
      expect(content.output?.content).toBe('Test output content');
    });

    it('should include startedAt and completedAt timestamps', async () => {
      const beforeTime = new Date().toISOString();
      await executor.saveCheckpoint(BmadStepType.RESEARCH, mockOutput);
      const afterTime = new Date().toISOString();

      const checkpointPath = join(TEST_CHECKPOINTS_DIR, `${BmadStepType.RESEARCH}.json`);
      const content = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as StepCheckpoint;

      expect(content.startedAt).toBeDefined();
      expect(content.completedAt).toBeDefined();
      expect(content.startedAt! >= beforeTime).toBe(true);
      expect(content.completedAt! <= afterTime).toBe(true);
    });

    it('should save checkpoint with custom automation mode', async () => {
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, mockOutput, {
        automationMode: 'manual',
      });

      const checkpointPath = join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`);
      const content = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as StepCheckpoint;
      expect(content.automationMode).toBe('manual');
    });

    it('should save checkpoint with error information', async () => {
      const errorOutput: StepOutput = { content: '', metadata: { success: false } };
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, errorOutput, {
        error: {
          code: 'E001',
          message: 'Test error',
          retryCount: 2,
        },
      });

      const checkpointPath = join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`);
      const content = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as StepCheckpoint;
      expect(content.status).toBe('in-progress');
      expect(content.error).toBeDefined();
      expect(content.error?.code).toBe('E001');
      expect(content.error?.retryCount).toBe(2);
    });

    it('should overwrite existing checkpoint', async () => {
      const output1: StepOutput = { content: 'First output' };
      const output2: StepOutput = { content: 'Second output' };

      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, output1);
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, output2);

      const checkpointPath = join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`);
      const content = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as StepCheckpoint;
      expect(content.output?.content).toBe('Second output');
    });
  });

  describe('markStepStarted', () => {
    it('should create in-progress checkpoint', async () => {
      await executor.markStepStarted(BmadStepType.BRAINSTORMING);

      const checkpointPath = join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`);
      const content = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as StepCheckpoint;

      expect(content.status).toBe('in-progress');
      expect(content.startedAt).toBeDefined();
      expect(content.completedAt).toBeUndefined();
    });

    it('should save with specified automation mode', async () => {
      await executor.markStepStarted(BmadStepType.BRAINSTORMING, 'manual');

      const checkpointPath = join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`);
      const content = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as StepCheckpoint;

      expect(content.automationMode).toBe('manual');
    });
  });

  describe('markStepSkipped', () => {
    it('should create skipped checkpoint', async () => {
      await executor.markStepSkipped(BmadStepType.BRAINSTORMING);

      const checkpointPath = join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`);
      const content = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as StepCheckpoint;

      expect(content.status).toBe('skipped');
      expect(content.completedAt).toBeDefined();
      expect(content.duration).toBe(0);
    });
  });

  describe('loadCheckpoint', () => {
    it('should return null for non-existent checkpoint', async () => {
      const output = await executor.loadCheckpoint(BmadStepType.BRAINSTORMING);
      expect(output).toBeNull();
    });

    it('should load existing checkpoint', async () => {
      const mockOutput: StepOutput = { content: 'Saved output' };
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, mockOutput);

      const loaded = await executor.loadCheckpoint(BmadStepType.BRAINSTORMING);
      expect(loaded).not.toBeNull();
      expect(loaded?.content).toBe('Saved output');
    });

    it('should handle legacy checkpoint format', async () => {
      // Create legacy checkpoint manually
      mkdirSync(TEST_CHECKPOINTS_DIR, { recursive: true });
      const legacyCheckpoint: LegacyStepCheckpoint = {
        stepId: BmadStepType.BRAINSTORMING,
        executedAt: '2026-01-31T10:00:00.000Z',
        duration: 1500,
        success: true,
        output: { content: 'Legacy output' },
      };
      writeFileSync(
        join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`),
        JSON.stringify(legacyCheckpoint)
      );

      const loaded = await executor.loadCheckpoint(BmadStepType.BRAINSTORMING);
      expect(loaded?.content).toBe('Legacy output');
    });
  });

  describe('loadCheckpointMetadata', () => {
    it('should return null for non-existent checkpoint', async () => {
      const metadata = await executor.loadCheckpointMetadata(BmadStepType.BRAINSTORMING);
      expect(metadata).toBeNull();
    });

    it('should load full checkpoint metadata', async () => {
      const mockOutput: StepOutput = { content: 'Test' };
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, mockOutput, {
        automationMode: 'manual',
      });

      const metadata = await executor.loadCheckpointMetadata(BmadStepType.BRAINSTORMING);
      expect(metadata).not.toBeNull();
      expect(metadata?.status).toBe('completed');
      expect(metadata?.automationMode).toBe('manual');
      expect(metadata?.output?.content).toBe('Test');
    });

    it('should convert legacy checkpoint to new format', async () => {
      mkdirSync(TEST_CHECKPOINTS_DIR, { recursive: true });
      const legacyCheckpoint: LegacyStepCheckpoint = {
        stepId: BmadStepType.BRAINSTORMING,
        executedAt: '2026-01-31T10:00:00.000Z',
        duration: 1500,
        success: true,
        output: { content: 'Legacy output' },
      };
      writeFileSync(
        join(TEST_CHECKPOINTS_DIR, `${BmadStepType.BRAINSTORMING}.json`),
        JSON.stringify(legacyCheckpoint)
      );

      const metadata = await executor.loadCheckpointMetadata(BmadStepType.BRAINSTORMING);
      expect(metadata?.status).toBe('completed');
      expect(metadata?.automationMode).toBe('auto');
      expect(metadata?.startedAt).toBe('2026-01-31T10:00:00.000Z');
    });
  });

  describe('isStepCompleted', () => {
    it('should return false for non-existent checkpoint', async () => {
      const completed = await executor.isStepCompleted(BmadStepType.BRAINSTORMING);
      expect(completed).toBe(false);
    });

    it('should return true for completed step', async () => {
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, { content: 'Done' });

      const completed = await executor.isStepCompleted(BmadStepType.BRAINSTORMING);
      expect(completed).toBe(true);
    });

    it('should return true for skipped step', async () => {
      await executor.markStepSkipped(BmadStepType.BRAINSTORMING);

      const completed = await executor.isStepCompleted(BmadStepType.BRAINSTORMING);
      expect(completed).toBe(true);
    });

    it('should return false for in-progress step', async () => {
      await executor.markStepStarted(BmadStepType.BRAINSTORMING);

      const completed = await executor.isStepCompleted(BmadStepType.BRAINSTORMING);
      expect(completed).toBe(false);
    });
  });

  describe('getStepStatus', () => {
    it('should return pending for non-existent checkpoint', async () => {
      const status = await executor.getStepStatus(BmadStepType.BRAINSTORMING);
      expect(status).toBe('pending');
    });

    it('should return correct status for each state', async () => {
      await executor.markStepStarted(BmadStepType.BRAINSTORMING);
      expect(await executor.getStepStatus(BmadStepType.BRAINSTORMING)).toBe('in-progress');

      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, { content: 'Done' });
      expect(await executor.getStepStatus(BmadStepType.BRAINSTORMING)).toBe('completed');

      await executor.markStepSkipped(BmadStepType.RESEARCH);
      expect(await executor.getStepStatus(BmadStepType.RESEARCH)).toBe('skipped');
    });
  });

  describe('loadAllCheckpoints', () => {
    it('should return empty map when no checkpoints exist', async () => {
      const checkpoints = await executor.loadAllCheckpoints();
      expect(checkpoints.size).toBe(0);
    });

    it('should load all existing checkpoints', async () => {
      // Save multiple checkpoints
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, { content: 'Brainstorming' });
      await executor.saveCheckpoint(BmadStepType.RESEARCH, { content: 'Research' });

      const checkpoints = await executor.loadAllCheckpoints();
      expect(checkpoints.size).toBe(2);
      expect(checkpoints.get(BmadStepType.BRAINSTORMING)?.content).toBe('Brainstorming');
      expect(checkpoints.get(BmadStepType.RESEARCH)?.content).toBe('Research');
    });
  });

  describe('loadAllCheckpointMetadata', () => {
    it('should return empty map when no checkpoints exist', async () => {
      const checkpoints = await executor.loadAllCheckpointMetadata();
      expect(checkpoints.size).toBe(0);
    });

    it('should load all checkpoint metadata', async () => {
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, { content: 'B' });
      await executor.markStepSkipped(BmadStepType.RESEARCH);

      const checkpoints = await executor.loadAllCheckpointMetadata();
      expect(checkpoints.size).toBe(2);
      expect(checkpoints.get(BmadStepType.BRAINSTORMING)?.status).toBe('completed');
      expect(checkpoints.get(BmadStepType.RESEARCH)?.status).toBe('skipped');
    });
  });

  describe('getWorkflowProgress', () => {
    it('should return all pending when no checkpoints', async () => {
      const progress = await executor.getWorkflowProgress();
      expect(progress.total).toBe(12);
      expect(progress.pending).toBe(12);
      expect(progress.completed).toBe(0);
      expect(progress.skipped).toBe(0);
      expect(progress.inProgress).toBe(0);
    });

    it('should count different statuses correctly', async () => {
      await executor.saveCheckpoint(BmadStepType.BRAINSTORMING, { content: 'Done' });
      await executor.saveCheckpoint(BmadStepType.RESEARCH, { content: 'Done' });
      await executor.markStepSkipped(BmadStepType.PRODUCT_BRIEF);
      await executor.markStepStarted(BmadStepType.PRD);

      const progress = await executor.getWorkflowProgress();
      expect(progress.completed).toBe(2);
      expect(progress.skipped).toBe(1);
      expect(progress.inProgress).toBe(1);
      expect(progress.pending).toBe(8);
    });
  });

  describe('isLegacyCheckpoint type guard', () => {
    it('should identify legacy checkpoint', () => {
      const legacy = {
        stepId: BmadStepType.BRAINSTORMING,
        executedAt: '2026-01-31T10:00:00.000Z',
        duration: 1000,
        success: true,
        output: { content: 'test' },
      };
      expect(isLegacyCheckpoint(legacy)).toBe(true);
    });

    it('should not identify new format as legacy', () => {
      const newFormat: StepCheckpoint = {
        stepId: BmadStepType.BRAINSTORMING,
        status: 'completed',
        automationMode: 'auto',
        startedAt: '2026-01-31T10:00:00.000Z',
        output: { content: 'test' },
      };
      expect(isLegacyCheckpoint(newFormat)).toBe(false);
    });
  });

  describe('executeStep', () => {
    it('should load template, fill it, and execute via Claude Code', async () => {
      const context: StepExecutionContext = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
        previousOutputs: new Map(),
      };

      // Mock Claude Code execution
      vi.spyOn(claudeCode, 'executeStep').mockResolvedValue({
        content: 'Claude Code output',
        metadata: { success: true, duration: 1000 },
      });

      const output = await executor.executeStep(BmadStepType.BRAINSTORMING, context);

      expect(output.content).toBe('Claude Code output');
      expect(claudeCode.executeStep).toHaveBeenCalledWith(
        BmadStepType.BRAINSTORMING,
        expect.stringContaining('Test fikri')
      );
    });

    it('should save checkpoint after execution', async () => {
      const context: StepExecutionContext = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
        previousOutputs: new Map(),
      };

      vi.spyOn(claudeCode, 'executeStep').mockResolvedValue({
        content: 'Output to save',
        metadata: { success: true },
      });

      await executor.executeStep(BmadStepType.BRAINSTORMING, context);

      const checkpoint = await executor.loadCheckpoint(BmadStepType.BRAINSTORMING);
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.content).toBe('Output to save');
    });

    it('should save error checkpoint on execution failure', async () => {
      const context: StepExecutionContext = {
        projectPath: TEST_PROJECT_PATH,
        projectIdea: 'Test fikri',
        previousOutputs: new Map(),
      };

      vi.spyOn(claudeCode, 'executeStep').mockRejectedValue(new Error('Claude Code timeout'));

      await expect(executor.executeStep(BmadStepType.BRAINSTORMING, context)).rejects.toThrow(
        'Claude Code timeout'
      );

      const metadata = await executor.loadCheckpointMetadata(BmadStepType.BRAINSTORMING);
      expect(metadata).not.toBeNull();
      expect(metadata?.status).toBe('in-progress');
      expect(metadata?.error).toBeDefined();
      expect(metadata?.error?.code).toBe('E010');
      expect(metadata?.error?.message).toBe('Claude Code timeout');
    });
  });

  describe('singleton', () => {
    it('should return same instance on subsequent calls', () => {
      const instance1 = getStepExecutor(registry, claudeCode, TEST_PROJECT_PATH);
      const instance2 = getStepExecutor();

      expect(instance1).toBe(instance2);
    });

    it('should throw when getting without initial parameters', () => {
      resetStepExecutor();

      expect(() => {
        getStepExecutor();
      }).toThrow('parametreleri gerekli');
    });

    it('should return new instance after reset', () => {
      const instance1 = getStepExecutor(registry, claudeCode, TEST_PROJECT_PATH);
      resetStepExecutor();
      const instance2 = getStepExecutor(registry, claudeCode, TEST_PROJECT_PATH);

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('error messages', () => {
    it('should have Turkish error messages', () => {
      expect(EXECUTOR_ERRORS.TEMPLATE_NOT_FOUND).toContain('bulunamadı');
      expect(EXECUTOR_ERRORS.TEMPLATE_READ_FAILED).toContain('okunamadı');
      expect(EXECUTOR_ERRORS.CHECKPOINT_WRITE_FAILED).toContain('yazılamadı');
      expect(EXECUTOR_ERRORS.CHECKPOINT_READ_FAILED).toContain('okunamadı');
    });
  });
});
