/**
 * Manual Step Detector Service
 * Detects when users have manually completed BMAD steps outside the CLI
 */

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { BmadStepType, BMAD_STEP_NAMES } from '../types/bmad.types.js';
import type { StepOutput } from '../types/step.types.js';

/**
 * Configuration for manual step detection
 */
export interface ManualDetectorConfig {
  /** Path to the project directory */
  projectPath: string;
  /** Custom output directory (default: .appfabrika/outputs) */
  outputsDir?: string;
}

/**
 * Result of manual step detection
 */
export interface ManualStepResult {
  /** Whether manual output was detected */
  detected: boolean;
  /** The file path if detected */
  filePath?: string;
  /** The file content if detected */
  content?: string;
  /** File modification time if detected */
  modifiedAt?: string;
}

/**
 * Turkish error messages for manual step detection
 */
export const DETECTOR_ERRORS = {
  OUTPUT_READ_FAILED: 'Manuel çıktı dosyası okunamadı: {path}',
  INVALID_PROJECT_PATH: 'Geçersiz proje yolu',
} as const;

/**
 * Detects and loads manually created step output files
 */
export class ManualStepDetector {
  private readonly projectPath: string;
  private readonly outputsDir: string;

  /**
   * Create a new manual step detector
   * @param config - Detector configuration
   */
  constructor(config: ManualDetectorConfig) {
    if (!config.projectPath) {
      throw new Error(DETECTOR_ERRORS.INVALID_PROJECT_PATH);
    }
    this.projectPath = config.projectPath;
    this.outputsDir = config.outputsDir ?? join(config.projectPath, '.appfabrika', 'outputs');
  }

  /**
   * Get the expected output file path for a step
   * @param stepId - The step to get path for
   * @returns The expected file path
   */
  getOutputPath(stepId: BmadStepType): string {
    return join(this.outputsDir, `${stepId}.md`);
  }

  /**
   * Check if a manual output file exists for a step
   * @param stepId - The step to check
   * @returns True if manual output exists
   */
  hasManualOutput(stepId: BmadStepType): boolean {
    const outputPath = this.getOutputPath(stepId);
    return existsSync(outputPath);
  }

  /**
   * Detect manual step completion
   * @param stepId - The step to detect
   * @returns Detection result
   */
  async detectManualStep(stepId: BmadStepType): Promise<ManualStepResult> {
    const filePath = this.getOutputPath(stepId);

    if (!existsSync(filePath)) {
      return { detected: false };
    }

    try {
      const [content, stats] = await Promise.all([
        readFile(filePath, 'utf-8'),
        stat(filePath),
      ]);

      return {
        detected: true,
        filePath,
        content,
        modifiedAt: stats.mtime.toISOString(),
      };
    } catch (error) {
      // File exists but can't be read
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        DETECTOR_ERRORS.OUTPUT_READ_FAILED.replace('{path}', filePath) +
          ` (${errorMessage})`
      );
    }
  }

  /**
   * Load manual step output as StepOutput
   * @param stepId - The step to load
   * @returns StepOutput if detected, null otherwise
   */
  async loadManualOutput(stepId: BmadStepType): Promise<StepOutput | null> {
    const result = await this.detectManualStep(stepId);

    if (!result.detected || !result.content) {
      return null;
    }

    return {
      content: result.content,
      files: [result.filePath!],
      metadata: {
        source: 'manual',
        detectedAt: new Date().toISOString(),
        originalModifiedAt: result.modifiedAt,
      },
    };
  }

  /**
   * Detect all manual steps that have output files
   * @returns Map of step IDs to detection results
   */
  async detectAllManualSteps(): Promise<Map<BmadStepType, ManualStepResult>> {
    const results = new Map<BmadStepType, ManualStepResult>();

    const stepIds = Object.values(BmadStepType);
    for (const stepId of stepIds) {
      const result = await this.detectManualStep(stepId);
      if (result.detected) {
        results.set(stepId, result);
      }
    }

    return results;
  }

  /**
   * Get the outputs directory path
   */
  getOutputsDir(): string {
    return this.outputsDir;
  }
}

/**
 * Singleton instance
 */
let instance: ManualStepDetector | null = null;

/**
 * Get or create the singleton ManualStepDetector instance
 * @param config - Required on first call
 * @returns The ManualStepDetector instance
 */
export function getManualStepDetector(
  config?: ManualDetectorConfig
): ManualStepDetector {
  if (!instance) {
    if (!config) {
      throw new Error('ManualStepDetector config gerekli (ilk çağrı için)');
    }
    instance = new ManualStepDetector(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetManualStepDetector(): void {
  instance = null;
}
