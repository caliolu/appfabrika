/**
 * Claude Code Adapter Types
 * Defines types for Claude Code CLI integration
 */

import type { BmadStepType } from './bmad.types.js';

/**
 * Options for Claude Code execution
 */
export interface ClaudeCodeExecutionOptions {
  /** Path to the project directory */
  projectPath: string;
  /** Execution timeout in milliseconds (default: 300000 = 5 min) */
  timeout?: number;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Result from Claude Code execution
 */
export interface ClaudeCodeResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Combined output from stdout */
  output: string;
  /** Process exit code */
  exitCode: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Metadata for Claude Code execution
 */
export interface ClaudeCodeExecutionMetadata {
  /** Step that was executed */
  stepId: BmadStepType;
  /** Path to the prompt file */
  promptPath: string;
  /** Execution timestamp (ISO 8601) */
  executedAt: string;
  /** Execution duration in ms */
  duration: number;
  /** Exit code from Claude Code */
  exitCode: number;
}

/**
 * Turkish error messages for Claude Code operations
 */
export const CLAUDE_CODE_ERRORS = {
  NOT_INSTALLED: 'Claude Code CLI kurulu değil. Lütfen Claude Code\'u kurun.',
  EXECUTION_FAILED: 'Claude Code çalıştırma hatası: {error}',
  TIMEOUT: 'Claude Code zaman aşımına uğradı ({timeout}ms)',
  PROMPT_WRITE_FAILED: 'Prompt dosyası yazılamadı: {path}',
  VERSION_CHECK_FAILED: 'Claude Code versiyon kontrolü başarısız',
} as const;

/**
 * Default configuration values
 */
export const CLAUDE_CODE_DEFAULTS = {
  /** Default timeout: 5 minutes */
  TIMEOUT: 300000,
  /** Prompt file name */
  PROMPT_FILENAME: 'prompt.md',
  /** AppFabrika directory name */
  APPFABRIKA_DIR: '.appfabrika',
} as const;
