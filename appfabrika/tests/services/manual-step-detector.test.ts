/**
 * Manual Step Detector Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  ManualStepDetector,
  getManualStepDetector,
  resetManualStepDetector,
  DETECTOR_ERRORS,
} from '../../src/services/manual-step-detector.js';
import { BmadStepType } from '../../src/types/bmad.types.js';

// Test directories
const TEST_PROJECT_PATH = join(process.cwd(), '.test-manual-detector');
const TEST_OUTPUTS_DIR = join(TEST_PROJECT_PATH, '.appfabrika', 'outputs');

describe('ManualStepDetector', () => {
  let detector: ManualStepDetector;

  beforeEach(() => {
    resetManualStepDetector();

    // Clean up test directory
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    mkdirSync(TEST_PROJECT_PATH, { recursive: true });

    detector = new ManualStepDetector({
      projectPath: TEST_PROJECT_PATH,
    });
  });

  afterEach(() => {
    if (existsSync(TEST_PROJECT_PATH)) {
      rmSync(TEST_PROJECT_PATH, { recursive: true, force: true });
    }
    resetManualStepDetector();
  });

  describe('constructor', () => {
    it('should initialize with project path', () => {
      expect(detector.getOutputsDir()).toBe(TEST_OUTPUTS_DIR);
    });

    it('should throw error for invalid project path', () => {
      expect(() => {
        new ManualStepDetector({ projectPath: '' });
      }).toThrow(DETECTOR_ERRORS.INVALID_PROJECT_PATH);
    });

    it('should accept custom outputs directory', () => {
      const customDir = join(TEST_PROJECT_PATH, 'custom-outputs');
      const customDetector = new ManualStepDetector({
        projectPath: TEST_PROJECT_PATH,
        outputsDir: customDir,
      });
      expect(customDetector.getOutputsDir()).toBe(customDir);
    });
  });

  describe('getOutputPath', () => {
    it('should return correct path for step', () => {
      const path = detector.getOutputPath(BmadStepType.BRAINSTORMING);
      expect(path).toBe(join(TEST_OUTPUTS_DIR, 'step-01-brainstorming.md'));
    });

    it('should return different paths for different steps', () => {
      const path1 = detector.getOutputPath(BmadStepType.BRAINSTORMING);
      const path2 = detector.getOutputPath(BmadStepType.RESEARCH);
      expect(path1).not.toBe(path2);
    });
  });

  describe('hasManualOutput', () => {
    it('should return false when no output file exists', () => {
      expect(detector.hasManualOutput(BmadStepType.BRAINSTORMING)).toBe(false);
    });

    it('should return true when output file exists', () => {
      mkdirSync(TEST_OUTPUTS_DIR, { recursive: true });
      const outputPath = detector.getOutputPath(BmadStepType.BRAINSTORMING);
      writeFileSync(outputPath, '# Brainstorming Output\n\nContent here.');

      expect(detector.hasManualOutput(BmadStepType.BRAINSTORMING)).toBe(true);
    });
  });

  describe('detectManualStep', () => {
    it('should return detected: false when no file exists', async () => {
      const result = await detector.detectManualStep(BmadStepType.BRAINSTORMING);
      expect(result.detected).toBe(false);
      expect(result.filePath).toBeUndefined();
      expect(result.content).toBeUndefined();
    });

    it('should return detection result when file exists', async () => {
      mkdirSync(TEST_OUTPUTS_DIR, { recursive: true });
      const outputPath = detector.getOutputPath(BmadStepType.BRAINSTORMING);
      const content = '# Brainstorming Output\n\nManual content.';
      writeFileSync(outputPath, content);

      const result = await detector.detectManualStep(BmadStepType.BRAINSTORMING);

      expect(result.detected).toBe(true);
      expect(result.filePath).toBe(outputPath);
      expect(result.content).toBe(content);
      expect(result.modifiedAt).toBeDefined();
    });

    it('should include modification time', async () => {
      mkdirSync(TEST_OUTPUTS_DIR, { recursive: true });
      const outputPath = detector.getOutputPath(BmadStepType.RESEARCH);
      writeFileSync(outputPath, 'Research content');

      const result = await detector.detectManualStep(BmadStepType.RESEARCH);

      expect(result.modifiedAt).toBeDefined();
      // Should be ISO 8601 format
      expect(result.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('loadManualOutput', () => {
    it('should return null when no file exists', async () => {
      const output = await detector.loadManualOutput(BmadStepType.BRAINSTORMING);
      expect(output).toBeNull();
    });

    it('should return StepOutput when file exists', async () => {
      mkdirSync(TEST_OUTPUTS_DIR, { recursive: true });
      const outputPath = detector.getOutputPath(BmadStepType.PRD);
      const content = '# PRD\n\nProduct requirements document.';
      writeFileSync(outputPath, content);

      const output = await detector.loadManualOutput(BmadStepType.PRD);

      expect(output).not.toBeNull();
      expect(output?.content).toBe(content);
      expect(output?.files).toContain(outputPath);
      expect(output?.metadata?.source).toBe('manual');
    });

    it('should include metadata with timestamps', async () => {
      mkdirSync(TEST_OUTPUTS_DIR, { recursive: true });
      const outputPath = detector.getOutputPath(BmadStepType.ARCHITECTURE);
      writeFileSync(outputPath, 'Architecture content');

      const output = await detector.loadManualOutput(BmadStepType.ARCHITECTURE);

      expect(output?.metadata?.detectedAt).toBeDefined();
      expect(output?.metadata?.originalModifiedAt).toBeDefined();
    });
  });

  describe('detectAllManualSteps', () => {
    it('should return empty map when no files exist', async () => {
      const results = await detector.detectAllManualSteps();
      expect(results.size).toBe(0);
    });

    it('should detect multiple manual steps', async () => {
      mkdirSync(TEST_OUTPUTS_DIR, { recursive: true });

      // Create output files for multiple steps
      writeFileSync(
        detector.getOutputPath(BmadStepType.BRAINSTORMING),
        'Brainstorming'
      );
      writeFileSync(
        detector.getOutputPath(BmadStepType.RESEARCH),
        'Research'
      );
      writeFileSync(
        detector.getOutputPath(BmadStepType.PRD),
        'PRD'
      );

      const results = await detector.detectAllManualSteps();

      expect(results.size).toBe(3);
      expect(results.has(BmadStepType.BRAINSTORMING)).toBe(true);
      expect(results.has(BmadStepType.RESEARCH)).toBe(true);
      expect(results.has(BmadStepType.PRD)).toBe(true);
      expect(results.has(BmadStepType.ARCHITECTURE)).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same instance on subsequent calls', () => {
      const instance1 = getManualStepDetector({ projectPath: TEST_PROJECT_PATH });
      const instance2 = getManualStepDetector();

      expect(instance1).toBe(instance2);
    });

    it('should throw when getting without config', () => {
      resetManualStepDetector();

      expect(() => {
        getManualStepDetector();
      }).toThrow('config gerekli');
    });

    it('should return new instance after reset', () => {
      const instance1 = getManualStepDetector({ projectPath: TEST_PROJECT_PATH });
      resetManualStepDetector();
      const instance2 = getManualStepDetector({ projectPath: TEST_PROJECT_PATH });

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Turkish error messages', () => {
    it('should have Turkish error messages', () => {
      expect(DETECTOR_ERRORS.OUTPUT_READ_FAILED).toContain('okunamadı');
      expect(DETECTOR_ERRORS.INVALID_PROJECT_PATH).toContain('Geçersiz');
    });
  });
});
