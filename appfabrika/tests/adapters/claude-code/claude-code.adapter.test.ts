/**
 * Claude Code Adapter Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import {
  ClaudeCodeAdapter,
  getClaudeCodeAdapter,
  resetClaudeCodeAdapter,
} from '../../../src/adapters/claude-code/claude-code.adapter.js';
import { BmadStepType } from '../../../src/types/bmad.types.js';
import {
  CLAUDE_CODE_ERRORS,
  CLAUDE_CODE_DEFAULTS,
} from '../../../src/types/claude-code.types.js';

// Test directory for file operations
const TEST_PROJECT_PATH = join(process.cwd(), '.test-claude-code-adapter');
const TEST_APPFABRIKA_DIR = join(TEST_PROJECT_PATH, CLAUDE_CODE_DEFAULTS.APPFABRIKA_DIR);

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;

  beforeEach(() => {
    resetClaudeCodeAdapter();

    // Clean up test directory
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    mkdirSync(TEST_PROJECT_PATH, { recursive: true });

    adapter = new ClaudeCodeAdapter({
      projectPath: TEST_PROJECT_PATH,
      timeout: 5000,
      verbose: false,
    });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    resetClaudeCodeAdapter();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(adapter.getProjectPath()).toBe(TEST_PROJECT_PATH);
      expect(adapter.getTimeout()).toBe(5000);
    });

    it('should use default timeout when not provided', () => {
      const defaultAdapter = new ClaudeCodeAdapter({
        projectPath: TEST_PROJECT_PATH,
      });
      expect(defaultAdapter.getTimeout()).toBe(CLAUDE_CODE_DEFAULTS.TIMEOUT);
    });

    it('should set appfabrika directory correctly', () => {
      expect(adapter.getAppfabrikaDir()).toBe(TEST_APPFABRIKA_DIR);
    });
  });

  describe('writePromptFile', () => {
    it('should create .appfabrika directory if not exists', async () => {
      expect(existsSync(TEST_APPFABRIKA_DIR)).toBe(false);

      await adapter.writePromptFile('Test prompt', BmadStepType.BRAINSTORMING);

      expect(existsSync(TEST_APPFABRIKA_DIR)).toBe(true);
    });

    it('should write prompt to step-specific file', async () => {
      const prompt = 'Test brainstorming prompt';
      const promptPath = await adapter.writePromptFile(prompt, BmadStepType.BRAINSTORMING);

      expect(promptPath).toContain('step-01-brainstorming-prompt.md');
      expect(existsSync(promptPath)).toBe(true);

      const content = readFileSync(promptPath, 'utf-8');
      expect(content).toBe(prompt);
    });

    it('should also write to standard prompt.md', async () => {
      const prompt = 'Test standard prompt';
      await adapter.writePromptFile(prompt, BmadStepType.RESEARCH);

      const standardPromptPath = join(TEST_APPFABRIKA_DIR, CLAUDE_CODE_DEFAULTS.PROMPT_FILENAME);
      expect(existsSync(standardPromptPath)).toBe(true);

      const content = readFileSync(standardPromptPath, 'utf-8');
      expect(content).toBe(prompt);
    });

    it('should handle multiple steps correctly', async () => {
      const prompt1 = 'Brainstorming prompt';
      const prompt2 = 'Research prompt';

      const path1 = await adapter.writePromptFile(prompt1, BmadStepType.BRAINSTORMING);
      const path2 = await adapter.writePromptFile(prompt2, BmadStepType.RESEARCH);

      expect(path1).not.toBe(path2);
      expect(readFileSync(path1, 'utf-8')).toBe(prompt1);
      expect(readFileSync(path2, 'utf-8')).toBe(prompt2);
    });

    it('should overwrite existing prompt file', async () => {
      const oldPrompt = 'Old prompt';
      const newPrompt = 'New prompt';

      await adapter.writePromptFile(oldPrompt, BmadStepType.BRAINSTORMING);
      const promptPath = await adapter.writePromptFile(newPrompt, BmadStepType.BRAINSTORMING);

      const content = readFileSync(promptPath, 'utf-8');
      expect(content).toBe(newPrompt);
    });
  });

  describe('isAvailable', () => {
    it('should return true when claude command exists', async () => {
      // This test depends on the environment
      // In CI without Claude Code, it will return false
      const result = await adapter.isAvailable();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getVersion', () => {
    it('should return version string when Claude Code is available', async () => {
      // If Claude Code is installed, this should return a version
      const isInstalled = await adapter.isAvailable();
      if (isInstalled) {
        const version = await adapter.getVersion();
        expect(typeof version).toBe('string');
        expect(version.length).toBeGreaterThan(0);
      } else {
        // If not installed, should throw
        await expect(adapter.getVersion()).rejects.toThrow();
      }
    });
  });

  describe('execute', () => {
    it('should return error result when Claude Code is not installed', async () => {
      // Mock isAvailable to return false
      vi.spyOn(adapter, 'isAvailable').mockResolvedValue(false);

      const result = await adapter.execute('/path/to/prompt.md');

      expect(result.success).toBe(false);
      expect(result.error).toBe(CLAUDE_CODE_ERRORS.NOT_INSTALLED);
      expect(result.exitCode).toBe(-1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include duration in result', async () => {
      vi.spyOn(adapter, 'isAvailable').mockResolvedValue(false);

      const result = await adapter.execute('/path/to/prompt.md');

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeStep', () => {
    it('should write prompt and return output with metadata', async () => {
      // Mock the execute method to return success
      vi.spyOn(adapter, 'isAvailable').mockResolvedValue(true);
      vi.spyOn(adapter, 'execute').mockResolvedValue({
        success: true,
        output: 'Claude Code output',
        exitCode: 0,
        duration: 1000,
      });

      const result = await adapter.executeStep(
        BmadStepType.BRAINSTORMING,
        'Test prompt'
      );

      expect(result.content).toBe('Claude Code output');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.stepId).toBe(BmadStepType.BRAINSTORMING);
      expect(result.metadata?.success).toBe(true);
      expect(result.metadata?.promptPath).toContain('step-01-brainstorming-prompt.md');
    });

    it('should return error output when execution fails', async () => {
      vi.spyOn(adapter, 'isAvailable').mockResolvedValue(false);

      const result = await adapter.executeStep(
        BmadStepType.RESEARCH,
        'Test prompt'
      );

      expect(result.content).toBe(CLAUDE_CODE_ERRORS.NOT_INSTALLED);
      expect(result.metadata?.success).toBe(false);
      expect(result.metadata?.error).toBe(CLAUDE_CODE_ERRORS.NOT_INSTALLED);
    });

    it('should include execution timestamp in metadata', async () => {
      vi.spyOn(adapter, 'isAvailable').mockResolvedValue(true);
      vi.spyOn(adapter, 'execute').mockResolvedValue({
        success: true,
        output: 'Output',
        exitCode: 0,
        duration: 500,
      });

      const beforeTime = new Date().toISOString();
      const result = await adapter.executeStep(BmadStepType.PRD, 'Test');
      const afterTime = new Date().toISOString();

      expect(result.metadata?.executedAt).toBeDefined();
      expect(result.metadata?.executedAt >= beforeTime).toBe(true);
      expect(result.metadata?.executedAt <= afterTime).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should return same instance on subsequent calls', () => {
      const instance1 = getClaudeCodeAdapter({
        projectPath: TEST_PROJECT_PATH,
      });
      const instance2 = getClaudeCodeAdapter();

      expect(instance1).toBe(instance2);
    });

    it('should throw when getting without initial options', () => {
      resetClaudeCodeAdapter();

      expect(() => {
        getClaudeCodeAdapter();
      }).toThrow('options gerekli');
    });

    it('should return new instance after reset', () => {
      const instance1 = getClaudeCodeAdapter({
        projectPath: TEST_PROJECT_PATH,
      });

      resetClaudeCodeAdapter();

      const instance2 = getClaudeCodeAdapter({
        projectPath: TEST_PROJECT_PATH,
      });

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('error messages', () => {
    it('should use Turkish error messages', () => {
      expect(CLAUDE_CODE_ERRORS.NOT_INSTALLED).toContain('kurulu değil');
      expect(CLAUDE_CODE_ERRORS.EXECUTION_FAILED).toContain('çalıştırma hatası');
      expect(CLAUDE_CODE_ERRORS.TIMEOUT).toContain('zaman aşımına');
      expect(CLAUDE_CODE_ERRORS.PROMPT_WRITE_FAILED).toContain('yazılamadı');
    });
  });

  describe('defaults', () => {
    it('should have correct default values', () => {
      expect(CLAUDE_CODE_DEFAULTS.TIMEOUT).toBe(300000);
      expect(CLAUDE_CODE_DEFAULTS.PROMPT_FILENAME).toBe('prompt.md');
      expect(CLAUDE_CODE_DEFAULTS.APPFABRIKA_DIR).toBe('.appfabrika');
    });
  });
});
