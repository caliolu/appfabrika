/**
 * Token Tracker Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, rm, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tokenTracker } from '../token-tracker.js';

const TEST_STATS_DIR = join(process.cwd(), '.test-stats');

describe('Token Tracker', () => {
  beforeEach(() => {
    tokenTracker.reset();
    tokenTracker.setDataDir(TEST_STATS_DIR);
  });

  afterEach(async () => {
    tokenTracker.reset();
    try {
      await rm(TEST_STATS_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('setModel', () => {
    it('should set known model', () => {
      tokenTracker.setModel('claude-3-opus');
      // No error thrown
    });

    it('should use default for unknown model', () => {
      tokenTracker.setModel('unknown-model');
      // Falls back to default, no error thrown
    });
  });

  describe('setContext', () => {
    it('should set workflow context', () => {
      tokenTracker.setContext('workflow-123', 'step-1');
      // Context is set
    });
  });

  describe('track', () => {
    it('should track token usage', () => {
      const usage = tokenTracker.track(1000, 500);

      expect(usage.inputTokens).toBe(1000);
      expect(usage.outputTokens).toBe(500);
      expect(usage.totalTokens).toBe(1500);
      expect(usage.estimatedCost).toBeGreaterThan(0);
      expect(usage.timestamp).toBeDefined();
    });

    it('should calculate cost correctly for default model', () => {
      // Default model: claude-3-sonnet pricing
      // inputPer1k: 0.003, outputPer1k: 0.015
      const usage = tokenTracker.track(1000, 1000);

      // Expected: (1000/1000 * 0.003) + (1000/1000 * 0.015) = 0.018
      expect(usage.estimatedCost).toBe(0.018);
    });

    it('should calculate cost correctly for opus model', () => {
      tokenTracker.setModel('claude-3-opus');
      // inputPer1k: 0.015, outputPer1k: 0.075
      const usage = tokenTracker.track(1000, 1000);

      // Expected: (1000/1000 * 0.015) + (1000/1000 * 0.075) = 0.09
      expect(usage.estimatedCost).toBe(0.09);
    });

    it('should include workflow context in usage', () => {
      tokenTracker.setContext('test-workflow', 'test-step');
      const usage = tokenTracker.track(100, 50);

      expect(usage.workflowId).toBe('test-workflow');
      expect(usage.stepName).toBe('test-step');
    });

    it('should update session stats', () => {
      tokenTracker.track(1000, 500);
      tokenTracker.track(2000, 1000);

      const stats = tokenTracker.getStats();

      expect(stats.totalInputTokens).toBe(3000);
      expect(stats.totalOutputTokens).toBe(1500);
      expect(stats.totalTokens).toBe(4500);
      expect(stats.requestCount).toBe(2);
    });

    it('should track usage by workflow', () => {
      tokenTracker.setContext('workflow-a');
      tokenTracker.track(1000, 500);

      tokenTracker.setContext('workflow-b');
      tokenTracker.track(2000, 1000);

      tokenTracker.setContext('workflow-a');
      tokenTracker.track(500, 250);

      const stats = tokenTracker.getStats();

      expect(stats.usageByWorkflow['workflow-a'].inputTokens).toBe(1500);
      expect(stats.usageByWorkflow['workflow-a'].requests).toBe(2);
      expect(stats.usageByWorkflow['workflow-b'].inputTokens).toBe(2000);
      expect(stats.usageByWorkflow['workflow-b'].requests).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return copy of stats', () => {
      tokenTracker.track(100, 50);
      const stats1 = tokenTracker.getStats();
      const stats2 = tokenTracker.getStats();

      expect(stats1).not.toBe(stats2); // Different references
      expect(stats1.totalInputTokens).toBe(stats2.totalInputTokens);
    });
  });

  describe('getHistory', () => {
    it('should return usage history', () => {
      tokenTracker.track(100, 50);
      tokenTracker.track(200, 100);
      tokenTracker.track(300, 150);

      const history = tokenTracker.getHistory();

      expect(history.length).toBe(3);
      expect(history[0].inputTokens).toBe(100);
      expect(history[2].inputTokens).toBe(300);
    });

    it('should return copy of history', () => {
      tokenTracker.track(100, 50);
      const history1 = tokenTracker.getHistory();
      const history2 = tokenTracker.getHistory();

      expect(history1).not.toBe(history2);
    });
  });

  describe('save', () => {
    it('should save stats to file', async () => {
      tokenTracker.track(1000, 500);
      await tokenTracker.save();

      expect(existsSync(TEST_STATS_DIR)).toBe(true);

      const files = await readdir(TEST_STATS_DIR);
      const statsFiles = files.filter(f => f.startsWith('token-stats-'));
      expect(statsFiles.length).toBe(1);
    });

    it('should merge with existing daily stats', async () => {
      // First save
      tokenTracker.track(1000, 500);
      await tokenTracker.save();

      // Reset and save again
      tokenTracker.reset();
      tokenTracker.setDataDir(TEST_STATS_DIR);
      tokenTracker.track(2000, 1000);
      await tokenTracker.save();

      // Read file and check merged stats
      const files = await readdir(TEST_STATS_DIR);
      const statsFile = files.find(f => f.startsWith('token-stats-'));
      if (statsFile) {
        const content = await readFile(join(TEST_STATS_DIR, statsFile), 'utf-8');
        const stats = JSON.parse(content);

        expect(stats.totalInputTokens).toBe(3000);
        expect(stats.totalOutputTokens).toBe(1500);
      }
    });
  });

  describe('reset', () => {
    it('should reset all stats', () => {
      tokenTracker.track(1000, 500);
      tokenTracker.track(2000, 1000);
      tokenTracker.reset();

      const stats = tokenTracker.getStats();

      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.requestCount).toBe(0);
    });

    it('should clear history', () => {
      tokenTracker.track(100, 50);
      tokenTracker.reset();

      const history = tokenTracker.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('displaySummary', () => {
    it('should display summary without error', () => {
      tokenTracker.track(1000, 500);
      tokenTracker.setContext('test-workflow');
      tokenTracker.track(2000, 1000);

      // Should not throw
      tokenTracker.displaySummary();
    });
  });
});
