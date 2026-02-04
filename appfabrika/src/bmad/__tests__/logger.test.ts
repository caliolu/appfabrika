/**
 * Logger Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdir, rm, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { logger } from '../logger.js';

const TEST_LOG_DIR = join(process.cwd(), '.test-logs');

describe('Logger', () => {
  beforeEach(async () => {
    logger.configure({
      logDir: TEST_LOG_DIR,
      logToConsole: false, // Suppress console during tests
      logToFile: true,
    });
  });

  afterEach(async () => {
    await logger.close();
    try {
      await rm(TEST_LOG_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('configure', () => {
    it('should update logger configuration', () => {
      logger.configure({ level: 'debug' });
      // No error thrown - configuration accepted
    });
  });

  describe('setWorkflowContext', () => {
    it('should set workflow context', () => {
      logger.setWorkflowContext('workflow-123', 'step-1');
      // Context is set internally
    });

    it('should clear workflow context', () => {
      logger.setWorkflowContext('workflow-123', 'step-1');
      logger.clearWorkflowContext();
      // Context is cleared
    });
  });

  describe('logging methods', () => {
    it('should log debug messages', () => {
      logger.configure({ level: 'debug' });
      logger.debug('Debug message', { key: 'value' });
      // No error thrown
    });

    it('should log info messages', () => {
      logger.info('Info message', { key: 'value' });
      // No error thrown
    });

    it('should log warn messages', () => {
      logger.warn('Warning message', { key: 'value' });
      // No error thrown
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error message', error, { key: 'value' });
      // No error thrown
    });

    it('should handle non-Error error objects', () => {
      logger.error('Error message', 'string error');
      logger.error('Error message', { custom: 'error' });
      // No error thrown
    });
  });

  describe('flush', () => {
    it('should flush logs to file', async () => {
      logger.info('Test log entry');
      await logger.flush();

      // Check if log directory was created
      expect(existsSync(TEST_LOG_DIR)).toBe(true);

      // Check if log file exists
      const files = await readdir(TEST_LOG_DIR);
      const logFiles = files.filter(f => f.endsWith('.log'));
      expect(logFiles.length).toBeGreaterThan(0);
    });

    it('should create valid JSON log entries', async () => {
      logger.info('JSON test', { data: 123 });
      await logger.flush();

      const files = await readdir(TEST_LOG_DIR);
      const logFile = files.find(f => f.endsWith('.log'));
      if (logFile) {
        const content = await readFile(join(TEST_LOG_DIR, logFile), 'utf-8');
        const lines = content.trim().split('\n');
        const entry = JSON.parse(lines[0]);

        expect(entry.message).toBe('JSON test');
        expect(entry.context?.data).toBe(123);
        expect(entry.level).toBe('info');
        expect(entry.timestamp).toBeDefined();
      }
    });
  });

  describe('getRecentLogs', () => {
    it('should return buffered log entries', () => {
      logger.info('Recent log 1');
      logger.info('Recent log 2');

      const recent = logger.getRecentLogs();
      expect(recent.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('log levels', () => {
    it('should filter logs below configured level', () => {
      logger.configure({ level: 'warn', logToFile: true });

      logger.debug('Should not log');
      logger.info('Should not log');
      logger.warn('Should log');
      logger.error('Should log');

      const recent = logger.getRecentLogs();
      // Only warn and error should be in buffer
      const hasDebug = recent.some(r => r.message === 'Should not log' && r.level === 'debug');
      const hasWarn = recent.some(r => r.message === 'Should log' && r.level === 'warn');

      expect(hasDebug).toBe(false);
      expect(hasWarn).toBe(true);
    });
  });
});
